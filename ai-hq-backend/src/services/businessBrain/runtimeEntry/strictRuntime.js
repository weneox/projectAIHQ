import {
  createProjectionMissingError,
  createTenantNotResolvedError,
  emitResolvedTelemetry,
  emitStrictBlockedTelemetry,
  hasProjection,
  isTenantResolved,
} from "./decision.js";

async function loadStrictRuntime({
  input,
  telemetryLogger,
  tenantContext,
  loadPolicyControls,
  loadProjection,
  assembleProjectionRuntime,
}) {
  const { legacyTenant, tenantIdInput, tenantKeyInput } = tenantContext;

  if (!isTenantResolved(legacyTenant)) {
    const error = createTenantNotResolvedError({
      authorityMode: "strict",
      tenantIdInput,
      tenantKeyInput,
    });
    emitStrictBlockedTelemetry(telemetryLogger, error);
    throw error;
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

  const error = createProjectionMissingError({
    authorityMode: "strict",
    legacyTenant,
  });
  emitStrictBlockedTelemetry(telemetryLogger, error, {
    tenantId: legacyTenant?.id || "",
    tenantKey: legacyTenant?.tenant_key || "",
  });
  throw error;
}

export { loadStrictRuntime };
