import {
  normalizeOpenAIRealtimeSidebandEvent,
} from "./providers/openaiRealtimeSidebandAdapter.js";

export const VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION =
  "voice-realtime-sideband-event-sink-v1";

export function extractRealtimeSidebandToolCall(event = {}) {
  return normalizeOpenAIRealtimeSidebandEvent(event).toolCall;
}

export function extractRealtimeSidebandTranscript(event = {}) {
  return normalizeOpenAIRealtimeSidebandEvent(event).transcript;
}

export function normalizeRealtimeSidebandEvent(event = {}, context = {}) {
  return normalizeOpenAIRealtimeSidebandEvent(event, context);
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
