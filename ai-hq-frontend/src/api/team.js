import { apiDelete, apiGet, apiPatch, apiPost } from "./client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizeTeamUserPayload(payload = {}) {
  const source = obj(payload);

  const userEmail = lower(
    source.user_email ||
      source.userEmail ||
      source.email ||
      source.emailAddress
  );

  const fullName = s(
    source.full_name ||
      source.fullName ||
      source.name ||
      source.display_name ||
      source.displayName
  );

  const role = lower(source.role || "operator");
  const status = lower(source.status || "invited");

  const out = {
    user_email: userEmail,
    full_name: fullName,
    role,
    status,
  };

  if (source.permissions && typeof source.permissions === "object") {
    out.permissions = source.permissions;
  }

  if (source.meta && typeof source.meta === "object") {
    out.meta = source.meta;
  }

  if (s(source.password)) {
    out.password = s(source.password);
  }

  if (typeof source.email_verified === "boolean") {
    out.email_verified = source.email_verified;
  }

  if (typeof source.emailVerified === "boolean") {
    out.email_verified = source.emailVerified;
  }

  return out;
}

export async function getTeam({ status = "", role = "" } = {}) {
  const search = new URLSearchParams();

  if (s(status)) search.set("status", s(status));
  if (s(role)) search.set("role", s(role));

  const query = search.toString();
  return apiGet(`/api/team${query ? `?${query}` : ""}`);
}

export async function getTeamUser(id) {
  return apiGet(`/api/team/${encodeURIComponent(s(id))}`);
}

export async function createTeamUser(payload = {}) {
  return apiPost("/api/team", normalizeTeamUserPayload(payload));
}

export async function updateTeamUser(id, payload = {}) {
  return apiPatch(
    `/api/team/${encodeURIComponent(s(id))}`,
    normalizeTeamUserPayload(payload)
  );
}

export async function updateTeamUserStatus(id, status = "") {
  return apiPost(`/api/team/${encodeURIComponent(s(id))}/status`, {
    status: lower(status),
  });
}

export async function updateTeamUserPassword(id, password = "") {
  return apiPost(`/api/team/${encodeURIComponent(s(id))}/password`, {
    password: s(password),
  });
}

export async function deleteTeamUser(id) {
  return apiDelete(`/api/team/${encodeURIComponent(s(id))}`);
}

export const __test__ = {
  normalizeTeamUserPayload,
};
