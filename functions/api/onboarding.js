import { cleanEmail, cleanEnum, cleanLongText, cleanText, cleanUrl, json, methodNotAllowed, postWebhook, readJson } from "../_shared/http.js";

function normalizeOnboarding(payload) {
  return {
    onboardingId: cleanText(payload.onboardingId, 80),
    leadId: cleanText(payload.leadId, 80),
    signupEmail: cleanEmail(payload.signupEmail),
    access: cleanEnum(payload.access, ["free", "vip", "vip_pending", "vip_unverified"], "free"),
    persona: cleanEnum(payload.persona, ["business", "job", "consultant", "explorare"], ""),
    stripeSessionId: cleanText(payload.stripeSessionId, 120),
    automationIdea: cleanLongText(payload.automationIdea, 1600),
    currentTools: cleanText(payload.currentTools, 500),
    publicLink: cleanUrl(payload.publicLink),
    desiredOutcome: cleanLongText(payload.desiredOutcome, 1600),
    createdAt: cleanText(payload.createdAt, 40)
  };
}

function validateOnboarding(payload) {
  const required = ["onboardingId", "automationIdea", "desiredOutcome"];
  return required.filter((field) => !String(payload[field] || "").trim());
}

export async function onRequestPost({ request, env }) {
  let payload;

  try {
    payload = normalizeOnboarding(await readJson(request));
  } catch (error) {
    return json({ ok: false, error: error.message || "invalid_json" }, { status: 400 });
  }

  const missing = validateOnboarding(payload);
  if (missing.length) {
    return json({ ok: false, error: "missing_fields", fields: missing }, { status: 400 });
  }

  const record = {
    ...payload,
    serverReceivedAt: new Date().toISOString()
  };

  if (!env.MAKE_ONBOARDING_WEBHOOK_URL) {
    return json({
      ok: false,
      error: "make_onboarding_webhook_not_configured",
      message: "Sistemul de onboarding nu este configurat inca."
    }, { status: 503 });
  }

  const makeResult = await postWebhook(env.MAKE_ONBOARDING_WEBHOOK_URL, record);
  if (!makeResult.ok) {
    return json({
      ok: false,
      error: "make_onboarding_webhook_failed",
      make: makeResult
    }, { status: 502 });
  }

  return json({
    ok: true,
    onboardingId: payload.onboardingId,
    make: makeResult
  });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
