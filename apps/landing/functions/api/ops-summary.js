import { json, methodNotAllowed } from "../_shared/http.js";
import { hasD1 } from "../_shared/storage.js";

function getToken(request) {
  const bearer = request.headers.get("authorization") || "";
  if (bearer.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }
  return "";
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

async function countRows(env, table, where = "") {
  const result = await env.AIWEBMINAR_DB.prepare(`SELECT COUNT(*) AS total FROM ${table} ${where}`).first();
  return Number(result?.total || 0);
}

async function latestValue(env, table, column) {
  const result = await env.AIWEBMINAR_DB.prepare(`
    SELECT ${column} AS value
    FROM ${table}
    WHERE ${column} != ''
    ORDER BY ${column} DESC
    LIMIT 1
  `).first();
  return result?.value || "";
}

async function countMissingOnboarding(env, where = "") {
  const result = await env.AIWEBMINAR_DB.prepare(`
    SELECT COUNT(*) AS total
    FROM leads
    WHERE lead_id != ''
      ${where}
      AND NOT EXISTS (
        SELECT 1
        FROM onboarding
        WHERE onboarding.lead_id = leads.lead_id
      )
  `).first();
  return Number(result?.total || 0);
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_EXPORT_TOKEN) {
    return json({ ok: false, error: "admin_export_token_not_configured" }, { status: 503 });
  }
  if (!safeEqual(getToken(request), env.ADMIN_EXPORT_TOKEN)) {
    return json({ ok: false, error: "forbidden" }, {
      status: 403,
      headers: { "www-authenticate": "Bearer" }
    });
  }
  if (!hasD1(env)) {
    return json({ ok: false, error: "d1_not_configured" }, { status: 503 });
  }

  const [
    leads,
    onboarding,
    payments,
    vipFulfillments,
    reminders,
    pendingWhatsappReminders,
    pendingSmsReminders,
    missingOnboarding,
    freeMissingOnboarding,
    vipMissingOnboarding,
    leadReceivedAt,
    paymentReceivedAt,
    vipFulfilledAt,
    reminderCreatedAt
  ] = await Promise.all([
    countRows(env, "leads"),
    countRows(env, "onboarding"),
    countRows(env, "payments"),
    countRows(env, "vip_fulfillments"),
    countRows(env, "reminders"),
    countRows(env, "reminders", "WHERE channel = 'whatsapp' AND status = 'de_trimis'"),
    countRows(env, "reminders", "WHERE channel = 'sms' AND status = 'de_trimis'"),
    countMissingOnboarding(env),
    countMissingOnboarding(env, "AND access = 'free'"),
    countMissingOnboarding(env, "AND access = 'vip'"),
    latestValue(env, "leads", "server_received_at"),
    latestValue(env, "payments", "server_received_at"),
    latestValue(env, "vip_fulfillments", "fulfilled_at"),
    latestValue(env, "reminders", "created_at")
  ]);

  return json({
    ok: true,
    counts: {
      leads,
      onboarding,
      payments,
      vipFulfillments,
      reminders,
      pendingWhatsappReminders,
      pendingSmsReminders,
      missingOnboarding,
      freeMissingOnboarding,
      vipMissingOnboarding
    },
    latest: {
      leadReceivedAt,
      paymentReceivedAt,
      vipFulfilledAt,
      reminderCreatedAt
    }
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
