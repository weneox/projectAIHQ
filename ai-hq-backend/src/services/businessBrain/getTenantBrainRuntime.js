import {
  buildRuntimeAuthorityFailurePayload,
  buildRuntimeAuthority,
  createRuntimeAuthorityError,
  isRuntimeAuthorityError,
  normalizeAuthorityMode,
} from "./runtimeAuthority.js";
import {
  buildInspectionFallbackRuntime,
  buildProjectionFirstRuntime,
  buildUnresolvedTenantFallback,
} from "./runtimeAssembler.js";
import {
  loadCurrentProjection,
  loadDbBrainData,
  loadLegacyTenant,
  loadTenantPolicyControls,
} from "./runtimeTenantData.js";
import { s } from "./runtimeShared.js";

export { buildRuntimeAuthorityFailurePayload, isRuntimeAuthorityError };

function getTelemetryLogger(input = {}) {
  const logger = input?.logger;
  if (!logger || typeof logger.child !== "function") return null;

  return logger.child({
    flow: "tenant_runtime_authority",
    tenantId: s(input?.tenantId || input?.tenant?.id || input?.tenant?.tenant_id),
    tenantKey: s(input?.tenantKey || input?.tenant?.tenant_key || input?.tenant?.tenantKey),
    authorityMode: normalizeAuthorityMode(input?.authorityMode),
  });
}

async function loadTenantBusinessRuntime(input = {}) {
  const db = input?.db || null;
  const authorityMode = normalizeAuthorityMode(input?.authorityMode);
  const telemetryLogger = getTelemetryLogger(input);
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
      const error = createRuntimeAuthorityError({
        mode: authorityMode,
        tenantId: tenantIdInput,
        tenantKey: tenantKeyInput,
        reasonCode: "tenant_not_resolved",
        reason: "tenant_not_resolved",
        message:
          "Approved runtime authority is unavailable because the tenant could not be resolved.",
      });
      telemetryLogger?.warn("runtime.authority.blocked", {
        reasonCode: s(error?.runtimeAuthority?.reasonCode || "tenant_not_resolved"),
      });
      throw error;
    }

    telemetryLogger?.info("runtime.authority.inspection_fallback", {
      reasonCode: "tenant_not_resolved",
    });
    return buildUnresolvedTenantFallback({
      authorityMode,
      tenantIdInput,
      fallbackKey: tenantKeyInput || "default",
      input,
    });
  }

  const policyControls = await loadTenantPolicyControls({
    db,
    tenant: legacyTenant,
  });

  const projectionResult = await loadCurrentProjection({
    db,
    tenantId: legacyTenant.id,
    tenantKey: legacyTenant.tenant_key,
  });
  const projection = projectionResult?.projection || null;
  const projectionFreshness = projectionResult?.freshness || null;

  if (projection?.id) {
    telemetryLogger?.info("runtime.authority.resolved", {
      runtimeProjectionId: s(projection?.id),
      runtimeProjectionStatus: s(projection?.status),
      reasonCode: s(projectionFreshness?.reasons?.[0] || ""),
    });
    return buildProjectionFirstRuntime({
      legacyTenant,
      input: {
        ...input,
        policyControls,
      },
      projection,
      freshness: projectionFreshness,
    });
  }

  if (authorityMode === "strict") {
    const error = createRuntimeAuthorityError({
      mode: authorityMode,
      tenantId: legacyTenant.id,
      tenantKey: legacyTenant.tenant_key,
      reasonCode: "runtime_projection_missing",
      reason: "runtime_projection_missing",
      message:
        "Approved runtime authority is unavailable because no fresh runtime projection exists.",
    });
    telemetryLogger?.warn("runtime.authority.blocked", {
      tenantId: s(legacyTenant?.id),
      tenantKey: s(legacyTenant?.tenant_key),
      reasonCode: s(error?.runtimeAuthority?.reasonCode || "runtime_projection_missing"),
    });
    throw error;
  }

  telemetryLogger?.info("runtime.authority.inspection_fallback", {
    tenantId: s(legacyTenant?.id),
    tenantKey: s(legacyTenant?.tenant_key),
    reasonCode: "inspection_legacy_runtime_fallback",
  });
  const dbData = await loadDbBrainData({ db, tenant: legacyTenant });
  return buildInspectionFallbackRuntime({
    legacyTenant,
    input: {
      ...input,
      policyControls,
    },
    dbData,
    authorityMode,
  });
}

export async function getTenantProjectedRuntimeStrict(input = {}) {
  return loadTenantBusinessRuntime({
    ...input,
    authorityMode: "strict",
  });
}

export async function inspectTenantBusinessRuntime(input = {}) {
  return loadTenantBusinessRuntime({
    ...input,
    authorityMode: "tolerant",
  });
}

export const getTenantBusinessRuntime = getTenantProjectedRuntimeStrict;
export const buildBusinessRuntime = getTenantProjectedRuntimeStrict;
export const getBusinessRuntime = getTenantProjectedRuntimeStrict;
export const createBusinessRuntime = getTenantProjectedRuntimeStrict;
export const getTenantBrainRuntime = getTenantProjectedRuntimeStrict;
export const getTenantBusinessBrainRuntime = getTenantProjectedRuntimeStrict;
export const buildTenantBusinessRuntime = getTenantProjectedRuntimeStrict;
export const createTenantBusinessRuntime = getTenantProjectedRuntimeStrict;
export const resolveBusinessRuntime = getTenantProjectedRuntimeStrict;
export const resolveTenantBusinessRuntime = getTenantProjectedRuntimeStrict;
export const inspectTenantBrainRuntime = inspectTenantBusinessRuntime;
export const __test__ = {
  normalizeAuthorityMode,
  buildRuntimeAuthority,
  createRuntimeAuthorityError,
};

export default getTenantProjectedRuntimeStrict;
