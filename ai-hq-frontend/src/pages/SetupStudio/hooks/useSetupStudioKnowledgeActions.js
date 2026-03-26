import {
  approveKnowledgeCandidate,
  rejectKnowledgeCandidate,
} from "../../../api/knowledge.js";
import { createSetupService } from "../../../api/services.js";

import { deriveSuggestedServicePayload } from "../state/profile.js";
import {
  applyPostApproveKnowledgeRefresh,
  applyPostRejectKnowledgeRefresh,
  runSetupStudioKnowledgeCandidateMutation,
  runSetupStudioSuggestedServiceCreation,
} from "../logic/knowledgeActionFlow.js";

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
    pickKnowledgeCandidateId,
  } = ctx;

  const { loadCurrentReview, refreshAndMaybeRouteHome } = helpers;

  async function onApproveKnowledge(item) {
    return runSetupStudioKnowledgeCandidateMutation({
      item,
      actionLabel: "Candidate could not be approved.",
      visibleKnowledgeItems,
      pickKnowledgeCandidateId,
      activeSourceScope,
      setFreshEntryMode,
      setActingKnowledgeId,
      setError,
      loadCurrentReview,
      refreshAndMaybeRouteHome,
      mutateCandidate: (candidateId) => approveKnowledgeCandidate(candidateId, {}),
      afterRefresh: (refreshed) => {
        const nextState = applyPostApproveKnowledgeRefresh(refreshed);
        if (nextState.closeKnowledge) {
          setShowKnowledge(false);
        }
      },
    });
  }

  async function onRejectKnowledge(item) {
    return runSetupStudioKnowledgeCandidateMutation({
      item,
      actionLabel: "Candidate could not be rejected.",
      visibleKnowledgeItems,
      pickKnowledgeCandidateId,
      activeSourceScope,
      setFreshEntryMode,
      setActingKnowledgeId,
      setError,
      loadCurrentReview,
      refreshAndMaybeRouteHome,
      mutateCandidate: (candidateId) => rejectKnowledgeCandidate(candidateId, {}),
      afterRefresh: (refreshed) => {
        const nextState = applyPostRejectKnowledgeRefresh(refreshed);
        if (nextState.closeKnowledge) {
          setShowKnowledge(false);
        }
      },
    });
  }

  async function onCreateSuggestedService() {
    return runSetupStudioSuggestedServiceCreation({
      actionLabel: "Suggested service could not be created.",
      activeSourceScope,
      setFreshEntryMode,
      setSavingServiceSuggestion,
      setError,
      createService: async () => {
        const payload = deriveSuggestedServicePayload({
          discoveryForm,
          discoveryState,
          knowledgeCandidates: visibleKnowledgeItems,
        });

        await createSetupService(payload);
      },
      refreshAndMaybeRouteHome,
    });
  }

  return {
    onApproveKnowledge,
    onRejectKnowledge,
    onCreateSuggestedService,
  };
}
