// src/api/setupAssistant.js

import {
  apiGet,
  apiPatch,
  apiPost,
} from "./client.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    const text = s(value);
    if (!text) continue;
    q.set(key, text);
  }

  const query = q.toString();
  return query ? `?${query}` : "";
}

function normalizeAssistantResponse(payload = {}) {
  return {
    ok: payload?.ok !== false,
    schema: s(payload?.schema),
    meta: payload?.meta || {},
    assistant: payload?.assistant || {},
    turn: payload?.turn || null,
    question: payload?.question || null,
    conversationStatus: payload?.conversationStatus || null,
    primaryQuestion: payload?.primaryQuestion || null,
    followupQueue: Array.isArray(payload?.followupQueue)
      ? payload.followupQueue
      : [],
    businessFacts: payload?.businessFacts || {},
    reasoningSummary: s(payload?.reasoningSummary),
    unknowns: Array.isArray(payload?.unknowns) ? payload.unknowns : [],
    assistantHints: Array.isArray(payload?.assistantHints)
      ? payload.assistantHints
      : [],
    guardrails: Array.isArray(payload?.guardrails) ? payload.guardrails : [],
    review: payload?.review || null,
  };
}

export async function startSetupAssistantSession() {
  const payload = await apiPost("/setup/assistant/session/start", {});
  return normalizeAssistantResponse(payload);
}

export async function getCurrentSetupAssistantSession() {
  const payload = await apiGet("/setup/assistant/session/current");
  return normalizeAssistantResponse(payload);
}

export async function updateSetupAssistantDraft(body = {}) {
  const payload = await apiPatch("/setup/assistant/session/current", body || {});
  return normalizeAssistantResponse(payload);
}

export async function sendSetupAssistantMessage(body = {}) {
  const payload = await apiPost("/setup/assistant/session/current/message", body || {});
  return normalizeAssistantResponse(payload);
}

export async function getSetupAssistantTurn({
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const query = buildQuery({
    reviewSessionId,
    currentQuestionKey,
  });

  const payload = await apiGet(`/setup/assistant/turn${query}`);
  return normalizeAssistantResponse(payload);
}

export async function getSetupAssistantQuestion({
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const query = buildQuery({
    reviewSessionId,
    currentQuestionKey,
  });

  const payload = await apiGet(`/setup/assistant/question${query}`);
  return normalizeAssistantResponse(payload);
}

export async function getSetupAssistantSnapshot({
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const query = buildQuery({
    reviewSessionId,
    currentQuestionKey,
  });

  const payload = await apiGet(`/setup/assistant/snapshot${query}`);
  return normalizeAssistantResponse(payload);
}

export async function getSetupAssistantState({
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const query = buildQuery({
    reviewSessionId,
    currentQuestionKey,
  });

  const payload = await apiGet(`/setup/assistant/state${query}`);
  return normalizeAssistantResponse(payload);
}

export async function getSetupAssistant({
  mode = "turn",
  reviewSessionId = "",
  currentQuestionKey = "",
} = {}) {
  const query = buildQuery({
    mode,
    reviewSessionId,
    currentQuestionKey,
  });

  const payload = await apiGet(`/setup/assistant${query}`);
  return normalizeAssistantResponse(payload);
}

export const __test__ = {
  buildQuery,
  normalizeAssistantResponse,
};