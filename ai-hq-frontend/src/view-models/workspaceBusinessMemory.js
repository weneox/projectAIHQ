function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function formatDate(value = "") {
  const text = s(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString();
}

function actionPath(action = {}) {
  return s(action?.path || action?.target?.path);
}

function normalizeAction(action = null, fallback = null) {
  const primary = obj(action);
  const secondary = obj(fallback);
  const path = actionPath(primary) || actionPath(secondary);
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/truth",
  };
}

function normalizeReasonCodes(items = []) {
  return arr(items).map((item) => s(item).toLowerCase()).filter(Boolean);
}

function buildRuntimeHeadline(reasonCode = "") {
  switch (s(reasonCode).toLowerCase()) {
    case "projection_missing":
    case "runtime_projection_missing":
      return "Runtime has not been built yet.";
    case "projection_stale":
    case "runtime_projection_stale":
      return "Runtime needs refresh.";
    case "truth_version_drift":
      return "Runtime is out of sync with approved truth.";
    case "authority_invalid":
    case "runtime_authority_unavailable":
      return "Runtime repair is required.";
    case "repair_pending":
      return "Runtime repair is still running.";
    default:
      return "Truth or runtime needs repair.";
  }
}

function buildRuntimeSupportState(trust = null) {
  const runtimeProjection = obj(trust?.summary?.runtimeProjection);
  const truth = obj(trust?.summary?.truth);
  const runtimeReadiness = obj(runtimeProjection.readiness);
  const truthReadiness = obj(truth.readiness);
  const health = obj(runtimeProjection.health);

  const truthVersionId = s(truth.latestVersionId);
  const truthReady = truthReadiness.status === "ready" && Boolean(truthVersionId);
  const runtimeReady =
    runtimeReadiness.status === "ready" &&
    (health.usable === true ||
      health.autonomousAllowed === true ||
      obj(runtimeProjection.authority).available === true);

  const reasonCodes = normalizeReasonCodes([
    truthReadiness.reasonCode,
    ...arr(truthReadiness.blockedItems).map((item) => item?.reasonCode),
    health.reasonCode,
    ...arr(health.reasons),
    runtimeReadiness.reasonCode,
    ...arr(runtimeReadiness.blockedItems).map((item) => item?.reasonCode),
  ]);

  const leadReason = reasonCodes[0] || "";
  const repairAction =
    normalizeAction(health.repairAction) ||
    arr(health.repairActions).map((item) => normalizeAction(item)).find(Boolean) ||
    arr(runtimeReadiness.blockedItems)
      .map((item) => normalizeAction(item?.nextAction || item?.action || item?.repairAction))
      .find(Boolean) ||
    normalizeAction({ label: "Open truth", path: "/truth" });

  const headline = buildRuntimeHeadline(leadReason);
  const detail =
    s(runtimeReadiness.message) ||
    s(truthReadiness.message) ||
    s(health.lastFailure?.errorMessage) ||
    s(health.lastFailure?.errorCode);

  return {
    blocked: !truthReady || !runtimeReady,
    truthReady,
    runtimeReady,
    leadReason,
    reasonCodes,
    headline,
    detail,
    action: !truthReady
      ? normalizeAction(
          arr(truthReadiness.blockedItems)
            .map((item) => normalizeAction(item?.nextAction || item?.action || item?.repairAction))
            .find(Boolean),
          { label: "Continue AI setup", path: "/home?assistant=setup" }
        )
      : repairAction,
  };
}

export function buildWorkspaceBusinessMemory({
  trust = null,
  workbench = null,
  setupState = null,
} = {}) {
  const truth = obj(trust?.summary?.truth);
  const reviewQueue = obj(trust?.summary?.reviewQueue);
  const readiness = obj(truth?.readiness);
  const blockedItems = arr(readiness?.blockedItems).slice(0, 3);
  const candidates = arr(workbench?.items).slice(0, 4);
  const recentRuns = arr(trust?.recentRuns);
  const latestRun = recentRuns[0] || null;
  const approvedAt = formatDate(truth?.approvedAt);
  const pendingCount = Math.max(
    Number(reviewQueue?.pending || 0),
    candidates.length
  );
  const hasSetupFollowUp = setupState?.needsReview === true;
  const runtime = buildRuntimeSupportState(trust);

  const currentKnown = truth?.latestVersionId
    ? approvedAt
      ? `Approved snapshot ${truth.latestVersionId} was last confirmed on ${approvedAt}.`
      : `Approved snapshot ${truth.latestVersionId} is active.`
    : "No approved business-memory snapshot is available yet.";

  const mayHaveChanged = pendingCount
    ? candidates.length
      ? `${pendingCount} proposed business change${
          pendingCount === 1 ? "" : "s"
        } ${pendingCount === 1 ? "is" : "are"} waiting, including ${candidates
          .slice(0, 2)
          .map((item) => s(item?.title || item?.valueText || "an update"))
          .filter(Boolean)
          .join(" and ")}.`
      : `${pendingCount} proposed business change${
          pendingCount === 1 ? "" : "s"
        } ${pendingCount === 1 ? "needs" : "need"} review.`
    : "No business changes are waiting.";

  const needsConfirmation = pendingCount
    ? candidates.length
      ? `${candidates.filter((item) => s(item?.approvalPolicy?.requiredRole)).length || pendingCount} item${
          pendingCount === 1 ? "" : "s"
        } still ${pendingCount === 1 ? "needs" : "need"} confirmation before the approved snapshot changes.`
      : `${pendingCount} business memory item${
          pendingCount === 1 ? "" : "s"
        } still ${pendingCount === 1 ? "needs" : "need"} confirmation.`
    : hasSetupFollowUp
      ? "Setup review is still open, so business memory should be treated cautiously."
      : "No confirmation work is waiting.";

  const blocked = runtime.blocked
    ? runtime.detail
      ? `${runtime.headline} ${runtime.detail}`.trim()
      : runtime.headline
    : blockedItems.length
      ? blockedItems
          .map((item) => s(item?.title || item?.reasonCode || "A memory blocker"))
          .filter(Boolean)
          .join(" | ")
      : "No active blockers are visible.";

  const recentlyReliable =
    truth?.latestVersionId && approvedAt
      ? `The approved snapshot became reliable on ${approvedAt}.`
      : latestRun?.sourceDisplayName
        ? latestRun?.reviewRequired
          ? `${latestRun.sourceDisplayName} refreshed and opened review work.`
          : `${latestRun.sourceDisplayName} refreshed successfully.`
        : "No recent business-memory activity is available.";

  const blockerCount = blockedItems.length + (runtime.blocked ? 1 : 0);

  return {
    visible: !!(
      truth?.latestVersionId ||
      pendingCount ||
      blockedItems.length ||
      latestRun ||
      runtime.blocked
    ),
    headline: "Business Memory",
    description:
      "A calm summary of what the system currently knows about the business, what may have changed, and what still needs confirmation.",
    currentKnown,
    mayHaveChanged,
    needsConfirmation,
    blocked,
    recentlyReliable,
    runtime: {
      blocked: runtime.blocked,
      truthReady: runtime.truthReady,
      runtimeReady: runtime.runtimeReady,
      leadReason: runtime.leadReason,
      reasonCodes: runtime.reasonCodes,
      action: runtime.action,
      summary: runtime.blocked ? blocked : "",
      headline: runtime.headline,
    },
    stats: {
      approvedVersionId: s(truth?.latestVersionId),
      pendingCount,
      blockerCount,
    },
    primaryAction: runtime.blocked
      ? runtime.action || { label: "Open truth", path: "/truth" }
      : pendingCount
        ? {
            label: "Review business changes",
            path: "/truth",
          }
        : {
            label: "View business memory",
            path: "/truth",
          },
    secondaryAction: hasSetupFollowUp
      ? {
          label: setupState?.action?.label || "Open setup assistant",
          path: "/home?assistant=setup",
        }
      : null,
  };
}

export default buildWorkspaceBusinessMemory;