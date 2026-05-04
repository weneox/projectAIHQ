# Schema Migration Safety

Use this before every production AI HQ backend deploy that includes schema changes.

## Preconditions

- Confirm the release gate is green.
- Confirm the current production database has a recent backup or provider snapshot.
- Confirm a restore drill was verified recently enough for production risk.
- Export production migration safety evidence before running migrations:
  - `MIGRATION_SAFETY_ACK=backup-and-restore-verified`
  - `DB_BACKUP_VERIFIED_AT`, ISO date/time with timezone
  - `DB_RESTORE_DRILL_VERIFIED_AT`, ISO date/time with timezone
- Confirm `npm run migrate:ai-hq-backend` was tested against a production-like database.
- Confirm no pending hotfixes are waiting to ship on top of the same schema area.

The repo does not create backups or fake restore drills. The preflight only
enforces that an operator supplied explicit evidence from the production
database provider/runbook.

Use [backup-restore-evidence-template.md](backup-restore-evidence-template.md)
to record provider snapshot policy, latest backup age, restore drill result,
owner, and approver. Link the completed evidence from
`docs/launch/production-launch-evidence.json` before changing `P0-004` from
`BLOCKED`.

## Production preflight

`npm run migrate:ai-hq-backend` runs the migration safety preflight before
touching the database. To check it directly:

```powershell
$env:MIGRATION_SAFETY_STRICT='1'
$env:MIGRATION_SAFETY_ACK='backup-and-restore-verified'
$env:DB_BACKUP_VERIFIED_AT='2026-04-30T08:15:00Z'
$env:DB_RESTORE_DRILL_VERIFIED_AT='2026-04-20T08:15:00Z'
npm run ops:migration:safety-preflight
```

Defaults:

- backup evidence must be no older than `MIGRATION_SAFETY_MAX_BACKUP_AGE_HOURS=24`
- restore drill evidence must be no older than `MIGRATION_SAFETY_MAX_RESTORE_DRILL_AGE_DAYS=30`

In production-like mode, missing, malformed, future, or stale evidence fails
closed before database connection or migration execution.

## Safe rollout order

1. Deploy code that can tolerate both the old and new schema.
2. Run `npm run ops:migration:safety-preflight`.
3. Run `npm run migrate:ai-hq-backend`.
4. Run `npm run check:operational-readiness`.
5. Run `npm run ops:postdeploy:verify` with `POSTDEPLOY_REQUIRE_WEBSITE_LANE=1` and `WEBSITE_LANE_TENANT_KEY` for production launch verification.
6. Confirm `/health` and `/api/health` stay ready after workers settle.

## Stop conditions

Do not continue if any of these happen:

- migration command fails or partially applies
- migration safety preflight fails or evidence is stale
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
- rerun `npm run ops:migration:safety-preflight`
- rerun `npm run migrate:ai-hq-backend`
- rerun `npm run check:operational-readiness`
- rerun `npm run ops:postdeploy:verify` with the production website lane tenant smoke enabled

## If rollback is required

Use [production-rollback.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\production-rollback.md).
