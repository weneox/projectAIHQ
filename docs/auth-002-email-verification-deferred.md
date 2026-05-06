# AUTH-002 Deferred: 6-Digit Email Verification

AUTH-002 is intentionally deferred from runtime in the current repo state.

## Why it was deferred

- The partial backend verification route and code service were not wired into the live auth router.
- The repo does not contain an existing transactional email delivery path, provider integration, or email transport dependency for sending verification codes.
- Leaving production-looking verification code under `src/` without a working delivery mechanism would make signup appear supported while real users could not receive a code.
- The old `/verify-email` page was also misleading because signup no longer sent any verification email.

## What stayed active

- `src/services/auth/selfServiceWorkspace.js`

This file is part of the live signup architecture. It safely creates the tenant, canonical identity, membership, and tenant user inside the existing guarded auth flow.

## Correct future implementation path

When AUTH-002 is resumed, use this shape:

1. Generate a 6-digit code on signup.
2. Store only a hashed code plus metadata in `auth_identities.meta`.
3. Send the code through a real email delivery adapter.
4. Add live routes for:
   - `POST /api/auth/verify-email-code`
   - `POST /api/auth/resend-verification-code`
5. Update the frontend `/verify-email` page only when delivery, resend, cooldown, and error handling are all working together.
6. Keep backend responses free of secrets and internal tenant/database errors.

## Product behavior until AUTH-002 is resumed

- Signup creates the account and workspace session.
- Signup continues directly into the app instead of redirecting to a verification screen that cannot succeed.
- `/verify-email` now redirects back to `/login` rather than presenting a broken or misleading flow.
