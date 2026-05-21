import {
  normalizeProviderRealtimeCallId,
} from "./realtimeControlPlane.js";

export const VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION =
  "voice-realtime-sideband-event-sink-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clean(value = "", max = 1200) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function parseArguments(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return obj(parsed);
    } catch {
      return {};
    }
  }

  return {};
}

function readToolCallCandidate(candidate = {}) {
  const item = obj(candidate);
  const name = s(item.name || item.functionName || item.function_name);
  if (!name) return null;

  return {
    id: s(item.call_id || item.callId || item.id),
    itemId: s(item.item_id || item.itemId),
    name,
    arguments: parseArguments(item.arguments || item.args),
  };
}

export function extractRealtimeSidebandToolCall(event = {}) {
  const item = obj(event);
  const type = s(item.type);

  if (type === "response.function_call_arguments.done") {
    return readToolCallCandidate(item);
  }

  if (type === "response.output_item.done") {
    return readToolCallCandidate(item.item || {});
  }

  if (type === "response.done") {
    const output = Array.isArray(item?.response?.output) ? item.response.output : [];
    for (const candidate of output) {
      const toolCall = readToolCallCandidate(candidate);
      if (toolCall) return toolCall;
    }
  }

  return null;
}

export function extractRealtimeSidebandTranscript(event = {}) {
  const item = obj(event);
  const type = s(item.type);

  if (type === "conversation.item.input_audio_transcription.completed") {
    const text = clean(item.transcript, 2400);
    return text
      ? {
          eventType: "voice.sideband.transcript.final",
          actor: "caller",
          role: "caller",
          text,
        }
      : null;
  }

  if (type === "response.audio_transcript.done") {
    const text = clean(item.transcript, 2400);
    return text
      ? {
          eventType: "voice.sideband.transcript.final",
          actor: "assistant",
          role: "assistant",
          text,
        }
      : null;
  }

  if (type === "response.output_text.done") {
    const text = clean(item.text, 2400);
    return text
      ? {
          eventType: "voice.sideband.transcript.final",
          actor: "assistant",
          role: "assistant",
          text,
        }
      : null;
  }

  if (type === "error") {
    return {
      eventType: "voice.sideband.realtime_error",
      actor: "system",
      role: "system",
      text: clean(item.error?.message || item.message || "Realtime sideband error", 1200),
    };
  }

  return null;
}

export function normalizeRealtimeSidebandEvent(event = {}, context = {}) {
  const item = obj(event);
  const target = obj(context.target);
  const type = s(item.type, "event");
  const toolCall = extractRealtimeSidebandToolCall(item);
  const transcript = extractRealtimeSidebandTranscript(item);

  const eventType = toolCall
    ? "voice.sideband.tool_call"
    : transcript?.eventType || "voice.sideband.event";

  const actor = toolCall ? "assistant" : s(transcript?.actor || "system");
  const role = toolCall ? "assistant" : s(transcript?.role || "system");
  const text = toolCall ? toolCall.name : clean(transcript?.text || item.text || item.transcript);

  return {
    ok: true,
    version: VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION,
    eventType,
    actor,
    role,
    text,
    realtimeType: type,
    provider: s(target.provider || context.provider || "openai"),
    transport: s(target.transport || context.transport || "webrtc"),
    providerRealtimeCallId: normalizeProviderRealtimeCallId(
      target.providerRealtimeCallId || context.providerRealtimeCallId
    ),
    toolCall,
    transcript,
    payload: {
      sidebandEventSinkVersion: VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION,
      realtimeType: type,
      provider: s(target.provider || context.provider || "openai"),
      transport: s(target.transport || context.transport || "webrtc"),
      providerRealtimeCallId: normalizeProviderRealtimeCallId(
        target.providerRealtimeCallId || context.providerRealtimeCallId
      ),
      ...(toolCall ? { toolCall } : {}),
      ...(transcript ? { transcript } : {}),
    },
  };
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
