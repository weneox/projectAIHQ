import {
  arr,
  deriveStudioProgress,
  discoveryModeLabel,
  obj,
  profilePreviewRowsWithProvenance,
  s,
} from "./lib/setupStudioHelpers.js";
import {
  createEmptyLegacyDraft,
  createEmptyReviewState,
  resolveMainLanguageValue,
} from "./state/shared.js";
import {
  deriveSuggestedServicePayload,
  extractProfileName,
  extractProfileSummary,
  hasMeaningfulProfile,
  shouldPreferCandidateCompanyName,
} from "./state/profile.js";
import {
  deriveVisibleEvents,
  deriveVisibleKnowledgeItems,
  deriveVisibleServiceItems,
  deriveVisibleSources,
} from "./state/reviewState.js";
import { sanitizeUiIdentityText } from "./logic/helpers.js";

export function getHasStoredReview(currentReview, reviewDraft) {
  return !!(
    s(currentReview?.session?.id) ||
    Object.keys(obj(currentReview?.draft)).length ||
    arr(currentReview?.sources).length ||
    arr(currentReview?.bundleSources).length ||
    s(reviewDraft?.quickSummary) ||
    Object.keys(obj(reviewDraft?.overview)).length
  );
}

export function getReviewSyncState({
  currentReview,
  discoveryState,
  freshEntryMode,
  activeReviewAligned,
  activeSourceScope,
}) {
  const session = obj(currentReview?.session);
  const sessionId = s(
    session.id || session.sessionId || discoveryState.reviewSessionId
  );
  const revision = s(
    session.revision ||
      session.reviewRevision ||
      session.version ||
      session.etag ||
      discoveryState.reviewSessionRevision
  );
  const freshness = s(
    session.freshness || discoveryState.reviewFreshness || "unknown"
  );
  const stale = !!(
    session.stale ||
    session.isStale ||
    discoveryState.reviewStale ||
    freshness === "stale"
  );
  const conflicted = !!(
    session.conflicted ||
    session.conflict ||
    discoveryState.reviewConflicted ||
    freshness === "conflict"
  );
  const hasSession = !!sessionId;
  const hasReviewContent = !!(
    hasSession ||
    Object.keys(obj(currentReview?.draft)).length ||
    arr(currentReview?.sources).length ||
    arr(currentReview?.bundleSources).length
  );
  const sourceMismatch =
    !freshEntryMode &&
    hasReviewContent &&
    !activeReviewAligned &&
    !!s(activeSourceScope.sourceUrl || discoveryState.lastUrl);

  let message = s(session.conflictMessage || discoveryState.reviewConflictMessage);

  if (!message && conflicted) {
    message = "This review session is in conflict. Reload before finalizing.";
  } else if (!message && stale) {
    message = "This review session is stale. Reload before finalizing.";
  } else if (!message && sourceMismatch) {
    message =
      "A review session exists, but it does not match the active source draft.";
  } else if (!message && hasSession && !revision) {
    message =
      "Review session revision metadata is missing, so finalize remains backward-compatible but not concurrency-guaranteed.";
  }

  let level = "idle";
  if (conflicted) level = "conflict";
  else if (stale) level = "stale";
  else if (sourceMismatch) level = "mismatch";
  else if (hasSession && !revision) level = "unverified";
  else if (hasSession) level = "ready";

  return {
    level,
    sessionId,
    revision,
    freshness,
    stale,
    conflicted,
    sourceMismatch,
    hasSession,
    message,
    blocksFinalize: conflicted || stale || sourceMismatch,
  };
}

export function getScopedReviewState({
  hasStoredReview,
  activeReviewAligned,
  currentReview,
  reviewDraft,
}) {
  return {
    scopedCurrentReview:
      hasStoredReview
        ? currentReview
        : !activeReviewAligned
          ? createEmptyReviewState()
          : currentReview,
    scopedReviewDraft:
      hasStoredReview
        ? reviewDraft
        : !activeReviewAligned
          ? createEmptyLegacyDraft()
          : reviewDraft,
  };
}

export function getVisibleCollections({
  freshEntryMode,
  scopedReviewDraft,
  scopedCurrentReview,
  discoveryState,
}) {
  if (freshEntryMode) {
    return {
      visibleKnowledgeItems: [],
      visibleServiceItems: [],
      visibleSources: [],
      visibleEvents: [],
    };
  }

  return {
    visibleKnowledgeItems: deriveVisibleKnowledgeItems({
      reviewDraft: scopedReviewDraft,
      currentReview: scopedCurrentReview,
      discoveryState,
    }),
    visibleServiceItems: deriveVisibleServiceItems({
      reviewDraft: scopedReviewDraft,
      currentReview: scopedCurrentReview,
      discoveryState,
    }),
    visibleSources: deriveVisibleSources({
      currentReview: scopedCurrentReview,
      discoveryState,
    }),
    visibleEvents: deriveVisibleEvents(scopedCurrentReview),
  };
}

export function getDraftBackedProfile({
  freshEntryMode,
  scopedReviewDraft,
  discoveryState,
}) {
  if (freshEntryMode) return obj(discoveryState.profile);
  if (Object.keys(obj(scopedReviewDraft?.overview)).length) {
    return obj(scopedReviewDraft?.overview);
  }
  return obj(discoveryState.profile);
}

export function getHasVisibleResults({
  freshEntryMode,
  draftBackedProfile,
  discoveryProfileRows,
  visibleKnowledgeItems,
  visibleServiceItems,
  visibleSources,
  visibleEvents,
  discoveryState,
  scopedReviewDraft,
}) {
  if (freshEntryMode) return false;

  return !!(
    hasMeaningfulProfile(draftBackedProfile) ||
    discoveryProfileRows.length > 0 ||
    visibleKnowledgeItems.length > 0 ||
    visibleServiceItems.length > 0 ||
    visibleSources.length > 0 ||
    visibleEvents.length > 0 ||
    arr(discoveryState?.warnings).length > 0 ||
    arr(discoveryState?.reviewFlags).length > 0 ||
    s(scopedReviewDraft?.quickSummary)
  );
}

export function getEffectiveMeta({
  meta,
  visibleKnowledgeItems,
  visibleServiceItems,
  scopedReviewDraft,
  discoveryState,
  draftBackedProfile,
  businessForm,
}) {
  const pendingVisibleCount = visibleKnowledgeItems.filter((item) => {
    const status = s(item.status).toLowerCase();
    return !status || status === "pending" || status === "review";
  }).length;

  const mergedReviewFlags = arr(scopedReviewDraft?.reviewFlags).length
    ? arr(scopedReviewDraft.reviewFlags)
    : arr(discoveryState.reviewFlags);

  return {
    ...meta,
    pendingCandidateCount: Math.max(
      Number(meta.pendingCandidateCount || 0),
      pendingVisibleCount
    ),
    serviceCount: Math.max(
      Number(meta.serviceCount || 0),
      visibleServiceItems.length
    ),
    mainLanguage:
      resolveMainLanguageValue(
        scopedReviewDraft?.mainLanguage,
        draftBackedProfile?.mainLanguage,
        discoveryState?.mainLanguage,
        businessForm?.language
      ) || "",
    reviewRequired: !!(
      scopedReviewDraft?.reviewRequired || discoveryState?.reviewRequired
    ),
    reviewFlags: mergedReviewFlags,
    fieldConfidence: Object.keys(obj(scopedReviewDraft?.fieldConfidence)).length
      ? obj(scopedReviewDraft.fieldConfidence)
      : obj(discoveryState.fieldConfidence),
  };
}

export function getStudioProgress({ importingWebsite, discoveryState, effectiveMeta }) {
  const derived = obj(
    deriveStudioProgress({
      importingWebsite,
      discoveryState,
      meta: effectiveMeta,
    })
  );

  return {
    ...derived,
    readinessScore: Number(
      effectiveMeta.readinessScore || derived.readinessScore || 0
    ),
    readinessLabel: s(effectiveMeta.readinessLabel || derived.readinessLabel),
    missingSteps: arr(effectiveMeta.missingSteps).length
      ? arr(effectiveMeta.missingSteps)
      : arr(derived.missingSteps),
    primaryMissingStep: s(
      effectiveMeta.primaryMissingStep || derived.primaryMissingStep
    ),
    nextRoute: s(effectiveMeta.nextRoute || derived.nextRoute || "/"),
    nextSetupRoute: s(
      effectiveMeta.nextSetupRoute || derived.nextSetupRoute || "/setup/studio"
    ),
    nextStudioStage: s(effectiveMeta.nextStudioStage || ""),
    setupCompleted: !!(effectiveMeta.setupCompleted ?? derived.setupCompleted),
  };
}

export function getKnowledgePreview(visibleKnowledgeItems, pickKnowledgeRowId, pickKnowledgeCandidateId) {
  return visibleKnowledgeItems.slice(0, 6).map((item, index) => ({
    ...item,
    id: pickKnowledgeRowId(item, `knowledge-${index + 1}`),
    rowId: pickKnowledgeRowId(item, `knowledge-${index + 1}`),
    candidateId: pickKnowledgeCandidateId(item),
    title: s(item.title),
    value: s(item.valueText || item.value),
    category: s(item.category),
    source: s(item.source || item.sourceType),
    confidence:
      typeof item.confidence === "number"
        ? item.confidence
        : Number(item.confidence || 0) || 0,
    status: s(item.status || "pending"),
    evidenceUrl: s(item.evidenceUrl),
  }));
}

export function getCurrentTitle({ businessForm, scopedReviewDraft, discoveryState, extractProfileName }) {
  const warningSet = arr(discoveryState.warnings);
  const businessName = sanitizeUiIdentityText(
    businessForm.companyName,
    warningSet
  );
  const reviewName = sanitizeUiIdentityText(
    extractProfileName(scopedReviewDraft?.overview),
    warningSet
  );

  if (shouldPreferCandidateCompanyName(businessName, reviewName)) {
    return reviewName;
  }

  return s(businessName || reviewName);
}

export function getCurrentDescription({
  scopedReviewDraft,
  businessForm,
  discoveryState,
  extractProfileSummary,
}) {
  return sanitizeUiIdentityText(
    scopedReviewDraft?.quickSummary ||
      businessForm.description ||
      extractProfileSummary(scopedReviewDraft?.overview) ||
      extractProfileSummary(discoveryState?.profile),
    arr(discoveryState.warnings)
  );
}

export function getAutoRevealKey({
  discoveryState,
  scopedReviewDraft,
  discoveryProfileRows,
  visibleKnowledgeItems,
  visibleServiceItems,
  visibleSources,
  visibleEvents,
}) {
  return [
    s(discoveryState.requestId),
    s(discoveryState.sourceRunId),
    s(scopedReviewDraft.sourceRunId),
    String(discoveryProfileRows.length),
    String(visibleKnowledgeItems.length),
    String(visibleServiceItems.length),
    String(visibleSources.length),
    String(visibleEvents.length),
    s(discoveryState.mode),
    s(discoveryState.mainLanguage),
    String(arr(discoveryState.reviewFlags).length),
    s(discoveryState.lastSourceType),
  ]
    .filter(Boolean)
    .join("|");
}

export function getDiscoveryProfileRows(freshEntryMode, draftBackedProfile, scopedReviewDraft) {
  return freshEntryMode
    ? []
    : profilePreviewRowsWithProvenance(
        draftBackedProfile,
        scopedReviewDraft?.fieldProvenance
      );
}

export function getServiceSuggestionTitle(discoveryForm, discoveryState, visibleKnowledgeItems) {
  const derived = deriveSuggestedServicePayload({
    discoveryForm,
    discoveryState,
    knowledgeCandidates: visibleKnowledgeItems,
  });
  return s(derived.title);
}

export { discoveryModeLabel };
