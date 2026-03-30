import { createRuntimeAuthorityError } from "../runtimeAuthority.js";
import { s } from "../runtimeShared.js";

function createTenantNotResolvedError({
  authorityMode,
  tenantIdInput = "",
  tenantKeyInput = "",
}) {
  return createRuntimeAuthorityError({
    mode: authorityMode,
    tenantId: tenantIdInput,
    tenantKey: tenantKeyInput,
    reasonCode: "tenant_not_resolved",
    reason: "tenant_not_resolved",
    message:
      "Approved runtime authority is unavailable because the tenant could not be resolved.",
  });
}

function createProjectionMissingError({
  authorityMode,
  legacyTenant,
}) {
  return createRuntimeAuthorityError({
    mode: authorityMode,
    tenantId: legacyTenant?.id,
    tenantKey: legacyTenant?.tenant_key,
    reasonCode: "runtime_projection_missing",
    reason: "runtime_projection_missing",
    message:
      "Approved runtime authority is unavailable because no fresh runtime projection exists.",
  });
}

function isTenantResolved(tenant) {
  return Boolean(tenant?.id || tenant?.tenant_key);
}

function hasProjection(projection) {
  return Boolean(projection?.id);
}

function emitStrictBlockedTelemetry(telemetryLogger, error, extra = {}) {
  telemetryLogger?.warn("runtime.authority.blocked", {
    ...extra,
    reasonCode: s(error?.runtimeAuthority?.reasonCode || extra?.reasonCode || ""),
  });
}

function emitInspectionFallbackTelemetry(telemetryLogger, payload = {}) {
  telemetryLogger?.info("runtime.authority.inspection_fallback", payload);
}

function emitResolvedTelemetry(telemetryLogger, projection, projectionFreshness) {
  telemetryLogger?.info("runtime.authority.resolved", {
    runtimeProjectionId: s(projection?.id),
    runtimeProjectionStatus: s(projection?.status),
    reasonCode: s(projectionFreshness?.reasons?.[0] || ""),
  });
}

export {
  createProjectionMissingError,
  createTenantNotResolvedError,
  emitInspectionFallbackTelemetry,
  emitResolvedTelemetry,
  emitStrictBlockedTelemetry,
  hasProjection,
  isTenantResolved,
};
