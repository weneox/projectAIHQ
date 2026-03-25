import {
  dbGetTenantByKey,
  dbUpsertTenantChannel,
} from "../../../db/helpers/settings.js";
import {
  dbUpsertTenantSecret,
  dbDeleteTenantSecret,
  dbGetTenantProviderSecrets,
} from "../../../db/helpers/tenantSecrets.js";
import { dbAudit } from "../../../db/helpers/audit.js";
import { s } from "./utils.js";

export async function getTenantByKey(db, tenantKey) {
  return dbGetTenantByKey(db, tenantKey);
}

export async function saveMetaPageAccessToken(
  db,
  tenantId,
  token,
  actor = "system"
) {
  return dbUpsertTenantSecret(
    db,
    tenantId,
    "meta",
    "page_access_token",
    token,
    actor
  );
}

export async function deleteMetaPageAccessToken(db, tenantId) {
  return dbDeleteTenantSecret(db, tenantId, "meta", "page_access_token");
}

export async function getMetaSecrets(db, tenantId) {
  return dbGetTenantProviderSecrets(db, tenantId, "meta");
}

export async function upsertInstagramChannel(db, tenantId, payload) {
  return dbUpsertTenantChannel(db, tenantId, "instagram", payload);
}

export async function getPrimaryInstagramChannel(db, tenantId) {
  const q = await db.query(
    `
      select *
      from tenant_channels
      where tenant_id = $1
        and channel_type = 'instagram'
      order by is_primary desc, updated_at desc
      limit 1
    `,
    [tenantId]
  );

  return q?.rows?.[0] || null;
}

export async function markInstagramDisconnected(db, tenantId) {
  return db.query(
    `
      update tenant_channels
      set
        status = 'disconnected',
        display_name = 'Instagram',
        external_page_id = null,
        external_user_id = null,
        external_username = null,
        secrets_ref = null,
        health = '{}'::jsonb,
        last_sync_at = null
      where tenant_id = $1
        and channel_type = 'instagram'
    `,
    [tenantId]
  );
}

export async function auditSafe(
  db,
  actor,
  tenant,
  action,
  objectType,
  objectId,
  meta = {}
) {
  try {
    await dbAudit(db, s(actor, "system"), action, objectType, objectId, {
      tenantId: tenant?.id || null,
      tenantKey: tenant?.tenant_key || null,
      ...meta,
    });
  } catch {}
}