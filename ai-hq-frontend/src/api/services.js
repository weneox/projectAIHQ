// src/api/services.js
// FINAL v1.1

import { apiDelete, apiGet, apiPost, apiPut } from "./client.js";

export function getSetupServices() {
  return apiGet("/api/setup/services");
}

export function createSetupService(payload = {}) {
  return apiPost("/api/setup/services", payload);
}

export function updateSetupService(serviceId, payload = {}) {
  return apiPut(`/api/setup/services/${encodeURIComponent(serviceId)}`, payload);
}

export function deleteSetupService(serviceId) {
  return apiDelete(`/api/setup/services/${encodeURIComponent(serviceId)}`);
}