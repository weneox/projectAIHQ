# V1 Rate Limiting Contract

This runbook defines the minimum abuse controls for v1 launch. The repo does
not currently implement a shared multi-instance limiter. Any limited, paid, or
public launch is blocked until `P1-002` evidence proves that a shared
Redis/Upstash limiter or provider/WAF rule covers the required surfaces.

## Current repo posture

- `auth/login/session`:
  - `ai-hq-backend` uses database-backed login/signup attempt windows plus
    in-memory edge throttles.
  - This helps local and single-instance deployments, but it is not enough to
    prove production edge protection by itself.
- `website widget public endpoints`:
  - `POST /api/public/widget/install-token`
  - `POST /api/public/widget/bootstrap`
  - `POST /api/public/widget/message`
  - `POST /api/public/widget/transcript`
  - Repo protection today: in-memory backend throttles only.
- `Meta webhook ingress`:
  - `meta-bot-backend` `GET /webhook`
  - `meta-bot-backend` `POST /webhook`
  - Repo protection today: webhook signature verification, but no shared limiter
    proof in repo.
- `inbox manual reply`:
  - `POST /api/inbox/threads/:id/messages`
  - Repo protection today: in-memory backend throttle.
- `setup/source sync trigger`:
  - `POST /api/sources/:id/sync`
  - Repo protection today: in-memory backend throttle.
- `user-facing AI/runtime endpoints`:
  - `POST /api/chat`
  - `POST /api/debate`
  - `POST /api/media/image`
  - `POST /api/render/slides`
  - Repo protection today: in-memory backend throttles where the surface is
    enabled.

## Health and readiness exclusions

These routes must stay callable by providers and smoke jobs. Do not put public
rate limiting in front of them without an allowlist that preserves health
checks.

- `GET /api`
- `GET /api/health`
- `GET /api/health/website-lane`

## What counts as launch evidence

Attach one of the following:

- Shared Redis/Upstash limiter proof that is applied across every production
  instance, or
- Provider/WAF rule proof that covers the required surfaces before requests hit
  the app tier.

The evidence must show:

- environment (`staging` or `production`)
- owner
- provider or shared limiter type
- surfaces covered
- policy or rule names
- thresholds
- verification record from a test or dry run
- approver and date

Do not include Redis passwords, webhook secrets, WAF API tokens, or session
secrets.

## How to verify

1. Confirm the deployment environment and service names.
2. List the exact surfaces and rules that protect them.
3. Trigger a safe test from a non-production source and capture the rule hit or
   shared limiter counter.
4. Confirm that a second app instance observes the same limiter state, or that
   the WAF/edge blocks before requests hit the app.
5. Attach the evidence to `docs/launch/production-launch-evidence.json` and
   change `P1-002` only after human review.

## First response when abuse is suspected

1. Check whether the affected surface is covered by the declared shared
   limiter/WAF rule.
2. Check `GET /api` and `GET /api/health` for safe readiness state.
3. Review structured logs for 429 spikes, widget ingress failures, webhook
   failures, or source sync abuse indicators.
4. If edge/shared protection is missing or ineffective, keep launch blocked and
   do not mark `P1-002` `READY`.
