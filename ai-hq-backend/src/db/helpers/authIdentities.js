function rowOrNull(result) {
  return result?.rows?.[0] || null;
}

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function cleanLower(value, fallback = "") {
  return cleanString(value, fallback).toLowerCase();
}

function cleanNullableString(value) {
  const text = cleanString(value);
  return text ? text : null;
}

function asBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asJsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function json(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function normalizeProvider(value) {
  const provider = cleanLower(value, "local");
  if (["local", "google", "microsoft", "magic_link", "system"].includes(provider)) {
    return provider;
  }
  return "local";
}

function normalizeStatus(value) {
  const status = cleanLower(value, "active");
  if (["invited", "active", "disabled", "removed"].includes(status)) {
    return status;
  }
  return "active";
}

function normalizeIdentityRow(row) {
  if (!row) return null;

  return {
    id: cleanString(row.id),
    primary_email: cleanString(row.primary_email),
    normalized_email: cleanLower(row.normalized_email || row.primary_email),
    password_hash: cleanNullableString(row.password_hash),
    auth_provider: normalizeProvider(row.auth_provider),
    provider_subject: cleanNullableString(row.provider_subject),
    email_verified: asBool(row.email_verified, false),
    status: normalizeStatus(row.status),
    meta: asJsonObject(row.meta, {}),
    last_login_at: row.last_login_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function pickIdentityColumns(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
    ${prefix}id,
    ${prefix}primary_email,
    ${prefix}normalized_email,
    ${prefix}password_hash,
    ${prefix}auth_provider,
    ${prefix}provider_subject,
    ${prefix}email_verified,
    ${prefix}status,
    ${prefix}meta,
    ${prefix}last_login_at,
    ${prefix}created_at,
    ${prefix}updated_at
  `;
}

export async function dbGetAuthIdentityByEmail(db, email) {
  const normalizedEmail = cleanLower(email);
  if (!db || !normalizedEmail) return null;

  const query = await db.query(
    `
      select
        ${pickIdentityColumns()}
      from auth_identities
      where normalized_email = $1
      limit 1
    `,
    [normalizedEmail]
  );

  return normalizeIdentityRow(rowOrNull(query));
}

export async function dbGetAuthIdentityByProviderSubject(db, authProvider, providerSubject) {
  const provider = normalizeProvider(authProvider);
  const subject = cleanNullableString(providerSubject);
  if (!db || !subject) return null;

  const query = await db.query(
    `
      select
        ${pickIdentityColumns()}
      from auth_identities
      where auth_provider = $1
        and provider_subject = $2
      limit 1
    `,
    [provider, subject]
  );

  return normalizeIdentityRow(rowOrNull(query));
}

export async function dbCreateAuthIdentity(db, input = {}) {
  if (!db) return null;

  const primaryEmail = cleanString(input.primary_email || input.email);
  const normalizedEmail = cleanLower(input.normalized_email || primaryEmail);
  if (!primaryEmail || !normalizedEmail) return null;

  const query = await db.query(
    `
      insert into auth_identities (
        primary_email,
        normalized_email,
        password_hash,
        auth_provider,
        provider_subject,
        email_verified,
        status,
        meta,
        last_login_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      returning
        ${pickIdentityColumns()}
    `,
    [
      primaryEmail,
      normalizedEmail,
      cleanNullableString(input.password_hash),
      normalizeProvider(input.auth_provider),
      cleanNullableString(input.provider_subject),
      asBool(input.email_verified, false),
      normalizeStatus(input.status),
      json(asJsonObject(input.meta, {}), {}),
      input.last_login_at || null,
    ]
  );

  return normalizeIdentityRow(rowOrNull(query));
}

export async function dbUpdateAuthIdentity(db, identityId, input = {}) {
  if (!db || !identityId) return null;

  const current = await dbGetAuthIdentityById(db, identityId);
  if (!current) return null;

  const primaryEmail = cleanString(input.primary_email || current.primary_email);
  const normalizedEmail = cleanLower(input.normalized_email || primaryEmail);

  const query = await db.query(
    `
      update auth_identities
      set
        primary_email = $2,
        normalized_email = $3,
        password_hash = $4,
        auth_provider = $5,
        provider_subject = $6,
        email_verified = $7,
        status = $8,
        meta = $9::jsonb,
        last_login_at = $10
      where id = $1
      returning
        ${pickIdentityColumns()}
    `,
    [
      identityId,
      primaryEmail,
      normalizedEmail,
      Object.prototype.hasOwnProperty.call(input, "password_hash")
        ? cleanNullableString(input.password_hash)
        : current.password_hash,
      normalizeProvider(input.auth_provider || current.auth_provider),
      Object.prototype.hasOwnProperty.call(input, "provider_subject")
        ? cleanNullableString(input.provider_subject)
        : current.provider_subject,
      Object.prototype.hasOwnProperty.call(input, "email_verified")
        ? asBool(input.email_verified, false)
        : current.email_verified,
      normalizeStatus(input.status || current.status),
      json(asJsonObject(input.meta, current.meta || {}), {}),
      Object.prototype.hasOwnProperty.call(input, "last_login_at")
        ? input.last_login_at || null
        : current.last_login_at,
    ]
  );

  return normalizeIdentityRow(rowOrNull(query));
}

export async function dbGetAuthIdentityById(db, identityId) {
  if (!db || !identityId) return null;

  const query = await db.query(
    `
      select
        ${pickIdentityColumns()}
      from auth_identities
      where id = $1
      limit 1
    `,
    [identityId]
  );

  return normalizeIdentityRow(rowOrNull(query));
}

export async function dbUpsertLocalAuthIdentityByEmail(db, input = {}) {
  const primaryEmail = cleanString(input.primary_email || input.email);
  const normalizedEmail = cleanLower(input.normalized_email || primaryEmail);
  if (!db || !primaryEmail || !normalizedEmail) return null;

  const existing = await dbGetAuthIdentityByEmail(db, normalizedEmail);
  if (existing?.id) {
    return dbUpdateAuthIdentity(db, existing.id, {
      primary_email: primaryEmail,
      normalized_email: normalizedEmail,
      password_hash: Object.prototype.hasOwnProperty.call(input, "password_hash")
        ? input.password_hash
        : existing.password_hash,
      auth_provider: input.auth_provider || existing.auth_provider || "local",
      provider_subject: Object.prototype.hasOwnProperty.call(input, "provider_subject")
        ? input.provider_subject
        : existing.provider_subject,
      email_verified: Object.prototype.hasOwnProperty.call(input, "email_verified")
        ? input.email_verified
        : existing.email_verified,
      status: input.status || existing.status,
      meta: asJsonObject(input.meta, existing.meta || {}),
      last_login_at: Object.prototype.hasOwnProperty.call(input, "last_login_at")
        ? input.last_login_at
        : existing.last_login_at,
    });
  }

  return dbCreateAuthIdentity(db, {
    primary_email: primaryEmail,
    normalized_email: normalizedEmail,
    password_hash: input.password_hash,
    auth_provider: input.auth_provider || "local",
    provider_subject: input.provider_subject,
    email_verified: input.email_verified,
    status: input.status || "active",
    meta: asJsonObject(input.meta, {}),
    last_login_at: input.last_login_at || null,
  });
}

export const __test__ = {
  normalizeIdentityRow,
  normalizeProvider,
  normalizeStatus,
  rows,
};
