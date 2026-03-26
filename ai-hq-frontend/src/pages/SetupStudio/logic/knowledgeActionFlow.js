import { s } from "../lib/setupStudioHelpers.js";
import { resolveKnowledgeCandidateUuid } from "../hooks/setupStudioActionShared.js";

export function buildSetupStudioKnowledgeReviewRequest(activeSourceScope = {}) {
  return {
    preserveBusinessForm: true,
    activateReviewSession: true,
    activeSourceType: activeSourceScope?.sourceType || "",
    activeSourceUrl: activeSourceScope?.sourceUrl || "",
  };
}

export function buildSetupStudioKnowledgeRefreshRequest(activeSourceScope = {}) {
  return {
    preserveBusinessForm: true,
    hydrateReview: true,
    activeSourceType: activeSourceScope?.sourceType || "",
    activeSourceUrl: activeSourceScope?.sourceUrl || "",
  };
}

export function resolveSetupStudioKnowledgeCandidateAction({
  item,
  visibleKnowledgeItems,
  pickKnowledgeCandidateId,
}) {
  const candidateId = resolveKnowledgeCandidateUuid({
    item,
    visibleKnowledgeItems,
    pickKnowledgeCandidateId,
  });

  if (!candidateId) {
    return {
      ok: false,
      candidateId: "",
      error: "This knowledge item did not include a review candidate UUID.",
    };
  }

  return {
    ok: true,
    candidateId,
    error: "",
  };
}

export function applyPostApproveKnowledgeRefresh(refreshed = {}) {
  const nextStage = s(refreshed?.snapshot?.meta?.nextStudioStage).toLowerCase();
  return {
    closeKnowledge: nextStage !== "knowledge",
  };
}

export function applyPostRejectKnowledgeRefresh(refreshed = {}) {
  const remaining = Number(refreshed?.snapshot?.meta?.pendingCandidateCount || 0);
  return {
    closeKnowledge: remaining <= 0,
  };
}

export function buildSetupStudioKnowledgeMutationError(actionLabel, error) {
  return String(error?.message || error || `${actionLabel} could not be completed.`);
}

export async function runSetupStudioKnowledgeCandidateMutation({
  item,
  actionLabel,
  visibleKnowledgeItems,
  pickKnowledgeCandidateId,
  activeSourceScope,
  setFreshEntryMode,
  setActingKnowledgeId,
  setError,
  loadCurrentReview,
  refreshAndMaybeRouteHome,
  mutateCandidate,
  afterRefresh,
}) {
  const resolution = resolveSetupStudioKnowledgeCandidateAction({
    item,
    visibleKnowledgeItems,
    pickKnowledgeCandidateId,
  });

  if (!resolution.ok) {
    setError(resolution.error);
    return { ok: false };
  }

  try {
    setFreshEntryMode(false);
    setActingKnowledgeId(resolution.candidateId);
    setError("");

    await mutateCandidate(resolution.candidateId);
    await loadCurrentReview(
      buildSetupStudioKnowledgeReviewRequest(activeSourceScope)
    );

    const refreshed = await refreshAndMaybeRouteHome(
      buildSetupStudioKnowledgeRefreshRequest(activeSourceScope)
    );

    if (!refreshed?.routed && typeof afterRefresh === "function") {
      afterRefresh(refreshed);
    }

    return { ok: true };
  } catch (error) {
    setError(buildSetupStudioKnowledgeMutationError(actionLabel, error));
    return { ok: false };
  } finally {
    setActingKnowledgeId("");
  }
}

export async function runSetupStudioSuggestedServiceCreation({
  actionLabel,
  activeSourceScope,
  setFreshEntryMode,
  setSavingServiceSuggestion,
  setError,
  createService,
  refreshAndMaybeRouteHome,
}) {
  try {
    setFreshEntryMode(false);
    setSavingServiceSuggestion("creating");
    setError("");

    await createService();
    await refreshAndMaybeRouteHome(
      buildSetupStudioKnowledgeRefreshRequest(activeSourceScope)
    );

    return { ok: true };
  } catch (error) {
    const message = buildSetupStudioKnowledgeMutationError(actionLabel, error);
    setError(message);
    return { ok: false, error: message };
  } finally {
    setSavingServiceSuggestion("");
  }
}
