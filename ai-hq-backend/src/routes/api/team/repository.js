import { dbGetTenantByKey } from "../../../db/helpers/settings.js";
import {
  dbListTenantUsers,
  dbGetTenantUserById,
  dbGetTenantUserByEmail,
  dbCreateTenantUser,
  dbUpdateTenantUser,
  dbSetTenantUserStatus,
  dbDeleteTenantUser,
} from "../../../db/helpers/tenantUsers.js";
import {
  dbGetAuthIdentityByEmail,
  dbUpsertLocalAuthIdentityByEmail,
} from "../../../db/helpers/authIdentities.js";
import {
  dbGetAuthIdentityMembership,
  dbUpsertAuthIdentityMembership,
} from "../../../db/helpers/authIdentityMemberships.js";
import { dbAudit } from "../../../db/helpers/audit.js";
import { getAuthActor, getAuthRole } from "./permissions.js";

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
    legacyAuthProvider: normalizeAuthProvider(user.auth_provider, currentIdentity?.auth_provider || "local"),
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

async function withTransaction(db, work) {
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

async function syncCanonicalIdentityAndMembership(db, tenantId, user, previousUser = null) {
  if (!db || !tenantId || !user?.user_email) return { identity: null, membership: null };

  const currentIdentity = await dbGetAuthIdentityByEmail(db, user.user_email);
  const identity = await dbUpsertLocalAuthIdentityByEmail(db, {
    primary_email: user.user_email,
    normalized_email: user.user_email,
    password_hash:
      Object.prototype.hasOwnProperty.call(user, "password_hash") ? user.password_hash : undefined,
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

async function markCanonicalMembershipRemoved(db, tenantId, user) {
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

export async function getTenantOrNull(db, tenantKey) {
  return dbGetTenantByKey(db, tenantKey);
}

export async function listTenantUsers(db, tenantId, filters = {}) {
  return dbListTenantUsers(db, tenantId, filters);
}

export async function getTenantUserById(db, tenantId, userId) {
  return dbGetTenantUserById(db, tenantId, userId);
}

export async function getTenantUserByEmail(db, tenantId, email) {
  return dbGetTenantUserByEmail(db, tenantId, email);
}

export async function createTenantUser(db, tenantId, input) {
  return withTransaction(db, async (tx) => {
    const user = await dbCreateTenantUser(tx, tenantId, input);
    await syncCanonicalIdentityAndMembership(tx, tenantId, user);
    return user;
  });
}

export async function updateTenantUser(db, tenantId, userId, input) {
  return withTransaction(db, async (tx) => {
    const current = await dbGetTenantUserById(tx, tenantId, userId);
    const user = await dbUpdateTenantUser(tx, tenantId, userId, input);
    await syncCanonicalIdentityAndMembership(tx, tenantId, user, current);
    return user;
  });
}

export async function setTenantUserStatus(db, tenantId, userId, status) {
  return withTransaction(db, async (tx) => {
    const user = await dbSetTenantUserStatus(tx, tenantId, userId, status);
    await syncCanonicalIdentityAndMembership(tx, tenantId, user);
    return user;
  });
}

export async function deleteTenantUser(db, tenantId, userId) {
  return withTransaction(db, async (tx) => {
    const current = await dbGetTenantUserById(tx, tenantId, userId);
    const deleted = await dbDeleteTenantUser(tx, tenantId, userId);
    if (deleted && current?.id) {
      await markCanonicalMembershipRemoved(tx, tenantId, current);
    }
    return deleted;
  });
}

export async function auditSafe(db, req, tenant, action, objectType, objectId, meta = {}) {
  try {
    await dbAudit(db, getAuthActor(req), action, objectType, objectId, {
      tenantId: tenant?.id || null,
      tenantKey: tenant?.tenant_key || null,
      viewerRole: getAuthRole(req),
      ...meta,
    });
  } catch {}
}
