import {
  approveKnowledgeCandidate,
  rejectKnowledgeCandidate,
} from "../../../api/knowledge.js";
import { createSetupService } from "../../../api/services.js";

import { arr, obj, s } from "../lib/setupStudioHelpers.js";
import { deriveSuggestedServicePayload } from "../state/profile.js";
import { applyUiHintsFromMeta } from "../state/shared.js";
import { resolveKnowledgeCandidateUuid } from "./setupStudioActionShared.js";

export function createSetupStudioKnowledgeActions(ctx, helpers) {
  const {
    visibleKnowledgeItems,
    discoveryForm,
    discoveryState,
    activeSourceScope,
    setFreshEntryMode,
    setActingKnowledgeId,
    setSavingServiceSuggestion,
    setError,
    setShowKnowledge,
    setShowRefine,
    pickKnowledgeCandidateId,
  } = ctx;

  const { loadCurrentReview, refreshAndMaybeRouteHome } = helpers;

  async function onApproveKnowledge(item) {
    const candidateId = resolveKnowledgeCandidateUuid({
      item,
      visibleKnowledgeItems,
      pickKnowledgeCandidateId,
    });

    if (!candidateId) {
      setError("This knowledge item did not include a review candidate UUID.");
      return { ok: false };
    }

    try {
      setFreshEntryMode(false);
      setActingKnowledgeId(candidateId);
      setError("");

      await approveKnowledgeCandidate(candidateId, {});
      await loadCurrentReview({
        preserveBusinessForm: true,
        activateReviewSession: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      const refreshed = await refreshAndMaybeRouteHome({
        preserveBusinessForm: true,
        hydrateReview: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      if (!refreshed?.routed) {
        const nextStage = s(refreshed?.snapshot?.meta?.nextStudioStage).toLowerCase();

        if (nextStage !== "knowledge") {
          setShowKnowledge(false);
        }
      }

      return { ok: true };
    } catch (e) {
      setError(String(e?.message || e || "Candidate could not be approved."));
      return { ok: false };
    } finally {
      setActingKnowledgeId("");
    }
  }

  async function onRejectKnowledge(item) {
    const candidateId = resolveKnowledgeCandidateUuid({
      item,
      visibleKnowledgeItems,
      pickKnowledgeCandidateId,
    });

    if (!candidateId) {
      setError("This knowledge item did not include a review candidate UUID.");
      return { ok: false };
    }

    try {
      setFreshEntryMode(false);
      setActingKnowledgeId(candidateId);
      setError("");

      await rejectKnowledgeCandidate(candidateId, {});
      await loadCurrentReview({
        preserveBusinessForm: true,
        activateReviewSession: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      const refreshed = await refreshAndMaybeRouteHome({
        preserveBusinessForm: true,
        hydrateReview: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      if (!refreshed?.routed) {
        const remaining = Number(
          refreshed?.snapshot?.meta?.pendingCandidateCount || 0
        );

        if (remaining <= 0) {
          setShowKnowledge(false);
        }
      }

      return { ok: true };
    } catch (e) {
      setError(String(e?.message || e || "Candidate could not be rejected."));
      return { ok: false };
    } finally {
      setActingKnowledgeId("");
    }
  }

  async function onCreateSuggestedService() {
    try {
      setFreshEntryMode(false);
      setSavingServiceSuggestion("creating");
      setError("");

      const payload = deriveSuggestedServicePayload({
        discoveryForm,
        discoveryState,
        knowledgeCandidates: visibleKnowledgeItems,
      });

      await createSetupService(payload);

      await refreshAndMaybeRouteHome({
        preserveBusinessForm: true,
        hydrateReview: true,
        activeSourceType: activeSourceScope.sourceType,
        activeSourceUrl: activeSourceScope.sourceUrl,
      });

      return { ok: true };
    } catch (e) {
      setError(
        String(e?.message || e || "Suggested service could not be created.")
      );
      return { ok: false, error: String(e?.message || e || "") };
    } finally {
      setSavingServiceSuggestion("");
    }
  }

  return {
    onApproveKnowledge,
    onRejectKnowledge,
    onCreateSuggestedService,
  };
}
