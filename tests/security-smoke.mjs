import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readJson as readRequestJson } from "../functions/_shared/http.js";
import { onRequest as staticGuard } from "../functions/_middleware.js";
import { onRequestGet as config } from "../functions/api/config.js";
import { onRequestGet as exportCsv } from "../functions/api/export.js";
import { onRequestGet as freeAccess } from "../functions/api/free-access.js";
import { onRequestPost as onboarding } from "../functions/api/onboarding.js";
import { onRequestGet as vipAccess } from "../functions/api/vip-access.js";
import { onRequestPost as stripeWebhook } from "../functions/api/stripe-webhook.js";

const baseEnv = {
  STRIPE_SECRET_KEY: "sk_test_local",
  STRIPE_PAYMENT_LINK_ID: "plink_expected",
  STRIPE_WEBHOOK_SECRET: "whsec_local",
  EXPECTED_VIP_AMOUNT: "10000",
  EXPECTED_VIP_CURRENCY: "ron",
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
    amount_total: 10000,
    currency: "ron",
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
          },
          all: async () => {
            this.writes.push({ query, values });
            return { results: [] };
          },
          first: async () => {
            this.writes.push({ query, values });
            return {
              lead_id: values[0] || "a9196fad-fb81-4a99-9abd-e7f8d77bf69b",
              access: "free",
              status: "free_registered"
            };
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

async function testVipAccessBlocksUnsafeSessionId() {
  const response = await vipAccess({
    request: request("https://aiwebminar.test/api/vip-access?session_id=cs_%2F..%2Fsecret"),
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
    assert.equal(Object.hasOwn(body, "email"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function onboardingPayload(overrides = {}) {
  return {
    onboardingId: "onboarding_123",
    leadId: "lead_123",
    signupEmail: "buyer@example.com",
    access: "vip",
    persona: "business",
    stripeSessionId: "cs_test_123",
    automationIdea: "Vreau un agent pentru follow-up.",
    currentTools: "Sheets",
    publicLink: "",
    desiredOutcome: "Sa raspunda mai repede leadurilor.",
    createdAt: "2026-05-18T00:00:00.000Z",
    ...overrides
  };
}

async function testOnboardingDowngradesUnverifiedVipAccess() {
  const db = fakeD1();
  const response = await onboarding({
    request: request("https://aiwebminar.test/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(onboardingPayload({ stripeSessionId: "" }))
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.access, "vip_unverified");
  assert.equal(body.vipVerified, false);
  assert.equal(db.writes[0].values[3], "vip_unverified");
}

async function testOnboardingKeepsVipOnlyForVerifiedPayment() {
  const originalFetch = globalThis.fetch;
  const db = fakeD1();
  globalThis.fetch = async () => new Response(JSON.stringify(stripeSession()), {
    headers: { "content-type": "application/json" }
  });

  try {
    const response = await onboarding({
      request: request("https://aiwebminar.test/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(onboardingPayload())
      }),
      env: { ...baseEnv, AIWEBMINAR_DB: db }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.access, "vip");
    assert.equal(body.vipVerified, true);
    assert.equal(db.writes[0].values[3], "vip");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testExportRejectsTokenInQueryString() {
  const response = await exportCsv({
    request: request("https://aiwebminar.test/api/export?token=admin_secret"),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "forbidden");
}

async function testExportAllowsBearerToken() {
  const response = await exportCsv({
    request: request("https://aiwebminar.test/api/export?type=payments", {
      headers: { authorization: "Bearer admin_secret" }
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: fakeD1() }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
}

async function testReadJsonRejectsOversizedBodyWithoutTrustingContentLength() {
  await assert.rejects(
    readRequestJson(request("https://aiwebminar.test/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(16001) })
    })),
    /payload_too_large/
  );
}

async function testThankYouTrackingDoesNotSendStripeSessionId() {
  const html = await readFile(new URL("../thank-you.html", import.meta.url), "utf8");
  assert.match(html, /stripSensitiveParamsFromAddressBar/);
  assert.match(html, /window\.history\.replaceState/);
  assert.match(html, /url\.searchParams\.delete\("session_id"\)/);
  assert.doesNotMatch(html, /page_location:\s*window\.location\.href/);
  assert.doesNotMatch(html, /session_id:\s*(?:sessionId|payload\.stripeSessionId|vipData\.sessionId)/);
}

async function testConfigDoesNotExposeWhatsappGroupUrls() {
  const response = await config({
    env: {
      ...baseEnv,
      STRIPE_PAYMENT_LINK_URL: "https://buy.stripe.com/test",
      WHATSAPP_FREE_GROUP_URL: "https://chat.whatsapp.com/free"
    }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.whatsappFreeGroupConfigured, true);
  assert.equal(Object.hasOwn(body, "whatsappFreeGroupUrl"), false);
}

async function testStaticGuardBlocksInternalArtifacts() {
  const response = await staticGuard({
    request: request("https://aiwebminar.test/package.json"),
    next: async () => new Response("public")
  });
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not found");
}

async function testStaticGuardAllowsPublicPages() {
  const response = await staticGuard({
    request: request("https://aiwebminar.test/privacy.html"),
    next: async () => new Response("public")
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "public");
}

async function testFreeAccessRequiresSafeLeadId() {
  const response = await freeAccess({
    request: request("https://aiwebminar.test/api/free-access?lead_id=../package.json"),
    env: { ...baseEnv, WHATSAPP_FREE_GROUP_URL: "https://chat.whatsapp.com/free", AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "missing_lead");
}

async function testFreeAccessReturnsGroupForSavedLead() {
  const response = await freeAccess({
    request: request("https://aiwebminar.test/api/free-access?lead_id=a9196fad-fb81-4a99-9abd-e7f8d77bf69b"),
    env: { ...baseEnv, WHATSAPP_FREE_GROUP_URL: "https://chat.whatsapp.com/free", AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.leadId, "a9196fad-fb81-4a99-9abd-e7f8d77bf69b");
  assert.equal(body.whatsappFreeGroupUrl, "https://chat.whatsapp.com/free");
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
  testReadJsonRejectsOversizedBodyWithoutTrustingContentLength,
  testVipAccessBlocksMissingSession,
  testVipAccessBlocksUnsafeSessionId,
  testVipAccessRequiresPaymentLinkConfig,
  testVipAccessBlocksMismatchedAmount,
  testVipAccessAllowsExpectedPaidSession,
  testOnboardingDowngradesUnverifiedVipAccess,
  testOnboardingKeepsVipOnlyForVerifiedPayment,
  testExportRejectsTokenInQueryString,
  testExportAllowsBearerToken,
  testThankYouTrackingDoesNotSendStripeSessionId,
  testConfigDoesNotExposeWhatsappGroupUrls,
  testStaticGuardBlocksInternalArtifacts,
  testStaticGuardAllowsPublicPages,
  testFreeAccessRequiresSafeLeadId,
  testFreeAccessReturnsGroupForSavedLead,
  testStripeWebhookRejectsInvalidSignature,
  testStripeWebhookIgnoresWrongPaymentLink,
  testStripeWebhookStoresExpectedPayment,
  testStripeWebhookDoesNotSyncDuplicatePayment
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}
