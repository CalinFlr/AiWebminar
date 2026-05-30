const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
}

export function methodNotAllowed() {
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

export async function readJson(request) {
  const maxLength = 16000;
  const length = Number(request.headers.get("content-length") || "0");
  if (length > maxLength) {
    throw new Error("payload_too_large");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("invalid_content_type");
  }

  const text = await request.text();
  if (text.length > maxLength) {
    throw new Error("payload_too_large");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("invalid_json");
  }
}

export async function postWebhook(url, payload) {
  if (!url) {
    return { skipped: true };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      error: "webhook_fetch_failed",
      message: String(error && error.message ? error.message : error).slice(0, 200)
    };
  }
}

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function publicWebhookResponse(body, text) {
  if (body && typeof body === "object") {
    return {
      ok: body.ok === true,
      error: body.error || "",
      type: body.type || "",
      row: body.row || "",
      sheet: body.sheet || "",
      emailStatus: body.emailStatus || "",
      duplicate: body.duplicate === true
    };
  }

  return {
    ok: false,
    error: "invalid_json_response",
    text: String(text || "").slice(0, 300)
  };
}

export async function postSignedOpsWebhook({ url, secret, type, record }) {
  if (!url) {
    return { provider: "apps_script", ok: false, skipped: true, error: "apps_script_webhook_not_configured" };
  }

  if (!secret) {
    return { provider: "apps_script", ok: false, error: "apps_script_secret_not_configured" };
  }

  const envelope = {
    type,
    sentAt: new Date().toISOString(),
    nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    record
  };
  const signedPayload = JSON.stringify(envelope);
  const signature = await hmacHex(secret, signedPayload);
  let response;
  let text = "";

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signedPayload, signature })
    });
    text = await response.text();
  } catch (error) {
    return {
      provider: "apps_script",
      ok: false,
      error: "apps_script_fetch_failed",
      message: String(error && error.message ? error.message : error).slice(0, 200)
    };
  }

  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = null;
  }

  const webhookResponse = publicWebhookResponse(body, text);
  return {
    provider: "apps_script",
    ok: response.ok && webhookResponse.ok,
    status: response.status,
    response: webhookResponse
  };
}

export async function postOpsWebhook(env, type, record, makeUrl) {
  if (env.GOOGLE_OPS_WEBHOOK_URL) {
    return postSignedOpsWebhook({
      url: env.GOOGLE_OPS_WEBHOOK_URL,
      secret: env.GOOGLE_OPS_WEBHOOK_SECRET,
      type,
      record
    });
  }

  if (makeUrl) {
    const make = await postWebhook(makeUrl, record);
    return {
      provider: "make",
      ok: make.ok,
      status: make.status,
      error: make.error || "",
      message: make.message || "",
      skipped: make.skipped === true
    };
  }

  return { provider: "none", ok: false, skipped: true, error: "ops_webhook_not_configured" };
}

export function getBaseUrl(request, env) {
  if (env.PUBLIC_SITE_URL) {
    return env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  }

  const url = new URL(request.url);
  return url.origin;
}

export function buildPaymentLink(paymentLinkUrl, payload) {
  if (!paymentLinkUrl) {
    return "";
  }

  try {
    const url = new URL(paymentLinkUrl);
    if (payload.leadId) {
      url.searchParams.set("client_reference_id", payload.leadId);
      url.searchParams.set("lead_id", payload.leadId);
    }

    return url.toString();
  } catch (error) {
    return "";
  }
}

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  if (digits.startsWith("0")) {
    return `40${digits.slice(1)}`;
  }
  return digits;
}

export function buildReminderLinks({ phone, name, access, freeGroupUrl, vipGroupUrl }) {
  const normalizedPhone = normalizePhone(phone);
  const groupUrl = access === "vip" ? vipGroupUrl : freeGroupUrl;
  const groupName = access === "vip" ? "AI WEBMINAR PRO" : "AI WEBMINAR FREE";
  const firstName = String(name || "").trim().split(/\s+/)[0] || "Salut";
  const message = `${firstName}, ai loc prioritar la workshopul AI Automation Zero to Hero. Intra in grupul WhatsApp ${groupName} pentru link, remindere, bonus si anunturi: ${groupUrl || "[link grup WhatsApp]"}`;
  const encoded = encodeURIComponent(message);

  return {
    reminderMessage: message,
    smsReminderUrl: normalizedPhone ? `sms:+${normalizedPhone}?body=${encoded}` : "",
    whatsappReminderUrl: normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encoded}` : ""
  };
}

export function cleanText(value, max = 500) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

export function cleanLongText(value, max = 2000) {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }
  return email;
}

export function cleanPhone(value) {
  const phone = String(value || "").trim().slice(0, 32);
  if (!/^[+()\d\s.-]{7,32}$/.test(phone)) {
    return "";
  }
  return phone;
}

export function cleanEnum(value, allowed, fallback = "") {
  const text = String(value || "").trim();
  return allowed.includes(text) ? text : fallback;
}

export function cleanUrl(value) {
  const raw = String(value || "").trim().slice(0, 500);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch (error) {
    return "";
  }
}

export function cleanUtm(value) {
  const input = value && typeof value === "object" ? value : {};
  const allowed = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "fbclid",
    "gclid",
    "gcpc"
  ];

  return allowed.reduce((acc, key) => {
    if (input[key]) {
      acc[key] = cleanText(input[key], 300);
    }
    return acc;
  }, {});
}
