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

function createRawVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
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
    ttlHours = Number(process.env.AUTH_EMAIL_VERIFICATION_TTL_HOURS || 24),
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

  const rawToken = createRawVerificationToken();
  const hash = tokenHash(rawToken);
  const safeTtlHours = Math.max(1, Math.min(168, Number(ttlHours || 24)));

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
      values (
        $1,
        $2,
        $3,
        'email_verification',
        now() + ($4::text || ' hours')::interval,
        $5,
        $6,
        $7::jsonb
      )
    `,
    [
      safeIdentityId,
      hash,
      safeEmail,
      safeTtlHours,
      getIp(req),
      s(req?.headers?.["user-agent"]),
      JSON.stringify(meta && typeof meta === "object" ? meta : {}),
    ]
  );

  return {
    token: rawToken,
    tokenHash: hash,
    verificationUrl: buildEmailVerificationUrl(rawToken),
  };
}

async function sendWithResend({ to = "", verificationUrl = "" } = {}) {
  const apiKey = s(process.env.RESEND_API_KEY);
  const from = s(process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL);
  const appName = s(process.env.AUTH_APP_NAME || "AIHQ");

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      skipped: true,
      reason: "resend_not_configured",
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
      subject: `Verify your ${appName} email`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827">
          <h2 style="margin:0 0 12px">Verify your email</h2>
          <p style="margin:0 0 16px">Confirm this email address to finish securing your workspace.</p>
          <p style="margin:0 0 20px">
            <a href="${verificationUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700">
              Verify email
            </a>
          </p>
          <p style="font-size:13px;color:#6b7280;margin:0">
            If the button does not work, copy and paste this link:<br />
            <span style="word-break:break-all">${verificationUrl}</span>
          </p>
        </div>
      `,
      text: `Verify your email: ${verificationUrl}`,
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

export async function sendVerificationEmail({ email = "", verificationUrl = "" } = {}) {
  const safeEmail = lower(email);
  const safeUrl = s(verificationUrl);

  if (!safeEmail || !safeUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_email_or_verification_url",
    };
  }

  const result = await sendWithResend({
    to: safeEmail,
    verificationUrl: safeUrl,
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
      verificationUrl: safeUrl,
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
    verificationUrl: tokenRecord.verificationUrl,
  });

  return {
    ok: true,
    email: lower(email),
    verificationUrl: tokenRecord.verificationUrl,
    delivery,
  };
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

    if (row.consumed_at) {
      await client.query("rollback");
      return {
        ok: true,
        alreadyVerified: true,
        code: "verification_token_already_used",
        email: lower(row.email),
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

    await client.query(
      `
        update auth_identities
        set
          email_verified = true,
          status = case when status = 'invited' then 'active' else status end,
          updated_at = now()
        where id = $1
      `,
      [row.identity_id]
    );

    await client.query(
      `
        update auth_email_verification_tokens
        set consumed_at = now()
        where id = $1
      `,
      [row.id]
    );

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
