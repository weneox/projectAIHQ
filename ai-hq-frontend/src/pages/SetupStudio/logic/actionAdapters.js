export function createSetupStudioActionAdapters(ctx, actions) {
  const {
    navigate,
    discoveryForm,
    freshEntryMode,
    activeSourceScope,
    setShowRefine,
    setShowKnowledge,
  } = ctx;

  function buildActiveSourceRequest(overrides = {}) {
    return {
      activeSourceType:
        overrides.activeSourceType ?? activeSourceScope.sourceType,
      activeSourceUrl: overrides.activeSourceUrl ?? activeSourceScope.sourceUrl,
    };
  }

  function loadActiveReview(overrides = {}) {
    return actions.loadCurrentReview({
      preserveBusinessForm: true,
      activateReviewSession: true,
      ...buildActiveSourceRequest(overrides),
      ...overrides,
    });
  }

  function refreshStudio(overrides = {}) {
    const shouldHydrateReview =
      overrides.hydrateReview ?? !freshEntryMode;

    return actions.loadData({
      silent: true,
      preserveBusinessForm: !freshEntryMode,
      hydrateReview: shouldHydrateReview,
      seedBootProfile: shouldHydrateReview,
      ...buildActiveSourceRequest(overrides),
      ...overrides,
    });
  }

  function continueFlow() {
    return actions.onScanBusiness(discoveryForm);
  }

  function openTruth() {
    navigate("/truth");
  }

  function toggleRefine() {
    setShowRefine((prev) => !prev);
  }

  function toggleKnowledge() {
    setShowKnowledge((prev) => !prev);
  }

  return {
    loadActiveReview,
    refreshStudio,
    continueFlow,
    openTruth,
    toggleRefine,
    toggleKnowledge,
  };
}
