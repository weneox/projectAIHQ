// src/api/auth.js

import { apiGet, apiPost } from "./client.js";

export async function loginUser({
  email,
  password,
  tenantKey,
  accountSelectionToken,
}) {
  return apiPost("/api/auth/login", {
    email,
    password,
    tenantKey,
    accountSelectionToken,
  });
}

export async function selectWorkspaceUser({
  email,
  password,
  tenantKey,
  accountSelectionToken,
}) {
  return apiPost("/api/auth/select-workspace", {
    email,
    password,
    tenantKey,
    accountSelectionToken,
  });
}

export async function logoutUser() {
  return apiPost("/api/auth/logout", {});
}

export async function getAuthMe() {
  return apiGet("/api/auth/me", {
    allowStatuses: [401],
  });
}

export async function getAdminAuthMe() {
  return apiGet("/api/admin-auth/me");
}

export async function loginAdminAuth(passcode) {
  return apiPost("/api/admin-auth/login", { passcode });
}

export async function logoutAdminAuth() {
  return apiPost("/api/admin-auth/logout", {});
}
