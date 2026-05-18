import { json, methodNotAllowed } from "../_shared/http.js";
import { hasD1 } from "../_shared/storage.js";

const EXPORTS = {
  leads: {
    table: "leads",
    orderBy: "server_received_at",
    columns: [
      "server_received_at", "lead_id", "status", "access", "name", "email", "phone",
      "persona", "created_at", "page_url", "checkout_url", "sms_reminder_url",
      "whatsapp_reminder_url"
    ]
  },
  onboarding: {
    table: "onboarding",
    orderBy: "server_received_at",
    columns: [
      "server_received_at", "onboarding_id", "lead_id", "signup_email", "access",
      "persona", "stripe_session_id", "automation_idea", "current_tools",
      "public_link", "desired_outcome", "created_at"
    ]
  },
  payments: {
    table: "payments",
    orderBy: "server_received_at",
    columns: [
      "server_received_at", "event_id", "event_type", "stripe_created", "session_id",
      "lead_id", "email", "amount_total", "currency", "payment_status", "status",
      "payment_link_id", "customer_id"
    ]
  },
  reminders: {
    table: "reminders",
    orderBy: "created_at",
    columns: [
      "created_at", "lead_id", "name", "email", "phone", "access", "persona",
      "channel", "message", "action_url", "status", "last_sent_at", "owner", "notes"
    ]
  }
};

function csvCell(value) {
  const text = value === null || typeof value === "undefined" ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows, columns) {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))
  ].join("\n");
}

function getToken(request) {
  const bearer = request.headers.get("authorization") || "";
  if (bearer.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }
  return "";
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  let result = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return result === 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_EXPORT_TOKEN) {
    return json({ ok: false, error: "admin_export_token_not_configured" }, { status: 503 });
  }
  if (!safeEqual(getToken(request), env.ADMIN_EXPORT_TOKEN)) {
    return json({ ok: false, error: "forbidden" }, {
      status: 403,
      headers: { "www-authenticate": "Bearer" }
    });
  }
  if (!hasD1(env)) {
    return json({ ok: false, error: "d1_not_configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "leads";
  const config = EXPORTS[type];
  if (!config) {
    return json({ ok: false, error: "invalid_export_type" }, { status: 400 });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "5000"), 1), 10000);
  const query = `
    SELECT ${config.columns.join(", ")}
    FROM ${config.table}
    ORDER BY ${config.orderBy} DESC
    LIMIT ?
  `;
  const result = await env.AIWEBMINAR_DB.prepare(query).bind(limit).all();
  const body = csv(result.results || [], config.columns);

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="aiwebminar-${type}.csv"`
    }
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
