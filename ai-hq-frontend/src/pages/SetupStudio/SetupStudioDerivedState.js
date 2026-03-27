import {
  arr,
  deriveStudioProgress,
  discoveryModeLabel,
  obj,
  profilePreviewRowsWithProvenance,
  s,
} from "./lib/setupStudioHelpers.js";
import { createEmptyReviewState, resolveMainLanguageValue } from "./state/shared.js";
import {
  deriveSuggestedServicePayload,
  extractProfileName,
  extractProfileSummary,
  hasMeaningfulProfile,
  shouldPreferCandidateCompanyName,
} from "./state/profile.js";
import {
  deriveCanonicalReviewProjection,
  deriveVisibleEvents,
  deriveVisibleKnowledgeItems,
  deriveVisibleServiceItems,
  deriveVisibleSources,
} from "./state/reviewState.js";
import { sanitizeUiIdentityText } from "./logic/helpers.js";

export function getHasStoredReview(currentReview) {
  return !!(
    s(currentReview?.session?.id) ||
    Object.keys(obj(currentReview?.draft)).length ||
    arr(currentReview?.sources).length ||
    arr(currentReview?.bundleSources).length
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
  activeSourceScope = {},
  discoveryState = {},
}) {
  const hasScopedSource = !!s(
    activeSourceScope?.sourceUrl || discoveryState?.lastUrl
  );

  if (!hasStoredReview) {
    return {
      scopedCurrentReview: activeReviewAligned
        ? currentReview
        : createEmptyReviewState(),
    };
  }

  if (hasScopedSource && !activeReviewAligned) {
    return {
      scopedCurrentReview: createEmptyReviewState(),
    };
  }

  return {
    scopedCurrentReview: currentReview,
  };
}

export function getVisibleCollections({
  freshEntryMode,
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
      currentReview: scopedCurrentReview,
      discoveryState,
    }),
    visibleServiceItems: deriveVisibleServiceItems({
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
  reviewProjection,
  discoveryState,
}) {
  if (freshEntryMode) return obj(discoveryState.profile);
  if (Object.keys(obj(reviewProjection?.overview)).length) {
    return obj(reviewProjection?.overview);
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
  reviewProjection,
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
    s(reviewProjection?.quickSummary)
  );
}

export function getEffectiveMeta({
  meta,
  visibleKnowledgeItems,
  visibleServiceItems,
  reviewProjection,
  discoveryState,
  draftBackedProfile,
  businessForm,
}) {
  const pendingVisibleCount = visibleKnowledgeItems.filter((item) => {
    const status = s(item.status).toLowerCase();
    return !status || status === "pending" || status === "review";
  }).length;

  const mergedReviewFlags = arr(reviewProjection?.reviewFlags).length
    ? arr(reviewProjection.reviewFlags)
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
        reviewProjection?.mainLanguage,
        draftBackedProfile?.mainLanguage,
        discoveryState?.mainLanguage,
        businessForm?.language
      ) || "",
    reviewRequired: !!(
      reviewProjection?.reviewRequired || discoveryState?.reviewRequired
    ),
    reviewFlags: mergedReviewFlags,
    fieldConfidence: Object.keys(obj(reviewProjection?.fieldConfidence)).length
      ? obj(reviewProjection.fieldConfidence)
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

export function getCurrentTitle({
  businessForm,
  reviewProjection,
  discoveryState,
  extractProfileName,
}) {
  const warningSet = arr(discoveryState.warnings);
  const businessName = sanitizeUiIdentityText(
    businessForm.companyName,
    warningSet
  );
  const reviewName = sanitizeUiIdentityText(
    extractProfileName(reviewProjection?.overview),
    warningSet
  );

  if (shouldPreferCandidateCompanyName(businessName, reviewName)) {
    return reviewName;
  }

  return s(businessName || reviewName);
}

export function getCurrentDescription({
  reviewProjection,
  businessForm,
  discoveryState,
  extractProfileSummary,
}) {
  return sanitizeUiIdentityText(
    reviewProjection?.quickSummary ||
      businessForm.description ||
      extractProfileSummary(reviewProjection?.overview) ||
      extractProfileSummary(discoveryState?.profile),
    arr(discoveryState.warnings)
  );
}

export function getAutoRevealKey({
  discoveryState,
  reviewProjection,
  discoveryProfileRows,
  visibleKnowledgeItems,
  visibleServiceItems,
  visibleSources,
  visibleEvents,
}) {
  return [
    s(discoveryState.requestId),
    s(discoveryState.sourceRunId),
    s(reviewProjection.sourceRunId),
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

export function getDiscoveryProfileRows(
  freshEntryMode,
  draftBackedProfile,
  reviewProjection
) {
  return freshEntryMode
    ? []
    : profilePreviewRowsWithProvenance(
        draftBackedProfile,
        reviewProjection?.fieldProvenance
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

export function getReviewProjection(currentReview) {
  return deriveCanonicalReviewProjection(currentReview);
}

export { discoveryModeLabel };
