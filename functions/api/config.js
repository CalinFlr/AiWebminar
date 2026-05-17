import { json, methodNotAllowed } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  return json({
    ok: true,
    stripePaymentLinkUrl: env.STRIPE_PAYMENT_LINK_URL || "",
    stripePaymentLinkConfigured: Boolean(env.STRIPE_PAYMENT_LINK_URL),
    whatsappFreeGroupUrl: env.WHATSAPP_FREE_GROUP_URL || "",
    whatsappFreeGroupConfigured: Boolean(env.WHATSAPP_FREE_GROUP_URL),
    ga4MeasurementId: env.GA4_MEASUREMENT_ID || "",
    metaPixelId: env.META_PIXEL_ID || "",
    workshopStatus: env.WORKSHOP_STATUS || "tbd",
    workshopLiveUrlConfigured: Boolean(env.WORKSHOP_LIVE_URL)
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
