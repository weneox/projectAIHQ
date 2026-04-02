export function createSetupStudioActionAdapters(ctx, actions) {
  const {
    discoveryForm,
    freshEntryMode,
    activeSourceScope,
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

  function toggleKnowledge() {
    setShowKnowledge((prev) => !prev);
  }

  return {
    loadActiveReview,
    refreshStudio,
    continueFlow,
    toggleKnowledge,
  };
}
