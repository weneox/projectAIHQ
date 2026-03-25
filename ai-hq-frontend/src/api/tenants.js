// src/api/tenants.js

import { apiGet, apiPost, apiPatch, apiDelete } from "./client.js";

function normKey(tenantKey) {
  return encodeURIComponent(String(tenantKey || "").trim().toLowerCase());
}

function ensureOk(j, fallback) {
  if (!j?.ok) throw new Error(j?.error || fallback);
  return j;
}

export async function listTenants() {
  const j = await apiGet(`/api/tenants`);
  ensureOk(j, "Failed to load tenants");
  return Array.isArray(j?.tenants) ? j.tenants : [];
}

export async function createTenant(payload) {
  const j = await apiPost(`/api/tenants`, payload);
  return ensureOk(j, "Failed to create tenant");
}

export async function getTenantByKey(tenantKey) {
  const j = await apiGet(`/api/tenants/${normKey(tenantKey)}`);
  return ensureOk(j, "Failed to load tenant");
}

export async function updateTenant(tenantKey, payload) {
  const j = await apiPatch(`/api/tenants/${normKey(tenantKey)}`, payload);
  return ensureOk(j, "Failed to update tenant");
}

export async function exportTenantJson(tenantKey) {
  const j = await apiGet(`/api/tenants/${normKey(tenantKey)}/export`);
  return ensureOk(j, "Failed to export tenant JSON");
}

export async function exportTenantCsvBundle(tenantKey) {
  const j = await apiGet(`/api/tenants/${normKey(tenantKey)}/export/csv`);
  return ensureOk(j, "Failed to export tenant CSV");
}

export async function downloadTenantZip(tenantKey) {
  const k = normKey(tenantKey);
  const base =
    String(import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "") || "";

  if (!base) {
    throw new Error("VITE_API_BASE is not set");
  }

  const url = `${base}/api/tenants/${k}/export/zip`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// --------------------------------------------------
// Admin tenant user management
// NOTE:
// These routes assume platform-admin context on backend.
// --------------------------------------------------

export async function listTenantUsers(tenantKey) {
  const j = await apiGet(`/api/tenants/${normKey(tenantKey)}/users`);
  ensureOk(j, "Failed to load tenant users");
  return Array.isArray(j?.users) ? j.users : [];
}

export async function getTenantUser(tenantKey, userId) {
  const j = await apiGet(
    `/api/tenants/${normKey(tenantKey)}/users/${encodeURIComponent(String(userId || "").trim())}`
  );
  return ensureOk(j, "Failed to load tenant user");
}

export async function createTenantUser(tenantKey, payload) {
  const j = await apiPost(`/api/tenants/${normKey(tenantKey)}/users`, payload);
  return ensureOk(j, "Failed to create tenant user");
}

export async function updateTenantUser(tenantKey, userId, payload) {
  const j = await apiPatch(
    `/api/tenants/${normKey(tenantKey)}/users/${encodeURIComponent(String(userId || "").trim())}`,
    payload
  );
  return ensureOk(j, "Failed to update tenant user");
}

export async function setTenantUserStatus(tenantKey, userId, status) {
  const j = await apiPost(
    `/api/tenants/${normKey(tenantKey)}/users/${encodeURIComponent(String(userId || "").trim())}/status`,
    { status }
  );
  return ensureOk(j, "Failed to update tenant user status");
}

export async function setTenantUserPassword(tenantKey, userId, password) {
  const j = await apiPost(
    `/api/tenants/${normKey(tenantKey)}/users/${encodeURIComponent(String(userId || "").trim())}/password`,
    { password }
  );
  return ensureOk(j, "Failed to update tenant user password");
}

export async function deleteTenantUser(tenantKey, userId) {
  const j = await apiDelete(
    `/api/tenants/${normKey(tenantKey)}/users/${encodeURIComponent(String(userId || "").trim())}`
  );
  return ensureOk(j, "Failed to delete tenant user");
}