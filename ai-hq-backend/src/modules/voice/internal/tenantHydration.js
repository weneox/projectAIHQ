import { findTenantByKeyOrPhone } from "../repository.js";
import { normalizePhone, s } from "../shared.js";
import { firstNonEmpty, obj } from "./primitives.js";
import {
  buildStableTenantScope,
  normalizedRuntimeTenantId,
  normalizedRuntimeTenantKey,
} from "./tenant.js";

export async function loadTenantRowDirect(db, { tenantId = "", tenantKey = "" } = {}) {
  if (!db?.query) return null;

  const resolvedTenantId = s(tenantId);
  const resolvedTenantKey = s(tenantKey);

  if (resolvedTenantId) {
    const byId = await db.query(
      `
        select
          t.id,
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
        from tenants t
        where t.id = $1
        limit 1
      `,
      [resolvedTenantId]
    );

    if (byId?.rows?.[0]) {
      return byId.rows[0];
    }
  }

  if (resolvedTenantKey) {
    const byKey = await db.query(
      `
        select
          t.id,
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
        from tenants t
        where lower(t.tenant_key) = lower($1)
        limit 1
      `,
      [resolvedTenantKey]
    );

    if (byKey?.rows?.[0]) {
      return byKey.rows[0];
    }
  }

  return null;
}


export function needsTenantHydration(tenant = null) {
  const value = obj(tenant);
  return !s(value.id || value.tenant_id) || !s(value.tenant_key || value.tenantKey);
}


export async function hydrateTenantRowIfNeeded({
  db,
  tenant = null,
  runtime = null,
  tenantKey = "",
  toNumber = "",
} = {}) {
  const normalized = buildStableTenantScope({
    tenant,
    runtime,
    tenantKey,
    toNumber,
  });

  if (!needsTenantHydration(normalized)) {
    return normalized;
  }

  const lookupTenantId = firstNonEmpty(
    normalized.id,
    normalized.tenant_id,
    normalizedRuntimeTenantId(runtime)
  );

  const lookupTenantKey = firstNonEmpty(
    normalized.tenant_key,
    normalized.tenantKey,
    normalizedRuntimeTenantKey(runtime),
    tenantKey
  );

  let resolvedTenant = await loadTenantRowDirect(db, {
    tenantId: lookupTenantId,
    tenantKey: lookupTenantKey,
  });

  if (!resolvedTenant && (lookupTenantKey || s(toNumber))) {
    resolvedTenant = await findTenantByKeyOrPhone(db, {
      tenantKey: lookupTenantKey,
      toNumber: s(toNumber),
      normalizePhone,
    });
  }

  if (!resolvedTenant) {
    return normalized;
  }

  return buildStableTenantScope({
    tenant: resolvedTenant,
    runtime,
    tenantKey: lookupTenantKey,
    toNumber,
  });
}


