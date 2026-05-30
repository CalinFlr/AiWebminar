import { json, methodNotAllowed, postOpsWebhook } from "../_shared/http.js";
import { hasD1, savePaymentRecord, saveVipFulfillmentRecord, updateVipFulfillmentSyncStatus } from "../_shared/storage.js";
import {
  paymentRecordFromCheckoutEvent,
  validateCheckoutSessionAttribution,
  validatePaidVipCheckoutSession,
  vipFulfillmentRecordFromCheckoutEvent
} from "../_shared/stripe.js";

function parseStripeSignature(header) {
  return String(header || "").split(",").reduce((acc, item) => {
    const [key, value] = item.split("=");
    if (key && value) {
      if (key === "v1") {
        acc.v1.push(value);
      } else {
        acc[key] = value;
      }
    }
    return acc;
  }, { v1: [] });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function verifyStripeSignature(payload, header, secret) {
  const parts = parseStripeSignature(header);
  if (!parts.t || !parts.v1.length || !secret) {
    return false;
  }

  const timestamp = Number(parts.t);
  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(now - timestamp) > 300) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${parts.t}.${payload}`));
  const expected = bytesToHex(signature);
  return parts.v1.some((value) => safeEqual(expected, value));
}

function syncStatusFromOps(sync) {
  if (!sync || sync.skipped) return "skipped";
  return sync.ok ? "synced" : "failed";
}

function emailStatusFromOps(sync) {
  return sync?.response?.emailStatus || sync?.emailStatus || "";
}

function shouldFailForSync(sync) {
  return sync && !sync.ok && !sync.skipped;
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ ok: false, error: "webhook_secret_not_configured" }, { status: 503 });
  }

  const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const handledEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed"
  ]);

  let ops = { payment: { skipped: true }, fulfillment: { skipped: true }, sync: { skipped: true } };
  let recorded = false;
  let fulfilled = false;
  let duplicateFulfillment = false;
  let ignoredReason = "";
  if (handledEvents.has(event.type)) {
    const session = event.data?.object || {};
    const attributionError = validateCheckoutSessionAttribution(session, env);
    if (attributionError) {
      return json({ ok: true, received: true, handled: false, recorded, fulfilled, ignoredReason: attributionError, ops });
    }

    if (!hasD1(env)) {
      return json({ ok: false, error: "d1_not_configured", ops }, { status: 503 });
    }

    const paymentRecord = paymentRecordFromCheckoutEvent(event);
    ops.payment = await savePaymentRecord(env, paymentRecord);
    if (!ops.payment.ok) {
      const status = ops.payment.skipped || String(ops.payment.error || "").includes("not_configured") ? 503 : 502;
      return json({ ok: false, error: ops.payment.error || "payment_record_failed", ops }, { status });
    }
    recorded = true;

    if (event.type === "checkout.session.async_payment_failed") {
      ignoredReason = "async_payment_failed";
    } else {
      const fulfillmentError = validatePaidVipCheckoutSession(session, env);
      if (fulfillmentError) {
        ignoredReason = fulfillmentError;
      } else {
        const fulfillmentRecord = vipFulfillmentRecordFromCheckoutEvent(event);
        ops.fulfillment = await saveVipFulfillmentRecord(env, fulfillmentRecord);
        if (!ops.fulfillment.ok) {
          const status = ops.fulfillment.skipped || String(ops.fulfillment.error || "").includes("not_configured") ? 503 : 502;
          return json({ ok: false, error: ops.fulfillment.error || "vip_fulfillment_failed", ops }, { status });
        }

        duplicateFulfillment = ops.fulfillment.duplicate === true;
        fulfilled = !duplicateFulfillment;

        const existingSyncStatus = ops.fulfillment.existing?.sync_status || "";
        if (!duplicateFulfillment || existingSyncStatus !== "synced") {
          ops.sync = await postOpsWebhook(env, "vip_fulfillment", fulfillmentRecord, env.MAKE_PAYMENT_WEBHOOK_URL);
          ops.syncStatus = await updateVipFulfillmentSyncStatus(
            env,
            fulfillmentRecord.sessionId,
            syncStatusFromOps(ops.sync),
            emailStatusFromOps(ops.sync)
          );
          if (shouldFailForSync(ops.sync)) {
            return json({ ok: false, error: ops.sync.error || "vip_fulfillment_sync_failed", ops }, { status: 502 });
          }
        } else {
          ops.sync = { skipped: true, reason: "fulfillment_already_synced" };
        }
      }
    }
  }

  return json({
    ok: true,
    received: true,
    handled: handledEvents.has(event.type) && recorded,
    recorded,
    fulfilled,
    duplicateFulfillment,
    ignoredReason,
    ops
  });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
