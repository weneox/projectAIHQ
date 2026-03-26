import {
  finalizeCurrentSetupReview,
  patchCurrentSetupReview,
} from "../../../api/setup.js";

import {
  assertSetupStudioFinalizeGuard,
  buildSetupStudioFinalizeFailure,
  buildSetupStudioFinalizeGuard,
  buildSetupStudioFinalizePatch,
  buildSetupStudioFinalizeRequestPayloads,
  buildSetupStudioPostFinalizeRefreshRequest,
  buildSetupStudioPostFinalizeReviewRequest,
} from "../logic/finalizeFlow.js";

export function createSetupStudioFinalize(ctx, helpers) {
  const {
    currentReview,
    discoveryState,
    businessForm,
    manualSections,
    activeReviewAligned,
    activeSourceScope,
    setFreshEntryMode,
    setSavingBusiness,
    setError,
    setShowRefine,
    setShowKnowledge,
  } = ctx;

  const {
    loadCurrentReview,
    refreshAndMaybeRouteHome,
    setReviewSyncIssue,
  } = helpers;

  async function onSaveBusiness(e) {
    if (e?.preventDefault) e.preventDefault();

    try {
      setFreshEntryMode(false);
      setSavingBusiness(true);
      setError("");

      const guard = buildSetupStudioFinalizeGuard({
        currentReview,
        discoveryState,
        activeReviewAligned,
      });
      assertSetupStudioFinalizeGuard(guard, setReviewSyncIssue);

      const patch = buildSetupStudioFinalizePatch({
        currentReview,
        discoveryState,
        businessForm,
        manualSections,
      });
      const { patchPayload, finalizePayload } =
        buildSetupStudioFinalizeRequestPayloads({
          guard,
          patch,
          discoveryState,
        });

      await patchCurrentSetupReview(patchPayload);

      await finalizeCurrentSetupReview(finalizePayload);

      setShowRefine(false);
      setShowKnowledge(false);

      const refreshed = await refreshAndMaybeRouteHome(
        buildSetupStudioPostFinalizeRefreshRequest(activeSourceScope)
      );

      if (!refreshed?.routed) {
        await loadCurrentReview(
          buildSetupStudioPostFinalizeReviewRequest(activeSourceScope)
        );
      }

      return { ok: true };
    } catch (e2) {
      const failure = buildSetupStudioFinalizeFailure({
        error: e2,
        currentReview,
        discoveryState,
      });

      if (failure.shouldSyncIssue) {
        setReviewSyncIssue(failure.issue);
      }

      setError(failure.message);
      return { ok: false };
    } finally {
      setSavingBusiness(false);
    }
  }

  return { onSaveBusiness };
}
