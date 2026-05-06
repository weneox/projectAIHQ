import express from "express";
import {
  issueEmailVerification,
  verifyEmailCode,
  verifyEmailToken,
} from "../../../services/auth/emailVerification.js";
import {
  loadUserSessionFromRequest,
} from "../../../utils/adminAuth.js";
import { s, setNoStore } from "./utils.js";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS_PER_HOUR = 5;

function verificationErrorResponse(res, result = {}) {
  return res.status(Number(result.status || 400)).json({
    ok: false,
    verified: false,
    error: result.error || "Email verification failed",
    code: result.code || "email_verification_failed",
    email: result.email || null,
  });
}

function retryAfterSeconds(dateValue = null) {
  if (!dateValue) return RESEND_COOLDOWN_SECONDS;
  const last = new Date(dateValue).getTime();
  const nextAllowed = last + RESEND_COOLDOWN_SECONDS * 1000;
  return Math.max(1, Math.ceil((nextAllowed - Date.now()) / 1000));
}

async function checkResendPolicy(db, identityId = "") {
  const result = await db.query(
    `
      select
        max(created_at) as last_code_at,
        count(*) filter (
          where created_at > now() - interval '1 hour'
        )::int as recent_code_count
      from auth_email_verification_tokens
      where identity_id = $1
        and purpose = 'email_verification'
        and meta->>'verificationKind' = 'code'
    `,
    [s(identityId)]
  );

  const row = result?.rows?.[0] || {};
  const recentCount = Number(row.recent_code_count || 0);
  const lastCodeAt = row.last_code_at || null;

  if (recentCount >= MAX_RESENDS_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      code: "verification_resend_hourly_limited",
      error: "Too many verification codes requested. Try again later.",
      retryAfterSeconds: 3600,
    };
  }

  if (lastCodeAt) {
    const wait = retryAfterSeconds(lastCodeAt);
    if (wait > 0 && wait < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        status: 429,
        code: "verification_resend_cooldown",
        error: "Wait before requesting another verification code.",
        retryAfterSeconds: wait,
      };
    }
  }

  return { ok: true };
}

export function emailVerificationRoutes({ db } = {}) {
  const r = express.Router();

  r.post("/auth/verify-email", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        verified: false,
        error: "Database is not available",
        code: "db_unavailable",
      });
    }

    const token = s(req.body?.token || req.query?.token);
    const code = s(req.body?.code || req.query?.code);

    let result = null;

    if (token) {
      result = await verifyEmailToken(db, token);
    } else {
      const session = await loadUserSessionFromRequest(req, {
        db,
        touch: false,
      });

      if (!session?.ok || !session?.payload?.identityId || !session?.payload?.email) {
        return res.status(401).json({
          ok: false,
          verified: false,
          error: "Sign in again to verify your email",
          code: "auth_required",
        });
      }

      result = await verifyEmailCode(db, {
        identityId: session.payload.identityId,
        email: session.payload.email,
        code,
      });
    }

    if (!result?.ok) {
      return verificationErrorResponse(res, result);
    }

    return res.status(200).json({
      ok: true,
      verified: result.verified !== false,
      alreadyVerified: result.alreadyVerified === true,
      email: result.email || null,
      identityId: result.identityId || null,
    });
  });

  r.post("/auth/resend-verification", async (req, res) => {
    setNoStore(res);

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database is not available",
        code: "db_unavailable",
      });
    }

    const session = await loadUserSessionFromRequest(req, {
      db,
      touch: false,
    });

    if (!session?.ok || !session?.payload?.identityId || !session?.payload?.email) {
      return res.status(401).json({
        ok: false,
        error: "Sign in again to resend verification code",
        code: "auth_required",
      });
    }

    const identityResult = await db.query(
      `
        select
          id,
          primary_email,
          normalized_email,
          email_verified,
          status
        from auth_identities
        where id = $1
        limit 1
      `,
      [session.payload.identityId]
    );

    const identity = identityResult?.rows?.[0] || null;

    if (!identity?.id) {
      return res.status(404).json({
        ok: false,
        error: "Identity not found",
        code: "identity_not_found",
      });
    }

    if (identity.email_verified === true) {
      return res.status(200).json({
        ok: true,
        alreadyVerified: true,
        sent: false,
        email: identity.primary_email || identity.normalized_email || session.payload.email,
      });
    }

    const policy = await checkResendPolicy(db, identity.id);
    if (!policy.ok) {
      if (policy.retryAfterSeconds) {
        res.setHeader("Retry-After", String(policy.retryAfterSeconds));
      }

      return res.status(policy.status || 429).json({
        ok: false,
        error: policy.error,
        code: policy.code,
        retryAfterSeconds: policy.retryAfterSeconds || null,
      });
    }

    const issued = await issueEmailVerification(db, {
      identityId: identity.id,
      email: identity.primary_email || identity.normalized_email || session.payload.email,
      req,
      meta: {
        source: "auth.resend_verification",
        tenantId: session.payload.tenantId || "",
        tenantKey: session.payload.tenantKey || "",
      },
    });

    return res.status(200).json({
      ok: true,
      alreadyVerified: false,
      sent: issued?.delivery?.ok === true,
      email: issued?.email || identity.primary_email || identity.normalized_email || session.payload.email,
      delivery: {
        ok: issued?.delivery?.ok === true,
        provider: issued?.delivery?.provider || "",
        skipped: issued?.delivery?.skipped === true,
        reason: issued?.delivery?.reason || "",
      },
    });
  });

  return r;
}
