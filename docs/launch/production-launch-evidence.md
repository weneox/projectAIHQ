# Production Launch Evidence Gate

`docs/launch/production-launch-evidence.json` is the launch evidence source of
truth. Markdown checklists are supporting docs only. A production or paid
launch is blocked until this evidence file and the release gate agree that the
target is ready.

## How to run the gate

From the monorepo root:

```powershell
npm run launch:evidence:check -- limited
npm run launch:evidence:check -- paid
npm run launch:evidence:check -- public
```

GitHub Actions Release Gate runs the same check with `LAUNCH_GATE_TARGET=public`
inside `.github/workflows/release-gate.yml` before production deploy hooks or
post-deploy verification can pass.

## Required fields

Every launch evidence item must include:

- `item`
- `owner`
- `status`: `BLOCKED`, `READY`, or `ACCEPTED_RISK`
- `evidence`: provider link, CI run, runbook output, local test reference, or
  other concrete proof
- `reasonMissing`: required when blocked or accepted as risk
- `date`
- `approver`
- `blocksLimitedLaunch`
- `blocksPaidLaunch`
- `blocksPublicLaunch`

`READY` without evidence is invalid. `BLOCKED` without a reason is invalid.
`ACCEPTED_RISK` is invalid unless `acceptedRiskAllowed` is explicitly true.

## Current gate result

As of 2026-05-04:

- Limited controlled unpaid pilot is blocked by missing shared rate-limit or
  WAF proof for public and abuse-prone v1 surfaces.
- Limited controlled unpaid pilot is blocked by missing production data
  retention proof and external observability/alert delivery proof.
- Limited controlled unpaid pilot is blocked by missing staging/production v1
  launch journey smoke evidence.
- Paid pilot is blocked by the same operational proof requirements.
- Public launch is blocked by all remaining external proof items.

The Meta bot deployment classification proof must show that the provider
runtime uses `APP_ENV=production` or `APP_ENV=staging` and `NODE_ENV=production`.
Do not attach secret values. Evidence should be a provider config screenshot,
release log, or signed ops record that shows variable names and environment
classification only.

Do not change `BLOCKED` to `READY` based on intention, memory, screenshots
without context, or verbal approval. Attach the evidence link or runbook output
first, then add the approver and date.

The observability proof must show `OBS_INCIDENT_OWNER`,
`OBS_INCIDENT_CONTACT`, `OBS_ALERT_DESTINATION`, and `OBS_ALERT_RUNBOOK_URL`
configured in the deployment provider, plus a successful test alert delivered to
the incident contact. Do not attach alert webhook secrets or vendor tokens.

The retention proof must show a production/staging dry-run and approved live or
scheduled cleanup for `docs/runbooks/v1-data-retention.md`. Evidence must not
contain PII or secret values, and it must prove that approved Business
Truth/configuration tables were not targeted by generic cleanup.

The rate-limit proof must show which shared control protects each v1 abuse-prone
surface: auth/login/session, website widget public endpoints, Meta webhook
ingress, inbox manual reply, source sync trigger endpoints, and any user-facing
AI/runtime endpoint that remains enabled. In-memory backend limits are allowed
for local development and single-instance demos only. They are not launch
evidence for limited, paid, or public environments.

The v1 launch journey proof must follow
`docs/runbooks/v1-launch-journey-smoke.md` and cover login/session, setup
assistant, Business Truth/readiness, channels/widget setup, public Website
Widget, inbox inbound item, manual operator reply, and runtime health/readiness
in the target environment. Local CI smoke coverage is required but does not
replace staging or production browser evidence.
