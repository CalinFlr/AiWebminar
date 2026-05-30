# Google Sheets, Make si flow operational

## Obiectiv

Conectam landing page-ul live la Google Sheets, astfel incat pagina sa poata salva lead-uri, onboarding si plati fara sa pierdem date. Make poate ramane in flow daca OAuth functioneaza curat, dar nu este obligatoriu pentru lansare.

Pagina Cloudflare live:

```text
https://aiwebminar.pages.dev
```

Endpointuri active:

```text
POST https://aiwebminar.pages.dev/api/lead
POST https://aiwebminar.pages.dev/api/onboarding
GET  https://aiwebminar.pages.dev/api/vip-access
POST https://aiwebminar.pages.dev/api/stripe-webhook
GET  https://aiwebminar.pages.dev/api/config
```

## Google Sheet

Nume recomandat:

```text
AIWebminar - Leads si Workshop Ops
```

Taburi:

- `Leads`
- `Onboarding`
- `Payments`
- `Reminders`

## Status 2026-05-17

Make este configurat pe proiect in `.codex/config.toml`, cu cheia API tinuta local in `.codex/.env`.

Webhook-uri create:

- Lead capture: hook `3055164`, scenario `5772179`, activ.
- Onboarding capture: hook `3055170`, scenario `5772193`, activ.
- Stripe payment capture: hook `3055171`, scenario `5772194`, creat dar inactiv.

Cloudflare Pages are setate secretele:

- `MAKE_LEAD_WEBHOOK_URL`
- `MAKE_ONBOARDING_WEBHOOK_URL`

Test live trecut:

- `POST /api/lead` raspunde `200` si apare executie in Make.
- `POST /api/onboarding` raspunde `200` si apare executie in Make.

Limitare temporara: scenariile active sunt momentan trigger-only. Ele accepta requesturile pentru demo, dar nu scriu inca in Google Sheets si nu trimit email. Make Free a blocat al treilea scenario activ cu `Maximum number of active scenarios has been exceeded`, deci payment ramane inactiv pana la upgrade sau pana consolidam flow-ul.

Blocaj real: conexiunea Google incercata prin API nu primeste access token (`No access token specified`), iar OAuth-ul Google prin Make a afisat mesaj de app blocat. Nu adaugam platforme platite multiple ca workaround.

Directia recomandata dupa blocaj:

```text
Landing page -> Cloudflare Functions -> Google Apps Script -> Google Sheets + email basic
Stripe -> Cloudflare webhook verificat -> Google Apps Script -> Payments + email VIP
```

Make ramane optional dupa lansare. Daca il folosim, il consolidam intr-un singur scenario cu router, ca sa nu depindem de trei scenarii active pe planul Free.

Reguli pentru varianta Apps Script:

- Browserul nu trimite niciodata direct in Apps Script; apeleaza doar Cloudflare.
- Cloudflare trimite catre Apps Script cu secret/HMAC server-side.
- Apps Script raspunde cu JSON `ok: true` doar dupa ce randul a fost scris in Sheets; Cloudflare verifica explicit acest camp.
- Emailurile basic pot pleca prin `MailApp`/`GmailApp`, fara OAuth Google prin Make.
- Daca volumul sau livrabilitatea cer upgrade, alegem o singura solutie de email dedicata, nu mai multe servicii paralele.

Implementare pregatita:

- Cloudflare are suport pentru `GOOGLE_OPS_WEBHOOK_URL` si `GOOGLE_OPS_WEBHOOK_SECRET`.
- Daca `GOOGLE_OPS_WEBHOOK_URL` este setat, `/api/lead`, `/api/onboarding` si `/api/stripe-webhook` trimit acolo.
- Daca Apps Script nu este setat, endpointurile folosesc in continuare webhookurile Make existente ca fallback de demo.
- Codul de lipit in Apps Script este in `LandigPage/functions/_ops/google-apps-script/Code.gs`.

## Analiza blocaj Google OAuth

Mesajul vazut in browser:

```text
This app is blocked.
This app tried to access sensitive info in your Google Account.
To keep your account safe, Google blocked this access.
```

Concluzie: problema nu este formularul din landing page si nu este Cloudflare. Este pe zona Google OAuth, cel mai probabil din cauza scope-urilor sensibile/restrictionate cerute de conexiunea Google prin Make sau din cauza politicilor contului Google/Workspace.

Ce spune documentatia Google:

- Aplicatiile care cer scope-uri sensibile sau restrictionate pot avea nevoie de verificare Google inainte sa primeasca acces.
- Google recomanda folosirea celui mai ingust scope posibil.
- Pentru uz personal/testing exista exceptii, dar aplicatia poate afisa ecran de “unverified app”.
- Pentru Google Workspace, administratorul poate bloca sau permite aplicatii third-party din `Security -> Access and data control -> API controls`.
- Pentru date detinute de aplicatie, Google recomanda service accounts/server-to-server; aici se evita consimtamantul fiecarui user.

Implicatie pentru noi: Make + Google OAuth poate functiona manual daca folosim modulul oficial si scope-uri inguste, dar nu este suficient de predictibil ca sa fie blocker de lansare.

## Test manual Make, daca vrem sa confirmam

Scopul testului este doar sa vedem daca Make poate primi autorizare curata, nu sa reconstruim tot flow-ul acolo.

Pasi:

1. In Make, creeaza un scenario nou de test, nu modifica flow-ul live.
2. Adauga `Webhooks -> Custom webhook`.
3. Adauga `Google Sheets -> Add a Row`.
4. Cand Make cere conexiune Google, foloseste conexiunea oficiala din UI, nu conexiunea creata prin API.
5. Nu adauga Gmail in acelasi test; testam doar Sheets ca sa reducem scope-urile.
6. Daca Google arata scope-uri de Drive/Sheets si permite accesul, testul e trecut.
7. Daca apare din nou `This app is blocked`, inchidem ruta Make-Google pentru v1 production.

Interpretare:

- Daca merge Sheets manual: putem decide intre Make cu un singur scenario consolidat si Apps Script.
- Daca nu merge Sheets manual: folosim Apps Script/Cloudflare si nu mai pierdem timp cu Make OAuth.
- Daca merge Sheets dar Gmail blocheaza: pastram Sheets prin Make, dar emailul il trimitem prin Apps Script `MailApp` sau il amanam.

## Ruta recomandata fara platforme extra

Varianta stabila pentru v1:

```text
Formular lead
  -> Cloudflare /api/lead
  -> Apps Script doPost(type=lead)
  -> Google Sheets Leads
  -> MailApp email confirmare

Onboarding
  -> Cloudflare /api/onboarding
  -> Apps Script doPost(type=onboarding)
  -> Google Sheets Onboarding

Stripe webhook
  -> Cloudflare /api/stripe-webhook verifica semnatura Stripe
  -> Apps Script doPost(type=payment)
  -> Google Sheets Payments
  -> MailApp email VIP
```

De ce e corect pentru v1:

- Avem doar Cloudflare + Google + Stripe + Oblio, adica platformele deja asumate.
- Lead-urile nu depind de un OAuth third-party intre Make si Google.
- Userul final nu vede OAuth si nu autorizeaza nimic.
- Endpointul Apps Script nu este expus in browser; este apelat server-side de Cloudflare.
- Cloudflare poate semna payloadul cu un secret, iar Apps Script refuza requesturile fara semnatura.
- Emailul prin `MailApp` are scope mai mic decat `GmailApp`, pentru ca trimite email dar nu citeste inboxul.

Limite cunoscute Apps Script:

- `MailApp` are cote zilnice: aproximativ 100 recipienti/zi pe cont consumer si 1.500 recipienti/zi pe Google Workspace.
- Executia Apps Script are limita de aproximativ 6 minute per request.
- Pentru volumul nostru initial, aceste limite sunt acceptabile.
- Daca depasim volumele, primul upgrade logic este Google Workspace sau o singura solutie dedicata de email, nu un lant nou de platforme.

## Tab Leads

Coloane:

```text
serverReceivedAt
leadId
status
access
name
email
phone
persona
createdAt
pageUrl
utm_source
utm_medium
utm_campaign
utm_content
utm_term
utm_id
fbclid
gclid
gcpc
checkoutUrl
whatsappFreeGroupUrl
reminderMessage
smsReminderUrl
whatsappReminderUrl
opsProcessedAt
emailStatus
notes
```

Webhook Make pentru lead-uri:

```text
Custom webhook -> Google Sheets Add Row -> Gmail Send Email -> Webhook response 200
```

Regula importanta: webhook-ul trebuie sa raspunda 2xx doar dupa ce randul a fost salvat in Google Sheets.

Email free recomandat:

```text
Subiect: Locul tau prioritar este salvat pentru Agenti AI 24/7

Salut, {{name}},

Ai loc prioritar la workshopul Agenti AI 24/7.

Intra in grupul WhatsApp gratuit pentru link, anunturi si remindere:
{{whatsappFreeGroupUrl}}

Cand confirmam datele sesiunilor, primesti detaliile pe email si in grup.

Calin
```

Email VIP intent recomandat, pana Stripe este activ:

```text
Subiect: Am salvat intentia ta VIP pentru Agenti AI 24/7

Salut, {{name}},

Am salvat intentia ta pentru VIP Implementation Lab.

Plata VIP de 100 RON se finalizeaza prin Stripe imediat ce activam checkout-ul pe SRL. Dupa plata, primesti acces la grupul WhatsApp VIP, replay-uri, workbook si Implementation Lab.

Calin
```

## Tab Onboarding

Coloane:

```text
serverReceivedAt
onboardingId
leadId
signupEmail
access
persona
stripeSessionId
automationIdea
currentTools
publicLink
desiredOutcome
createdAt
opsProcessedAt
notes
```

Webhook Make pentru onboarding:

```text
Custom webhook -> Google Sheets Add Row -> Webhook response 200
```

Email optional onboarding:

```text
Subiect: Am primit cazul tau pentru workshop

Salut,

Am primit raspunsurile tale de onboarding. Le folosim pentru exemple, hot seats si follow-up in jurul workshopului.

Calin
```

## Tab Payments

Coloane:

```text
serverReceivedAt
eventId
eventType
created
sessionId
leadId
email
amountTotal
currency
paymentStatus
status
paymentLinkId
customerId
opsProcessedAt
emailStatus
oblioInvoiceStatus
notes
```

Webhook Make pentru plati:

```text
Stripe webhook Cloudflare -> Make payment webhook -> Google Sheets Add Row -> Gmail VIP Email -> Webhook response 200
```

Email VIP dupa plata:

```text
Subiect: VIP confirmat - intra in grupul premium

Salut,

Accesul tau VIP este confirmat.

Intra in grupul WhatsApp VIP pentru link, remindere si materialele premium:
{{whatsappVipGroupUrl}}

Urmatorul pas este onboardingul, ca sa stim ce proces vrei sa aducem mai aproape de workshop:
https://aiwebminar.pages.dev/thank-you.html?access=vip&session_id={{sessionId}}

Calin
```

## Tab Reminders

Coloane:

```text
createdAt
leadId
name
email
phone
access
persona
channel
message
actionUrl
status
lastSentAt
owner
notes
```

Statusuri:

```text
de_trimis
trimis
nu_raspunde
eroare
```

Pentru SMS semi-manual, `actionUrl` poate fi link `sms:` generat de Cloudflare.

Pentru WhatsApp semi-manual, `actionUrl` poate fi link `wa.me` generat de Cloudflare.

## Cloudflare vars dupa Apps Script / Make

Variabile:

```text
GOOGLE_OPS_WEBHOOK_URL
GOOGLE_OPS_WEBHOOK_SECRET
MAKE_LEAD_WEBHOOK_URL
MAKE_ONBOARDING_WEBHOOK_URL
MAKE_PAYMENT_WEBHOOK_URL
```

Status:

- `GOOGLE_OPS_WEBHOOK_URL`: neconfigurat pana deployam Apps Script.
- `GOOGLE_OPS_WEBHOOK_SECRET`: neconfigurat pana deployam Apps Script.
- `MAKE_LEAD_WEBHOOK_URL`: setat in Cloudflare.
- `MAKE_ONBOARDING_WEBHOOK_URL`: setat in Cloudflare.
- `MAKE_PAYMENT_WEBHOOK_URL`: nu se foloseste inca; scenario payment este creat, dar inactiv pe limita Make Free.

Comenzi:

```bash
npx wrangler pages secret put GOOGLE_OPS_WEBHOOK_URL --project-name=aiwebminar
npx wrangler pages secret put GOOGLE_OPS_WEBHOOK_SECRET --project-name=aiwebminar
npx wrangler pages secret put MAKE_LEAD_WEBHOOK_URL --project-name=aiwebminar
npx wrangler pages secret put MAKE_ONBOARDING_WEBHOOK_URL --project-name=aiwebminar
npx wrangler pages secret put MAKE_PAYMENT_WEBHOOK_URL --project-name=aiwebminar
```

## Test dupa conectare

1. Completeaza formular free pe pagina live.
2. Verifica rand nou in `Leads`.
3. Verifica email de confirmare.
4. Verifica thank-you free.
5. Completeaza onboarding.
6. Verifica rand nou in `Onboarding`.
7. Daca Stripe nu e conectat inca, VIP ramane doar intentie salvata.
