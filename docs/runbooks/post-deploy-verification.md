# Post-Deploy Verification

Run this immediately after a production deploy.

## Required environment

- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN` for `/api/health`
- optionally `META_BOT_BASE_URL`
- optionally `TWILIO_VOICE_BASE_URL`

The verifier fails closed if `AIHQ_BASE_URL` or `AIHQ_INTERNAL_TOKEN` is missing.

## Command

```powershell
npm run verify:env:status
npm run ops:postdeploy:verify
```

## What it checks

- AI HQ root health
- AI HQ API health
- Meta sidecar health if `META_BOT_BASE_URL` is provided
- Twilio sidecar health if `TWILIO_VOICE_BASE_URL` is provided

## Strict mode

If sidecars are expected to be live in the environment, require them explicitly:

```powershell
$env:POSTDEPLOY_STRICT_SIDECARS='1'
npm run ops:postdeploy:verify
```

## Expected outcome

- AI HQ is not blocked
- sidecars are not intentionally unavailable
- blocker reason codes are empty or expected for the environment
- missing required verifier env fails the command instead of being reported as a passing skip

## If verification fails

1. Save the failing output.
2. Collect the health payloads from each service.
3. Follow:
   - [environment-parity-verification.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\environment-parity-verification.md)
   - [schema-migration-safety.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\schema-migration-safety.md)
   - [production-rollback.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\production-rollback.md)
