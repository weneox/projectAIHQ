import { useEffect, useMemo, useState } from "react";

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function shouldAutoShowReview({
  entryLocked,
  importingWebsite,
  discoveryMode,
  hasVisibleResults,
  hasAnyReviewContent,
  nextStudioStage,
}) {
  if (entryLocked) return false;
  if (importingWebsite || discoveryMode === "running") return false;

  return (
    hasVisibleResults ||
    hasAnyReviewContent ||
    nextStudioStage === "review" ||
    nextStudioStage === "confirm"
  );
}

export function useSetupStudioStageFlow({
  importingWebsite,
  discoveryMode,
  nextStudioStage,
  hasVisibleResults,
  discoveryProfileRows,
  knowledgeItems,
  services,
  reviewSources,
  reviewEvents,
  discoveryWarnings,
  onContinueFlow,
  onResumeReview,
}) {
  const [stage, setStage] = useState("entry");
  const [entryLocked, setEntryLocked] = useState(true);

  const hasAnyReviewContent = useMemo(() => {
    return (
      hasItems(discoveryProfileRows) ||
      hasItems(knowledgeItems) ||
      hasItems(services) ||
      hasItems(reviewSources) ||
      hasItems(reviewEvents) ||
      hasItems(discoveryWarnings)
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
    if (importingWebsite || discoveryMode === "running") {
      setStage("scanning");
      return;
    }

    if (
      shouldAutoShowReview({
        entryLocked,
        importingWebsite,
        discoveryMode,
        hasVisibleResults,
        hasAnyReviewContent,
        nextStudioStage,
      })
    ) {
      setStage((current) => (current === "confirm" ? "confirm" : "review"));
      return;
    }

    if (entryLocked) {
      setStage("entry");
    }
  }, [
    entryLocked,
    importingWebsite,
    discoveryMode,
    hasVisibleResults,
    hasAnyReviewContent,
    nextStudioStage,
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

  function goToEntry() {
    setStage("entry");
  }

  function goToReview() {
    setEntryLocked(false);
    setStage("review");
  }

  function goToConfirm() {
    setEntryLocked(false);
    setStage("confirm");
  }

  return {
    stage,
    entryLocked,
    hasAnyReviewContent,
    handleContinueFromEntry,
    handleResumeFromEntry,
    goToEntry,
    goToReview,
    goToConfirm,
  };
}
