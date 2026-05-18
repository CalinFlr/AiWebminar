import { hasD1 } from "./storage.js";

const DEFAULT_WINDOW_SECONDS = 15 * 60;

function getHeader(request, name) {
  return request.headers.get(name) || "";
}

export function getClientIp(request) {
  const cfIp = getHeader(request, "cf-connecting-ip") || getHeader(request, "true-client-ip");
  if (cfIp) return cfIp.slice(0, 128);

  const forwarded = getHeader(request, "x-forwarded-for").split(",")[0]?.trim();
  return (forwarded || "unknown").slice(0, 128);
}

async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashIdentifier(env, scope, identifier) {
  const salt = env.RATE_LIMIT_SALT || env.GOOGLE_OPS_WEBHOOK_SECRET || "aiwebminar";
  return sha256Hex(`${salt}:${scope}:${String(identifier || "").toLowerCase()}`);
}

function getWindowStart(now, windowSeconds) {
  return Math.floor(now / 1000 / windowSeconds) * windowSeconds;
}

function getLimit(env, name, fallback) {
  const value = Number(env[name] || "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function verifyTurnstile({ request, env, token }) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, error: "turnstile_required" };
  }

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);

  const clientIp = getClientIp(request);
  if (clientIp && clientIp !== "unknown") {
    body.append("remoteip", clientIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success === true) {
      return { ok: true, provider: "turnstile" };
    }
    return {
      ok: false,
      error: "turnstile_failed",
      codes: Array.isArray(result["error-codes"]) ? result["error-codes"].slice(0, 5) : []
    };
  } catch (error) {
    return {
      ok: false,
      error: "turnstile_unavailable",
      message: String(error && error.message ? error.message : error).slice(0, 160)
    };
  }
}

export async function checkRateLimits({ request, env, endpoint, email = "", leadId = "" }) {
  if (!hasD1(env)) {
    return { ok: true, skipped: true, reason: "d1_not_configured" };
  }

  const windowSeconds = getLimit(env, "RATE_LIMIT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS);
  const now = new Date();
  const windowStart = getWindowStart(now.getTime(), windowSeconds);
  const checks = [];
  const clientIp = getClientIp(request);

  if (endpoint === "lead") {
    checks.push({ scope: "lead_ip", identifier: clientIp, limit: getLimit(env, "LEAD_RATE_LIMIT_IP", 30) });
    if (email) {
      checks.push({ scope: "lead_email", identifier: email, limit: getLimit(env, "LEAD_RATE_LIMIT_EMAIL", 5) });
    }
  }

  if (endpoint === "onboarding") {
    checks.push({ scope: "onboarding_ip", identifier: clientIp, limit: getLimit(env, "ONBOARDING_RATE_LIMIT_IP", 40) });
    if (email) {
      checks.push({ scope: "onboarding_email", identifier: email, limit: getLimit(env, "ONBOARDING_RATE_LIMIT_EMAIL", 10) });
    }
    if (leadId) {
      checks.push({ scope: "onboarding_lead", identifier: leadId, limit: getLimit(env, "ONBOARDING_RATE_LIMIT_LEAD", 5) });
    }
  }

  try {
    for (const check of checks) {
      if (!check.identifier) continue;
      const identifierHash = await hashIdentifier(env, check.scope, check.identifier);
      const row = await env.AIWEBMINAR_DB.prepare(`
        INSERT INTO rate_limits (
          scope, identifier_hash, window_start, count, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(scope, identifier_hash, window_start)
        DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
        RETURNING count
      `).bind(
        check.scope,
        identifierHash,
        windowStart,
        now.toISOString(),
        now.toISOString()
      ).first();

      const count = Number(row?.count || 1);
      if (count > check.limit) {
        return {
          ok: false,
          error: "rate_limited",
          scope: check.scope,
          retryAfter: windowStart + windowSeconds - Math.floor(Date.now() / 1000)
        };
      }
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: true,
      skipped: true,
      error: "rate_limit_unavailable",
      message: String(error && error.message ? error.message : error).slice(0, 160)
    };
  }
}

export async function guardPublicWrite({ request, env, endpoint, email = "", leadId = "", turnstileToken = "" }) {
  const rateLimit = await checkRateLimits({ request, env, endpoint, email, leadId });
  if (!rateLimit.ok) {
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      message: "Prea multe incercari intr-un timp scurt. Incearca din nou peste cateva minute.",
      headers: { "retry-after": String(Math.max(1, rateLimit.retryAfter || DEFAULT_WINDOW_SECONDS)) }
    };
  }

  const turnstile = await verifyTurnstile({ request, env, token: turnstileToken });
  if (!turnstile.ok) {
    return {
      ok: false,
      status: 403,
      error: turnstile.error || "turnstile_failed",
      message: "Verificarea anti-spam nu a trecut. Reincarca pagina si incearca din nou."
    };
  }

  return { ok: true, rateLimit, turnstile };
}
