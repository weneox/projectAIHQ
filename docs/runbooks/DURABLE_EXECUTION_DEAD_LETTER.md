# Durable Execution Dead-Letter Runbook

Use this runbook when `/health` reports `operational_attention` caused by durable execution dead-letter backlog.

Dead-letter records are not automatically bad. They mean an execution failed enough times that the worker stopped retrying it. Operators must classify the cause before retrying, archiving, or fixing configuration/code.

## What dead-letter means

A durable execution can become `dead_lettered` when:

- provider delivery fails repeatedly,
- provider credentials are invalid or expired,
- the recipient cannot receive the message,
- payload is invalid,
- channel configuration is broken,
- a code bug creates invalid execution data,
- provider rate limits or temporary gateway failures continue past max attempts.

Do not blindly retry or delete dead-letter records.

## First check health

```powershell
$health = Invoke-RestMethod "https://api.hq.weneox.com/health"
$health.reasonCodes
$health.operational | ConvertTo-Json -Depth 20
```

Look for:

- `durableExecution.deadLetterCount`
- `operational.alerts`
- `workerSummary.status`
- `incidents.status`

If workers are ready and incidents are clear, the issue is likely backlog classification rather than worker failure.

## Read-only SQL audit

### Status summary

```sql
select
  status,
  count(*) as count
from durable_executions
group by status
order by count desc;
```

### Group dead letters by cause

```sql
select
  tenant_key,
  provider,
  channel,
  action_type,
  last_error_code,
  last_error_classification,
  left(coalesce(last_error_message, ''), 120) as last_error_message,
  count(*) as count
from durable_executions
where status = 'dead_lettered'
group by
  tenant_key,
  provider,
  channel,
  action_type,
  last_error_code,
  last_error_classification,
  left(coalesce(last_error_message, ''), 120)
order by count desc
limit 100;
```

### Recent samples

```sql
select
  id,
  tenant_key,
  provider,
  channel,
  action_type,
  attempt_count,
  max_attempts,
  last_error_code,
  last_error_classification,
  left(coalesce(last_error_message, ''), 300) as last_error_message,
  dead_lettered_at,
  updated_at,
  created_at
from durable_executions
where status = 'dead_lettered'
order by coalesce(dead_lettered_at, updated_at, created_at) desc
limit 50;
```

## Decision matrix

| Error type | Likely action |
| --- | --- |
| Empty outbound payload | Archive/terminal after audit |
| Expired provider token | Fix provider config, then retry |
| Invalid recipient | Terminal/archive |
| Rate limit | Retry later if payload is valid |
| Temporary gateway failure | Retry if provider recovered |
| Missing channel secret | Fix config, then retry |
| Code-generated invalid payload | Fix code, then archive invalid historical records |
| Unknown error | Inspect attempts and audit trail first |

## Empty outbound payload handling

If the error is `text_or_attachments_required`, first prove payloads are empty.

```sql
select
  count(*) as total,
  count(*) filter (
    where coalesce(payload_summary->>'text', '') <> ''
  ) as payload_text_present,
  count(*) filter (
    where coalesce(safe_metadata->>'text', '') <> ''
  ) as safe_text_present,
  count(*) filter (
    where jsonb_array_length(coalesce(payload_summary->'attachments', '[]'::jsonb)) > 0
  ) as payload_attachments_present,
  count(*) filter (
    where jsonb_array_length(coalesce(safe_metadata->'attachments', '[]'::jsonb)) > 0
  ) as safe_attachments_present
from durable_executions
where status = 'dead_lettered'
  and last_error_message = 'text_or_attachments_required';
```

Only archive if all message/attachment counts are zero.

## Safe archive procedure

Never update dead-letter records without a backup table.

### 1. Create backup

Change the table suffix date before running.

```sql
create table if not exists durable_executions_dead_letter_cleanup_YYYYMMDD as
select *
from durable_executions
where status = 'dead_lettered'
  and tenant_key = 'TENANT_KEY'
  and provider = 'PROVIDER'
  and channel = 'CHANNEL'
  and action_type = 'ACTION_TYPE'
  and last_error_code = 'ERROR_CODE'
  and last_error_message = 'ERROR_MESSAGE';
```

### 2. Verify backup count

```sql
select count(*) as backed_up
from durable_executions_dead_letter_cleanup_YYYYMMDD;
```

The backup count must exactly match the intended cleanup count.

### 3. Archive as terminal

```sql
begin;

update durable_executions
set
  status = 'terminal',
  last_error_classification = 'archived_after_operator_audit',
  last_error_message = 'archived_after_dead_letter_audit',
  updated_at = now()
where status = 'dead_lettered'
  and tenant_key = 'TENANT_KEY'
  and provider = 'PROVIDER'
  and channel = 'CHANNEL'
  and action_type = 'ACTION_TYPE'
  and last_error_code = 'ERROR_CODE'
  and last_error_message = 'ERROR_MESSAGE';

select
  status,
  count(*) as count
from durable_executions
group by status
order by count desc;

commit;
```

Do not mark records as `succeeded` unless the provider actually delivered the action.

## Retry procedure

Only retry when:

- payload is valid,
- provider/channel config has been fixed,
- retry will not duplicate customer-facing messages,
- operator accepts duplicate-delivery risk.

Example:

```sql
update durable_executions
set
  status = 'pending',
  lease_token = null,
  lease_expires_at = null,
  claimed_by = null,
  next_retry_at = now(),
  dead_lettered_at = null,
  updated_at = now()
where id = 'EXECUTION_ID'
  and status in ('retryable', 'terminal', 'dead_lettered');
```

Prefer retrying one execution first, not the entire group.

## Post-cleanup verification

```powershell
$health = Invoke-RestMethod "https://api.hq.weneox.com/health"
$health.reasonCodes
$health.operational | ConvertTo-Json -Depth 20
```

Then run smoke:

```powershell
$env:AIHQ_BACKEND_URL="https://api.hq.weneox.com"
npm run smoke:production
Remove-Item Env:\AIHQ_BACKEND_URL
```

Use `DEBUG_API_TOKEN` or `AIHQ_INTERNAL_TOKEN` for protected diagnostics routes.

## Long-term product requirement

Manual SQL cleanup is not the final product workflow. The product should eventually provide:

- dead-letter dashboard,
- grouping by tenant/provider/action/error,
- safe retry button,
- archive button,
- audit trail,
- provider config deep links,
- health threshold rules,
- retention policy.
