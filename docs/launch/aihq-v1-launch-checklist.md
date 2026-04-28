# AI HQ v1 Launch Checklist

## Current launch scope

AI HQ v1 launches with a narrow, production-safe workflow:

1. Approve business truth.
2. Connect one live channel.
3. Operate customer conversations from Inbox.

The launch product is not positioned as a full automation OS yet. Frozen or non-launch surfaces must not be sold as production-ready.

## Production surfaces

The v1 launch surface is:

- Login
- Home
- Setup assistant
- Business Truth
- Channels
- Inbox
- Public website widget

## Frozen or non-launch surfaces

These surfaces are not part of the v1 production promise unless explicitly re-enabled and verified:

- Leads
- Comments
- Voice
- Publish
- Proposals
- Executions
- Incidents

They may exist in the codebase, but should not be presented as live product scope.

## Required production gates

Before claiming launch readiness, all of these must be green:

- GitHub Release Gate
- AI HQ backend Railway deploy
- Meta bot backend Railway deploy
- Twilio voice backend Railway deploy
- AI HQ frontend Cloudflare deploy
- Neox frontend Cloudflare deploy, if marketing site changed
- Mandatory postdeploy verification
- Mandatory prod-spine smoke
- Website lane tenant smoke with WEBSITE_LANE_TENANT_KEY

## Required GitHub Actions secrets

Required:

- CLOUDFLARE_PAGES_DEPLOY_HOOK
- CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK
- AIHQ_PROD_BASE_URL
- AIHQ_PROD_INTERNAL_TOKEN
- WEBSITE_LANE_TENANT_KEY

Optional:

- WEBSITE_LANE_DOMAIN
- META_BOT_PROD_BASE_URL
- TWILIO_VOICE_PROD_BASE_URL

## Current smoke tenant

Current production website-lane smoke tenant:

- WEBSITE_LANE_TENANT_KEY=neox

Do not replace this with a random value. It must match a real tenant key in production Postgres.

## Local verification baseline

Run from the monorepo root:

- git status --short
- git fetch origin main
- git rev-parse HEAD
- git rev-parse origin/main
- npm run lint:all
- npm run test:frontend:stable:ci
- npm run build:all
- npm run test:backend:all

For local build env validation, these placeholder values may be set before build:

- META_WEBHOOK_APP_SECRET=local-placeholder
- CORS_ORIGIN=http://localhost:5173
- OPENAI_API_KEY=local-placeholder

Expected local baseline:

- clean git status
- HEAD equals origin/main
- lint passes
- frontend stable tests pass
- build passes
- backend tests pass
- DB-backed integration tests may skip locally when DATABASE_URL is not configured

## Product demo path

The demo should follow this exact story:

1. Sign in.
2. Show Home and the launch path.
3. Open setup assistant.
4. Explain that business truth must be approved before live replies.
5. Open Business Truth.
6. Show approved truth and runtime state.
7. Open Channels.
8. Show one live channel.
9. Open Inbox.
10. Show customer conversation operation.

## Product promise

Safe public wording:

- AI HQ helps your business define approved business truth, connect a live customer channel, and operate conversations from one inbox.
- AI replies are gated by approved business truth and channel readiness.
- The system stays blocked when the runtime, channel, or inbox state is not safe.

Avoid public wording for v1:

- Full automation OS
- Complete CRM
- Voice platform
- Autonomous multi-agent system
- All business workflows automated

## Launch quality rules

- Do not show dead CTAs.
- Do not link to frozen routes from launch surfaces.
- Do not fake zero states when backend data is unavailable.
- Do not claim launch-ready without approved truth, healthy runtime, delivery-ready channel, and available inbox state.
- Do not expose raw debug payloads unless internal routes are explicitly enabled.
- Keep launch copy short, confident, and honest.

## Known non-blocking warnings

These are not launch blockers:

- React act(...) test warnings in existing test surfaces
- Ant Design Tooltip overlayInnerStyle deprecation warnings
- Vite chunk-size warnings
- Optional local env warnings for disabled optional features
