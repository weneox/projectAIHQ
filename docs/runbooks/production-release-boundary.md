# Production Release Boundary

Use this runbook to keep every production deploy behind the GitHub Actions
Release Gate. The Release Gate workflow is the source of truth for production
release control.

Railway and Cloudflare auto deploys must be disabled, or treated as untrusted
for production release control. Production deploy hooks must only be triggered
by GitHub Actions after the Release Gate has passed.

## Deploy targets

| Target | Host | Build command | Production deploy trigger | Output |
| --- | --- | --- | --- | --- |
| AI HQ backend | Railway | `npm run build:ai-hq-backend` or `docker build -f ai-hq-backend/Dockerfile .` from repo root | `RAILWAY_AIHQ_BACKEND_DEPLOY_HOOK` | service process |
| Meta bot backend | Railway | `npm run build:meta-bot-backend` or `docker build -f meta-bot-backend/Dockerfile .` from repo root | `RAILWAY_META_BOT_BACKEND_DEPLOY_HOOK` | service process |
| Twilio voice backend | Railway | `npm run build:twilio-voice-backend` | `RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK` | service process |
| AI HQ frontend | Cloudflare Pages | `npm run build:ai-hq-frontend` | `CLOUDFLARE_PAGES_DEPLOY_HOOK` | `ai-hq-frontend/dist` |
| Neox frontend | Separate Cloudflare Pages project | `npm run build:neox-frontend` | `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` | `neox-frontend/dist` |
| shared-contracts | internal workspace only | `npm run build:shared-contracts` | not deployed directly | package code |

`shared-contracts` is internal only and must never be deployed directly. The
repo-root `npm run build` is intentionally disabled because this monorepo has
multiple deploy targets. Use the target-specific commands above, or
`npm run build:all` for the Release Gate.

## GitHub Actions release boundary

Production deploy jobs live in `.github/workflows/release-gate.yml`. They run
only on `push` to `main`, and each production deploy target depends on all three
gate jobs:

- `workspace-startup-compat-node18`
- `monorepo-release-gate`
- `frontend-stable-windows`

The gated production deploy jobs are:

- `trigger-ai-hq-backend-railway-deploy`
- `trigger-meta-bot-backend-railway-deploy`
- `trigger-twilio-voice-backend-railway-deploy`
- `trigger-ai-hq-frontend-cloudflare-pages-deploy`
- `trigger-neox-frontend-cloudflare-pages-deploy`

Each deploy job fails closed when its required hook secret is missing and uses
`curl --fail` to trigger the hook. The strict production verification job
`verify-production-post-deploy` waits for the AI HQ backend, Meta sidecar,
Twilio sidecar, and AI HQ frontend deploy hooks before running production
smokes.

Do not add a separate production deploy workflow that bypasses these needs.

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

## Railway separation

Each Railway production service must have its own deploy hook and GitHub secret:

- AI HQ backend: `RAILWAY_AIHQ_BACKEND_DEPLOY_HOOK`
- Meta bot backend: `RAILWAY_META_BOT_BACKEND_DEPLOY_HOOK`
- Twilio voice backend: `RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK`

Do not reuse hook URLs across services. Disable Railway auto deploys from
`main`, or leave them configured only for non-production environments. The
production release mechanism is the gated deploy hook invocation from GitHub
Actions.

## Required production smoke env

GitHub Actions stores production secrets under these names and maps them into the smoke scripts:

- `RAILWAY_AIHQ_BACKEND_DEPLOY_HOOK` for AI HQ backend Railway deploys
- `RAILWAY_META_BOT_BACKEND_DEPLOY_HOOK` for Meta bot backend Railway deploys
- `RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK` for Twilio voice backend Railway deploys
- `AIHQ_PROD_BASE_URL` -> `AIHQ_BASE_URL`
- `AIHQ_PROD_INTERNAL_TOKEN` -> `AIHQ_INTERNAL_TOKEN`
- `AIHQ_LAUNCH_POSTURE_TENANT_KEY` optional; if omitted, the smoke scripts use `WEBSITE_LANE_TENANT_KEY` for internal launch posture verification
- `AIHQ_PROD_USER_SESSION_COOKIE` -> `AIHQ_USER_SESSION_COOKIE`, or a raw app session token -> `AIHQ_USER_SESSION_TOKEN`, for optional app-route launch posture verification
- `CLOUDFLARE_PAGES_DEPLOY_HOOK` for AI HQ frontend only
- `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` for Neox frontend only
- `WEBSITE_LANE_TENANT_KEY`
- `WEBSITE_LANE_DOMAIN` optional, used when the tenant smoke must target one expected domain
- `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1` in production CI
- `PROD_SPINE_REQUIRE_WEBSITE_LANE=1` in production CI
- `META_BOT_PROD_BASE_URL` -> `META_BOT_BASE_URL`
- `TWILIO_VOICE_PROD_BASE_URL` -> `TWILIO_VOICE_BASE_URL`
- `POSTDEPLOY_STRICT_SIDECARS=1` in production CI
- `PROD_SPINE_STRICT_SIDECARS=1` in production CI

## Launch confidence rule

A green deploy hook and green generic health checks are not enough for launch
confidence. Production launch readiness requires the internal read-only launch
posture smoke, a real tenant website-lane smoke with `WEBSITE_LANE_TENANT_KEY`,
and strict sidecar checks for Meta and Twilio. Generic launch posture smoke
checks the contract and allowed narrow surfaces only; it does not require
`overall.launchReady === true` because a tenant may legitimately be blocked
pending setup. The app-authenticated `/api/launch/posture` route remains guarded
by a real user session and can be checked optionally when a current smoke
session is available.
