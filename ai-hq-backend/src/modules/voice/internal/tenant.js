import { firstNonEmpty, obj, pickArray, pickBoolean } from "./primitives.js";

export function normalizeRuntimeTenantRow({
  tenant = null,
  runtime = null,
  tenantKey = "",
  toNumber = "",
} = {}) {
  const tenantRow = obj(tenant);
  const runtimeValue = obj(runtime);
  const authority = obj(runtimeValue.authority);
  const runtimeTenant =
    obj(runtimeValue.tenant) ||
    obj(runtimeValue.tenantRow) ||
    obj(runtimeValue.tenantScope);
  const runtimeProfile = obj(runtimeValue.profile);
  const runtimeIdentity = obj(runtimeValue.identity);
  const rawProjection = obj(obj(runtimeValue.raw).projection);
  const identityJson = obj(rawProjection.identity_json);
  const profileJson = obj(rawProjection.profile_json);

  const resolvedTenantId = firstNonEmpty(
    tenantRow.id,
    tenantRow.tenant_id,
    runtimeTenant.id,
    runtimeTenant.tenant_id,
    identityJson.tenantId,
    identityJson.tenant_id,
    authority.tenantId,
    authority.tenant_id,
    runtimeValue.tenantId,
    runtimeValue.tenant_id
  );

  const resolvedTenantKey = firstNonEmpty(
    tenantRow.tenant_key,
    tenantRow.tenantKey,
    runtimeTenant.tenant_key,
    runtimeTenant.tenantKey,
    identityJson.tenantKey,
    identityJson.tenant_key,
    authority.tenantKey,
    authority.tenant_key,
    runtimeValue.tenantKey,
    runtimeValue.tenant_key,
    tenantKey
  );

  return {
    id: resolvedTenantId || null,
    tenant_id: resolvedTenantId || null,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
    company_name: firstNonEmpty(
      profileJson.companyName,
      identityJson.companyName,
      runtimeProfile.companyName,
      runtimeIdentity.companyName,
      runtimeTenant.company_name,
      runtimeTenant.companyName,
      tenantRow.company_name
    ),
    legal_name: firstNonEmpty(
      profileJson.legalName,
      identityJson.legalName,
      runtimeProfile.legalName,
      runtimeIdentity.legalName,
      runtimeTenant.legal_name,
      runtimeTenant.legalName,
      tenantRow.legal_name
    ),
    industry_key: firstNonEmpty(
      identityJson.industryKey,
      runtimeProfile.industryKey,
      runtimeTenant.industry_key,
      tenantRow.industry_key
    ),
    country_code: firstNonEmpty(
      identityJson.countryCode,
      runtimeProfile.countryCode,
      runtimeTenant.country_code,
      tenantRow.country_code
    ),
    timezone: firstNonEmpty(
      profileJson.timezone,
      runtimeProfile.timezone,
      runtimeTenant.timezone,
      tenantRow.timezone
    ),
    default_language: firstNonEmpty(
      identityJson.mainLanguage,
      profileJson.mainLanguage,
      runtimeProfile.defaultLanguage,
      runtimeTenant.default_language,
      tenantRow.default_language
    ),
    enabled_languages: pickArray(
      identityJson.supportedLanguages,
      profileJson.supportedLanguages,
      runtimeProfile.supportedLanguages,
      runtimeTenant.enabled_languages,
      tenantRow.enabled_languages
    ),
    market_region: firstNonEmpty(
      runtimeProfile.marketRegion,
      runtimeTenant.market_region,
      tenantRow.market_region
    ),
    plan_key: firstNonEmpty(runtimeTenant.plan_key, tenantRow.plan_key),
    tenant_status: firstNonEmpty(
      runtimeTenant.status,
      runtimeTenant.tenant_status,
      tenantRow.status,
      tenantRow.tenant_status
    ),
    tenant_active: pickBoolean(
      runtimeTenant.active,
      runtimeTenant.tenant_active,
      tenantRow.active,
      tenantRow.tenant_active
    ),
    to_number: firstNonEmpty(toNumber, tenantRow.to_number),
  };
}


export function normalizedRuntimeTenantKey(runtime = null) {
  const value = obj(runtime);
  const authority = obj(value.authority);
  const tenant = obj(value.tenant);
  const rawProjection = obj(obj(value.raw).projection);
  const identityJson = obj(rawProjection.identity_json);

  return firstNonEmpty(
    authority.tenantKey,
    authority.tenant_key,
    value.tenantKey,
    value.tenant_key,
    tenant.tenant_key,
    tenant.tenantKey,
    identityJson.tenantKey,
    identityJson.tenant_key
  );
}


export function normalizedRuntimeTenantId(runtime = null) {
  const value = obj(runtime);
  const authority = obj(value.authority);
  const tenant = obj(value.tenant);
  const rawProjection = obj(obj(value.raw).projection);
  const identityJson = obj(rawProjection.identity_json);

  return firstNonEmpty(
    authority.tenantId,
    authority.tenant_id,
    value.tenantId,
    value.tenant_id,
    tenant.id,
    tenant.tenant_id,
    identityJson.tenantId,
    identityJson.tenant_id
  );
}


export function buildStableTenantScope({
  tenant = null,
  runtime = null,
  tenantKey = "",
  toNumber = "",
} = {}) {
  const normalized = normalizeRuntimeTenantRow({
    tenant,
    runtime,
    tenantKey,
    toNumber,
  });

  const resolvedTenantId = firstNonEmpty(
    normalized.id,
    normalized.tenant_id,
    normalizedRuntimeTenantId(runtime)
  );

  const resolvedTenantKey = firstNonEmpty(
    normalized.tenant_key,
    normalized.tenantKey,
    normalizedRuntimeTenantKey(runtime),
    tenantKey
  );

  return {
    ...normalized,
    id: resolvedTenantId || null,
    tenant_id: resolvedTenantId || null,
    tenant_key: resolvedTenantKey,
    tenantKey: resolvedTenantKey,
  };
}


