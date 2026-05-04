# V1 Data Retention Runbook

This runbook defines the repo-enforced v1 retention boundary for customer and
visitor data. It does not prove that production retention is running. Production
launch remains blocked until `docs/launch/production-launch-evidence.json`
contains dry-run/live cleanup or scheduled-job evidence for `P1-005`.

## Policy

The canonical policy is implemented in
`ai-hq-backend/src/services/dataRetention.js` and configured from
`ai-hq-backend/src/config.js`.

| Data area | Repo tables | Default retention | Cleanup action |
| --- | --- | ---: | --- |
| Website widget visitor sessions/messages | `inbox_threads`, `inbox_messages`, `inbox_outbound_attempts` where channel is `website` or `web` | 30 days | Delete expired messages, outbound attempts, and empty threads for the same `tenant_key`. |
| Inbox conversations/manual replies | `inbox_threads`, `inbox_messages`, `inbox_outbound_attempts` excluding website/web channel | 90 days | Delete expired messages, outbound attempts, and empty threads for the same `tenant_key`. |
| Raw imported website content | `tenant_source_raw_artifacts`, `tenant_source_artifact_chunks` for website source/artifact types only | 30 days | Delete expired website raw artifacts and chunks for the same `tenant_key`. |
| Runtime/observability events | `runtime_incidents` | 14 days | Delete expired tenant-scoped incident rows. |
| Audit/security logs | `audit_log` | 365 days | Delete only after the longer audit retention window. |

## Environment variables

These values are safe to keep in `.env.example` because they are policy values,
not secrets.

| Variable | Default | Meaning |
| --- | ---: | --- |
| `DATA_RETENTION_DRY_RUN` | `1` | Default cleanup mode. Keep `1` unless executing an approved live run. |
| `DATA_RETENTION_WEBSITE_WIDGET_DAYS` | `30` | Website widget/session/message retention. |
| `DATA_RETENTION_INBOX_MESSAGE_DAYS` | `90` | Non-widget inbox retention. |
| `DATA_RETENTION_SOURCE_RAW_ARTIFACT_DAYS` | `30` | Raw source artifact/chunk retention. |
| `DATA_RETENTION_RUNTIME_INCIDENT_DAYS` | `14` | Runtime incident retention. |
| `DATA_RETENTION_AUDIT_LOG_DAYS` | `365` | Audit/security log retention. Must stay longer than transient visitor data. |
| `DATA_RETENTION_MAX_DELETE_ROWS` | `1000` | Per-step delete batch limit. |
| `DATA_RETENTION_TENANT_BATCH_LIMIT` | `100` | Maximum tenants processed by one all-tenant run. |

## What is deleted or anonymized

The v1 repo cleanup deletes rows. It does not anonymize rows in place.

Deleted data can include visitor names, emails, phone numbers, session IDs,
message text, page URLs, referrers, outbound provider payloads, raw website
content, imported website raw text/html/json, and tenant-scoped runtime/audit
metadata when those rows are older than their configured retention window.

## Explicit exclusions

Generic retention cleanup must not delete approved Business Truth, customer
configuration, tenant/channel setup, provider secrets, or frozen/non-v1 media
asset records. The implementation lists these exclusions explicitly:

- `tenant_truth_versions`
- `tenant_business_profiles`
- `tenant_business_capabilities`
- `tenant_runtime_projections`
- `tenant_runtime_projection_runs`
- `tenant_setup_review_sessions`
- `tenant_setup_review_events`
- `tenant_sources`
- `tenant_channels`
- `tenant_secrets`
- `tenant_provider_secrets`
- `tenant_channel_secrets`
- `content_media_assets`

Non-website raw artifacts such as uploaded documents, social payloads, audio,
video, transcripts, and manual notes are also not targeted by the v1 generic
source cleanup unless a later approved policy explicitly scopes them.

Inbox message `attachments` JSON is removed when the owning inbox message is
deleted. Binary/object-store media deletion is not proven by this repo and must
not be claimed as covered without provider evidence.

Application/platform logs outside the database are not deleted by this repo.
The deployment provider must enforce its own log retention policy and attach
evidence before production launch.

## Safe cleanup procedure

1. Confirm `DATABASE_URL` points at the intended environment.
2. Confirm `APP_ENV` is `staging` or `production` for launch evidence runs.
3. Run dry-run first:

```powershell
npm run retention:cleanup -w ai-hq-backend -- --dry-run
```

4. Review the JSON summary. It must show the expected tenant count and matched
row counts without exposing PII.
5. Attach the dry-run output or provider job log to the `P1-005` evidence item.
6. Only after approval, run a live cleanup:

```powershell
npm run retention:cleanup -w ai-hq-backend -- --execute
```

7. Re-run a dry-run. Expected matched counts for the same expired rows should
drop or remain explainable.
8. Attach the live run evidence, approver, date, and scheduled-job proof to the
launch evidence file.

## Required production proof

`P1-005` cannot be marked `READY` until all of the following are true:

- A production or staging dry-run was executed with no PII or secret values in
  the evidence.
- A live cleanup or scheduled cleanup job is approved and proven.
- The reviewer confirms no Business Truth/configuration tables were targeted.
- The provider/platform log retention policy is documented separately.
- The run owner and approver are listed in
  `docs/launch/production-launch-evidence.json`.
