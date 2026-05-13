/**
 * Platform Agents boundary.
 *
 * This module wraps the current tenant agent configuration storage
 * without introducing a second agent system.
 *
 * Current source of truth:
 * - tenant_agent_configs
 * - db/helpers/settings.js
 *
 * Future modules such as voice, inbox, image, content and automation
 * should import tenant agent helpers from this platform boundary.
 */

export {
  dbListTenantAgents,
  dbUpsertTenantAgent,
} from "../../db/helpers/settings.js";

export async function listTenantAgents(db, tenantId) {
  return dbListTenantAgents(db, tenantId);
}

export async function upsertTenantAgent(db, tenantId, agentKey, input = {}) {
  return dbUpsertTenantAgent(db, tenantId, agentKey, input);
}
