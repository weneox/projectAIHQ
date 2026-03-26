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
    reviewDraft,
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
      reviewDraft,
      scopedType,
      scopedUrl
    );
  }, [
    freshEntryMode,
    activeSourceScope,
    currentReview,
    reviewDraft,
    discoveryState.lastSourceType,
    discoveryState.lastUrl,
  ]);

  const hasStoredReview = useMemo(
    () => getHasStoredReview(currentReview, reviewDraft),
    [currentReview, reviewDraft]
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

  const { scopedCurrentReview, scopedReviewDraft } = useMemo(
    () =>
      getScopedReviewState({
        hasStoredReview,
        activeReviewAligned,
        currentReview,
        reviewDraft,
      }),
    [hasStoredReview, activeReviewAligned, currentReview, reviewDraft]
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
        scopedReviewDraft,
        scopedCurrentReview,
        discoveryState,
      }),
    [freshEntryMode, scopedReviewDraft, scopedCurrentReview, discoveryState]
  );

  const draftBackedProfile = useMemo(
    () =>
      getDraftBackedProfile({
        freshEntryMode,
        scopedReviewDraft,
        discoveryState,
      }),
    [freshEntryMode, scopedReviewDraft, discoveryState]
  );

  const discoveryProfileRows = useMemo(
    () => getDiscoveryProfileRows(freshEntryMode, draftBackedProfile, scopedReviewDraft),
    [freshEntryMode, draftBackedProfile, scopedReviewDraft]
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
        scopedReviewDraft,
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
      scopedReviewDraft,
    ]
  );

  const effectiveMeta = useMemo(
    () =>
      getEffectiveMeta({
        meta,
        visibleKnowledgeItems,
        visibleServiceItems,
        scopedReviewDraft,
        discoveryState,
        draftBackedProfile,
        businessForm,
      }),
    [
      meta,
      visibleKnowledgeItems,
      visibleServiceItems,
      scopedReviewDraft,
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
        scopedReviewDraft,
        discoveryState,
        extractProfileName,
      }),
    [businessForm, scopedReviewDraft, discoveryState]
  );

  const currentDescription = useMemo(
    () =>
      getCurrentDescription({
        scopedReviewDraft,
        businessForm,
        discoveryState,
        extractProfileSummary,
      }),
    [scopedReviewDraft, businessForm, discoveryState]
  );

  const autoRevealKey = useMemo(
    () =>
      getAutoRevealKey({
        discoveryState,
        scopedReviewDraft,
        discoveryProfileRows,
        visibleKnowledgeItems,
        visibleServiceItems,
        visibleSources,
        visibleEvents,
      }),
    [
      discoveryState,
      scopedReviewDraft,
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
    scopedReviewDraft,
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
