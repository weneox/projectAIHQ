import { useEffect } from "react";

import { arr, s } from "../lib/setupStudioHelpers.js";
import { hasExtractedIdentityProfile } from "../state/profile.js";

export function useSetupStudioControllerEffects({
  actions,
  autoRevealRef,
  freshEntryMode,
  meta,
  knowledgeCandidates,
  discoveryState,
  hasVisibleResults,
  autoRevealKey,
  activeReviewAligned,
  visibleKnowledgeItems,
  visibleServiceItems,
  discoveryProfileRows,
  setShowKnowledge,
  barrierOnlyAutoReveal,
}) {
  useEffect(() => {
    actions.loadData({
      hydrateReview: false,
      preserveBusinessForm: false,
      seedBootProfile: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (freshEntryMode) return;
    if (meta.setupCompleted) return;

    if (
      ["knowledge", "review", "confirm"].includes(
        s(meta.nextStudioStage).toLowerCase()
      ) &&
      knowledgeCandidates.length > 0
    ) {
      setShowKnowledge(true);
    }
  }, [
    freshEntryMode,
    meta.nextStudioStage,
    meta.setupCompleted,
    knowledgeCandidates.length,
    setShowKnowledge,
  ]);

  useEffect(() => {
    if (freshEntryMode) return;

    const mode = s(discoveryState.mode).toLowerCase();

    if (!hasVisibleResults) return;
    if (mode === "idle" || mode === "running") return;
    if (!autoRevealKey) return;

    if (
      !activeReviewAligned &&
      !hasExtractedIdentityProfile(discoveryState.profile) &&
      arr(discoveryState.warnings).length === 0
    ) {
      return;
    }

    if (autoRevealRef.current === autoRevealKey) return;
    autoRevealRef.current = autoRevealKey;

    if (
      !barrierOnlyAutoReveal &&
      (visibleKnowledgeItems.length > 0 ||
        visibleServiceItems.length > 0 ||
        discoveryProfileRows.length > 0)
    ) {
      setShowKnowledge(true);
    }
  }, [
    freshEntryMode,
    autoRevealKey,
    hasVisibleResults,
    discoveryState.mode,
    discoveryState.profile,
    discoveryState.warnings,
    visibleKnowledgeItems.length,
    visibleServiceItems.length,
    discoveryProfileRows.length,
    activeReviewAligned,
    autoRevealRef,
    setShowKnowledge,
    barrierOnlyAutoReveal,
  ]);
}
