import express from "express";

import {
  PASSWORD_REQUIREMENT_CODES,
  checkLoginRateLimit,
  clearLoginAttempts,
  clearUserCookie,
  createUserSessionRecord,
  getUserCookieName,
  hashUserPassword,
  isUserAuthConfigured,
  registerFailedLoginAttempt,
  userCookieOptions,
  validateStrongUserPassword,
} from "../../../utils/adminAuth.js";
import { writeTenantLifecycleEvent } from "../../../db/helpers/tenantLifecycle.js";
import { runWithTenantContext } from "../../../db/tenantContext.js";
import { listLegacyTenantUsersByEmail } from "../../../services/auth/canonicalUserAccess.js";
import { createSelfServiceWorkspace } from "../../../services/auth/selfServiceWorkspace.js";
import { loadActiveWorkspaceContract } from "../../../services/workspace/activeWorkspace.js";
import { issueEmailVerification } from "../../../services/auth/emailVerification.js";
import { writeAudit } from "../../../utils/auditLog.js";
import { isLikelyEmail } from "../tenants/utils.js";
import { markIdentityLogin, markUserLogin } from "./repository.js";
import { getIp, lower, s, setNoStore } from "./utils.js";

const SIGNUP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_RATE_LIMIT_BLOCK_MS = 10 * 60 * 1000;
const SIGNUP_RATE_LIMIT_EMAIL_MAX_ATTEMPTS = 5;
const SIGNUP_RATE_LIMIT_IP_MAX_ATTEMPTS = 30;

function retrySecondsUntil(resetAt) {
  return Math.max(1, Math.ceil((Number(resetAt || 0) - Date.now()) / 1000));
}

function buildSignupRateLimitBuckets(email, ip) {
  return [
    {
      scopeType: "ip",
      scopeKey: `signup:create:ip:${s(ip || "unknown").toLowerCase()}`,
      maxAttempts: SIGNUP_RATE_LIMIT_IP_MAX_ATTEMPTS,
    },
    {
      scopeType: "email",
      scopeKey: `signup:create:email:${lower(email)}`,
      maxAttempts: SIGNUP_RATE_LIMIT_EMAIL_MAX_ATTEMPTS,
    },
  ];
}

async function checkSignupRateLimit(db, { email, ip }) {
  const buckets = buildSignupRateLimitBuckets(email, ip);

  for (const bucket of buckets) {
    const result = await checkLoginRateLimit(db, {
      actorType: "user",
      scopeKey: bucket.scopeKey,
      ip,
      windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
      maxAttempts: bucket.maxAttempts,
    });

    if (!result.ok) {
      return {
        ok: false,
        scopeType: bucket.scopeType,
        scopeKey: bucket.scopeKey,
        resetAt: result.resetAt,
        retryAfterSeconds: retrySecondsUntil(result.resetAt),
      };
    }
  }

  return { ok: true };
}

async function recordSignupAttempt(db, { email, ip }) {
  const buckets = buildSignupRateLimitBuckets(email, ip);

  await Promise.allSettled(
    buckets.map((bucket) =>
      registerFailedLoginAttempt(db, {
        actorType: "user",
        scopeKey: bucket.scopeKey,
        ip,
        windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
        maxAttempts: bucket.maxAttempts,
        blockMs: SIGNUP_RATE_LIMIT_BLOCK_MS,
      })
    )
  );
}

async function softenSuccessfulSignupBucket(db, { email, ip }) {
  await clearLoginAttempts(db, {
    actorType: "user",
    scopeKey: `signup:create:email:${lower(email)}`,
    ip,
  });
}

export function userSignupRoutes({
  db,
  resolveWorkspaceState = loadActiveWorkspaceContract,
} = {}) {
  const r = express.Router();

  r.post("/auth/signup", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
      });
    }

    if (!isUserAuthConfigured()) {
      return res.status(500).json({
        ok: false,
        error: "User auth is not configured",
      });
    }

    const email = lower(req.body?.email);
    const password = s(req.body?.password);
    const fullName = s(req.body?.fullName || req.body?.full_name);
    const companyName = s(req.body?.companyName || req.body?.company_name);
    const websiteUrl = s(req.body?.websiteUrl || req.body?.website_url);
    const explicitTenantKey = s(req.body?.tenantKey || req.body?.tenant_key).toLowerCase();
    const ip = getIp(req);

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required" });
    }

    if (!isLikelyEmail(email)) {
      return res.status(400).json({ ok: false, error: "email is invalid" });
    }

    if (!password) {
      return res.status(400).json({ ok: false, error: "password is required" });
    }

    if (!companyName) {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }

    const passwordStrength = validateStrongUserPassword(password, {
      email,
      companyName,
      fullName,
    });
    if (!passwordStrength.ok) {
      return res.status(400).json({
        ok: false,
        error: "password does not meet strength requirements",
        code: "weak_password",
        requirements: PASSWORD_REQUIREMENT_CODES,
        failures: passwordStrength.failures,
      });
    }

    try {
      const rateLimit = await checkSignupRateLimit(db, { email, ip });
      if (!rateLimit.ok) {
        if (rateLimit.retryAfterSeconds) {
          res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
        }

        return res.status(429).json({
          ok: false,
          error: "Too many attempts. Try again in a few minutes.",
          code: "signup_rate_limited",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          retryAt: rateLimit.resetAt
            ? new Date(rateLimit.resetAt).toISOString()
            : null,
        });
      }

      await recordSignupAttempt(db, { email, ip });

      const legacyUsers = await listLegacyTenantUsersByEmail(db, { email });
      if (legacyUsers.length) {
        return res.status(409).json({
          ok: false,
          error: "An account with this email already exists",
          code: "identity_exists",
        });
      }

      const created = await createSelfServiceWorkspace({
        db,
        requestId: req.requestId,
        source: "auth.signup",
        email,
        fullName,
        companyName,
        websiteUrl,
        explicitTenantKey,
        passwordHash: hashUserPassword(password),
        authProvider: "local",
        emailVerified: false,
        userMeta: {
          signupCreated: true,
          emailVerificationRequired: true,
        },
      });

      let emailVerification = {
        ok: false,
        delivery: {
          ok: false,
          skipped: true,
          reason: "not_attempted",
        },
      };

      try {
        emailVerification = await issueEmailVerification(db, {
          identityId: created.identity.id,
          email,
          req,
          meta: {
            tenantId: created.tenant.id,
            tenantKey: created.tenant.tenant_key,
            source: "auth.signup",
          },
        });
      } catch (verificationError) {
        req.log?.warn?.("auth.signup.email_verification_issue_failed", {
          requestId: req.requestId || null,
          identityId: created.identity?.id || null,
          tenantId: created.tenant?.id || null,
          code: verificationError?.code || "email_verification_issue_failed",
          error: String(
            verificationError?.message ||
              verificationError ||
              "email_verification_issue_failed"
          ),
        });

        emailVerification = {
          ok: false,
          delivery: {
            ok: false,
            skipped: true,
            reason: "email_verification_issue_failed",
          },
        };
      }

      const workspace = await runWithTenantContext(
        {
          tenantId: created.tenant.id,
          tenantKey: created.tenant.tenant_key,
          requestId: req.requestId,
          source: "auth.signup",
          reason: "self_service_signup_workspace_resolution",
        },
        () =>
          resolveWorkspaceState({
            db,
            tenantId: created.tenant.id,
            tenantKey: created.tenant.tenant_key,
            membershipId: created.membership.id,
            role: created.membership.role,
            tenant: {
              id: created.tenant.id,
              tenant_key: created.tenant.tenant_key,
              company_name: created.tenant.company_name,
            },
          })
      );

      const { token, expiresAt } = await createUserSessionRecord(
        db,
        {
          identityId: created.identity.id,
          membershipId: created.membership.id,
          tenant_id: created.tenant.id,
          tenant_key: created.tenant.tenant_key,
          session_version: 1,
        },
        {
          ip,
          ua: s(req.headers["user-agent"]),
        }
      );

      clearUserCookie(res);
      res.cookie(getUserCookieName(), token, userCookieOptions(req));

      await runWithTenantContext(
        {
          tenantId: created.tenant.id,
          tenantKey: created.tenant.tenant_key,
          requestId: req.requestId,
          source: "auth.signup",
          reason: "self_service_signup_side_effects",
        },
        () =>
          Promise.allSettled([
            markIdentityLogin(db, created.identity.id),
            markUserLogin(db, {
              ...created.user,
              tenant_key: created.tenant.tenant_key,
            }),
            writeAudit(db, {
              tenantId: created.tenant.id,
              tenantKey: created.tenant.tenant_key,
              requestId: req.requestId,
              actor: "user_signup",
              action: "tenant.signup.created",
              objectType: "tenant",
              objectId: created.tenant.id,
              meta: {
                email,
                planKey: created.tenant.plan_key || "free",
                billingStatus: created.tenant.billing_status || "trialing",
              },
            }),
            writeTenantLifecycleEvent(db, {
              tenantId: created.tenant.id,
              tenantKey: created.tenant.tenant_key,
              actor: "user_signup",
              action: "tenant.created",
              statusFrom: "",
              statusTo: created.tenant.lifecycle_status || created.tenant.status || "trial",
              reason: "self_service_signup",
              requestId: req.requestId,
              meta: {
                email,
                planKey: created.tenant.plan_key || "free",
              },
            }),
          ])
      );

      await softenSuccessfulSignupBucket(db, { email, ip });

      return res.status(201).json({
        ok: true,
        created: true,
        authenticated: true,
        authType: "tenant_user",
        user: {
          id: created.user.id,
          email: created.identity.primary_email || created.identity.normalized_email,
          fullName: created.user.full_name || "",
          role: created.user.role,
          emailVerified: false,
          tenantId: created.tenant.id,
          tenantKey: created.tenant.tenant_key,
          companyName: created.tenant.company_name || "",
          identityId: created.identity.id,
          membershipId: created.membership.id,
          sessionExpiresAt: expiresAt,
        },
        workspace,
        destination: workspace?.destination || {
          kind: "setup",
          path: "/home?assistant=setup",
        },
        emailVerification: {
          required: true,
          sent: emailVerification?.delivery?.ok === true,
          delivery: {
            ok: emailVerification?.delivery?.ok === true,
            provider: emailVerification?.delivery?.provider || "",
            skipped: emailVerification?.delivery?.skipped === true,
            reason: emailVerification?.delivery?.reason || "",
          },
        },
      });
    } catch (error) {
      req.log?.error?.("auth.signup.failed", {
        code: error?.code || "signup_failed",
        requestId: req.requestId || null,
      });
      return res.status(500).json({
        ok: false,
        error: "Signup could not be completed. Try again in a moment.",
        code: "signup_failed",
      });
    }
  });

  return r;
}

