import { dbGetTenantProviderSecrets } from "../../db/helpers/tenantSecrets.js";

const TELEGRAM_PROVIDER = "telegram";
const TELEGRAM_CHANNEL = "telegram";

export const TELEGRAM_BOT_TOKEN_SECRET_KEY = "bot_token";

function s(v, d = "") {
  return String(v ?? d).trim();
}

async function getProviderSecrets(db, tenantId, provider) {
  return dbGetTenantProviderSecrets(db, tenantId, provider);
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

export async function getTelegramSecrets(db, tenantId) {
  return getProviderSecrets(db, tenantId, TELEGRAM_PROVIDER);
}

export async function getPrimaryTelegramChannel(db, tenantId) {
  return getPrimaryChannel(db, tenantId, TELEGRAM_CHANNEL);
}
