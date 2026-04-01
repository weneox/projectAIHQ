import crypto from "crypto";

function rowOrNull(result) {
  return result?.rows?.[0] || null;
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function hashSessionToken(token = "") {
  return crypto
    .createHash("sha256")
    .update(String(token || ""), "utf8")
    .digest("hex");
}

function normalizeSessionRow(row) {
  if (!row) return null;

  return {
    id: cleanString(row.id),
    identity_id: cleanString(row.identity_id),
    active_tenant_id: cleanString(row.active_tenant_id),
    active_membership_id: cleanString(row.active_membership_id),
    session_token_hash: cleanString(row.session_token_hash),
    session_version: Number(row.session_version || 1),
    ip: cleanString(row.ip),
    user_agent: cleanString(row.user_agent),
    expires_at: row.expires_at || null,
    revoked_at: row.revoked_at || null,
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
  };
}

function pickSessionColumns(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
    ${prefix}id,
    ${prefix}identity_id,
    ${prefix}active_tenant_id,
    ${prefix}active_membership_id,
    ${prefix}session_token_hash,
    ${prefix}session_version,
    ${prefix}ip,
    ${prefix}user_agent,
    ${prefix}expires_at,
    ${prefix}revoked_at,
    ${prefix}created_at,
    ${prefix}last_seen_at
  `;
}

export async function dbCreateAuthIdentitySession(db, input = {}) {
  if (!db || !input.identity_id || !input.session_token_hash || !input.expires_at) {
    return null;
  }

  const query = await db.query(
    `
      insert into auth_identity_sessions (
        identity_id,
        active_tenant_id,
        active_membership_id,
        session_token_hash,
        session_version,
        ip,
        user_agent,
        expires_at,
        last_seen_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      returning
        ${pickSessionColumns()}
    `,
    [
      cleanString(input.identity_id),
      cleanString(input.active_tenant_id),
      cleanString(input.active_membership_id),
      cleanString(input.session_token_hash),
      Number(input.session_version || 1),
      cleanString(input.ip),
      cleanString(input.user_agent),
      input.expires_at,
      input.last_seen_at || null,
    ]
  );

  return normalizeSessionRow(rowOrNull(query));
}

export async function dbLoadAuthIdentitySessionByTokenHash(db, sessionTokenHash = "") {
  if (!db || !sessionTokenHash) return null;

  const query = await db.query(
    `
      select
        ${pickSessionColumns()}
      from auth_identity_sessions
      where session_token_hash = $1
      limit 1
    `,
    [cleanString(sessionTokenHash)]
  );

  return normalizeSessionRow(rowOrNull(query));
}

export async function dbLoadAuthIdentitySessionByToken(db, token = "") {
  if (!token) return null;
  return dbLoadAuthIdentitySessionByTokenHash(db, hashSessionToken(token));
}

export async function dbRevokeAuthIdentitySessionByTokenHash(db, sessionTokenHash = "") {
  if (!db || !sessionTokenHash) return false;

  const query = await db.query(
    `
      update auth_identity_sessions
      set revoked_at = now(), last_seen_at = now()
      where session_token_hash = $1
        and revoked_at is null
    `,
    [cleanString(sessionTokenHash)]
  );

  return Number(query?.rowCount || 0) > 0;
}

export async function dbRevokeAuthIdentitySessionByToken(db, token = "") {
  if (!token) return false;
  return dbRevokeAuthIdentitySessionByTokenHash(db, hashSessionToken(token));
}

export const __test__ = {
  hashSessionToken,
  normalizeSessionRow,
};
