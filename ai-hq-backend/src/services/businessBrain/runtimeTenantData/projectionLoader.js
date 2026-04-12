import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
} from "../../../db/helpers/tenantRuntimeProjection.js";
import { createRuntimeAuthorityError } from "../runtimeAuthority.js";
import { hasDb } from "../runtimeShared.js";
import { runDbStep } from "./logging.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function hasSamePublishedTruthVersion(freshness = {}) {
  const currentId = s(freshness?.currentPublishedTruthVersionId);
  const expectedId = s(freshness?.expectedPublishedTruthVersionId);
  return Boolean(currentId && expectedId && currentId === expectedId);
}

function normalizeFreshnessReasonCodes(freshness = {}) {
  return [
    ...new Set(
      arr(freshness?.reasons).map((item) => lower(item)).filter(Boolean)
    ),
  ];
}

function canUseProjectionDespiteStaleFlag(freshness = {}, projection = null) {
  const reasonCodes = normalizeFreshnessReasonCodes(freshness);
  const projectionStatus = lower(projection?.status);

  if (!reasonCodes.length) return true;

  const samePublishedTruthVersion = hasSamePublishedTruthVersion(freshness);

  if (!samePublishedTruthVersion) {
    return false;
  }

  const toleratedReasonCodes = new Set([
    "runtime_status_not_ready",
    "projection_hash_mismatch",
    "source_snapshot_mismatch",
    "source_profile_mismatch",
    "source_capabilities_mismatch",
    "published_truth_version_mismatch",
  ]);

  const hasOnlyToleratedReasons = reasonCodes.every((code) =>
    toleratedReasonCodes.has(code)
  );

  if (!hasOnlyToleratedReasons) {
    return false;
  }

  return ["ready", "stale"].includes(projectionStatus);
}

function pickRuntimeProjectionFailureReasonCode(freshness = {}) {
  const healthPrimaryReasonCode = lower(
    freshness?.health?.primaryReasonCode || freshness?.health?.reasonCode
  );
  if (healthPrimaryReasonCode) return healthPrimaryReasonCode;

  const freshnessReason = lower(arr(freshness?.reasons)[0]);
  if (freshnessReason) return freshnessReason;

  return "runtime_projection_stale";
}

async function loadCurrentProjection({ db, tenantId = "", tenantKey = "" }) {
  if (!hasDb(db)) return null;

  const tenantRef = { id: tenantId, tenant_key: tenantKey };

  const current = await runDbStep(
    "getCurrentTenantRuntimeProjection",
    tenantRef,
    () => getCurrentTenantRuntimeProjection({ tenantId, tenantKey }, db)
  );

  if (current) {
    const freshness = await runDbStep(
      "getTenantRuntimeProjectionFreshness",
      tenantRef,
      () =>
        getTenantRuntimeProjectionFreshness(
          {
            tenantId,
            tenantKey,
            runtimeProjection: current,
          },
          db
        )
    );

    if (!freshness?.stale || canUseProjectionDespiteStaleFlag(freshness, current)) {
      return { projection: current, freshness };
    }

    const reasonCode = pickRuntimeProjectionFailureReasonCode(freshness);

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantId,
      tenantKey,
      runtimeProjection: current,
      freshness,
      reasonCode,
      reason: reasonCode,
      message:
        "Approved runtime projection is stale and automatic rebuild is disabled until a governed runtime refresh occurs.",
    });
  }

  return {
    projection: null,
    freshness: null,
  };
}

export { loadCurrentProjection };