function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

const COLLAPSED_REVIEW_STAGES = new Set([
  "identity",
  "knowledge",
  "service",
  "review",
  "ready",
]);

export function normalizeSetupStudioStage(value = "") {
  const stage = lower(value);

  if (!stage) return "";
  if (stage === "entry") return "entry";
  if (stage === "scanning") return "scanning";
  if (COLLAPSED_REVIEW_STAGES.has(stage)) return "review";

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
  importingWebsite = false,
  discoveryMode = "",
  setupCompleted = false,
  nextStudioStage = "",
  entryLocked = true,
  hasVisibleResults = false,
  hasAnyReviewContent = false,
  showKnowledge = false,
  visibleKnowledgeCount = 0,
}) {
  const mode = lower(discoveryMode);
  const normalizedNextStage = normalizeSetupStudioStage(nextStudioStage);
  const hasReviewContent =
    !!setupCompleted ||
    !!hasVisibleResults ||
    !!hasAnyReviewContent ||
    !!showKnowledge ||
    Number(visibleKnowledgeCount || 0) > 0 ||
    normalizedNextStage === "review";

  if (entryLocked) {
    return "entry";
  }

  if (importingWebsite || mode === "running" || nextStudioStage === "scanning") {
    return "scanning";
  }

  if (hasReviewContent) {
    return "review";
  }

  return "entry";
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
  return "review";
}

export function resolveSetupStudioNextStageFromReview() {
  return "review";
}