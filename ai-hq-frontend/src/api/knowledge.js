// src/api/knowledge.js
// FINAL v1.2 — workspace knowledge API helpers with safe candidate id guard

import { apiGet, apiPost } from "./client.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function s(v, d = "") {
  return String(v ?? d).trim();
}

function buildQuery(params = {}) {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    const x = s(value);
    if (!x) continue;
    sp.set(key, x);
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function normalizeKnowledgeCandidateId(value = "") {
  const id = s(value);
  return UUID_RE.test(id) ? id : "";
}

export function getKnowledgeCandidates(filters = {}) {
  const query = buildQuery({
    status: filters.status,
    category: filters.category,
    limit: filters.limit,
  });

  return apiGet(`/api/knowledge/candidates${query}`);
}

export function approveKnowledgeCandidate(candidateId, payload = {}) {
  const safeId = normalizeKnowledgeCandidateId(candidateId);

  if (!safeId) {
    throw new Error("Knowledge candidate UUID is missing.");
  }

  return apiPost(
    `/api/knowledge/candidates/${encodeURIComponent(safeId)}/approve`,
    payload
  );
}

export function rejectKnowledgeCandidate(candidateId, payload = {}) {
  const safeId = normalizeKnowledgeCandidateId(candidateId);

  if (!safeId) {
    throw new Error("Knowledge candidate UUID is missing.");
  }

  return apiPost(
    `/api/knowledge/candidates/${encodeURIComponent(safeId)}/reject`,
    payload
  );
}