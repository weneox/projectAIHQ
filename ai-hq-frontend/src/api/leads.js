import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export async function listLeads({
  q = "",
  stage = "",
  status = "",
  owner = "",
  priority = "",
  limit = 100,
} = {}) {
  const search = new URLSearchParams();

  if (s(q)) search.set("q", s(q));
  if (s(stage)) search.set("stage", s(stage));
  if (s(status)) search.set("status", s(status));
  if (s(owner)) search.set("owner", s(owner));
  if (s(priority)) search.set("priority", s(priority));
  search.set("limit", String(Math.max(1, Math.min(200, Number(limit || 100)))));

  return apiGet(`/api/leads?${search.toString()}`);
}

export async function listCustomers({
  q = "",
  stage = "",
  status = "",
  owner = "",
  priority = "",
  limit = 200,
} = {}) {
  const search = new URLSearchParams();

  if (s(q)) search.set("q", s(q));
  if (s(stage)) search.set("stage", s(stage));
  if (s(status)) search.set("status", s(status));
  if (s(owner)) search.set("owner", s(owner));
  if (s(priority)) search.set("priority", s(priority));
  search.set("limit", String(Math.max(1, Math.min(200, Number(limit || 200)))));

  return apiGet(`/api/customers?${search.toString()}`);
}


export async function getLeadByThreadId(threadId = "") {
  return apiGet(`/api/leads/by-thread/${encodeURIComponent(s(threadId))}`);
}

export async function getLeadById(id = "") {
  return apiGet(`/api/leads/${encodeURIComponent(s(id))}`);
}

export async function createLead(payload = {}) {
  return apiPost("/api/leads", payload);
}

export async function updateLead(id = "", payload = {}) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}`, payload);
}

export async function updateLeadStage(id = "", { stage = "", reason = "", actor = "operator" } = {}) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}/stage`, {
    stage,
    reason,
    actor,
  });
}

export async function updateLeadStatus(id = "", { status = "", reason = "", actor = "operator" } = {}) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}/status`, {
    status,
    reason,
    actor,
  });
}

export async function updateLeadOwner(id = "", { owner = "", actor = "operator" } = {}) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}/owner`, {
    owner,
    actor,
  });
}

export async function updateLeadFollowup(
  id = "",
  { followUpAt = "", nextAction = "", actor = "operator" } = {}
) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}/followup`, {
    followUpAt,
    nextAction,
    actor,
  });
}

export async function appendLeadNote(id = "", { note = "", actor = "operator" } = {}) {
  return apiPost(`/api/leads/${encodeURIComponent(s(id))}/note`, {
    note,
    actor,
  });
}

export async function getLeadEvents(id = "", { limit = 100 } = {}) {
  const search = new URLSearchParams();
  search.set("limit", String(Math.max(1, Math.min(500, Number(limit || 100)))));
  return apiGet(`/api/leads/${encodeURIComponent(s(id))}/events?${search.toString()}`);
}