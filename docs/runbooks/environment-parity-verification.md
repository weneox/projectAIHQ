# Environment Parity Verification

Use this before calling the current governance/runtime/policy/audit slice release-safe.

## First command

```powershell
npm run verify:env:status
```

This prints which verification paths are:

- `fully_verifiable`
- `blocked_by_environment`
- `external_infra_unavailable`

## Local verification without Docker

Use this when you have workspace dependencies installed but no local Postgres container runtime.

```powershell
npm run verify:env:status
npm run check:workspace-startup-compat
npm run test -w shared-contracts
npm run test -w ai-hq-backend
npm run test -w meta-bot-backend
npm run test -w twilio-voice-backend
npm run test:stable -w ai-hq-frontend
```

Notes:

- `npm run test:aihq:db` will stay unavailable until `DATABASE_URL` is set.
- workspace `build` commands still require each workspace's production-like env.
- the repo-root `npm run build` intentionally fails closed; use explicit target scripts such as `npm run build:ai-hq-frontend`, `npm run build:neox-frontend`, or `npm run build:all`.

## Local verification with Docker

```powershell
npm run verify:env:status
npm run check:workspace-startup-compat
npm run test:aihq:db
```

Container packaging expectations:

- `ai-hq-backend` must be built from the repo root: `docker build -f ai-hq-backend/Dockerfile .`
- `meta-bot-backend` must be built from the repo root: `docker build -f meta-bot-backend/Dockerfile .`
- `twilio-voice-backend` currently has no in-repo Dockerfile and should be treated as workspace-start-only unless a deploy asset is added deliberately.

Reason:
Both shipped Dockerfiles depend on the shared workspace loader in [`scripts/workspace-module-loader.mjs`](/C:/Users/bagir/OneDrive/Desktop/projectAIHQ/scripts/workspace-module-loader.mjs) and the local [`shared-contracts`](/C:/Users/bagir/OneDrive/Desktop/projectAIHQ/shared-contracts/package.json) package, so building from a workspace directory alone is not a supported parity path.

If production-like env is also present:

```powershell
npm run validate:env
npm run build:all
```

## CI / release gate verification

The release gate should run:

```powershell
npm run verify:env:status
npm run validate:env
npm run migrate:ai-hq-backend
npm run test:aihq:db
npm run check:operational-readiness
npm run lint:all
npm run test:frontend:stable:ci
npm run test:backend:all
npm run build:all
```

Release Gate uses `npm run build:all`, not root `npm run build`.

## Production-like verification requirements

Required for `ai-hq-backend` build / validate:

- `DATABASE_URL`
- `ADMIN_SESSION_SECRET`
- `USER_SESSION_SECRET`
- `AIHQ_INTERNAL_TOKEN`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Conditional for workspace-wide `npm run validate:env` / `npm run build:all` when the shared environment also exports Meta channel secrets:

- `META_APP_ID`
- `META_CONNECT_APP_SECRET` or legacy `META_APP_SECRET`
- `META_REDIRECT_URI`

Reason:
If legacy `META_APP_SECRET` is present for `meta-bot-backend`, `ai-hq-backend` also sees that env var and will fail validation unless the backend Meta OAuth trio is complete. Prefer `META_WEBHOOK_APP_SECRET` for Meta bot webhook verification and `META_CONNECT_APP_SECRET` for AI HQ Meta connect/reconnect.

Required for `meta-bot-backend` build / validate:

- `VERIFY_TOKEN`
- `META_WEBHOOK_APP_SECRET`
- `PUBLIC_BASE_URL`
- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN`
- `CONTACT_EMAIL`

Required for `twilio-voice-backend` build / validate:

- `PUBLIC_BASE_URL`
- `CORS_ORIGIN`
- `OPENAI_API_KEY`
- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`
- `TWILIO_TWIML_APP_SID`
- `TWILIO_AUTH_TOKEN`

Required for `ai-hq-frontend` production / CI build:

- `VITE_API_BASE`
- `VITE_WS_URL`

Required for `neox-frontend` production / CI build:

- no repo-level env validation currently runs for Neox; configure any Cloudflare project env needed by the Neox app in the separate Neox frontend Cloudflare Pages project.

Required for production post-deploy launch-lane smoke:

- `AIHQ_PROD_BASE_URL`
- `AIHQ_PROD_INTERNAL_TOKEN`
- `WEBSITE_LANE_TENANT_KEY`
- optionally `WEBSITE_LANE_DOMAIN`
- `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1`
- `PROD_SPINE_REQUIRE_WEBSITE_LANE=1`

## Classification guide

- `blocked_by_environment`: required env is missing or invalid for the current workspace.
- `external_infra_unavailable`: Docker, Postgres, or a live deployed service is required and not currently available.
- `fully_verifiable`: the command is runnable under the current machine/env without additional external infra.
