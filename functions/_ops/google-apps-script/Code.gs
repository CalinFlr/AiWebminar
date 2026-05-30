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
    if (type === "vip_fulfillment") {
      return jsonResponse(handleVipFulfillment(record));
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
  if (record && record.fulfillmentStatus === "confirmed") {
    return handleVipFulfillment(record);
  }

  return {
    ok: false,
    type: "payment",
    error: "payment_event_not_fulfillment",
    emailStatus: "refused"
  };
}

function handleVipFulfillment(record) {
  if (!isConfirmedVipFulfillment(record)) {
    return {
      ok: false,
      type: "vip_fulfillment",
      error: "unconfirmed_fulfillment_refused",
      emailStatus: "refused"
    };
  }

  var rowRecord = Object.assign({}, record, {
    eventId: record.eventId || record.sourceEventId || "",
    eventType: record.eventType || record.sourceEventType || "",
    amountTotal: formatMinorUnitAmount(record.amountTotal, record.currency),
    opsProcessedAt: new Date().toISOString(),
    emailStatus: "pending",
    oblioInvoiceStatus: "de_emis"
  });
  var appendResult = appendRecordOnce("Payments", rowRecord, "sessionId", rowRecord.sessionId);
  if (appendResult.duplicate) {
    return {
      ok: true,
      type: "vip_fulfillment",
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
    type: "vip_fulfillment",
    sheet: "Payments",
    row: row,
    emailStatus: emailStatus
  };
}

function isConfirmedVipFulfillment(record) {
  return record &&
    record.fulfillmentStatus === "confirmed" &&
    record.paymentStatus === "paid" &&
    record.status === "complete" &&
    Boolean(record.sessionId);
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
    ? "Am salvat intentia ta VIP pentru AI Automation Zero to Hero"
    : "Locul tau prioritar este salvat pentru AI Automation Zero to Hero";
  var email = isVip ? vipIntentEmail(record) : freeLeadEmail(record);

  return sendEmail(record.email, subject, email.text, email.html);
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
  var bonusUrl = siteUrl + "/bonus.html";
  var text = [
    "Salut,",
    "",
    "Accesul tau VIP este confirmat.",
    "",
    vipGroupUrl
      ? "Intra in grupul WhatsApp AI WEBMINAR PRO pentru link, remindere si materialele premium:\n" + vipGroupUrl
      : "Pagina ta de confirmare VIP este aici:\n" + thankYouUrl,
    "",
    "Bonusul AI Process Audit Kit este aici:",
    bonusUrl,
    "",
    "Urmatorul pas este onboardingul, ca sa stim ce proces vrei sa aducem mai aproape de workshop:",
    thankYouUrl,
    "",
    "Calin"
  ].join("\n");
  var html = brandedEmail(
    "VIP confirmat",
    "Accesul tau VIP este confirmat.",
    "Salut. Plata a fost verificata si accesul premium este activ. De aici intri in zona in care nu mai discutam AI ca jucarie, ci ca sistem pe cazul tau.",
    [
      "Intra in grupul WhatsApp AI WEBMINAR PRO pentru link, remindere si materialele premium.",
      "Deschide bonusul AI Process Audit Kit si alege 3-5 procese pe care vrei sa le discutam.",
      "Completeaza onboardingul ca sa stim ce proces vrei sa aducem mai aproape de workshop.",
      "VIP include replay-uri, workbook complet, Implementation Lab si roadmap pe cazul tau.",
      "Pastreaza emailul acesta: dupa workshop il folosim ca reper pentru urmatorii pasi si pentru materialele promise."
    ],
    vipGroupUrl ? "Intra in AI WEBMINAR PRO" : "Deschide pagina de confirmare",
    vipGroupUrl || thankYouUrl,
    "AIWebminar by Calin Florea",
    "Deschide bonusul",
    bonusUrl
  );

  return sendEmail(record.email, "VIP confirmat - intra in grupul premium", text, html);
}

function freeLeadEmail(record) {
  var groupUrl = record.whatsappFreeGroupUrl || getProp("WHATSAPP_FREE_GROUP_URL", "");
  var siteUrl = getProp("PUBLIC_SITE_URL", "https://aiwebminar.pages.dev").replace(/\/+$/, "");
  var bonusUrl = siteUrl + "/bonus.html";
  var text = [
    "Salut, " + firstName(record.name) + ",",
    "",
    "Ai loc prioritar la workshopul AI Automation Zero to Hero.",
    "",
    "Bonusul AI Process Audit Kit + 30 idei de automatizari este aici:",
    bonusUrl,
    "",
    "Intra in grupul WhatsApp AI WEBMINAR FREE pentru link, anunturi si remindere:",
    groupUrl || "[link grup WhatsApp]",
    "",
    "Cand confirmam datele sesiunilor, primesti detaliile pe email si in grup.",
    "",
    "Calin"
  ].join("\n");
  var html = brandedEmail(
    "Inscriere confirmata",
    "Locul tau prioritar este salvat.",
    "Salut, " + firstName(record.name) + ". Esti pe lista pentru workshopul AI Automation Zero to Hero. Bonusul tau este AI Process Audit Kit + 30 idei de automatizari pentru business.",
    [
      "Intra in grupul WhatsApp AI WEBMINAR FREE pentru link, anunturi si remindere.",
      "Deschide bonusul si noteaza 3-5 procese repetitive din businessul tau.",
      "Vei vedea demo-uri live cu Claude Desktop, skills, agent specializat si orchestrator.",
      "O sa legam exemplele de nevoi reale: lead-uri, follow-up, research, continut si operatiuni.",
      "Cand confirmam datele sesiunilor, primesti detaliile pe email si in grup.",
      "Daca vrei sa lucrezi mai aplicat pe cazul tau, VIP-ul adauga replay-uri, workbook complet si Implementation Lab."
    ],
    "Intra in AI WEBMINAR FREE",
    groupUrl,
    "AIWebminar by Calin Florea",
    "Deschide bonusul",
    bonusUrl
  );
  return { text: text, html: html };
}

function vipIntentEmail(record) {
  var checkoutUrl = String(record.checkoutUrl || "").trim();
  var price = vipPriceLabel();
  var siteUrl = getProp("PUBLIC_SITE_URL", "https://aiwebminar.pages.dev").replace(/\/+$/, "");
  var bonusUrl = siteUrl + "/bonus.html";
  var paymentLines = checkoutUrl
    ? [
      "Finalizeaza plata VIP de " + price + " prin Stripe aici:",
      checkoutUrl
    ]
    : [
      "Plata VIP de " + price + " se finalizeaza prin Stripe imediat ce activam checkout-ul pe SRL."
    ];

  var text = [
    "Salut, " + firstName(record.name) + ",",
    "",
    "Am salvat intentia ta pentru VIP Implementation Lab.",
    "",
    paymentLines.join("\n"),
    "",
    "Bonusul AI Process Audit Kit este disponibil aici:",
    bonusUrl,
    "",
    "Dupa plata, primesti acces la grupul WhatsApp AI WEBMINAR PRO, replay-uri, workbook complet si Implementation Lab.",
    "",
    "Calin"
  ].join("\n");
  var html = brandedEmail(
    "VIP Implementation Lab",
    "Cererea ta VIP este salvata.",
    "Salut, " + firstName(record.name) + ". Am salvat intentia ta pentru VIP Implementation Lab. Asta este partea pentru oamenii care nu vor doar sa asiste, ci vor sa plece cu un plan clar pentru cazul lor.",
    [
      "Investitie: " + price + ". Plata se proceseaza in RON; pentru diaspora banca face conversia automat.",
      "Bonusul AI Process Audit Kit este disponibil acum: foloseste-l ca sa alegi procesul pe care vrei sa-l aduci in VIP.",
      "Dupa plata primesti acces la grupul WhatsApp AI WEBMINAR PRO, replay-uri, workbook complet si Implementation Lab.",
      "Scopul este sa pleci cu un roadmap de implementare pe cazul tau, nu doar cu idei frumoase.",
      "In VIP ne uitam la Workflow Brief, Skill Card, Agent Role Card, verificari si ce merita dus mai departe.",
      "Daca ai deja o idee, o aduci. Daca nu ai, o construim din durerea reala: timp pierdut, follow-up, research, operatiuni sau continut."
    ],
    checkoutUrl ? "Continua la plata VIP" : "Deschide pagina workshopului",
    checkoutUrl || siteUrl,
    "AIWebminar by Calin Florea",
    "Deschide bonusul",
    bonusUrl
  );
  return { text: text, html: html };
}

function sendEmail(to, subject, body, htmlBody) {
  try {
    var payload = {
      to: to,
      subject: subject,
      body: body,
      name: getProp("SENDER_NAME", "Calin Florea")
    };
    if (htmlBody) {
      payload.htmlBody = htmlBody;
    }
    MailApp.sendEmail(payload);
    return "sent";
  } catch (error) {
    return "error:" + String(error && error.message ? error.message : error).slice(0, 120);
  }
}

function brandedEmail(kicker, title, intro, bullets, ctaLabel, ctaUrl, footerBrand, secondaryCtaLabel, secondaryCtaUrl) {
  var list = (bullets || []).map(function(item) {
    return [
      "<li style=\"margin:0 0 12px 0;color:#dfe8ef;line-height:1.55;font-size:16px;\">",
      escapeHtml(item),
      "</li>"
    ].join("");
  }).join("");
  var cta = ctaUrl ? [
    "<a href=\"", escapeAttr(ctaUrl), "\" style=\"display:inline-block;background:#58b7ae;color:#10231f;text-decoration:none;",
    "font-weight:800;border-radius:8px;padding:15px 22px;margin-top:10px;\">",
    escapeHtml(ctaLabel || "Deschide"),
    "</a>"
  ].join("") : "";
  var secondaryCta = secondaryCtaUrl ? [
    "<a href=\"", escapeAttr(secondaryCtaUrl), "\" style=\"display:inline-block;border:1px solid #58b7ae;color:#dff7f3;text-decoration:none;",
    "font-weight:800;border-radius:8px;padding:14px 20px;margin-top:10px;margin-left:10px;\">",
    escapeHtml(secondaryCtaLabel || "Deschide bonusul"),
    "</a>"
  ].join("") : "";

  return [
    "<div style=\"margin:0;padding:0;background:#111417;font-family:Arial,Helvetica,sans-serif;color:#eef4f5;\">",
    "<div style=\"max-width:640px;margin:0 auto;padding:22px 12px;\">",
    "<div style=\"background:#1d2025;border:1px solid #2f3d39;border-radius:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.28);\">",
    "<div style=\"background:#cfe7e1;color:#101820;padding:28px 34px;\">",
    "<div style=\"font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#2f665f;font-weight:800;\">AIWebminar</div>",
    "<div style=\"font-size:26px;line-height:1.15;font-weight:900;margin-top:10px;\">Workflow-uri AI controlabile pentru business real</div>",
    "</div>",
    "<div style=\"padding:34px 34px 28px;\">",
    "<div style=\"font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6dc8bd;font-weight:900;margin-bottom:14px;\">",
    escapeHtml(kicker || "Confirmare"),
    "</div>",
    "<h1 style=\"font-size:34px;line-height:1.12;margin:0 0 20px;color:#ffffff;\">", escapeHtml(title), "</h1>",
    "<p style=\"font-size:18px;line-height:1.62;margin:0 0 24px;color:#dfe8ef;\">", escapeHtml(intro), "</p>",
    list ? "<ul style=\"padding-left:24px;margin:0 0 22px;\">" + list + "</ul>" : "",
    cta,
    secondaryCta,
    "<div style=\"border-top:1px solid #30363d;margin-top:30px;padding-top:22px;color:#aab6c2;font-size:14px;line-height:1.55;\">",
    "Diferenta dintre un prompt simpatic si un sistem AI util? 15 ani de experienta in sisteme care nu au voie sa cada.",
    "<br><strong style=\"color:#ffffff;\">", escapeHtml(footerBrand || "Calin Florea"), "</strong>",
    "</div>",
    "</div>",
    "</div>",
    "</div>",
    "</div>"
  ].join("");
}

function vipPriceLabel() {
  return getProp("VIP_PRICE_LABEL", "100 RON / aprox. 20 EUR");
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

function formatMinorUnitAmount(value, currency) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "";
  }

  var amount = Number(value);
  if (!isFinite(amount)) {
    return value;
  }

  var zeroDecimalCurrencies = {
    bif: true,
    clp: true,
    djf: true,
    gnf: true,
    jpy: true,
    kmf: true,
    krw: true,
    mga: true,
    pyg: true,
    rwf: true,
    ugx: true,
    vnd: true,
    vuv: true,
    xaf: true,
    xof: true,
    xpf: true
  };
  var normalizedCurrency = String(currency || "").toLowerCase();
  var decimals = zeroDecimalCurrencies[normalizedCurrency] ? 0 : 2;
  var majorAmount = decimals ? amount / Math.pow(10, decimals) : amount;
  var formatted = majorAmount.toFixed(decimals);

  return formatted.indexOf(".") === -1 ? formatted : formatted.replace(/\.?0+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
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
