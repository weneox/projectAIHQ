function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
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
  showKnowledge = false,
  visibleKnowledgeCount = 0,
  hasServiceStage = false,
}) {
  const mode = s(discoveryMode).toLowerCase();
  const forcedReady =
    !!setupCompleted || s(nextStudioStage).toLowerCase() === "ready";

  if (importingWebsite || mode === "running") {
    return "scanning";
  }

  if (entryLocked) {
    return "entry";
  }

  if (!hasVisibleResults && !hasAnyReviewContent) {
    return "entry";
  }

  if (forcedReady) {
    return "ready";
  }

  if (prevStage === "entry" || prevStage === "scanning") {
    if (showKnowledge && Number(visibleKnowledgeCount || 0) > 0) {
      return "knowledge";
    }
    return "identity";
  }

  if (prevStage === "knowledge" && Number(visibleKnowledgeCount || 0) <= 0) {
    return hasServiceStage ? "service" : "ready";
  }

  if (prevStage === "service" && !hasServiceStage) {
    return "ready";
  }

  return prevStage;
}

export function resolveSetupStudioNextStageFromIdentity({
  visibleKnowledgeCount = 0,
  hasServiceStage = false,
}) {
  if (Number(visibleKnowledgeCount || 0) > 0) return "knowledge";
  if (hasServiceStage) return "service";
  return "ready";
}

export function resolveSetupStudioNextStageFromKnowledge({
  hasServiceStage = false,
}) {
  return hasServiceStage ? "service" : "ready";
}

export function resolveSetupStudioNextStageFromService() {
  return "ready";
}
