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
        "Start by adding the business name and basic profile details.",
    });
  } else {
    moments.push({
      id: "found-business",
      label: "Here is what I found",
      summary: meta.quickSummary
        ? meta.quickSummary
        : `${meta.companyName} already has a setup profile in progress.`,
      detail:
        "The current draft is already available, so you can continue without starting over.",
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
        "Review these before the workspace relies on them.",
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
          : "Finish the missing details in setup to make the workspace more complete.",
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
        "The next setup step is ready when you are.",
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
    : "Continue setup";

  const description =
    meta.pendingCandidateCount > 0 || meta.reviewRequired
      ? "Some draft details still need a quick review before you continue."
      : meta.missingSteps.length > 0
        ? "Setup is still missing a few details."
        : "The next setup step is ready.";

  return {
    visible: true,
    meta,
    headline,
    description,
    moments: buildMoments(meta),
    primaryAction: {
      label: "Continue setup",
      path: "/setup",
    },
    secondaryAction:
      meta.pendingCandidateCount > 0 || meta.reviewRequired
        ? {
            label: "Review discovered business changes",
            path: "/setup",
          }
        : null,
  };
}

export default buildWorkspaceSetupGuidance;
