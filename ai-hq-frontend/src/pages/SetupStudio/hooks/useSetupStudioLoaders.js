import { getAppBootstrap } from "../../../api/app.js";
import { getCurrentSetupReview } from "../../../api/setup.js";
import { getKnowledgeCandidates } from "../../../api/knowledge.js";
import { getSetupServices } from "../../../api/services.js";

import {
  arr,
  extractItems,
  firstLanguage,
  isPendingKnowledge,
  obj,
  s,
} from "../lib/setupStudioHelpers.js";
import {
  applyUiHintsFromMeta,
  normalizeBootMeta,
  normalizeReviewState,
  pickSetupProfile,
  resolveMainLanguageValue,
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
  reviewStateMatchesSource,
} from "../state/reviewState.js";
import { lowerText } from "../logic/helpers.js";
import { DEFAULT_BUSINESS_FORM } from "../logic/constants.js";

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
      const normalized = normalizeReviewState(payload);
      const legacy = mapCurrentReviewToLegacyDraft(normalized);
      const sourceScope = resolveActiveSourceScope({
        sourceType: activeSourceType,
        sourceUrl: activeSourceUrl,
      });

      const shouldApplyIntoActiveStudio =
        !preserveBusinessForm ||
        !s(sourceScope.sourceUrl) ||
        sourceScope.sourceType === "manual" ||
        reviewStateMatchesSource(
          normalized,
          legacy,
          sourceScope.sourceType,
          sourceScope.sourceUrl
        );

      if (!shouldApplyIntoActiveStudio) {
        setCurrentReview(normalized);
        setReviewDraft(legacy);
        setReviewSyncIssue({
          sessionId: s(normalized?.session?.id || legacy?.reviewSessionId),
          sessionStatus: s(
            normalized?.session?.status || legacy?.reviewSessionStatus
          ),
          revision: s(
            normalized?.session?.revision || legacy?.reviewSessionRevision
          ),
          freshness: "source_mismatch",
          message:
            "A review session exists, but it belongs to a different source than the active draft.",
        });

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
      setReviewSyncIssue({
        freshness: "unknown",
        message: String(
          e?.message || e || "The current review session could not be loaded."
        ),
      });

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

      const boot = responses[0];
      const knowledgePayload = responses[1];
      const servicesPayload = responses[2];
      const reviewPayload = hydrateReview ? responses[3] : { review: {} };

      const workspace = obj(boot?.workspace);
      const setup = obj(boot?.setup);
      const profile = pickSetupProfile(setup, workspace);

      const rawKnowledge = extractItems(knowledgePayload);
      const pendingKnowledge = rawKnowledge.filter(isPendingKnowledge);
      const serviceItems = extractItems(servicesPayload);

      const nextMeta = normalizeBootMeta(boot, pendingKnowledge, serviceItems);

      setMeta(nextMeta);
      setKnowledgeCandidates(pendingKnowledge);
      setServices(serviceItems);

      if (!hydrateReview) {
        if (!preserveBusinessForm) {
          clearStudioReviewState({ preserveActiveSource: false });
          seedBusinessFormFromBootProfile(profile);
        }

        return {
          boot,
          workspace,
          setup,
          profile,
          pendingKnowledge,
          serviceItems,
          meta: nextMeta,
          currentReview: createEmptyReviewState(),
        };
      }

      const reviewState = normalizeReviewState(reviewPayload);
      const legacyDraft = mapCurrentReviewToLegacyDraft(reviewState);

      const sourceScope = resolveActiveSourceScope({
        sourceType: activeSourceType,
        sourceUrl: activeSourceUrl,
      });

      const shouldApplyIntoActiveStudio =
        !preserveBusinessForm ||
        !s(sourceScope.sourceUrl) ||
        sourceScope.sourceType === "manual" ||
        reviewStateMatchesSource(
          reviewState,
          legacyDraft,
          sourceScope.sourceType,
          sourceScope.sourceUrl
        );

      if (!shouldApplyIntoActiveStudio) {
        setCurrentReview(reviewState);
        setReviewDraft(legacyDraft);
        setReviewSyncIssue({
          sessionId: s(reviewState?.session?.id || legacyDraft?.reviewSessionId),
          sessionStatus: s(
            reviewState?.session?.status || legacyDraft?.reviewSessionStatus
          ),
          revision: s(
            reviewState?.session?.revision || legacyDraft?.reviewSessionRevision
          ),
          freshness: "source_mismatch",
          message:
            "A review session was loaded, but it does not match the active source draft.",
        });

        return {
          boot,
          workspace,
          setup,
          profile,
          pendingKnowledge,
          serviceItems,
          meta: nextMeta,
          currentReview: reviewState,
        };
      }

      setCurrentReview(reviewState);
      setReviewDraft(legacyDraft);

      const reviewInfo = resolveReviewSourceInfo(reviewState, legacyDraft);

      if (s(reviewInfo.sourceUrl) || lowerText(reviewInfo.sourceType) === "manual") {
        updateActiveSourceScope(reviewInfo.sourceType, reviewInfo.sourceUrl);
      }

      const baseProfile = chooseBestProfileForForm(legacyDraft?.overview);

      setBusinessForm((prev) => {
        if (!hasMeaningfulProfile(baseProfile)) {
          return {
            ...DEFAULT_BUSINESS_FORM,
            timezone: s(prev.timezone || "Asia/Baku"),
            language: s(prev.language || "en"),
            websiteUrl: s(reviewInfo.sourceUrl),
          };
        }

        if (!preserveBusinessForm) {
          return hydrateBusinessFormFromProfile(
            formFromProfile(baseProfile, {
              ...prev,
              timezone: s(baseProfile?.timezone || "Asia/Baku"),
              language:
                resolveMainLanguageValue(
                  baseProfile?.mainLanguage,
                  baseProfile?.primaryLanguage,
                  baseProfile?.language,
                  firstLanguage(baseProfile)
                ) || "en",
            }),
            baseProfile,
            { force: true }
          );
        }

        return hydrateBusinessFormFromProfile(prev, baseProfile, {
          force: false,
        });
      });

      const nextManualSections = buildManualSectionsFromReview(reviewState);
      setManualSections(() => ({
        servicesText: s(nextManualSections.servicesText),
        faqsText: s(nextManualSections.faqsText),
        policiesText: s(nextManualSections.policiesText),
      }));

      syncDiscoveryStateFromReview(reviewState, { preserveCounts: false });

      applyUiHintsFromMeta({
        nextMeta,
        pendingKnowledge,
        setShowKnowledge,
        setShowRefine,
      });

      return {
        boot,
        workspace,
        setup,
        profile,
        pendingKnowledge,
        serviceItems,
        meta: nextMeta,
        currentReview: reviewState,
      };
    } catch (e) {
      const message = String(
        e?.message || e || "Setup studio data could not be loaded."
      );
      setError(message);

      return {
        boot: {},
        workspace: {},
        setup: {},
        profile: {},
        pendingKnowledge: [],
        serviceItems: [],
        meta: {},
        currentReview: {},
        error: message,
      };
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
