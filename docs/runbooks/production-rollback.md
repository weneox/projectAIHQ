# Production Rollback

Use this when a deploy is live and production health/readiness regresses.

## Trigger conditions

- `/health` or `/api/health` flips to blocked or intentionally unavailable
- sidecars cannot boot because AI HQ readiness is blocked
- setup review finalize or runtime publication starts failing at scale
- Twilio or Meta traffic is accepted but critical downstream sync fails repeatedly

## First 10 minutes

1. Freeze further deploys.
2. Capture the failing request IDs / correlation IDs.
3. Save current outputs from:
   - AI HQ `/health`
   - AI HQ `/api/health`
   - Meta `/health`
   - Twilio `/health`
4. Decide whether the failure is:
   - app-code only
   - schema + app interaction
   - dependency/config outage

## App-code rollback

Use this when migrations are already applied and the old app version is still schema-compatible.

1. Roll the service images/processes back to the last known good release.
2. Recheck:
   - `npm run check:operational-readiness`
   - `npm run ops:postdeploy:verify`
3. Confirm sidecars recover from intentionally unavailable mode.

## Schema-aware rollback

Use this only when the previous release cannot run safely against the new schema.

1. Prefer a compensating forward fix.
2. If rollback is unavoidable:
   - restore from the database backup/snapshot taken before the migration
   - redeploy the matching previous app version
   - re-run post-deploy verification

Do not hand-edit truth/runtime/review tables in production unless the incident commander explicitly approves it.

## Incident notes to capture

- failing request IDs / correlation IDs
- exact deploy version
- migration file names applied in the release
- blocker reason codes from readiness surfaces
- whether Meta or Twilio sidecars entered intentionally unavailable mode

## Recovery exit criteria

- AI HQ `/health` is not blocked
- AI HQ `/api/health` is not blocked
- sidecar `/health` endpoints are not intentionally unavailable
- setup/truth/runtime critical flows are passing smoke verification
