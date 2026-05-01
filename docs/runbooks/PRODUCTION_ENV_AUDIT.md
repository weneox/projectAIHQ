# Production Environment Audit Runbook

Use this runbook before every production launch, provider integration test, or major deploy.

The goal is to make sure every deployed surface has the correct environment variables, secrets, public URLs, and safety flags.

## Surfaces

| Surface | Platform | Purpose |
| --- | --- | --- |
| AIHQ Backend | Railway or equivalent | Main API, auth, tenants, truth, inbox, workers |
| AIHQ Frontend | Cloudflare Pages or equivalent | Operator/admin UI |
| Neox Frontend | Cloudflare Pages or equivalent | Public/product frontend |
| Meta Bot Backend | Railway or equivalent | Meta/Instagram webhook and outbound sidecar |
| Twilio Voice Backend | Railway or equivalent | Twilio voice, realtime stream, transfer |
| Database | Managed Postgres | Tenant data, truth, inbox, executions |

## 1. AIHQ Backend required env

### App and URLs

- [ ] `NODE_ENV=production`
- [ ] `APP_ENV=production` or equivalent production app env
- [ ] `PUBLIC_BASE_URL=https://...`
- [ ] `CORS_ORIGIN=https://...`
- [ ] `TRUST_PROXY=true` if deployed behind a proxy/load balancer
- [ ] `PORT` is provided by platform or explicitly set

### Database

- [ ] `DATABASE_URL` points to production Postgres
- [ ] Database SSL settings are production-appropriate
- [ ] Migrations are applied
- [ ] Migration drift check passes
- [ ] Backups are enabled
- [ ] Restore process is documented

### Sessions and auth

- [ ] `USER_SESSION_SECRET` is set
- [ ] `ADMIN_SESSION_SECRET` is set
- [ ] `ADMIN_PANEL_ENABLED` is intentional
- [ ] `ADMIN_PANEL_PASSCODE_HASH` is set if admin panel is enabled
- [ ] Cookie domain settings are correct for production
- [ ] Debug routes require diagnostics guard

### Internal auth

- [ ] `AIHQ_INTERNAL_TOKEN` is set
- [ ] Sidecar-specific internal tokens are set where supported
- [ ] Tokens are not shared in logs
- [ ] Rotation plan exists

### AI and providers

- [ ] `OPENAI_API_KEY` is set if AI responses are enabled
- [ ] Media provider keys are set only if media workers are enabled
- [ ] Provider keys are not present in frontend env

### Workers

- [ ] Source sync worker flag is intentional
- [ ] Durable execution worker flag is intentional
- [ ] Draft schedule worker flag is intentional
- [ ] Media job worker flag is intentional
- [ ] Worker process role is correct
- [ ] Worker heartbeat is visible in health output

## 2. AIHQ Frontend env

- [ ] `VITE_API_BASE=https://...`
- [ ] `VITE_WS_URL=wss://...`
- [ ] Internal/debug routes are disabled unless intentionally needed
- [ ] Frontend points to production backend
- [ ] No backend secrets are exposed as `VITE_*`

## 3. Neox Frontend env

- [ ] Cloudflare Pages build command is target-specific
- [ ] Build command is `npm run build:neox-frontend`
- [ ] Build output directory is `neox-frontend/dist`
- [ ] Root command `npm run build` is not used for monorepo deploy
- [ ] Public env values contain no secrets

## 4. Meta / Instagram env

### AIHQ Backend

- [ ] `META_APP_ID` is set
- [ ] `META_REDIRECT_URI` matches provider configuration
- [ ] `META_CONNECT_APP_SECRET` or approved legacy secret is set
- [ ] Connect and reconnect URLs match deployed backend

### Meta Bot Backend

- [ ] Meta app secret is set
- [ ] Webhook verify token is set
- [ ] AIHQ backend base URL is set
- [ ] Internal token is set
- [ ] Webhook URL points to deployed Meta sidecar
- [ ] Outbound sidecar can authenticate to AIHQ backend

### Provider dashboard

- [ ] Webhook callback URL is production URL
- [ ] Verify token matches env
- [ ] Permissions are reviewed
- [ ] Test page/account is connected first
- [ ] Reconnect flow is documented

## 5. Telegram env

- [ ] Telegram provider is intentionally enabled or disabled
- [ ] Bot token is stored as encrypted tenant secret
- [ ] Webhook route token is tenant/channel-specific
- [ ] Strict Telegram secret header verification is enabled
- [ ] Route-token fallback is disabled in production
- [ ] Inbound webhook test reaches inbox
- [ ] Outbound manual reply test reaches Telegram

## 6. Twilio Voice env

### Twilio Voice Backend

- [ ] `TWILIO_AUTH_TOKEN` is set
- [ ] `TWILIO_ACCOUNT_SID` is set
- [ ] `TWILIO_API_KEY` is set if browser/token flows are enabled
- [ ] `TWILIO_API_SECRET` is set if browser/token flows are enabled
- [ ] `TWILIO_TWIML_APP_SID` is set if browser/token flows are enabled
- [ ] `TWILIO_CALLER_ID` is valid
- [ ] `PUBLIC_BASE_URL=https://...`
- [ ] `AIHQ_BASE_URL=https://...`
- [ ] `AIHQ_INTERNAL_TOKEN` or sidecar token is set
- [ ] Voice fallback route is rate-limited

### Provider dashboard

- [ ] Voice webhook points to `/twilio/voice`
- [ ] Fallback webhook points to `/twilio/voice/fallback`
- [ ] Transfer route is configured where needed
- [ ] Test call reaches expected tenant
- [ ] Signature validation passes

## 7. Cloudflare Pages checks

For every Cloudflare Pages project:

- [ ] Build command is target-specific
- [ ] Output directory is correct
- [ ] Production branch is `main`
- [ ] Preview deployments are enabled intentionally
- [ ] Custom domain points to the right project
- [ ] Environment variables are split between production and preview
- [ ] No secrets are exposed as public env values

## 8. Railway checks

For every Railway service:

- [ ] Service root is correct
- [ ] Start command is correct
- [ ] Build command is correct
- [ ] Healthcheck path is configured if supported
- [ ] Required env vars exist
- [ ] Secrets are scoped to the right service only
- [ ] Logs do not show secrets
- [ ] Restart policy is intentional
- [ ] Region is acceptable

## 9. Smoke verification

Run after env audit and deploy:

```bash
AIHQ_BACKEND_URL=https://your-backend.example.com npm run smoke:production
```

Optional full check:

```bash
AIHQ_BACKEND_URL=https://your-backend.example.com \
AIHQ_FRONTEND_URL=https://your-aihq-frontend.example.com \
NEOX_FRONTEND_URL=https://your-neox-site.example.com \
npm run smoke:production
```

Expected:

```text
Production smoke passed.
```

## 10. Blockers

Do not launch if any of these are true:

- [ ] Backend health is unavailable
- [ ] Database is missing or unreachable
- [ ] Pending migrations block startup
- [ ] Runtime projection is missing or stale
- [ ] Autonomous launch approval is missing
- [ ] Channel webhook validation is not strict
- [ ] Internal tokens are missing
- [ ] Provider secrets are exposed to frontend
- [ ] Cloudflare deploy points to root `npm run build`
- [ ] Twilio fallback route is not protected
- [ ] Production smoke fails

## 11. Evidence to record

Before launch, record:

- [ ] Backend deploy URL
- [ ] Frontend deploy URL
- [ ] Neox deploy URL if applicable
- [ ] Database backup status
- [ ] Migration status
- [ ] Smoke result timestamp
- [ ] Test tenant key
- [ ] Tested channel
- [ ] Operator who approved launch
- [ ] Autonomous approval timestamp if applicable
