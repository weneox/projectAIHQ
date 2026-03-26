import { apiGet } from "./client.js";

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const raw = search.toString();
  return raw ? `?${raw}` : "";
}

export async function listRuntimeIncidents(params = {}) {
  return apiGet(`/api/incidents${qs(params)}`);
}
