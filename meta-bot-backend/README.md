# meta-bot-backend

Meta webhook gateway for tenant-aware Instagram messaging runtime.

## Features
- `GET /webhook` - Meta webhook verification
- `POST /webhook` - Receive Meta events, resolve the tenant through AIHQ, and continue the DM runtime flow
- `GET /privacy` - Privacy Policy page
- `GET /terms` - Terms of Service page
- `GET/POST /instagram/deauthorize` - Deauthorize callback bridged into AIHQ tenant channel state
- `GET/POST /instagram/data-deletion` - Data deletion acknowledgement and status page

## Requirements
- Node.js 18+ (recommended 20+)

## Required environment

- `APP_ENV`
- `PUBLIC_BASE_URL`
- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN` or scoped `AIHQ_INTERNAL_TOKEN_META_BOT`
- `VERIFY_TOKEN`
- `META_WEBHOOK_APP_SECRET`
- `CONTACT_EMAIL`

`META_WEBHOOK_APP_SECRET` is the Meta webhook signing secret used to verify
incoming webhook bodies. Production-like environments must set this explicit
variable; the legacy `META_APP_SECRET` fallback is allowed only for local/dev/test
compatibility and is rejected by validation for staging/production.

## Install
```bash
npm install
```
