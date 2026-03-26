import { useRef, useState } from "react";

import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import {
  createEmptyLegacyDraft,
  createEmptyReviewState,
  createEmptySourceScope,
  createIdleDiscoveryState,
  normalizeReviewState,
  resolveMainLanguageValue,
  sourceIdentityKey,
} from "../state/shared.js";
import {
  chooseBestProfileForForm,
  formFromProfile,
  hasMeaningfulProfile,
  hydrateBusinessFormFromProfile,
} from "../state/profile.js";
import {
  buildManualSectionsFromReview,
  mapCurrentReviewToLegacyDraft,
  resolveReviewSourceInfo,
} from "../state/reviewState.js";
import {
  DEFAULT_BUSINESS_FORM,
  DEFAULT_DISCOVERY_FORM,
  DEFAULT_MANUAL_SECTIONS,
  DEFAULT_SETUP_META,
} from "../logic/constants.js";
import { lowerText, normalizeStudioSourceType } from "../logic/helpers.js";

export function useSetupStudioControllerState() {
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

    setManualSections(() => ({
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

  return {
    autoRevealRef,
    activeSourceRef,
    loading,
    refreshing,
    importingWebsite,
    savingBusiness,
    actingKnowledgeId,
    savingServiceSuggestion,
    showRefine,
    showKnowledge,
    freshEntryMode,
    error,
    businessForm,
    manualSections,
    discoveryForm,
    currentReview,
    reviewDraft,
    discoveryState,
    activeSourceScope,
    knowledgeCandidates,
    services,
    meta,
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
    setDiscoveryForm,
    setCurrentReview,
    setReviewDraft,
    setDiscoveryState,
    setActiveSourceScope,
    setKnowledgeCandidates,
    setServices,
    setMeta,
    setBusinessField,
    setManualSection,
    setDiscoveryField,
    updateActiveSourceScope,
    resolveActiveSourceScope,
    clearStudioReviewState,
    resetBusinessTwinDraftForNewScan,
    seedBusinessFormFromBootProfile,
    syncDiscoveryStateFromReview,
    applyReviewState,
    createEmptyReviewState,
    createEmptyLegacyDraft,
  };
}
