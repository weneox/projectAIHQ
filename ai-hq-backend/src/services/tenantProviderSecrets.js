// src/services/tenantProviderSecrets.js

import { dbGetTenantByKey } from "../db/helpers/settings.js";
import { dbGetTenantProviderSecrets } from "../db/helpers/tenantSecrets.js";

function s(v, d = "") {
  const x = String(v ?? "").trim();
  return x || d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

function cleanNullableString(v) {
  if (v === null || v === undefined) return null;
  const x = String(v).trim();
  if (!x) return null;
  const lowered = x.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return x;
}

function pickFirstSecret(secrets = {}, ...keys) {
  const source = asObj(secrets);

  for (const key of keys) {
    const value = s(source[key]);
    if (value) return value;
  }

  return "";
}

function isConnectedStatus(status = "") {
  return ["connected", "active"].includes(lower(status));
}

export async function getTenantByKeyOrThrow(db, tenantKey) {
  const key = lower(tenantKey);
  if (!db) throw new Error("Database not available");
  if (!key) throw new Error("tenantKey is required");

  const tenant = await dbGetTenantByKey(db, key);
  if (!tenant?.id) {
    throw new Error(`Tenant not found: ${key}`);
  }

  return tenant;
}

export async function getTenantSecretsByProvider(db, tenantKey, provider) {
  const tenant = await getTenantByKeyOrThrow(db, tenantKey);
  const secrets = await dbGetTenantProviderSecrets(db, tenant.id, provider);

  return {
    tenant,
    provider: lower(provider),
    secrets: asObj(secrets),
  };
}

export async function resolveTenantChannelByExternalIds(
  db,
  { channel = "", recipientId = "", pageId = "", igUserId = "" } = {}
) {
  if (!db?.query) return null;

  const safeChannel = lower(channel);
  const safeRecipientId = cleanNullableString(recipientId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (!safeChannel) return null;
  if (!safeRecipientId && !safePageId && !safeIgUserId) return null;

  const queries = [
    safePageId
      ? {
          sql: `
            select
              tc.*,
              t.tenant_key,
              t.company_name,
              t.legal_name,
              t.industry_key,
              t.country_code,
              t.timezone,
              t.default_language,
              t.enabled_languages,
              t.market_region,
              t.plan_key,
              t.status as tenant_status,
              t.active as tenant_active
            from tenant_channels tc
            join tenants t on t.id = tc.tenant_id
            where tc.channel_type = $1
              and (
                tc.external_page_id = $2
                or tc.external_user_id = $2
                or tc.external_account_id = $2
              )
            order by tc.is_primary desc, tc.updated_at desc, tc.created_at desc
            limit 1
          `,
          params: [safeChannel, safePageId],
        }
      : null,
    safeIgUserId
      ? {
          sql: `
            select
              tc.*,
              t.tenant_key,
              t.company_name,
              t.legal_name,
              t.industry_key,
              t.country_code,
              t.timezone,
              t.default_language,
              t.enabled_languages,
              t.market_region,
              t.plan_key,
              t.status as tenant_status,
              t.active as tenant_active
            from tenant_channels tc
            join tenants t on t.id = tc.tenant_id
            where tc.channel_type = $1
              and (
                tc.external_user_id = $2
                or tc.external_account_id = $2
              )
            order by tc.is_primary desc, tc.updated_at desc, tc.created_at desc
            limit 1
          `,
          params: [safeChannel, safeIgUserId],
        }
      : null,
    safeRecipientId
      ? {
          sql: `
            select
              tc.*,
              t.tenant_key,
              t.company_name,
              t.legal_name,
              t.industry_key,
              t.country_code,
              t.timezone,
              t.default_language,
              t.enabled_languages,
              t.market_region,
              t.plan_key,
              t.status as tenant_status,
              t.active as tenant_active
            from tenant_channels tc
            join tenants t on t.id = tc.tenant_id
            where tc.channel_type = $1
              and (
                tc.external_user_id = $2
                or tc.external_account_id = $2
                or tc.external_page_id = $2
              )
            order by tc.is_primary desc, tc.updated_at desc, tc.created_at desc
            limit 1
          `,
          params: [safeChannel, safeRecipientId],
        }
      : null,
  ].filter(Boolean);

  for (const query of queries) {
    const result = await db.query(query.sql, query.params);
    const row = result?.rows?.[0] || null;
    if (row) return row;
  }

  return null;
}

export async function getTenantTogetherConfig(db, tenantKey) {
  const { tenant, secrets } = await getTenantSecretsByProvider(
    db,
    tenantKey,
    "together"
  );

  return {
    tenant,
    apiKey: s(secrets.api_key),
    model: s(secrets.image_model || secrets.model),
  };
}

export async function getTenantMetaConfig(db, tenantKey) {
  const { tenant, secrets } = await getTenantSecretsByProvider(
    db,
    tenantKey,
    "meta"
  );

  return {
    tenant,
    pageAccessToken: s(secrets.page_access_token),
    pageId: s(secrets.page_id),
    igUserId: s(secrets.ig_user_id),
    appSecret: s(secrets.app_secret),
  };
}

export async function getTenantCloudinaryConfig(db, tenantKey) {
  const { tenant, secrets } = await getTenantSecretsByProvider(
    db,
    tenantKey,
    "cloudinary"
  );

  return {
    tenant,
    cloudName: s(secrets.cloud_name),
    apiKey: s(secrets.api_key),
    apiSecret: s(secrets.api_secret),
    folder: s(secrets.folder),
  };
}

export async function getTenantTwilioConfig(db, tenantKey) {
  const { tenant, secrets } = await getTenantSecretsByProvider(
    db,
    tenantKey,
    "twilio"
  );

  return {
    tenant,
    accountSid: s(secrets.account_sid),
    authToken: s(secrets.auth_token),
    apiKey: s(secrets.api_key),
    apiSecret: s(secrets.api_secret),
    phoneNumber: s(secrets.phone_number),
  };
}

export async function getTenantOpenAIConfig(db, tenantKey) {
  const { tenant, secrets } = await getTenantSecretsByProvider(
    db,
    tenantKey,
    "openai"
  );

  return {
    tenant,
    apiKey: s(secrets.api_key),
    model: s(secrets.model),
  };
}

export async function resolveTenantMetaProviderAccess(
  db,
  { channel = "", recipientId = "", pageId = "", igUserId = "" } = {}
) {
  const matchedChannel = await resolveTenantChannelByExternalIds(db, {
    channel,
    recipientId,
    pageId,
    igUserId,
  });

  if (!matchedChannel?.tenant_id) {
    return {
      ok: false,
      error: "tenant_channel_not_found",
      tenantKey: "",
      tenantId: "",
      matchedChannel: null,
      providerAccess: null,
    };
  }

  const secrets = await dbGetTenantProviderSecrets(
    db,
    matchedChannel.tenant_id,
    lower(matchedChannel.provider || matchedChannel.secrets_ref || "meta")
  );

  const pageIdResolved = s(matchedChannel.external_page_id);
  const igUserIdResolved = s(matchedChannel.external_user_id);
  const pageAccessToken = pickFirstSecret(
    secrets,
    "page_access_token",
    "access_token",
    "meta_page_access_token"
  );
  const appSecret = pickFirstSecret(secrets, "app_secret", "meta_app_secret");
  let reasonCode = "";

  if (!isConnectedStatus(matchedChannel.status)) {
    reasonCode = "channel_not_connected";
  } else if (!pageIdResolved && !igUserIdResolved) {
    reasonCode = "channel_identifiers_missing";
  } else if (!pageAccessToken) {
    reasonCode = "provider_secret_missing";
  }

  const available = !reasonCode;

  return {
    ok: true,
    tenantKey: s(matchedChannel.tenant_key),
    tenantId: s(matchedChannel.tenant_id),
    matchedChannel,
    providerAccess: {
      provider: lower(matchedChannel.provider || matchedChannel.secrets_ref || "meta"),
      tenantKey: s(matchedChannel.tenant_key),
      tenantId: s(matchedChannel.tenant_id),
      available,
      reasonCode,
      pageId: pageIdResolved,
      igUserId: igUserIdResolved,
      pageAccessToken,
      appSecret,
      secretKeys: Object.keys(asObj(secrets)).map((key) => lower(key)).filter(Boolean),
      grantedScopes: [],
    },
  };
}
