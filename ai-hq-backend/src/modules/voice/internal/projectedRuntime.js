import { firstNonEmpty, obj, pickArray, pickBoolean } from "./primitives.js";

export function normalizeProjectedRuntimeForVoice(projectedRuntime = null, tenant = null) {
  const value = obj(projectedRuntime);
  const tenantScope = obj(tenant);
  const authority = obj(value.authority);
  const existingTenant =
    obj(value.tenant) || obj(value.tenantRow) || obj(value.tenantScope);

  const resolvedTenantId = firstNonEmpty(
    tenantScope.id,
    tenantScope.tenant_id,
    existingTenant.id,
    existingTenant.tenant_id,
    authority.tenantId,
    authority.tenant_id
  );

  const resolvedTenantKey = firstNonEmpty(
    tenantScope.tenant_key,
    tenantScope.tenantKey,
    existingTenant.tenant_key,
    existingTenant.tenantKey,
    authority.tenantKey,
    authority.tenant_key
  );

  const stableTenant = {
    ...existingTenant,
    ...tenantScope,
    id: resolvedTenantId || null,
    tenant_id: resolvedTenantId || null,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
    company_name: firstNonEmpty(
      tenantScope.company_name,
      existingTenant.company_name
    ),
    legal_name: firstNonEmpty(tenantScope.legal_name, existingTenant.legal_name),
    industry_key: firstNonEmpty(
      tenantScope.industry_key,
      existingTenant.industry_key
    ),
    country_code: firstNonEmpty(
      tenantScope.country_code,
      existingTenant.country_code
    ),
    timezone: firstNonEmpty(tenantScope.timezone, existingTenant.timezone),
    default_language: firstNonEmpty(
      tenantScope.default_language,
      existingTenant.default_language
    ),
    enabled_languages: pickArray(
      tenantScope.enabled_languages,
      existingTenant.enabled_languages
    ),
    market_region: firstNonEmpty(
      tenantScope.market_region,
      existingTenant.market_region
    ),
    plan_key: firstNonEmpty(tenantScope.plan_key, existingTenant.plan_key),
    tenant_status: firstNonEmpty(
      tenantScope.tenant_status,
      existingTenant.tenant_status
    ),
    tenant_active: pickBoolean(
      tenantScope.tenant_active,
      existingTenant.tenant_active
    ),
  };

  return {
    ...value,
    tenant: stableTenant,
    tenantRow: stableTenant,
    tenantScope: stableTenant,
    authority: {
      ...authority,
      strict: true,
      unavailable: false,
      tenantId: resolvedTenantId || null,
      tenant_id: resolvedTenantId || null,
      tenantKey: resolvedTenantKey,
      tenant_key: resolvedTenantKey,
    },
  };
}


