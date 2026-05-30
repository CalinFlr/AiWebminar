export async function fetchStripeSession(secretKey, sessionId) {
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

export function isSafeSessionId(sessionId) {
  return /^cs_[A-Za-z0-9_]{6,120}$/.test(sessionId);
}

export function getExpectedAmount(env) {
  return Number(env.EXPECTED_VIP_AMOUNT || "10000");
}

export function getExpectedCurrency(env) {
  return String(env.EXPECTED_VIP_CURRENCY || "ron").toLowerCase();
}

export function validateCheckoutSessionAttribution(session, env, { leadId = "" } = {}) {
  if (!env.STRIPE_PAYMENT_LINK_ID) {
    return "payment_link_not_configured";
  }
  if (!session || typeof session !== "object") {
    return "missing_session_object";
  }
  if (!isSafeSessionId(session.id || "")) {
    return "missing_session";
  }
  if (!session.client_reference_id) {
    return "missing_client_reference_id";
  }
  if (leadId && session.client_reference_id !== leadId) {
    return "lead_mismatch";
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

export function validatePaidVipCheckoutSession(session, env, options = {}) {
  if (!session || session.status !== "complete" || session.payment_status !== "paid") {
    return "payment_not_confirmed";
  }
  return validateCheckoutSessionAttribution(session, env, options);
}

export function paymentRecordFromCheckoutEvent(event) {
  const session = event.data?.object || {};
  return {
    eventId: event.id,
    eventType: event.type,
    created: event.created,
    sessionId: session.id || "",
    leadId: session.client_reference_id || "",
    email: session.customer_details?.email || session.customer_email || "",
    amountTotal: session.amount_total || 0,
    currency: session.currency || "",
    paymentStatus: session.payment_status || "",
    status: session.status || "",
    paymentLinkId: session.payment_link || "",
    customerId: session.customer || "",
    serverReceivedAt: new Date().toISOString()
  };
}

export function vipFulfillmentRecordFromCheckoutEvent(event) {
  const payment = paymentRecordFromCheckoutEvent(event);
  return {
    sessionId: payment.sessionId,
    leadId: payment.leadId,
    email: payment.email,
    amountTotal: payment.amountTotal,
    currency: payment.currency,
    paymentStatus: payment.paymentStatus,
    status: payment.status,
    paymentLinkId: payment.paymentLinkId,
    customerId: payment.customerId,
    sourceEventId: payment.eventId,
    sourceEventType: payment.eventType,
    created: payment.created,
    fulfilledAt: new Date().toISOString(),
    fulfillmentStatus: "confirmed"
  };
}
