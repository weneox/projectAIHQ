import { arr, obj } from "../lib/setupStudioHelpers.js";
import { createSetupStudioScanPlan, buildSetupStudioRunningScanState } from "../logic/scanFlowPlan.js";
import { executeSetupStudioScanPlan } from "../logic/scanFlowExecution.js";
import {
  buildSetupStudioReviewSyncIssue,
  buildSetupStudioScanErrorState,
  buildSetupStudioScanRevealState,
  reconcileSetupStudioScanResult,
} from "../logic/scanFlowResult.js";

export function createSetupStudioScan(ctx, helpers) {
  const {
    discoveryForm,
    businessForm,
    manualSections,
    createEmptyLegacyDraft,
    createEmptyReviewState,
    updateActiveSourceScope,
    applyReviewState,
    clearStudioReviewState,
    resetBusinessTwinDraftForNewScan,
    setCurrentReview,
    setReviewDraft,
    setDiscoveryState,
    setImportingWebsite,
    setFreshEntryMode,
    setError,
    setShowKnowledge,
    setShowRefine,
    autoRevealRef,
  } = ctx;

  const {
    refreshAndMaybeRouteHome,
    setReviewSyncIssue,
  } = helpers;

  async function onScanBusiness(input) {
    const plan = createSetupStudioScanPlan({
      input,
      discoveryForm,
      businessForm,
      manualSections,
    });

    if (plan.validationError) {
      setError(plan.validationError);
      return;
    }

    try {
      setImportingWebsite(true);
      setFreshEntryMode(false);
      setError("");
      autoRevealRef.current = "";

      updateActiveSourceScope(
        plan.uiSourceType,
        plan.hasImportableSource ? plan.displaySourceUrl : ""
      );

      clearStudioReviewState({ preserveActiveSource: true });
      resetBusinessTwinDraftForNewScan(
        plan.hasImportableSource ? plan.displaySourceUrl : ""
      );

      setDiscoveryState((prev) => ({
        ...prev,
        ...buildSetupStudioRunningScanState(plan),
      }));

      const { importResult, analyzeResult, reviewPayload } =
        await executeSetupStudioScanPlan(plan);

      const scanResult = reconcileSetupStudioScanResult({
        plan,
        importResult,
        analyzeResult,
        reviewPayload,
        createEmptyReviewState,
        createEmptyLegacyDraft,
      });

      const {
        importedReview,
        legacyImportedDraft,
        effectiveSourceType,
        effectiveSourceUrl,
        importedReviewMatchesActiveSource,
        bestIncomingProfile,
        finalDiscoveryState,
        barrierOnlyResult,
        importedVisibleKnowledgeItems,
        importedVisibleServiceItems,
        hasImmediateVisibleResults,
        importedProfileRows,
      } = scanResult;

      if (effectiveSourceUrl || effectiveSourceType === "manual") {
        updateActiveSourceScope(effectiveSourceType, effectiveSourceUrl);
      }

      if (
        importedReviewMatchesActiveSource &&
        (importedReview?.session ||
          Object.keys(obj(importedReview?.draft)).length ||
          arr(importedReview?.bundleSources).length ||
          arr(importedReview?.sources).length)
      ) {
        applyReviewState(reviewPayload, {
          preserveBusinessForm: true,
          fallbackProfile: bestIncomingProfile,
        });
      } else {
        setCurrentReview(importedReview);
        setReviewDraft(legacyImportedDraft);
        setReviewSyncIssue(
          buildSetupStudioReviewSyncIssue({
            importedReview,
            legacyImportedDraft,
            hasImportableSource: plan.hasImportableSource,
            importedReviewMatchesActiveSource,
          })
        );
      }

      setDiscoveryState(finalDiscoveryState);

      const refreshResult = await refreshAndMaybeRouteHome({
        preserveBusinessForm: true,
        hydrateReview: true,
        activeSourceType: effectiveSourceType,
        activeSourceUrl: effectiveSourceUrl,
      });

      if (!refreshResult.routed) {
        const revealState = buildSetupStudioScanRevealState({
          refreshResult,
          barrierOnlyResult,
          analyzeResult,
          importedVisibleKnowledgeItems,
          importedVisibleServiceItems,
          hasImmediateVisibleResults,
          bestIncomingProfile,
          importedProfileRows,
        });

        setShowKnowledge(revealState.shouldOpenKnowledge);
        setShowRefine(revealState.shouldOpenRefine);
      }
    } catch (e2) {
      const message = String(
        e2?.message || e2 || "The business draft could not be prepared."
      );

      setDiscoveryState((prev) => ({
        ...buildSetupStudioScanErrorState({
          prev,
          message,
          requestedPrimarySourceUrl: plan.requestedPrimarySourceUrl,
          sourceUrl: plan.sourceUrl,
          uiSourceType: plan.uiSourceType,
          displaySourceType: plan.displaySourceType,
        }),
      }));

      setError(message);
    } finally {
      setImportingWebsite(false);
    }
  }

  return { onScanBusiness };
}
