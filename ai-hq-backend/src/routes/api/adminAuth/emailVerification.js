import express from "express";
import {
  issueEmailVerification,
  verifyEmailToken,
} from "../../../services/auth/emailVerification.js";
import {
  loadUserSessionFromRequest,
} from "../../../utils/adminAuth.js";
import { s, setNoStore } from "./utils.js";


function shouldExposeVerificationCodeForOps(req) {
  const expected = s(
    process.env.AUTH_DEBUG_VERIFICATION_CODE_TOKEN ||
      process.env.DEBUG_API_TOKEN ||
      ""
  );

  if (!expected) return false;

  const provided = s(
    req?.headers?.["x-debug-token"] ||
      req?.headers?.["x-internal-token"] ||
      req?.query?.debugToken ||
      req?.body?.debugToken
  );

  return provided && provided === expected;
}

function maybeDebugVerificationCode(req, issued) {
  if (!shouldExposeVerificationCodeForOps(req)) return {};
  const code = s(issued?.verificationCode);
  if (!code) return {};
  return {
    debug: {
      verificationCode: code,
      warning: "Visible only because AUTH_DEBUG_VERIFICATION_CODE_TOKEN or DEBUG_API_TOKEN matched.",
    },
  };
}

function verificationErrorResponse(res, result = {}) {
  return res.status(Number(result.status || 400)).json({
    ok: false,
    verified: false,
    error: result.error || "Email verification failed",
    code: result.code || "email_verification_failed",
    email: result.email || null,
  });
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

    const result = await verifyEmailToken(db, token);

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
        error: "Sign in again to resend verification email",
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
      ...maybeDebugVerificationCode(req, issued),
    });
  });

  return r;
}
