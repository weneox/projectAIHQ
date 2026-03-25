import {
  dbGetWorkspaceSettings,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
  dbUpsertTenantAiPolicy,
  dbUpsertTenantChannel,
  dbUpsertTenantAgent,
} from "../../../db/helpers/settings.js";

import { dbGetTenantByKey } from "../../../db/helpers/tenants.js";

import {
  dbCreateTenantUser,
  dbGetTenantUserByEmail,
  dbGetTenantUserById,
  dbListTenantUsers,
  dbUpdateTenantUser,
  dbSetTenantUserStatus,
  dbDeleteTenantUser,
} from "../../../db/helpers/tenantUsers.js";

import {
  cleanLower,
  cleanNullableString,
  cleanString,
  cleanUpper,
  defaultEnabledLanguages,
  rowOrNull,
  rows,
  asBool,
} from "./utils.js";

export async function dbListTenants(db, opts = {}) {
  const status = cleanLower(opts.status || "");
  const activeOnly = opts.activeOnly === true;
  const clauses = [];
  const params = [];
  let i = 1;

  if (status) {
    clauses.push(`status = $${i++}`);
    params.push(status);
  }

  if (activeOnly) {
    clauses.push(`active = true`);
  }

  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";

  const q = await db.query(
    `
      select
        id,
        tenant_key,
        company_name,
        legal_name,
        industry_key,
        country_code,
        timezone,
        default_language,
        enabled_languages,
        market_region,
        plan_key,
        status,
        active,
        onboarding_completed_at,
        created_at,
        updated_at
      from tenants
      ${where}
      order by created_at desc
    `,
    params
  );

  return rows(q);
}

export async function dbGetTenantDetail(db, tenantKey) {
  const tenant = await dbGetTenantByKey(db, tenantKey);
  if (!tenant?.id) return null;
  return dbGetWorkspaceSettings(db, tenant.tenant_key);
}

export async function dbPatchTenantByKey(db, tenantKey, input = {}) {
  const current = await dbGetTenantByKey(db, tenantKey);
  if (!current?.id) return null;

  const allowed = {
    company_name: cleanString(input.company_name, current.company_name || ""),
    legal_name: Object.prototype.hasOwnProperty.call(input, "legal_name")
      ? cleanNullableString(input.legal_name)
      : current.legal_name,
    industry_key: cleanLower(
      input.industry_key,
      current.industry_key || "generic_business"
    ),
    country_code: cleanUpper(input.country_code, current.country_code || "AZ"),
    timezone: cleanString(input.timezone, current.timezone || "Asia/Baku"),
    default_language: cleanLower(
      input.default_language,
      current.default_language || "az"
    ),
    enabled_languages: defaultEnabledLanguages(
      Object.prototype.hasOwnProperty.call(input, "enabled_languages")
        ? input.enabled_languages
        : current.enabled_languages || ["az"]
    ),
    market_region: Object.prototype.hasOwnProperty.call(input, "market_region")
      ? cleanNullableString(input.market_region)
      : current.market_region,
    plan_key: cleanLower(input.plan_key, current.plan_key || "starter"),
    status: cleanLower(input.status, current.status || "active"),
    active: Object.prototype.hasOwnProperty.call(input, "active")
      ? asBool(input.active, true)
      : current.active,
    onboarding_completed_at: Object.prototype.hasOwnProperty.call(
      input,
      "onboarding_completed_at"
    )
      ? cleanNullableString(input.onboarding_completed_at)
      : current.onboarding_completed_at,
  };

  const q = await db.query(
    `
      update tenants
      set
        company_name = $2,
        legal_name = $3,
        industry_key = $4,
        country_code = $5,
        timezone = $6,
        default_language = $7,
        enabled_languages = $8::jsonb,
        market_region = $9,
        plan_key = $10,
        status = $11,
        active = $12,
        onboarding_completed_at = $13
      where lower(tenant_key) = lower($1)
      returning *
    `,
    [
      cleanLower(tenantKey),
      allowed.company_name,
      allowed.legal_name,
      allowed.industry_key,
      allowed.country_code,
      allowed.timezone,
      allowed.default_language,
      JSON.stringify(allowed.enabled_languages),
      allowed.market_region,
      allowed.plan_key,
      allowed.status,
      allowed.active,
      allowed.onboarding_completed_at,
    ]
  );

  return rowOrNull(q);
}

export async function dbResolveTenantChannel(
  db,
  { channel, recipientId, pageId, igUserId }
) {
  if (!db) return null;

  const safeChannel = cleanLower(channel);
  const safeRecipientId = cleanNullableString(recipientId);
  const safePageId = cleanNullableString(pageId);
  const safeIgUserId = cleanNullableString(igUserId);

  if (!safeChannel) return null;
  if (!safeRecipientId && !safePageId && !safeIgUserId) return null;

  const q = await db.query(
    `
      select
        tc.id,
        tc.tenant_id,
        tc.channel_type,
        tc.provider,
        tc.display_name,
        tc.external_account_id,
        tc.external_page_id,
        tc.external_user_id,
        tc.external_username,
        tc.status,
        tc.is_primary,
        tc.config,
        tc.secrets_ref,
        tc.health,
        tc.last_sync_at,
        tc.created_at,
        tc.updated_at,
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
          ($2::text is not null and tc.external_page_id = $2)
          or ($3::text is not null and tc.external_user_id = $3)
          or ($4::text is not null and tc.external_account_id = $4)
        )
      order by
        tc.is_primary desc,
        tc.updated_at desc,
        tc.created_at desc
      limit 1
    `,
    [safeChannel, safePageId, safeRecipientId, safeIgUserId]
  );

  return rowOrNull(q);
}

export {
  dbGetWorkspaceSettings,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
  dbUpsertTenantAiPolicy,
  dbUpsertTenantChannel,
  dbUpsertTenantAgent,
  dbGetTenantByKey,
  dbCreateTenantUser,
  dbGetTenantUserByEmail,
  dbGetTenantUserById,
  dbListTenantUsers,
  dbUpdateTenantUser,
  dbSetTenantUserStatus,
  dbDeleteTenantUser,
};