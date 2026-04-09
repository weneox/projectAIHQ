// src/api/setup.js
// FINAL v2.3 - setup state API with session review flow + assistant finalize

import { apiGet, apiPost, apiPut, apiPatch } from "./client.js";

const SETUP_STATE_PATH = "/api/setup/status";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeSetupAssistantPayload(payload = {}) {
  const root = obj(payload);
  const setup = root.setup;

  return {
    ...root,
    setup: setup ? obj(setup) : null,
  };
}

export function getSetupState() {
  return apiGet(SETUP_STATE_PATH);
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
    payload?.error === "SetupAssistantSessionNotFound"
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

export async function finalizeSetupAssistantSession(payload = {}) {
  return apiPost("/api/setup/review/current/finalize", payload);
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
