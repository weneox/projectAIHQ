import {
  dbGetWorkspaceSettings,
  dbUpsertTenantCore,
  dbUpsertTenantProfile,
  dbUpsertTenantAiPolicy,
  dbUpsertTenantChannel,
  dbUpsertTenantAgent,
} from "../../../db/helpers/settings.js";

import {
  clearTenantCache,
  dbGetTenantByKey,
} from "../../../db/helpers/tenants.js";
import { runWithSystemDbContext } from "../../../db/tenantContext.js";

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

export { dbResolveTenantChannel } from "../../../platform/channels/repository.js";

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
        lifecycle_status,
        billing_status,
        trial_ends_at,
        suspended_at,
        suspension_reason,
        deleted_at,
        deletion_reason,
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
    lifecycle_status: cleanLower(
      input.lifecycle_status || input.lifecycleStatus,
      current.lifecycle_status || current.status || "active"
    ),
    billing_status: cleanLower(
      input.billing_status || input.billingStatus,
      current.billing_status || "unconfigured"
    ),
    trial_ends_at: Object.prototype.hasOwnProperty.call(input, "trial_ends_at")
      ? cleanNullableString(input.trial_ends_at)
      : Object.prototype.hasOwnProperty.call(input, "trialEndsAt")
        ? cleanNullableString(input.trialEndsAt)
        : current.trial_ends_at,
    suspended_at: Object.prototype.hasOwnProperty.call(input, "suspended_at")
      ? cleanNullableString(input.suspended_at)
      : current.suspended_at,
    suspension_reason: Object.prototype.hasOwnProperty.call(input, "suspension_reason")
      ? cleanNullableString(input.suspension_reason)
      : Object.prototype.hasOwnProperty.call(input, "suspensionReason")
        ? cleanNullableString(input.suspensionReason)
        : current.suspension_reason,
    deleted_at: Object.prototype.hasOwnProperty.call(input, "deleted_at")
      ? cleanNullableString(input.deleted_at)
      : current.deleted_at,
    deletion_reason: Object.prototype.hasOwnProperty.call(input, "deletion_reason")
      ? cleanNullableString(input.deletion_reason)
      : Object.prototype.hasOwnProperty.call(input, "deletionReason")
        ? cleanNullableString(input.deletionReason)
        : current.deletion_reason,
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
        onboarding_completed_at = $13,
        lifecycle_status = $14,
        billing_status = $15,
        trial_ends_at = $16,
        suspended_at = $17,
        suspension_reason = $18,
        deleted_at = $19,
        deletion_reason = $20
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
      allowed.lifecycle_status,
      allowed.billing_status,
      allowed.trial_ends_at,
      allowed.suspended_at,
      allowed.suspension_reason,
      allowed.deleted_at,
      allowed.deletion_reason,
    ]
  );

  const updated = rowOrNull(q);
  if (updated?.tenant_key) clearTenantCache(updated.tenant_key);
  return updated;
}

const TENANT_LIFECYCLE_STATUSES = new Set([
  "creating",
  "trial",
  "active",
  "suspended",
  "deleting",
  "deleted",
  "archived",
]);

function normalizeLifecycleStatus(status = "", fallback = "active") {
  const value = cleanLower(status, fallback);
  return TENANT_LIFECYCLE_STATUSES.has(value) ? value : fallback;
}

function mapLifecycleToTenantStatus(status = "active") {
  if (status === "creating") return "trial";
  if (status === "deleting") return "archived";
  return status;
}

function isLifecycleActive(status = "active") {
  return status === "creating" || status === "trial" || status === "active";
}

export async function dbSetTenantLifecycleStatus(
  db,
  tenantKey,
  {
    status = "",
    actor = "system",
    reason = "",
    requestId = "",
    meta = {},
  } = {}
) {
  if (!db || !tenantKey) return null;

  return runWithSystemDbContext("tenant_lifecycle_update", async () => {
    const current = await dbGetTenantByKey(db, tenantKey);
    if (!current?.id) return null;

    const nextLifecycle = normalizeLifecycleStatus(
      status,
      current.lifecycle_status || current.status || "active"
    );
    const nextTenantStatus = mapLifecycleToTenantStatus(nextLifecycle);
    const active = isLifecycleActive(nextLifecycle);
    const now = new Date().toISOString();

    const q = await db.query(
      `
      update tenants
      set
        status = $2,
        lifecycle_status = $3,
        active = $4,
        suspended_at = case when $3 = 'suspended' then coalesce(suspended_at, $5::timestamptz) else suspended_at end,
        suspension_reason = case when $3 = 'suspended' then nullif($6::text, '') else suspension_reason end,
        deleted_at = case when $3 = 'deleted' then coalesce(deleted_at, $5::timestamptz) else deleted_at end,
        deletion_reason = case when $3 = 'deleted' then nullif($6::text, '') else deletion_reason end,
        billing_status = case
          when $3 = 'trial' then 'trialing'
          when $3 = 'suspended' then 'suspended'
          when $3 = 'deleted' then 'closed'
          when billing_status in ('', 'unconfigured') or billing_status is null then 'active'
          else billing_status
        end,
        updated_at = now()
      where lower(tenant_key) = lower($1)
      returning *
      `,
      [
        cleanLower(tenantKey),
        nextTenantStatus,
        nextLifecycle,
        active,
        now,
        cleanNullableString(reason) || "",
      ]
    );

    const updated = rowOrNull(q);
    if (!updated?.id) return null;

    await db.query(
      `
      insert into tenant_lifecycle_events (
        tenant_id,
        tenant_key,
        actor,
        action,
        status_from,
        status_to,
        reason,
        meta,
        request_id
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      `,
      [
        updated.id,
        updated.tenant_key,
        cleanString(actor, "system"),
        `tenant.${nextLifecycle}`,
        cleanLower(current.lifecycle_status || current.status || ""),
        nextLifecycle,
        cleanNullableString(reason),
        JSON.stringify(meta && typeof meta === "object" ? meta : {}),
        cleanNullableString(requestId),
      ]
    );

    if (!active) {
      await db.query(
        `
        update auth_identity_sessions
        set revoked_at = now(), last_seen_at = now()
        where active_tenant_id = $1
          and revoked_at is null
        `,
        [updated.id]
      );
    }

    clearTenantCache(updated.tenant_key);
    return updated;
  });
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
