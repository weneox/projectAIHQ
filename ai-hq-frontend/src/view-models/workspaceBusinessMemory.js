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
  const hasSetupFollowUp =
    setupState?.needsReview === true;

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

  const blocked = blockedItems.length
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

  return {
    visible: !!(
      truth?.latestVersionId ||
      pendingCount ||
      blockedItems.length ||
      latestRun
    ),
    headline: "Business Memory",
    description:
      "A calm summary of what the system currently knows about the business, what may have changed, and what still needs confirmation.",
    currentKnown,
    mayHaveChanged,
    needsConfirmation,
    blocked,
    recentlyReliable,
    stats: {
      approvedVersionId: s(truth?.latestVersionId),
      pendingCount,
      blockerCount: blockedItems.length,
    },
    primaryAction: pendingCount
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
          label: setupState?.action?.label || "Review setup",
          path: "/setup",
        }
      : null,
  };
}

export default buildWorkspaceBusinessMemory;
