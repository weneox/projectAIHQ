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
import { loadInspectionRuntime } from "./runtimeEntry/inspectionRuntime.js";
import { loadStrictRuntime } from "./runtimeEntry/strictRuntime.js";
import { getTelemetryLogger } from "./runtimeEntry/telemetry.js";
import { s } from "./runtimeShared.js";

export { buildRuntimeAuthorityFailurePayload, isRuntimeAuthorityError };

function buildTenantRuntimeContext(input = {}) {
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

  return {
    db,
    authorityMode,
    telemetryLogger,
    tenantIdInput,
    tenantKeyInput,
  };
}

async function loadTenantBusinessRuntime(input = {}) {
  const context = buildTenantRuntimeContext(input);
  const legacyTenant = await loadLegacyTenant({
    db: context.db,
    tenantId: context.tenantIdInput,
    tenantKey: context.tenantKeyInput,
    tenant: input?.tenant || null,
  });

  const tenantContext = {
    legacyTenant,
    tenantIdInput: context.tenantIdInput,
    tenantKeyInput: context.tenantKeyInput,
  };

  const runtimeDeps = {
    input: {
      ...input,
      authorityMode: context.authorityMode,
    },
    telemetryLogger: context.telemetryLogger,
    tenantContext,
    loadPolicyControls: (tenant) =>
      loadTenantPolicyControls({
        db: context.db,
        tenant,
      }),
    loadProjection: (tenant) =>
      loadCurrentProjection({
        db: context.db,
        tenantId: tenant?.id,
        tenantKey: tenant?.tenant_key,
      }),
    loadDbData: (tenant) =>
      loadDbBrainData({
        db: context.db,
        tenant,
      }),
    assembleProjectionRuntime: buildProjectionFirstRuntime,
    assembleInspectionRuntime: buildInspectionFallbackRuntime,
    assembleUnresolvedRuntime: buildUnresolvedTenantFallback,
  };

  if (context.authorityMode === "strict") {
    return loadStrictRuntime(runtimeDeps);
  }

  return loadInspectionRuntime(runtimeDeps);
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
