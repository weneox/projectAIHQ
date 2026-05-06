import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export async function listKnowledgeCandidates({
  status = "",
  category = "",
  limit = 100,
} = {}) {
  const search = new URLSearchParams();

  if (s(status)) search.set("status", s(status));
  if (s(category)) search.set("category", s(category));
  search.set("limit", String(Math.max(1, Math.min(200, Number(limit || 100)))));

  return apiGet(`/api/knowledge/candidates?${search.toString()}`);
}

export async function approveKnowledgeCandidate(id) {
  return apiPost(`/api/knowledge/candidates/${encodeURIComponent(s(id))}/approve`, {});
}

export async function rejectKnowledgeCandidate(id, { reason = "" } = {}) {
  return apiPost(`/api/knowledge/candidates/${encodeURIComponent(s(id))}/reject`, {
    reason,
  });
}
