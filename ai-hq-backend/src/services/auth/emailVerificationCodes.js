import crypto from "crypto";

import { dbGetAuthIdentityByEmail, dbUpdateAuthIdentity } from "../../db/helpers/authIdentities.js";
import { runWithTenantContext } from "../../db/tenantContext.js";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  registerFailedLoginAttempt,
} from "../../utils/adminAuth.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_BLOCK_MS = 10 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_BLOCK_MS = 5 * 60 * 1000;
const RESEND_MAX_ATTEMPTS = 5;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function nowMs() {
  return Date.now();
}

function addMs(ms) {
  return new Date(nowMs() + Number(ms || 0)).toISOString();
}

function retryAfterSeconds(resetAt) {
  return Math.max(1, Math.ceil((Number(resetAt || 0) - nowMs()) / 1000));
}

function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code, salt) {
  return crypto
    .createHash("sha256")
    .update(`${s(salt)}:${s(code)}`, "utf8")
    .digest("hex");
}

function safeEqualText(a, b) {
  const aa = Buffer.from(s(a), "utf8");
  const bb = Buffer.from(s(b), "utf8");
  if (aa.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verificationMeta(identity = {}) {
  const meta = identity?.meta && typeof identity.meta === "object" ? identity.meta : {};
  const verification =
    meta.emailVerification && typeof meta.emailVerification === "object"
      ? meta.emailVerification
      : {};
  return { meta, verification };
}

async function updateIdentityVerificationMeta(db, identity, nextVerification, extra = {}) {
  const { meta } = verificationMeta(identity);
  return dbUpdateAuthIdentity(db, identity.id, {
    primary_email: identity.primary_email || identity.normalized_email,
    normalized_email: identity.normalized_email || identity.primary_email,
    password_hash: identity.password_hash,
    auth_provider: identity.auth_provider || "local",
    provider_subject: identity.provider_subject || null,
    email_verified: Object.prototype.hasOwnProperty.call(extra, "emailVerified")
      ? extra.emailVerified === true
      : identity.email_verified,
    status: identity.status || "active",
    meta: {
      ...meta,
      emailVerification: nextVerification,
    },
    last_login_at: identity.last_login_at || null,
  });
}

async function markTenantUserVerified(db, { tenantId, tenantKey, email, requestId = "" } = {}) {
  if (!db || !tenantId || !email) return;
  await runWithTenantContext(
    {
      tenantId,
      tenantKey,
      requestId,
      source: "auth.email_verification",
      reason: "mark_tenant_user_email_verified",
    },
    () =>
      db.query(
        `
        update tenant_users
        set email_verified = true,
            updated_at = now()
        where tenant_id = $1
          and lower(user_email) = $2
        `,
        [tenantId, lower(email)]
      )
  );
}

export async function createEmailVerificationCode(
  db,
  {
    email,
    identityId = "",
    tenantId = "",
    tenantKey = "",
    tenantUserId = "",
    ip = "unknown",
    requestId = "",
    codeGenerator = randomCode,
  } = {}
) {
  const normalizedEmail = lower(email);
  const identity = await dbGetAuthIdentityByEmail(db, normalizedEmail);
  if (!identity?.id || (identityId && s(identity.id) !== s(identityId))) {
    const error = new Error("verification identity not found");
    error.code = "verification_identity_not_found";
    throw error;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const code = s(codeGenerator()).replace(/\D/g, "").slice(0, 6).padStart(6, "0");
  const expiresAt = addMs(CODE_TTL_MS);
  const issuedAt = new Date().toISOString();
  const nextVerification = {
    codeHash: hashCode(code, salt),
    salt,
    issuedAt,
    expiresAt,
    tenantId: s(tenantId),
    tenantKey: lower(tenantKey),
    tenantUserId: s(tenantUserId),
    requestId: s(requestId),
    status: "pending",
    lastResentAt: issuedAt,
  };

  await updateIdentityVerificationMeta(db, identity, nextVerification);

  return {
    ok: true,
    email: normalizedEmail,
    emailSent: false,
    expiresAt,
    expiresInSeconds: Math.ceil(CODE_TTL_MS / 1000),
    resendCooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    codeForTest: process.env.NODE_ENV === "test" ? code : undefined,
  };
}

export async function verifyEmailCode(db, { email, code, ip = "unknown", requestId = "" } = {}) {
  const normalizedEmail = lower(email);
  const cleanCode = s(code).replace(/\D/g, "");
  if (!normalizedEmail || !cleanCode) {
    return { ok: false, status: 400, code: "verification_code_required" };
  }

  const scopeKey = `email_verify:${normalizedEmail}`;
  const limit = await checkLoginRateLimit(db, {
    actorType: "user",
    scopeKey,
    ip,
    windowMs: VERIFY_WINDOW_MS,
    maxAttempts: VERIFY_MAX_ATTEMPTS,
  });
  if (!limit.ok) {
    return {
      ok: false,
      status: 429,
      code: "verification_rate_limited",
      retryAfterSeconds: retryAfterSeconds(limit.resetAt),
    };
  }

  const identity = await dbGetAuthIdentityByEmail(db, normalizedEmail);
  const { verification } = verificationMeta(identity);
  if (!identity?.id || !verification?.codeHash || !verification?.salt) {
    return { ok: false, status: 404, code: "verification_code_not_found" };
  }

  const expiresMs = new Date(verification.expiresAt || 0).getTime();
  if (!expiresMs || expiresMs <= nowMs()) {
    return { ok: false, status: 410, code: "verification_code_expired" };
  }

  const expected = hashCode(cleanCode, verification.salt);
  if (!safeEqualText(expected, verification.codeHash)) {
    await registerFailedLoginAttempt(db, {
      actorType: "user",
      scopeKey,
      ip,
      windowMs: VERIFY_WINDOW_MS,
      maxAttempts: VERIFY_MAX_ATTEMPTS,
      blockMs: VERIFY_BLOCK_MS,
    });
    return { ok: false, status: 400, code: "verification_code_invalid" };
  }

  const verifiedAt = new Date().toISOString();
  await updateIdentityVerificationMeta(
    db,
    identity,
    {
      status: "verified",
      verifiedAt,
      tenantId: verification.tenantId || "",
      tenantKey: verification.tenantKey || "",
      tenantUserId: verification.tenantUserId || "",
    },
    { emailVerified: true }
  );

  await markTenantUserVerified(db, {
    tenantId: verification.tenantId,
    tenantKey: verification.tenantKey,
    email: normalizedEmail,
    requestId,
  });
  await clearLoginAttempts(db, { actorType: "user", scopeKey, ip });

  return {
    ok: true,
    status: 200,
    email: normalizedEmail,
    verified: true,
  };
}

export async function resendEmailVerificationCode(
  db,
  { email, ip = "unknown", requestId = "", codeGenerator = randomCode } = {}
) {
  const normalizedEmail = lower(email);
  const identity = await dbGetAuthIdentityByEmail(db, normalizedEmail);
  if (!identity?.id) {
    return { ok: false, status: 404, code: "verification_identity_not_found" };
  }

  const { verification } = verificationMeta(identity);
  const lastSentMs = new Date(verification.lastResentAt || verification.issuedAt || 0).getTime();
  const cooldownRemainingMs = lastSentMs
    ? Math.max(0, lastSentMs + RESEND_COOLDOWN_MS - nowMs())
    : 0;
  if (cooldownRemainingMs > 0) {
    return {
      ok: false,
      status: 429,
      code: "verification_resend_cooldown",
      retryAfterSeconds: Math.max(1, Math.ceil(cooldownRemainingMs / 1000)),
      cooldownSeconds: Math.max(1, Math.ceil(cooldownRemainingMs / 1000)),
    };
  }

  const scopeKey = `email_verify_resend:${normalizedEmail}`;
  const limit = await checkLoginRateLimit(db, {
    actorType: "user",
    scopeKey,
    ip,
    windowMs: RESEND_WINDOW_MS,
    maxAttempts: RESEND_MAX_ATTEMPTS,
  });
  if (!limit.ok) {
    return {
      ok: false,
      status: 429,
      code: "verification_resend_rate_limited",
      retryAfterSeconds: retryAfterSeconds(limit.resetAt),
    };
  }

  await registerFailedLoginAttempt(db, {
    actorType: "user",
    scopeKey,
    ip,
    windowMs: RESEND_WINDOW_MS,
    maxAttempts: RESEND_MAX_ATTEMPTS,
    blockMs: RESEND_BLOCK_MS,
  });

  const created = await createEmailVerificationCode(db, {
    email: normalizedEmail,
    identityId: identity.id,
    tenantId: verification.tenantId || "",
    tenantKey: verification.tenantKey || "",
    tenantUserId: verification.tenantUserId || "",
    ip,
    requestId,
    codeGenerator,
  });

  return {
    ...created,
    status: 200,
    cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
  };
}

export const __test__ = {
  hashCode,
  verificationMeta,
};
