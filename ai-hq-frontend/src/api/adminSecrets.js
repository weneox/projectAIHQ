import { apiDelete, apiGet, apiPost } from "./client.js";

export async function getAdminSecrets(provider = "") {
  const p = String(provider || "").trim().toLowerCase();
  const path = p
    ? `/api/settings/secrets?provider=${encodeURIComponent(p)}`
    : `/api/settings/secrets`;

  const j = await apiGet(path);
  if (!j?.ok) throw new Error(j?.error || "Failed to load secrets");
  return Array.isArray(j?.secrets) ? j.secrets : [];
}

export async function saveAdminSecret(provider, secretKey, value) {
  const p = encodeURIComponent(String(provider || "").trim().toLowerCase());
  const k = encodeURIComponent(String(secretKey || "").trim().toLowerCase());

  const j = await apiPost(`/api/settings/secrets/${p}/${k}`, { value });
  if (!j?.ok) throw new Error(j?.error || "Failed to save secret");
  return j?.secret || j;
}

export async function deleteAdminSecret(provider, secretKey) {
  const p = encodeURIComponent(String(provider || "").trim().toLowerCase());
  const k = encodeURIComponent(String(secretKey || "").trim().toLowerCase());
  const j = await apiDelete(`/api/settings/secrets/${p}/${k}`);

  if (!j?.ok) throw new Error(j?.error || "Failed to delete secret");
  return j;
}
