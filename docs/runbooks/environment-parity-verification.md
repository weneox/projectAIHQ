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

## Local verification with Docker

```powershell
npm run verify:env:status
npm run check:workspace-startup-compat
npm run test:aihq:db
```

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

## Production-like verification requirements

Required for `ai-hq-backend` build / validate:

- `DATABASE_URL`
- `ADMIN_SESSION_SECRET`
- `USER_SESSION_SECRET`
- `AIHQ_INTERNAL_TOKEN`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Required for `meta-bot-backend` build / validate:

- `VERIFY_TOKEN`
- `META_APP_SECRET`
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

## Classification guide

- `blocked_by_environment`: required env is missing or invalid for the current workspace.
- `external_infra_unavailable`: Docker, Postgres, or a live deployed service is required and not currently available.
- `fully_verifiable`: the command is runnable under the current machine/env without additional external infra.
