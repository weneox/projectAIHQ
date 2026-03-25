// src/api/inbox.js

import { apiGet, apiPost } from "./client.js";

function q(params = {}) {
  const usp = new URLSearchParams();

  for (const [k, v] of Object.entries(params || {})) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    usp.set(k, s);
  }

  const out = usp.toString();
  return out ? `?${out}` : "";
}

export async function listInboxThreads(params = {}) {
  return apiGet(`/api/inbox/threads${q(params)}`);
}

export async function getInboxThread(threadId) {
  return apiGet(`/api/inbox/threads/${encodeURIComponent(threadId)}`);
}

export async function listInboxMessages(threadId, params = {}) {
  return apiGet(
    `/api/inbox/threads/${encodeURIComponent(threadId)}/messages${q(params)}`
  );
}

export async function markInboxThreadRead(threadId) {
  return apiPost(`/api/inbox/threads/${encodeURIComponent(threadId)}/read`, {});
}

export async function assignInboxThread(threadId, payload = {}) {
  return apiPost(`/api/inbox/threads/${encodeURIComponent(threadId)}/assign`, payload);
}

export async function activateInboxHandoff(threadId, payload = {}) {
  return apiPost(
    `/api/inbox/threads/${encodeURIComponent(threadId)}/handoff/activate`,
    payload
  );
}

export async function releaseInboxHandoff(threadId, payload = {}) {
  return apiPost(
    `/api/inbox/threads/${encodeURIComponent(threadId)}/handoff/release`,
    payload
  );
}

export async function changeInboxThreadStatus(threadId, payload = {}) {
  return apiPost(
    `/api/inbox/threads/${encodeURIComponent(threadId)}/status`,
    payload
  );
}

export async function listThreadOutboundAttempts(threadId, params = {}) {
  return apiGet(
    `/api/inbox/threads/${encodeURIComponent(threadId)}/outbound-attempts${q(params)}`
  );
}

export async function getOutboundSummary(params = {}) {
  return apiGet(`/api/inbox/outbound/summary${q(params)}`);
}

export async function listFailedOutboundAttempts(params = {}) {
  return apiGet(`/api/inbox/outbound/failed${q(params)}`);
}

export async function resendOutboundAttempt(attemptId, payload = {}) {
  return apiPost(
    `/api/inbox/outbound/${encodeURIComponent(attemptId)}/resend`,
    payload
  );
}

export async function markOutboundAttemptDead(attemptId, payload = {}) {
  return apiPost(
    `/api/inbox/outbound/${encodeURIComponent(attemptId)}/mark-dead`,
    payload
  );
}