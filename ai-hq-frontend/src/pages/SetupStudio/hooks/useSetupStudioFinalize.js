import {
  finalizeCurrentSetupReview,
  patchCurrentSetupReview,
} from "../../../api/setup.js";

import { arr, s } from "../lib/setupStudioHelpers.js";
import {
  buildKnowledgeDraftItemsFromManual,
  buildServiceDraftItemsFromManual,
} from "../state/reviewState.js";
import {
  buildBusinessProfilePatch,
  buildCapabilitiesPatch,
} from "../state/profile.js";
import { compactObject } from "../logic/helpers.js";
import {
  buildReviewConcurrencyPayload,
  currentReviewConcurrencyMeta,
  parseReviewConcurrencyError,
} from "./setupStudioActionShared.js";

export function createSetupStudioFinalize(ctx, helpers) {
  const {
    currentReview,
    discoveryState,
    businessForm,
    manualSections,
    activeReviewAligned,
    activeSourceScope,
    setFreshEntryMode,
    setSavingBusiness,
    setError,
    setShowRefine,
    setShowKnowledge,
  } = ctx;

  const {
    loadCurrentReview,
    refreshAndMaybeRouteHome,
    setReviewSyncIssue,
  } = helpers;

  async function onSaveBusiness(e) {
    if (e?.preventDefault) e.preventDefault();

    try {
      setFreshEntryMode(false);
      setSavingBusiness(true);
      setError("");

      const reviewMeta = currentReviewConcurrencyMeta(
        currentReview,
        discoveryState
      );
      const concurrencyPayload = buildReviewConcurrencyPayload(reviewMeta);
      const activeSessionId = s(reviewMeta.sessionId);

      if (!activeSessionId) {
        throw new Error(
          "No active matching review session was found for this draft yet."
        );
      }

      if (!activeReviewAligned) {
        throw new Error(
          "The loaded review session does not match the active source draft. Reload review before finalizing."
        );
      }

      if (reviewMeta.conflicted || reviewMeta.stale) {
        setReviewSyncIssue(reviewMeta);
        throw new Error(
          reviewMeta.conflicted
            ? reviewMeta.message ||
                "This review session is in conflict. Reload the draft before finalizing."
            : reviewMeta.message ||
                "This review session is stale. Reload the draft before finalizing."
        );
      }

      const businessProfilePatch = buildBusinessProfilePatch({
        businessForm,
        currentReview,
        discoveryState,
      });

      const capabilitiesPatch = buildCapabilitiesPatch({
        currentReview,
        businessForm,
      });

      const mergedServices = buildServiceDraftItemsFromManual(
        manualSections.servicesText,
        arr(currentReview?.draft?.services)
      );

      const mergedKnowledgeItems = buildKnowledgeDraftItemsFromManual({
        faqsText: manualSections.faqsText,
        policiesText: manualSections.policiesText,
        existing: arr(currentReview?.draft?.knowledgeItems),
      });

      await patchCurrentSetupReview({
        ...concurrencyPayload,
        patch: {
          businessProfile: businessProfilePatch,
          capabilities: capabilitiesPatch,
          services: mergedServices,
          knowledgeItems: mergedKnowledgeItems,
        },
        metadata: compactObject({
          requestId: s(discoveryState.requestId),
        }),
      });

      await finalizeCurrentSetupReview({
        ...concurrencyPayload,
        reason: "setup_studio_finalize",
        metadata: compactObject({
          requestId: s(discoveryState.requestId),
        }),
      });

      setShowRefine(false);
      setShowKnowledge(false);

      const refreshed = await refreshAndMaybeRouteHome({
        preserveBusinessForm: false,
        hydrateReview: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      if (!refreshed?.routed) {
        await loadCurrentReview({
          preserveBusinessForm: false,
          activateReviewSession: true,
          activeSourceType: activeSourceScope.sourceType,
          activeSourceUrl: activeSourceScope.sourceUrl,
        });
      }

      return { ok: true };
    } catch (e2) {
      const reviewMeta = currentReviewConcurrencyMeta(currentReview, discoveryState);
      const issue = parseReviewConcurrencyError(e2, reviewMeta);

      if (issue.stale || issue.conflicted) {
        setReviewSyncIssue(issue);
      }

      setError(
        String(e2?.message || e2 || "The business twin could not be finalized.")
      );
      return { ok: false };
    } finally {
      setSavingBusiness(false);
    }
  }

  return { onSaveBusiness };
}
