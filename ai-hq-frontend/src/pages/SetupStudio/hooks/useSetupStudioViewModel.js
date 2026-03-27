import { useMemo } from "react";

import { arr, s } from "../lib/setupStudioHelpers.js";
import {
  extractProfileName,
  extractProfileSummary,
  hasExtractedIdentityProfile,
  isWebsiteBarrierWarning,
} from "../state/profile.js";
import { reviewStateMatchesSource } from "../state/reviewState.js";
import {
  normalizeStudioSourceType,
  pickKnowledgeCandidateId,
  pickKnowledgeRowId,
} from "../logic/helpers.js";
import {
  getAutoRevealKey,
  getCurrentDescription,
  getCurrentTitle,
  getDraftBackedProfile,
  getDiscoveryProfileRows,
  getEffectiveMeta,
  getHasStoredReview,
  getReviewProjection,
  getHasVisibleResults,
  getKnowledgePreview,
  getReviewSyncState,
  getScopedReviewState,
  getServiceSuggestionTitle,
  getStudioProgress,
  getVisibleCollections,
} from "../SetupStudioDerivedState.js";

export function useSetupStudioViewModel(state) {
  const {
    freshEntryMode,
    activeSourceScope,
    currentReview,
    discoveryState,
    meta,
    businessForm,
    discoveryForm,
    importingWebsite,
  } = state;

  const activeReviewAligned = useMemo(() => {
    if (freshEntryMode) return false;

    const scopedUrl = s(activeSourceScope.sourceUrl || discoveryState.lastUrl);
    const scopedType = normalizeStudioSourceType(
      activeSourceScope.sourceType || discoveryState.lastSourceType,
      scopedUrl
    );

    if (scopedType === "manual") {
      return !!s(currentReview?.session?.id);
    }

    if (!scopedUrl) return false;

    return reviewStateMatchesSource(
      currentReview,
      scopedType,
      scopedUrl
    );
  }, [
    freshEntryMode,
    activeSourceScope,
    currentReview,
    discoveryState.lastSourceType,
    discoveryState.lastUrl,
  ]);

  const hasStoredReview = useMemo(
    () => getHasStoredReview(currentReview),
    [currentReview]
  );

  const reviewSyncState = useMemo(
    () =>
      getReviewSyncState({
        currentReview,
        discoveryState,
        freshEntryMode,
        activeReviewAligned,
        activeSourceScope,
      }),
    [
      currentReview,
      discoveryState,
      freshEntryMode,
      activeReviewAligned,
      activeSourceScope,
    ]
  );

  const { scopedCurrentReview } = useMemo(
    () =>
      getScopedReviewState({
        hasStoredReview,
        activeReviewAligned,
        currentReview,
        activeSourceScope,
        discoveryState,
      }),
    [hasStoredReview, activeReviewAligned, currentReview, activeSourceScope, discoveryState]
  );

  const reviewProjection = useMemo(
    () => getReviewProjection(scopedCurrentReview),
    [scopedCurrentReview]
  );

  const {
    visibleKnowledgeItems,
    visibleServiceItems,
    visibleSources,
    visibleEvents,
  } = useMemo(
    () =>
      getVisibleCollections({
        freshEntryMode,
        scopedCurrentReview,
        discoveryState,
      }),
    [freshEntryMode, scopedCurrentReview, discoveryState]
  );

  const draftBackedProfile = useMemo(
    () =>
      getDraftBackedProfile({
        freshEntryMode,
        reviewProjection,
        discoveryState,
      }),
    [freshEntryMode, reviewProjection, discoveryState]
  );

  const discoveryProfileRows = useMemo(
    () => getDiscoveryProfileRows(freshEntryMode, draftBackedProfile, reviewProjection),
    [freshEntryMode, draftBackedProfile, reviewProjection]
  );

  const hasVisibleResults = useMemo(
    () =>
      getHasVisibleResults({
        freshEntryMode,
        draftBackedProfile,
        discoveryProfileRows,
        visibleKnowledgeItems,
        visibleServiceItems,
        visibleSources,
        visibleEvents,
        discoveryState,
        reviewProjection,
      }),
    [
      freshEntryMode,
      draftBackedProfile,
      discoveryProfileRows,
      visibleKnowledgeItems,
      visibleServiceItems,
      visibleSources,
      visibleEvents,
      discoveryState,
      reviewProjection,
    ]
  );

  const effectiveMeta = useMemo(
    () =>
      getEffectiveMeta({
        meta,
        visibleKnowledgeItems,
        visibleServiceItems,
        reviewProjection,
        discoveryState,
        draftBackedProfile,
        businessForm,
      }),
    [
      meta,
      visibleKnowledgeItems,
      visibleServiceItems,
      reviewProjection,
      discoveryState,
      draftBackedProfile,
      businessForm,
    ]
  );

  const serviceSuggestionTitle = useMemo(
    () =>
      getServiceSuggestionTitle(
        discoveryForm,
        discoveryState,
        visibleKnowledgeItems
      ),
    [discoveryForm, discoveryState, visibleKnowledgeItems]
  );

  const studioProgress = useMemo(
    () =>
      getStudioProgress({
        importingWebsite,
        discoveryState,
        effectiveMeta,
      }),
    [importingWebsite, discoveryState, effectiveMeta]
  );

  const knowledgePreview = useMemo(
    () =>
      getKnowledgePreview(
        visibleKnowledgeItems,
        pickKnowledgeRowId,
        pickKnowledgeCandidateId
      ),
    [visibleKnowledgeItems]
  );

  const currentTitle = useMemo(
    () =>
      getCurrentTitle({
        businessForm,
        reviewProjection,
        discoveryState,
        extractProfileName,
      }),
    [businessForm, reviewProjection, discoveryState]
  );

  const currentDescription = useMemo(
    () =>
      getCurrentDescription({
        reviewProjection,
        businessForm,
        discoveryState,
        extractProfileSummary,
      }),
    [reviewProjection, businessForm, discoveryState]
  );

  const autoRevealKey = useMemo(
    () =>
      getAutoRevealKey({
        discoveryState,
        reviewProjection,
        discoveryProfileRows,
        visibleKnowledgeItems,
        visibleServiceItems,
        visibleSources,
        visibleEvents,
      }),
    [
      discoveryState,
      reviewProjection,
      discoveryProfileRows,
      visibleKnowledgeItems,
      visibleServiceItems,
      visibleSources,
      visibleEvents,
    ]
  );

  const barrierOnlyAutoReveal = useMemo(
    () =>
      s(discoveryState.mode).toLowerCase() === "partial" &&
      arr(discoveryState.warnings).some((item) => isWebsiteBarrierWarning(item)) &&
      !hasExtractedIdentityProfile(discoveryState.profile) &&
      visibleKnowledgeItems.length === 0 &&
      visibleServiceItems.length === 0,
    [
      discoveryState.mode,
      discoveryState.warnings,
      discoveryState.profile,
      visibleKnowledgeItems.length,
      visibleServiceItems.length,
    ]
  );

  return {
    activeReviewAligned,
    hasStoredReview,
    reviewSyncState,
    scopedCurrentReview,
    reviewProjection,
    visibleKnowledgeItems,
    visibleServiceItems,
    visibleSources,
    visibleEvents,
    draftBackedProfile,
    discoveryProfileRows,
    hasVisibleResults,
    effectiveMeta,
    serviceSuggestionTitle,
    studioProgress,
    knowledgePreview,
    currentTitle,
    currentDescription,
    autoRevealKey,
    barrierOnlyAutoReveal,
  };
}
