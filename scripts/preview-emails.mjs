import { mkdir, writeFile } from "node:fs/promises";

const outputDir = "email-previews";

const fixtures = {
  free: {
    filename: "free-confirmation.html",
    subject: "Locul tau prioritar este salvat pentru Agenti AI 24/7",
    html: freeLeadEmail({
      name: "Codex",
      whatsappFreeGroupUrl: "https://chat.whatsapp.com/EW4SB9Fkp8wKYzfu9lNDVQ?mode=gi_t"
    }).html
  },
  vipIntent: {
    filename: "vip-intent.html",
    subject: "Am salvat intentia ta VIP pentru Agenti AI 24/7",
    html: vipIntentEmail({
      name: "Codex",
      checkoutUrl: "https://buy.stripe.com/test_6oU5kG3zIdNs2vPdff38400"
    }).html
  },
  vipConfirmed: {
    filename: "vip-confirmed.html",
    subject: "VIP confirmat - intra in AI WEBMINAR PRO",
    html: brandedEmail(
      "VIP confirmat",
      "Accesul tau VIP este confirmat.",
      "Salut. Plata a fost verificata si accesul premium este activ. De aici intri in zona in care nu mai discutam AI ca jucarie, ci ca sistem pe cazul tau.",
      [
        "Intra in grupul WhatsApp AI WEBMINAR PRO pentru link, remindere si materialele premium.",
        "Completeaza onboardingul ca sa stim ce proces vrei sa aducem mai aproape de workshop.",
        "VIP include replay-uri, workbook, Implementation Lab si roadmap pe cazul tau.",
        "Pastreaza emailul acesta: dupa workshop il folosim ca reper pentru urmatorii pasi si pentru materialele promise."
      ],
      "Intra in AI WEBMINAR PRO",
      "https://chat.whatsapp.com/H7yC64b2LzYDtNFORKcveZ?mode=gi_t",
      "AIWebminar by Calin Florea"
    )
  }
};

await mkdir(outputDir, { recursive: true });

for (const preview of Object.values(fixtures)) {
  await writeFile(`${outputDir}/${preview.filename}`, preview.html, "utf8");
}

await writeFile(`${outputDir}/index.html`, previewIndex(Object.values(fixtures)), "utf8");

console.log(`Email previews generated in ${outputDir}/index.html`);

function freeLeadEmail(record) {
  const groupUrl = record.whatsappFreeGroupUrl || "";
  const html = brandedEmail(
    "Inscriere confirmata",
    "Locul tau prioritar este salvat.",
    `Salut, ${firstName(record.name)}. Esti pe lista pentru workshopul Agenti AI 24/7. Nu e un webinar despre prompturi dragute, ci despre cum incepi sa gandesti agenti AI care fac treaba cap-coada.`,
    [
      "Intra in grupul WhatsApp AI WEBMINAR FREE pentru link, anunturi si remindere.",
      "Vei vedea demo-uri live cu agenti AI, browser automation si workflow-uri multi-agent.",
      "O sa legam exemplele de nevoi reale: business, job, consultanta, research, continut si procese repetitive.",
      "Cand confirmam datele sesiunilor, primesti detaliile pe email si in grup.",
      "Daca vrei sa lucrezi mai aplicat pe cazul tau, VIP-ul adauga replay-uri, workbook si Implementation Lab."
    ],
    "Intra in AI WEBMINAR FREE",
    groupUrl,
    "AIWebminar by Calin Florea"
  );
  return { html };
}

function vipIntentEmail(record) {
  const checkoutUrl = String(record.checkoutUrl || "").trim();
  const price = "100 RON / aprox. 20 EUR";
  const html = brandedEmail(
    "VIP Implementation Lab",
    "Cererea ta VIP este salvata.",
    `Salut, ${firstName(record.name)}. Am salvat intentia ta pentru VIP Implementation Lab. Asta este partea pentru oamenii care nu vor doar sa asiste, ci vor sa plece cu un plan clar pentru cazul lor.`,
    [
      `Investitie: ${price}. Plata se proceseaza in RON; pentru diaspora banca face conversia automat.`,
      "Dupa plata primesti acces la grupul WhatsApp AI WEBMINAR PRO, replay-uri, workbook si Implementation Lab.",
      "Scopul este sa pleci cu un roadmap de implementare pe cazul tau, nu doar cu idei frumoase.",
      "In VIP ne uitam la brief, context, pasi, verificari si unde merita cu adevarat sa pui un agent AI.",
      "Daca ai deja o idee, o aduci. Daca nu ai, o construim din durerea reala: timp pierdut, follow-up, research, operatiuni sau continut."
    ],
    checkoutUrl ? "Continua la plata VIP" : "Deschide pagina workshopului",
    checkoutUrl || "https://aiwebminar.pages.dev",
    "AIWebminar by Calin Florea"
  );
  return { html };
}

function brandedEmail(kicker, title, intro, bullets, ctaLabel, ctaUrl, footerBrand) {
  const list = (bullets || []).map((item) => [
    '<li style="margin:0 0 12px 0;color:#dfe8ef;line-height:1.55;font-size:16px;">',
    escapeHtml(item),
    "</li>"
  ].join("")).join("");
  const cta = ctaUrl ? [
    `<a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#58b7ae;color:#10231f;text-decoration:none;`,
    'font-weight:800;border-radius:8px;padding:15px 22px;margin-top:10px;">',
    escapeHtml(ctaLabel || "Deschide"),
    "</a>"
  ].join("") : "";

  return [
    '<div style="margin:0;padding:0;background:#111417;font-family:Arial,Helvetica,sans-serif;color:#eef4f5;">',
    '<div style="max-width:640px;margin:0 auto;padding:22px 12px;">',
    '<div style="background:#1d2025;border:1px solid #2f3d39;border-radius:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.28);">',
    '<div style="background:#cfe7e1;color:#101820;padding:28px 34px;">',
    '<div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#2f665f;font-weight:800;">AIWebminar</div>',
    '<div style="font-size:26px;line-height:1.15;font-weight:900;margin-top:10px;">Agenti AI 24/7 pentru business real</div>',
    "</div>",
    '<div style="padding:34px 34px 28px;">',
    '<div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6dc8bd;font-weight:900;margin-bottom:14px;">',
    escapeHtml(kicker || "Confirmare"),
    "</div>",
    `<h1 style="font-size:34px;line-height:1.12;margin:0 0 20px;color:#ffffff;">${escapeHtml(title)}</h1>`,
    `<p style="font-size:18px;line-height:1.62;margin:0 0 24px;color:#dfe8ef;">${escapeHtml(intro)}</p>`,
    list ? `<ul style="padding-left:24px;margin:0 0 22px;">${list}</ul>` : "",
    cta,
    '<div style="border-top:1px solid #30363d;margin-top:30px;padding-top:22px;color:#aab6c2;font-size:14px;line-height:1.55;">',
    "Diferenta dintre un prompt simpatic si un sistem AI util? 15 ani de experienta in sisteme care nu au voie sa cada.",
    `<br><strong style="color:#ffffff;">${escapeHtml(footerBrand || "Calin Florea")}</strong>`,
    "</div>",
    "</div>",
    "</div>",
    "</div>",
    "</div>"
  ].join("");
}

function previewIndex(previews) {
  const cards = previews.map((preview) => `
    <article>
      <h2>${escapeHtml(preview.subject)}</h2>
      <p>${escapeHtml(preview.filename)}</p>
      <a href="/email-previews/${escapeAttr(preview.filename)}">Open preview</a>
      <iframe src="/email-previews/${escapeAttr(preview.filename)}" title="${escapeAttr(preview.subject)}"></iframe>
    </article>
  `).join("");
  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIWebminar Email Previews</title>
  <style>
    body { margin: 0; background: #101316; color: #eef4f5; font-family: Arial, sans-serif; }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
    h1 { margin: 0 0 22px; font-size: clamp(2rem, 5vw, 4rem); line-height: 1; }
    article { margin: 0 0 28px; border: 1px solid #30363d; border-radius: 10px; padding: 18px; background: #181c20; }
    h2 { margin: 0 0 6px; font-size: 1.1rem; }
    p { margin: 0 0 12px; color: #aab6c2; }
    a { color: #82d4ca; font-weight: 800; }
    iframe { width: 100%; height: 780px; margin-top: 14px; border: 1px solid #30363d; border-radius: 8px; background: #111417; }
  </style>
</head>
<body>
  <main>
    <h1>AIWebminar Email Previews</h1>
    ${cards}
  </main>
</body>
</html>`;
}

function firstName(name) {
  return String(name || "Salut").trim().split(/\s+/)[0] || "Salut";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
