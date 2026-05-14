/**
 * Platform Channels boundary.
 *
 * This module wraps the current tenant channel storage/resolution
 * without introducing a second channel system.
 *
 * Current source of truth:
 * - tenant_channels
 * - db/helpers/settings.js
 * - platform/channels/repository.js for channel resolution
 *
 * Future modules:
 * - inbox uses instagram/facebook/whatsapp channels
 * - voice uses voice_sip/twilio channels
 * - booking may use google_calendar channels
 * - content may use social publishing channels
 */

export {
  dbListTenantChannels,
  dbUpsertTenantChannel,
} from "../../db/helpers/settings.js";

export {
  dbResolveTenantChannel,
} from "./repository.js";

export async function listTenantChannels(db, tenantId) {
  return dbListTenantChannels(db, tenantId);
}

export async function upsertTenantChannel(db, tenantId, channelType, input = {}) {
  return dbUpsertTenantChannel(db, tenantId, channelType, input);
}

export async function resolveTenantChannel(db, input = {}) {
  return dbResolveTenantChannel(db, input);
}
