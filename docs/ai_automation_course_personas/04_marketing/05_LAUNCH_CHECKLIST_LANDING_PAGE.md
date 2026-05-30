# Launch checklist landing page AI Automation

## Status curent

- Landing page-ul este pregatit pentru Cloudflare Pages cu Functions in `/api/*`.
- Formularul trimite lead-uri catre `/api/lead`; Cloudflare trimite mai departe catre Google Apps Script daca este configurat, altfel catre Make pentru demo.
- Onboardingul trimite raspunsuri catre `/api/onboarding`; acelasi fallback Apps Script -> Make este disponibil.
- VIP gate-ul verifica Stripe Checkout Session in `/api/vip-access`.
- Stripe webhook-ul marcheaza platile prin `/api/stripe-webhook`.
- Linkul WhatsApp VIP nu se afiseaza fara plata Stripe verificata.
- Cloudflare D1 este acum sistemul operational primar pentru lead-uri, onboarding, plati si reminders.
- Exporturile CSV sunt disponibile prin `/ops` sau `/api/export`, protejate cu `ADMIN_EXPORT_TOKEN`.
- D1 deduplica lead-urile dupa `leadId`, onboardingul dupa `onboardingId` si platile dupa `eventId`, ca retry-urile sa nu creeze randuri duplicate.
- Stripe webhook valideaza semnatura, Payment Link-ul, suma, moneda si `client_reference_id`; evenimentele duplicate nu mai pornesc sync secundar.
- Security smoke test: `npm run test:security`.
- Cloudflare production este live la `https://aiwebminar.pages.dev`.
- Make are scenarii active pentru lead si onboarding; ambele au fost testate live cu raspuns `200`.
- Make payment scenario este creat, dar inactiv pe limita Make Free de scenarii active.
- Google OAuth prin Make/clasp este blocat momentan de Google pentru scope-uri sensibile, deci Google Apps Script nu trebuie sa fie blocker pentru lansare.
- Directia preferata pentru un flow stabil si simplu acum: Cloudflare Pages -> Cloudflare D1 -> CSV/WhatsApp, cu Apps Script/Make optional ulterior.

## Setup manual necesar

### Cloudflare

- Autentificare cu `wrangler login`.
- Creare proiect Pages: `aiwebminar`.
- Setare variabile publice si secrete in Cloudflare.
- Legare domeniu custom dupa cumparare si configurare DNS.

### Ops storage, Google Sheets, email si automatizari

- Cloudflare D1 `aiwebminar_ops` este creat si legat prin bindingul `AIWEBMINAR_DB`.
- Emailurile de confirmare/intent/VIP confirmat sunt trimise prin Apps Script cu HTML branded si fallback plain text.
- Pretul afisat in emailuri si landing este `100 RON / aprox. 20 EUR`; Stripe incaseaza in RON.
- Taburile echivalente din D1:
  - `Leads`
  - `Onboarding`
  - `Payments`
  - `Reminders`
- Dashboard intern export CSV:

```text
https://aiwebminar.pages.dev/ops
```

- Endpointul `/api/export?type=leads|onboarding|payments|reminders` accepta tokenul prin header `Authorization: Bearer [ADMIN_EXPORT_TOKEN]`.
- Google Apps Script/Sheets ramane optional pentru sync ulterior, nu sursa primara.
- Daca Google este reactivat, Cloudflare poate apela Apps Script server-side cu secret/HMAC; browserul nu vede endpointul sau secretul.
- Codul Apps Script este pregatit in repo la `functions/_ops/google-apps-script/Code.gs`.
- Seteaza in Cloudflare:
  - `GOOGLE_OPS_WEBHOOK_URL`
  - `GOOGLE_OPS_WEBHOOK_SECRET`
- Webhook Make pentru lead-uri: creat, activ, setat in Cloudflare pentru demo.
- Webhook Make pentru onboarding: creat, activ, setat in Cloudflare pentru demo.
- Webhook Make pentru plati Stripe: creat, dar inactiv pe limita Make Free.
- Make ramane optional pentru v2 sau pentru automatizari vizuale dupa ce flow-ul principal functioneaza stabil.
- Pentru lansare reala, endpointul final trebuie sa confirme salvarea doar dupa ce datele au fost scrise in D1; Make/Apps Script sunt sync optional.

### Stripe pe SRL

- Stripe MCP local este configurat project-scoped in `.codex/config.toml`, prin wrapperul `.codex/bin/stripe-mcp`.
- Cheia Stripe nu se pune in repo; se tine local in `.codex/.env` ca `STRIPE_SECRET_KEY=sk_test_...`.
- Creeaza cont Stripe pe SRL.
- Creeaza produs/Payment Link: `VIP Implementation Lab`, 100 RON.
- Configureaza success URL:

```text
https://[cloudflare-pages-url]/thank-you.html?access=vip&session_id={CHECKOUT_SESSION_ID}
```

- `lead_id` ramane in Stripe ca `client_reference_id`; thank-you verifica sesiunea direct in Stripe.
- Query params de tip `payment=success` nu sunt tratati ca dovada de plata. Singura confirmare valida este `session_id={CHECKOUT_SESSION_ID}` verificat server-side.
- Seteaza in Cloudflare:
  - `STRIPE_PAYMENT_LINK_URL`
  - `STRIPE_PAYMENT_LINK_ID`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `EXPECTED_VIP_AMOUNT=10000`
  - `EXPECTED_VIP_CURRENCY=ron`
- Creeaza webhook Stripe catre:

```text
https://[cloudflare-pages-url]/api/stripe-webhook
```

- Evenimente Stripe:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`

### Oblio

- Facturarea fiscala ramane in Oblio.
- V1: emitere manuala/semi-automata pe baza randurilor din `Payments`.
- V2: Make poate apela Oblio API dupa confirmarea platii Stripe.

### WhatsApp si SMS

- Grupurile WhatsApp free si VIP sunt create initial pe numarul personal.
- Linkurile reale sunt setate in Cloudflare ca `WHATSAPP_FREE_GROUP_URL` si `WHATSAPP_VIP_GROUP_URL`; nu le stocam in repo.
- Cand numarul dedicat este cumparat, il adaugam in grupuri, il facem admin si decidem daca numarul personal ramane sau iese.
- Activeaza `Approve new members` pe grupul VIP inainte de trafic platit, ca protectie extra peste gate-ul Stripe.
- In `Reminders`, pastreaza statusuri:
  - `de_trimis`
  - `trimis`
  - `nu_raspunde`
  - `eroare`
- SMS v1 este semi-manual: Sheets contine mesaj pregatit si link `sms:`.

### Legal, tracking si pagina privacy

- `privacy.html` este completat minimalist cu operatorul `Ana&Paul Tech SRL` si email de contact.
- Creeaza GA4 si pune ID-ul in `GA4_MEASUREMENT_ID`.
- Creeaza Meta Pixel si pune ID-ul in `META_PIXEL_ID`.
- Trackingul porneste doar dupa `Accept` in cookie banner.
- Evenimentele funnel pregatite: `free_signup`, `vip_intent`, `begin_checkout`, `onboarding_submit`, `free_thank_you`, `vip_purchase`.

## Cloudflare environment variables

```text
PUBLIC_SITE_URL=
ADMIN_EXPORT_TOKEN=
GOOGLE_OPS_WEBHOOK_URL=
GOOGLE_OPS_WEBHOOK_SECRET=
MAKE_LEAD_WEBHOOK_URL=
MAKE_ONBOARDING_WEBHOOK_URL=
MAKE_PAYMENT_WEBHOOK_URL=
STRIPE_PAYMENT_LINK_URL=
STRIPE_PAYMENT_LINK_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EXPECTED_VIP_AMOUNT=10000
EXPECTED_VIP_CURRENCY=ron
WHATSAPP_FREE_GROUP_URL=
WHATSAPP_VIP_GROUP_URL=
GA4_MEASUREMENT_ID=
META_PIXEL_ID=
WORKSHOP_STATUS=tbd
WORKSHOP_LIVE_URL=
```

## Teste obligatorii inainte de trafic platit

- Free flow: formular -> D1 -> export CSV/reminders -> thank-you free -> grup WhatsApp free -> onboarding.
- VIP flow: formular -> Stripe test payment -> thank-you cu `session_id` -> `/api/vip-access` -> grup WhatsApp VIP.
- Negative VIP: acces direct cu `?access=vip`, `?payment=success` sau session gresit nu afiseaza link VIP.
- Retry/idempotenta: retrimiterea aceluiasi lead/onboarding/payment nu creeaza duplicate operationale in D1.
- Persistenta failure: daca Sheets/Apps Script/Make nu confirma salvarea, pagina afiseaza eroare si nu confirma inscrierea.
- Security smoke: `npm run test:security` trebuie sa treaca inainte de deploy.
- Cookie banner: GA4/Meta Pixel nu se incarca inainte de `Accept`.
- Mobile QA: 320, 390, 768 si desktop fara overlap.

## Blockere inainte de lansare reala

- Cont Stripe SRL creat si verificat.
- Flow-ul real de persistenta in D1 verificat dupa deploy.
- Linkuri WhatsApp reale create si setate in Cloudflare.
- Linkuri WhatsApp adaugate si in Apps Script properties daca vrem ca emailurile trimise direct de Apps Script sa le poata folosi independent de payload.
- Date firma completate minimalist in `privacy.html`.
- GA4 Measurement ID si Meta Pixel ID setate in Cloudflare inainte de ads.
- Success URL Stripe testat cu `session_id={CHECKOUT_SESSION_ID}`.
