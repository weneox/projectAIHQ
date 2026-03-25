import { apiGet, apiPost } from "./client.js";

function qs(params = {}) {
  const sp = new URLSearchParams();

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });

  const str = sp.toString();
  return str ? `?${str}` : "";
}

function normalizeList(j, fallbackKey) {
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.[fallbackKey])) return j[fallbackKey];
  if (Array.isArray(j?.items)) return j.items;
  if (Array.isArray(j?.rows)) return j.rows;
  if (Array.isArray(j?.data)) return j.data;
  return [];
}

function unwrapObject(j, key) {
  if (j && typeof j === "object" && j[key] && typeof j[key] === "object") {
    return j[key];
  }
  return j;
}

export async function getVoiceOverview(params = {}) {
  return apiGet(`/api/voice/overview${qs(params)}`);
}

export async function listVoiceCalls(params = {}) {
  const j = await apiGet(`/api/voice/calls${qs(params)}`);
  return normalizeList(j, "calls");
}

export async function getVoiceCall(callId) {
  if (!callId) throw new Error("callId is required");
  const j = await apiGet(`/api/voice/calls/${encodeURIComponent(callId)}`);
  return unwrapObject(j, "call");
}

export async function listVoiceCallEvents(callId, params = {}) {
  if (!callId) throw new Error("callId is required");
  const j = await apiGet(`/api/voice/calls/${encodeURIComponent(callId)}/events${qs(params)}`);
  return normalizeList(j, "events");
}

export async function listVoiceCallSessions(callId, params = {}) {
  if (!callId) throw new Error("callId is required");
  const j = await apiGet(`/api/voice/calls/${encodeURIComponent(callId)}/sessions${qs(params)}`);
  return normalizeList(j, "sessions");
}

export async function getVoiceSettings(params = {}) {
  const j = await apiGet(`/api/voice/settings${qs(params)}`);
  return unwrapObject(j, "settings");
}

export async function updateVoiceSettings(body = {}) {
  const j = await apiPost(`/api/voice/settings`, body);
  return unwrapObject(j, "settings");
}

export async function joinVoiceCall(callId, body = {}) {
  if (!callId) throw new Error("callId is required");
  return apiPost(`/api/voice/calls/${encodeURIComponent(callId)}/join`, body);
}

export async function endVoiceCall(callId, body = {}) {
  if (!callId) throw new Error("callId is required");
  return apiPost(`/api/voice/calls/${encodeURIComponent(callId)}/end`, body);
}