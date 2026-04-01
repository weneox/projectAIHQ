import { useEffect, useMemo, useState } from "react";

import {
  getSetupStudioHasAnyReviewContent,
  getSetupStudioHasServiceStage,
  resolveSetupStudioNextStageFromEntry,
  resolveSetupStudioNextStageFromIdentity,
  resolveSetupStudioNextStageFromKnowledge,
  resolveSetupStudioNextStageFromReview,
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
    setStage(resolveSetupStudioNextStageFromEntry());
    onContinueFlow?.();
  }

  function handleResumeFromEntry() {
    setEntryLocked(false);
    setStage(
      resolveSetupStudioStage({
        prevStage: stage,
        importingWebsite,
        discoveryMode,
        setupCompleted,
        nextStudioStage,
        entryLocked: false,
        hasVisibleResults,
        hasAnyReviewContent,
        showKnowledge,
        visibleKnowledgeCount,
        hasServiceStage,
      })
    );
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

  function goNextFromReview() {
    setStage(resolveSetupStudioNextStageFromReview({ setupCompleted }));
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