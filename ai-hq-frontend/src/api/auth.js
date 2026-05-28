// src/api/auth.js

import { apiGet, apiPost } from "./client.js";

const AUTH_ACTION_TIMEOUT_MS = 4000;
const AUTH_SESSION_TIMEOUT_MS = 10000;

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
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
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
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
  );
}

export async function verifyEmail(input) {
  const payload =
    input && typeof input === "object"
      ? input
      : {
          token: input,
        };

  return apiPost(
    "/api/auth/verify-email",
    payload,
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
  );
}

export async function resendVerificationEmail() {
  return apiPost(
    "/api/auth/resend-verification",
    {},
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
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
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
  );
}

export async function logoutUser() {
  return apiPost("/api/auth/logout", {}, {
    authProtected: false,
    timeoutMs: AUTH_ACTION_TIMEOUT_MS,
  });
}

export async function switchWorkspaceUser({ switchToken }) {
  return apiPost(
    "/api/auth/switch-workspace",
    {
      switchToken,
    },
    { timeoutMs: AUTH_ACTION_TIMEOUT_MS }
  );
}

export async function getAuthMe(options = {}) {
  return apiGet("/api/auth/me", {
    allowStatuses: [401, 503],
    timeoutMs: AUTH_SESSION_TIMEOUT_MS,
    ...options,
    authProtected: false,
  });
}

export async function getAdminAuthMe() {
  return apiGet("/api/admin-auth/me", {
    allowStatuses: [401, 503],
    authProtected: false,
    timeoutMs: AUTH_SESSION_TIMEOUT_MS,
  });
}

export async function loginAdminAuth(passcode) {
  return apiPost(
    "/api/admin-auth/login",
    { passcode },
    { authProtected: false, timeoutMs: AUTH_ACTION_TIMEOUT_MS }
  );
}

export async function logoutAdminAuth() {
  return apiPost("/api/admin-auth/logout", {}, {
    authProtected: false,
    timeoutMs: AUTH_ACTION_TIMEOUT_MS,
  });
}
