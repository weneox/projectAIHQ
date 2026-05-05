# V1 Launch Journey Smoke Runbook

This runbook proves the smallest v1 customer path works without enabling frozen
surfaces or requiring third-party provider calls during local CI.

## CI-safe smoke

Run from the monorepo root:

```powershell
npm run test:all
```

The CI-safe coverage lives in
`ai-hq-backend/tests/v1-launch-journey-smoke.test.js`. It uses local fakes for
auth and inbox persistence and deliberately does not require Meta, Twilio,
OpenAI, billing, Redis, WAF, browser cookies from production, or provider
secrets.

The test must cover:

- user login and `GET /auth/me` session continuity
- setup assistant route reachability
- Business Truth/readiness route reachability
- channels / website widget setup route reachability
- public Website Widget endpoint reachability
- simulated website-widget inbound inbox item
- manual operator reply path
- runtime health/readiness posture with safe non-secret status
- frozen v1-excluded backend surfaces still returning `surface_frozen`

## Staging or production browser smoke

Use a real staging or production-like deployment after the release gate has
passed all earlier required checks for the target environment.

Required evidence:

- environment name and URL
- release SHA or deployment ID
- tester and approver
- test timestamp
- sanitized screenshots or video for the browser path
- sanitized API/log references for widget inbound and manual reply
- failure notes and remediation if any step failed

Do not attach passwords, session cookies, widget session tokens, API keys,
webhook secrets, Redis credentials, WAF tokens, or raw visitor PII.

## Browser steps

1. Open the app URL and log in as the designated launch-test operator.
2. Confirm the session survives refresh through the account/session endpoint.
3. Open Home and confirm the setup assistant is reachable.
4. Open Business Truth/readiness and confirm approved truth status or the
   explicit readiness blocker is visible.
5. Open Channels / Website Chat setup and confirm widget setup status is
   visible.
6. Load the configured test website page with the Website Widget loader.
7. Send one visitor message from the widget.
8. Confirm the message creates or updates an inbox thread for the same tenant.
9. Send one manual operator reply from Inbox.
10. Confirm health/readiness exposes safe, non-secret status and no v1-frozen
    surface is accidentally available.

## First failure step

Stop the launch smoke at the first failed step, capture the sanitized evidence,
and file a blocker against the exact failing route, page, or deployment config.
Do not mark `P1-003` READY until the complete path passes in the target
environment.

## Launch evidence update

`docs/launch/production-launch-evidence.json` item `P1-003` must stay
`BLOCKED` until the staging or production browser smoke evidence above is
attached and approved. Local CI passing is necessary but is not enough by
itself for limited, paid, or public launch.
