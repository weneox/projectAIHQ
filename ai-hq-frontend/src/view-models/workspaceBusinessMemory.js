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

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
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
  setupGuidance = null,
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
    setupGuidance?.visible &&
    (setupGuidance?.meta?.pendingCandidateCount > 0 ||
      setupGuidance?.meta?.reviewRequired === true);

  const currentKnown = truth?.latestVersionId
    ? approvedAt
      ? `Approved business memory is currently anchored to version ${truth.latestVersionId}, last confirmed on ${approvedAt}.`
      : `Approved business memory is currently anchored to version ${truth.latestVersionId}.`
    : "The workspace does not yet have a stable approved business memory snapshot.";

  const mayHaveChanged = pendingCount
    ? candidates.length
      ? `${pendingCount} proposed business change${
          pendingCount === 1 ? "" : "s"
        } are waiting, including ${candidates
          .slice(0, 2)
          .map((item) => s(item?.title || item?.valueText || "an update"))
          .filter(Boolean)
          .join(" and ")}.`
      : `${pendingCount} proposed business change${
          pendingCount === 1 ? "" : "s"
        } may need review.`
    : "No meaningful business change pressure is visible in the current review summary.";

  const needsConfirmation = pendingCount
    ? candidates.length
      ? `${candidates.filter((item) => s(item?.approvalPolicy?.requiredRole)).length || pendingCount} item${
          pendingCount === 1 ? "" : "s"
        } still need human confirmation before approved business memory changes.`
      : `${pendingCount} business memory item${
          pendingCount === 1 ? "" : "s"
        } still need confirmation.`
    : hasSetupFollowUp
      ? "Setup still has unresolved imported details that should be confirmed before business memory is treated as complete."
      : "No immediate confirmation work is visible right now.";

  const blocked = blockedItems.length
    ? blockedItems
        .map((item) => s(item?.title || item?.reasonCode || "A memory blocker"))
        .filter(Boolean)
        .join(" • ")
    : "No active blockers are currently stopping business memory from being relied on.";

  const recentlyReliable =
    truth?.latestVersionId && approvedAt
      ? `The latest approved memory snapshot became reliable on ${approvedAt}.`
      : latestRun?.sourceDisplayName
        ? latestRun?.reviewRequired
          ? `${latestRun.sourceDisplayName} refreshed recently, but its new evidence still needs review.`
          : `${latestRun.sourceDisplayName} refreshed recently and is now contributing reliable evidence.`
        : "Recent reliability changes will appear here when new evidence or approvals arrive.";

  return {
    visible: !!(truth?.latestVersionId || pendingCount || blockedItems.length || latestRun),
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
          label: "Open business changes review",
          path: "/truth",
        }
      : {
          label: "Open detailed truth view",
          path: "/truth",
        },
    secondaryAction: hasSetupFollowUp
      ? {
          label: "Continue setup",
          path: "/setup/studio",
        }
      : null,
  };
}

export default buildWorkspaceBusinessMemory;
