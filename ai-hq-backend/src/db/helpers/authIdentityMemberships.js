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

function normalizeRole(value) {
  const role = cleanLower(value, "member");
  if (["owner", "admin", "operator", "member", "marketer", "analyst"].includes(role)) {
    return role;
  }
  return "member";
}

function normalizeStatus(value) {
  const status = cleanLower(value, "active");
  if (["invited", "active", "disabled", "removed"].includes(status)) {
    return status;
  }
  return "active";
}

function normalizeMembershipRow(row) {
  if (!row) return null;

  return {
    id: cleanString(row.id),
    identity_id: cleanString(row.identity_id),
    tenant_id: cleanString(row.tenant_id),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    permissions: asJsonObject(row.permissions, {}),
    meta: asJsonObject(row.meta, {}),
    last_seen_at: row.last_seen_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function pickMembershipColumns(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
    ${prefix}id,
    ${prefix}identity_id,
    ${prefix}tenant_id,
    ${prefix}role,
    ${prefix}status,
    ${prefix}permissions,
    ${prefix}meta,
    ${prefix}last_seen_at,
    ${prefix}created_at,
    ${prefix}updated_at
  `;
}

export async function dbGetAuthIdentityMembership(db, identityId, tenantId) {
  if (!db || !identityId || !tenantId) return null;

  const query = await db.query(
    `
      select
        ${pickMembershipColumns()}
      from auth_identity_memberships
      where identity_id = $1
        and tenant_id = $2
      limit 1
    `,
    [identityId, tenantId]
  );

  return normalizeMembershipRow(rowOrNull(query));
}

export async function dbListAuthIdentityMembershipsByIdentity(db, identityId, options = {}) {
  if (!db || !identityId) return [];

  const clauses = ["identity_id = $1"];
  const params = [identityId];

  if (options.status) {
    params.push(normalizeStatus(options.status));
    clauses.push(`status = $${params.length}`);
  }

  const query = await db.query(
    `
      select
        ${pickMembershipColumns()}
      from auth_identity_memberships
      where ${clauses.join(" and ")}
      order by created_at asc
    `,
    params
  );

  return rows(query).map(normalizeMembershipRow);
}

export async function dbUpsertAuthIdentityMembership(db, input = {}) {
  if (!db || !input.identity_id || !input.tenant_id) return null;

  const query = await db.query(
    `
      insert into auth_identity_memberships (
        identity_id,
        tenant_id,
        role,
        status,
        permissions,
        meta,
        last_seen_at
      )
      values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
      on conflict (identity_id, tenant_id)
      do update set
        role = excluded.role,
        status = excluded.status,
        permissions = excluded.permissions,
        meta = excluded.meta,
        last_seen_at = coalesce(excluded.last_seen_at, auth_identity_memberships.last_seen_at)
      returning
        ${pickMembershipColumns()}
    `,
    [
      cleanString(input.identity_id),
      cleanString(input.tenant_id),
      normalizeRole(input.role),
      normalizeStatus(input.status),
      json(asJsonObject(input.permissions, {}), {}),
      json(asJsonObject(input.meta, {}), {}),
      input.last_seen_at || null,
    ]
  );

  return normalizeMembershipRow(rowOrNull(query));
}

export async function dbUpdateAuthIdentityMembership(db, membershipId, input = {}) {
  if (!db || !membershipId) return null;

  const current = await dbGetAuthIdentityMembershipById(db, membershipId);
  if (!current) return null;

  const query = await db.query(
    `
      update auth_identity_memberships
      set
        role = $2,
        status = $3,
        permissions = $4::jsonb,
        meta = $5::jsonb,
        last_seen_at = $6
      where id = $1
      returning
        ${pickMembershipColumns()}
    `,
    [
      membershipId,
      normalizeRole(input.role || current.role),
      normalizeStatus(input.status || current.status),
      json(asJsonObject(input.permissions, current.permissions || {}), {}),
      json(asJsonObject(input.meta, current.meta || {}), {}),
      Object.prototype.hasOwnProperty.call(input, "last_seen_at")
        ? input.last_seen_at || null
        : current.last_seen_at,
    ]
  );

  return normalizeMembershipRow(rowOrNull(query));
}

export async function dbGetAuthIdentityMembershipById(db, membershipId) {
  if (!db || !membershipId) return null;

  const query = await db.query(
    `
      select
        ${pickMembershipColumns()}
      from auth_identity_memberships
      where id = $1
      limit 1
    `,
    [membershipId]
  );

  return normalizeMembershipRow(rowOrNull(query));
}

export const __test__ = {
  normalizeMembershipRow,
  normalizeRole,
  normalizeStatus,
};
