import { guardPublicWrite } from "../_shared/abuse.js";
import { cleanEmail, cleanEnum, cleanLongText, cleanText, cleanUrl, json, methodNotAllowed, postOpsWebhook, readJson } from "../_shared/http.js";
import { hasD1, saveOnboardingRecord } from "../_shared/storage.js";

async function fetchStripeSession(secretKey, sessionId) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      authorization: `Bearer ${secretKey}`
    }
  });

  if (!response.ok) {
    return { ok: false, error: "stripe_session_lookup_failed" };
  }

  return { ok: true, data: await response.json() };
}

function isSafeSessionId(sessionId) {
  return /^cs_[A-Za-z0-9_]{6,120}$/.test(sessionId);
}

function getExpectedAmount(env) {
  return Number(env.EXPECTED_VIP_AMOUNT || "10000");
}

function getExpectedCurrency(env) {
  return String(env.EXPECTED_VIP_CURRENCY || "ron").toLowerCase();
}

function validateVipSession(session, payload, env) {
  if (!session || session.payment_status !== "paid" || session.status !== "complete") {
    return "payment_not_confirmed";
  }
  if (!session.client_reference_id) {
    return "missing_client_reference_id";
  }
  if (payload.leadId && session.client_reference_id !== payload.leadId) {
    return "lead_mismatch";
  }
  if (!env.STRIPE_PAYMENT_LINK_ID || session.payment_link !== env.STRIPE_PAYMENT_LINK_ID) {
    return "payment_link_mismatch";
  }
  if (Number(session.amount_total || 0) !== getExpectedAmount(env)) {
    return "payment_amount_mismatch";
  }
  if (String(session.currency || "").toLowerCase() !== getExpectedCurrency(env)) {
    return "payment_currency_mismatch";
  }
  return "";
}

async function verifyVipOnboarding(payload, env) {
  if (payload.access !== "vip") {
    return { ok: true, access: payload.access };
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PAYMENT_LINK_ID) {
    return { ok: false, access: "vip_unverified", error: "stripe_not_configured" };
  }
  if (!isSafeSessionId(payload.stripeSessionId)) {
    return { ok: false, access: "vip_unverified", error: "missing_session" };
  }

  const stripeResult = await fetchStripeSession(env.STRIPE_SECRET_KEY, payload.stripeSessionId);
  if (!stripeResult.ok) {
    return { ok: false, access: "vip_unverified", error: stripeResult.error };
  }

  const validationError = validateVipSession(stripeResult.data, payload, env);
  if (validationError) {
    return { ok: false, access: "vip_unverified", error: validationError };
  }

  return { ok: true, access: "vip" };
}

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
    createdAt: cleanText(payload.createdAt, 40),
    turnstileToken: cleanText(payload.turnstileToken, 2048)
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

  const guard = await guardPublicWrite({
    request,
    env,
    endpoint: "onboarding",
    email: payload.signupEmail,
    leadId: payload.leadId,
    turnstileToken: payload.turnstileToken
  });
  if (!guard.ok) {
    return json({ ok: false, error: guard.error, message: guard.message }, {
      status: guard.status,
      headers: guard.headers || {}
    });
  }

  delete payload.turnstileToken;

  const vipVerification = await verifyVipOnboarding(payload, env);
  payload.access = vipVerification.access;

  const record = {
    ...payload,
    serverReceivedAt: new Date().toISOString()
  };

  const primaryResult = hasD1(env)
    ? await saveOnboardingRecord(env, record)
    : await postOpsWebhook(env, "onboarding", record, env.MAKE_ONBOARDING_WEBHOOK_URL);

  if (!primaryResult.ok) {
    const status = primaryResult.skipped || String(primaryResult.error || "").includes("not_configured") ? 503 : 502;
    return json({
      ok: false,
      error: primaryResult.error || "onboarding_persistence_failed",
      message: "Sistemul de onboarding nu este configurat inca.",
      ops: primaryResult
    }, { status });
  }

  const syncResult = hasD1(env)
    ? await postOpsWebhook(env, "onboarding", record, env.MAKE_ONBOARDING_WEBHOOK_URL)
    : { skipped: true };

  return json({
    ok: true,
    onboardingId: payload.onboardingId,
    access: payload.access,
    vipVerified: vipVerification.ok && payload.access === "vip",
    ops: primaryResult,
    sync: syncResult
  });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
