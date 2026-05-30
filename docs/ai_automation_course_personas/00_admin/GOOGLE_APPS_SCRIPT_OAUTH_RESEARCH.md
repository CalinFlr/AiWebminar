# Google Apps Script OAuth Research

Data: 2026-05-18

## Context

Google Apps Script UI functioneaza pentru proiectul `AIWebminar - Leads si Workshop Ops`, dar `clasp run` ramane blocat cand incearca sa ceara scope-urile runtime pentru `spreadsheets` si `script.send_mail`.

## Ce recomanda Google in docs

### Web app

- Apps Script web apps trebuie sa expuna `doGet(e)` sau `doPost(e)`.
- Deploy-ul recomandat pentru un endpoint server-side este `Deploy -> New deployment -> Web app`.
- Pentru cazul nostru, setarea potrivita este `Execute as me`, ca scriptul sa ruleze sub owner si vizitatorii landing page-ului sa nu autorizeze Google.
- Access poate fi `Anyone`, dar endpointul trebuie protejat in cod. Noi folosim payload semnat/HMAC din Cloudflare.

Docs:
- https://developers.google.com/apps-script/guides/web

### Authorization si scopes

- Apps Script detecteaza automat serviciile folosite, de exemplu `SpreadsheetApp` si `MailApp`.
- Google recomanda scope-uri explicite in `appsscript.json`, mai ales pentru scripturi publicate, ca sa ceri minimul necesar.
- Daca apar servicii/scopes noi, ownerul trebuie sa ruleze manual o functie din editor ca sa declanseze promptul de autorizare.
- Scripturile cu sensitive scopes pot arata warning de app neverificat.

Docs:
- https://developers.google.com/apps-script/guides/services/authorization
- https://developers.google.com/apps-script/guides/client-verification

### Apps Script API / `scripts.run` / `clasp run`

- `scripts.run` permite executie remote, dar cere:
  - script deployat ca API executable;
  - OAuth token cu scope-uri corecte;
  - un standard Google Cloud project comun;
  - Apps Script API enabled.
- Clasp spune explicit ca `clasp run` cu runtime scopes este zona care cere “bring your own Google API credentials”.
- `clasp login --use-project-scopes --include-clasp-scopes` foloseste scope-urile din manifest, dar poate fi blocat de Google daca OAuth clientul default/clasp este tratat ca third-party sau browserul este nesigur.
- Clasp recomanda OAuth client propriu, tip `Desktop Application`, folosit cu `clasp login --creds <file>`.

Docs:
- https://developers.google.com/apps-script/api/how-tos/execute
- https://developers.google.com/apps-script/api/how-tos/enable
- https://github.com/google/clasp

### Browser blocked

- Google poate bloca sign-in-ul din browsere sau aplicatii considerate nesigure.
- Playwright/Chromium poate declansa blocajul “This browser or app may not be secure”.
- Autorizarea trebuie facuta din Chrome/Safari real sau din Apps Script editor.

Docs:
- https://support.google.com/accounts/answer/7675428

## Recomandare pentru MVP

Nu folosim `clasp run` pe ruta critica.

Ruta stabila:

1. Cloudflare D1 ramane sursa de adevar.
2. Apps Script ramane sync/email optional.
3. In Apps Script UI:
   - setezi Script Properties;
   - rulezi manual `setupSheets`;
   - accepti scope-urile o singura data;
   - deploy Web app `Execute as me`, `Anyone`.
4. Cloudflare trimite catre web app prin `GOOGLE_OPS_WEBHOOK_URL` si semneaza payloadul cu `GOOGLE_OPS_WEBHOOK_SECRET`.

## Recomandare pentru automatizare completa ulterior

Pentru a controla Apps Script complet din CLI/CI:

1. Creeaza un Google Cloud Project standard.
2. Activeaza Apps Script API.
3. Configureaza OAuth consent screen.
4. Creeaza OAuth client `Desktop Application`.
5. Foloseste `clasp login --creds <client_secret.json> --use-project-scopes --include-clasp-scopes`.
6. Pastreaza `.clasprc.json` si credentialele doar local/secrets, niciodata in repo.

Aceasta ruta este corecta pentru CI, dar nu merita sa blocheze MVP-ul acum.
