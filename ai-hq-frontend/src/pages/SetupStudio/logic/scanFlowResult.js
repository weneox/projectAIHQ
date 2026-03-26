import {
  arr,
  obj,
  profilePatchFromDiscovery,
  profilePreviewRows,
  s,
} from "../lib/setupStudioHelpers.js";
import {
  resolveMainLanguageValue,
  scanCompleteLabel,
  normalizeReviewState,
} from "../state/shared.js";
import {
  buildSafeUiProfile,
  chooseBestProfileForForm,
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
import { sourceLabelFor } from "./helpers.js";

export function reconcileSetupStudioScanResult({
  plan,
  importResult,
  analyzeResult,
  reviewPayload,
  createEmptyReviewState,
  createEmptyLegacyDraft,
}) {
  const importedReview = normalizeReviewState(reviewPayload);
  const legacyImportedDraft = mapCurrentReviewToLegacyDraft(importedReview);
  const reviewInfo = resolveReviewSourceInfo(importedReview, legacyImportedDraft);

  const effectiveSourceType = s(
    reviewInfo.sourceType || analyzeResult?.sourceType || plan.uiSourceType || "manual"
  );

  const effectiveSourceUrl = s(
    reviewInfo.sourceUrl ||
      analyzeResult?.sourceUrl ||
      (plan.hasImportableSource ? plan.displaySourceUrl : "")
  );

  const expectedReviewSourceType = plan.hasImportableSource
    ? plan.requestedPrimarySourceType || plan.sourceType
    : "manual";
  const expectedReviewSourceUrl = plan.hasImportableSource
    ? plan.requestedPrimarySourceUrl || plan.sourceUrl
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

  const importWarnings = arr(importResult?.warnings)
    .map((x) => s(x))
    .filter(Boolean);
  const analyzeWarnings = arr(analyzeResult?.warnings)
    .map((x) => s(x))
    .filter(Boolean);

  const contextualWarnings = [
    ...(!plan.hasImportableSource && plan.hasRequestedSources
      ? ["Selected sources were attached as temporary draft context."]
      : []),
    ...(plan.hasImportableSource && plan.request?.hasUnsupportedSources
      ? ["Additional sources were attached as supporting draft context."]
      : []),
    ...(!importedReviewMatchesActiveSource && plan.hasImportableSource
      ? [
          "The backend review session did not match this source yet, so the editable draft stayed isolated.",
        ]
      : []),
  ];

  const combinedWarnings = [
    ...new Set([...importWarnings, ...analyzeWarnings, ...contextualWarnings]),
  ];

  const barrierOnlyResult =
    plan.hasImportableSource &&
    isBarrierOnlyImportResult(importResult, plan.sourceType) &&
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
    ? chooseBestProfileForForm(obj(analyzeResult?.profile), helperProfilePatch)
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

  const intakeContext = {
    ...obj(importResult?.intakeContext),
    requestedSources: plan.requestedSources,
    primarySource: plan.requestedPrimarySource || null,
    hasImportableSource: plan.hasImportableSource,
    hasUnsupportedSources: !!plan.request?.hasUnsupportedSources,
    sourceCount: Number(plan.request?.sourceCount || plan.requestedSources.length || 0),
  };

  const immediateDiscoveryState = {
    lastUrl: effectiveSourceUrl,
    lastSourceType: effectiveSourceType,
    sourceLabel: sourceLabelFor(
      plan.hasImportableSource ? effectiveSourceType : plan.displaySourceType
    ),
    intakeContext,
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

  const finalDiscoveryState = {
    mode: s(analyzeResult?.mode || importResult?.mode) || "success",
    lastUrl: effectiveSourceUrl,
    lastSourceType: effectiveSourceType,
    sourceLabel: sourceLabelFor(
      plan.hasImportableSource ? effectiveSourceType : plan.displaySourceType
    ),
    message:
      combinedWarnings.length > 0
        ? combinedWarnings[0]
        : effectiveSourceType === "manual"
          ? "Business draft generated"
          : scanCompleteLabel(effectiveSourceType, analyzeResult?.candidateCount),
    candidateCount: Number(analyzeResult?.candidateCount || 0),
    profileApplied: hasMeaningfulProfile(bestIncomingProfile),
    shouldReview: !!analyzeResult?.shouldReview,
    warnings: combinedWarnings,
    requestId: s(analyzeResult?.requestId || importResult?.requestId),
    intakeContext,
    profile: {
      ...bestIncomingProfile,
      mainLanguage:
        immediateDiscoveryState.mainLanguage || bestIncomingProfile.mainLanguage,
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
    reviewSessionId: s(analyzeResult?.reviewSessionId || importedReview?.session?.id),
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
  };

  return {
    importedReview,
    legacyImportedDraft,
    effectiveSourceType,
    effectiveSourceUrl,
    importedReviewMatchesActiveSource,
    combinedWarnings,
    barrierOnlyResult,
    resultMetadata,
    bestIncomingProfile,
    scopedImportedReview,
    scopedImportedDraft,
    importedVisibleKnowledgeItems,
    importedVisibleServiceItems,
    importedVisibleSources,
    importedVisibleEvents,
    importedProfileRows,
    hasImmediateVisibleResults,
    finalDiscoveryState,
  };
}

export function buildSetupStudioReviewSyncIssue({
  importedReview,
  legacyImportedDraft,
  hasImportableSource,
  importedReviewMatchesActiveSource,
}) {
  return {
    sessionId: s(importedReview?.session?.id || legacyImportedDraft?.reviewSessionId),
    sessionStatus: s(
      importedReview?.session?.status || legacyImportedDraft?.reviewSessionStatus
    ),
    revision: s(
      importedReview?.session?.revision || legacyImportedDraft?.reviewSessionRevision
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
  };
}

export function buildSetupStudioScanRevealState({
  refreshResult,
  barrierOnlyResult,
  analyzeResult,
  importedVisibleKnowledgeItems,
  importedVisibleServiceItems,
  hasImmediateVisibleResults,
  bestIncomingProfile,
  importedProfileRows,
}) {
  const refreshedPendingKnowledge = arr(refreshResult?.snapshot?.pendingKnowledge);

  return {
    shouldOpenKnowledge:
      !barrierOnlyResult &&
      (!!analyzeResult?.shouldReview ||
        Number(analyzeResult?.candidateCount || 0) > 0 ||
        refreshedPendingKnowledge.length > 0 ||
        importedVisibleKnowledgeItems.length > 0 ||
        importedVisibleServiceItems.length > 0 ||
        s(refreshResult?.snapshot?.meta?.nextStudioStage).toLowerCase() ===
          "knowledge"),
    shouldOpenRefine:
      !barrierOnlyResult &&
      (hasImmediateVisibleResults ||
        hasMeaningfulProfile(bestIncomingProfile) ||
        importedProfileRows.length > 0),
  };
}

export function buildSetupStudioScanErrorState({
  prev,
  message,
  requestedPrimarySourceUrl,
  sourceUrl,
  uiSourceType,
  displaySourceType,
}) {
  return {
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
  };
}
