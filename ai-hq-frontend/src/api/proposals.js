// src/api/proposals.js
// FINAL v2.2 — publish/approve/analyze support

import { apiGet, apiPost } from "./client.js";

function mapUiStatusToBackend(status) {
  const s = String(status || "").trim().toLowerCase();

  if (s === "draft") return "draft";
  if (s === "pending") return "pending";
  if (s === "in_progress") return "in_progress";
  if (s === "approved") return "approved";
  if (s === "published") return "published";
  if (s === "rejected") return "rejected";

  return "draft";
}

export async function listProposals(status = "draft") {
  const backendStatus = mapUiStatusToBackend(status);
  const s = encodeURIComponent(backendStatus);

  const j = await apiGet(`/api/proposals?status=${s}&includeContent=1&includePack=1`);

  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.proposals)) return j.proposals;
  return [];
}

export async function decideProposal(id, decision, reason) {
  const pid = encodeURIComponent(String(id));
  return apiPost(`/api/proposals/${pid}/decision`, {
    decision,
    reason: String(reason || ""),
  });
}

export async function requestDraftChanges(_proposalId, contentId, feedback) {
  const did = encodeURIComponent(String(contentId));
  const fb = String(feedback || "").trim();

  const j = await apiPost(`/api/content/${did}/feedback`, {
    feedbackText: fb,
  });

  return {
    ok: !!j?.ok,
    content: j?.content || null,
    jobId: j?.jobId || j?.job_id || null,
    error: j?.ok ? null : j?.error || "feedback failed",
  };
}

export async function approveDraft(_proposalId, contentId) {
  const did = encodeURIComponent(String(contentId));

  const j = await apiPost(`/api/content/${did}/approve`, {});

  return {
    ok: !!j?.ok,
    content: j?.content || null,
    jobId: j?.jobId || j?.job_id || null,
    note: j?.note || null,
    error: j?.ok ? null : j?.error || "approve failed",
  };
}

export async function rejectDraft(proposalId, _contentId, reason) {
  const pid = encodeURIComponent(String(proposalId));
  const r = String(reason || "").trim();

  return apiPost(`/api/proposals/${pid}/decision`, {
    decision: "rejected",
    reason: r,
  });
}

export async function analyzeDraft(_proposalId, contentId) {
  const did = encodeURIComponent(String(contentId));

  const j = await apiPost(`/api/content/${did}/analyze`, {});

  return {
    ok: !!j?.ok,
    content: j?.content || null,
    analysis: j?.analysis || null,
    error: j?.ok ? null : j?.error || "analyze failed",
    details: j?.details || null,
  };
}

export async function publishDraft(_proposalId, contentId) {
  const did = encodeURIComponent(String(contentId));

  const j = await apiPost(`/api/content/${did}/publish`, {});

  return {
    ok: !!j?.ok,
    content: j?.content || null,
    proposal: j?.proposal || null,
    contentId: j?.contentId || j?.content_id || null,
    jobId: j?.jobId || j?.job_id || null,
    note: j?.note || null,
    error: j?.ok ? null : j?.error || "publish failed",
  };
}