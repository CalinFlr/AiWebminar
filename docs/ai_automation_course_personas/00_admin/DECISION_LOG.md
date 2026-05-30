# Decision Log

## 2026-05-21 — Webinar VIP-first, proof si decizii pentru etapa urmatoare

### Decizii aprobate

- Landingul si webinarul se pozitioneaza VIP-first pentru owneri de business.
- Mesajul central devine: de la ChatGPT folosit ocazional la primul workflow AI controlabil pentru business.
- Tonul poate fi sales agresiv, dar ramane credibil: ROI estimativ, scenarii demonstrative, proof si diferentiere prin control.
- Nu stabilim inca data/ora webinarului si nu hardcodam data/ora in landing pana cand sunt finale.
- Nu folosim testimoniale inventate, rezultate garantate, countdown fals sau scarcity artificial.
- Comparatia cu competitia ramane implicita: contrastam "autopilot magic" cu proces mapat, reguli, verificare si human-in-the-loop.
- VIP ramane oferta principala pe landing la 100 RON / aprox. 20 EUR.
- Free ramane fallback valid: acces live + bonusul AI Process Audit Kit + 30 idei.
- Bonusul de inscriere devine AI Process Audit Kit + 30 idei de automatizari.
- Scenariile principale pentru proof sunt fitness trainer si cabinet/clinica, marcate ca scenarii demonstrative, nu rezultate reale.
- Pentru clinica/cabinet folosim doar procese non-sensibile si date publice/generice.
- Autoritatea se comunica prin 15+ ani in sisteme enterprise + practica reala de AI builder, fara nume de clienti/companii.
- Preturile pentru oferta mare de dupa webinar nu apar pe landing.
- Programul final devine: Ziua 1 Setup + Business OS in Claude, Ziua 2 Skills + agent specializat, Ziua 3 Agenti specializati + orchestrator, Ziua 4 VIP Implementation Lab.
- Duratele oficiale sunt 90 min + Q&A, 90 min + Q&A, 105 min + buffer si 90 min VIP separat.
- Tool principal: Claude Desktop, cu fallback in Claude/ChatGPT browser daca instalarea esueaza.
- DentalNovo/cabinet local se foloseste doar anonim pana la decizie explicita, fara date pacienti.
- Replay-urile sunt beneficiu VIP, nu free.

### Decizii deschise pentru viitor

- Data, ora, durata exacta si platforma live.
- Calendarul complet de email/WhatsApp reminders.
- Ce scenarii demonstrative transformam in case studies reale dupa ce avem rezultate observabile.
- Oferta post-webinar finala: cohorta/curs, sprint de implementare, consultanta sau combinatie.
- Structura exacta a pitchului final si criteriile de recomandare pe profil.

Detalii complete: `docs/ai_automation_course_personas/04_marketing/09_WEBINAR_FUTURE_DECISIONS.md`.

## 2026-05-18 — WhatsApp groups si Google Sheet sync active

- Grupurile WhatsApp free si VIP sunt create initial pe numarul personal; numarul dedicat poate fi adaugat ulterior ca admin.
- Linkurile WhatsApp sunt configurate in Cloudflare secrets si sunt expuse doar prin flow-urile aprobate ale site-ului.
- Grupul VIP trebuie trecut pe `Approve new members` inainte de trafic platit.
- Google Apps Script este autorizat, `setupSheets` a rulat, iar sync-ul D1 -> Apps Script -> Google Sheet a fost testat cu succes.
- `SEND_EMAILS` poate fi pornit pentru test real de email, dar testele trebuie facute pe adrese controlate.
- Stripe MCP este configurat local pe proiect, nu global; cheia Stripe ramane in `.codex/.env`, ignorata de git.
- Emailurile Apps Script sunt acum branded HTML + plain-text fallback, pe tema AIWebminar.
- Pretul VIP se comunica drept `100 RON / aprox. 20 EUR`; Stripe proceseaza in RON, iar conversia pentru diaspora ramane la banca emitenta.
- Privacy page foloseste minimul decis: operator `Ana&Paul Tech SRL` si email de contact, fara CUI/adresa publicate in pagina.
- Trackingul GA4/Meta ramane consent-gated si include evenimente de funnel: free signup, VIP intent, begin checkout, onboarding si VIP purchase.

## 2026-05-18 — Cloudflare D1 ca ops primary dupa blocaj Google OAuth

### Decizie operationala

- Google OAuth a blocat din nou `clasp` cand a cerut scope-uri runtime pentru `spreadsheets` si `script.send_mail`.
- Pentru MVP functional, nu mai tinem Google Apps Script pe traseul critic.
- Cloudflare D1 devine sistemul operational primar pentru lead-uri, onboarding, plati si reminders.
- Apps Script/Google Sheet ramane creat si poate fi folosit ulterior pentru sync/export, dar nu blocheaza inscrierile.
- Make ramane fallback/sync optional, nu sursa de adevar.

### Implicatii

- `/api/lead`, `/api/onboarding` si `/api/stripe-webhook` salveaza in D1 cand bindingul `AIWEBMINAR_DB` exista.
- `/api/export` exporta CSV protejat cu `ADMIN_EXPORT_TOKEN`; pagina interna `/ops` descarca exporturile prin header `Authorization: Bearer`, fara token in URL.
- Stripe webhook are verificare de semnatura cu toleranta de 5 minute, validare de Payment Link/suma/moneda/client reference si idempotenta pe `event_id`.
- `vip-access` nu afiseaza linkul WhatsApp VIP fara `session_id` Stripe valid, plata completa, Payment Link corect, suma/moneda corecte si `client_reference_id`.
- Testul `npm run test:security` acopera gate-ul VIP si webhook-ul Stripe cu cazuri negative/pozitive.
- Emailurile automate prin MailApp raman amanate pana cand Google OAuth/Apps Script este autorizat stabil.
- WhatsApp si CSV operational acopera MVP-ul fara platforma platita suplimentara.

## 2026-05-17 — Flow minim stabil, fara platform sprawl

### Decizie aprobata

- Nu adaugam un lant de platforme platite doar ca sa ocolim blocajul Google OAuth din Make.
- Stack-ul tinta pentru v1 production ramane minim:
  - Cloudflare Pages + Functions pentru landing page, validari, webhookuri si protectia linkului VIP.
  - Google Sheets ca sistem operational pentru lead-uri, onboarding, plati si remindere.
  - Google Apps Script ca punte server-side intre Cloudflare si Google Sheets/Gmail, daca Make continua sa fie blocat de OAuth.
  - Stripe pe SRL pentru plata VIP.
  - Oblio pe SRL pentru facturare fiscala, initial manuala/semi-automata.
  - WhatsApp Business App pentru grupurile free si VIP.
- Make nu mai este tratat ca dependinta obligatorie pentru lansare. Ramane util ulterior pentru automatizari vizuale, dar nu trebuie sa blocheze salvarea lead-urilor.
- Emailul v1 poate pleca din Google Apps Script/GmailApp sau MailApp, controlat de contul nostru Google. Evitam Gmail OAuth prin Make daca acesta cere scope-uri sensibile si ramane blocat.
- Daca ulterior volumul creste sau livrabilitatea devine problema, alegem o singura solutie dedicata de email, nu mai multe servicii paralele.

### Implicatii tehnice

- Browserul continua sa trimita date doar catre endpointurile Cloudflare, nu direct catre Apps Script sau Google Sheets.
- Cloudflare trimite mai departe catre Apps Script cu secret/HMAC server-side, ca endpointul public Apps Script sa nu fie folosit direct de spammeri.
- Stripe webhook ramane verificat in Cloudflare inainte ca plata sa fie scrisa in Sheets sau sa fie trimis emailul VIP.
- Linkul WhatsApp VIP ramane protejat prin verificare Stripe, nu prin incredere in query params sau intr-un rand din Sheets.
- Daca testam manual Make, testam intai doar Google Sheets, fara Gmail, ca sa izolam problema de scope-uri.
- Daca Google blocheaza si conexiunea manuala Sheets din Make UI, inchidem Make pentru v1 production si implementam ruta Apps Script.
- Codul pentru ruta Apps Script este pregatit in `LandigPage/functions/_ops/google-apps-script`, iar Cloudflare poate folosi `GOOGLE_OPS_WEBHOOK_URL` cu fallback pe Make.

## 2026-05-17 — Landing page end-to-end

### Decizii aprobate

- Landing page-ul trece pe Cloudflare Pages; initial folosim URL-ul `pages.dev`, apoi legam domeniul custom.
- Stripe se creeaza pe SRL si proceseaza plata VIP de 100 RON.
- Oblio ramane sistemul de facturare fiscala pentru SRL; in v1 facturarea poate fi manuala sau semi-automata.
- Initial, lead-urile si onboardingul au fost planificate prin Make + Google Sheets; decizia este inlocuita de flow-ul minim stabil de mai sus daca Make OAuth ramane blocat.
- Initial, emailurile de confirmare si reminder au fost planificate prin Gmail/Workspace via Make; pentru v1 stabil, preferam `MailApp` prin Apps Script.
- WhatsApp foloseste numar dedicat cu WhatsApp Business App.
- Vor exista doua grupuri WhatsApp: unul gratuit si unul VIP.
- Linkul grupului VIP apare doar dupa plata verificata in Stripe.
- SMS-ul ramane semi-manual in v1: Google Sheets contine mesaj, link si status de trimitere.
- Pana cand datele workshopului sunt finale, copy-ul foloseste „loc prioritar”, nu „loc rezervat”.
- GDPR/tracking v1 este zero-friction: text mic sub formular, pagina de confidentialitate si cookie banner discret cu `Accept` / `Refuz`.
- GA4 si Meta Pixel se incarca doar dupa acceptul din cookie banner.

### Decizii operationale

- Pentru Stripe Payment Link, success URL trebuie configurat cu `session_id={CHECKOUT_SESSION_ID}` ca thank-you page sa poata verifica plata.
- Formularul nu trebuie sa confirme inscrierea daca endpointul `/api/lead` nu salveaza in sistemul operational activ: Apps Script/Sheets sau fallback Make.
- Browserul nu pastreaza email/telefon in `localStorage`; datele personale merg prin endpointurile Cloudflare catre Apps Script/Sheets sau fallback Make.
- Valorile sensibile se tin in Cloudflare environment variables, nu in HTML sau repo.
- Make API este configurat local pe proiect, nu global.
- Pentru demo, scenariile Make de lead si onboarding sunt active ca trigger-only si Cloudflare le foloseste deja.
- Pentru lansare reala, trigger-only nu este suficient: trebuie adaugate modulele Google Sheets/Gmail dupa autorizarea OAuth in Make.
- Make Free a permis doar doua scenarii active; payment scenario este creat dar ramane inactiv pana la upgrade sau redesign.

## 2026-04-26 — Structură inițială

### Decizii luate

- Cursul/webinarul va fi în română.
- Publicul este non-tehnic sau foarte puțin tehnic.
- Nivelul de intrare acceptat: persoana poate să nu știe nimic în afară de utilizare basic ChatGPT.
- Webinarul/challenge-ul va fi live și apoi înregistrat.
- Model de funnel: gratuit + zile premium low-ticket + pitch către curs mid/premium.
- Produsul premium va avea trasee/capitole pentru mai multe tipuri de cursanți.
- Claude și mai ales Claude Code vor fi folosite în webinar ca element de diferențiere și ca pitch către partea avansată.

### Decizii încă deschise

- Titlul final al webinarului.
- Titlul final al cursului premium.
- Prețul low-ticket pentru zilele premium.
- Prețul mid/premium pentru cursul complet.
- Prima industrie targetată în reclame, dacă se decide targetare pe industrie.
- Cât de mult include cursul partea de vânzare/consulting pentru Persona 2B.
- Tool-urile exacte: Claude, ChatGPT, Make, n8n, Zapier, Airtable, Notion, Google Sheets, OpenAI API, Lovable, Replit, Supabase, OpenClaw etc.

### Principiu strategic

Produsul poate fi larg, dar reclamele trebuie segmentate. Nu vindem „AI pentru toată lumea”. Vindem același program prin 3 unghiuri diferite: business, job, consulting.
