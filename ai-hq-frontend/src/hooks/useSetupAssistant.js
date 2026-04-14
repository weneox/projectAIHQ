import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  getCurrentSetupAssistantSession,
  getSetupAssistantQuestion,
  getSetupAssistantSnapshot,
  getSetupAssistantState,
  getSetupAssistantTurn,
  sendSetupAssistantMessage,
  startSetupAssistantSession,
  updateSetupAssistantDraft,
} from "../api/setupAssistant.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function normalizeAssistantData(payload = {}) {
  return {
    ok: payload?.ok !== false,
    schema: s(payload?.schema),
    meta: obj(payload?.meta),
    assistant: obj(payload?.assistant),
    turn: payload?.turn || null,
    question: payload?.question || null,
    conversationStatus: payload?.conversationStatus || null,
    primaryQuestion: payload?.primaryQuestion || null,
    followupQueue: arr(payload?.followupQueue),
    businessFacts: obj(payload?.businessFacts),
    reasoningSummary: s(payload?.reasoningSummary),
    unknowns: arr(payload?.unknowns),
    assistantHints: arr(payload?.assistantHints),
    guardrails: arr(payload?.guardrails),
    review: payload?.review || null,
  };
}

export function buildSetupAssistantQueryKey({
  mode = "turn",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  return [
    "setup-assistant",
    s(mode || "turn"),
    s(reviewSessionId),
    s(currentQuestionKey),
  ];
}

export function useSetupAssistant({
  enabled = true,
  mode = "turn",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const queryClient = useQueryClient();
  const [localQuestionKey, setLocalQuestionKey] = useState(
    s(currentQuestionKey)
  );

  const safeMode = useMemo(() => {
    const value = s(mode || "turn").toLowerCase();
    if (["turn", "question", "snapshot", "state"].includes(value)) return value;
    return "turn";
  }, [mode]);

  const safeReviewSessionId = s(reviewSessionId);
  const safeCurrentQuestionKey = s(localQuestionKey || currentQuestionKey);

  const queryKey = useMemo(
    () =>
      buildSetupAssistantQueryKey({
        mode: safeMode,
        reviewSessionId: safeReviewSessionId,
        currentQuestionKey: safeCurrentQuestionKey,
      }),
    [safeMode, safeReviewSessionId, safeCurrentQuestionKey]
  );

  const queryFn = useCallback(async () => {
    if (safeMode === "question") {
      return normalizeAssistantData(
        await getSetupAssistantQuestion({
          reviewSessionId: safeReviewSessionId,
          currentQuestionKey: safeCurrentQuestionKey,
        })
      );
    }

    if (safeMode === "snapshot") {
      return normalizeAssistantData(
        await getSetupAssistantSnapshot({
          reviewSessionId: safeReviewSessionId,
          currentQuestionKey: safeCurrentQuestionKey,
        })
      );
    }

    if (safeMode === "state") {
      return normalizeAssistantData(
        await getSetupAssistantState({
          reviewSessionId: safeReviewSessionId,
          currentQuestionKey: safeCurrentQuestionKey,
        })
      );
    }

    return normalizeAssistantData(
      await getSetupAssistantTurn({
        reviewSessionId: safeReviewSessionId,
        currentQuestionKey: safeCurrentQuestionKey,
      })
    );
  }, [safeMode, safeReviewSessionId, safeCurrentQuestionKey]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: 10_000,
  });

  const refresh = useCallback(async () => {
    return queryClient.invalidateQueries({
      queryKey: ["setup-assistant"],
    });
  }, [queryClient]);

  const startSessionMutation = useMutation({
    mutationFn: async () =>
      normalizeAssistantData(await startSetupAssistantSession()),
    onSuccess: async () => {
      await refresh();
    },
  });

  const currentSessionQuery = useQuery({
    queryKey: ["setup-assistant-session", "current"],
    queryFn: async () =>
      normalizeAssistantData(await getCurrentSetupAssistantSession()),
    enabled,
    staleTime: 10_000,
  });

  const updateDraftMutation = useMutation({
    mutationFn: async (body = {}) =>
      normalizeAssistantData(await updateSetupAssistantDraft(body)),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: ["setup-assistant-session", "current"],
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (body = {}) =>
      normalizeAssistantData(await sendSetupAssistantMessage(body)),
    onSuccess: async (payload) => {
      const nextQuestionKey =
        s(payload?.assistant?.questionEnvelope?.questionKey) ||
        s(payload?.primaryQuestion?.key) ||
        s(payload?.question?.questionKey);

      if (nextQuestionKey) {
        setLocalQuestionKey(nextQuestionKey);
      }

      await refresh();
      await queryClient.invalidateQueries({
        queryKey: ["setup-assistant-session", "current"],
      });
    },
  });

  const setQuestionKey = useCallback((value = "") => {
    setLocalQuestionKey(s(value));
  }, []);

  return {
    ...query,
    data: normalizeAssistantData(query.data || {}),
    queryKey,

    currentSession: normalizeAssistantData(currentSessionQuery.data || {}),
    currentSessionQuery,

    startSession: startSessionMutation.mutateAsync,
    startSessionMutation,

    updateDraft: updateDraftMutation.mutateAsync,
    updateDraftMutation,

    sendMessage: sendMessageMutation.mutateAsync,
    sendMessageMutation,

    refresh,
    setQuestionKey,
    currentQuestionKey: safeCurrentQuestionKey,
  };
}

export const __test__ = {
  buildSetupAssistantQueryKey,
  normalizeAssistantData,
};