import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import SetupStudioScene from "./SetupStudioScene.jsx";
import {
  arr,
  obj,
  s,
} from "./lib/setupStudioHelpers.js";
import {
  createEmptyLegacyDraft,
  createEmptyReviewState,
  createEmptySourceScope,
  createIdleDiscoveryState,
  normalizeReviewState,
  resolveMainLanguageValue,
  sourceIdentityKey,
} from "./state/shared.js";
import {
  chooseBestProfileForForm,
  extractProfileName,
  extractProfileSummary,
  formFromProfile,
  hasExtractedIdentityProfile,
  hasMeaningfulProfile,
  hydrateBusinessFormFromProfile,
  isWebsiteBarrierWarning,
} from "./state/profile.js";
import {
  buildManualSectionsFromReview,
  mapCurrentReviewToLegacyDraft,
  resolveReviewSourceInfo,
  reviewStateMatchesSource,
} from "./state/reviewState.js";
import {
  DEFAULT_BUSINESS_FORM,
  DEFAULT_DISCOVERY_FORM,
  DEFAULT_MANUAL_SECTIONS,
  DEFAULT_SETUP_META,
} from "./logic/constants.js";
import {
  lowerText,
  normalizeStudioSourceType,
  pickKnowledgeCandidateId,
  pickKnowledgeRowId,
} from "./logic/helpers.js";
import { createSetupStudioActions } from "./logic/actions.js";
import {
  discoveryModeLabel,
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
} from "./SetupStudioDerivedState.js";

export default function SetupStudioController() {
  const navigate = useNavigate();

  const autoRevealRef = useRef("");
  const activeSourceRef = useRef(createEmptySourceScope());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importingWebsite, setImportingWebsite] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [actingKnowledgeId, setActingKnowledgeId] = useState("");
  const [savingServiceSuggestion, setSavingServiceSuggestion] = useState("");
  const [showRefine, setShowRefine] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [freshEntryMode, setFreshEntryMode] = useState(true);
  const [error, setError] = useState("");
  const [businessForm, setBusinessForm] = useState({ ...DEFAULT_BUSINESS_FORM });
  const [manualSections, setManualSections] = useState({
    ...DEFAULT_MANUAL_SECTIONS,
  });
  const [discoveryForm, setDiscoveryForm] = useState({
    ...DEFAULT_DISCOVERY_FORM,
  });
  const [currentReview, setCurrentReview] = useState(createEmptyReviewState);
  const [reviewDraft, setReviewDraft] = useState(createEmptyLegacyDraft);
  const [discoveryState, setDiscoveryState] = useState(createIdleDiscoveryState);
  const [activeSourceScope, setActiveSourceScope] = useState(
    createEmptySourceScope
  );
  const [knowledgeCandidates, setKnowledgeCandidates] = useState([]);
  const [services, setServices] = useState([]);
  const [meta, setMeta] = useState({ ...DEFAULT_SETUP_META });

  function setBusinessField(key, value) {
    setBusinessForm((prev) => ({ ...prev, [key]: value }));
  }

  function setManualSection(key, value) {
    setManualSections((prev) => ({ ...prev, [key]: value }));
  }

  function setDiscoveryField(key, value) {
    setDiscoveryForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateActiveSourceScope(sourceType = "", sourceUrl = "") {
    const normalizedUrl = s(sourceUrl);
    const normalizedType = normalizeStudioSourceType(sourceType, normalizedUrl);
    const fingerprint = sourceIdentityKey(normalizedType, normalizedUrl);

    const next =
      normalizedUrl || normalizedType
        ? {
            sourceType: normalizedType,
            sourceUrl: normalizedUrl,
            fingerprint,
          }
        : createEmptySourceScope();

    activeSourceRef.current = next;
    setActiveSourceScope(next);
    return next;
  }

  function resolveActiveSourceScope(override = {}) {
    const rawUrl = s(
      override?.sourceUrl ||
        activeSourceRef.current?.sourceUrl ||
        activeSourceScope.sourceUrl ||
        discoveryState.lastUrl
    );

    const rawType =
      normalizeStudioSourceType(
        override?.sourceType ||
          activeSourceRef.current?.sourceType ||
          activeSourceScope.sourceType ||
          discoveryState.lastSourceType,
        rawUrl
      ) || "";

    return {
      sourceType: rawType,
      sourceUrl: rawUrl,
      fingerprint: sourceIdentityKey(rawType, rawUrl),
    };
  }

  function clearStudioReviewState({ preserveActiveSource = false } = {}) {
    autoRevealRef.current = "";
    setCurrentReview(createEmptyReviewState());
    setReviewDraft(createEmptyLegacyDraft());
    setDiscoveryState(createIdleDiscoveryState());
    setShowRefine(false);
    setShowKnowledge(false);

    if (!preserveActiveSource) {
      updateActiveSourceScope("", "");
    }
  }

  function resetBusinessTwinDraftForNewScan(nextSourceUrl = "") {
    setBusinessForm((prev) => ({
      ...DEFAULT_BUSINESS_FORM,
      timezone: s(prev.timezone || "Asia/Baku"),
      language: s(prev.language || "en"),
      websiteUrl: s(nextSourceUrl),
    }));

    setManualSections({
      ...DEFAULT_MANUAL_SECTIONS,
    });
  }

  function seedBusinessFormFromBootProfile(profile = {}) {
    setBusinessForm((prev) =>
      formFromProfile(profile, {
        ...DEFAULT_BUSINESS_FORM,
        timezone: s(prev.timezone || "Asia/Baku"),
      })
    );
  }

  function syncDiscoveryStateFromReview(review = {}, { preserveCounts = true } = {}) {
    const normalized = normalizeReviewState(review);
    const legacy = mapCurrentReviewToLegacyDraft(normalized);
    const profile = obj(legacy.overview);
    const reviewInfo = resolveReviewSourceInfo(normalized, legacy);
    const session = obj(normalized?.session);

    const metadata = {
      reviewRequired: !!legacy.reviewRequired,
      reviewFlags: arr(legacy.reviewFlags),
      fieldConfidence: obj(legacy.fieldConfidence),
      mainLanguage:
        legacy.mainLanguage ||
        resolveMainLanguageValue(
          profile.mainLanguage,
          profile.primaryLanguage,
          profile.language
        ),
      primaryLanguage:
        legacy.primaryLanguage ||
        resolveMainLanguageValue(
          profile.primaryLanguage,
          profile.mainLanguage,
          profile.language
        ),
    };

    if (s(reviewInfo.sourceUrl) || lowerText(reviewInfo.sourceType) === "manual") {
      updateActiveSourceScope(reviewInfo.sourceType, reviewInfo.sourceUrl);
    }

    setDiscoveryState((prev) => ({
      ...prev,
      mainLanguage: metadata.mainLanguage || "",
      primaryLanguage: metadata.primaryLanguage || "",
      reviewRequired: metadata.reviewRequired,
      reviewFlags: arr(metadata.reviewFlags),
      fieldConfidence: obj(metadata.fieldConfidence),
      reviewSessionId: s(normalized?.session?.id || prev.reviewSessionId),
      reviewSessionStatus: s(
        normalized?.session?.status || prev.reviewSessionStatus
      ),
      reviewSessionRevision: s(
        session?.revision || legacy?.reviewSessionRevision || prev.reviewSessionRevision
      ),
      reviewFreshness: s(
        session?.freshness || legacy?.reviewFreshness || prev.reviewFreshness || "unknown"
      ),
      reviewStale: !!(session?.stale || legacy?.reviewStale || false),
      reviewConflicted: !!(session?.conflicted || legacy?.reviewConflicted || false),
      reviewConflictMessage: s(
        session?.conflictMessage || legacy?.reviewConflictMessage || ""
      ),
      hasResults:
        hasMeaningfulProfile(profile) ||
        arr(normalized?.bundleSources).length > 0 ||
        arr(normalized?.sources).length > 0 ||
        arr(normalized?.events).length > 0 ||
        arr(legacy.reviewQueue).length > 0 ||
        arr(legacy.sections?.services).length > 0,
      resultCount: preserveCounts
        ? prev.resultCount
        : arr(legacy.reviewQueue).length +
          arr(legacy.sections?.services).length +
          arr(normalized?.bundleSources).length +
          arr(normalized?.sources).length +
          arr(normalized?.events).length,
      profile,
      warnings: arr(legacy.warnings),
      candidateCount: preserveCounts
        ? prev.candidateCount
        : Number(legacy.stats?.knowledgeCount || 0),
      sourceRunId: s(legacy.sourceRunId),
      snapshotId: s(legacy.snapshotId),
      sourceId: s(legacy.sourceId),
      lastSourceType: s(reviewInfo.sourceType),
      lastUrl: s(reviewInfo.sourceUrl),
    }));
  }

  function applyReviewState(
    reviewPayload = {},
    { preserveBusinessForm = false, fallbackProfile = {} } = {}
  ) {
    const normalized = normalizeReviewState(reviewPayload);
    const legacy = mapCurrentReviewToLegacyDraft(normalized);
    const nextManualSections = buildManualSectionsFromReview(normalized);
    const reviewInfo = resolveReviewSourceInfo(normalized, legacy);

    if (s(reviewInfo.sourceUrl) || lowerText(reviewInfo.sourceType) === "manual") {
      updateActiveSourceScope(reviewInfo.sourceType, reviewInfo.sourceUrl);
    }

    setCurrentReview(normalized);
    setReviewDraft(legacy);

    const preferredProfile = chooseBestProfileForForm(
      legacy.overview,
      fallbackProfile
    );

    setBusinessForm((prev) => {
      if (!hasMeaningfulProfile(preferredProfile)) {
        return {
          ...DEFAULT_BUSINESS_FORM,
          timezone: s(prev.timezone || "Asia/Baku"),
          language: s(prev.language || "en"),
          websiteUrl: s(reviewInfo.sourceUrl),
        };
      }

      return hydrateBusinessFormFromProfile(
        preserveBusinessForm ? prev : formFromProfile(legacy.overview, prev),
        preferredProfile,
        { force: !preserveBusinessForm }
      );
    });

    setManualSections((prev) => ({
      servicesText: s(nextManualSections.servicesText),
      faqsText: s(nextManualSections.faqsText),
      policiesText: s(nextManualSections.policiesText),
    }));

    syncDiscoveryStateFromReview(normalized, { preserveCounts: false });

    return {
      currentReview: normalized,
      reviewDraft: legacy,
    };
  }

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

  const actions = createSetupStudioActions({
    navigate,
    freshEntryMode,
    discoveryForm,
    businessForm,
    manualSections,
    currentReview,
    reviewDraft,
    discoveryState,
    activeSourceScope,
    activeReviewAligned,
    visibleKnowledgeItems,
    autoRevealRef,
    setLoading,
    setRefreshing,
    setImportingWebsite,
    setSavingBusiness,
    setActingKnowledgeId,
    setSavingServiceSuggestion,
    setShowRefine,
    setShowKnowledge,
    setFreshEntryMode,
    setError,
    setBusinessForm,
    setManualSections,
    setCurrentReview,
    setReviewDraft,
    setDiscoveryState,
    setKnowledgeCandidates,
    setServices,
    setMeta,
    updateActiveSourceScope,
    resolveActiveSourceScope,
    clearStudioReviewState,
    resetBusinessTwinDraftForNewScan,
    seedBusinessFormFromBootProfile,
    syncDiscoveryStateFromReview,
    applyReviewState,
    createEmptyReviewState,
    createEmptyLegacyDraft,
    pickKnowledgeCandidateId,
  });

  useEffect(() => {
    actions.loadData({
      hydrateReview: true,
      preserveBusinessForm: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (freshEntryMode) return;
    if (meta.setupCompleted) return;

    if (
      s(meta.nextStudioStage).toLowerCase() === "knowledge" &&
      knowledgeCandidates.length > 0
    ) {
      setShowKnowledge(true);
    }
  }, [
    freshEntryMode,
    meta.nextStudioStage,
    meta.setupCompleted,
    knowledgeCandidates.length,
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

    const barrierOnly =
      mode === "partial" &&
      arr(discoveryState.warnings).some((item) => isWebsiteBarrierWarning(item)) &&
      !hasExtractedIdentityProfile(discoveryState.profile) &&
      visibleKnowledgeItems.length === 0 &&
      visibleServiceItems.length === 0;

    setShowRefine(!barrierOnly);

    if (
      !barrierOnly &&
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
  ]);

  return (
    <SetupStudioScene
      loading={loading}
      refreshing={refreshing}
      importingWebsite={importingWebsite}
      savingBusiness={savingBusiness}
      actingKnowledgeId={actingKnowledgeId}
      savingServiceSuggestion={savingServiceSuggestion}
      showRefine={showRefine}
      showKnowledge={showKnowledge}
      error={error}
      businessForm={businessForm}
      discoveryForm={discoveryForm}
      discoveryState={discoveryState}
      reviewDraft={scopedReviewDraft}
      manualSections={manualSections}
      meta={effectiveMeta}
      currentTitle={currentTitle}
      currentDescription={currentDescription}
      discoveryProfileRows={discoveryProfileRows}
      knowledgePreview={knowledgePreview}
      knowledgeItems={visibleKnowledgeItems}
      serviceSuggestionTitle={serviceSuggestionTitle}
      studioProgress={studioProgress}
      services={services}
      reviewSources={visibleSources}
      reviewEvents={visibleEvents}
      reviewSyncState={reviewSyncState}
      hasVisibleResults={hasVisibleResults}
      hasStoredReview={hasStoredReview}
      hasApprovedTruth={!!meta.setupCompleted}
      visibleKnowledgeCount={visibleKnowledgeItems.length}
      visibleServiceCount={visibleServiceItems.length}
      onSetBusinessField={setBusinessField}
      onSetManualSection={setManualSection}
      onSetDiscoveryField={setDiscoveryField}
      onScanBusiness={actions.onScanBusiness}
      onContinueFlow={() => actions.onScanBusiness(discoveryForm)}
      onResumeReview={() =>
        actions.loadCurrentReview({
          preserveBusinessForm: true,
          activateReviewSession: true,
          activeSourceType: activeSourceScope.sourceType,
          activeSourceUrl: activeSourceScope.sourceUrl,
        })
      }
      onSaveBusiness={actions.onSaveBusiness}
      onApproveKnowledge={actions.onApproveKnowledge}
      onRejectKnowledge={actions.onRejectKnowledge}
      onCreateSuggestedService={actions.onCreateSuggestedService}
      onOpenWorkspace={actions.onOpenWorkspace}
      onOpenTruth={() => navigate("/truth")}
      onReloadReviewDraft={() =>
        actions.loadCurrentReview({
          preserveBusinessForm: true,
          activateReviewSession: true,
          activeSourceType: activeSourceScope.sourceType,
          activeSourceUrl: activeSourceScope.sourceUrl,
        })
      }
      onRefresh={() =>
        actions.loadData({
          silent: true,
          preserveBusinessForm: !freshEntryMode,
          hydrateReview: true,
          activeSourceType: activeSourceScope.sourceType,
          activeSourceUrl: activeSourceScope.sourceUrl,
        })
      }
      onToggleRefine={() => setShowRefine((prev) => !prev)}
      onToggleKnowledge={() => setShowKnowledge((prev) => !prev)}
      discoveryModeLabel={discoveryModeLabel}
    />
  );
}
