# Backup And Restore Evidence Template

This repo cannot create provider backups, verify provider snapshot policy, or
prove restore success by itself. The launch gate remains blocked until the
operator attaches real provider and restore drill evidence.

## Required before controlled production use

- Provider snapshot policy is enabled for the production database.
- Latest production backup or snapshot is no older than 24 hours.
- A restore drill completed successfully within the last 30 days.
- The restore target was isolated from production.
- The restored database booted far enough to run health/readiness checks.
- The restore result was reviewed by the owner and approver.
- No production secrets or raw customer data are pasted into this repo.

## Required before every production migration

- Capture latest provider backup/snapshot evidence before the migration.
- Export migration safety evidence:
  - `MIGRATION_SAFETY_ACK=backup-and-restore-verified`
  - `DB_BACKUP_VERIFIED_AT=<ISO timestamp>`
  - `DB_RESTORE_DRILL_VERIFIED_AT=<ISO timestamp>`
- Run `npm run ops:migration:safety-preflight`.
- Do not run `npm run migrate:ai-hq-backend` if the preflight fails.

## Evidence record

Copy this block into the incident/release tracker, fill it there, and link it
from `docs/launch/production-launch-evidence.json`.

```text
Release or drill ID:
Environment:
Database provider:
Production database identifier:
Snapshot/backup policy link:
Latest backup evidence link:
Latest backup timestamp:
Backup age at approval:
Restore drill evidence link:
Restore drill timestamp:
Restore target:
Restore command or provider action:
Validation commands run:
Validation result:
RTO observed:
RPO observed:
Data integrity checks:
Owner:
Approver:
Approval date:
Known gaps:
Go/no-go decision:
```

## Go/no-go rule

If provider snapshot policy, latest backup evidence, or restore drill evidence
is missing, production launch is blocked. Do not accept this as MVP risk for
any tenant that can contain customer data.
