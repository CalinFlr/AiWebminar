# Stripe Security Audit Checklist

## Dashboard

- Payment Link-ul VIP trebuie sa aiba pretul de `100 RON`, moneda `RON`, produsul corect si redirect dupa plata catre `/thank-you.html?access=vip&session_id={CHECKOUT_SESSION_ID}`.
- Webhook-ul Stripe live trebuie sa trimita doar evenimentele necesare: `checkout.session.completed`, `checkout.session.async_payment_succeeded` si `checkout.session.async_payment_failed`.
- Webhook endpoint-ul trebuie sa fie URL-ul final fara redirecturi: `/api/stripe-webhook`.
- Verifica in Workbench ca ultimele livrari webhook au status `2xx`; pentru livrari failed, foloseste resend sau reconcilierea de mai jos.
- Activeaza email receipts/invoice PDF in Stripe doar ca dovada pentru client; accesul VIP ramane bazat pe webhook + D1 fulfillment, nu pe email.

## Cloudflare

- Secrets obligatorii: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINK_ID`, `ADMIN_EXPORT_TOKEN`.
- Vars obligatorii: `EXPECTED_VIP_AMOUNT=10000`, `EXPECTED_VIP_CURRENCY=ron`, `PUBLIC_SITE_URL`.
- Ruleaza migratia D1 `0003_vip_fulfillments.sql` inainte de trafic platit.
- `WHATSAPP_VIP_GROUP_URL` ramane secret/env, nu in repo.

## Verificare

- Ruleaza `npm run test:security` inainte de deploy.
- Ruleaza un test Stripe card in test mode si confirma ca `/api/export?type=vip_fulfillments` contine o singura linie pentru sesiunea platita.
- Ruleaza `npm run reconcile:stripe` dupa primele plati reale si dupa orice incident webhook.
- In WhatsApp, pastreaza `Approve new members` activ pentru grupul VIP.
