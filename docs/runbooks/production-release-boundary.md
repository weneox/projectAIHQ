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
| Twilio voice backend | Railway | `npm run build:twilio-voice-backend` or `docker build -f twilio-voice-backend/Dockerfile .` from repo root | `RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK` | service process |
| AI HQ frontend | Cloudflare Pages | `npm run build:ai-hq-frontend` | `CLOUDFLARE_PAGES_DEPLOY_HOOK` | `ai-hq-frontend/dist` |
| Neox frontend | Separate Cloudflare Pages project | `npm run build:neox-frontend` | optional: `ENABLE_NEOX_FRONTEND_PROD_DEPLOY=1` plus `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` | `neox-frontend/dist` |
| shared-contracts | internal workspace only | `npm run build:shared-contracts` | not deployed directly | package code |

`shared-contracts` is internal only and must never be deployed directly. The
repo-root `npm run build` is intentionally disabled because this monorepo has
multiple deploy targets. Use the target-specific commands above, or
`npm run build:all` for the Release Gate.

## GitHub Actions release boundary

Production deploy jobs live in `.github/workflows/release-gate.yml`. They run
only on `push` to `main`, and each production deploy target depends on the
three release gate jobs plus the production security preflight:

- `workspace-startup-compat-node18`
- `monorepo-release-gate`
- `frontend-stable-windows`
- `production-security-preflight`

`production-security-preflight` itself depends on
`workspace-startup-compat-node18`, `monorepo-release-gate`, and
`frontend-stable-windows`, so no deploy hook can run until the release checks
and production security checks have passed.

The gated AI HQ production deploy jobs are:

- `trigger-ai-hq-backend-railway-deploy`
- `trigger-meta-bot-backend-railway-deploy`
- `trigger-twilio-voice-backend-railway-deploy`
- `trigger-ai-hq-frontend-cloudflare-pages-deploy`

The Neox production deploy job,
`trigger-neox-frontend-cloudflare-pages-deploy`, is optional. It is skipped
unless the GitHub Actions repository variable
`ENABLE_NEOX_FRONTEND_PROD_DEPLOY` is exactly `1`. When the flag is unset, `0`,
or any value other than `1`, Neox deploy is outside the AI HQ production release
path, `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` is not required, and AI HQ
post-deploy verification does not wait for Neox.

Each deploy job fails closed when its required hook secret is missing and uses
`curl --fail` to trigger the hook. The strict production verification job
`verify-production-post-deploy` waits for the AI HQ backend, Meta sidecar,
Twilio sidecar, and AI HQ frontend deploy hooks before running production
smokes, including the AI HQ frontend real-browser smoke against the deployed
Cloudflare Pages URL and backend/frontend release SHA identity checks against
the current `github.sha`.

Do not add a separate production deploy workflow that bypasses these needs.

## Security gate

The Release Gate includes security checks before any production deploy hook can
run:

- `npm run security:audit` runs `npm audit --audit-level=high` and fails on
  high or critical dependency advisories.
- `npm run security:scan` runs a tracked-file secret scan for committed provider
  keys, deploy hooks, private keys, JWTs, real-looking database URLs, and
  sensitive token assignments.
- `npm run security:placeholder-guard` runs only in the production deploy path
  and rejects missing or placeholder production URLs, internal tokens, deploy
  hooks for enabled deploy targets, release SHA requirements, website lane
  strictness, and sidecar strictness.

Never commit real OpenAI keys, GitHub tokens, Railway deploy hooks, Cloudflare
tokens or deploy hooks, Meta app secrets or page tokens, Twilio auth/API
secrets, Postgres URLs with real passwords, private keys, JWTs, session secrets,
or internal tokens. Use GitHub Actions secrets or provider-level secret storage
instead.

Missing production env or values such as `REPLACE_WITH...`, `placeholder`,
`example.com`, `localhost`, `ci-*`, `test-*`, `dummy-*`, or similarly fake
values fail closed in the production deploy path for enabled deploy targets.

## Cloudflare Pages separation

- AI HQ frontend Cloudflare Pages project:
  - build command: `npm run build:ai-hq-frontend`
  - output directory: `ai-hq-frontend/dist`
  - deploy hook secret: `CLOUDFLARE_PAGES_DEPLOY_HOOK`
  - deployed production URL secret: `AIHQ_FRONTEND_PROD_URL`
  - post-deploy browser smoke command: `npm run ops:frontend:prod-smoke`
  - build identity: generated static `/build-meta.json`
- Neox frontend Cloudflare Pages project:
  - build command: `npm run build:neox-frontend`
  - output directory: `neox-frontend/dist`
  - deploy enable variable: `ENABLE_NEOX_FRONTEND_PROD_DEPLOY=1`
  - deploy hook secret when enabled: `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK`
  - default production launch behavior: skipped and non-blocking for AI HQ

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

Railway build settings for Twilio voice should use the repo-root Dockerfile
path `twilio-voice-backend/Dockerfile` when deploying by container. If deploying
as a workspace process instead, keep the build command
`npm run build:twilio-voice-backend` and the start command
`npm run start:twilio-voice-backend`.

## Required production smoke env

GitHub Actions stores production secrets under these names and maps them into the smoke scripts:

- `RAILWAY_AIHQ_BACKEND_DEPLOY_HOOK` for AI HQ backend Railway deploys
- `RAILWAY_META_BOT_BACKEND_DEPLOY_HOOK` for Meta bot backend Railway deploys
- `RAILWAY_TWILIO_VOICE_BACKEND_DEPLOY_HOOK` for Twilio voice backend Railway deploys
- `AIHQ_PROD_BASE_URL` -> `AIHQ_BASE_URL`
- `AIHQ_PROD_INTERNAL_TOKEN` -> `AIHQ_INTERNAL_TOKEN`
- `AIHQ_FRONTEND_PROD_URL` for the deployed AI HQ frontend browser smoke
- `AIHQ_EXPECTED_RELEASE_SHA` set by GitHub Actions to `github.sha`; do not store this as a long-lived secret
- `AIHQ_RELEASE_SHA` optional platform/build env override when the host does not expose its own commit SHA
- `AIHQ_FRONTEND_PROD_SMOKE_REQUIRE_RELEASE_SHA=1` in production CI
- `PROD_SPINE_REQUIRE_RELEASE_SHA=1` in production CI
- `AIHQ_LAUNCH_POSTURE_TENANT_KEY` optional; if omitted, the smoke scripts use `WEBSITE_LANE_TENANT_KEY` for internal launch posture verification
- `AIHQ_PROD_USER_SESSION_COOKIE` -> `AIHQ_USER_SESSION_COOKIE`, or a raw app session token -> `AIHQ_USER_SESSION_TOKEN`, for optional app-route launch posture verification
- `AIHQ_PROD_USER_SESSION_COOKIE` -> `AIHQ_FRONTEND_SMOKE_USER_SESSION_COOKIE`, or a raw app session token -> `AIHQ_FRONTEND_SMOKE_USER_SESSION_TOKEN`, for optional authenticated frontend browser route smoke
- `CLOUDFLARE_PAGES_DEPLOY_HOOK` for AI HQ frontend only
- `ENABLE_NEOX_FRONTEND_PROD_DEPLOY=1` only when the Neox production deploy should run with the AI HQ release
- `CLOUDFLARE_NEOX_FRONTEND_DEPLOY_HOOK` for Neox frontend only when `ENABLE_NEOX_FRONTEND_PROD_DEPLOY=1`
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
posture smoke, a real browser smoke of the deployed AI HQ frontend, a real
tenant website-lane smoke with `WEBSITE_LANE_TENANT_KEY`, and strict sidecar
checks for Meta and Twilio. The frontend smoke checks `/`, `/login`, `/home`,
`/channels`, `/inbox`, and `/truth` for blank screens, boot failures, obvious
placeholder configuration leaks, and wrong-backend symptoms. It also fetches
`/build-meta.json` and requires the deployed frontend release SHA to match
`AIHQ_EXPECTED_RELEASE_SHA` when strict release identity is enabled. The
prod-spine smoke fetches AI HQ backend buildcheck metadata from
`/api/__buildcheck` or `/__buildcheck` and requires the same SHA. Protected
routes may redirect to login or render an auth boundary when no smoke session
is available. Generic launch posture smoke checks the contract and allowed
narrow surfaces only; it does not require `overall.launchReady === true`
because a tenant may legitimately be blocked pending setup. The
app-authenticated `/api/launch/posture` route remains guarded by a real user
session and can be checked optionally when a current smoke session is
available.

Because Railway and Cloudflare deploy hooks are asynchronous, production CI
uses retry/backoff before accepting release identity:

- frontend browser smoke: `AIHQ_FRONTEND_PROD_SMOKE_ATTEMPTS=8` and `AIHQ_FRONTEND_PROD_SMOKE_DELAY_MS=15000`
- prod-spine backend smoke: `PROD_SPINE_SMOKE_ATTEMPTS=8` and `PROD_SPINE_SMOKE_DELAY_MS=15000`

If either service continues serving an old SHA after retries, the release is
blocked even if health endpoints are green.

Build metadata sources are intentionally non-secret:

- AI HQ backend accepts `AIHQ_RELEASE_SHA`, `RELEASE_SHA`, `BUILD_SHA`, `COMMIT_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `SOURCE_VERSION`, or `GITHUB_SHA`
- AI HQ frontend `/build-meta.json` accepts `AIHQ_RELEASE_SHA`, `RELEASE_SHA`, `BUILD_SHA`, `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, `SOURCE_VERSION`, or `VERCEL_GIT_COMMIT_SHA`

If Railway or Cloudflare does not automatically expose the commit SHA for a
production project, configure a non-secret platform build variable that maps to
`AIHQ_RELEASE_SHA`; otherwise strict release identity will fail closed.

## Production migration safety

Production AI HQ migrations must run the migration safety preflight before any
database mutation. The `npm run migrate:ai-hq-backend` command now runs this
preflight automatically. In production-like mode, including `APP_ENV=production`,
`NODE_ENV=production`, Railway production environments, or
`MIGRATION_SAFETY_STRICT=1`, the preflight fails closed unless all evidence is
present and fresh:

- `MIGRATION_SAFETY_ACK=backup-and-restore-verified`
- `DB_BACKUP_VERIFIED_AT` as an ISO date/time with timezone, no older than `MIGRATION_SAFETY_MAX_BACKUP_AGE_HOURS` (default `24`)
- `DB_RESTORE_DRILL_VERIFIED_AT` as an ISO date/time with timezone, no older than `MIGRATION_SAFETY_MAX_RESTORE_DRILL_AGE_DAYS` (default `30`)

The repo does not create backups or fake restore drills. These values are
operator evidence that the production database provider backup and restore path
was verified before migrations.
