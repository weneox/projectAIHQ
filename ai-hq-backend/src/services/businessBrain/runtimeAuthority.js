import { arr, lower, obj, s } from "./runtimeShared.js";

function normalizeAuthorityMode(v) {
  const mode = lower(v || "strict");
  return mode === "strict" ? "strict" : "tolerant";
}

function buildRuntimeAuthority({
  mode = "strict",
  available = false,
  tenantId = "",
  tenantKey = "",
  runtimeProjection = null,
  freshness = null,
  health = null,
  reasonCode = "",
  reason = "",
} = {}) {
  const projection = obj(runtimeProjection);
  const normalizedFreshness = obj(freshness);
  const normalizedHealth = obj(health || normalizedFreshness.health);

  return {
    mode: normalizeAuthorityMode(mode),
    required: normalizeAuthorityMode(mode) === "strict",
    available: Boolean(available),
    source: available ? "approved_runtime_projection" : "",
    tenantId: s(tenantId || projection?.tenant_id || normalizedFreshness?.tenantId),
    tenantKey: s(tenantKey || projection?.tenant_key || normalizedFreshness?.tenantKey),
    runtimeProjectionId: s(projection?.id || normalizedFreshness?.runtimeProjectionId || ""),
    runtimeProjectionStatus: s(
      projection?.status || normalizedFreshness?.runtimeStatus || ""
    ),
    projectionHash: s(
      projection?.projection_hash || normalizedFreshness?.currentProjectionHash || ""
    ),
    sourceSnapshotId: s(
      projection?.source_snapshot_id || normalizedFreshness?.currentSources?.sourceSnapshotId
    ),
    sourceProfileId: s(
      projection?.source_profile_id || normalizedFreshness?.currentSources?.sourceProfileId
    ),
    sourceCapabilitiesId: s(
      projection?.source_capabilities_id ||
        normalizedFreshness?.currentSources?.sourceCapabilitiesId
    ),
    readinessLabel: s(projection?.readiness_label),
    readinessScore:
      typeof projection?.readiness_score === "number"
        ? projection.readiness_score
        : Number.isFinite(Number(projection?.readiness_score))
          ? Number(projection.readiness_score)
          : null,
    confidenceLabel: s(projection?.confidence_label),
    confidence:
      typeof projection?.confidence === "number"
        ? projection.confidence
        : Number.isFinite(Number(projection?.confidence))
          ? Number(projection.confidence)
          : null,
    stale: Boolean(normalizedFreshness?.stale),
    freshnessReasons: arr(normalizedFreshness?.reasons),
    health: normalizedHealth,
    reasonCode: s(reasonCode),
    reason: s(reason),
  };
}

function createRuntimeAuthorityError({
  mode = "strict",
  tenantId = "",
  tenantKey = "",
  runtimeProjection = null,
  freshness = null,
  reasonCode = "",
  reason = "",
  message = "",
} = {}) {
  const authority = buildRuntimeAuthority({
    mode,
    available: false,
    tenantId,
    tenantKey,
    runtimeProjection,
    freshness,
    health: obj(freshness?.health),
    reasonCode,
    reason,
  });

  const error = new Error(
    message || "Approved runtime authority is unavailable for this tenant."
  );
  error.code = "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE";
  error.statusCode = 409;
  error.runtimeAuthority = authority;
  return error;
}

function isRuntimeAuthorityError(error) {
  return (
    s(error?.code) === "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE" &&
    !!error?.runtimeAuthority
  );
}

function buildRuntimeAuthorityFailurePayload(
  error,
  { service = "", tenantKey = "" } = {}
) {
  const authority = obj(
    error?.runtimeAuthority ||
      buildRuntimeAuthority({
        mode: "strict",
        tenantKey,
        reasonCode: "runtime_authority_unavailable",
        reason: "runtime_authority_unavailable",
      })
  );

  return {
    ok: false,
    error: "runtime_authority_unavailable",
    details: {
      service: s(service),
      message: s(
        error?.message || "Approved runtime authority is unavailable for this tenant."
      ),
      code: s(error?.code || "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE"),
      authority,
    },
  };
}

export {
  buildRuntimeAuthority,
  buildRuntimeAuthorityFailurePayload,
  createRuntimeAuthorityError,
  isRuntimeAuthorityError,
  normalizeAuthorityMode,
};
