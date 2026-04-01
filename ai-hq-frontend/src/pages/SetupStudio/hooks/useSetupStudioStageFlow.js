import { useEffect, useMemo, useState } from "react";

function hasMeaningfulItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasMeaningfulRows(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasMeaningfulWarnings(value) {
  return Array.isArray(value) && value.length > 0;
}

function resolveCollapsedStage({
  entryLocked,
  importingWebsite,
  discoveryMode,
  setupCompleted,
  nextStudioStage,
  hasVisibleResults,
  hasAnyReviewContent,
  showKnowledge,
  visibleKnowledgeCount,
}) {
  if (entryLocked) return "entry";

  if (importingWebsite || discoveryMode === "running" || nextStudioStage === "scanning") {
    return "scanning";
  }

  if (
    setupCompleted ||
    hasVisibleResults ||
    hasAnyReviewContent ||
    showKnowledge ||
    visibleKnowledgeCount > 0 ||
    nextStudioStage === "review" ||
    nextStudioStage === "ready" ||
    nextStudioStage === "identity" ||
    nextStudioStage === "knowledge" ||
    nextStudioStage === "service"
  ) {
    return "review";
  }

  return "entry";
}

export function useSetupStudioStageFlow({
  importingWebsite,
  discoveryMode,
  setupCompleted,
  nextStudioStage,
  hasVisibleResults,
  showKnowledge,
  visibleKnowledgeCount,
  visibleServiceCount,
  serviceSuggestionTitle,
  services,
  discoveryProfileRows,
  knowledgeItems,
  reviewSources,
  reviewEvents,
  discoveryWarnings,
  onContinueFlow,
  onResumeReview,
}) {
  const [stage, setStage] = useState("entry");
  const [entryLocked, setEntryLocked] = useState(true);

  const hasServiceStage = useMemo(() => {
    return (
      Boolean(serviceSuggestionTitle) ||
      visibleServiceCount > 0 ||
      hasMeaningfulItems(services)
    );
  }, [serviceSuggestionTitle, visibleServiceCount, services]);

  const hasAnyReviewContent = useMemo(() => {
    return (
      hasMeaningfulRows(discoveryProfileRows) ||
      hasMeaningfulItems(knowledgeItems) ||
      hasMeaningfulItems(services) ||
      hasMeaningfulItems(reviewSources) ||
      hasMeaningfulItems(reviewEvents) ||
      hasMeaningfulWarnings(discoveryWarnings)
    );
  }, [
    discoveryProfileRows,
    knowledgeItems,
    services,
    reviewSources,
    reviewEvents,
    discoveryWarnings,
  ]);

  useEffect(() => {
    setStage(
      resolveCollapsedStage({
        entryLocked,
        importingWebsite,
        discoveryMode,
        setupCompleted,
        nextStudioStage,
        hasVisibleResults,
        hasAnyReviewContent,
        showKnowledge,
        visibleKnowledgeCount,
      })
    );
  }, [
    entryLocked,
    importingWebsite,
    discoveryMode,
    setupCompleted,
    nextStudioStage,
    hasVisibleResults,
    hasAnyReviewContent,
    showKnowledge,
    visibleKnowledgeCount,
  ]);

  function handleContinueFromEntry() {
    setEntryLocked(false);
    setStage("scanning");
    onContinueFlow?.();
  }

  function handleResumeFromEntry() {
    setEntryLocked(false);
    setStage("review");
    onResumeReview?.();
  }

  function goNextFromIdentity() {
    setStage("review");
  }

  function goNextFromKnowledge() {
    setStage("review");
  }

  function goNextFromService() {
    setStage("review");
  }

  function goNextFromReview() {
    setStage("review");
  }

  return {
    stage,
    entryLocked,
    hasServiceStage,
    hasAnyReviewContent,
    handleContinueFromEntry,
    handleResumeFromEntry,
    goNextFromIdentity,
    goNextFromKnowledge,
    goNextFromService,
    goNextFromReview,
  };
}