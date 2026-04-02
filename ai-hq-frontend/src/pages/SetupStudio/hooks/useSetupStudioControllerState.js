import { useRef, useState } from "react";

import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import {
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
  deriveCanonicalReviewProjection,
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
    setDiscoveryState(createIdleDiscoveryState());
    setShowKnowledge(false);

    if (!preserveActiveSource) {
      updateActiveSourceScope("", "");
    }
  }

  function resetBusinessTwinDraftForNewScan(nextSourceUrl = "") {
    setBusinessForm(() => ({
      ...DEFAULT_BUSINESS_FORM,
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
        timezone: s(prev.timezone),
        language: s(prev.language),
      })
    );
  }

  function syncDiscoveryStateFromReview(review = {}, { preserveCounts = true } = {}) {
    const normalized = normalizeReviewState(review);
    const reviewProjection = deriveCanonicalReviewProjection(normalized);
    const profile = obj(reviewProjection.overview);
    const reviewInfo = resolveReviewSourceInfo(normalized);
    const session = obj(normalized?.session);

    const metadata = {
      reviewRequired: !!reviewProjection.reviewRequired,
      reviewFlags: arr(reviewProjection.reviewFlags),
      fieldConfidence: obj(reviewProjection.fieldConfidence),
      mainLanguage:
        reviewProjection.mainLanguage ||
        resolveMainLanguageValue(
          profile.mainLanguage,
          profile.primaryLanguage,
          profile.language
        ),
      primaryLanguage:
        reviewProjection.primaryLanguage ||
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
        session?.revision ||
          reviewProjection?.reviewSessionRevision ||
          prev.reviewSessionRevision
      ),
      reviewFreshness: s(
        session?.freshness ||
          reviewProjection?.reviewFreshness ||
          prev.reviewFreshness ||
          "unknown"
      ),
      reviewStale: !!(session?.stale || reviewProjection?.reviewStale || false),
      reviewConflicted: !!(
        session?.conflicted || reviewProjection?.reviewConflicted || false
      ),
      reviewConflictMessage: s(
        session?.conflictMessage || reviewProjection?.reviewConflictMessage || ""
      ),
      hasResults:
        hasMeaningfulProfile(profile) ||
        arr(normalized?.bundleSources).length > 0 ||
        arr(normalized?.sources).length > 0 ||
        arr(normalized?.events).length > 0 ||
        arr(normalized?.draft?.knowledgeItems).length > 0 ||
        arr(normalized?.draft?.services).length > 0,
      resultCount: preserveCounts
        ? prev.resultCount
        : arr(normalized?.draft?.knowledgeItems).length +
          arr(normalized?.draft?.services).length +
          arr(normalized?.bundleSources).length +
          arr(normalized?.sources).length +
          arr(normalized?.events).length,
      profile,
      warnings: arr(reviewProjection.warnings),
      candidateCount: preserveCounts
        ? prev.candidateCount
        : Number(reviewProjection.stats?.knowledgeCount || 0),
      sourceRunId: s(reviewProjection.sourceRunId),
      snapshotId: s(reviewProjection.snapshotId),
      sourceId: s(reviewProjection.sourceId),
      lastSourceType: s(reviewInfo.sourceType),
      lastUrl: s(reviewInfo.sourceUrl),
    }));
  }

  function applyReviewState(
    reviewPayload = {},
    { preserveBusinessForm = false, fallbackProfile = {} } = {}
  ) {
    const normalized = normalizeReviewState(reviewPayload);
    const reviewProjection = deriveCanonicalReviewProjection(normalized);
    const nextManualSections = buildManualSectionsFromReview(normalized);
    const reviewInfo = resolveReviewSourceInfo(normalized);

    if (s(reviewInfo.sourceUrl) || lowerText(reviewInfo.sourceType) === "manual") {
      updateActiveSourceScope(reviewInfo.sourceType, reviewInfo.sourceUrl);
    }

    setCurrentReview(normalized);

    const preferredProfile = chooseBestProfileForForm(
      reviewProjection.overview,
      fallbackProfile
    );

    setBusinessForm((prev) => {
      const localeSeed = {
        ...DEFAULT_BUSINESS_FORM,
        timezone: s(prev.timezone),
        language: s(prev.language),
        websiteUrl: s(reviewInfo.sourceUrl),
      };

      if (!hasMeaningfulProfile(preferredProfile)) {
        return localeSeed;
      }

      return hydrateBusinessFormFromProfile(
        preserveBusinessForm
          ? prev
          : formFromProfile(reviewProjection.overview, localeSeed),
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
    showKnowledge,
    freshEntryMode,
    error,
    businessForm,
    manualSections,
    discoveryForm,
    currentReview,
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
    setShowKnowledge,
    setFreshEntryMode,
    setError,
    setBusinessForm,
    setManualSections,
    setDiscoveryForm,
    setCurrentReview,
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
  };
}
