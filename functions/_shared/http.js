const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
}

export function methodNotAllowed() {
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}

export async function readJson(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 16000) {
    throw new Error("payload_too_large");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("invalid_content_type");
  }

  return request.json();
}

export async function postWebhook(url, payload) {
  if (!url) {
    return { skipped: true };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  return {
    ok: response.ok,
    status: response.status
  };
}

export function getBaseUrl(request, env) {
  if (env.PUBLIC_SITE_URL) {
    return env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  }

  const url = new URL(request.url);
  return url.origin;
}

export function buildPaymentLink(paymentLinkUrl, payload) {
  if (!paymentLinkUrl) {
    return "";
  }

  const url = new URL(paymentLinkUrl);
  if (payload.leadId) {
    url.searchParams.set("client_reference_id", payload.leadId);
    url.searchParams.set("lead_id", payload.leadId);
  }

  return url.toString();
}

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  if (digits.startsWith("0")) {
    return `40${digits.slice(1)}`;
  }
  return digits;
}

export function buildReminderLinks({ phone, name, access, freeGroupUrl, vipGroupUrl }) {
  const normalizedPhone = normalizePhone(phone);
  const groupUrl = access === "vip" ? vipGroupUrl : freeGroupUrl;
  const firstName = String(name || "").trim().split(/\s+/)[0] || "Salut";
  const message = `${firstName}, ai loc prioritar la workshopul Agenti AI 24/7. Intra in grupul WhatsApp pentru link, remindere si anunturi: ${groupUrl || "[link grup WhatsApp]"}`;
  const encoded = encodeURIComponent(message);

  return {
    reminderMessage: message,
    smsReminderUrl: normalizedPhone ? `sms:+${normalizedPhone}?body=${encoded}` : "",
    whatsappReminderUrl: normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encoded}` : ""
  };
}

export function cleanText(value, max = 500) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

export function cleanLongText(value, max = 2000) {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }
  return email;
}

export function cleanPhone(value) {
  const phone = String(value || "").trim().slice(0, 32);
  if (!/^[+()\d\s.-]{7,32}$/.test(phone)) {
    return "";
  }
  return phone;
}

export function cleanEnum(value, allowed, fallback = "") {
  const text = String(value || "").trim();
  return allowed.includes(text) ? text : fallback;
}

export function cleanUrl(value) {
  const raw = String(value || "").trim().slice(0, 500);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch (error) {
    return "";
  }
}

export function cleanUtm(value) {
  const input = value && typeof value === "object" ? value : {};
  const allowed = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "fbclid",
    "gclid",
    "gcpc"
  ];

  return allowed.reduce((acc, key) => {
    if (input[key]) {
      acc[key] = cleanText(input[key], 300);
    }
    return acc;
  }, {});
}
