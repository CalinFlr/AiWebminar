import { pathToFileURL } from "node:url";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}_missing`);
  }
  return value;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...body] = rows;
  return body
    .filter((cells) => cells.some((value) => value !== ""))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function expectedAmount() {
  return Number(process.env.EXPECTED_VIP_AMOUNT || "10000");
}

function expectedCurrency() {
  return String(process.env.EXPECTED_VIP_CURRENCY || "ron").toLowerCase();
}

function isExpectedPaidSession(session) {
  return session &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    Number(session.amount_total || 0) === expectedAmount() &&
    String(session.currency || "").toLowerCase() === expectedCurrency();
}

export function findMissingFulfillments(stripeSessions, fulfillmentRows) {
  const fulfilledSessionIds = new Set(
    fulfillmentRows.map((row) => String(row.session_id || row.sessionId || "").trim()).filter(Boolean)
  );
  const paidSessions = stripeSessions.filter(isExpectedPaidSession);
  const missing = paidSessions.filter((session) => !fulfilledSessionIds.has(session.id));
  const stripeSessionIds = new Set(paidSessions.map((session) => session.id));
  const extra = fulfillmentRows.filter((row) => {
    const sessionId = String(row.session_id || row.sessionId || "").trim();
    return sessionId && !stripeSessionIds.has(sessionId);
  });

  return { paidSessions, missing, extra };
}

async function fetchStripeSessions() {
  const secretKey = requiredEnv("STRIPE_SECRET_KEY");
  const paymentLink = requiredEnv("STRIPE_PAYMENT_LINK_ID");
  const sessions = [];
  let startingAfter = "";

  do {
    const url = new URL("https://api.stripe.com/v1/checkout/sessions");
    url.searchParams.set("payment_link", paymentLink);
    url.searchParams.set("status", "complete");
    url.searchParams.set("limit", "100");
    if (process.env.RECONCILE_CREATED_GTE) {
      url.searchParams.set("created[gte]", process.env.RECONCILE_CREATED_GTE);
    }
    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secretKey}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error?.message || `stripe_sessions_${response.status}`);
    }

    sessions.push(...(body.data || []));
    startingAfter = body.has_more && body.data?.length ? body.data[body.data.length - 1].id : "";
  } while (startingAfter);

  return sessions;
}

async function fetchFulfillmentRows() {
  const siteUrl = requiredEnv("PUBLIC_SITE_URL").replace(/\/+$/, "");
  const token = requiredEnv("ADMIN_EXPORT_TOKEN");
  const url = new URL(`${siteUrl}/api/export`);
  url.searchParams.set("type", "vip_fulfillments");
  url.searchParams.set("limit", "10000");

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `vip_fulfillments_export_${response.status}`);
  }

  return parseCsv(text);
}

async function main() {
  const [stripeSessions, fulfillmentRows] = await Promise.all([
    fetchStripeSessions(),
    fetchFulfillmentRows()
  ]);
  const report = findMissingFulfillments(stripeSessions, fulfillmentRows);

  console.log(JSON.stringify({
    ok: report.missing.length === 0,
    paidSessions: report.paidSessions.length,
    fulfilledSessions: fulfillmentRows.length,
    missingFulfillments: report.missing.map((session) => ({
      sessionId: session.id,
      leadId: session.client_reference_id || "",
      email: session.customer_details?.email || session.customer_email || "",
      amountTotal: session.amount_total,
      currency: session.currency
    })),
    extraFulfillments: report.extra.map((row) => ({
      sessionId: row.session_id || row.sessionId || "",
      leadId: row.lead_id || row.leadId || ""
    }))
  }, null, 2));

  if (report.missing.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
