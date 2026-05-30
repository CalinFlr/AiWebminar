import { json, methodNotAllowed } from "../_shared/http.js";
import { fetchStripeSession, isSafeSessionId, validatePaidVipCheckoutSession } from "../_shared/stripe.js";

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
  const validationError = validatePaidVipCheckoutSession(session, env, { leadId });
  if (validationError === "payment_not_confirmed") {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_not_confirmed",
      paymentStatus: session?.payment_status || "unknown"
    }, { status: 402 });
  }

  if (validationError === "missing_client_reference_id") {
    return json({
      ok: false,
      access: "blocked",
      error: "missing_client_reference_id"
    }, { status: 403 });
  }

  if (validationError === "lead_mismatch") {
    return json({
      ok: false,
      access: "blocked",
      error: "lead_mismatch"
    }, { status: 403 });
  }

  if (validationError === "payment_link_mismatch") {
    return json({
      ok: false,
      access: "blocked",
      error: "payment_link_mismatch"
    }, { status: 403 });
  }

  if (validationError) {
    return json({
      ok: false,
      access: "blocked",
      error: validationError
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
