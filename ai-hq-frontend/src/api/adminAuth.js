import { apiGet, apiPost } from "./client.js";

export async function getAdminAuthMe() {
  return apiGet("/api/admin-auth/me", {
    allowStatuses: [401, 503],
    authProtected: false,
  });
}

export async function loginAdminAuth(passcode) {
  return apiPost(
    "/api/admin-auth/login",
    { passcode },
    { authProtected: false }
  );
}

export async function logoutAdminAuth() {
  return apiPost("/api/admin-auth/logout", {}, { authProtected: false });
}
