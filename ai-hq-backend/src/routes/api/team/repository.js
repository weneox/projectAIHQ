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
import {
  markCanonicalMembershipRemoved,
  syncCanonicalIdentityAndMembership,
  withTransaction,
} from "../../../services/auth/canonicalUserAccess.js";

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
