import { buildPaymentLink, buildReminderLinks, cleanEmail, cleanEnum, cleanPhone, cleanText, cleanUtm, getBaseUrl, json, methodNotAllowed, postOpsWebhook, readJson } from "../_shared/http.js";
import { hasD1, saveLeadRecord } from "../_shared/storage.js";

function normalizeLead(payload) {
  return {
    leadId: cleanText(payload.leadId, 80),
    name: cleanText(payload.name, 120),
    email: cleanEmail(payload.email),
    phone: cleanPhone(payload.phone),
    persona: cleanEnum(payload.persona, ["business", "job", "consultant", "explorare"], ""),
    access: cleanEnum(payload.access, ["free", "vip"], "free"),
    status: cleanEnum(payload.status, ["free_registered", "vip_intent"], ""),
    createdAt: cleanText(payload.createdAt, 40),
    pageUrl: cleanText(payload.pageUrl, 500),
    utm: cleanUtm(payload.utm)
  };
}

function validateLead(payload) {
  const required = ["leadId", "name", "email", "phone", "persona", "access"];
  return required.filter((field) => !String(payload[field] || "").trim());
}

export async function onRequestPost({ request, env }) {
  let payload;

  try {
    payload = normalizeLead(await readJson(request));
  } catch (error) {
    return json({ ok: false, error: error.message || "invalid_json" }, { status: 400 });
  }

  const missing = validateLead(payload);
  if (missing.length) {
    return json({ ok: false, error: "missing_fields", fields: missing }, { status: 400 });
  }

  const access = payload.access;
  const baseUrl = getBaseUrl(request, env);
  const checkoutUrl = access === "vip" ? buildPaymentLink(env.STRIPE_PAYMENT_LINK_URL, payload) : "";
  const reminderLinks = buildReminderLinks({
    phone: payload.phone,
    name: payload.name,
    access,
    freeGroupUrl: env.WHATSAPP_FREE_GROUP_URL,
    vipGroupUrl: ""
  });

  const record = {
    ...payload,
    access,
    status: access === "vip" ? "vip_intent" : "free_registered",
    serverReceivedAt: new Date().toISOString(),
    siteUrl: baseUrl,
    checkoutUrl,
    whatsappFreeGroupUrl: env.WHATSAPP_FREE_GROUP_URL || "",
    ...reminderLinks
  };

  const primaryResult = hasD1(env)
    ? await saveLeadRecord(env, record)
    : await postOpsWebhook(env, "lead", record, env.MAKE_LEAD_WEBHOOK_URL);

  if (!primaryResult.ok) {
    const status = primaryResult.skipped || String(primaryResult.error || "").includes("not_configured") ? 503 : 502;
    return json({
      ok: false,
      error: primaryResult.error || "lead_persistence_failed",
      message: "Sistemul de salvare nu este configurat inca.",
      ops: primaryResult
    }, { status });
  }

  const syncResult = hasD1(env)
    ? await postOpsWebhook(env, "lead", record, env.MAKE_LEAD_WEBHOOK_URL)
    : { skipped: true };

  return json({
    ok: true,
    leadId: payload.leadId,
    access,
    checkoutUrl,
    paymentConfigured: Boolean(env.STRIPE_PAYMENT_LINK_URL),
    whatsappFreeGroupConfigured: Boolean(env.WHATSAPP_FREE_GROUP_URL),
    ops: primaryResult,
    sync: syncResult
  });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
