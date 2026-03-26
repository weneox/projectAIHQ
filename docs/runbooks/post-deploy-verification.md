# Post-Deploy Verification

Run this immediately after a production deploy.

## Required environment

- `AIHQ_BASE_URL`
- `AIHQ_INTERNAL_TOKEN` for `/api/health`
- optionally `META_BOT_BASE_URL`
- optionally `TWILIO_VOICE_BASE_URL`

## Command

```powershell
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

## If verification fails

1. Save the failing output.
2. Collect the health payloads from each service.
3. Follow:
   - [schema-migration-safety.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\schema-migration-safety.md)
   - [production-rollback.md](C:\Users\bagir\OneDrive\Desktop\projectAIHQ\docs\runbooks\production-rollback.md)
