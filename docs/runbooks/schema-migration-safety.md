# Schema Migration Safety

Use this before every production AI HQ backend deploy that includes schema changes.

## Preconditions

- Confirm the release gate is green.
- Confirm the current production database has a recent backup or provider snapshot.
- Confirm `npm run migrate:ai-hq-backend` was tested against a production-like database.
- Confirm no pending hotfixes are waiting to ship on top of the same schema area.

## Safe rollout order

1. Deploy code that can tolerate both the old and new schema.
2. Run `npm run migrate:ai-hq-backend`.
3. Run `npm run check:operational-readiness`.
4. Run `npm run ops:postdeploy:verify`.
5. Confirm `/health` and `/api/health` stay ready after workers settle.

## Stop conditions

Do not continue if any of these happen:

- migration command fails or partially applies
- `/api/health` reports blocked operational readiness
- setup/truth/runtime routes return unexpected 5xx responses
- sidecars flip to intentionally unavailable after the AI HQ deploy

## Immediate response

- Stop the deploy rollout.
- Do not keep applying retries blindly.
- Capture:
  - migration error output
  - `/health` and `/api/health` payloads
  - the request ID / correlation ID from failing requests
- If the migration failed before commit, fix forward and rerun migration.
- If the migration committed but the app is unhealthy, roll application code back first, then assess whether a compensating migration is required.

## Roll-forward preference

Prefer roll-forward over ad hoc manual DB edits.

- Fix the migration or follow-up code.
- rerun `npm run migrate:ai-hq-backend`
- rerun `npm run check:operational-readiness`
- rerun `npm run ops:postdeploy:verify`

## If rollback is required

Use [production-rollback.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\production-rollback.md).
