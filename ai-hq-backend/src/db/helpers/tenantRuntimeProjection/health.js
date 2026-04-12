import { arr, num, obj, s } from "./shared.js";

const ALL_AFFECTED_SURFACES = [
  "inbox",
  "comments",
  "leads",
  "voice",
  "meta",
  "twilio",
  "automation_executions",
];

function iso(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    return "";
  }
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function hasTime(value = "") {
  return !!iso(value);
}

function laterIso(left = "", right = "") {
  const leftIso = iso(left);
  const rightIso = iso(right);
  if (!leftIso) return rightIso;
  if (!rightIso) return leftIso;
  return new Date(leftIso).getTime() >= new Date(rightIso).getTime()
    ? leftIso
    : rightIso;
}

function normalizeReasonCode(reasonCode = "") {
  switch (lower(reasonCode)) {
    case "missing_runtime_projection":
    case "runtime_projection_missing":
      return "projection_missing";
    case "projection_hash_mismatch":
    case "source_snapshot_mismatch":
    case "source_profile_mismatch":
    case "source_capabilities_mismatch":
      return "truth_version_drift";
    case "approved_truth_unavailable":
      return "approval_required";
    case "runtime_status_not_ready":
      return "projection_build_failed";
    case "tenant_runtime_authority_unavailable":
    case "runtime_authority_unavailable":
    case "runtime_authority_mode_invalid":
    case "runtime_authority_source_invalid":
      return "authority_invalid";
    case "runtime_projection_stale":
      return "projection_stale";
    case "runtime_projection_run_unavailable":
    case "runtime_projection_persist_unavailable":
      return "projection_build_failed";
    case "provider_secret_missing":
    case "channel_identifiers_missing":
    case "voice_settings_missing":
      return "source_dependency_failed";
    case "repair_pending":
      return "repair_pending";
    case "consumer_contract_mismatch":
      return "consumer_contract_mismatch";
    default:
      return lower(reasonCode);
  }
}

function mapFreshnessReasons(freshness = {}) {
  const currentReasons = arr(obj(freshness).reasons)
    .map((item) => normalizeReasonCode(item))
    .filter(Boolean);

  if (
    currentReasons.includes("truth_version_drift") &&
    !currentReasons.includes("projection_stale")
  ) {
    currentReasons.unshift("projection_stale");
  }

  return uniqStrings(currentReasons);
}

function buildAffectedSurfaces({
  runtimeProjection = null,
  healthState = "",
} = {}) {
  const projection = obj(runtimeProjection);

  if (["missing", "stale", "blocked", "invalid"].includes(lower(healthState))) {
    return [...ALL_AFFECTED_SURFACES];
  }

  const surfaces = ["inbox", "comments", "automation_executions"];
  if (obj(projection.lead_capture_json).enabled === true) surfaces.push("leads");

  const voice = obj(projection.voice_json);
  if (voice.enabled === true || voice.supportsCalls === true) {
    surfaces.push("voice", "twilio");
  }

  const channels = arr(projection.channels_json);
  if (
    channels.some((item) =>
      ["instagram", "facebook", "messenger"].includes(
        lower(item?.channelType || item?.channel_type)
      )
    )
  ) {
    surfaces.push("meta");
  }

  return uniqStrings(surfaces);
}

function buildRepairActions({
  reasonCodes = [],
  activeReviewSession = null,
} = {}) {
  const reviewActive = !!s(obj(activeReviewSession).id);
  const actions = [];

  for (const reasonCode of uniqStrings(reasonCodes)) {
    switch (reasonCode) {
      case "projection_missing":
      case "projection_stale":
      case "truth_version_drift":
        actions.push("refresh_projection");
        break;
      case "approval_required":
        actions.push(reviewActive ? "re-run_finalize" : "verify_truth_publish");
        break;
      case "source_dependency_failed":
        actions.push("investigate_dependency_failure");
        actions.push("reconnect_provider");
        break;
      case "projection_build_failed":
      case "authority_invalid":
      case "consumer_contract_mismatch":
        actions.push("rebuild_runtime");
        break;
      case "repair_pending":
        actions.push("refresh_projection");
        break;
      default:
        break;
    }
  }

  if (reviewActive) actions.push("review_conflicts");

  return uniqStrings(actions).map((action) => ({
    id: action,
    action,
  }));
}

function buildLastKnownGood({
  currentProjection = null,
  latestSuccessRun = null,
} = {}) {
  const projection = obj(currentProjection);
  const successRun = obj(latestSuccessRun);
  const sourceSummary = obj(successRun.output_summary_json);

  const runtimeProjectionId =
    s(projection.id) || s(successRun.runtime_projection_id);
  const projectionHash =
    s(projection.projection_hash) ||
    s(sourceSummary.projectionHash || sourceSummary.projection_hash);
  const lastGoodAt = laterIso(
    projection.status === "ready"
      ? projection.updated_at || projection.created_at
      : "",
    successRun.finished_at || successRun.updated_at || successRun.created_at
  );

  if (!runtimeProjectionId && !lastGoodAt && !projectionHash) {
    return null;
  }

  return {
    runtimeProjectionId,
    projectionHash,
    status: s(projection.status || "ready"),
    lastGoodAt,
    runId: s(successRun.id),
    readinessLabel: s(
      projection.readiness_label || sourceSummary.readinessLabel
    ),
    readinessScore:
      Number.isFinite(Number(projection.readiness_score))
        ? Number(projection.readiness_score)
        : Number.isFinite(Number(sourceSummary.readinessScore))
        ? Number(sourceSummary.readinessScore)
        : null,
    confidenceLabel: s(
      projection.confidence_label || sourceSummary.confidenceLabel
    ),
    confidence:
      Number.isFinite(Number(projection.confidence))
        ? Number(projection.confidence)
        : Number.isFinite(Number(sourceSummary.confidence))
        ? Number(sourceSummary.confidence)
        : null,
    diagnosticOnly: true,
    usableAsAuthority: false,
  };
}

function buildReasonHistory({
  primaryReasonCodes = [],
  freshness = null,
  latestSuccessRun = null,
  latestFailureRun = null,
} = {}) {
  const history = [];
  const fresh = obj(freshness);
  const failure = obj(latestFailureRun);
  const success = obj(latestSuccessRun);

  for (const code of uniqStrings(primaryReasonCodes)) {
    history.push({
      kind: "health_reason",
      reasonCode: code,
      observedAt: iso(new Date().toISOString()),
      details: {
        freshnessReasons: arr(fresh.reasons),
      },
    });
  }

  if (s(failure.id)) {
    history.push({
      kind: "last_failure",
      reasonCode: normalizeReasonCode(
        failure.error_code || "projection_build_failed"
      ),
      observedAt: iso(
        failure.finished_at || failure.updated_at || failure.created_at
      ),
      details: {
        runId: s(failure.id),
        message: s(failure.error_message),
      },
    });
  }

  if (s(success.id)) {
    history.push({
      kind: "last_success",
      reasonCode: "refresh_projection",
      observedAt: iso(
        success.finished_at || success.updated_at || success.created_at
      ),
      details: {
        runId: s(success.id),
        runtimeProjectionId: s(success.runtime_projection_id),
      },
    });
  }

  return history.filter((item) => item.reasonCode);
}

function logRuntimeProjectionHealth(model, context = {}) {
  try {
    console.warn("[ai-hq] runtime projection health", {
      status: s(model?.status),
      primaryReasonCode: s(model?.primaryReasonCode),
      reasonCodes: arr(model?.reasonCodes),
      autonomousOperation: s(model?.autonomousOperation),
      latestTruthVersionId: s(context?.latestTruthVersionId),
      activeReviewSessionId: s(context?.activeReviewSessionId),
      runtimeProjectionId: s(context?.runtimeProjectionId),
      runtimeProjectionStatus: s(context?.runtimeProjectionStatus),
      repairActions: arr(model?.repairActions).map((item) => s(item?.action)),
    });
  } catch {}
}

export function buildRuntimeProjectionHealthModel({
  runtimeProjection = null,
  freshness = null,
  latestRun = null,
  latestSuccessRun = null,
  latestFailureRun = null,
  latestTruthVersion = null,
  activeReviewSession = null,
  authority = null,
} = {}) {
  const projection = obj(runtimeProjection);
  const fresh = obj(freshness);
  const latest = obj(latestRun);
  const truth = obj(latestTruthVersion);
  const auth = obj(authority);
  const reasonCodes = mapFreshnessReasons(fresh);

  if (!s(projection.id) && !reasonCodes.includes("projection_missing")) {
    reasonCodes.unshift("projection_missing");
  }

  if (!s(truth.id) && !reasonCodes.includes("approval_required")) {
    reasonCodes.push("approval_required");
  }

  if (
    s(latest.id) &&
    ["running", "queued", "pending"].includes(lower(latest.status))
  ) {
    reasonCodes.push("repair_pending");
  }

  const latestFailureAt = iso(
    obj(latestFailureRun).finished_at ||
      obj(latestFailureRun).updated_at ||
      obj(latestFailureRun).created_at
  );
  const latestSuccessAt = iso(
    obj(latestSuccessRun).finished_at ||
      obj(latestSuccessRun).updated_at ||
      obj(latestSuccessRun).created_at
  );
  if (
    latestFailureAt &&
    (!latestSuccessAt ||
      new Date(latestFailureAt).getTime() >
        new Date(latestSuccessAt || 0).getTime()) &&
    s(projection.id) &&
    lower(projection.status) === "ready" &&
    fresh.stale !== true
  ) {
    reasonCodes.push("source_dependency_failed");
  }

  if (auth && s(auth.source) && s(auth.source) !== "approved_runtime_projection") {
    reasonCodes.push("authority_invalid");
  }

  const normalizedReasons = uniqStrings(reasonCodes);
  let status = "healthy";

  if (normalizedReasons.includes("projection_missing")) {
    status = "missing";
  } else if (
    normalizedReasons.includes("authority_invalid") ||
    normalizedReasons.includes("projection_build_failed") ||
    normalizedReasons.includes("consumer_contract_mismatch")
  ) {
    status = "invalid";
  } else if (
    normalizedReasons.includes("approval_required") ||
    normalizedReasons.includes("repair_pending")
  ) {
    status = "blocked";
  } else if (
    normalizedReasons.includes("projection_stale") ||
    normalizedReasons.includes("truth_version_drift")
  ) {
    status = "stale";
  } else if (
    normalizedReasons.includes("source_dependency_failed") ||
    normalizedReasons.includes("degraded") ||
    (num(projection.confidence, 0) > 0 && num(projection.confidence, 0) < 0.6)
  ) {
    status = "degraded";
  }

  const affectedSurfaces = buildAffectedSurfaces({
    runtimeProjection,
    healthState: status,
  });
  const repairActions = buildRepairActions({
    reasonCodes: normalizedReasons,
    activeReviewSession,
  });
  const autonomousOperation =
    status === "healthy" ? "continue" : status === "degraded" ? "degrade" : "stop";

  const model = {
    status,
    primaryReasonCode: normalizedReasons[0] || "",
    reasonCodes: normalizedReasons,
    stale: status === "stale",
    blocked: status === "blocked",
    invalid: status === "invalid",
    missing: status === "missing",
    degraded: status === "degraded",
    healthy: status === "healthy",
    autonomousOperation,
    autonomousAllowed: autonomousOperation !== "stop",
    affectedSurfaces,
    repairActions,
    nextRecommendedRepair: repairActions[0] || null,
    lastKnownGood: buildLastKnownGood({
      currentProjection: projection.status === "ready" ? projection : null,
      latestSuccessRun,
    }),
    lastSuccess: obj(latestSuccessRun).id
      ? {
          runId: s(obj(latestSuccessRun).id),
          finishedAt: iso(
            obj(latestSuccessRun).finished_at ||
              obj(latestSuccessRun).updated_at ||
              obj(latestSuccessRun).created_at
          ),
          runtimeProjectionId: s(obj(latestSuccessRun).runtime_projection_id),
        }
      : null,
    lastFailure: obj(latestFailureRun).id
      ? {
          runId: s(obj(latestFailureRun).id),
          finishedAt: iso(
            obj(latestFailureRun).finished_at ||
              obj(latestFailureRun).updated_at ||
              obj(latestFailureRun).created_at
          ),
          errorCode: s(obj(latestFailureRun).error_code),
          errorMessage: s(obj(latestFailureRun).error_message),
        }
      : null,
    reasonHistory: buildReasonHistory({
      primaryReasonCodes: normalizedReasons,
      freshness,
      latestSuccessRun,
      latestFailureRun,
    }),
  };

  logRuntimeProjectionHealth(model, {
    latestTruthVersionId: s(truth.id),
    activeReviewSessionId: s(obj(activeReviewSession).id),
    runtimeProjectionId: s(projection.id),
    runtimeProjectionStatus: s(projection.status),
  });

  return model;
}

export const __test__ = {
  buildAffectedSurfaces,
  buildRepairActions,
  buildRuntimeProjectionHealthModel,
  mapFreshnessReasons,
  normalizeReasonCode,
};