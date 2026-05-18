import { json, methodNotAllowed } from "../_shared/http.js";

async function fetchStripeSession(secretKey, sessionId) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      authorization: `Bearer ${secretKey}`
    }
  });

  if (!response.ok) {
    return { ok: false, status: response.status, data: await response.text() };
  }

  return { ok: true, data: await response.json() };
}

function isPaidSession(session) {
  return session && session.payment_status === "paid" && session.status === "complete";
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

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") || "";
  const leadId = url.searchParams.get("lead_id") || "";

  if (!sessionId || !isSafeSessionId(sessionId)) {
    return json({
      ok: false,
      access: "blocked",
      error: "missing_session",
      message: "Nu putem verifica plata VIP fara session_id de la Stripe."
    }, { status: 403 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({
      ok: false,
      access: "blocked",
      error: "stripe_not_configured",
      message: "Stripe nu este configurat inca pe Cloudflare."
    }, { status: 503 });
  }

  if (!env.STRIPE_PAYMENT_LINK_ID) {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_link_not_configured",
      message: "Payment Link ID nu este configurat inca pe Cloudflare."
    }, { status: 503 });
  }

  const stripeResult = await fetchStripeSession(env.STRIPE_SECRET_KEY, sessionId);
  if (!stripeResult.ok) {
    return json({
      ok: false,
      access: "blocked",
      error: "stripe_session_lookup_failed"
    }, { status: 502 });
  }

  const session = stripeResult.data;
  if (!isPaidSession(session)) {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_not_confirmed",
      paymentStatus: session.payment_status || "unknown"
    }, { status: 402 });
  }

  if (!session.client_reference_id) {
    return json({
      ok: false,
      access: "blocked",
      error: "missing_client_reference_id"
    }, { status: 403 });
  }

  if (leadId && session.client_reference_id && session.client_reference_id !== leadId) {
    return json({
      ok: false,
      access: "blocked",
      error: "lead_mismatch"
    }, { status: 403 });
  }

  if (session.payment_link !== env.STRIPE_PAYMENT_LINK_ID) {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_link_mismatch"
    }, { status: 403 });
  }

  if (Number(session.amount_total || 0) !== getExpectedAmount(env) || String(session.currency || "").toLowerCase() !== getExpectedCurrency(env)) {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_amount_mismatch"
    }, { status: 403 });
  }

  return json({
    ok: true,
    access: "vip",
    sessionId,
    leadId: session.client_reference_id,
    amountTotal: session.amount_total || 0,
    currency: session.currency || "eur",
    whatsappVipGroupUrl: env.WHATSAPP_VIP_GROUP_URL || "",
    whatsappVipGroupConfigured: Boolean(env.WHATSAPP_VIP_GROUP_URL)
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
