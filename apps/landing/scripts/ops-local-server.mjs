import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { promisify } from "node:util";

await loadLocalEnv();

const port = Number(process.env.OPS_PORT || 8789);
const remoteBaseUrl = (process.env.OPS_REMOTE_BASE_URL || "https://aiwebminar.pages.dev").replace(/\/+$/, "");
const adminExportToken = process.env.OPS_ADMIN_EXPORT_TOKEN || process.env.ADMIN_EXPORT_TOKEN || "";
const root = process.cwd();
const execFileAsync = promisify(execFile);
const whatsappWebScript = normalize(join(root, "scripts", "whatsapp-web-cdp.mjs"));
const opsSettingsPath = normalize(join(root, "ops-settings.json"));
const whatsappOneToOneCooldownMs = Number(process.env.WA_1TO1_COOLDOWN_MS || 10000);
const smsGatewayBaseUrl = (process.env.SMS_GATEWAY_URL || "").replace(/\/+$/, "");
const smsGatewayUsername = process.env.SMS_GATEWAY_USERNAME || "";
const smsGatewayPassword = process.env.SMS_GATEWAY_PASSWORD || "";
const smsGatewayMessagesPath = normalizeGatewayPath(process.env.SMS_GATEWAY_MESSAGES_PATH || "/messages");
const smsGatewayTimeoutMs = Number(process.env.SMS_GATEWAY_TIMEOUT_MS || 45000);
const smsGatewayCooldownMs = Number(process.env.SMS_GATEWAY_COOLDOWN_MS || 15000);
let lastWhatsappOneToOneSentAt = 0;
let whatsappOneToOneBusy = false;
let lastSmsGatewaySentAt = 0;
let smsGatewayBusy = false;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/api/local-ops-status") {
      sendJson(response, {
        ok: true,
        adminExportTokenConfigured: Boolean(adminExportToken),
        opsSettingsAvailable: await fileExists(opsSettingsPath),
        whatsappWebAvailable: await fileExists(whatsappWebScript),
        whatsappWebScriptAvailable: await fileExists(whatsappWebScript),
        whatsappWebProfileConfigured: Boolean(process.env.WA_WEB_CHROME_PROFILE),
        whatsappWebCdpPortConfigured: Boolean(process.env.WA_WEB_CDP_PORT),
        smsGatewayConfigured: smsGatewayConfigured(),
        smsGatewayUrlConfigured: Boolean(smsGatewayBaseUrl),
        smsGatewayAuthConfigured: Boolean(smsGatewayUsername && smsGatewayPassword),
        smsGatewayCooldownMs
      });
      return;
    }

    if (url.pathname === "/api/whatsapp-web") {
      await handleWhatsappWeb(request, response);
      return;
    }

    if (url.pathname === "/api/whatsapp-1to1") {
      await handleWhatsappOneToOne(request, response);
      return;
    }

    if (url.pathname === "/api/sms-gateway") {
      await handleSmsGateway(request, response);
      return;
    }

    if (url.pathname === "/api/ops-summary") {
      await handleLocalOpsSummary(request, response);
      return;
    }

    if (url.pathname === "/api/config" || url.pathname === "/api/export" || url.pathname === "/api/ops-reminders") {
      await proxyApi(request, response, url);
      return;
    }

    const filePath = resolveStaticFile(url.pathname);
    if (!filePath) {
      sendText(response, 404, "Not found");
      return;
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(content);
  } catch (error) {
    sendText(response, 500, `Local ops error: ${error.message || error}`);
  }
});

server.listen(port, () => {
  console.log(`AIWebminar local ops: http://localhost:${port}/ops`);
  console.log(`AIWebminar email previews: http://localhost:${port}/emails`);
  console.log(`Proxy API: ${remoteBaseUrl}`);
  console.log(`Admin export token: ${adminExportToken ? "configured" : "missing"}`);
});

function resolveStaticFile(pathname) {
  const routes = new Map([
    ["/", "ops.html"],
    ["/ops", "ops.html"],
    ["/ops.html", "ops.html"],
    ["/ops-settings.json", "ops-settings.json"],
    ["/emails", "email-previews/index.html"],
    ["/emails.html", "email-previews/index.html"],
    ["/email-previews", "email-previews/index.html"],
    ["/email-previews/", "email-previews/index.html"],
    ["/email-previews/index.html", "email-previews/index.html"],
    ["/email-previews/free-confirmation.html", "email-previews/free-confirmation.html"],
    ["/email-previews/vip-intent.html", "email-previews/vip-intent.html"],
    ["/email-previews/vip-confirmed.html", "email-previews/vip-confirmed.html"],
    ["/index.html", "index.html"],
    ["/bonus.html", "bonus.html"],
    ["/privacy.html", "privacy.html"],
    ["/thank-you.html", "thank-you.html"],
    ["/favicon.ico", "favicon.svg"],
    ["/favicon.svg", "favicon.svg"],
    ["/mentor.jpeg", "mentor.jpeg"]
  ]);

  const file = routes.get(pathname);
  if (!file) return "";

  const fullPath = normalize(join(root, file));
  return fullPath.startsWith(root) ? fullPath : "";
}

async function handleWhatsappWeb(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, { ok: false, error: "invalid_json", message: error.message }, 400);
    return;
  }

  const target = String(payload.target || "").trim().toLowerCase();
  const message = String(payload.message || "").trim();
  const mode = String(payload.mode || "preview").trim().toLowerCase();
  const settings = await readOpsSettings();
  const configuredTargets = new Set((settings.whatsapp?.targets || [])
    .filter((item) => item.chatTitle)
    .map((item) => String(item.id || "").toLowerCase()));
  const validTargets = new Set([...configuredTargets, "both"]);
  const validModes = new Set(["preview", "send"]);

  if (!validTargets.has(target)) {
    sendJson(response, { ok: false, error: "invalid_target" }, 400);
    return;
  }

  if (!validModes.has(mode)) {
    sendJson(response, { ok: false, error: "invalid_mode" }, 400);
    return;
  }

  if (!message || message.length > 3000) {
    sendJson(response, { ok: false, error: "invalid_message" }, 400);
    return;
  }

  if (target === "both" && mode === "preview") {
    sendJson(response, { ok: false, error: "both_preview_disabled" }, 400);
    return;
  }

  try {
    const targets = target === "both" ? ["free", "vip"] : [target];
    const runs = [];

    for (const currentTarget of targets) {
      try {
        const { stdout, stderr } = await runWhatsappWeb(currentTarget, message, mode);
        runs.push({
          target: currentTarget,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      } catch (error) {
        error.failedTarget = currentTarget;
        error.completedRuns = runs;
        throw error;
      }
    }

    sendJson(response, {
      ok: true,
      target,
      mode,
      runs,
      stdout: runs.map((run) => run.stdout).filter(Boolean).join("\n"),
      stderr: runs.map((run) => run.stderr).filter(Boolean).join("\n")
    });
  } catch (error) {
    sendJson(response, {
      ok: false,
      error: "whatsapp_web_failed",
      failedTarget: error.failedTarget || target,
      runs: error.completedRuns || [],
      message: error.message,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim()
    }, 500);
  }
}

async function readOpsSettings() {
  return JSON.parse(await readFile(opsSettingsPath, "utf8"));
}

async function handleWhatsappOneToOne(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, { ok: false, error: "invalid_json", message: error.message }, 400);
    return;
  }

  const phone = normalizeWhatsAppPhone(payload.phone);
  const message = String(payload.message || "").trim();

  if (!phone) {
    sendJson(response, { ok: false, error: "invalid_phone" }, 400);
    return;
  }

  if (!message || message.length > 3000) {
    sendJson(response, { ok: false, error: "invalid_message" }, 400);
    return;
  }

  if (whatsappOneToOneBusy) {
    sendJson(response, { ok: false, error: "whatsapp_1to1_busy" }, 409);
    return;
  }

  const elapsed = Date.now() - lastWhatsappOneToOneSentAt;
  if (lastWhatsappOneToOneSentAt && elapsed < whatsappOneToOneCooldownMs) {
    sendJson(response, {
      ok: false,
      error: "whatsapp_1to1_cooldown",
      retryAfterMs: whatsappOneToOneCooldownMs - elapsed
    }, 429);
    return;
  }

  whatsappOneToOneBusy = true;
  try {
    const { stdout, stderr } = await runWhatsappOneToOne(phone, message);
    lastWhatsappOneToOneSentAt = Date.now();
    sendJson(response, {
      ok: true,
      phone,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      cooldownMs: whatsappOneToOneCooldownMs
    });
  } catch (error) {
    sendJson(response, {
      ok: false,
      error: "whatsapp_1to1_failed",
      message: error.message,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim()
    }, 500);
  } finally {
    whatsappOneToOneBusy = false;
  }
}

async function handleLocalOpsSummary(request, response) {
  if (request.method !== "GET") {
    sendJson(response, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }
  if (!adminExportToken) {
    sendJson(response, { ok: false, error: "admin_export_token_not_configured" }, 503);
    return;
  }

  const authorization = request.headers.authorization || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (bearer && !safeEqual(bearer, adminExportToken)) {
    sendJson(response, { ok: false, error: "forbidden" }, 403);
    return;
  }

  try {
    const [leads, onboarding, payments, vipFulfillments, reminders] = await Promise.all([
      fetchRemoteExportRows("leads"),
      fetchRemoteExportRows("onboarding"),
      fetchRemoteExportRows("payments"),
      fetchRemoteExportRows("vip_fulfillments"),
      fetchRemoteExportRows("reminders")
    ]);
    const pendingWhatsappReminders = reminders.filter((row) =>
      String(row.channel || "").toLowerCase() === "whatsapp" &&
      String(row.status || "").toLowerCase() === "de_trimis"
    ).length;
    const pendingSmsReminders = reminders.filter((row) =>
      String(row.channel || "").toLowerCase() === "sms" &&
      String(row.status || "").toLowerCase() === "de_trimis"
    ).length;
    const onboardingLeadIds = new Set(onboarding.map((row) => String(row.lead_id || "").trim()).filter(Boolean));
    const missingOnboardingRows = leads.filter((row) => {
      const leadId = String(row.lead_id || "").trim();
      return leadId && !onboardingLeadIds.has(leadId);
    });
    const freeMissingOnboarding = missingOnboardingRows.filter((row) => String(row.access || "").toLowerCase() === "free").length;
    const vipMissingOnboarding = missingOnboardingRows.filter((row) => String(row.access || "").toLowerCase() === "vip").length;

    sendJson(response, {
      ok: true,
      counts: {
        leads: leads.length,
        onboarding: onboarding.length,
        payments: payments.length,
        vipFulfillments: vipFulfillments.length,
        reminders: reminders.length,
        pendingWhatsappReminders,
        pendingSmsReminders,
        missingOnboarding: missingOnboardingRows.length,
        freeMissingOnboarding,
        vipMissingOnboarding
      },
      latest: {
        leadReceivedAt: newest(leads, "server_received_at"),
        paymentReceivedAt: newest(payments, "server_received_at"),
        vipFulfilledAt: newest(vipFulfillments, "fulfilled_at"),
        reminderCreatedAt: newest(reminders, "created_at")
      }
    });
  } catch (error) {
    sendJson(response, { ok: false, error: "ops_summary_failed", message: error.message }, 502);
  }
}

async function runWhatsappWeb(target, message, mode) {
  return execFileAsync(
    process.execPath,
    [whatsappWebScript, target, message, mode === "send" ? "--send" : "--preview"],
    {
      cwd: root,
      timeout: 210000,
      maxBuffer: 1024 * 128
    }
  );
}

async function runWhatsappOneToOne(phone, message) {
  return execFileAsync(
    process.execPath,
    [whatsappWebScript, "--phone", phone, message, "--send"],
    {
      cwd: root,
      timeout: 210000,
      maxBuffer: 1024 * 128
    }
  );
}

async function handleSmsGateway(request, response) {
  if (request.method === "GET") {
    await handleSmsGatewayHealth(response);
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, { ok: false, error: "method_not_allowed" }, 405);
    return;
  }

  if (!smsGatewayConfigured()) {
    sendJson(response, { ok: false, error: "sms_gateway_not_configured" }, 503);
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, { ok: false, error: "invalid_json", message: error.message }, 400);
    return;
  }

  const phone = normalizeSmsPhone(payload.phone);
  const message = String(payload.message || "").trim();
  const id = cleanSmsMessageId(payload.id) || createSmsMessageId(payload.reminderId);

  if (!phone) {
    sendJson(response, { ok: false, error: "invalid_phone" }, 400);
    return;
  }

  if (!message || message.length > 3000) {
    sendJson(response, { ok: false, error: "invalid_message" }, 400);
    return;
  }

  if (smsGatewayBusy) {
    sendJson(response, { ok: false, error: "sms_gateway_busy" }, 409);
    return;
  }

  const elapsed = Date.now() - lastSmsGatewaySentAt;
  if (lastSmsGatewaySentAt && elapsed < smsGatewayCooldownMs) {
    sendJson(response, {
      ok: false,
      error: "sms_gateway_cooldown",
      retryAfterMs: smsGatewayCooldownMs - elapsed
    }, 429);
    return;
  }

  smsGatewayBusy = true;
  try {
    const result = await sendSmsGatewayMessage({ id, phone, message });
    lastSmsGatewaySentAt = Date.now();
    sendJson(response, {
      ok: true,
      id,
      phone,
      gatewayStatus: result.gatewayStatus || 0,
      state: result.state || "",
      status: result.status || null,
      acceptedViaStatus: result.acceptedViaStatus === true,
      cooldownMs: smsGatewayCooldownMs
    });
  } catch (error) {
    sendJson(response, {
      ok: false,
      error: error.code || "sms_gateway_failed",
      id,
      message: String(error.message || error).slice(0, 240),
      status: error.status || null
    }, error.httpStatus || 502);
  } finally {
    smsGatewayBusy = false;
  }
}

async function handleSmsGatewayHealth(response) {
  if (!smsGatewayConfigured()) {
    sendJson(response, {
      ok: true,
      configured: false,
      urlConfigured: Boolean(smsGatewayBaseUrl),
      authConfigured: Boolean(smsGatewayUsername && smsGatewayPassword)
    });
    return;
  }

  try {
    const health = await fetchSmsGateway("/health", { method: "GET" }, 5000);
    sendJson(response, {
      ok: true,
      configured: true,
      reachable: health.response.ok,
      status: health.response.status,
      serviceStatus: health.body?.status || "",
      version: health.body?.version || ""
    });
  } catch (error) {
    sendJson(response, {
      ok: true,
      configured: true,
      reachable: false,
      error: "sms_gateway_health_failed",
      message: String(error.message || error).slice(0, 200)
    });
  }
}

async function sendSmsGatewayMessage({ id, phone, message }) {
  const body = {
    id,
    textMessage: { text: message },
    phoneNumbers: [phone],
    withDeliveryReport: true
  };

  try {
    const sent = await fetchSmsGateway(smsGatewayMessagesPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }, smsGatewayTimeoutMs);

    const status = await pollSmsGatewayMessage(id, 8, 900);
    if (status?.state && isFailedSmsState(status.state)) {
      const error = new Error(`sms_gateway_state_${status.state}`);
      error.code = "sms_gateway_message_failed";
      error.status = status;
      throw error;
    }

    return {
      gatewayStatus: sent.response.status,
      state: status?.state || sent.body?.state || "",
      status: status || sent.body || null
    };
  } catch (error) {
    const status = await pollSmsGatewayMessage(id, 8, 900).catch(() => null);
    if (status?.state && !isFailedSmsState(status.state)) {
      return {
        gatewayStatus: 0,
        state: status.state,
        status,
        acceptedViaStatus: true
      };
    }
    throw error;
  }
}

async function pollSmsGatewayMessage(id, attempts, delayMs) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await delay(delayMs);
    }

    try {
      const result = await fetchSmsGateway(`${smsGatewayMessagesPath}/${encodeURIComponent(id)}`, {
        method: "GET"
      }, 5000);
      if (!result.response.ok) continue;

      const status = extractSmsStatus(result.body);
      if (status?.state) {
        const normalizedState = String(status.state || "").toLowerCase();
        if (["sent", "delivered", "failed"].includes(normalizedState) || attempt === attempts - 1) {
          return status;
        }
      }
    } catch (_) {
      // The gateway can take a moment to expose the generated message id.
    }
  }
  return null;
}

async function fetchSmsGateway(path, init = {}, timeoutMs = smsGatewayTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(smsGatewayUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: smsGatewayAuthHeader(),
        accept: "application/json",
        ...(init.headers || {})
      }
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = null;
    }
    if (!response.ok) {
      const error = new Error(body?.message || body?.error || `sms_gateway_http_${response.status}`);
      error.code = "sms_gateway_http_error";
      error.httpStatus = 502;
      error.status = { httpStatus: response.status, body };
      throw error;
    }
    return { response, body, text };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("sms_gateway_timeout");
      timeoutError.code = "sms_gateway_timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function smsGatewayUrl(path) {
  return new URL(normalizeGatewayPath(path), `${smsGatewayBaseUrl}/`).toString();
}

function smsGatewayAuthHeader() {
  return `Basic ${Buffer.from(`${smsGatewayUsername}:${smsGatewayPassword}`).toString("base64")}`;
}

function smsGatewayConfigured() {
  return Boolean(smsGatewayBaseUrl && smsGatewayUsername && smsGatewayPassword);
}

function normalizeGatewayPath(value) {
  const path = String(value || "").trim();
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeSmsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  let normalized = digits;
  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  if (normalized.startsWith("0")) normalized = `40${normalized.slice(1)}`;
  return normalized.length >= 7 && normalized.length <= 15 ? `+${normalized}` : "";
}

function cleanSmsMessageId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9._:-]{3,80}$/.test(id) ? id : "";
}

function createSmsMessageId(reminderId) {
  const suffix = cleanSmsMessageId(reminderId) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `aiwebminar-${suffix}`;
}

function extractSmsStatus(body) {
  if (!body || typeof body !== "object") return null;
  const recipient = Array.isArray(body.recipients) ? body.recipients[0] : null;
  const states = Array.isArray(recipient?.states) ? recipient.states : [];
  const latest = states.at(-1) || null;
  return {
    id: body.id || "",
    state: body.state || latest?.type || "",
    recipientState: latest?.type || "",
    phoneNumber: recipient?.phoneNumber || "",
    updatedAt: latest?.date || body.updatedAt || body.createdAt || ""
  };
}

function isFailedSmsState(state) {
  return String(state || "").toLowerCase() === "failed";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `40${digits.slice(1)}`;
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 12000) {
      throw new Error("request_body_too_large");
    }
  }
  return body ? JSON.parse(body) : {};
}

async function proxyApi(request, response, localUrl) {
  const targetUrl = new URL(`${remoteBaseUrl}${localUrl.pathname}`);
  localUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

  const headers = {};
  const authorization = request.headers.authorization;
  if (authorization) {
    headers.authorization = authorization;
  } else if ((localUrl.pathname === "/api/export" || localUrl.pathname === "/api/ops-reminders") && adminExportToken) {
    headers.authorization = `Bearer ${adminExportToken}`;
  }
  headers.accept = request.headers.accept || "application/json";
  if (request.headers["content-type"]) {
    headers["content-type"] = request.headers["content-type"];
  }

  const init = {
    method: request.method,
    headers
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await readRawBody(request);
  }

  const remoteResponse = await fetch(targetUrl, init);
  const body = await remoteResponse.arrayBuffer();
  const responseContentType = remoteResponse.headers.get("content-type") || "";
  const isOpsReminderJsonFallback = localUrl.pathname === "/api/ops-reminders" && !responseContentType.includes("application/json");
  if (isOpsReminderJsonFallback) {
    sendJson(response, {
      ok: false,
      error: "ops_reminders_endpoint_unavailable",
      message: "Endpointul /api/ops-reminders nu este disponibil pe remote. Deployeaza functia inainte de Send next.",
      remoteStatus: remoteResponse.status || 0
    });
    return;
  }
  response.writeHead(remoteResponse.status, {
    "content-type": responseContentType || "application/octet-stream",
    "content-disposition": remoteResponse.headers.get("content-disposition") || "",
    "cache-control": "no-store"
  });
  response.end(Buffer.from(body));
}

async function readRawBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    chunks.push(chunk);
    length += chunk.length;
    if (length > 20000) {
      throw new Error("request_body_too_large");
    }
  }
  return Buffer.concat(chunks);
}

async function fetchRemoteExportRows(type) {
  const targetUrl = new URL(`${remoteBaseUrl}/api/export`);
  targetUrl.searchParams.set("type", type);
  targetUrl.searchParams.set("limit", "10000");
  const response = await fetch(targetUrl, {
    headers: {
      accept: "text/csv",
      authorization: `Bearer ${adminExportToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`${type}_export_${response.status}`);
  }
  return parseCsv(await response.text());
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((csvRow) => csvRow.some((cell) => cell.trim()))
    .map((csvRow) => Object.fromEntries(headers.map((header, index) => [header, csvRow[index] || ""])));
}

function newest(rows, column) {
  return rows
    .map((row) => row[column] || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  let result = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return result === 0;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (_) {
    return false;
  }
}

async function loadLocalEnv() {
  for (const filename of [".dev.vars.local", ".env.local"]) {
    try {
      const content = await readFile(join(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch (_) {
      // Optional local secret file.
    }
  }
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}
