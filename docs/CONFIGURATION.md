# AiWebminar Configuration Contract

This repo keeps public landing assets, Cloudflare Pages Functions and local ops tools in one private monorepo. Cloudflare deploys only `apps/landing/dist` plus Pages Functions. Real secrets must stay in local env files or Cloudflare Pages secrets.

## Public Cloudflare vars

These values can live in `apps/landing/wrangler.toml` because they are not secret:

- `PUBLIC_SITE_URL`: canonical site URL.
- `WORKSHOP_STATUS`: current workshop state, for example `tbd` or `live`.
- `WORKSHOP_LIVE_URL`: live room URL when available. It is treated as runtime config and can stay empty until launch.
- `EXPECTED_VIP_AMOUNT`: expected Stripe amount in minor units.
- `EXPECTED_VIP_CURRENCY`: expected Stripe currency.
- `GA4_MEASUREMENT_ID`: optional analytics measurement ID.
- `META_PIXEL_ID`: optional Meta Pixel ID.
- `TURNSTILE_SITE_KEY`: public Turnstile site key.
- `RATE_LIMIT_WINDOW_SECONDS`, `LEAD_RATE_LIMIT_IP`, `LEAD_RATE_LIMIT_EMAIL`, `ONBOARDING_RATE_LIMIT_IP`, `ONBOARDING_RATE_LIMIT_EMAIL`, `ONBOARDING_RATE_LIMIT_LEAD`: optional non-secret abuse-control tuning.

## Cloudflare secrets

Set these with `wrangler pages secret put ... --project-name=aiwebminar`. Do not commit real values.

- `TURNSTILE_SECRET_KEY`: verifies human submissions server-side.
- `STRIPE_PAYMENT_LINK_URL`: checkout URL used for VIP leads.
- `STRIPE_PAYMENT_LINK_ID`: expected Stripe payment link/session source.
- `STRIPE_SECRET_KEY`: server-side Stripe session verification.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signature verification.
- `ADMIN_EXPORT_TOKEN`: protects export, ops summary and reminder APIs.
- `WHATSAPP_FREE_GROUP_URL`: returned only after approved free access.
- `WHATSAPP_VIP_GROUP_URL`: returned only after approved VIP access.
- `GOOGLE_OPS_WEBHOOK_URL`: optional server-side forwarding target.
- `GOOGLE_OPS_WEBHOOK_SECRET`: optional HMAC secret for ops forwarding.
- `MAKE_LEAD_WEBHOOK_URL`, `MAKE_ONBOARDING_WEBHOOK_URL`, `MAKE_PAYMENT_WEBHOOK_URL`: optional fallback automation webhooks.
- `RATE_LIMIT_SALT`: optional private salt for D1 rate-limit identifiers.

Example command:

```sh
npm run deploy:cloudflare
```

The deploy script runs the local guard before publishing. It allows ignored local artifacts such as `dist`, `.wrangler`, `email-previews` and env files, but blocks tracked changes and untracked non-ignored files. To set a secret:

```sh
cd apps/landing
wrangler pages secret put ADMIN_EXPORT_TOKEN --project-name=aiwebminar
```

## Local-only ops vars

Copy `apps/landing/.dev.vars.example` to `apps/landing/.dev.vars.local` and fill only the values needed on your machine. `.dev.vars.local` is ignored by Git.

These variables are only for local ops flows:

- `OPS_ADMIN_EXPORT_TOKEN`
- `OPS_REMOTE_BASE_URL`
- `OPS_PORT`
- `RECONCILE_CREATED_GTE`
- `WA_WEB_CHROME_PATH`
- `WA_WEB_CHROME_PROFILE`
- `WA_WEB_CDP_PORT`
- `WA_WEB_HUMAN`
- `WA_WEB_DELAY_MIN`
- `WA_WEB_DELAY_MAX`
- `WA_WEB_KEY_DELAY_MIN`
- `WA_WEB_KEY_DELAY_MAX`
- `WA_1TO1_COOLDOWN_MS`
- `SMS_GATEWAY_URL`
- `SMS_GATEWAY_USERNAME`
- `SMS_GATEWAY_PASSWORD`
- `SMS_GATEWAY_MESSAGES_PATH`
- `SMS_GATEWAY_TIMEOUT_MS`
- `SMS_GATEWAY_COOLDOWN_MS`

Local ops command:

```sh
npm run ops:local -w apps/landing
```

## Maturity checks

Use the maturity gate before important changes or deploys:

```sh
npm run check:maturity
```

It verifies build output, public/private dist boundaries, security smoke tests, `npm audit`, whitespace checks, minimal Wrangler config and dependency freshness warnings. `npm outdated` is informational only.
