import { apiGet, apiPatch, apiPost } from "./client.js";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function startOnboardingSession(payload = {}) {
  return apiPost("/api/onboarding/session/start", payload);
}

export async function getCurrentOnboardingSession() {
  const payload = await apiGet("/api/onboarding/session/current", {
    allowStatuses: [404],
  });

  if (payload?.ok === false && payload?.error === "OnboardingSessionNotFound") {
    return null;
  }

  return obj(payload);
}

export async function updateCurrentOnboardingDraft(payload = {}) {
  return apiPatch("/api/onboarding/session/current", payload);
}
