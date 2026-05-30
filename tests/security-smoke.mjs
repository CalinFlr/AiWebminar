import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readJson as readRequestJson } from "../functions/_shared/http.js";
import { onRequest as staticGuard } from "../functions/_middleware.js";
import { onRequestGet as config } from "../functions/api/config.js";
import { onRequestGet as exportCsv } from "../functions/api/export.js";
import { onRequestGet as freeAccess } from "../functions/api/free-access.js";
import { onRequestPost as opsReminders } from "../functions/api/ops-reminders.js";
import { onRequestGet as opsSummary } from "../functions/api/ops-summary.js";
import { onRequestPost as lead } from "../functions/api/lead.js";
import { onRequestPost as onboarding } from "../functions/api/onboarding.js";
import { onRequestGet as vipAccess } from "../functions/api/vip-access.js";
import { onRequestPost as stripeWebhook } from "../functions/api/stripe-webhook.js";
import { findMissingFulfillments } from "../scripts/reconcile-stripe-fulfillments.mjs";

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

function fakeD1(changes = 1, options = {}) {
  const rateLimitCounts = [...(options.rateLimitCounts || [])];
  const allResults = [...(options.allResults || [])];
  const firstResults = [...(options.firstResults || [])];
  const runChanges = [...(options.runChanges || [])];
  return {
    writes: [],
    prepare(query) {
      return {
        bind: (...values) => ({
          run: async () => {
            this.writes.push({ query, values });
            return { meta: { changes: runChanges.length ? runChanges.shift() : changes } };
          },
          all: async () => {
            this.writes.push({ query, values });
            return { results: allResults.length ? allResults.shift() : [] };
          },
          first: async () => {
            this.writes.push({ query, values });
            if (firstResults.length) {
              return firstResults.shift();
            }
            if (query.includes("rate_limits")) {
              return { count: rateLimitCounts.length ? rateLimitCounts.shift() : 1 };
            }
            if (!query.includes("FROM leads")) {
              return {};
            }
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

function findWrite(db, text) {
  return db.writes.find((write) => write.query.includes(text));
}

function fakeOpsSummaryD1() {
  const firstResults = [
    { total: 12 },
    { total: 4 },
    { total: 3 },
    { total: 2 },
    { total: 8 },
    { total: 5 },
    { total: 6 },
    { total: 8 },
    { total: 5 },
    { total: 3 },
    { value: "2026-05-19T10:00:00.000Z" },
    { value: "2026-05-19T11:00:00.000Z" },
    { value: "2026-05-19T11:05:00.000Z" },
    { value: "2026-05-19T12:00:00.000Z" }
  ];
  return {
    queries: [],
    prepare(query) {
      this.queries.push(query);
      return {
        first: async () => firstResults.shift() || {}
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

function leadPayload(overrides = {}) {
  return {
    leadId: "a9196fad-fb81-4a99-9abd-e7f8d77bf69b",
    name: "Security Test",
    email: "security@example.com",
    phone: "0700000000",
    persona: "business",
    access: "free",
    status: "free_registered",
    createdAt: "2026-05-18T00:00:00.000Z",
    pageUrl: "https://aiwebminar.test/",
    utm: {},
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
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO onboarding").values[3], "vip_unverified");
}

async function testOnboardingInviteKeepsVipContextWithoutSession() {
  const db = fakeD1();
  const response = await onboarding({
    request: request("https://aiwebminar.test/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(onboardingPayload({ stripeSessionId: "", onboardingSource: "ops_invite" }))
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.access, "vip");
  assert.equal(body.vipVerified, false);
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO onboarding").values[3], "vip");
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
    assert.equal(findWrite(db, "INSERT OR IGNORE INTO onboarding").values[3], "vip");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testLeadRequiresTurnstileWhenConfigured() {
  const response = await lead({
    request: request("https://aiwebminar.test/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify(leadPayload())
    }),
    env: { ...baseEnv, TURNSTILE_SECRET_KEY: "turnstile_secret", AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "turnstile_required");
}

async function testLeadAllowsValidTurnstileToken() {
  const originalFetch = globalThis.fetch;
  const db = fakeD1();
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), {
    headers: { "content-type": "application/json" }
  });

  try {
    const response = await lead({
      request: request("https://aiwebminar.test/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.11" },
        body: JSON.stringify(leadPayload({ turnstileToken: "valid-token" }))
      }),
      env: { ...baseEnv, TURNSTILE_SECRET_KEY: "turnstile_secret", AIWEBMINAR_DB: db }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(findWrite(db, "INSERT OR IGNORE INTO leads").values[0], "a9196fad-fb81-4a99-9abd-e7f8d77bf69b");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testLeadRateLimitBlocksBeforePersistence() {
  const db = fakeD1(1, { rateLimitCounts: [31] });
  const response = await lead({
    request: request("https://aiwebminar.test/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.12" },
      body: JSON.stringify(leadPayload())
    }),
    env: { ...baseEnv, AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 429);
  assert.equal(body.error, "rate_limited");
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO leads"), undefined);
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

async function testPaymentExportFormatsAmountForHumans() {
  const response = await exportCsv({
    request: request("https://aiwebminar.test/api/export?type=payments", {
      headers: { authorization: "Bearer admin_secret" }
    }),
    env: {
      ADMIN_EXPORT_TOKEN: "admin_secret",
      AIWEBMINAR_DB: fakeD1(1, {
        allResults: [[{
          server_received_at: "2026-05-19T10:00:00.000Z",
          event_id: "evt_123",
          event_type: "checkout.session.completed",
          stripe_created: 1760000000,
          session_id: "cs_test_123",
          lead_id: "lead_123",
          email: "buyer@example.com",
          amount_total: 10000,
          currency: "ron",
          payment_status: "paid",
          status: "complete",
          payment_link_id: "plink_expected",
          customer_id: "cus_123"
        }]]
      })
    }
  });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /"100","ron"/);
  assert.doesNotMatch(body, /"10000","ron"/);
}

async function testOpsSummaryRequiresBearerToken() {
  const response = await opsSummary({
    request: request("https://aiwebminar.test/api/ops-summary?token=admin_secret"),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: fakeOpsSummaryD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "forbidden");
}

async function testOpsSummaryReturnsOnlyAggregates() {
  const response = await opsSummary({
    request: request("https://aiwebminar.test/api/ops-summary", {
      headers: { authorization: "Bearer admin_secret" }
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: fakeOpsSummaryD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.counts.leads, 12);
  assert.equal(body.counts.vipFulfillments, 2);
  assert.equal(body.counts.pendingWhatsappReminders, 5);
  assert.equal(body.counts.pendingSmsReminders, 6);
  assert.equal(body.counts.missingOnboarding, 8);
  assert.equal(body.counts.freeMissingOnboarding, 5);
  assert.equal(body.counts.vipMissingOnboarding, 3);
  assert.equal(body.latest.paymentReceivedAt, "2026-05-19T11:00:00.000Z");
  assert.equal(body.latest.vipFulfilledAt, "2026-05-19T11:05:00.000Z");
  assert.equal(JSON.stringify(body).includes("email"), false);
  assert.equal(JSON.stringify(body).includes("phone"), false);
  assert.equal(JSON.stringify(body).includes("name"), false);
}

async function testOpsRemindersRequiresBearerToken() {
  const response = await opsReminders({
    request: request("https://aiwebminar.test/api/ops-reminders?token=admin_secret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", id: 1 })
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: fakeD1() }
  });
  const body = await readJson(response);
  assert.equal(response.status, 403);
  assert.equal(body.error, "forbidden");
}

async function testOpsRemindersMarksSent() {
  const db = fakeD1();
  const response = await opsReminders({
    request: request("https://aiwebminar.test/api/ops-reminders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin_secret" },
      body: JSON.stringify({ action: "mark_sent", id: 42 })
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  const write = findWrite(db, "UPDATE reminders");
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, "trimis");
  assert.equal(write.values[0], "trimis");
  assert.equal(write.values[2], 42);
}

async function testOpsRemindersCheckIsProtectedAndNonMutating() {
  const db = fakeD1();
  const response = await opsReminders({
    request: request("https://aiwebminar.test/api/ops-reminders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin_secret" },
      body: JSON.stringify({ action: "check" })
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(db.writes.length, 0);
}

async function testOpsRemindersReusesOnboardingInviteWithoutPii() {
  const db = fakeD1(1, {
    firstResults: [
      {
        lead_id: "lead_123",
        name: "Private Person",
        email: "private@example.com",
        phone: "0742000000",
        access: "free",
        persona: "business"
      },
      {},
      { id: 9, status: "de_trimis", last_sent_at: "" }
    ]
  });
  const response = await opsReminders({
    request: request("https://aiwebminar.test/api/ops-reminders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin_secret" },
      body: JSON.stringify({
        action: "create_onboarding_invite",
        leadId: "lead_123",
        message: "Salut, completeaza onboardingul.",
        actionUrl: "https://aiwebminar.test/thank-you.html?mode=onboarding"
      })
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.id, 9);
  assert.equal(body.reused, true);
  assert.equal(findWrite(db, "INSERT INTO reminders"), undefined);
  assert.equal(JSON.stringify(body).includes("private@example.com"), false);
  assert.equal(JSON.stringify(body).includes("0742000000"), false);
  assert.equal(JSON.stringify(body).includes("Private Person"), false);
}

async function testOpsRemindersCreatesOnboardingInvite() {
  const db = fakeD1(1, {
    firstResults: [
      {
        lead_id: "lead_123",
        name: "Private Person",
        email: "private@example.com",
        phone: "0742000000",
        access: "free",
        persona: "business"
      },
      {},
      {},
      { id: 10, status: "de_trimis", last_sent_at: "" }
    ]
  });
  const response = await opsReminders({
    request: request("https://aiwebminar.test/api/ops-reminders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin_secret" },
      body: JSON.stringify({
        action: "create_onboarding_invite",
        leadId: "lead_123",
        message: "Salut, completeaza onboardingul.",
        actionUrl: "https://aiwebminar.test/thank-you.html?mode=onboarding"
      })
    }),
    env: { ADMIN_EXPORT_TOKEN: "admin_secret", AIWEBMINAR_DB: db }
  });
  const body = await readJson(response);
  const write = findWrite(db, "INSERT INTO reminders");
  assert.equal(response.status, 200);
  assert.equal(body.id, 10);
  assert.equal(body.reused, false);
  assert.equal(write.values[7], "whatsapp");
  assert.equal(write.values[12], "Calin");
  assert.equal(write.values[13], "onboarding_invite");
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

async function testThankYouSupportsOptionalOnboardingMode() {
  const html = await readFile(new URL("../thank-you.html", import.meta.url), "utf8");
  assert.match(html, /const onboardingMode = params\.get\("mode"\) === "onboarding"/);
  assert.match(html, /const renderOnboardingInvite = \(\) =>/);
  assert.match(html, /Onboardingul nu blocheaza accesul Free sau VIP/);
  assert.match(html, /if \(onboardingMode\) \{\s*renderOnboardingInvite\(\);/);
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
  assert.equal(Object.hasOwn(body, "TURNSTILE_SECRET_KEY"), false);
}

async function testConfigExposesOnlyTurnstileSiteKey() {
  const response = await config({
    env: {
      ...baseEnv,
      TURNSTILE_SITE_KEY: "0x4AAAA_public",
      TURNSTILE_SECRET_KEY: "secret_value"
    }
  });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.turnstileSiteKey, "0x4AAAA_public");
  assert.equal(body.turnstileConfigured, true);
  assert.equal(Object.hasOwn(body, "TURNSTILE_SECRET_KEY"), false);
}

async function testFrontendReadsTurnstileHiddenFallback() {
  const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const thankYouHtml = await readFile(new URL("../thank-you.html", import.meta.url), "utf8");
  assert.match(indexHtml, /cf-turnstile-response/);
  assert.match(thankYouHtml, /cf-turnstile-response/);
}

async function testGoogleSheetPaymentFormatsAmountForHumans() {
  const code = await readFile(new URL("../functions/_ops/google-apps-script/Code.gs", import.meta.url), "utf8");
  assert.match(code, /if \(type === "vip_fulfillment"\)/);
  assert.match(code, /function isConfirmedVipFulfillment\(record\)/);
  assert.match(code, /unconfirmed_fulfillment_refused/);
  assert.match(code, /function formatMinorUnitAmount\(value, currency\)/);
  assert.match(code, /amountTotal:\s*formatMinorUnitAmount\(record\.amountTotal,\s*record\.currency\)/);
  assert.match(code, /appendRecordOnce\("Payments", rowRecord, "sessionId", rowRecord\.sessionId\)/);
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
  assert.equal(body.recorded, true);
  assert.equal(body.fulfilled, true);
  assert.equal(body.duplicateFulfillment, false);
  assert.equal(body.ops.payment.ok, true);
  assert.equal(body.ops.fulfillment.ok, true);
  assert.equal(body.ops.sync.skipped, true);
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO payments").values[6], 10000);
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO vip_fulfillments").values[0], "cs_test_123");
  assert.equal(findWrite(db, "UPDATE vip_fulfillments").values[0], "skipped");
}

async function testStripeWebhookDoesNotSyncDuplicatePayment() {
  const db = fakeD1(0, { firstResults: [{ sync_status: "synced", email_status: "sent" }] });
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
  assert.equal(body.recorded, true);
  assert.equal(body.fulfilled, false);
  assert.equal(body.duplicateFulfillment, true);
  assert.equal(body.ops.payment.duplicate, true);
  assert.equal(body.ops.fulfillment.duplicate, true);
  assert.deepEqual(body.ops.sync, { skipped: true, reason: "fulfillment_already_synced" });
}

async function testStripeWebhookDoesNotFulfillCompletedUnpaidSession() {
  const db = fakeD1();
  const payload = JSON.stringify({
    id: "evt_unpaid",
    type: "checkout.session.completed",
    created: 1760000000,
    data: { object: stripeSession({ payment_status: "unpaid" }) }
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
  assert.equal(body.recorded, true);
  assert.equal(body.fulfilled, false);
  assert.equal(body.ignoredReason, "payment_not_confirmed");
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO payments").values[9], "complete");
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO vip_fulfillments"), undefined);
}

async function testStripeWebhookLogsAsyncPaymentFailedWithoutFulfillment() {
  const db = fakeD1();
  const payload = JSON.stringify({
    id: "evt_async_failed",
    type: "checkout.session.async_payment_failed",
    created: 1760000000,
    data: { object: stripeSession({ payment_status: "unpaid" }) }
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
  assert.equal(body.recorded, true);
  assert.equal(body.fulfilled, false);
  assert.equal(body.ignoredReason, "async_payment_failed");
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO payments").values[1], "checkout.session.async_payment_failed");
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO vip_fulfillments"), undefined);
}

async function testStripeWebhookFulfillsAsyncPaymentSucceeded() {
  const db = fakeD1();
  const payload = JSON.stringify({
    id: "evt_async_succeeded",
    type: "checkout.session.async_payment_succeeded",
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
  assert.equal(body.fulfilled, true);
  assert.equal(findWrite(db, "INSERT OR IGNORE INTO vip_fulfillments").values[8], "checkout.session.async_payment_succeeded");
}

async function testStripeWebhookDedupesDifferentEventForSameSession() {
  const db = fakeD1(1, {
    runChanges: [1, 0],
    firstResults: [{ sync_status: "synced", email_status: "sent" }]
  });
  const payload = JSON.stringify({
    id: "evt_second",
    type: "checkout.session.async_payment_succeeded",
    created: 1760000001,
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
  assert.equal(body.recorded, true);
  assert.equal(body.fulfilled, false);
  assert.equal(body.duplicateFulfillment, true);
  assert.deepEqual(body.ops.sync, { skipped: true, reason: "fulfillment_already_synced" });
}

async function testStripeWebhookReturnsFailureWhenFulfillmentSyncFails() {
  const originalFetch = globalThis.fetch;
  const db = fakeD1();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: "apps_script_down" }), {
    status: 500,
    headers: { "content-type": "application/json" }
  });
  const payload = JSON.stringify({
    id: "evt_sync_failed",
    type: "checkout.session.completed",
    created: 1760000000,
    data: { object: stripeSession() }
  });
  const signature = await stripeSignature(payload, baseEnv.STRIPE_WEBHOOK_SECRET);

  try {
    const response = await stripeWebhook({
      request: request("https://aiwebminar.test/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload
      }),
      env: {
        ...baseEnv,
        AIWEBMINAR_DB: db,
        GOOGLE_OPS_WEBHOOK_URL: "https://ops.example.test/webhook",
        GOOGLE_OPS_WEBHOOK_SECRET: "ops_secret"
      }
    });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assert.equal(body.error, "vip_fulfillment_sync_failed");
    assert.equal(findWrite(db, "UPDATE vip_fulfillments").values[0], "failed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testStripeReconciliationFindsMissingFulfillment() {
  const report = findMissingFulfillments([
    stripeSession({ id: "cs_paid_saved" }),
    stripeSession({ id: "cs_paid_missing", client_reference_id: "lead_missing" }),
    stripeSession({ id: "cs_unpaid", payment_status: "unpaid" })
  ], [
    { session_id: "cs_paid_saved", lead_id: "lead_123" }
  ]);
  assert.equal(report.paidSessions.length, 2);
  assert.deepEqual(report.missing.map((session) => session.id), ["cs_paid_missing"]);
  assert.deepEqual(report.extra, []);
}

const tests = [
  testReadJsonRejectsOversizedBodyWithoutTrustingContentLength,
  testVipAccessBlocksMissingSession,
  testVipAccessBlocksUnsafeSessionId,
  testVipAccessRequiresPaymentLinkConfig,
  testVipAccessBlocksMismatchedAmount,
  testVipAccessAllowsExpectedPaidSession,
  testOnboardingDowngradesUnverifiedVipAccess,
  testOnboardingInviteKeepsVipContextWithoutSession,
  testOnboardingKeepsVipOnlyForVerifiedPayment,
  testLeadRequiresTurnstileWhenConfigured,
  testLeadAllowsValidTurnstileToken,
  testLeadRateLimitBlocksBeforePersistence,
  testExportRejectsTokenInQueryString,
  testExportAllowsBearerToken,
  testPaymentExportFormatsAmountForHumans,
  testOpsSummaryRequiresBearerToken,
  testOpsSummaryReturnsOnlyAggregates,
  testOpsRemindersRequiresBearerToken,
  testOpsRemindersMarksSent,
  testOpsRemindersCheckIsProtectedAndNonMutating,
  testOpsRemindersReusesOnboardingInviteWithoutPii,
  testOpsRemindersCreatesOnboardingInvite,
  testThankYouTrackingDoesNotSendStripeSessionId,
  testThankYouSupportsOptionalOnboardingMode,
  testConfigDoesNotExposeWhatsappGroupUrls,
  testConfigExposesOnlyTurnstileSiteKey,
  testFrontendReadsTurnstileHiddenFallback,
  testGoogleSheetPaymentFormatsAmountForHumans,
  testStaticGuardBlocksInternalArtifacts,
  testStaticGuardAllowsPublicPages,
  testFreeAccessRequiresSafeLeadId,
  testFreeAccessReturnsGroupForSavedLead,
  testStripeWebhookRejectsInvalidSignature,
  testStripeWebhookIgnoresWrongPaymentLink,
  testStripeWebhookStoresExpectedPayment,
  testStripeWebhookDoesNotSyncDuplicatePayment,
  testStripeWebhookDoesNotFulfillCompletedUnpaidSession,
  testStripeWebhookLogsAsyncPaymentFailedWithoutFulfillment,
  testStripeWebhookFulfillsAsyncPaymentSucceeded,
  testStripeWebhookDedupesDifferentEventForSameSession,
  testStripeWebhookReturnsFailureWhenFulfillmentSyncFails,
  testStripeReconciliationFindsMissingFulfillment
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}
