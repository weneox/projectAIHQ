# Local environment setup

Use the root [`.env.example`](/C:/Users/bagir/OneDrive/Desktop/projectAIHQ/.env.example) as the canonical inventory of supported variables. Do not put real secrets into tracked files.

## Quick start

1. Copy the canonical example into a private local file:
   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Fill only the values you actually need for the workspaces you run.
3. If you run a workspace directly and it expects its own local env file, copy the same needed values into that workspace's gitignored `.env.local`.

## Minimum local config

For `npm run validate:env` at the repo root, the smallest practical local set is:

- `APP_ENV=development`
- `DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/aihq_dev`
- `USER_SESSION_SECRET=...`
- `AIHQ_INTERNAL_TOKEN=...`
- `PUBLIC_BASE_URL=http://localhost:8080`
- `AIHQ_BASE_URL=http://localhost:8080`
- `CORS_ORIGIN=http://localhost:5173`
- `VITE_API_BASE=http://localhost:8080`
- `VITE_WS_URL=ws://localhost:8080`
- `VERIFY_TOKEN=...`
- `META_APP_SECRET=...`
- `CONTACT_EMAIL=ops@example.test`
- `OPENAI_API_KEY=...`
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_API_KEY=...`
- `TWILIO_API_SECRET=...`
- `TWILIO_TWIML_APP_SID=...`
- `TWILIO_AUTH_TOKEN=...`

## Optional features you can disable locally

If you do not need an optional feature in local development, disable it instead of inventing fake-looking production config:

- Admin panel: `ADMIN_PANEL_ENABLED=0`
- Web push: `PUSH_ENABLED=0`
- Media worker: `MEDIA_JOB_WORKER_ENABLED=0`
- Tenant Telegram channel connect: `TELEGRAM_ENABLED=0`
- Draft scheduling worker: `DRAFT_SCHEDULE_WORKER_ENABLED=0`
- Service worker in frontend: `VITE_ENABLE_SERVICE_WORKER=0`

If you do want Telegram channel connect enabled locally, set:

- `TELEGRAM_ENABLED=1`
- `TELEGRAM_WEBHOOK_BASE_URL=http://localhost:8080` (or your public backend base URL)
- `TELEGRAM_API_BASE_URL=https://api.telegram.org`

The product-managed Telegram connector stores each tenant bot token in tenant secrets after the operator connects it from the Channels UI. You do not preconfigure a shared `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` in the backend env for this flow.

## Validation commands

Use these commands after your local `.env.local` values are in place:

```powershell
npm run validate:env
```

```powershell
npm run verify:env:status
```

If you only need a single workspace, run its validator directly:

```powershell
npm run validate:env -w ai-hq-backend
```

```powershell
npm run validate:env -w meta-bot-backend
```

```powershell
npm run validate:env -w twilio-voice-backend
```

```powershell
npm run validate:env -w ai-hq-frontend
```

## PowerShell examples

Create a private local file:

```powershell
Copy-Item .env.example .env.local
```

Set a value for the current shell only:

```powershell
$env:DATABASE_URL = "postgresql://USERNAME:PASSWORD@HOST:5432/aihq_dev"
```

Remove a value from the current shell:

```powershell
Remove-Item Env:DATABASE_URL
```
