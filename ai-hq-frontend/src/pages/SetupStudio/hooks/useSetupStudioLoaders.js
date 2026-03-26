import { getAppBootstrap } from "../../../api/app.js";
import { getCurrentSetupReview } from "../../../api/setup.js";
import { getKnowledgeCandidates } from "../../../api/knowledge.js";
import { getSetupServices } from "../../../api/services.js";

import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import { applyUiHintsFromMeta } from "../state/shared.js";
import {
  buildSetupStudioBootSnapshot,
  buildSetupStudioLoaderErrorResult,
} from "../logic/loaderFlowBoot.js";
import {
  buildSetupStudioHydratedBusinessForm,
  buildSetupStudioHydratedReviewUi,
  buildSetupStudioReviewLoadFailureIssue,
  buildSetupStudioSourceMismatchIssue,
  reconcileSetupStudioLoadedReview,
} from "../logic/loaderFlowReview.js";

export function createSetupStudioLoaders(ctx, shared) {
  const {
    navigate,
    freshEntryMode,
    currentReview,
    reviewDraft,
    setLoading,
    setRefreshing,
    setError,
    setCurrentReview,
    setReviewDraft,
    setBusinessForm,
    setManualSections,
    setKnowledgeCandidates,
    setServices,
    setMeta,
    setShowKnowledge,
    setShowRefine,
    setFreshEntryMode,
    updateActiveSourceScope,
    resolveActiveSourceScope,
    clearStudioReviewState,
    seedBusinessFormFromBootProfile,
    syncDiscoveryStateFromReview,
    applyReviewState,
    createEmptyReviewState,
  } = ctx;

  const { setReviewSyncIssue } = shared;

  async function loadCurrentReview({
    preserveBusinessForm = false,
    activateReviewSession = true,
    activeSourceType = "",
    activeSourceUrl = "",
  } = {}) {
    try {
      const payload = await getCurrentSetupReview({ eventLimit: 30 });
      const sourceScope = resolveActiveSourceScope({
        sourceType: activeSourceType,
        sourceUrl: activeSourceUrl,
      });
      const { normalized, legacy, shouldApplyIntoActiveStudio } =
        reconcileSetupStudioLoadedReview({
          reviewPayload: payload,
          preserveBusinessForm,
          sourceScope,
        });

      if (!shouldApplyIntoActiveStudio) {
        setCurrentReview(normalized);
        setReviewDraft(legacy);
        setReviewSyncIssue(
          buildSetupStudioSourceMismatchIssue({
            normalized,
            legacy,
            message:
              "A review session exists, but it belongs to a different source than the active draft.",
          })
        );

        if (activateReviewSession) {
          setFreshEntryMode(false);
        }

        return {
          currentReview: normalized,
          reviewDraft: legacy,
        };
      }

      setCurrentReview(normalized);
      setReviewDraft(legacy);

      if (activateReviewSession) {
        setFreshEntryMode(false);
      }

      return applyReviewState(payload, { preserveBusinessForm });
    } catch (e) {
      setReviewSyncIssue(buildSetupStudioReviewLoadFailureIssue(e));

      return {
        currentReview,
        reviewDraft,
      };
    }
  }

  async function loadData({
    silent = false,
    preserveBusinessForm = false,
    hydrateReview = false,
    activeSourceType = "",
    activeSourceUrl = "",
  } = {}) {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError("");

      const requests = [
        getAppBootstrap(),
        getKnowledgeCandidates(),
        getSetupServices(),
      ];

      if (hydrateReview) {
        requests.push(
          getCurrentSetupReview({ eventLimit: 30 }).catch(() => ({ review: {} }))
        );
      }

      const responses = await Promise.all(requests);

      const bootSnapshot = buildSetupStudioBootSnapshot({
        boot: responses[0],
        knowledgePayload: responses[1],
        servicesPayload: responses[2],
      });
      const reviewPayload = hydrateReview ? responses[3] : { review: {} };

      setMeta(bootSnapshot.meta);
      setKnowledgeCandidates(bootSnapshot.pendingKnowledge);
      setServices(bootSnapshot.serviceItems);

      if (!hydrateReview) {
        if (!preserveBusinessForm) {
          clearStudioReviewState({ preserveActiveSource: false });
          seedBusinessFormFromBootProfile(bootSnapshot.profile);
        }

        return {
          ...bootSnapshot,
          currentReview: createEmptyReviewState(),
        };
      }

      const sourceScope = resolveActiveSourceScope({
        sourceType: activeSourceType,
        sourceUrl: activeSourceUrl,
      });
      const {
        normalized: reviewState,
        legacy: legacyDraft,
        shouldApplyIntoActiveStudio,
      } = reconcileSetupStudioLoadedReview({
        reviewPayload,
        preserveBusinessForm,
        sourceScope,
      });

      if (!shouldApplyIntoActiveStudio) {
        setCurrentReview(reviewState);
        setReviewDraft(legacyDraft);
        setReviewSyncIssue(
          buildSetupStudioSourceMismatchIssue({
            normalized: reviewState,
            legacy: legacyDraft,
            message:
              "A review session was loaded, but it does not match the active source draft.",
          })
        );

        return {
          ...bootSnapshot,
          currentReview: reviewState,
        };
      }

      setCurrentReview(reviewState);
      setReviewDraft(legacyDraft);

      const reviewUi = buildSetupStudioHydratedReviewUi({
        reviewState,
        legacyDraft,
      });

      if (reviewUi.shouldUpdateActiveSource) {
        updateActiveSourceScope(
          reviewUi.reviewInfo.sourceType,
          reviewUi.reviewInfo.sourceUrl
        );
      }

      setBusinessForm((prev) => {
        return buildSetupStudioHydratedBusinessForm({
          prev,
          baseProfile: reviewUi.baseProfile,
          preserveBusinessForm,
          reviewInfo: reviewUi.reviewInfo,
        });
      });

      setManualSections(() => ({ ...reviewUi.manualSections }));

      syncDiscoveryStateFromReview(reviewState, { preserveCounts: false });

      applyUiHintsFromMeta({
        nextMeta: bootSnapshot.meta,
        pendingKnowledge: bootSnapshot.pendingKnowledge,
        setShowKnowledge,
        setShowRefine,
      });

      return {
        ...bootSnapshot,
        currentReview: reviewState,
      };
    } catch (e) {
      const message = String(
        e?.message || e || "Setup studio data could not be loaded."
      );
      setError(message);

      return buildSetupStudioLoaderErrorResult(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshAndMaybeRouteHome({
    preserveBusinessForm = false,
    hydrateReview = !freshEntryMode,
    activeSourceType = "",
    activeSourceUrl = "",
  } = {}) {
    const snapshot = await loadData({
      silent: true,
      preserveBusinessForm,
      hydrateReview,
      activeSourceType,
      activeSourceUrl,
    });

    const nextMeta = obj(snapshot?.meta);

    if (nextMeta.setupCompleted) {
      navigate(s(nextMeta.nextRoute || "/"), { replace: true });
      return {
        routed: true,
        snapshot,
      };
    }

    if (hydrateReview) {
      applyUiHintsFromMeta({
        nextMeta,
        pendingKnowledge: arr(snapshot?.pendingKnowledge),
        setShowKnowledge,
        setShowRefine,
      });
    }

    return {
      routed: false,
      snapshot,
    };
  }

  return {
    loadCurrentReview,
    loadData,
    refreshAndMaybeRouteHome,
  };
}
