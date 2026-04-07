// src/api/setup.js
// FINAL v2.1 - setup studio API with session review flow + unified analyze

import { apiGet, apiPost, apiPut, apiPatch } from "./client.js";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeSetupAssistantPayload(payload = {}) {
  const root = obj(payload);
  const setup = root.setup || root.onboarding;

  return {
    ...root,
    setup: setup ? obj(setup) : null,
  };
}

export function getSetupStatus() {
  return apiGet("/api/setup/status");
}

export function getSetupOverview() {
  return apiGet("/api/setup/overview");
}

export function getSetupTruth() {
  return apiGet("/api/setup/truth/current");
}

export function saveBusinessProfile(payload = {}) {
  return apiPut("/api/setup/business-profile", payload);
}

export function saveRuntimePreferences(payload = {}) {
  return apiPut("/api/setup/runtime-preferences", payload);
}

export function importWebsiteForSetup(payload = {}) {
  return apiPost("/api/setup/import/website", payload);
}

export function importGoogleMapsForSetup(payload = {}) {
  return apiPost("/api/setup/import/google-maps", payload);
}

export function importSourceForSetup(payload = {}) {
  return apiPost("/api/setup/import/source", payload);
}

export function importBundleForSetup(payload = {}) {
  return apiPost("/api/setup/import/bundle", payload);
}

export function analyzeSetupIntake(payload = {}) {
  return apiPost("/api/setup/review/current/analyze", payload);
}

export async function startSetupAssistantSession(payload = {}) {
  const response = await apiPost("/api/setup/assistant/session/start", payload);
  return normalizeSetupAssistantPayload(response);
}

export async function getCurrentSetupAssistantSession() {
  const payload = await apiGet("/api/setup/assistant/session/current", {
    allowStatuses: [404],
  });

  if (
    payload?.ok === false &&
    (payload?.error === "SetupAssistantSessionNotFound" ||
      payload?.error === "OnboardingSessionNotFound")
  ) {
    return null;
  }

  return normalizeSetupAssistantPayload(payload);
}

export async function updateCurrentSetupAssistantDraft(payload = {}) {
  const response = await apiPatch("/api/setup/assistant/session/current", payload);
  return normalizeSetupAssistantPayload(response);
}

export async function sendSetupAssistantMessage(payload = {}) {
  const response = await apiPost(
    "/api/setup/assistant/session/current/message",
    payload
  );
  return normalizeSetupAssistantPayload(response);
}

export function getCurrentSetupReview(params = {}) {
  const query = new URLSearchParams();

  if (params?.eventLimit != null && String(params.eventLimit).trim()) {
    query.set("eventLimit", String(params.eventLimit));
  }

  const qs = query.toString();
  return apiGet(`/api/setup/review/current${qs ? `?${qs}` : ""}`);
}

export function patchCurrentSetupReview(payload = {}) {
  return apiPatch("/api/setup/review/current", payload);
}

export function discardCurrentSetupReview(payload = {}) {
  return apiPost("/api/setup/review/current/discard", payload);
}

export function finalizeCurrentSetupReview(payload = {}) {
  return apiPost("/api/setup/review/current/finalize", payload);
}

/*
  Backward-compatible aliases so older files do not break immediately.
*/

export function getSetupReviewDraft(params = {}) {
  return getCurrentSetupReview(params);
}

export function finalizeSetupReview(payload = {}) {
  return finalizeCurrentSetupReview(payload);
}
