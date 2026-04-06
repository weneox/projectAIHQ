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

const META_PROVIDER = "meta";
const TELEGRAM_PROVIDER = "telegram";
const INSTAGRAM_CHANNEL = "instagram";
const TELEGRAM_CHANNEL = "telegram";

export async function getTenantByKey(db, tenantKey) {
  return dbGetTenantByKey(db, tenantKey);
}

async function saveProviderSecretValue(
  db,
  tenantId,
  provider,
  secretKey,
  value,
  actor = "system"
) {
  return dbUpsertTenantSecret(
    db,
    tenantId,
    provider,
    s(secretKey),
    value,
    actor
  );
}

async function deleteProviderSecretKeys(
  db,
  tenantId,
  provider,
  secretKeys = []
) {
  let deleted = 0;

  for (const secretKey of Array.isArray(secretKeys) ? secretKeys : []) {
    const ok = await dbDeleteTenantSecret(db, tenantId, provider, secretKey);
    if (ok) deleted += 1;
  }

  return deleted;
}

async function getProviderSecrets(db, tenantId, provider) {
  return dbGetTenantProviderSecrets(db, tenantId, provider);
}

async function upsertChannel(db, tenantId, channelType, payload) {
  return dbUpsertTenantChannel(db, tenantId, channelType, payload);
}

async function getPrimaryChannel(db, tenantId, channelType) {
  const safeChannelType = s(channelType).toLowerCase();
  if (!safeChannelType || !/^[a-z_]+$/.test(safeChannelType)) {
    return null;
  }

  const q = await db.query(
    `
      select *
      from tenant_channels
      where tenant_id = $1
        and channel_type = '${safeChannelType}'
      order by is_primary desc, updated_at desc
      limit 1
    `,
    [tenantId]
  );

  return q?.rows?.[0] || null;
}

export async function saveMetaPageAccessToken(
  db,
  tenantId,
  token,
  actor = "system"
) {
  return saveProviderSecretValue(
    db,
    tenantId,
    META_PROVIDER,
    "page_access_token",
    token,
    actor
  );
}

export async function saveMetaSecretValue(
  db,
  tenantId,
  secretKey,
  value,
  actor = "system"
) {
  return saveProviderSecretValue(
    db,
    tenantId,
    META_PROVIDER,
    secretKey,
    value,
    actor
  );
}

export async function deleteMetaSecretKeys(
  db,
  tenantId,
  secretKeys = ["page_access_token"]
) {
  return deleteProviderSecretKeys(
    db,
    tenantId,
    META_PROVIDER,
    secretKeys
  );
}

export async function getMetaSecrets(db, tenantId) {
  return getProviderSecrets(db, tenantId, META_PROVIDER);
}

export async function saveTelegramSecretValue(
  db,
  tenantId,
  secretKey,
  value,
  actor = "system"
) {
  return saveProviderSecretValue(
    db,
    tenantId,
    TELEGRAM_PROVIDER,
    secretKey,
    value,
    actor
  );
}

export async function deleteTelegramSecretKeys(
  db,
  tenantId,
  secretKeys = []
) {
  return deleteProviderSecretKeys(
    db,
    tenantId,
    TELEGRAM_PROVIDER,
    secretKeys
  );
}

export async function getTelegramSecrets(db, tenantId) {
  return getProviderSecrets(db, tenantId, TELEGRAM_PROVIDER);
}

export async function upsertInstagramChannel(db, tenantId, payload) {
  return upsertChannel(db, tenantId, INSTAGRAM_CHANNEL, payload);
}

export async function upsertTelegramChannel(db, tenantId, payload) {
  return upsertChannel(db, tenantId, TELEGRAM_CHANNEL, payload);
}

export async function getPrimaryInstagramChannel(db, tenantId) {
  return getPrimaryChannel(db, tenantId, INSTAGRAM_CHANNEL);
}

export async function getPrimaryTelegramChannel(db, tenantId) {
  return getPrimaryChannel(db, tenantId, TELEGRAM_CHANNEL);
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
  return upsertChannel(db, tenantId, INSTAGRAM_CHANNEL, {
    provider: META_PROVIDER,
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

export async function markTelegramDisconnected(
  db,
  tenantId,
  {
    displayName = "Telegram",
    status = "disconnected",
    externalUserId = null,
    externalUsername = null,
    config = {},
    health = {},
    isPrimary = true,
    lastSyncAt = null,
  } = {}
) {
  return upsertChannel(db, tenantId, TELEGRAM_CHANNEL, {
    provider: TELEGRAM_PROVIDER,
    display_name: s(displayName, "Telegram"),
    external_account_id: null,
    external_page_id: null,
    external_user_id: externalUserId,
    external_username: externalUsername,
    status: s(status, "disconnected"),
    is_primary: Boolean(isPrimary),
    config,
    secrets_ref: TELEGRAM_PROVIDER,
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
