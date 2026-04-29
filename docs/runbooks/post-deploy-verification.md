# Post-Deploy Verification

Run this immediately after a production deploy.

## Required environment

- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN` for internal health/smoke headers
- optionally `AIHQ_LAUNCH_POSTURE_TENANT_KEY`; defaults to `WEBSITE_LANE_TENANT_KEY` for the internal launch posture smoke
- optionally `AIHQ_USER_SESSION_COOKIE` for an additional app-authenticated `/api/launch/posture` smoke, or `AIHQ_USER_SESSION_TOKEN` containing the raw `aihq_user` token
- `WEBSITE_LANE_TENANT_KEY` for production launch verification
- optionally `WEBSITE_LANE_DOMAIN`
- optionally `META_BOT_BASE_URL`
- optionally `TWILIO_VOICE_BASE_URL`

The verifier fails closed if `AIHQ_BASE_URL` or `AIHQ_INTERNAL_TOKEN` is missing.
The mandatory launch posture smoke uses `GET /api/internal/launch/posture` with `AIHQ_INTERNAL_TOKEN`, so CI does not depend on expiring browser user sessions.
If an app session cookie/token is supplied, the verifier also checks `GET /api/launch/posture` as an optional app-route verification.
In local/dev mode, missing `WEBSITE_LANE_TENANT_KEY` is reported as a warning and the website lane smoke is skipped. In production CI, set `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1` so a missing tenant key fails closed instead of producing false launch confidence.

## Command

```powershell
npm run verify:env:status
npm run ops:postdeploy:verify
```

## What it checks

- AI HQ root health
- AI HQ API health
- AI HQ launch posture contract at `GET /api/internal/launch/posture`
- optional app-authenticated launch posture contract at `GET /api/launch/posture` when a user session cookie/token is configured
- Meta sidecar health if `META_BOT_BASE_URL` is provided
- Twilio sidecar health if `TWILIO_VOICE_BASE_URL` is provided

## Strict mode

If sidecars are expected to be live in the environment, require them explicitly:

```powershell
$env:POSTDEPLOY_STRICT_SIDECARS='1'
npm run ops:postdeploy:verify
```

If production launch readiness is being verified, require the real website lane tenant:

```powershell
$env:POSTDEPLOY_REQUIRE_WEBSITE_LANE='1'
$env:WEBSITE_LANE_TENANT_KEY='REPLACE_WITH_REAL_TENANT_KEY'
npm run ops:postdeploy:verify
```

## Expected outcome

- AI HQ is not blocked
- launch posture returns the narrow `launch_posture_v1` contract without phase-2 surfaces
- website lane launch verification passes for a real tenant in production CI
- sidecars are not intentionally unavailable
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
