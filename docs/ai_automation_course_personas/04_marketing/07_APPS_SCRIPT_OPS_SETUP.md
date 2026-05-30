# Apps Script ops setup

## Obiectiv

Ruta stabila pentru v1:

```text
Landing page -> Cloudflare Functions -> Google Apps Script -> Google Sheets + MailApp
```

Make ramane fallback de demo si optiune pentru automatizari viitoare, dar nu mai blocheaza salvarea lead-urilor.

## Cod pregatit

Codul Apps Script este in repo:

```text
/Users/floreacalin/Developer/AiWebminar/LandigPage/functions/_ops/google-apps-script/Code.gs
/Users/floreacalin/Developer/AiWebminar/LandigPage/functions/_ops/google-apps-script/appsscript.json
```

Cloudflare foloseste doua variabile:

```text
GOOGLE_OPS_WEBHOOK_URL
GOOGLE_OPS_WEBHOOK_SECRET
```

Daca `GOOGLE_OPS_WEBHOOK_URL` este setat, endpointurile `/api/lead`, `/api/onboarding` si `/api/stripe-webhook` trimit catre Apps Script. Daca nu este setat, ramane fallback pe Make.

## Setup manual in Google

1. Creeaza Google Sheet:

```text
AIWebminar - Leads si Workshop Ops
```

2. Copiaza ID-ul spreadsheetului din URL.

3. In Google Sheet, mergi la `Extensions -> Apps Script`.

4. In `Code.gs`, lipeste continutul din:

```text
LandigPage/functions/_ops/google-apps-script/Code.gs
```

5. In Apps Script, activeaza manifestul:

```text
Project Settings -> Show appsscript.json manifest file in editor
```

6. In `appsscript.json`, lipeste continutul din:

```text
LandigPage/functions/_ops/google-apps-script/appsscript.json
```

7. In `Project Settings -> Script properties`, seteaza:

```text
SPREADSHEET_ID=[id-ul Google Sheet]
WEBHOOK_SECRET=[secret lung generat local]
PUBLIC_SITE_URL=https://aiwebminar.pages.dev
WHATSAPP_FREE_GROUP_URL=[link grup free, cand exista]
WHATSAPP_VIP_GROUP_URL=[link grup VIP, cand exista]
SENDER_NAME=Calin Florea
SEND_EMAILS=true
```

8. Ruleaza manual functia:

```text
setupSheets
```

Scop: creeaza taburile `Leads`, `Onboarding`, `Payments`, `Reminders` si declanseaza autorizarea Google pentru Sheets + MailApp.

9. Daca apare ecran de app neverificat, continua doar daca Google permite `Advanced -> Go to project`.

10. Daca apare din nou `This app is blocked`, problema este politica Google/Workspace pentru cont, nu Make. Atunci variantele corecte sunt allowlist in Google Admin sau service account/server-to-server.

11. Deploy:

```text
Deploy -> New deployment -> Select type: Web app
Execute as: Me
Who has access: Anyone
Deploy
```

12. Copiaza URL-ul care se termina in `/exec`.

## Setup Cloudflare

Seteaza acelasi secret in Cloudflare:

```bash
npx wrangler pages secret put GOOGLE_OPS_WEBHOOK_URL --project-name=aiwebminar
npx wrangler pages secret put GOOGLE_OPS_WEBHOOK_SECRET --project-name=aiwebminar
```

`GOOGLE_OPS_WEBHOOK_SECRET` trebuie sa fie identic cu `WEBHOOK_SECRET` din Apps Script.

Deploy dupa setarea secretelor:

```bash
npm run deploy:cloudflare
```

## Test

1. Completeaza formularul free pe pagina live.
2. Verifica rand nou in `Leads`.
3. Verifica randuri noi in `Reminders` pentru `sms` si `whatsapp`, daca telefonul exista.
4. Verifica emailul de confirmare.
5. Completeaza onboardingul din thank-you page.
6. Verifica rand nou in `Onboarding`.
7. Retrimite acelasi payload prin test/local daca e nevoie; `leadId`, `onboardingId` si `eventId` trebuie sa fie deduplicate, nu randuri noi cu emailuri noi.

## Observatii de securitate

- Browserul nu vede URL-ul Apps Script si nu vede secretul.
- Cloudflare trimite catre Apps Script un `signedPayload` si o semnatura HMAC.
- Apps Script respinge requesturile cu semnatura gresita sau mai vechi de 10 minute.
- Apps Script deduplica retry-urile dupa `leadId`, `onboardingId` si `eventId`.
- Apps Script Web Apps nu pot seta usor status HTTP custom, deci Cloudflare verifica explicit campul JSON `ok`.
- Linkul VIP ramane protejat de `/api/vip-access`, care verifica Stripe direct.
