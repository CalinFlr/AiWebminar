const VERSION = "2026-05-17";

const SHEET_COLUMNS = {
  Leads: [
    "serverReceivedAt",
    "leadId",
    "status",
    "access",
    "name",
    "email",
    "phone",
    "persona",
    "createdAt",
    "pageUrl",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "fbclid",
    "gclid",
    "gcpc",
    "checkoutUrl",
    "whatsappFreeGroupUrl",
    "reminderMessage",
    "smsReminderUrl",
    "whatsappReminderUrl",
    "opsProcessedAt",
    "emailStatus",
    "notes"
  ],
  Onboarding: [
    "serverReceivedAt",
    "onboardingId",
    "leadId",
    "signupEmail",
    "access",
    "persona",
    "stripeSessionId",
    "automationIdea",
    "currentTools",
    "publicLink",
    "desiredOutcome",
    "createdAt",
    "opsProcessedAt",
    "notes"
  ],
  Payments: [
    "serverReceivedAt",
    "eventId",
    "eventType",
    "created",
    "sessionId",
    "leadId",
    "email",
    "amountTotal",
    "currency",
    "paymentStatus",
    "status",
    "paymentLinkId",
    "customerId",
    "opsProcessedAt",
    "emailStatus",
    "oblioInvoiceStatus",
    "notes"
  ],
  Reminders: [
    "createdAt",
    "leadId",
    "name",
    "email",
    "phone",
    "access",
    "persona",
    "channel",
    "message",
    "actionUrl",
    "status",
    "lastSentAt",
    "owner",
    "notes"
  ]
};

function doGet() {
  return jsonResponse({ ok: true, service: "aiwebminar-ops", version: VERSION });
}

function doPost(e) {
  try {
    var body = e && e.postData ? e.postData.contents : "";
    if (!body) {
      return jsonResponse({ ok: false, error: "missing_body" });
    }

    var request = JSON.parse(body);
    var signedPayload = String(request.signedPayload || "");
    var signature = String(request.signature || "");

    if (!verifySignedPayload(signedPayload, signature)) {
      return jsonResponse({ ok: false, error: "invalid_signature" });
    }

    var payload = JSON.parse(signedPayload);
    if (!isFresh(payload.sentAt)) {
      return jsonResponse({ ok: false, error: "stale_request" });
    }

    var type = String(payload.type || "").trim();
    var record = payload.record || {};

    if (type === "lead") {
      return jsonResponse(handleLead(record));
    }
    if (type === "onboarding") {
      return jsonResponse(handleOnboarding(record));
    }
    if (type === "payment") {
      return jsonResponse(handlePayment(record));
    }

    return jsonResponse({ ok: false, error: "unknown_type", type: type });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: "server_error",
      message: String(error && error.message ? error.message : error).slice(0, 500)
    });
  }
}

function setupSheets() {
  Object.keys(SHEET_COLUMNS).forEach(function(sheetName) {
    getOrCreateSheet(sheetName, SHEET_COLUMNS[sheetName]);
  });

  return {
    ok: true,
    spreadsheetId: getRequiredProp("SPREADSHEET_ID"),
    sheets: Object.keys(SHEET_COLUMNS)
  };
}

function handleLead(record) {
  var now = new Date().toISOString();
  var rowRecord = Object.assign({}, record, flattenUtm(record.utm), {
    opsProcessedAt: now,
    emailStatus: "pending"
  });
  var appendResult = appendRecordOnce("Leads", rowRecord, "leadId", rowRecord.leadId);
  if (appendResult.duplicate) {
    return {
      ok: true,
      type: "lead",
      sheet: "Leads",
      row: appendResult.row,
      duplicate: true,
      emailStatus: "duplicate_skipped"
    };
  }

  var row = appendResult.row;
  var emailStatus = sendLeadEmail(rowRecord);
  updateCell("Leads", row, "emailStatus", emailStatus);
  appendReminderRows(rowRecord);

  return {
    ok: true,
    type: "lead",
    sheet: "Leads",
    row: row,
    emailStatus: emailStatus
  };
}

function handleOnboarding(record) {
  var rowRecord = Object.assign({}, record, {
    opsProcessedAt: new Date().toISOString()
  });
  var appendResult = appendRecordOnce("Onboarding", rowRecord, "onboardingId", rowRecord.onboardingId);

  return {
    ok: true,
    type: "onboarding",
    sheet: "Onboarding",
    row: appendResult.row,
    duplicate: appendResult.duplicate,
    emailStatus: "not_applicable"
  };
}

function handlePayment(record) {
  var rowRecord = Object.assign({}, record, {
    opsProcessedAt: new Date().toISOString(),
    emailStatus: "pending",
    oblioInvoiceStatus: "de_emis"
  });
  var appendResult = appendRecordOnce("Payments", rowRecord, "eventId", rowRecord.eventId);
  if (appendResult.duplicate) {
    return {
      ok: true,
      type: "payment",
      sheet: "Payments",
      row: appendResult.row,
      duplicate: true,
      emailStatus: "duplicate_skipped"
    };
  }

  var row = appendResult.row;
  var emailStatus = sendVipEmail(rowRecord);
  updateCell("Payments", row, "emailStatus", emailStatus);

  return {
    ok: true,
    type: "payment",
    sheet: "Payments",
    row: row,
    emailStatus: emailStatus
  };
}

function appendRecord(sheetName, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    var columns = SHEET_COLUMNS[sheetName];
    var sheet = getOrCreateSheet(sheetName, columns);
    var row = columns.map(function(column) {
      return safeCell(record[column]);
    });
    sheet.appendRow(row);
    return sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }
}

function appendRecordOnce(sheetName, record, keyColumn, keyValue) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    var columns = SHEET_COLUMNS[sheetName];
    var sheet = getOrCreateSheet(sheetName, columns);
    var existingRow = keyValue ? findRowByColumn(sheet, columns, keyColumn, keyValue) : 0;
    if (existingRow) {
      return { row: existingRow, duplicate: true };
    }

    var row = columns.map(function(column) {
      return safeCell(record[column]);
    });
    sheet.appendRow(row);
    return { row: sheet.getLastRow(), duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function findRowByColumn(sheet, columns, keyColumn, keyValue) {
  var columnIndex = columns.indexOf(keyColumn);
  if (columnIndex === -1) {
    return 0;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var normalizedKey = String(keyValue);
  var values = sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).getValues();
  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === normalizedKey) {
      return index + 2;
    }
  }

  return 0;
}

function appendReminderRows(record) {
  var reminders = [];

  if (record.smsReminderUrl) {
    reminders.push({
      channel: "sms",
      actionUrl: record.smsReminderUrl
    });
  }

  if (record.whatsappReminderUrl) {
    reminders.push({
      channel: "whatsapp",
      actionUrl: record.whatsappReminderUrl
    });
  }

  reminders.forEach(function(reminder) {
    appendRecord("Reminders", {
      createdAt: new Date().toISOString(),
      leadId: record.leadId,
      name: record.name,
      email: record.email,
      phone: record.phone,
      access: record.access,
      persona: record.persona,
      channel: reminder.channel,
      message: record.reminderMessage,
      actionUrl: reminder.actionUrl,
      status: "de_trimis",
      lastSentAt: "",
      owner: "Calin",
      notes: ""
    });
  });
}

function updateCell(sheetName, row, columnName, value) {
  var columns = SHEET_COLUMNS[sheetName];
  var index = columns.indexOf(columnName);
  if (index === -1) {
    return;
  }

  var sheet = getOrCreateSheet(sheetName, columns);
  sheet.getRange(row, index + 1).setValue(safeCell(value));
}

function getOrCreateSheet(sheetName, columns) {
  var spreadsheet = SpreadsheetApp.openById(getRequiredProp("SPREADSHEET_ID"));
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  var firstRow = sheet.getRange(1, 1, 1, columns.length).getValues()[0];
  var hasHeader = firstRow.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function sendLeadEmail(record) {
  if (!shouldSendEmails()) {
    return "disabled";
  }
  if (!record.email) {
    return "missing_email";
  }

  var isVip = record.access === "vip";
  var subject = isVip
    ? "Am salvat intentia ta VIP pentru Agenti AI 24/7"
    : "Locul tau prioritar este salvat pentru Agenti AI 24/7";
  var body = isVip ? vipIntentEmail(record) : freeLeadEmail(record);

  return sendEmail(record.email, subject, body);
}

function sendVipEmail(record) {
  if (!shouldSendEmails()) {
    return "disabled";
  }
  if (!record.email) {
    return "missing_email";
  }

  var vipGroupUrl = getProp("WHATSAPP_VIP_GROUP_URL", "");
  var siteUrl = getProp("PUBLIC_SITE_URL", "https://aiwebminar.pages.dev").replace(/\/+$/, "");
  var thankYouUrl = siteUrl + "/thank-you.html?access=vip&session_id=" + encodeURIComponent(record.sessionId || "");
  var body = [
    "Salut,",
    "",
    "Accesul tau VIP este confirmat.",
    "",
    vipGroupUrl
      ? "Intra in grupul WhatsApp VIP pentru link, remindere si materialele premium:\n" + vipGroupUrl
      : "Pagina ta de confirmare VIP este aici:\n" + thankYouUrl,
    "",
    "Urmatorul pas este onboardingul, ca sa stim ce proces vrei sa aducem mai aproape de workshop:",
    thankYouUrl,
    "",
    "Calin"
  ].join("\n");

  return sendEmail(record.email, "VIP confirmat - intra in grupul premium", body);
}

function freeLeadEmail(record) {
  var groupUrl = record.whatsappFreeGroupUrl || getProp("WHATSAPP_FREE_GROUP_URL", "");
  return [
    "Salut, " + firstName(record.name) + ",",
    "",
    "Ai loc prioritar la workshopul Agenti AI 24/7.",
    "",
    "Intra in grupul WhatsApp gratuit pentru link, anunturi si remindere:",
    groupUrl || "[link grup WhatsApp]",
    "",
    "Cand confirmam datele sesiunilor, primesti detaliile pe email si in grup.",
    "",
    "Calin"
  ].join("\n");
}

function vipIntentEmail(record) {
  var checkoutUrl = String(record.checkoutUrl || "").trim();
  var paymentLines = checkoutUrl
    ? [
      "Finalizeaza plata VIP de 100 RON prin Stripe aici:",
      checkoutUrl
    ]
    : [
      "Plata VIP de 100 RON se finalizeaza prin Stripe imediat ce activam checkout-ul pe SRL."
    ];

  return [
    "Salut, " + firstName(record.name) + ",",
    "",
    "Am salvat intentia ta pentru VIP Implementation Lab.",
    "",
    paymentLines.join("\n"),
    "Dupa plata, primesti acces la grupul WhatsApp VIP, replay-uri, workbook si Implementation Lab.",
    "",
    "Calin"
  ].join("\n");
}

function sendEmail(to, subject, body) {
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: getProp("SENDER_NAME", "Calin Florea")
    });
    return "sent";
  } catch (error) {
    return "error:" + String(error && error.message ? error.message : error).slice(0, 120);
  }
}

function shouldSendEmails() {
  return getProp("SEND_EMAILS", "true") !== "false";
}

function verifySignedPayload(signedPayload, signature) {
  var secret = getRequiredProp("WEBHOOK_SECRET");
  if (!signedPayload || !signature) {
    return false;
  }

  var expected = bytesToHex(Utilities.computeHmacSha256Signature(signedPayload, secret));
  return safeEqual(expected, signature);
}

function isFresh(sentAt) {
  var timestamp = Date.parse(sentAt || "");
  if (!timestamp) {
    return false;
  }

  return Math.abs(Date.now() - timestamp) <= 10 * 60 * 1000;
}

function flattenUtm(utm) {
  var source = utm && typeof utm === "object" ? utm : {};
  return {
    utm_source: source.utm_source || "",
    utm_medium: source.utm_medium || "",
    utm_campaign: source.utm_campaign || "",
    utm_content: source.utm_content || "",
    utm_term: source.utm_term || "",
    utm_id: source.utm_id || "",
    fbclid: source.fbclid || "",
    gclid: source.gclid || "",
    gcpc: source.gcpc || ""
  };
}

function safeCell(value) {
  var text = value === null || typeof value === "undefined" ? "" : String(value);
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function firstName(name) {
  return String(name || "Salut").trim().split(/\s+/)[0] || "Salut";
}

function getProp(name, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  return value || fallback || "";
}

function getRequiredProp(name) {
  var value = getProp(name, "");
  if (!value) {
    throw new Error(name + " script property is missing");
  }
  return value;
}

function bytesToHex(bytes) {
  return bytes.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return value.toString(16).padStart(2, "0");
  }).join("");
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  var result = 0;
  for (var index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
