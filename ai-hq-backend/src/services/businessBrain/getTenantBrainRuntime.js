import {
  buildRuntimeAuthorityFailurePayload,
  buildRuntimeAuthority,
  createRuntimeAuthorityError,
  isRuntimeAuthorityError,
  normalizeAuthorityMode,
} from "./runtimeAuthority.js";
import {
  buildLegacyFallbackRuntime,
  buildProjectionFirstRuntime,
  buildUnresolvedTenantFallback,
} from "./runtimeAssembler.js";
import {
  loadCurrentProjection,
  loadDbBrainData,
  loadLegacyTenant,
} from "./runtimeTenantData.js";
import { s } from "./runtimeShared.js";

export { buildRuntimeAuthorityFailurePayload, isRuntimeAuthorityError };

export async function getTenantBusinessRuntime(input = {}) {
  const db = input?.db || null;
  const authorityMode = normalizeAuthorityMode(input?.authorityMode);
  const tenantIdInput =
    s(input?.tenantId) ||
    s(input?.tenant?.id) ||
    s(input?.tenant?.tenant_id);
  const tenantKeyInput =
    s(input?.tenantKey) ||
    s(input?.tenant?.tenant_key) ||
    s(input?.tenant?.tenantKey);

  const legacyTenant = await loadLegacyTenant({
    db,
    tenantId: tenantIdInput,
    tenantKey: tenantKeyInput,
    tenant: input?.tenant || null,
  });

  if (!legacyTenant?.id && !legacyTenant?.tenant_key) {
    if (authorityMode === "strict") {
      throw createRuntimeAuthorityError({
        mode: authorityMode,
        tenantId: tenantIdInput,
        tenantKey: tenantKeyInput,
        reasonCode: "tenant_not_resolved",
        reason: "tenant_not_resolved",
        message:
          "Approved runtime authority is unavailable because the tenant could not be resolved.",
      });
    }

    return buildUnresolvedTenantFallback({
      authorityMode,
      tenantIdInput,
      fallbackKey: tenantKeyInput || "default",
      input,
    });
  }

  const projectionResult = await loadCurrentProjection({
    db,
    tenantId: legacyTenant.id,
    tenantKey: legacyTenant.tenant_key,
  });
  const projection = projectionResult?.projection || null;
  const projectionFreshness = projectionResult?.freshness || null;
  const dbData = await loadDbBrainData({ db, tenant: legacyTenant });

  if (projection?.id) {
    return buildProjectionFirstRuntime({
      legacyTenant,
      input,
      projection,
      freshness: projectionFreshness,
      dbData,
    });
  }

  if (authorityMode === "strict") {
    throw createRuntimeAuthorityError({
      mode: authorityMode,
      tenantId: legacyTenant.id,
      tenantKey: legacyTenant.tenant_key,
      reasonCode: "runtime_projection_missing",
      reason: "runtime_projection_missing",
      message:
        "Approved runtime authority is unavailable because no fresh runtime projection exists.",
    });
  }

  return buildLegacyFallbackRuntime({
    legacyTenant,
    input,
    dbData,
    authorityMode,
  });
}

export const buildBusinessRuntime = getTenantBusinessRuntime;
export const getBusinessRuntime = getTenantBusinessRuntime;
export const createBusinessRuntime = getTenantBusinessRuntime;
export const getTenantBrainRuntime = getTenantBusinessRuntime;
export const getTenantBusinessBrainRuntime = getTenantBusinessRuntime;
export const buildTenantBusinessRuntime = getTenantBusinessRuntime;
export const createTenantBusinessRuntime = getTenantBusinessRuntime;
export const resolveBusinessRuntime = getTenantBusinessRuntime;
export const resolveTenantBusinessRuntime = getTenantBusinessRuntime;
export const __test__ = {
  normalizeAuthorityMode,
  buildRuntimeAuthority,
  createRuntimeAuthorityError,
};

export default getTenantBusinessRuntime;
