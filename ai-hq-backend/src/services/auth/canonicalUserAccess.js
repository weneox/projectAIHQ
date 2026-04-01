import {
  dbGetAuthIdentityByEmail,
  dbUpsertLocalAuthIdentityByEmail,
} from "../../db/helpers/authIdentities.js";
import {
  dbGetAuthIdentityMembership,
  dbUpsertAuthIdentityMembership,
} from "../../db/helpers/authIdentityMemberships.js";
import {
  dbGetTenantUserByEmail,
  dbUpsertTenantUserByEmail,
} from "../../db/helpers/tenantUsers.js";
import { queryDbWithTimeout } from "../../routes/api/adminAuth/utils.js";

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function cleanLower(value, fallback = "") {
  return cleanString(value, fallback).toLowerCase();
}

function asJsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeRole(role) {
  const next = cleanLower(role, "member");
  if (["owner", "admin", "operator", "member", "marketer", "analyst"].includes(next)) {
    return next;
  }
  return "member";
}

function normalizeStatus(status, fallback = "active") {
  const next = cleanLower(status, fallback);
  if (["invited", "active", "disabled", "removed"].includes(next)) {
    return next;
  }
  return fallback;
}

function normalizeAuthProvider(authProvider, fallback = "local") {
  const next = cleanLower(authProvider, fallback);
  if (["local", "google", "microsoft", "magic_link", "system"].includes(next)) {
    return next;
  }
  return fallback;
}

function normalizeIdentityStatus(currentIdentity, tenantUserStatus) {
  const nextMembershipStatus = normalizeStatus(tenantUserStatus, "active");
  if (!currentIdentity?.id) {
    return nextMembershipStatus === "removed" ? "active" : nextMembershipStatus;
  }

  if (nextMembershipStatus === "active") {
    return "active";
  }

  return normalizeStatus(currentIdentity.status, "active");
}

function buildIdentityMeta(user = {}, currentIdentity = null) {
  return {
    ...asJsonObject(currentIdentity?.meta, {}),
    fullName: cleanString(user.full_name || currentIdentity?.meta?.fullName || ""),
    legacyTenantUserId: cleanString(user.id),
    legacyAuthProvider: normalizeAuthProvider(
      user.auth_provider,
      currentIdentity?.auth_provider || "local"
    ),
  };
}

function buildMembershipMeta(user = {}, extra = {}) {
  return {
    ...asJsonObject(user.meta, {}),
    ...extra,
    legacyTenantUserId: cleanString(user.id),
    legacyUserEmail: cleanLower(user.user_email),
    authProvider: normalizeAuthProvider(user.auth_provider),
  };
}

function pickPreferredLegacyPasswordHash(users = []) {
  const hashes = Array.from(
    new Set(
      users
        .map((user) => cleanString(user.password_hash))
        .filter(Boolean)
    )
  );

  return {
    passwordHash: hashes[0] || "",
    conflict: hashes.length > 1,
  };
}

export async function withTransaction(db, work) {
  if (!db?.query) {
    throw new Error("Database is required");
  }

  await db.query("begin");
  try {
    const result = await work(db);
    await db.query("commit");
    return result;
  } catch (error) {
    try {
      await db.query("rollback");
    } catch {}
    throw error;
  }
}

export async function syncCanonicalIdentityAndMembership(
  db,
  tenantId,
  user,
  previousUser = null
) {
  if (!db || !tenantId || !user?.user_email) {
    return { identity: null, membership: null };
  }

  const currentIdentity = await dbGetAuthIdentityByEmail(db, user.user_email);
  const identity = await dbUpsertLocalAuthIdentityByEmail(db, {
    primary_email: user.user_email,
    normalized_email: user.user_email,
    password_hash: Object.prototype.hasOwnProperty.call(user, "password_hash")
      ? user.password_hash
      : undefined,
    auth_provider: normalizeAuthProvider(user.auth_provider),
    email_verified: !!user.email_verified,
    status: normalizeIdentityStatus(currentIdentity, user.status),
    meta: buildIdentityMeta(user, currentIdentity),
    last_login_at: user.last_login_at || currentIdentity?.last_login_at || null,
  });

  if (!identity?.id) {
    return { identity: null, membership: null };
  }

  let previousIdentity = null;
  const previousEmail = cleanLower(previousUser?.user_email);
  if (previousEmail && previousEmail !== cleanLower(user.user_email)) {
    previousIdentity = await dbGetAuthIdentityByEmail(db, previousEmail);
  }

  if (previousIdentity?.id && previousIdentity.id !== identity.id) {
    await dbUpsertAuthIdentityMembership(db, {
      identity_id: previousIdentity.id,
      tenant_id: tenantId,
      role: previousUser?.role || user.role,
      status: "removed",
      permissions: asJsonObject(previousUser?.permissions, {}),
      meta: buildMembershipMeta(previousUser || user, {
        reassignedToIdentityId: identity.id,
      }),
      last_seen_at: previousUser?.last_seen_at || null,
    });
  }

  const existingMembership = await dbGetAuthIdentityMembership(db, identity.id, tenantId);
  const membership = await dbUpsertAuthIdentityMembership(db, {
    identity_id: identity.id,
    tenant_id: tenantId,
    role: normalizeRole(user.role),
    status: normalizeStatus(user.status, "active"),
    permissions: asJsonObject(user.permissions, existingMembership?.permissions || {}),
    meta: buildMembershipMeta(user, existingMembership?.meta || {}),
    last_seen_at: user.last_seen_at || existingMembership?.last_seen_at || null,
  });

  return { identity, membership };
}

export async function markCanonicalMembershipRemoved(db, tenantId, user) {
  if (!db || !tenantId || !user?.user_email) return null;

  const identity = await dbGetAuthIdentityByEmail(db, user.user_email);
  if (!identity?.id) return null;

  return dbUpsertAuthIdentityMembership(db, {
    identity_id: identity.id,
    tenant_id: tenantId,
    role: normalizeRole(user.role),
    status: "removed",
    permissions: asJsonObject(user.permissions, {}),
    meta: buildMembershipMeta(user, {
      removedFromLegacyTenantUser: true,
    }),
    last_seen_at: user.last_seen_at || null,
  });
}

export async function listLegacyTenantUsersByEmail(
  db,
  { email, tenantKey = "" } = {}
) {
  if (!db || !email) return [];

  const params = [cleanLower(email)];
  let tenantClause = "";

  if (cleanString(tenantKey)) {
    params.push(cleanLower(tenantKey));
    tenantClause = "and lower(t.tenant_key) = $2";
  }

  const query = await queryDbWithTimeout(
    db,
    `
      select
        tu.id,
        tu.tenant_id,
        tu.user_email,
        tu.full_name,
        tu.role,
        tu.status,
        tu.password_hash,
        tu.auth_provider,
        tu.email_verified,
        tu.session_version,
        tu.permissions,
        tu.meta,
        tu.last_seen_at,
        tu.last_login_at,
        tu.created_at,
        tu.updated_at,
        t.tenant_key,
        t.company_name
      from tenant_users tu
      join tenants t on t.id = tu.tenant_id
      where lower(tu.user_email) = $1
        ${tenantClause}
      order by
        case when lower(tu.status) = 'active' then 0 when lower(tu.status) = 'invited' then 1 else 2 end,
        case when lower(tu.role) = 'owner' then 0 else 1 end,
        tu.created_at asc,
        tu.id asc
    `,
    params,
    {
      timeoutMs: 3000,
      label: "auth.repair.listLegacyTenantUsersByEmail",
    }
  );

  return Array.isArray(query?.rows) ? query.rows : [];
}

export async function repairCanonicalAccessFromLegacyUsers(
  db,
  { email, tenantKey = "", forcePasswordHashFromLegacy = false } = {}
) {
  const legacyUsers = await listLegacyTenantUsersByEmail(db, { email, tenantKey });
  if (!legacyUsers.length) {
    return {
      ok: false,
      code: "legacy_user_not_found",
      identity: null,
      memberships: [],
      repairedUsers: [],
    };
  }

  const eligibleUsers = legacyUsers.filter((user) =>
    ["active", "invited"].includes(normalizeStatus(user.status, "active"))
  );
  if (!eligibleUsers.length) {
    return {
      ok: false,
      code: "legacy_user_not_active",
      identity: null,
      memberships: [],
      repairedUsers: [],
    };
  }

  const preferred = pickPreferredLegacyPasswordHash(eligibleUsers);
  if (preferred.conflict) {
    return {
      ok: false,
      code: "legacy_password_conflict",
      identity: null,
      memberships: [],
      repairedUsers: eligibleUsers,
    };
  }

  const repaired = await withTransaction(db, async (tx) => {
    let identity = await dbGetAuthIdentityByEmail(tx, email);

    for (const legacyUser of eligibleUsers) {
      const canonical = await syncCanonicalIdentityAndMembership(
        tx,
        legacyUser.tenant_id,
        {
          ...legacyUser,
          password_hash: forcePasswordHashFromLegacy
            ? preferred.passwordHash || legacyUser.password_hash || identity?.password_hash
            : identity?.password_hash || preferred.passwordHash || legacyUser.password_hash,
        }
      );
      if (canonical?.identity?.id) {
        identity = canonical.identity;
      }
    }

    if (!identity?.id) {
      return { identity: null, memberships: [] };
    }

    const memberships = [];
    for (const legacyUser of eligibleUsers) {
      const membership = await dbGetAuthIdentityMembership(
        tx,
        identity.id,
        legacyUser.tenant_id
      );
      if (membership?.id) {
        memberships.push(membership);
      }
    }

    return { identity, memberships };
  });

  return {
    ok: !!repaired?.identity?.id,
    code: repaired?.identity?.id ? "repaired_from_legacy_users" : "repair_failed",
    identity: repaired?.identity || null,
    memberships: repaired?.memberships || [],
    repairedUsers: eligibleUsers,
  };
}

export async function ensureLegacyBridgeForMemberships(
  db,
  identity,
  memberships = []
) {
  if (!db || !identity?.id) return { repaired: [], existing: [], failed: [] };

  const repaired = [];
  const existing = [];
  const failed = [];

  for (const membership of memberships) {
    const tenantId = cleanString(membership.tenant_id);
    if (!tenantId) continue;

    const found = await dbGetTenantUserByEmail(db, tenantId, identity.normalized_email);
    if (found?.id) {
      existing.push(found);
      continue;
    }

    const created = await dbUpsertTenantUserByEmail(db, tenantId, {
      user_email: identity.primary_email || identity.normalized_email,
      full_name: cleanString(identity?.meta?.fullName),
      role: normalizeRole(membership.role),
      status: normalizeStatus(membership.status, "active"),
      password_hash: cleanString(identity.password_hash) || undefined,
      auth_provider: normalizeAuthProvider(identity.auth_provider),
      email_verified: !!identity.email_verified,
      session_version: 1,
      permissions: asJsonObject(membership.permissions, {}),
      meta: {
        ...asJsonObject(membership.meta, {}),
        repairedFromCanonicalIdentity: true,
        identityId: identity.id,
      },
      last_seen_at: membership.last_seen_at || null,
      last_login_at: identity.last_login_at || null,
    });

    if (created?.id) {
      repaired.push(created);
    } else {
      failed.push({
        tenantId,
        membershipId: cleanString(membership.id),
      });
    }
  }

  return { repaired, existing, failed };
}

export async function ensureCanonicalAndLegacyAccessForEmail(
  db,
  { email, tenantKey = "" } = {}
) {
  let identity = await dbGetAuthIdentityByEmail(db, email);
  let repair = null;

  if (!identity?.id || !cleanString(identity.password_hash)) {
    repair = await repairCanonicalAccessFromLegacyUsers(db, { email, tenantKey });
    if (repair?.identity?.id) {
      identity = repair.identity;
    }
  }

  return {
    identity: identity || null,
    repair,
  };
}
