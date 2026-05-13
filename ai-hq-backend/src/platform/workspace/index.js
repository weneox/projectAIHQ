/**
 * Platform Workspace boundary.
 *
 * This module wraps the current workspace settings storage.
 *
 * Current source of truth:
 * - tenants
 * - tenant_profiles
 * - tenant_ai_policies
 * - tenant_channels
 * - tenant_agent_configs
 * - tenant_users
 * - db/helpers/settings.js
 *
 * Future modules should use this boundary to load tenant/workspace context
 * instead of directly reaching into settings helpers.
 */

export {
  dbGetTenantByKey,
  dbGetWorkspaceSettings,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
  dbUpsertTenantAiPolicy,
} from "../../db/helpers/settings.js";

export async function getTenantByKey(db, tenantKey) {
  return dbGetTenantByKey(db, tenantKey);
}

export async function getWorkspaceSettings(db, tenantKey) {
  return dbGetWorkspaceSettings(db, tenantKey);
}

export async function upsertTenantCore(db, tenantKey, input = {}) {
  return dbUpsertTenantCore(db, tenantKey, input);
}

export async function upsertTenantProfile(db, tenantId, input = {}) {
  return dbUpsertTenantProfile(db, tenantId, input);
}

export async function upsertTenantAiPolicy(db, tenantId, input = {}) {
  return dbUpsertTenantAiPolicy(db, tenantId, input);
}
