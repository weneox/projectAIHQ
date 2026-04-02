// src/api/auth.js

import { apiGet, apiPost } from "./client.js";

const AUTH_TIMEOUT_MS = 4000;

export async function loginUser({
  email,
  password,
  tenantKey,
  accountSelectionToken,
}) {
  return apiPost(
    "/api/auth/login",
    {
      email,
      password,
      tenantKey,
      accountSelectionToken,
    },
    { timeoutMs: AUTH_TIMEOUT_MS }
  );
}

export async function signupUser({
  fullName,
  companyName,
  email,
  password,
  tenantKey,
  websiteUrl,
}) {
  return apiPost(
    "/api/auth/signup",
    {
      fullName,
      companyName,
      email,
      password,
      tenantKey,
      websiteUrl,
    },
    { timeoutMs: AUTH_TIMEOUT_MS }
  );
}

export async function selectWorkspaceUser({
  email,
  password,
  tenantKey,
  accountSelectionToken,
}) {
  return apiPost(
    "/api/auth/select-workspace",
    {
      email,
      password,
      tenantKey,
      accountSelectionToken,
    },
    { timeoutMs: AUTH_TIMEOUT_MS }
  );
}

export async function logoutUser() {
  return apiPost("/api/auth/logout", {}, { timeoutMs: AUTH_TIMEOUT_MS });
}

export async function switchWorkspaceUser({ switchToken }) {
  return apiPost(
    "/api/auth/switch-workspace",
    {
      switchToken,
    },
    { timeoutMs: AUTH_TIMEOUT_MS }
  );
}

export async function getAuthMe(options = {}) {
  return apiGet("/api/auth/me", {
    allowStatuses: [401],
    timeoutMs: AUTH_TIMEOUT_MS,
    ...options,
  });
}

export async function getAdminAuthMe() {
  return apiGet("/api/admin-auth/me", { timeoutMs: AUTH_TIMEOUT_MS });
}

export async function loginAdminAuth(passcode) {
  return apiPost(
    "/api/admin-auth/login",
    { passcode },
    { timeoutMs: AUTH_TIMEOUT_MS }
  );
}

export async function logoutAdminAuth() {
  return apiPost("/api/admin-auth/logout", {}, { timeoutMs: AUTH_TIMEOUT_MS });
}