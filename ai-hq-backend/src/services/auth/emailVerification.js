import crypto from "crypto";
import { cfg } from "../../config.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function getIp(req) {
  const xfwd = s(req?.headers?.["x-forwarded-for"]);
  if (xfwd) return xfwd.split(",")[0].trim();
  return s(req?.ip) || s(req?.socket?.remoteAddress) || "unknown";
}

function tokenHash(token = "") {
  return crypto
    .createHash("sha256")
    .update(s(token), "utf8")
    .digest("hex");
}

function normalizeVerificationCode(code = "") {
  return s(code).replace(/\D/g, "").slice(0, 6);
}

function createRawVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function createRawVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function scopedCodeHash(identityId = "", code = "") {
  return tokenHash(`${s(identityId)}:${normalizeVerificationCode(code)}`);
}

function firstCorsOrigin() {
  const raw = s(cfg?.urls?.corsOrigin || process.env.CORS_ORIGIN);
  if (!raw) return "";
  return s(raw.split(",")[0]).replace(/\/+$/, "");
}

function resolveAppBaseUrl() {
  return s(
    process.env.AUTH_PUBLIC_APP_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_PUBLIC_URL ||
      firstCorsOrigin() ||
      cfg?.urls?.publicBaseUrl ||
      process.env.PUBLIC_BASE_URL ||
      ""
  ).replace(/\/+$/, "");
}

function emailTtlMinutes() {
  const value = Number(process.env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES || 15);
  if (!Number.isFinite(value)) return 15;
  return Math.max(5, Math.min(60, value));
}

export function buildEmailVerificationUrl(token = "") {
  const base = resolveAppBaseUrl();
  const safeToken = encodeURIComponent(s(token));
  if (!base) return `/verify-email?token=${safeToken}`;
  return `${base}/verify-email?token=${safeToken}`;
}

export async function createEmailVerificationToken(
  db,
  {
    identityId = "",
    email = "",
    req = null,
    ttlMinutes = emailTtlMinutes(),
    meta = {},
  } = {}
) {
  if (!db) {
    throw new Error("Database is not available");
  }

  const safeIdentityId = s(identityId);
  const safeEmail = lower(email);

  if (!safeIdentityId) {
    throw new Error("identityId is required");
  }

  if (!safeEmail) {
    throw new Error("email is required");
  }

  const code = createRawVerificationCode();
  const linkToken = createRawVerificationToken();
  const codeHash = scopedCodeHash(safeIdentityId, code);
  const linkTokenHash = tokenHash(linkToken);
  const safeTtlMinutes = Math.max(5, Math.min(60, Number(ttlMinutes || 15)));
  const baseMeta = meta && typeof meta === "object" ? meta : {};

  await db.query(
    `
      update auth_email_verification_tokens
      set consumed_at = now()
      where identity_id = $1
        and purpose = 'email_verification'
        and consumed_at is null
    `,
    [safeIdentityId]
  );

  await db.query(
    `
      insert into auth_email_verification_tokens (
        identity_id,
        token_hash,
        email,
        purpose,
        expires_at,
        created_ip,
        user_agent,
        meta
      )
      values
        (
          $1,
          $2,
          $4,
          'email_verification',
          now() + ($5::text || ' minutes')::interval,
          $6,
          $7,
          $8::jsonb
        ),
        (
          $1,
          $3,
          $4,
          'email_verification',
          now() + ($5::text || ' minutes')::interval,
          $6,
          $7,
          $9::jsonb
        )
    `,
    [
      safeIdentityId,
      codeHash,
      linkTokenHash,
      safeEmail,
      safeTtlMinutes,
      getIp(req),
      s(req?.headers?.["user-agent"]),
      JSON.stringify({ ...baseMeta, verificationKind: "code" }),
      JSON.stringify({ ...baseMeta, verificationKind: "link" }),
    ]
  );

  return {
    code,
    token: linkToken,
    tokenHash: linkTokenHash,
    codeHash,
    verificationUrl: buildEmailVerificationUrl(linkToken),
    expiresInMinutes: safeTtlMinutes,
  };
}

async function sendWithResend({
  to = "",
  verificationCode = "",
  verificationUrl = "",
  expiresInMinutes = 15,
} = {}) {
  const apiKey = s(process.env.RESEND_API_KEY);
  const from = s(process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL);
  const appName = s(process.env.AUTH_APP_NAME || "AIHQ");
  const code = normalizeVerificationCode(verificationCode);
  const url = s(verificationUrl);
  const ttl = Math.max(5, Math.min(60, Number(expiresInMinutes || 15)));

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      skipped: true,
      reason: "resend_not_configured",
    };
  }

  if (code.length !== 6 || !url) {
    return {
      ok: false,
      provider: "resend",
      skipped: true,
      reason: "invalid_verification_payload",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your ${appName} verification code`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827">
          <h2 style="margin:0 0 12px">Verify your email</h2>
          <p style="margin:0 0 16px">Use this 6-digit code to finish securing your workspace.</p>
          <div style="font-size:34px;letter-spacing:8px;font-weight:800;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:14px;padding:16px 20px;display:inline-block;margin:0 0 18px">
            ${code}
          </div>
          <p style="margin:0 0 18px">
            <a href="${url}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700">
              Verify email instead
            </a>
          </p>
          <p style="font-size:13px;color:#6b7280;margin:0">
            This code expires in ${ttl} minutes. If you did not create this workspace, you can ignore this email.
          </p>
        </div>
      `,
      text: `Your ${appName} verification code is: ${code}\n\nThis code expires in ${ttl} minutes.\n\nOr verify with this link: ${url}`,
    }),
  });

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    return {
      ok: false,
      provider: "resend",
      status: response.status,
      reason: text || "resend_email_failed",
    };
  }

  return {
    ok: true,
    provider: "resend",
    status: response.status,
  };
}

export async function sendVerificationEmail({
  email = "",
  verificationCode = "",
  verificationUrl = "",
  expiresInMinutes = 15,
} = {}) {
  const safeEmail = lower(email);
  const safeCode = normalizeVerificationCode(verificationCode);
  const safeUrl = s(verificationUrl);

  if (!safeEmail || safeCode.length !== 6 || !safeUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_email_verification_code_or_url",
    };
  }

  const result = await sendWithResend({
    to: safeEmail,
    verificationCode: safeCode,
    verificationUrl: safeUrl,
    expiresInMinutes,
  }).catch((error) => ({
    ok: false,
    provider: "resend",
    reason: s(error?.message || error || "verification_email_failed"),
  }));

  if (!result.ok) {
    console.warn("auth.email_verification.delivery_skipped_or_failed", {
      email: safeEmail,
      provider: result.provider || "none",
      reason: result.reason || "",
      status: result.status || 0,
    });
  }

  return result;
}

export async function issueEmailVerification(
  db,
  {
    identityId = "",
    email = "",
    req = null,
    meta = {},
  } = {}
) {
  const tokenRecord = await createEmailVerificationToken(db, {
    identityId,
    email,
    req,
    meta,
  });

  const delivery = await sendVerificationEmail({
    email,
    verificationCode: tokenRecord.code,
    verificationUrl: tokenRecord.verificationUrl,
    expiresInMinutes: tokenRecord.expiresInMinutes,
  });

  return {
    ok: true,
    email: lower(email),
    delivery,
  };
}

async function consumeVerificationRows(client, identityId = "") {
  await client.query(
    `
      update auth_email_verification_tokens
      set consumed_at = coalesce(consumed_at, now())
      where identity_id = $1
        and purpose = 'email_verification'
        and consumed_at is null
    `,
    [s(identityId)]
  );
}

async function applyVerifiedIdentity(client, identityId = "") {
  await client.query(
    `
      update auth_identities
      set
        email_verified = true,
        status = case when status = 'invited' then 'active' else status end,
        updated_at = now()
      where id = $1
    `,
    [s(identityId)]
  );
}

export async function verifyEmailToken(db, token = "") {
  if (!db) {
    return {
      ok: false,
      status: 503,
      code: "db_unavailable",
      error: "Database is not available",
    };
  }

  const raw = s(token);
  if (!raw) {
    return {
      ok: false,
      status: 400,
      code: "token_required",
      error: "Verification token is required",
    };
  }

  const hash = tokenHash(raw);

  const client = typeof db.connect === "function" ? await db.connect() : db;
  const ownsClient = client !== db;

  try {
    await client.query("begin");

    const found = await client.query(
      `
        select
          t.id,
          t.identity_id,
          t.email,
          t.expires_at,
          t.consumed_at,
          i.email_verified
        from auth_email_verification_tokens t
        join auth_identities i on i.id = t.identity_id
        where t.token_hash = $1
          and t.purpose = 'email_verification'
        for update
        limit 1
      `,
      [hash]
    );

    const row = found?.rows?.[0] || null;

    if (!row) {
      await client.query("rollback");
      return {
        ok: false,
        status: 400,
        code: "invalid_verification_token",
        error: "Verification link is invalid or expired",
      };
    }

    if (row.consumed_at || row.email_verified === true) {
      await client.query("rollback");
      return {
        ok: true,
        alreadyVerified: true,
        code: "verification_token_already_used",
        email: lower(row.email),
        identityId: row.identity_id,
      };
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query("rollback");
      return {
        ok: false,
        status: 400,
        code: "verification_token_expired",
        error: "Verification link has expired",
        email: lower(row.email),
      };
    }

    await applyVerifiedIdentity(client, row.identity_id);
    await consumeVerificationRows(client, row.identity_id);

    await client.query("commit");

    return {
      ok: true,
      verified: true,
      email: lower(row.email),
      identityId: row.identity_id,
    };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}

    return {
      ok: false,
      status: 500,
      code: "email_verification_failed",
      error: s(error?.message || error || "Email verification failed"),
    };
  } finally {
    if (ownsClient) {
      try {
        client.release();
      } catch {}
    }
  }
}

export async function verifyEmailCode(
  db,
  {
    identityId = "",
    email = "",
    code = "",
  } = {}
) {
  if (!db) {
    return {
      ok: false,
      status: 503,
      code: "db_unavailable",
      error: "Database is not available",
    };
  }

  const safeIdentityId = s(identityId);
  const safeEmail = lower(email);
  const safeCode = normalizeVerificationCode(code);

  if (!safeIdentityId) {
    return {
      ok: false,
      status: 401,
      code: "auth_required",
      error: "Sign in again to verify your email",
    };
  }

  if (safeCode.length !== 6) {
    return {
      ok: false,
      status: 400,
      code: "invalid_verification_code",
      error: "Enter the 6-digit verification code",
    };
  }

  const hash = scopedCodeHash(safeIdentityId, safeCode);

  const client = typeof db.connect === "function" ? await db.connect() : db;
  const ownsClient = client !== db;

  try {
    await client.query("begin");

    const found = await client.query(
      `
        select
          t.id,
          t.identity_id,
          t.email,
          t.expires_at,
          t.consumed_at,
          i.email_verified
        from auth_email_verification_tokens t
        join auth_identities i on i.id = t.identity_id
        where t.token_hash = $1
          and t.identity_id = $2
          and ($3::text = '' or lower(t.email) = lower($3))
          and t.purpose = 'email_verification'
        for update
        limit 1
      `,
      [hash, safeIdentityId, safeEmail]
    );

    const row = found?.rows?.[0] || null;

    if (!row) {
      await client.query("rollback");
      return {
        ok: false,
        status: 400,
        code: "invalid_verification_code",
        error: "Verification code is invalid or expired",
      };
    }

    if (row.consumed_at || row.email_verified === true) {
      await client.query("rollback");
      return {
        ok: true,
        alreadyVerified: true,
        code: "verification_code_already_used",
        email: lower(row.email),
        identityId: row.identity_id,
      };
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query("rollback");
      return {
        ok: false,
        status: 400,
        code: "verification_code_expired",
        error: "Verification code has expired",
        email: lower(row.email),
      };
    }

    await applyVerifiedIdentity(client, row.identity_id);
    await consumeVerificationRows(client, row.identity_id);

    await client.query("commit");

    return {
      ok: true,
      verified: true,
      email: lower(row.email),
      identityId: row.identity_id,
    };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}

    return {
      ok: false,
      status: 500,
      code: "email_verification_failed",
      error: s(error?.message || error || "Email verification failed"),
    };
  } finally {
    if (ownsClient) {
      try {
        client.release();
      } catch {}
    }
  }
}

export async function getIdentityVerificationStatus(db, identityId = "") {
  if (!db || !s(identityId)) return null;

  const result = await db.query(
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
    [s(identityId)]
  );

  return result?.rows?.[0] || null;
}
