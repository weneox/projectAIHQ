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

function buildSetupMeta(bootstrap = {}, overview = {}) {
  const workspace = obj(bootstrap?.workspace);
  const setup = obj(bootstrap?.setup);
  const setupRoot = obj(overview?.setup || overview);
  const progress = obj(setup?.progress || workspace?.progress || workspace);
  const overviewProgress = obj(
    setupRoot?.progress || setupRoot?.workspace || setupRoot
  );
  const knowledge = obj(setupRoot?.knowledge);
  const tenantProfile = obj(
    setupRoot?.tenantProfile ||
      setupRoot?.businessProfile ||
      workspace?.tenantProfile ||
      workspace?.businessProfile
  );

  const missingSteps = arr(
    overviewProgress?.missingSteps || progress?.missingSteps
  )
    .map((item) => s(item))
    .filter(Boolean);

  const reviewRequired =
    setupRoot?.reviewRequired === true ||
    setupRoot?.review_required === true ||
    knowledge?.reviewRequired === true ||
    knowledge?.review_required === true;

  return {
    companyName: s(tenantProfile?.companyName),
    quickSummary: s(setupRoot?.quickSummary || knowledge?.quickSummary),
    setupCompleted: !!(
      overviewProgress?.setupCompleted ??
      progress?.setupCompleted ??
      workspace?.setupCompleted ??
      false
    ),
    readinessLabel: s(
      overviewProgress?.readinessLabel ||
        progress?.readinessLabel ||
        workspace?.readinessLabel
    ),
    primaryMissingStep: s(
      overviewProgress?.primaryMissingStep ||
        progress?.primaryMissingStep ||
        workspace?.primaryMissingStep
    ),
    missingSteps,
    pendingCandidateCount: Number(
      knowledge?.pendingCandidateCount ||
        setupRoot?.pendingCandidateCount ||
        overviewProgress?.pendingCandidateCount ||
        progress?.pendingCandidateCount ||
        0
    ),
    reviewRequired,
  };
}

function buildMoments(meta = {}) {
  const moments = [];

  if (!meta.companyName) {
    moments.push({
      id: "introduce-business",
      label: "Introduce your business",
      summary:
        "The workspace still needs a clear business identity before setup can feel complete.",
      detail:
        "Start by confirming the business name and core profile details in the existing setup flow.",
    });
  } else {
    moments.push({
      id: "found-business",
      label: "Here is what I found",
      summary: meta.quickSummary
        ? meta.quickSummary
        : `${meta.companyName} already has a setup profile in progress.`,
      detail:
        "The current setup summary is being reused here so you can continue without opening staged setup screens first.",
    });
  }

  if (meta.pendingCandidateCount > 0 || meta.reviewRequired) {
    moments.push({
      id: "unsure-items",
      label: "I am unsure about these items",
      summary:
        meta.pendingCandidateCount > 0
          ? `${meta.pendingCandidateCount} discovered item${
              meta.pendingCandidateCount === 1 ? "" : "s"
            } still need review.`
          : "Some imported setup details still require review before they can be trusted.",
      detail:
        "These are still handled by the existing setup review logic and remain source-of-truth there.",
    });
  }

  if (meta.missingSteps.length > 0 || meta.primaryMissingStep) {
    const missingLabel =
      meta.primaryMissingStep ||
      meta.missingSteps[0] ||
      "core setup details";

    moments.push({
      id: "missing-details",
      label: "Here is what is missing",
      summary: `The setup flow is still missing ${titleize(missingLabel)}.`,
      detail:
        meta.missingSteps.length > 1
          ? `Other missing areas: ${meta.missingSteps
              .slice(1, 3)
              .map((item) => titleize(item))
              .join(", ")}.`
          : "Finish the missing details in Setup Studio to unlock a more complete operating posture.",
    });
  }

  if (!meta.setupCompleted) {
    moments.push({
      id: "ready-to-continue",
      label: "You are ready to continue",
      summary: meta.readinessLabel
        ? `Current setup posture is ${titleize(meta.readinessLabel)}.`
        : "The next part of setup is ready when you are.",
      detail:
        "The guided workspace keeps the setup story calm here, but the actual step-by-step work still runs through the existing setup experience.",
    });
  }

  return moments.slice(0, 4);
}

export function buildWorkspaceSetupGuidance({
  bootstrap = null,
  overview = null,
} = {}) {
  const meta = buildSetupMeta(bootstrap || {}, overview || {});
  const visible =
    !meta.setupCompleted ||
    meta.pendingCandidateCount > 0 ||
    meta.reviewRequired ||
    meta.missingSteps.length > 0;

  if (!visible) {
    return {
      visible: false,
      meta,
      headline: "",
      description: "",
      moments: [],
      primaryAction: null,
      secondaryAction: null,
    };
  }

  const headline = meta.companyName
    ? `Continue setup for ${meta.companyName}`
    : "Continue setup intake";

  const description =
    meta.pendingCandidateCount > 0 || meta.reviewRequired
      ? "Setup still has discovered details that need review before the system can fully rely on them."
      : meta.missingSteps.length > 0
        ? "Setup is still missing a few details, so the workspace is keeping guidance conservative."
        : "The workspace can keep guiding setup here without exposing the old stage machine.";

  return {
    visible: true,
    meta,
    headline,
    description,
    moments: buildMoments(meta),
    primaryAction: {
      label: "Continue setup",
      path: "/setup/studio",
    },
    secondaryAction:
      meta.pendingCandidateCount > 0 || meta.reviewRequired
        ? {
            label: "Review discovered business changes",
            path: "/setup/studio",
          }
        : null,
  };
}

export default buildWorkspaceSetupGuidance;
