# Production Readiness Checklist

This checklist is the minimum gate before treating Project AIHQ as production-ready.

## 1. Repository hygiene

- [ ] Root README explains the system, services, and safety posture.
- [ ] CI runs on every pull request.
- [ ] Secret scanning runs in CI.
- [ ] Build/test commands are documented.
- [ ] No production secrets are committed.
- [ ] Branch protection is enabled for main.

## 2. Required production configuration

- [ ] DATABASE_URL is configured and points to production Postgres.
- [ ] USER_SESSION_SECRET is configured.
- [ ] ADMIN_SESSION_SECRET is configured.
- [ ] ADMIN_PANEL_PASSCODE_HASH is configured if admin panel is enabled.
- [ ] AIHQ_INTERNAL_TOKEN is configured.
- [ ] Service-scoped internal tokens are configured for sidecars where possible.
- [ ] CORS_ORIGIN is explicit and not wildcard.
- [ ] PUBLIC_BASE_URL is production HTTPS.
- [ ] Cookie domain settings are explicit for production.
- [ ] Debug routes are disabled unless intentionally protected by DEBUG_API_TOKEN.

## 3. Database and migrations

- [ ] Migrations are up to date.
- [ ] Migration drift check passes.
- [ ] Rollback process is documented.
- [ ] Backups are configured.
- [ ] Restore process has been tested.

## 4. AI safety and launch gates

- [ ] Tenant starts in manual mode by default.
- [ ] Autonomous mode requires explicit operator approval.
- [ ] Approved truth exists before AI replies are allowed.
- [ ] Runtime projection is current.
- [ ] Runtime authority is available.
- [ ] Truth version drift blocks or degrades autonomous behavior.
- [ ] No-reply and handoff paths are tested.
- [ ] Quiet hours behavior is tested.
- [ ] Replay and decision events are stored for auditability.

## 5. Channel safety

### Website chat

- [ ] Install token flow is scoped and expires.
- [ ] Domain verification is required before trusting production traffic.
- [ ] Widget origin rules are explicit.
- [ ] Public widget endpoints expose no tenant secrets.

### Telegram

- [ ] Webhook route token is unique per tenant/channel.
- [ ] Telegram secret header verification is strict.
- [ ] Route-token fallback is disabled in production.
- [ ] Unsupported update types are ignored safely.
- [ ] Bot token is stored only as an encrypted tenant secret.

### Meta / Instagram

- [ ] Meta app secret and connect secret are consistent.
- [ ] OAuth redirect URI matches provider configuration.
- [ ] Webhook verification token is configured.
- [ ] Signed request and webhook validation are tested.
- [ ] Outbound sidecar uses scoped internal auth.

### Twilio Voice

- [ ] Twilio signature validation is required on voice routes.
- [ ] Public fallback routes are rate-limited.
- [ ] Operator transfer numbers are tenant-scoped.
- [ ] Realtime stream behavior is tested with a test number.

## 6. Observability

- [ ] Health endpoints report DB, workers, readiness, incidents, and degraded state.
- [ ] Runtime incident trail is enabled.
- [ ] Worker heartbeat staleness is monitored.
- [ ] Durable execution backlog is monitored.
- [ ] Dead-letter queue has an operator playbook.
- [ ] Sidecar boot readiness is monitored.
- [ ] Logs include correlation and request IDs.

## 7. Data protection

- [ ] Tenant secrets are encrypted.
- [ ] Raw webhook payload retention is defined.
- [ ] Customer message retention is defined.
- [ ] Avatar and media retention is defined.
- [ ] Static upload serving is audited.
- [ ] PII exposure in logs is minimized.
- [ ] Access to admin and operator surfaces is role-gated.

## 8. Release gate

Before enabling a live tenant:

- [ ] Setup draft reviewed.
- [ ] Truth finalized.
- [ ] Runtime projection built.
- [ ] Launch posture ready.
- [ ] One channel connected and verified.
- [ ] Inbox receives test message.
- [ ] AI reply remains in manual/review mode first.
- [ ] Operator handoff works.
- [ ] Outbound execution works.
- [ ] Incident trail remains clean.
- [ ] Autonomous mode explicitly approved.
## Related runbooks

- [Production Smoke Runbook](runbooks/PRODUCTION_SMOKE.md)
- [Production Environment Audit Runbook](runbooks/PRODUCTION_ENV_AUDIT.md)
- [Durable Execution Dead-Letter Runbook](runbooks/DURABLE_EXECUTION_DEAD_LETTER.md)
- [Tenant Launch Checklist](runbooks/TENANT_LAUNCH_CHECKLIST.md)
- [Twilio Fallback Hardening Runbook](runbooks/TWILIO_FALLBACK_HARDENING.md)



