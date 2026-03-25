// src/api/team.js
// FINAL v2.0 — team management API client (route-aligned)

import { apiGet, apiPost, apiPatch, apiDelete } from "./client.js";

function qs(params = {}) {
  const q = new URLSearchParams();

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });

  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listTeam(params = {}) {
  const j = await apiGet(`/api/team${qs(params)}`);
  if (!j?.ok) throw new Error(j?.error || "Failed to load team");
  return Array.isArray(j?.users) ? j.users : [];
}

export async function getTeamUser(id) {
  const x = encodeURIComponent(String(id || "").trim());
  if (!x) throw new Error("team user id is required");

  const j = await apiGet(`/api/team/${x}`);
  if (!j?.ok) throw new Error(j?.error || "Failed to load team user");
  return j?.user || null;
}

export async function createTeamUser(payload) {
  const j = await apiPost(`/api/team`, payload || {});
  if (!j?.ok) throw new Error(j?.error || "Failed to create team user");
  return j?.user || j;
}

export async function updateTeamUser(id, payload) {
  const x = encodeURIComponent(String(id || "").trim());
  if (!x) throw new Error("team user id is required");

  const j = await apiPatch(`/api/team/${x}`, payload || {});
  if (!j?.ok) throw new Error(j?.error || "Failed to update team user");
  return j?.user || j;
}

export async function setTeamUserStatus(id, status) {
  const x = encodeURIComponent(String(id || "").trim());
  if (!x) throw new Error("team user id is required");

  const j = await apiPost(`/api/team/${x}/status`, {
    status: String(status || "").trim().toLowerCase(),
  });

  if (!j?.ok) throw new Error(j?.error || "Failed to update team user status");
  return j?.user || j;
}

export async function deleteTeamUser(id) {
  const x = encodeURIComponent(String(id || "").trim());
  if (!x) throw new Error("team user id is required");

  const j = await apiDelete(`/api/team/${x}`);
  if (!j?.ok) throw new Error(j?.error || "Failed to delete team user");
  return j;
}