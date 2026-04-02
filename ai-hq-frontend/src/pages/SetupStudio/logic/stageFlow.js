function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

const STAGES = new Set(["entry", "scanning", "review", "confirm"]);

export function normalizeSetupStudioStage(value = "") {
  const stage = lower(value);
  return STAGES.has(stage) ? stage : "";
}

export function getSetupStudioHasAnyReviewContent({
  discoveryProfileRows,
  knowledgeItems,
  services,
  reviewSources,
  reviewEvents,
  discoveryWarnings,
}) {
  return !!(
    arr(discoveryProfileRows).length ||
    arr(knowledgeItems).length ||
    arr(services).length ||
    arr(reviewSources).length ||
    arr(reviewEvents).length ||
    arr(discoveryWarnings).length
  );
}

export function resolveSetupStudioStage({
  prevStage = "entry",
  importingWebsite = false,
  discoveryMode = "",
  entryLocked = true,
  nextStudioStage = "",
  hasVisibleResults = false,
  hasAnyReviewContent = false,
}) {
  if (entryLocked) {
    return "entry";
  }

  if (
    importingWebsite ||
    lower(discoveryMode) === "running" ||
    lower(nextStudioStage) === "scanning"
  ) {
    return "scanning";
  }

  if (
    hasVisibleResults ||
    hasAnyReviewContent ||
    lower(nextStudioStage) === "review" ||
    lower(nextStudioStage) === "confirm"
  ) {
    return prevStage === "confirm" ? "confirm" : "review";
  }

  return "entry";
}

export function resolveSetupStudioNextStageFromEntry() {
  return "scanning";
}

export function resolveSetupStudioNextStageFromReview() {
  return "confirm";
}

export function resolveSetupStudioNextStageFromConfirm() {
  return "confirm";
}
