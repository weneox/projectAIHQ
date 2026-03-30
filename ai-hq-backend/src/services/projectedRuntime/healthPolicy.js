import { arr, lower, obj, s } from "./shared.js";
import { healthAffectsConsumerSurface } from "./consumerSurface.js";
import { hasMetaProviderAccess } from "./meta.js";

const VOICE_OPERATIONAL_REASON_CODES = new Set([
  "voice_settings_missing",
  "voice_disabled",
  "voice_phone_number_missing",
  "voice_provider_unsupported",
]);

const META_OPERATIONAL_REASON_CODES = new Set([
  "channel_not_connected",
  "channel_identifiers_missing",
  "provider_secret_missing",
]);

const NON_FATAL_GOVERNANCE_REVIEW_REASON_CODES = new Set([
  "approval_required",
  "review_required",
  "candidate_review_required",
  "maintenance_review_required",
  "governance_review_required",
]);

export function normalizeAffectedSurfaces(health = {}) {
  const value = obj(health);
  const merged = [
    ...arr(value.affectedSurfaces),
    ...arr(value.affected_surfaces),
    ...arr(value.surfaces),
    ...arr(value.surfaceKeys),
  ];

  return [...new Set(merged.map((item) => lower(item)).filter(Boolean))];
}

export function collectReasonCodes(authority = {}, health = {}) {
  const merged = [
    s(health.primaryReasonCode),
    s(health.reasonCode),
    s(health.primary_reason_code),
    s(health.reason_code),
    s(authority.reasonCode),
    s(authority.reason),
    ...arr(health.reasonCodes),
    ...arr(health.reason_codes),
    ...arr(health.blockerReasonCodes),
    ...arr(health.blocker_reason_codes),
  ];

  return [...new Set(merged.map((item) => lower(item)).filter(Boolean))];
}

export function shouldTreatMissingHealthAsFatal({
  authority = {},
  projectionId = "",
  health = {},
} = {}) {
  const reasonCode = lower(
    health.primaryReasonCode ||
      health.reasonCode ||
      authority.reasonCode ||
      authority.reason
  );

  if (!projectionId) return true;

  if (
    reasonCode === "projection_missing" ||
    reasonCode === "runtime_projection_missing" ||
    reasonCode === "authority_invalid"
  ) {
    return true;
  }

  return false;
}

export function shouldAllowGovernanceReviewBlockedHealth({
  authority = {},
  projectionId = "",
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
} = {}) {
  const status = lower(health.status);
  const reasonCodes = collectReasonCodes(authority, health);

  if (status !== "blocked") return false;
  if (!projectionId) return false;
  if (authority.available !== true) return false;
  if (s(authority.source) !== "approved_runtime_projection") return false;
  if (reasonCodes.length === 0) return false;

  const governanceOnly = reasonCodes.every((code) =>
    NON_FATAL_GOVERNANCE_REVIEW_REASON_CODES.has(code)
  );

  if (!governanceOnly) return false;

  if (consumerSurface === "voice" || consumerSurface === "twilio") {
    const voiceOperational = obj(obj(operationalChannels).voice);
    return voiceOperational.ready === true;
  }

  if (consumerSurface === "meta") {
    const metaOperational = obj(obj(operationalChannels).meta);
    const metaReady =
      metaOperational.ready === true ||
      Boolean(s(metaOperational.pageId) || s(metaOperational.igUserId));

    return metaReady && hasMetaProviderAccess(providerSecrets);
  }

  return false;
}

export function shouldAllowVoiceDespiteAuthorityStale({
  authority = {},
  health = {},
  consumerSurface = "",
  operationalChannels = null,
} = {}) {
  const normalizedReasonCode = lower(
    authority.reasonCode ||
      authority.reason_code ||
      health.primaryReasonCode ||
      health.reasonCode
  );
  const voiceOperational = obj(obj(operationalChannels).voice);

  return (
    (consumerSurface === "voice" || consumerSurface === "twilio") &&
    authority.available === true &&
    s(authority.source) === "approved_runtime_projection" &&
    voiceOperational.ready === true &&
    ["projection_stale", "truth_version_drift"].includes(
      normalizedReasonCode
    )
  );
}

export function shouldAllowConsumerDespiteBlockedHealth({
  authority = {},
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
} = {}) {
  const reasonCodes = collectReasonCodes(authority, health);
  if (reasonCodes.length === 0) return false;

  if (consumerSurface === "voice" || consumerSurface === "twilio") {
    const voiceOperational = obj(obj(operationalChannels).voice);
    if (voiceOperational.ready !== true) return false;
    return reasonCodes.every((code) => VOICE_OPERATIONAL_REASON_CODES.has(code));
  }

  if (consumerSurface === "meta") {
    const metaOperational = obj(obj(operationalChannels).meta);
    const metaReady =
      metaOperational.ready === true ||
      Boolean(s(metaOperational.pageId) || s(metaOperational.igUserId));

    if (!metaReady) return false;
    if (!hasMetaProviderAccess(providerSecrets)) return false;

    return reasonCodes.every((code) => META_OPERATIONAL_REASON_CODES.has(code));
  }

  return false;
}

export function shouldBlockForProjectionHealth({
  authority = {},
  projectionId = "",
  health = {},
  consumerSurface = "",
  operationalChannels = null,
  providerSecrets = null,
} = {}) {
  const status = lower(health.status);
  const normalizedReasonCode = lower(
    health.primaryReasonCode || health.reasonCode || authority.reasonCode
  );
  const voiceOperational = obj(obj(operationalChannels).voice);

  if (!["missing", "stale", "blocked", "invalid"].includes(status)) {
    return false;
  }

  if (status === "missing") {
    return shouldTreatMissingHealthAsFatal({
      authority,
      projectionId,
      health,
    });
  }

  if (status === "blocked") {
    if (
      shouldAllowGovernanceReviewBlockedHealth({
        authority,
        projectionId,
        health,
        consumerSurface,
        operationalChannels,
        providerSecrets,
      })
    ) {
      return false;
    }

    const affectedSurfaces = normalizeAffectedSurfaces(health);

    if (consumerSurface && affectedSurfaces.length > 0) {
      if (!healthAffectsConsumerSurface(affectedSurfaces, consumerSurface)) {
        return false;
      }
    }

    if (
      shouldAllowConsumerDespiteBlockedHealth({
        authority,
        health,
        consumerSurface,
        operationalChannels,
        providerSecrets,
      })
    ) {
      return false;
    }
  }

  if (
    (consumerSurface === "voice" || consumerSurface === "twilio") &&
    status === "stale" &&
    voiceOperational.ready === true &&
    ["projection_stale", "truth_version_drift"].includes(normalizedReasonCode)
  ) {
    return false;
  }

  return true;
}
