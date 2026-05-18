import { json, methodNotAllowed, postOpsWebhook } from "../_shared/http.js";
import { hasD1, savePaymentRecord } from "../_shared/storage.js";

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

function getExpectedAmount(env) {
  return Number(env.EXPECTED_VIP_AMOUNT || "10000");
}

function getExpectedCurrency(env) {
  return String(env.EXPECTED_VIP_CURRENCY || "ron").toLowerCase();
}

function validateCheckoutSession(session, env) {
  if (!env.STRIPE_PAYMENT_LINK_ID) {
    return "payment_link_not_configured";
  }
  if (!session.client_reference_id) {
    return "missing_client_reference_id";
  }
  if (session.payment_link !== env.STRIPE_PAYMENT_LINK_ID) {
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

function paymentRecordFromEvent(event) {
  const session = event.data?.object || {};
  return {
    eventId: event.id,
    eventType: event.type,
    created: event.created,
    sessionId: session.id || "",
    leadId: session.client_reference_id || "",
    email: session.customer_details?.email || session.customer_email || "",
    amountTotal: session.amount_total || 0,
    currency: session.currency || "eur",
    paymentStatus: session.payment_status || "",
    status: session.status || "",
    paymentLinkId: session.payment_link || "",
    customerId: session.customer || "",
    serverReceivedAt: new Date().toISOString()
  };
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

  let ops = { skipped: true };
  if (handledEvents.has(event.type)) {
    const session = event.data?.object || {};
    const validationError = validateCheckoutSession(session, env);
    if (validationError) {
      return json({ ok: true, received: true, handled: false, ignoredReason: validationError });
    }
    const record = paymentRecordFromEvent(event);
    ops = hasD1(env)
      ? await savePaymentRecord(env, record)
      : await postOpsWebhook(env, "payment", record, env.MAKE_PAYMENT_WEBHOOK_URL);
    if (!ops.ok) {
      const status = ops.skipped || String(ops.error || "").includes("not_configured") ? 503 : 502;
      return json({ ok: false, error: ops.error || "payment_webhook_failed", ops }, { status });
    }
    if (hasD1(env) && !ops.duplicate) {
      ops.sync = await postOpsWebhook(env, "payment", record, env.MAKE_PAYMENT_WEBHOOK_URL);
    } else if (hasD1(env)) {
      ops.sync = { skipped: true, reason: "duplicate_event" };
    }
  }

  return json({ ok: true, received: true, handled: handledEvents.has(event.type), ops });
}

export async function onRequestGet() {
  return methodNotAllowed();
}
