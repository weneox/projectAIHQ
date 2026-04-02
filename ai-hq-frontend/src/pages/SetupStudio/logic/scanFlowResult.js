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
  deriveCanonicalReviewProjection,
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
}) {
  const importedReview = normalizeReviewState(reviewPayload);
  const reviewProjection = deriveCanonicalReviewProjection(importedReview);
  const reviewInfo = resolveReviewSourceInfo(importedReview);

  const effectiveSourceType = s(
    (reviewStateMatchesSource(
      importedReview,
      plan.hasImportableSource
        ? plan.requestedPrimarySourceType || plan.sourceType
        : "manual",
      plan.hasImportableSource
        ? plan.requestedPrimarySourceUrl || plan.sourceUrl
        : ""
    )
      ? reviewInfo.sourceType
      : "") ||
      analyzeResult?.sourceType ||
      plan.uiSourceType ||
      "manual"
  );

  const effectiveSourceUrl = s(
    (reviewStateMatchesSource(
      importedReview,
      plan.hasImportableSource
        ? plan.requestedPrimarySourceType || plan.sourceType
        : "manual",
      plan.hasImportableSource
        ? plan.requestedPrimarySourceUrl || plan.sourceUrl
        : ""
    )
      ? reviewInfo.sourceUrl
      : "") ||
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
      : reviewStateMatchesSource(importedReview, expectedReviewSourceType, expectedReviewSourceUrl);

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
        obj(reviewProjection?.overview),
        obj(analyzeResult?.profile)
      )
    );

  const reviewBackedProfile = obj(reviewProjection?.overview);
  const helperProfilePatch = profilePatchFromDiscovery(
    obj(analyzeResult?.profile || importResult?.profile)
  );

  const resultMetadata = {
    reviewRequired: !!(
      analyzeResult?.reviewRequired ??
      reviewProjection?.reviewRequired ??
      false
    ),
    reviewFlags: arr(
      analyzeResult?.reviewFlags || reviewProjection?.reviewFlags || []
    ),
    fieldConfidence: obj(
      analyzeResult?.fieldConfidence ||
        reviewProjection?.fieldConfidence ||
        {}
    ),
    mainLanguage:
      s(analyzeResult?.mainLanguage) ||
      s(reviewProjection?.mainLanguage) ||
      resolveMainLanguageValue(
        reviewBackedProfile?.mainLanguage,
        reviewBackedProfile?.primaryLanguage,
        reviewBackedProfile?.language
      ),
    primaryLanguage:
      s(analyzeResult?.primaryLanguage) ||
      s(reviewProjection?.primaryLanguage) ||
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
      reviewProjection?.sourceId
  );
  const sourceRunId = s(
    analyzeResult?.run?.id ||
      importResult?.run?.id ||
      reviewProjection?.sourceRunId
  );
  const snapshotId = s(
    reviewProjection?.snapshotId ||
      analyzeResult?.snapshot?.id ||
      importResult?.snapshot?.id
  );

  const scopedImportedReview =
    !barrierOnlyResult && importedReviewMatchesActiveSource
      ? importedReview
      : createEmptyReviewState();

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
      : arr(scopedImportedReview?.draft?.knowledgeItems),
    importedServices: barrierOnlyResult
      ? []
      : arr(scopedImportedReview?.draft?.services),
    mainLanguage: resultMetadata.mainLanguage,
    primaryLanguage: resultMetadata.primaryLanguage,
    reviewRequired: !!resultMetadata.reviewRequired,
    reviewFlags: arr(resultMetadata.reviewFlags),
    fieldConfidence: obj(resultMetadata.fieldConfidence),
  };

  const importedVisibleKnowledgeItems = barrierOnlyResult
    ? []
    : deriveVisibleKnowledgeItems({
        currentReview: scopedImportedReview,
        discoveryState: immediateDiscoveryState,
      });
  const importedVisibleServiceItems = barrierOnlyResult
    ? []
    : deriveVisibleServiceItems({
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
      : arr(scopedImportedReview?.draft?.knowledgeItems),
    importedServices: barrierOnlyResult
      ? []
      : arr(scopedImportedReview?.draft?.services),
    mainLanguage: immediateDiscoveryState.mainLanguage,
    primaryLanguage: immediateDiscoveryState.primaryLanguage,
    reviewRequired: immediateDiscoveryState.reviewRequired,
    reviewFlags: arr(immediateDiscoveryState.reviewFlags),
    fieldConfidence: obj(immediateDiscoveryState.fieldConfidence),
  };

  return {
    importedReview,
    reviewProjection,
    effectiveSourceType,
    effectiveSourceUrl,
    importedReviewMatchesActiveSource,
    combinedWarnings,
    barrierOnlyResult,
    resultMetadata,
    bestIncomingProfile,
    scopedImportedReview,
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
  reviewProjection,
  hasImportableSource,
  importedReviewMatchesActiveSource,
}) {
  return {
    sessionId: s(importedReview?.session?.id || reviewProjection?.reviewSessionId),
    sessionStatus: s(
      importedReview?.session?.status || reviewProjection?.reviewSessionStatus
    ),
    revision: s(
      importedReview?.session?.revision || reviewProjection?.reviewSessionRevision
    ),
    freshness:
      hasImportableSource && !importedReviewMatchesActiveSource
        ? "source_mismatch"
        : s(
            importedReview?.session?.freshness ||
              reviewProjection?.reviewFreshness ||
              "unknown"
          ),
    message:
      hasImportableSource && !importedReviewMatchesActiveSource
        ? "The backend review session did not match this source yet, so editing remains isolated."
        : s(reviewProjection?.reviewConflictMessage),
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
          ["knowledge", "review", "confirm"].includes(
            s(refreshResult?.snapshot?.meta?.nextStudioStage).toLowerCase()
          )),
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
