import assert from "node:assert/strict";
import { onRequestGet as vipAccess } from "../functions/api/vip-access.js";
import { onRequestPost as stripeWebhook } from "../functions/api/stripe-webhook.js";

const baseEnv = {
  STRIPE_SECRET_KEY: "sk_test_local",
  STRIPE_PAYMENT_LINK_ID: "plink_expected",
  STRIPE_WEBHOOK_SECRET: "whsec_local",
  EXPECTED_VIP_AMOUNT: "1900",
  EXPECTED_VIP_CURRENCY: "eur",
  WHATSAPP_VIP_GROUP_URL: "https://chat.whatsapp.com/vip"
};

function request(url, init = {}) {
  return new Request(url, init);
}

async function readJson(response) {
  return response.json();
}

function stripeSession(overrides = {}) {
  return {
    id: "cs_test_123",
    status: "complete",
    payment_status: "paid",
    client_reference_id: "lead_123",
    payment_link: "plink_expected",
    amount_total: 1900,
    currency: "eur",
    customer_details: { email: "buyer@example.com" },
    ...overrides
  };
}

function fakeD1(changes = 1) {
  return {
    writes: [],
    prepare(query) {
      return {
        bind: (...values) => ({
          run: async () => {
            this.writes.push({ query, values });
            return { meta: { changes } };
          }
        })
      };
    }
  };
}

async function stripeSignature(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const hex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

async function testVipAccessBlocksMissingSession() {
  const response = await vipAccess({
    request: request("https://aiwebminar.test/api/vip-access"),
    env: baseEnv
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "missing_session");
}

async function testVipAccessRequiresPaymentLinkConfig() {
  const response = await vipAccess({
    request: request("https://aiwebminar.test/api/vip-access?session_id=cs_test_123"),
    env: { ...baseEnv, STRIPE_PAYMENT_LINK_ID: "" }
  });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.error, "payment_link_not_configured");
}

async function testVipAccessBlocksMismatchedAmount() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(stripeSession({ amount_total: 3000 })), {
    headers: { "content-type": "application/json" }
  });

  try {
    const response = await vipAccess({
      request: request("https://aiwebminar.test/api/vip-access?session_id=cs_test_123&lead_id=lead_123"),
      env: baseEnv
    });
    const body = await readJson(response);
    assert.equal(response.status, 403);
    assert.equal(body.error, "payment_amount_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testVipAccessAllowsExpectedPaidSession() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(stripeSession()), {
    headers: { "content-type": "application/json" }
  });

  try {
    const response = await vipAccess({
      request: request("https://aiwebminar.test/api/vip-access?session_id=cs_test_123&lead_id=lead_123"),
      env: baseEnv
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.access, "vip");
    assert.equal(body.leadId, "lead_123");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testStripeWebhookRejectsInvalidSignature() {
  const response = await stripeWebhook({
    request: request("https://aiwebminar.test/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bad" },
      body: JSON.stringify({ id: "evt_bad" })
    }),
    env: baseEnv
  });
  const body = await readJson(response);
  assert.equal(response.status, 400);
  assert.equal(body.error, "invalid_signature");
}

async function testStripeWebhookIgnoresWrongPaymentLink() {
  const payload = JSON.stringify({
    id: "evt_wrong_link",
    type: "checkout.session.completed",
    created: 1760000000,
    data: { object: stripeSession({ payment_link: "plink_wrong" }) }
  });
  const signature = await stripeSignature(payload, baseEnv.STRIPE_WEBHOOK_SECRET);
  const response = await stripeWebhook({
    request: request("https://aiwebminar.test/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.handled, false);
  assert.equal(body.ignoredReason, "payment_link_mismatch");
}

async function testStripeWebhookStoresExpectedPayment() {
  const db = fakeD1();
  const payload = JSON.stringify({
    id: "evt_ok",
    type: "checkout.session.completed",
    created: 1760000000,
    data: { object: stripeSession() }
  });
  const signature = await stripeSignature(payload, baseEnv.STRIPE_WEBHOOK_SECRET);
  const response = await stripeWebhook({
    request: request("https://aiwebminar.test/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.handled, true);
  assert.equal(body.ops.ok, true);
  assert.equal(db.writes.length, 1);
}

async function testStripeWebhookDoesNotSyncDuplicatePayment() {
  const db = fakeD1(0);
  const payload = JSON.stringify({
    id: "evt_duplicate",
    type: "checkout.session.completed",
    created: 1760000000,
    data: { object: stripeSession() }
  });
  const signature = await stripeSignature(payload, baseEnv.STRIPE_WEBHOOK_SECRET);
  const response = await stripeWebhook({
    request: request("https://aiwebminar.test/api/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: db, MAKE_PAYMENT_WEBHOOK_URL: "https://make.test/payment" }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ops.duplicate, true);
  assert.deepEqual(body.ops.sync, { skipped: true, reason: "duplicate_event" });
}

const tests = [
  testVipAccessBlocksMissingSession,
  testVipAccessRequiresPaymentLinkConfig,
  testVipAccessBlocksMismatchedAmount,
  testVipAccessAllowsExpectedPaidSession,
  testStripeWebhookRejectsInvalidSignature,
  testStripeWebhookIgnoresWrongPaymentLink,
  testStripeWebhookStoresExpectedPayment,
  testStripeWebhookDoesNotSyncDuplicatePayment
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}
