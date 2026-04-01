function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

const LEGACY_REVIEW_STAGES = new Set([
  "identity",
  "knowledge",
  "service",
  "review",
]);

export function normalizeSetupStudioStage(value = "") {
  const stage = lower(value);

  if (!stage) return "";
  if (LEGACY_REVIEW_STAGES.has(stage)) return "review";
  if (stage === "entry") return "entry";
  if (stage === "scanning") return "scanning";
  if (stage === "ready") return "ready";

  return "";
}

export function getSetupStudioHasServiceStage({
  serviceSuggestionTitle,
  services,
  visibleServiceCount,
}) {
  return (
    !!s(serviceSuggestionTitle) ||
    arr(services).length > 0 ||
    Number(visibleServiceCount || 0) > 0
  );
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
  setupCompleted = false,
  nextStudioStage = "",
  entryLocked = true,
  hasVisibleResults = false,
  hasAnyReviewContent = false,
}) {
  const mode = lower(discoveryMode);
  const normalizedPrevStage = normalizeSetupStudioStage(prevStage) || "entry";
  const normalizedNextStage = normalizeSetupStudioStage(nextStudioStage);
  const hasReviewContent = !!hasVisibleResults || !!hasAnyReviewContent;
  const forcedReady = !!setupCompleted || normalizedNextStage === "ready";

  if (importingWebsite || mode === "running") {
    return "scanning";
  }

  if (entryLocked) {
    return "entry";
  }

  if (!hasReviewContent) {
    return "entry";
  }

  if (forcedReady) {
    return "ready";
  }

  if (normalizedNextStage === "review") {
    return "review";
  }

  if (
    normalizedPrevStage === "entry" ||
    normalizedPrevStage === "scanning" ||
    normalizedPrevStage === "review"
  ) {
    return "review";
  }

  if (normalizedPrevStage === "ready") {
    return "review";
  }

  return "review";
}

export function resolveSetupStudioNextStageFromEntry() {
  return "scanning";
}

export function resolveSetupStudioNextStageFromIdentity() {
  return "review";
}

export function resolveSetupStudioNextStageFromKnowledge() {
  return "review";
}

export function resolveSetupStudioNextStageFromService() {
  return "ready";
}

export function resolveSetupStudioNextStageFromReview({
  setupCompleted = false,
} = {}) {
  return setupCompleted ? "ready" : "ready";
}