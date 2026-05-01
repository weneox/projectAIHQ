# Twilio Fallback Hardening Runbook

## Why this exists

The Twilio voice routes are customer-facing production surfaces. The main voice and transfer routes validate Twilio signatures, but fallback behavior still needs explicit release review because fallback routes can become public operational endpoints.

## Required checks before production

- [ ] `/twilio/voice` requires Twilio signature validation.
- [ ] `/twilio/transfer` requires Twilio signature validation.
- [ ] `/twilio/voice/fallback` has rate limiting or equivalent edge protection.
- [ ] Fallback responses do not expose tenant secrets, operator numbers, internal errors, or stack traces.
- [ ] Fallback responses are safe for unknown tenants.
- [ ] Fallback route behavior is covered by tests.
- [ ] Runtime incident signals are emitted when fallback is used unexpectedly.
- [ ] Operator transfer numbers are tenant-scoped and never logged unnecessarily.

## Recommended hardening

1. Add rate limiting to fallback routes.
2. Prefer Twilio signature validation where provider behavior allows it.
3. Return only generic TwiML fallback text.
4. Never include raw exception messages in fallback TwiML.
5. Track fallback hit count by route and tenant-resolution outcome.
6. Alert if fallback route usage spikes.

## Release gate

Do not mark Twilio Voice production-ready until this checklist is reviewed.
