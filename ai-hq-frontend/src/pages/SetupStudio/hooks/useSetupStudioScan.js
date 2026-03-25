import {
  analyzeSetupIntake,
  getCurrentSetupReview,
  importBundleForSetup,
  importSourceForSetup,
} from "../../../api/setup.js";

import {
  arr,
  obj,
  profilePatchFromDiscovery,
  profilePreviewRows,
  s,
} from "../lib/setupStudioHelpers.js";
import {
  applyUiHintsFromMeta,
  normalizeReviewState,
  normalizeScanRequest,
  resolveMainLanguageValue,
  scanCompleteLabel,
  scanStartLabel,
} from "../state/shared.js";
import {
  buildCapabilitiesPatch,
  buildSafeUiProfile,
  chooseBestProfileForForm,
  deriveSuggestedServicePayload,
  hasMeaningfulProfile,
  isBarrierOnlyImportResult,
} from "../state/profile.js";
import {
  deriveVisibleEvents,
  deriveVisibleKnowledgeItems,
  deriveVisibleServiceItems,
  deriveVisibleSources,
  mapCurrentReviewToLegacyDraft,
  resolveReviewSourceInfo,
  reviewStateMatchesSource,
} from "../state/reviewState.js";
import {
  buildAnalyzePayloadFromStudioState,
  normalizeRequestedSourceRows,
  pickRequestedPrimarySource,
  sourceLabelFor,
} from "../logic/helpers.js";

export function createSetupStudioScan(ctx, helpers) {
  const {
    discoveryForm,
    businessForm,
    manualSections,
    activeSourceScope,
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
    const request = normalizeScanRequest(input, discoveryForm);
    const requestedSources = normalizeRequestedSourceRows(request.sources);
    const requestedPrimarySource = pickRequestedPrimarySource({
      sources: requestedSources,
      primarySource: request.primarySource,
    });

    const sourceType = s(request.sourceType);
    const sourceUrl = s(request.url);
    const hasImportableSource = !!(
      request?.hasImportableSource &&
      sourceType &&
      sourceUrl
    );
    const hasRequestedSources = requestedSources.length > 0;
    const requestedPrimarySourceType = s(
      request.requestedPrimarySourceType || requestedPrimarySource?.sourceType
    );
    const requestedPrimarySourceUrl = s(
      request.requestedPrimarySourceUrl || requestedPrimarySource?.url
    );
    const shouldUseBundledImport = !!(
      hasImportableSource &&
      requestedSources.length > 1 &&
      requestedPrimarySourceType === "website"
    );

    const analyzePayload = buildAnalyzePayloadFromStudioState({
      businessForm,
      manualSections,
      discoveryForm: {
        ...discoveryForm,
        note: request.note,
      },
      fallbackSourceUrl: sourceUrl || requestedPrimarySourceUrl,
      scanRequest: {
        ...request,
        sources: requestedSources,
        primarySource: requestedPrimarySource,
      },
    });

    if (
      !hasImportableSource &&
      !analyzePayload.hasAnyInput &&
      !hasRequestedSources
    ) {
      setError(
        "Add a source, manual notes, or a business description before continuing."
      );
      return;
    }

    const uiSourceType = hasImportableSource
      ? requestedPrimarySourceType || sourceType
      : "manual";

    const displaySourceType =
      requestedPrimarySourceType ||
      (hasImportableSource ? sourceType : "manual");

    const displaySourceUrl = requestedPrimarySourceUrl || sourceUrl;

    try {
      setImportingWebsite(true);
      setFreshEntryMode(false);
      setError("");
      autoRevealRef.current = "";

      updateActiveSourceScope(
        uiSourceType,
        hasImportableSource ? displaySourceUrl : ""
      );

      clearStudioReviewState({ preserveActiveSource: true });
      resetBusinessTwinDraftForNewScan(
        hasImportableSource ? displaySourceUrl : ""
      );

      setDiscoveryState((prev) => ({
        ...prev,
        mode: "running",
        lastUrl: hasImportableSource ? displaySourceUrl : "",
        lastSourceType: uiSourceType,
        sourceLabel: sourceLabelFor(displaySourceType),
        message: hasImportableSource
          ? scanStartLabel(sourceType)
          : hasRequestedSources
            ? `${sourceLabelFor(displaySourceType)} context attached to the temporary draft...`
            : "Building the temporary business draft...",
        warnings: [],
        shouldReview: false,
        reviewRequired: false,
        reviewFlags: [],
        fieldConfidence: {},
        hasResults: false,
        resultCount: 0,
        importedKnowledgeItems: [],
        importedServices: [],
      }));

      let importResult = null;
      let analyzeResult = null;
      let reviewPayload = {};

      if (hasImportableSource) {
        const importPayload = {
          sourceType,
          url: sourceUrl,
          sourceUrl,
          note: request.note,
          businessNote: request.note,
          manualText: analyzePayload.manualText,
          answers: analyzePayload.answers,
          sources: requestedSources,
          primarySource: requestedPrimarySource,
        };

        if (shouldUseBundledImport) {
          importResult = await importBundleForSetup(importPayload);
          reviewPayload = await getCurrentSetupReview({ eventLimit: 30 });
        } else {
          importResult = await importSourceForSetup(importPayload);
        }
      }

      if (!shouldUseBundledImport) {
        analyzeResult = await analyzeSetupIntake(analyzePayload);
        reviewPayload = analyzeResult?.review || importResult?.review || {};
      }

      const importedReview = normalizeReviewState(reviewPayload);
      const legacyImportedDraft = mapCurrentReviewToLegacyDraft(importedReview);
      const reviewInfo = resolveReviewSourceInfo(
        importedReview,
        legacyImportedDraft
      );

      const effectiveSourceType = s(
        reviewInfo.sourceType ||
          analyzeResult?.sourceType ||
          uiSourceType ||
          "manual"
      );

      const effectiveSourceUrl = s(
        reviewInfo.sourceUrl ||
          analyzeResult?.sourceUrl ||
          (hasImportableSource ? displaySourceUrl : "")
      );
      const expectedReviewSourceType = hasImportableSource
        ? requestedPrimarySourceType || sourceType
        : "manual";
      const expectedReviewSourceUrl = hasImportableSource
        ? requestedPrimarySourceUrl || sourceUrl
        : "";
      const importedReviewMatchesActiveSource =
        expectedReviewSourceType === "manual"
          ? !!s(importedReview?.session?.id)
          : reviewStateMatchesSource(
              importedReview,
              legacyImportedDraft,
              expectedReviewSourceType,
              expectedReviewSourceUrl
            );

      if (effectiveSourceUrl || effectiveSourceType === "manual") {
        updateActiveSourceScope(effectiveSourceType, effectiveSourceUrl);
      }

      const importWarnings = arr(importResult?.warnings)
        .map((x) => s(x))
        .filter(Boolean);

      const analyzeWarnings = arr(analyzeResult?.warnings)
        .map((x) => s(x))
        .filter(Boolean);

      const contextualWarnings = [
        ...(!hasImportableSource && hasRequestedSources
          ? ["Selected sources were attached as temporary draft context."]
          : []),
        ...(hasImportableSource && request?.hasUnsupportedSources
          ? ["Additional sources were attached as supporting draft context."]
          : []),
        ...(!importedReviewMatchesActiveSource && hasImportableSource
          ? [
              "The backend review session did not match this source yet, so the editable draft stayed isolated.",
            ]
          : []),
      ];

      const combinedWarnings = [
        ...new Set([
          ...importWarnings,
          ...analyzeWarnings,
          ...contextualWarnings,
        ]),
      ];

      const barrierOnlyResult =
        hasImportableSource &&
        isBarrierOnlyImportResult(importResult, sourceType) &&
        !hasMeaningfulProfile(
          chooseBestProfileForForm(
            obj(legacyImportedDraft?.overview),
            obj(analyzeResult?.profile)
          )
        );

      const reviewBackedProfile = obj(legacyImportedDraft?.overview);
      const helperProfilePatch = profilePatchFromDiscovery(
        obj(analyzeResult?.profile || importResult?.profile)
      );

      const resultMetadata = {
        reviewRequired: !!(
          analyzeResult?.reviewRequired ??
          legacyImportedDraft?.reviewRequired ??
          false
        ),
        reviewFlags: arr(
          analyzeResult?.reviewFlags || legacyImportedDraft?.reviewFlags || []
        ),
        fieldConfidence: obj(
          analyzeResult?.fieldConfidence ||
            legacyImportedDraft?.fieldConfidence ||
            {}
        ),
        mainLanguage:
          s(analyzeResult?.mainLanguage) ||
          s(legacyImportedDraft?.mainLanguage) ||
          resolveMainLanguageValue(
            reviewBackedProfile?.mainLanguage,
            reviewBackedProfile?.primaryLanguage,
            reviewBackedProfile?.language
          ),
        primaryLanguage:
          s(analyzeResult?.primaryLanguage) ||
          s(legacyImportedDraft?.primaryLanguage) ||
          resolveMainLanguageValue(
            reviewBackedProfile?.primaryLanguage,
            reviewBackedProfile?.mainLanguage,
            reviewBackedProfile?.language
          ),
      };

      const rawBestIncomingProfile = barrierOnlyResult
        ? chooseBestProfileForForm(
            obj(analyzeResult?.profile),
            helperProfilePatch
          )
        : chooseBestProfileForForm(
            reviewBackedProfile,
            obj(analyzeResult?.profile),
            obj(importResult?.profile),
            helperProfilePatch
          );

      const bestIncomingProfile = buildSafeUiProfile({
        rawProfile: rawBestIncomingProfile,
        sourceType: effectiveSourceType,
        sourceUrl: effectiveSourceUrl,
        warnings: combinedWarnings,
        mainLanguage: resultMetadata.mainLanguage,
        primaryLanguage: resultMetadata.primaryLanguage,
        reviewRequired: resultMetadata.reviewRequired,
        reviewFlags: resultMetadata.reviewFlags,
        fieldConfidence: resultMetadata.fieldConfidence,
        barrierOnly: barrierOnlyResult,
      });

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
        setReviewSyncIssue({
          sessionId: s(
            importedReview?.session?.id || legacyImportedDraft?.reviewSessionId
          ),
          sessionStatus: s(
            importedReview?.session?.status ||
              legacyImportedDraft?.reviewSessionStatus
          ),
          revision: s(
            importedReview?.session?.revision ||
              legacyImportedDraft?.reviewSessionRevision
          ),
          freshness:
            hasImportableSource && !importedReviewMatchesActiveSource
              ? "source_mismatch"
              : s(
                  importedReview?.session?.freshness ||
                    legacyImportedDraft?.reviewFreshness ||
                    "unknown"
                ),
          message:
            hasImportableSource && !importedReviewMatchesActiveSource
              ? "The backend review session did not match this source yet, so editing remains isolated."
              : s(legacyImportedDraft?.reviewConflictMessage),
        });
      }

      const sourceId = s(
        analyzeResult?.source?.id ||
          importResult?.source?.id ||
          legacyImportedDraft?.sourceId
      );
      const sourceRunId = s(
        analyzeResult?.run?.id ||
          importResult?.run?.id ||
          legacyImportedDraft?.sourceRunId
      );
      const snapshotId = s(
        legacyImportedDraft?.snapshotId ||
          analyzeResult?.snapshot?.id ||
          importResult?.snapshot?.id
      );

      const scopedImportedReview =
        !barrierOnlyResult && importedReviewMatchesActiveSource
          ? importedReview
          : createEmptyReviewState();

      const scopedImportedDraft =
        !barrierOnlyResult && importedReviewMatchesActiveSource
          ? legacyImportedDraft
          : createEmptyLegacyDraft();

      const immediateDiscoveryState = {
        lastUrl: effectiveSourceUrl,
        lastSourceType: effectiveSourceType,
        sourceLabel: sourceLabelFor(
          hasImportableSource ? effectiveSourceType : displaySourceType
        ),
        intakeContext: {
          ...obj(importResult?.intakeContext),
          requestedSources,
          primarySource: requestedPrimarySource || null,
          hasImportableSource,
          hasUnsupportedSources: !!request?.hasUnsupportedSources,
          sourceCount: Number(
            request?.sourceCount || requestedSources.length || 0
          ),
        },
        snapshot: obj(analyzeResult?.snapshot || importResult?.snapshot),
        profile: bestIncomingProfile,
        signals: obj(analyzeResult?.signals || importResult?.signals),
        sourceId,
        sourceRunId,
        snapshotId,
        importedKnowledgeItems: barrierOnlyResult
          ? []
          : arr(scopedImportedDraft?.reviewQueue),
        importedServices: barrierOnlyResult
          ? []
          : arr(scopedImportedDraft?.sections?.services),
        mainLanguage: resultMetadata.mainLanguage,
        primaryLanguage: resultMetadata.primaryLanguage,
        reviewRequired: !!resultMetadata.reviewRequired,
        reviewFlags: arr(resultMetadata.reviewFlags),
        fieldConfidence: obj(resultMetadata.fieldConfidence),
      };

      const importedVisibleKnowledgeItems = barrierOnlyResult
        ? []
        : deriveVisibleKnowledgeItems({
            reviewDraft: scopedImportedDraft,
            currentReview: scopedImportedReview,
            discoveryState: immediateDiscoveryState,
          });

      const importedVisibleServiceItems = barrierOnlyResult
        ? []
        : deriveVisibleServiceItems({
            reviewDraft: scopedImportedDraft,
            currentReview: scopedImportedReview,
            discoveryState: immediateDiscoveryState,
          });

      const importedVisibleSources = deriveVisibleSources({
        currentReview: scopedImportedReview,
        discoveryState: immediateDiscoveryState,
      });

      const importedVisibleEvents = deriveVisibleEvents(scopedImportedReview);
      const importedProfileRows = profilePreviewRows(bestIncomingProfile);

      const hasImmediateVisibleResults =
        importedVisibleKnowledgeItems.length > 0 ||
        importedVisibleServiceItems.length > 0 ||
        importedVisibleSources.length > 0 ||
        importedVisibleEvents.length > 0 ||
        importedProfileRows.length > 0 ||
        combinedWarnings.length > 0 ||
        hasMeaningfulProfile(bestIncomingProfile);

      setDiscoveryState({
        mode: s(analyzeResult?.mode || importResult?.mode) || "success",
        lastUrl: effectiveSourceUrl,
        lastSourceType: effectiveSourceType,
        sourceLabel: sourceLabelFor(
          hasImportableSource ? effectiveSourceType : displaySourceType
        ),
        message:
          combinedWarnings.length > 0
            ? combinedWarnings[0]
            : effectiveSourceType === "manual"
              ? "Business draft generated"
              : scanCompleteLabel(
                  effectiveSourceType,
                  analyzeResult?.candidateCount
                ),
        candidateCount: Number(analyzeResult?.candidateCount || 0),
        profileApplied: hasMeaningfulProfile(bestIncomingProfile),
        shouldReview: !!analyzeResult?.shouldReview,
        warnings: combinedWarnings,
        requestId: s(analyzeResult?.requestId || importResult?.requestId),
        intakeContext: {
          ...obj(importResult?.intakeContext),
          requestedSources,
          primarySource: requestedPrimarySource || null,
          hasImportableSource,
          hasUnsupportedSources: !!request?.hasUnsupportedSources,
          sourceCount: Number(
            request?.sourceCount || requestedSources.length || 0
          ),
        },
        profile: {
          ...bestIncomingProfile,
          mainLanguage:
            immediateDiscoveryState.mainLanguage ||
            bestIncomingProfile.mainLanguage,
          primaryLanguage:
            immediateDiscoveryState.primaryLanguage ||
            bestIncomingProfile.primaryLanguage,
          reviewRequired: immediateDiscoveryState.reviewRequired,
          reviewFlags: arr(immediateDiscoveryState.reviewFlags),
          fieldConfidence: obj(immediateDiscoveryState.fieldConfidence),
        },
        signals: obj(analyzeResult?.signals || importResult?.signals),
        snapshot: obj(analyzeResult?.snapshot || importResult?.snapshot),
        sourceId,
        sourceRunId,
        snapshotId,
        reviewSessionId: s(
          analyzeResult?.reviewSessionId || importedReview?.session?.id
        ),
        reviewSessionStatus: s(
          analyzeResult?.reviewSessionStatus || importedReview?.session?.status
        ),
        hasResults: hasImmediateVisibleResults,
        resultCount:
          importedVisibleKnowledgeItems.length +
          importedVisibleServiceItems.length +
          importedVisibleSources.length +
          importedVisibleEvents.length +
          importedProfileRows.length,
        importedKnowledgeItems: barrierOnlyResult
          ? []
          : arr(scopedImportedDraft?.reviewQueue),
        importedServices: barrierOnlyResult
          ? []
          : arr(scopedImportedDraft?.sections?.services),
        mainLanguage: immediateDiscoveryState.mainLanguage,
        primaryLanguage: immediateDiscoveryState.primaryLanguage,
        reviewRequired: immediateDiscoveryState.reviewRequired,
        reviewFlags: arr(immediateDiscoveryState.reviewFlags),
        fieldConfidence: obj(immediateDiscoveryState.fieldConfidence),
      });

      const refreshResult = await refreshAndMaybeRouteHome({
        preserveBusinessForm: true,
        hydrateReview: true,
        activeSourceType: effectiveSourceType,
        activeSourceUrl: effectiveSourceUrl,
      });

      if (!refreshResult.routed) {
        const refreshedPendingKnowledge = arr(
          refreshResult?.snapshot?.pendingKnowledge
        );

        const shouldOpenKnowledge =
          !barrierOnlyResult &&
          (!!analyzeResult?.shouldReview ||
            Number(analyzeResult?.candidateCount || 0) > 0 ||
            refreshedPendingKnowledge.length > 0 ||
            importedVisibleKnowledgeItems.length > 0 ||
            importedVisibleServiceItems.length > 0 ||
            s(refreshResult?.snapshot?.meta?.nextStudioStage).toLowerCase() ===
              "knowledge");

        const shouldOpenRefine =
          !barrierOnlyResult &&
          (hasImmediateVisibleResults ||
            hasMeaningfulProfile(bestIncomingProfile) ||
            importedProfileRows.length > 0);

        setShowKnowledge(shouldOpenKnowledge);
        setShowRefine(shouldOpenRefine);
      }
    } catch (e2) {
      const message = String(
        e2?.message || e2 || "The business draft could not be prepared."
      );

      setDiscoveryState((prev) => ({
        ...prev,
        mode: "error",
        lastUrl: s(requestedPrimarySourceUrl || sourceUrl),
        lastSourceType: uiSourceType,
        sourceLabel: sourceLabelFor(displaySourceType),
        message,
        hasResults: false,
        resultCount: 0,
        importedKnowledgeItems: [],
        importedServices: [],
      }));

      setError(message);
    } finally {
      setImportingWebsite(false);
    }
  }

  return { onScanBusiness };
}
