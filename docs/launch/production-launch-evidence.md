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

- Limited controlled unpaid pilot is blocked by missing production secret
  evidence, backup/restore proof, and production sign-off.
- Paid pilot is blocked by the same technical evidence plus missing paid launch
  terms.
- Public launch is blocked by all remaining external proof items.

Do not change `BLOCKED` to `READY` based on intention, memory, screenshots
without context, or verbal approval. Attach the evidence link or runbook output
first, then add the approver and date.
