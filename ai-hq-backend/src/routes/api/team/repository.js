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
import { dbAudit } from "../../../db/helpers/audit.js";
import { getAuthActor, getAuthRole } from "./permissions.js";

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
  return dbCreateTenantUser(db, tenantId, input);
}

export async function updateTenantUser(db, tenantId, userId, input) {
  return dbUpdateTenantUser(db, tenantId, userId, input);
}

export async function setTenantUserStatus(db, tenantId, userId, status) {
  return dbSetTenantUserStatus(db, tenantId, userId, status);
}

export async function deleteTenantUser(db, tenantId, userId) {
  return dbDeleteTenantUser(db, tenantId, userId);
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