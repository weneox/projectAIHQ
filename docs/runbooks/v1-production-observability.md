# V1 Production Observability And Alerting Runbook

This repo does not assume a specific alerting vendor. Production may use the
deployment provider, log platform, uptime monitor, Slack, email, PagerDuty, or
another approved destination, but launch evidence must prove the route exists
and reaches a named owner.

## Required Production Config

Provider environment must define these values. Do not store webhook URLs,
tokens, or vendor credentials in the repo.

| Env | Required Purpose |
| --- | --- |
| `OBS_INCIDENT_OWNER` | Named owner or role accountable for production incidents. |
| `OBS_INCIDENT_CONTACT` | Alert contact or channel where the owner is reached. |
| `OBS_ALERT_DESTINATION` | Vendor-neutral alert route, channel, or monitor name. |
| `OBS_ALERT_PROVIDER` | Provider label, for example `railway`, `uptime-monitor`, `slack`, or `vendor-neutral`. |
| `OBS_ALERT_RUNBOOK_URL` | Link to this runbook or the deployed incident runbook. |
| `OBS_ALERT_EVIDENCE_URL` | Optional evidence link after alert delivery is tested. |

## What Must Alert For V1

Alert rules must cover these signals:

| Signal | Source | Alert Trigger |
| --- | --- | --- |
| Backend health/readiness | `/api/health`, `/health`, deployment health checks | Non-2xx, `operationalReadiness.status=blocked`, DB unavailable, or repeated 5xx. |
| Meta webhook ingestion | `meta.webhook.*` logs and runtime reliability signals | Signature/config failures, tenant resolution failure, AI HQ forward failure, or unhandled webhook error. |
| Website widget/inbox inbound | `website.widget.*.failed`, `inbox.ingest.failed`, runtime signals | Widget bootstrap/message failure or inbox ingest 5xx. |
| Runtime projection/readiness | `runtime.projection.*`, `runtime.authority.blocked`, operational readiness | Projection missing/stale/build failed or approved runtime unavailable. |
| Outbound/manual reply | `outbound_attempt_finalized_failure`, `outbound_retry.*`, durable execution alerts | Failed/dead/expired outbound attempts or retry backlog. |
| Database readiness | health payload `db.enabled=false`, migration/DB errors | DB unavailable or production readiness blocked by database. |
| Launch smoke | release gate, postdeploy verification, website lane smoke | Any required smoke job fails or tenant website lane is unavailable. |
| High error rate | structured HTTP logs and runtime signal summary | HTTP 5xx threshold exceeded in the recent signal window. |

## First Response Rules

First step for every incident: confirm whether the current production deployment
is safe to serve traffic by checking the release gate result and the backend
health/readiness payload. If either is red, stop changes and keep the incident
owner in the alert channel.

## Webhook Failures

1. Check `meta.webhook.verify.rejected`, `meta.webhook.text.forward_failed`,
   `meta.webhook.comment.forward_failed`, and `meta.webhook.event.unhandled_error`.
2. Confirm `META_WEBHOOK_APP_SECRET` exists in provider config without reading or
   posting the value.
3. Check AI HQ `/api/health` with scoped internal credentials.
4. If tenant resolution fails, verify `/api/tenants/resolve-channel` and Meta
   channel connection status for the tenant.
5. If AI HQ forwarding fails, inspect backend `inbox.ingest.failed` and DB
   readiness before retrying the webhook path.

## Inbox Not Receiving Messages

1. Check whether Meta webhook delivery succeeded and whether AI HQ logged
   `inbox.ingest.failed`.
2. Check `/api/health` and operational readiness for DB/runtime blockers.
3. Check tenant channel status and runtime projection health.
4. Verify the operator can open Inbox and manually reply to an existing thread.
5. If messages are queued but not visible, inspect inbox thread persistence and
   realtime connection logs.

## Database Readiness Failure

1. Check provider database status and backend `/api/health` `db.enabled`.
2. Stop deploys and schema changes until backup/restore posture is known.
3. Check migration logs and recent deployment SHA.
4. If a deploy introduced the failure, roll application code back first.
5. Use the backup/restore runbook only after confirming no safer app rollback
   exists.

## Widget Smoke Failure

1. Open the failed release gate or postdeploy job and read the website lane smoke
   failure reason.
2. Verify `WEBSITE_LANE_TENANT_KEY` points to the current smoke tenant.
3. Check `/api/health/website-lane` with the scoped internal token.
4. Check widget domain verification and public widget config for the tenant.
5. Do not mark public launch ready until the website lane smoke passes again.

## High 5xx Or Error Rate

1. Confirm whether `/api/health` reports blocked or unavailable readiness.
2. Inspect structured logs by `request_id`, `correlation_id`, route, tenant, and
   service.
3. Check runtime signal summary for `http_error_spike`,
   `webhook_ingestion_failures`, `outbound_reply_failures`, and
   `runtime_signal_attention`.
4. If errors started after deploy, rollback the app before investigating
   secondary symptoms.
5. If errors are tenant-specific, pause only the affected tenant/channel when
   possible and keep the global service online.

## Launch Evidence Required

Before any controlled pilot or public launch, attach evidence that:

- `OBS_INCIDENT_OWNER`, `OBS_INCIDENT_CONTACT`, and `OBS_ALERT_DESTINATION` are
  configured in the deployment provider.
- A test alert reached the configured contact/channel.
- The owner acknowledged the alert and this runbook.
- Required smoke failures notify the same contact/channel.
- No alert webhook secret or vendor token is included in the evidence.
