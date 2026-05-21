export const VOICE_REALTIME_CONTROL_PLANE_VERSION = "voice-realtime-control-plane-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function clean(value = "", max = 240) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function readProviderCallIdFromUrl(value = "") {
  const raw = s(value);
  if (!raw) return "";

  try {
    const url = new URL(raw, "https://api.openai.com");
    const byQuery = s(
      url.searchParams.get("call_id") ||
        url.searchParams.get("callId") ||
        url.searchParams.get("id")
    );
    if (byQuery) return byQuery;

    const parts = url.pathname.split("/").map((part) => s(part)).filter(Boolean);
    return parts.findLast?.((part) => /^call_[A-Za-z0-9_-]+$/.test(part)) ||
      parts.findLast?.((part) => /^sess_[A-Za-z0-9_-]+$/.test(part)) ||
      "";
  } catch {
    return "";
  }
}

export function normalizeProviderRealtimeCallId(value = "") {
  const raw = clean(value, 500);
  if (!raw) return "";

  const urlId = readProviderCallIdFromUrl(raw);
  if (urlId) return clean(urlId, 160);

  const callMatch = raw.match(/\bcall_[A-Za-z0-9_-]+\b/);
  if (callMatch?.[0]) return clean(callMatch[0], 160);

  const sessionMatch = raw.match(/\bsess_[A-Za-z0-9_-]+\b/);
  if (sessionMatch?.[0]) return clean(sessionMatch[0], 160);

  return clean(raw, 160);
}

export function buildRealtimeControlTarget({
  provider = "openai",
  transport = "webrtc",
  voiceCallId = "",
  tenantId = "",
  tenantKey = "",
  providerRealtimeCallId = "",
  model = "",
  voice = "",
} = {}) {
  const id = normalizeProviderRealtimeCallId(providerRealtimeCallId);

  return {
    version: VOICE_REALTIME_CONTROL_PLANE_VERSION,
    provider: clean(provider || "openai", 64),
    transport: clean(transport || "webrtc", 64),
    voiceCallId: clean(voiceCallId, 120),
    tenantId: clean(tenantId, 120),
    tenantKey: clean(tenantKey, 120),
    providerRealtimeCallId: id,
    model: clean(model, 120),
    voice: clean(voice, 80),
    sideband: {
      available: !!id,
      reasonCode: id ? "" : "provider_realtime_call_id_missing",
      connectPath: id ? `/v1/realtime?call_id=${encodeURIComponent(id)}` : "",
    },
  };
}

export function buildRealtimeProviderLinkPayload({
  target = {},
  locationHeader = "",
  source = "browser_webrtc_sdp",
} = {}) {
  return {
    controlPlaneVersion: VOICE_REALTIME_CONTROL_PLANE_VERSION,
    source: clean(source, 80),
    provider: clean(target.provider || "openai", 64),
    transport: clean(target.transport || "webrtc", 64),
    providerRealtimeCallId: normalizeProviderRealtimeCallId(target.providerRealtimeCallId),
    sidebandAvailable: target.sideband?.available === true,
    sidebandReasonCode: clean(target.sideband?.reasonCode),
    sidebandConnectPath: clean(target.sideband?.connectPath, 240),
    model: clean(target.model, 120),
    voice: clean(target.voice, 80),
    locationHeader: clean(locationHeader, 500),
    linkedAt: new Date().toISOString(),
  };
}
