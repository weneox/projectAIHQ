import { apiGet, apiPost } from "./client.js";

export async function listLeads({
  stage = "",
  status = "",
  owner = "",
  priority = "",
  q = "",
  limit = 50,
} = {}) {
  const qs = new URLSearchParams();
  if (stage) qs.set("stage", stage);
  if (status) qs.set("status", status);
  if (owner) qs.set("owner", owner);
  if (priority) qs.set("priority", priority);
  if (q) qs.set("q", q);
  qs.set("limit", String(limit));

  return apiGet(`/api/leads?${qs.toString()}`);
}

export async function getLead(id) {
  return apiGet(`/api/leads/${encodeURIComponent(id)}`);
}

export async function getLeadEvents(id, limit = 50) {
  return apiGet(
    `/api/leads/${encodeURIComponent(id)}/events?limit=${encodeURIComponent(limit)}`
  );
}

export async function updateLead(id, body) {
  return apiPost(`/api/leads/${encodeURIComponent(id)}`, body || {});
}

export async function setLeadStage(id, stage, actor = "operator", reason = "") {
  return apiPost(`/api/leads/${encodeURIComponent(id)}/stage`, {
    stage,
    actor,
    reason,
  });
}

export async function setLeadStatus(id, status, actor = "operator", reason = "") {
  return apiPost(`/api/leads/${encodeURIComponent(id)}/status`, {
    status,
    actor,
    reason,
  });
}

export async function setLeadOwner(id, owner, actor = "operator") {
  return apiPost(`/api/leads/${encodeURIComponent(id)}/owner`, {
    owner,
    actor,
  });
}

export async function setLeadFollowUp(
  id,
  { followUpAt = null, nextAction = "", actor = "operator" } = {}
) {
  return apiPost(`/api/leads/${encodeURIComponent(id)}/followup`, {
    followUpAt,
    nextAction,
    actor,
  });
}

export async function addLeadNote(id, note, actor = "operator") {
  return apiPost(`/api/leads/${encodeURIComponent(id)}/note`, {
    note,
    actor,
  });
}

export async function createLead(body) {
  return apiPost(`/api/leads`, body || {});
}
