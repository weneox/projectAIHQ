# Production Smoke Runbook

Use this runbook after every production deploy or major infrastructure change.

## Required environment variables

```bash
AIHQ_BACKEND_URL=https://your-backend.example.com
AIHQ_FRONTEND_URL=https://your-frontend.example.com
NEOX_FRONTEND_URL=https://your-neox-site.example.com
```

Only `AIHQ_BACKEND_URL` is required. Frontend URLs are optional.

## Run

```bash
npm run smoke:production
```

## What this checks

- `GET /health` on the AIHQ backend
- `GET /api/__buildcheck` on the AIHQ backend
- Optional AIHQ frontend reachability
- Optional Neox frontend reachability

## Expected result

The script should finish with:

```text
Production smoke passed.
```

## Failure handling

If `/health` fails:

1. Check database availability.
2. Check worker readiness.
3. Check runtime incident summary.
4. Check pending migrations or migration drift.
5. Check production environment variables.

If `/api/__buildcheck` fails:

1. Verify backend deploy completed.
2. Verify routing points to the latest backend.
3. Verify diagnostics guard configuration.
4. Check backend logs.

If frontend checks fail:

1. Verify Cloudflare Pages deployment.
2. Verify build command and output directory.
3. Verify environment variables.
4. Check DNS and custom domain status.
## Protected diagnostics routes

`/api/__buildcheck` may be hidden behind the diagnostics guard in production. If it returns `404`, run smoke with one of these tokens:

```bash
DEBUG_API_TOKEN=... AIHQ_BACKEND_URL=https://your-backend.example.com npm run smoke:production
```

or:

```bash
AIHQ_INTERNAL_TOKEN=... AIHQ_BACKEND_URL=https://your-backend.example.com npm run smoke:production
```

Do not paste these tokens into chat or commit them to the repository.

