export function hasD1(env) {
  return Boolean(env.AIWEBMINAR_DB && typeof env.AIWEBMINAR_DB.prepare === "function");
}

function stringify(value) {
  return JSON.stringify(value || {});
}

function d1Error(error, fallback = "d1_write_failed") {
  return {
    provider: "d1",
    ok: false,
    error: fallback,
    message: String(error && error.message ? error.message : error).slice(0, 200)
  };
}

export async function saveLeadRecord(env, record) {
  if (!hasD1(env)) {
    return { provider: "d1", ok: false, skipped: true, error: "d1_not_configured" };
  }

  try {
    const result = await env.AIWEBMINAR_DB.prepare(`
      INSERT OR IGNORE INTO leads (
        lead_id, status, access, name, email, phone, persona, created_at, server_received_at,
        page_url, utm_json, checkout_url, whatsapp_free_group_url, reminder_message,
        sms_reminder_url, whatsapp_reminder_url, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.leadId || "",
      record.status || "",
      record.access || "",
      record.name || "",
      record.email || "",
      record.phone || "",
      record.persona || "",
      record.createdAt || "",
      record.serverReceivedAt || "",
      record.pageUrl || "",
      stringify(record.utm),
      record.checkoutUrl || "",
      record.whatsappFreeGroupUrl || "",
      record.reminderMessage || "",
      record.smsReminderUrl || "",
      record.whatsappReminderUrl || "",
      stringify(record)
    ).run();

    const duplicate = Number(result.meta?.changes || 0) === 0;
    if (!duplicate) {
      await saveReminderRows(env, record);
    }

    return { provider: "d1", ok: true, duplicate, meta: result.meta || {} };
  } catch (error) {
    return d1Error(error);
  }
}

async function saveReminderRows(env, record) {
  const rows = [];
  if (record.smsReminderUrl) {
    rows.push(["sms", record.smsReminderUrl]);
  }
  if (record.whatsappReminderUrl) {
    rows.push(["whatsapp", record.whatsappReminderUrl]);
  }

  for (const [channel, actionUrl] of rows) {
    await env.AIWEBMINAR_DB.prepare(`
      INSERT INTO reminders (
        created_at, lead_id, name, email, phone, access, persona, channel,
        message, action_url, status, last_sent_at, owner, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      new Date().toISOString(),
      record.leadId || "",
      record.name || "",
      record.email || "",
      record.phone || "",
      record.access || "",
      record.persona || "",
      channel,
      record.reminderMessage || "",
      actionUrl,
      "de_trimis",
      "",
      "Calin",
      ""
    ).run();
  }
}

export async function saveOnboardingRecord(env, record) {
  if (!hasD1(env)) {
    return { provider: "d1", ok: false, skipped: true, error: "d1_not_configured" };
  }

  try {
    const result = await env.AIWEBMINAR_DB.prepare(`
      INSERT OR IGNORE INTO onboarding (
        onboarding_id, lead_id, signup_email, access, persona, stripe_session_id,
        automation_idea, current_tools, public_link, desired_outcome,
        created_at, server_received_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.onboardingId || "",
      record.leadId || "",
      record.signupEmail || "",
      record.access || "",
      record.persona || "",
      record.stripeSessionId || "",
      record.automationIdea || "",
      record.currentTools || "",
      record.publicLink || "",
      record.desiredOutcome || "",
      record.createdAt || "",
      record.serverReceivedAt || "",
      stringify(record)
    ).run();

    return {
      provider: "d1",
      ok: true,
      duplicate: Number(result.meta?.changes || 0) === 0,
      meta: result.meta || {}
    };
  } catch (error) {
    return d1Error(error);
  }
}

export async function savePaymentRecord(env, record) {
  if (!hasD1(env)) {
    return { provider: "d1", ok: false, skipped: true, error: "d1_not_configured" };
  }

  try {
    const result = await env.AIWEBMINAR_DB.prepare(`
      INSERT OR IGNORE INTO payments (
        event_id, event_type, stripe_created, session_id, lead_id, email,
        amount_total, currency, payment_status, status, payment_link_id,
        customer_id, server_received_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.eventId || "",
      record.eventType || "",
      Number(record.created || 0) || null,
      record.sessionId || "",
      record.leadId || "",
      record.email || "",
      Number(record.amountTotal || 0),
      record.currency || "",
      record.paymentStatus || "",
      record.status || "",
      record.paymentLinkId || "",
      record.customerId || "",
      record.serverReceivedAt || "",
      stringify(record)
    ).run();

    return {
      provider: "d1",
      ok: true,
      duplicate: Number(result.meta?.changes || 0) === 0,
      meta: result.meta || {}
    };
  } catch (error) {
    return d1Error(error);
  }
}

export async function saveVipFulfillmentRecord(env, record) {
  if (!hasD1(env)) {
    return { provider: "d1", ok: false, skipped: true, error: "d1_not_configured" };
  }

  try {
    const result = await env.AIWEBMINAR_DB.prepare(`
      INSERT OR IGNORE INTO vip_fulfillments (
        session_id, lead_id, email, amount_total, currency, payment_link_id,
        customer_id, source_event_id, source_event_type, stripe_created,
        fulfilled_at, sync_status, email_status, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.sessionId || "",
      record.leadId || "",
      record.email || "",
      Number(record.amountTotal || 0),
      record.currency || "",
      record.paymentLinkId || "",
      record.customerId || "",
      record.sourceEventId || "",
      record.sourceEventType || "",
      Number(record.created || 0) || null,
      record.fulfilledAt || "",
      record.syncStatus || "pending",
      record.emailStatus || "",
      stringify(record)
    ).run();

    const duplicate = Number(result.meta?.changes || 0) === 0;
    let existing = null;
    if (duplicate && record.sessionId) {
      existing = await env.AIWEBMINAR_DB.prepare(`
        SELECT sync_status, email_status
        FROM vip_fulfillments
        WHERE session_id = ?
        LIMIT 1
      `).bind(record.sessionId).first();
    }

    return {
      provider: "d1",
      ok: true,
      duplicate,
      existing,
      meta: result.meta || {}
    };
  } catch (error) {
    return d1Error(error, "d1_vip_fulfillment_write_failed");
  }
}

export async function updateVipFulfillmentSyncStatus(env, sessionId, syncStatus, emailStatus = "") {
  if (!hasD1(env)) {
    return { provider: "d1", ok: false, skipped: true, error: "d1_not_configured" };
  }

  try {
    const result = await env.AIWEBMINAR_DB.prepare(`
      UPDATE vip_fulfillments
      SET sync_status = ?, email_status = ?
      WHERE session_id = ?
    `).bind(
      syncStatus || "",
      emailStatus || "",
      sessionId || ""
    ).run();

    return { provider: "d1", ok: true, meta: result.meta || {} };
  } catch (error) {
    return d1Error(error, "d1_vip_fulfillment_sync_update_failed");
  }
}
