import { cleanLongText, cleanText, cleanUrl, json, methodNotAllowed, readJson } from "../_shared/http.js";
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

function requireAdmin(request, env) {
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
  return null;
}

function cleanReminderId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

async function markSent(env, payload) {
  const id = cleanReminderId(payload.id);
  if (!id) {
    return json({ ok: false, error: "invalid_reminder_id" }, { status: 400 });
  }

  const lastSentAt = new Date().toISOString();
  const result = await env.AIWEBMINAR_DB.prepare(`
    UPDATE reminders
    SET status = ?, last_sent_at = ?
    WHERE id = ?
  `).bind("trimis", lastSentAt, id).run();

  if (Number(result.meta?.changes || 0) === 0) {
    return json({ ok: false, error: "reminder_not_found" }, { status: 404 });
  }

  return json({ ok: true, id, status: "trimis", lastSentAt });
}

async function findOnboardingInvite(env, leadId) {
  return env.AIWEBMINAR_DB.prepare(`
    SELECT id, status, last_sent_at
    FROM reminders
    WHERE lead_id = ?
      AND channel = 'whatsapp'
      AND notes = 'onboarding_invite'
    ORDER BY id DESC
    LIMIT 1
  `).bind(leadId).first();
}

async function createOnboardingInvite(env, payload) {
  const leadId = cleanText(payload.leadId, 80);
  const message = cleanLongText(payload.message, 3000);
  const actionUrl = cleanUrl(payload.actionUrl);

  if (!leadId || !message || !actionUrl) {
    return json({ ok: false, error: "invalid_onboarding_invite" }, { status: 400 });
  }

  const lead = await env.AIWEBMINAR_DB.prepare(`
    SELECT lead_id, name, email, phone, access, persona
    FROM leads
    WHERE lead_id = ?
    LIMIT 1
  `).bind(leadId).first();

  if (!lead?.lead_id) {
    return json({ ok: false, error: "lead_not_found" }, { status: 404 });
  }

  const onboarding = await env.AIWEBMINAR_DB.prepare(`
    SELECT lead_id
    FROM onboarding
    WHERE lead_id = ?
    LIMIT 1
  `).bind(leadId).first();

  if (onboarding?.lead_id) {
    return json({ ok: false, error: "onboarding_already_completed" }, { status: 409 });
  }

  const existing = await findOnboardingInvite(env, leadId);
  if (existing?.id) {
    if (String(existing.status || "").toLowerCase() === "trimis") {
      return json({ ok: false, error: "onboarding_invite_already_sent", id: existing.id }, { status: 409 });
    }
    return json({
      ok: true,
      id: existing.id,
      status: existing.status || "de_trimis",
      reused: true
    });
  }

  await env.AIWEBMINAR_DB.prepare(`
    INSERT INTO reminders (
      created_at, lead_id, name, email, phone, access, persona, channel,
      message, action_url, status, last_sent_at, owner, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    new Date().toISOString(),
    lead.lead_id || "",
    lead.name || "",
    lead.email || "",
    lead.phone || "",
    lead.access || "",
    lead.persona || "",
    "whatsapp",
    message,
    actionUrl,
    "de_trimis",
    "",
    "Calin",
    "onboarding_invite"
  ).run();

  const created = await findOnboardingInvite(env, leadId);
  return json({
    ok: true,
    id: created?.id || 0,
    status: created?.status || "de_trimis",
    reused: false
  });
}

export async function onRequestPost({ request, env }) {
  const guard = requireAdmin(request, env);
  if (guard) return guard;

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    return json({ ok: false, error: error.message || "invalid_json" }, { status: 400 });
  }

  const action = cleanText(payload.action, 40);
  if (action === "check") {
    return json({ ok: true });
  }
  if (action === "mark_sent") {
    return markSent(env, payload);
  }
  if (action === "create_onboarding_invite") {
    return createOnboardingInvite(env, payload);
  }

  return json({ ok: false, error: "invalid_action" }, { status: 400 });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
