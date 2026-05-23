import {
  normalizeRealtimeProviderEvent,
} from "./realtimeProviderAdapters.js";

export const VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION =
  "voice-realtime-sideband-event-sink-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readProvider(context = {}) {
  const target = obj(context.target);

  return s(
    context.provider ||
      target.provider ||
      "openai"
  );
}

function readTarget(context = {}) {
  return obj(context.target).provider
    ? obj(context.target)
    : obj(context);
}

export function normalizeRealtimeSidebandEvent(event = {}, context = {}) {
  const normalized = normalizeRealtimeProviderEvent({
    provider: readProvider(context),
    event,
    target: readTarget(context),
  });

  return normalized?.normalized || {
    ok: false,
    eventType: "voice.sideband.event",
    actor: "system",
    role: "system",
    text: "",
    toolCall: null,
    transcript: null,
    payload: {
      reasonCode: normalized?.reasonCode || "sideband_event_normalize_failed",
    },
  };
}

export function extractRealtimeSidebandToolCall(event = {}, context = {}) {
  return normalizeRealtimeSidebandEvent(event, context).toolCall || null;
}

export function extractRealtimeSidebandTranscript(event = {}, context = {}) {
  return normalizeRealtimeSidebandEvent(event, context).transcript || null;
}

export function buildRealtimeSidebandEventTrace(event = {}, context = {}) {
  const normalized = normalizeRealtimeSidebandEvent(event, context);

  return {
    eventType: normalized.eventType,
    actor: normalized.actor,
    role: normalized.role,
    text: normalized.text,
    payload: normalized.payload,
    toolCall: normalized.toolCall,
    transcript: normalized.transcript,
  };
}
