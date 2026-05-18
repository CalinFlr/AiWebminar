import { json, methodNotAllowed } from "../_shared/http.js";
import { hasD1 } from "../_shared/storage.js";

function isSafeLeadId(leadId) {
  return /^[A-Za-z0-9_-]{6,120}$/.test(leadId);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const leadId = url.searchParams.get("lead_id") || "";

  if (!isSafeLeadId(leadId)) {
    return json({ ok: false, error: "missing_lead" }, { status: 403 });
  }

  if (!hasD1(env)) {
    return json({ ok: false, error: "d1_not_configured" }, { status: 503 });
  }

  if (!env.WHATSAPP_FREE_GROUP_URL) {
    return json({ ok: false, error: "free_group_not_configured" }, { status: 503 });
  }

  const row = await env.AIWEBMINAR_DB.prepare(`
    SELECT lead_id, access, status
    FROM leads
    WHERE lead_id = ?
    LIMIT 1
  `).bind(leadId).first();

  if (!row) {
    return json({ ok: false, error: "lead_not_found" }, { status: 404 });
  }

  return json({
    ok: true,
    access: row.access || "free",
    leadId: row.lead_id,
    whatsappFreeGroupUrl: env.WHATSAPP_FREE_GROUP_URL
  });
}

export async function onRequestPost() {
  return methodNotAllowed();
}
