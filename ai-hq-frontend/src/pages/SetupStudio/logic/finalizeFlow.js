import { arr, s } from "../lib/setupStudioHelpers.js";
import {
  buildKnowledgeDraftItemsFromManual,
  buildServiceDraftItemsFromManual,
} from "../state/reviewState.js";
import {
  buildBusinessProfilePatch,
  buildCapabilitiesPatch,
} from "../state/profile.js";
import { compactObject } from "./helpers.js";
import {
  buildReviewConcurrencyPayload,
  currentReviewConcurrencyMeta,
  parseReviewConcurrencyError,
} from "../hooks/setupStudioActionShared.js";

export function buildSetupStudioFinalizeGuard({
  currentReview,
  discoveryState,
  activeReviewAligned,
}) {
  const reviewMeta = currentReviewConcurrencyMeta(currentReview, discoveryState);
  const concurrencyPayload = buildReviewConcurrencyPayload(reviewMeta);
  const activeSessionId = s(reviewMeta.sessionId);

  return {
    reviewMeta,
    concurrencyPayload,
    activeSessionId,
    activeReviewAligned: !!activeReviewAligned,
  };
}

export function assertSetupStudioFinalizeGuard(guard = {}, setReviewSyncIssue) {
  if (!s(guard.activeSessionId)) {
    throw new Error("No active matching review session was found for this draft yet.");
  }

  if (!guard.activeReviewAligned) {
    throw new Error(
      "The loaded review session does not match the active source draft. Reload review before finalizing."
    );
  }

  if (guard.reviewMeta?.conflicted || guard.reviewMeta?.stale) {
    if (typeof setReviewSyncIssue === "function") {
      setReviewSyncIssue(guard.reviewMeta);
    }

    throw new Error(
      guard.reviewMeta?.conflicted
        ? guard.reviewMeta?.message ||
            "This review session is in conflict. Reload the draft before finalizing."
        : guard.reviewMeta?.message ||
            "This review session is stale. Reload the draft before finalizing."
    );
  }
}

export function buildSetupStudioFinalizePatch({
  currentReview,
  discoveryState,
  businessForm,
  manualSections,
}) {
  const businessProfile = buildBusinessProfilePatch({
    businessForm,
    currentReview,
    discoveryState,
  });

  const capabilities = buildCapabilitiesPatch({
    currentReview,
    businessForm,
  });

  const services = buildServiceDraftItemsFromManual(
    manualSections.servicesText,
    arr(currentReview?.draft?.services)
  );

  const knowledgeItems = buildKnowledgeDraftItemsFromManual({
    faqsText: manualSections.faqsText,
    policiesText: manualSections.policiesText,
    existing: arr(currentReview?.draft?.knowledgeItems),
  });

  return {
    businessProfile,
    capabilities,
    services,
    knowledgeItems,
  };
}

export function buildSetupStudioFinalizeMetadata(discoveryState = {}) {
  return compactObject({
    requestId: s(discoveryState.requestId),
  });
}

export function buildSetupStudioFinalizeRequestPayloads({
  guard,
  patch,
  discoveryState,
}) {
  const metadata = buildSetupStudioFinalizeMetadata(discoveryState);

  return {
    patchPayload: {
      ...guard.concurrencyPayload,
      patch,
      metadata,
    },
    finalizePayload: {
      ...guard.concurrencyPayload,
      reason: "setup_studio_finalize",
      metadata,
    },
  };
}

export function buildSetupStudioPostFinalizeRefreshRequest(activeSourceScope = {}) {
  return {
    preserveBusinessForm: false,
    hydrateReview: true,
    activeSourceType: activeSourceScope?.sourceType || "",
    activeSourceUrl: activeSourceScope?.sourceUrl || "",
  };
}

export function buildSetupStudioPostFinalizeReviewRequest(activeSourceScope = {}) {
  return {
    preserveBusinessForm: false,
    activateReviewSession: true,
    activeSourceType: activeSourceScope?.sourceType || "",
    activeSourceUrl: activeSourceScope?.sourceUrl || "",
  };
}

export function buildSetupStudioFinalizeFailure({
  error,
  currentReview,
  discoveryState,
}) {
  const reviewMeta = currentReviewConcurrencyMeta(currentReview, discoveryState);
  const issue = parseReviewConcurrencyError(error, reviewMeta);
  const message = String(
    error?.message || error || "The business twin could not be finalized."
  );

  return {
    issue,
    message,
    shouldSyncIssue: !!(issue.stale || issue.conflicted),
  };
}
