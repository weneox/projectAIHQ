import { apiGet, apiPost } from "./client.js";

export async function getAdminAuthMe() {
  return apiGet("/api/admin-auth/me");
}

export async function loginAdminAuth(passcode) {
  return apiPost("/api/admin-auth/login", { passcode });
}

export async function logoutAdminAuth() {
  return apiPost("/api/admin-auth/logout", {});
}
 