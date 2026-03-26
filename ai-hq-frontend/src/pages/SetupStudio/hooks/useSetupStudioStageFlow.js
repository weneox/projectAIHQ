import { useEffect, useMemo, useState } from "react";

import {
  getSetupStudioHasAnyReviewContent,
  getSetupStudioHasServiceStage,
  resolveSetupStudioNextStageFromIdentity,
  resolveSetupStudioNextStageFromKnowledge,
  resolveSetupStudioNextStageFromService,
  resolveSetupStudioStage,
} from "../logic/stageFlow.js";

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

  const hasServiceStage = useMemo(
    () =>
      getSetupStudioHasServiceStage({
        serviceSuggestionTitle,
        services,
        visibleServiceCount,
      }),
    [serviceSuggestionTitle, services, visibleServiceCount]
  );

  const hasAnyReviewContent = useMemo(
    () =>
      getSetupStudioHasAnyReviewContent({
        discoveryProfileRows,
        knowledgeItems,
        services,
        reviewSources,
        reviewEvents,
        discoveryWarnings,
      }),
    [
      discoveryProfileRows,
      knowledgeItems,
      services,
      reviewSources,
      reviewEvents,
      discoveryWarnings,
    ]
  );

  useEffect(() => {
    setStage((prev) =>
      resolveSetupStudioStage({
        prevStage: prev,
        importingWebsite,
        discoveryMode,
        setupCompleted,
        nextStudioStage,
        entryLocked,
        hasVisibleResults,
        hasAnyReviewContent,
        showKnowledge,
        visibleKnowledgeCount,
        hasServiceStage,
      })
    );
  }, [
    importingWebsite,
    discoveryMode,
    setupCompleted,
    nextStudioStage,
    entryLocked,
    hasVisibleResults,
    hasAnyReviewContent,
    showKnowledge,
    visibleKnowledgeCount,
    hasServiceStage,
  ]);

  function handleContinueFromEntry() {
    setEntryLocked(false);
    onContinueFlow?.();
  }

  function handleResumeFromEntry() {
    setEntryLocked(false);
    onResumeReview?.();
  }

  function goNextFromIdentity() {
    setStage(
      resolveSetupStudioNextStageFromIdentity({
        visibleKnowledgeCount,
        hasServiceStage,
      })
    );
  }

  function goNextFromKnowledge() {
    setStage(resolveSetupStudioNextStageFromKnowledge({ hasServiceStage }));
  }

  function goNextFromService() {
    setStage(resolveSetupStudioNextStageFromService());
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
  };
}
