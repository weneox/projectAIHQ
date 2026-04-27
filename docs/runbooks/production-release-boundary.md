# Production Release Boundary

Use this runbook to keep AI HQ application deploys separate from the Neox frontend deploy.

## Deploy targets

| Target | Host | Build command | Start/deploy command | Output |
| --- | --- | --- | --- | --- |
| AI HQ backend | Railway | `npm run build:ai-hq-backend` or `docker build -f ai-hq-backend/Dockerfile .` from repo root | `npm run start:ai-hq-backend` or Docker `CMD ["npm", "start"]` | service process |
| Meta bot backend | Railway | `npm run build:meta-bot-backend` or `docker build -f meta-bot-backend/Dockerfile .` from repo root | `npm run start:meta-bot-backend` or Docker `CMD ["npm", "start"]` | service process |
| Twilio voice backend | Railway | `npm run build:twilio-voice-backend` | `npm run start:twilio-voice-backend` | service process |
| AI HQ frontend | Cloudflare Pages | `npm run build:ai-hq-frontend` | `CLOUDFLARE_PAGES_DEPLOY_HOOK` | `ai-hq-frontend/dist` |
| Neox frontend | Separate Cloudflare Pages project | `npm run build:neox-frontend` | `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` | `neox-frontend/dist` |
| shared-contracts | internal workspace only | `npm run build:shared-contracts` | not deployed directly | package code |

The repo-root `npm run build` is intentionally disabled because this monorepo has multiple deploy targets. Use the target-specific commands above, or `npm run build:all` for the Release Gate.

## Cloudflare Pages separation

- AI HQ frontend Cloudflare Pages project:
  - build command: `npm run build:ai-hq-frontend`
  - output directory: `ai-hq-frontend/dist`
  - deploy hook secret: `CLOUDFLARE_PAGES_DEPLOY_HOOK`
- Neox frontend Cloudflare Pages project:
  - build command: `npm run build:neox-frontend`
  - output directory: `neox-frontend/dist`
  - deploy hook secret: `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK`

Do not point either Cloudflare project at plain `npm run build`.

## Required production smoke env

GitHub Actions stores production secrets under these names and maps them into the smoke scripts:

- `AIHQ_PROD_BASE_URL` -> `AIHQ_BASE_URL`
- `AIHQ_PROD_INTERNAL_TOKEN` -> `AIHQ_INTERNAL_TOKEN`
- `CLOUDFLARE_PAGES_DEPLOY_HOOK` for AI HQ frontend only
- `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` for Neox frontend only
- `WEBSITE_LANE_TENANT_KEY`
- `WEBSITE_LANE_DOMAIN` optional, used when the tenant smoke must target one expected domain
- `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1` in production CI
- `PROD_SPINE_REQUIRE_WEBSITE_LANE=1` in production CI

Optional sidecar smoke env:

- `META_BOT_PROD_BASE_URL` -> `META_BOT_BASE_URL`
- `TWILIO_VOICE_PROD_BASE_URL` -> `TWILIO_VOICE_BASE_URL`
- `POSTDEPLOY_STRICT_SIDECARS=1` when sidecars must be live
- `PROD_SPINE_STRICT_SIDECARS=1` when sidecars must be live

## Launch confidence rule

A green deploy hook and green generic health checks are not enough for launch confidence. Production launch readiness requires a real tenant website-lane smoke with `WEBSITE_LANE_TENANT_KEY` and strict website-lane flags enabled.
