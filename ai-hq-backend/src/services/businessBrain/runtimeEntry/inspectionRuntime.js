import {
  emitInspectionFallbackTelemetry,
  emitResolvedTelemetry,
  hasProjection,
  isTenantResolved,
} from "./decision.js";

async function loadInspectionRuntime({
  input,
  telemetryLogger,
  tenantContext,
  loadPolicyControls,
  loadProjection,
  loadDbData,
  assembleProjectionRuntime,
  assembleInspectionRuntime,
  assembleUnresolvedRuntime,
}) {
  const { legacyTenant, tenantIdInput, tenantKeyInput } = tenantContext;

  if (!isTenantResolved(legacyTenant)) {
    emitInspectionFallbackTelemetry(telemetryLogger, {
      reasonCode: "tenant_not_resolved",
    });
    return assembleUnresolvedRuntime({
      authorityMode: "tolerant",
      tenantIdInput,
      fallbackKey: tenantKeyInput || "default",
      input,
    });
  }

  const policyControls = await loadPolicyControls(legacyTenant);
  const projectionResult = await loadProjection(legacyTenant);
  const projection = projectionResult?.projection || null;
  const projectionFreshness = projectionResult?.freshness || null;

  if (hasProjection(projection)) {
    emitResolvedTelemetry(telemetryLogger, projection, projectionFreshness);
    return assembleProjectionRuntime({
      legacyTenant,
      input: {
        ...input,
        policyControls,
      },
      projection,
      freshness: projectionFreshness,
    });
  }

  emitInspectionFallbackTelemetry(telemetryLogger, {
    tenantId: legacyTenant?.id || "",
    tenantKey: legacyTenant?.tenant_key || "",
    reasonCode: "inspection_legacy_runtime_fallback",
  });
  const dbData = await loadDbData(legacyTenant);
  return assembleInspectionRuntime({
    legacyTenant,
    input: {
      ...input,
      policyControls,
    },
    dbData,
    authorityMode: "tolerant",
  });
}

export { loadInspectionRuntime };
