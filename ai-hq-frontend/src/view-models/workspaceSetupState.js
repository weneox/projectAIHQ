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

function firstString(values = []) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }
  return "";
}

function firstBoolean(values = []) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function firstNumber(values = []) {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function formatMissingStep(value = "") {
  const text = s(value);
  return text ? titleize(text) : "setup details";
}

function buildSetupMeta(bootstrap = {}, setup = {}) {
  const workspace = obj(bootstrap?.workspace);
  const bootstrapSetup = obj(bootstrap?.setup);
  const setupRoot = obj(setup?.setup || setup);
  const progress = obj(bootstrapSetup?.progress || workspace?.progress || workspace);
  const setupProgress = obj(
    setupRoot?.progress || setupRoot?.workspace || setupRoot
  );
  const knowledge = obj(setupRoot?.knowledge);
  const tenantProfile = obj(
    setupRoot?.tenantProfile ||
      setupRoot?.businessProfile ||
      workspace?.tenantProfile ||
      workspace?.businessProfile
  );

  const missingSteps = [
    ...arr(setupProgress?.missingSteps),
    ...arr(progress?.missingSteps),
  ]
    .map((item) => s(item))
    .filter(Boolean);

  return {
    companyName: s(tenantProfile?.companyName),
    quickSummary: firstString([
      setupRoot?.quickSummary,
      knowledge?.quickSummary,
    ]),
    setupCompleted: firstBoolean([
      setupProgress?.setupCompleted,
      progress?.setupCompleted,
      workspace?.setupCompleted,
    ]),
    readinessLabel: firstString([
      setupProgress?.readinessLabel,
      progress?.readinessLabel,
      workspace?.readinessLabel,
    ]),
    nextStudioStage: firstString([
      progress?.nextStudioStage,
      setupProgress?.nextStudioStage,
      workspace?.nextStudioStage,
    ]),
    primaryMissingStep: firstString([
      setupProgress?.primaryMissingStep,
      progress?.primaryMissingStep,
      workspace?.primaryMissingStep,
    ]),
    missingSteps,
    pendingCandidateCount: Math.max(
      firstNumber([
        knowledge?.pendingCandidateCount,
        setupRoot?.pendingCandidateCount,
        setupProgress?.pendingCandidateCount,
        progress?.pendingCandidateCount,
      ]),
      0
    ),
    reviewRequired:
      setupRoot?.reviewRequired === true ||
      setupRoot?.review_required === true ||
      knowledge?.reviewRequired === true ||
      knowledge?.review_required === true,
  };
}

function buildStatePresentation(status, meta = {}) {
  const missingStep = formatMissingStep(
    meta.primaryMissingStep || meta.missingSteps[0]
  );

  switch (status) {
    case "unavailable":
      return {
        badge: "Unavailable",
        tone: "danger",
        title: "Setup signal is unavailable.",
        summary:
          "Workspace cannot confirm setup status right now. Retry before treating setup as healthy.",
        action: null,
      };
    case "pending_review":
      return {
        badge: "Needs review",
        tone: "warn",
        title: "Review setup before continuing.",
        summary:
          meta.pendingCandidateCount > 0
            ? `${meta.pendingCandidateCount} imported ${meta.pendingCandidateCount === 1 ? "item needs" : "items need"} review before setup can be trusted.`
            : "Imported setup details still need operator review.",
        action: {
          label: "Open setup assistant",
          path: "/home?assistant=setup",
        },
      };
    case "ready_to_continue":
      return {
        badge: "Continue setup",
        tone: "info",
        title: "Finish setup.",
        summary: meta.primaryMissingStep || meta.missingSteps.length
          ? `${missingStep} is still missing.`
          : "Setup still needs a few details before the workspace is complete.",
        action: {
          label: "Open setup assistant",
          path: "/home?assistant=setup",
        },
      };
    case "completed":
      return {
        badge: "Complete",
        tone: "success",
        title: "Setup is complete.",
        summary: meta.companyName
          ? `${meta.companyName} has enough setup coverage for normal workspace operation.`
          : "Core setup details are already in place.",
        action: null,
      };
    default:
      return {
        badge: "Unknown",
        tone: "neutral",
        title: "Setup status is unclear.",
        summary:
          "Workspace has some setup signal, but not enough to claim that setup is complete or actionable.",
        action: null,
      };
  }
}

export function buildWorkspaceSetupState({
  bootstrap = null,
  setup = null,
  sourceStatus = {},
} = {}) {
  const meta = buildSetupMeta(bootstrap || {}, setup || {});
  const bootstrapAvailable = sourceStatus.bootstrap?.available !== false;
  const setupAvailable = sourceStatus.setup?.available !== false;
  const anySetupSignalAvailable = bootstrapAvailable || setupAvailable;

  let status = "unknown";

  if (!anySetupSignalAvailable) {
    status = "unavailable";
  } else if (meta.reviewRequired || meta.pendingCandidateCount > 0) {
    status = "pending_review";
  } else if (meta.setupCompleted === true) {
    status = "completed";
  } else if (
    meta.setupCompleted === false ||
    Boolean(meta.primaryMissingStep) ||
    meta.missingSteps.length > 0 ||
    Boolean(meta.readinessLabel) ||
    Boolean(meta.nextStudioStage)
  ) {
    status = "ready_to_continue";
  }

  const presentation = buildStatePresentation(status, meta);

  return {
    id: "setup",
    label: "Setup",
    status,
    meta,
    visible: status !== "completed" && status !== "unknown",
    isActionable: ["pending_review", "ready_to_continue"].includes(status),
    isUnavailable: status === "unavailable",
    needsReview: status === "pending_review",
    isComplete: status === "completed",
    badge: presentation.badge,
    tone: presentation.tone,
    title: presentation.title,
    summary: presentation.summary,
    action: presentation.action,
  };
}

export default buildWorkspaceSetupState;
