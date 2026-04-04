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

export async function deleteMetaSecretKeys(
  db,
  tenantId,
  secretKeys = ["page_access_token"]
) {
  let deleted = 0;

  for (const secretKey of Array.isArray(secretKeys) ? secretKeys : []) {
    const ok = await dbDeleteTenantSecret(db, tenantId, "meta", secretKey);
    if (ok) deleted += 1;
  }

  return deleted;
}

export async function deleteMetaPageAccessToken(db, tenantId) {
  return deleteMetaSecretKeys(db, tenantId, ["page_access_token"]);
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

export async function markInstagramDisconnected(
  db,
  tenantId,
  {
    displayName = "Instagram",
    status = "disconnected",
    config = {},
    health = {},
    isPrimary = true,
    lastSyncAt = null,
  } = {}
) {
  return dbUpsertTenantChannel(db, tenantId, "instagram", {
    provider: "meta",
    display_name: s(displayName, "Instagram"),
    external_account_id: null,
    external_page_id: null,
    external_user_id: null,
    external_username: null,
    status: s(status, "disconnected"),
    is_primary: Boolean(isPrimary),
    config,
    secrets_ref: null,
    health,
    last_sync_at: lastSyncAt,
  });
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
