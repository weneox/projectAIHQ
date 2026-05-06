import { apiGet, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export async function getTeam({
  status = "",
  role = "",
} = {}) {
  const search = new URLSearchParams();

  if (s(status)) search.set("status", s(status));
  if (s(role)) search.set("role", s(role));

  const query = search.toString();
  return apiGet(`/api/team${query ? `?${query}` : ""}`);
}

export async function createTeamUser(payload = {}) {
  return apiPost("/api/team", payload);
}

export async function updateTeamUserStatus(id, status = "") {
  return apiPost(`/api/team/${encodeURIComponent(s(id))}/status`, {
    status,
  });
}
