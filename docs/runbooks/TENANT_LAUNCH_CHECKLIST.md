# Tenant Launch Checklist

Use this checklist before enabling any real tenant for live customer traffic.

The goal is simple: no tenant should become autonomous until setup, truth, runtime, channel delivery, operator fallback, and production smoke checks are all verified.

## Launch stages

| Stage | Goal |
| --- | --- |
| 1. Setup review | Confirm business information is accurate |
| 2. Truth finalization | Approve canonical business truth |
| 3. Runtime readiness | Verify runtime projection is healthy |
| 4. Channel verification | Confirm inbound and outbound delivery |
| 5. Manual inbox test | Confirm operator-reviewed AI flow works |
| 6. Handoff test | Confirm human takeover works |
| 7. Production smoke | Confirm deployed system is healthy |
| 8. Autonomous approval | Explicitly approve autonomous operation |

## 1. Setup review

- [ ] Tenant exists and has a stable tenant key.
- [ ] Business name is correct.
- [ ] Public contact information is correct.
- [ ] Services/products are correct.
- [ ] Opening hours are correct.
- [ ] Location/address information is correct.
- [ ] Supported languages are correct.
- [ ] Unsupported claims are documented.
- [ ] Risk-sensitive claims are removed or marked for handoff.
- [ ] Operator reviewed setup draft.

## 2. Truth finalization

- [ ] Setup draft is reviewed.
- [ ] Canonical truth is finalized.
- [ ] Truth version is created.
- [ ] Truth provenance is visible.
- [ ] High-risk fields are not auto-approved silently.
- [ ] Rollback path is understood.
- [ ] Operator can view truth history.

## 3. Runtime readiness

- [ ] Runtime projection exists.
- [ ] Runtime authority source is approved runtime projection.
- [ ] Runtime authority mode is strict.
- [ ] Runtime projection health is ready.
- [ ] Runtime projection is not stale.
- [ ] Runtime has a projection ID.
- [ ] Runtime has a truth version reference.
- [ ] Runtime policy controls are visible.
- [ ] Runtime incident trail is clean.

## 4. Channel verification

### Website chat

- [ ] Widget install token works.
- [ ] Widget loads on the expected domain.
- [ ] Inbound test message reaches inbox.
- [ ] Outbound/manual reply reaches website widget.
- [ ] Widget does not expose tenant secrets.

### Telegram

- [ ] Tenant channel has route token.
- [ ] Telegram secret header verification is enabled.
- [ ] Route-token fallback is disabled in production.
- [ ] Inbound Telegram test message reaches inbox.
- [ ] Outbound/manual reply reaches Telegram.

### Meta / Instagram

- [ ] Meta app configuration is valid.
- [ ] Webhook verification is configured.
- [ ] Page/account is connected to the right tenant.
- [ ] Inbound Instagram test message reaches inbox.
- [ ] Outbound/manual reply reaches Instagram.
- [ ] Token refresh/reconnect process is documented.

### Twilio Voice

- [ ] Twilio signature validation is enabled.
- [ ] Voice route resolves the correct tenant.
- [ ] Fallback route is rate-limited.
- [ ] Test call reaches expected TwiML/realtime path.
- [ ] Operator transfer number is tenant-scoped.
- [ ] Fallback message exposes no internal errors.

## 5. Manual inbox test

- [ ] Tenant mode is manual.
- [ ] Customer test message appears in inbox.
- [ ] AI classification/intent is visible.
- [ ] Suggested response is grounded in approved truth.
- [ ] Unsafe request results in no-reply or handoff.
- [ ] Operator can send manual reply.
- [ ] Decision event is recorded.
- [ ] Replay/debug metadata is available for review.

## 6. Handoff test

- [ ] Human request triggers handoff.
- [ ] High-risk request triggers handoff or no-reply.
- [ ] Handoff status is visible in thread state.
- [ ] AI does not continue replying during handoff unless explicitly allowed.
- [ ] Operator can resolve handoff.
- [ ] Thread returns to normal mode after operator resolution.

## 7. Production smoke

Run production smoke after deploy:

```bash
AIHQ_BACKEND_URL=https://your-backend.example.com npm run smoke:production
```

- [ ] Backend `/health` is ready.
- [ ] Backend `/api/__buildcheck` passes.
- [ ] AIHQ frontend is reachable.
- [ ] Neox frontend is reachable if applicable.
- [ ] No fresh runtime incidents are present.
- [ ] Worker readiness is acceptable.
- [ ] No pending migrations block readiness.

## 8. Autonomous approval

Autonomous operation must not be enabled only by setting `mode=auto`.

Before approval:

- [ ] Setup reviewed.
- [ ] Truth finalized.
- [ ] Runtime projection ready.
- [ ] Channel verified.
- [ ] Manual test passed.
- [ ] Handoff test passed.
- [ ] Production smoke passed.
- [ ] Operator fallback is available.
- [ ] Customer-facing response risk is accepted.

Approval metadata must be set in tenant publish policy using one of the supported shapes:

```json
{
  "mode": "auto",
  "launchApproved": true,
  "launchApprovedBy": "owner-or-admin",
  "launchApprovedAt": "2026-05-01T00:00:00.000Z"
}
```

or:

```json
{
  "mode": "auto",
  "launchGate": {
    "status": "approved",
    "approvedBy": "owner-or-admin",
    "approvedAt": "2026-05-01T00:00:00.000Z"
  }
}
```

## Launch decision

Do not launch if any of these are true:

- [ ] Runtime projection is missing.
- [ ] Runtime projection is stale.
- [ ] Channel verification failed.
- [ ] Operator handoff failed.
- [ ] Production smoke failed.
- [ ] Tenant secrets are missing or unverified.
- [ ] AI produces unsupported claims.
- [ ] Business owner has not approved autonomous mode.

## Post-launch monitoring

For the first live tenant:

- [ ] Keep operator watching inbox during initial live traffic.
- [ ] Review first 20 customer interactions.
- [ ] Review all no-reply outcomes.
- [ ] Review all handoff outcomes.
- [ ] Review all failed outbound attempts.
- [ ] Check runtime incidents after launch.
- [ ] Keep autonomous mode reversible.
