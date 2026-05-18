import { json, methodNotAllowed } from "../_shared/http.js";
import { hasD1 } from "../_shared/storage.js";

function getOpsProvider(env) {
  if (hasD1(env)) return "cloudflare_d1";
  if (env.GOOGLE_OPS_WEBHOOK_URL) return "apps_script";
  if (env.MAKE_LEAD_WEBHOOK_URL) return "make_fallback";
  return "none";
}

export async function onRequestGet({ env }) {
  const d1Configured = hasD1(env);
  const googleOpsConfigured = Boolean(env.GOOGLE_OPS_WEBHOOK_URL && env.GOOGLE_OPS_WEBHOOK_SECRET);
  const makeFallbackConfigured = Boolean(env.MAKE_LEAD_WEBHOOK_URL || env.MAKE_ONBOARDING_WEBHOOK_URL);
  const stripePaymentLinkConfigured = Boolean(env.STRIPE_PAYMENT_LINK_URL && env.STRIPE_PAYMENT_LINK_ID);
  const stripeServerConfigured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  const whatsappFreeGroupConfigured = Boolean(env.WHATSAPP_FREE_GROUP_URL);
  const whatsappVipGroupConfigured = Boolean(env.WHATSAPP_VIP_GROUP_URL);
  const ga4Configured = Boolean(env.GA4_MEASUREMENT_ID);
  const metaPixelConfigured = Boolean(env.META_PIXEL_ID);

  return json({
    ok: true,
    stripePaymentLinkUrl: env.STRIPE_PAYMENT_LINK_URL || "",
    stripePaymentLinkConfigured,
    stripeServerConfigured,
    vipGateConfigured: Boolean(stripePaymentLinkConfigured && env.STRIPE_SECRET_KEY),
    whatsappFreeGroupUrl: env.WHATSAPP_FREE_GROUP_URL || "",
    whatsappFreeGroupConfigured,
    whatsappVipGroupConfigured,
    opsProvider: getOpsProvider(env),
    d1Configured,
    googleOpsConfigured,
    makeFallbackConfigured,
    opsWebhookConfigured: Boolean(d1Configured || googleOpsConfigured || makeFallbackConfigured),
    ga4MeasurementId: env.GA4_MEASUREMENT_ID || "",
    metaPixelId: env.META_PIXEL_ID || "",
    ga4Configured,
    metaPixelConfigured,
    workshopStatus: env.WORKSHOP_STATUS || "tbd",
    workshopLiveUrlConfigured: Boolean(env.WORKSHOP_LIVE_URL)
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
