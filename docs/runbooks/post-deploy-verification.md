# Post-Deploy Verification

Run this immediately after a production deploy.

## Required environment

- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN` for internal health/smoke headers
- `AIHQ_FRONTEND_PROD_URL` for deployed AI HQ frontend browser smoke
- `AIHQ_EXPECTED_RELEASE_SHA` for deployed backend/frontend build identity checks; GitHub Actions sets this to `github.sha`
- optionally `AIHQ_LAUNCH_POSTURE_TENANT_KEY`; defaults to `WEBSITE_LANE_TENANT_KEY` for the internal launch posture smoke
- optionally `AIHQ_USER_SESSION_COOKIE` for an additional app-authenticated `/api/launch/posture` smoke, or `AIHQ_USER_SESSION_TOKEN` containing the raw `aihq_user` token
- optionally `AIHQ_FRONTEND_SMOKE_USER_SESSION_COOKIE` or `AIHQ_FRONTEND_SMOKE_USER_SESSION_TOKEN` for authenticated frontend route browser smoke
- `WEBSITE_LANE_TENANT_KEY` for production launch verification
- optionally `WEBSITE_LANE_DOMAIN`
- `META_BOT_BASE_URL` for production CI strict sidecar verification
- `TWILIO_VOICE_BASE_URL` for production CI strict sidecar verification

Before production deploy hooks run, GitHub Actions also executes
`npm run security:placeholder-guard` with the production secret names. Missing
values, example domains, localhost URLs, placeholder deploy hooks, disabled
strict sidecar flags, or a missing expected release SHA fail closed before the
post-deploy verifier can run.

The backend verifier fails closed if `AIHQ_BASE_URL` or `AIHQ_INTERNAL_TOKEN` is missing.
The frontend browser smoke fails closed if `AIHQ_FRONTEND_PROD_URL` is missing or is not an `http(s)` URL.
In production CI, set `AIHQ_FRONTEND_PROD_SMOKE_REQUIRE_RELEASE_SHA=1` and `PROD_SPINE_REQUIRE_RELEASE_SHA=1`; missing or mismatched `AIHQ_EXPECTED_RELEASE_SHA` then fails closed instead of proving only that an older deployment is healthy.
The mandatory launch posture smoke uses `GET /api/internal/launch/posture` with `AIHQ_INTERNAL_TOKEN`, so CI does not depend on expiring browser user sessions.
If an app session cookie/token is supplied, the verifier also checks `GET /api/launch/posture` as an optional app-route verification.
In local/dev mode, missing `WEBSITE_LANE_TENANT_KEY` is reported as a warning and the website lane smoke is skipped. In production CI, set `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1` so a missing tenant key fails closed instead of producing false launch confidence.
In production CI, set `POSTDEPLOY_STRICT_SIDECARS=1` and `PROD_SPINE_STRICT_SIDECARS=1`; missing Meta or Twilio sidecar base URLs then fail closed.

## Command

```powershell
npm run verify:env:status
npm run security:placeholder-guard
npm run ops:frontend:prod-smoke
npm run ops:prod-spine:smoke
npm run ops:postdeploy:verify
```

## What it checks

- AI HQ root health
- AI HQ API health
- AI HQ frontend root, `/login`, `/home`, `/channels`, `/inbox`, and `/truth` in a real Chromium browser
- deployed frontend blank-screen, boot-error, Vite/env placeholder, dynamic import, console-error, and obvious wrong-backend checks
- AI HQ frontend `/build-meta.json` release SHA when `AIHQ_EXPECTED_RELEASE_SHA` is set
- AI HQ backend `/api/__buildcheck` or `/__buildcheck` release SHA when `AIHQ_EXPECTED_RELEASE_SHA` is set
- AI HQ launch posture contract at `GET /api/internal/launch/posture`
- optional app-authenticated launch posture contract at `GET /api/launch/posture` when a user session cookie/token is configured
- Meta sidecar health; required in production CI strict mode
- Twilio sidecar health; required in production CI strict mode

The security gate also checks the repository itself for committed secrets:
OpenAI keys, GitHub tokens, Railway hooks, Cloudflare hooks/tokens, Meta page
tokens or app secrets, Twilio auth/API secrets, real-looking Postgres passwords,
private keys, JWTs, session secrets, and internal tokens must never be committed.
Use documented placeholders in `.env.example` and store real values only in
GitHub Actions or platform secret managers.

## Strict mode

Production launch verification treats the Meta and Twilio sidecars as blocking.
Require them explicitly:

```powershell
$env:POSTDEPLOY_STRICT_SIDECARS='1'
$env:META_BOT_BASE_URL='https://REPLACE_WITH_META_PROD_URL'
$env:TWILIO_VOICE_BASE_URL='https://REPLACE_WITH_TWILIO_PROD_URL'
npm run ops:postdeploy:verify
```

If production launch readiness is being verified, require the real website lane tenant:

```powershell
$env:POSTDEPLOY_REQUIRE_WEBSITE_LANE='1'
$env:WEBSITE_LANE_TENANT_KEY='REPLACE_WITH_REAL_TENANT_KEY'
npm run ops:postdeploy:verify
```

The frontend browser smoke is blocking in the Release Gate post-deploy job. Without a smoke session, protected routes must redirect to login or render an auth boundary instead of crashing blank. With a smoke session, they may render authenticated surfaces.
The frontend smoke and prod-spine smoke both retry in production CI, so async Cloudflare/Railway deploy hooks have time to publish the new build before the release SHA check fails.

## Expected outcome

- AI HQ is not blocked
- deployed AI HQ frontend renders in Chromium and is not blank or pointed at placeholder API configuration
- deployed AI HQ frontend and backend report the expected release SHA
- launch posture returns the narrow `launch_posture_v1` contract without phase-2 surfaces
- website lane launch verification passes for a real tenant in production CI
- Meta and Twilio sidecars are reachable, not blocked, and not intentionally unavailable
- blocker reason codes are empty or expected for the environment
- missing required verifier env fails the command instead of being reported as a passing skip

## If verification fails

1. Save the failing output.
2. Collect the health payloads from each service.
3. Follow:
   - [production-release-boundary.md](./production-release-boundary.md)
   - [environment-parity-verification.md](./environment-parity-verification.md)
   - [schema-migration-safety.md](./schema-migration-safety.md)
   - [production-rollback.md](./production-rollback.md)
