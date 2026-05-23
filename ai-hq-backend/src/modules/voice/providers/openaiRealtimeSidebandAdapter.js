import {
  normalizeProviderRealtimeCallId,
} from "../realtimeControlPlane.js";

export const OPENAI_REALTIME_SIDEBAND_ADAPTER_VERSION =
  "openai-realtime-sideband-adapter-v1";

const OPENAI_REALTIME_PROVIDER = "openai";
const OPENAI_REALTIME_SIDEBAND_EVENT_SINK_VERSION =
  "voice-realtime-sideband-event-sink-v1";
const OPENAI_REALTIME_SIDEBAND_CONNECTOR_VERSION =
  "voice-realtime-sideband-connector-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clean(value = "", max = 1200) {
  return s(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function truthy(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(lower(value));
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

function extractOpenAIRealtimeSidebandToolCall(event = {}) {
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

function extractOpenAIRealtimeSidebandTranscript(event = {}) {
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

function sanitizeToolOutputForModel(result = {}) {
  const output = {
    ...obj(result),
  };

  delete output.assistantInstruction;
  delete output.nextAssistantInstruction;
  delete output.nextQuestion;
  delete output.fallbackQuestion;
  delete output.question;
  delete output.questions;

  return output;
}

function stringifyToolOutput(result = {}) {
  try {
    return JSON.stringify(sanitizeToolOutputForModel(result));
  } catch {
    return JSON.stringify({
      ok: false,
      status: "tool_output_serialization_failed",
      message: "Tool output could not be serialized.",
    });
  }
}

function isOpenAIRealtimeSidebandEnabled(env = process.env) {
  return truthy(
    env.VOICE_REALTIME_SIDEBAND_ENABLED ||
      env.AIHQ_VOICE_REALTIME_SIDEBAND_ENABLED
  );
}

function buildSidebandUrl(baseUrl = "", providerRealtimeCallId = "") {
  const url = new URL(baseUrl || "wss://api.openai.com/v1/realtime");
  url.searchParams.set("call_id", providerRealtimeCallId);
  return url.toString();
}

export function normalizeOpenAIRealtimeSidebandEvent(event = {}, context = {}) {
  const item = obj(event);
  const target = obj(context.target);
  const type = s(item.type, "event");
  const toolCall = extractOpenAIRealtimeSidebandToolCall(item);
  const transcript = extractOpenAIRealtimeSidebandTranscript(item);

  const providerRealtimeCallId = normalizeProviderRealtimeCallId(
    target.providerRealtimeCallId || context.providerRealtimeCallId
  );

  const provider = s(target.provider || context.provider || OPENAI_REALTIME_PROVIDER);
  const transport = s(target.transport || context.transport || "webrtc");

  const eventType = toolCall
    ? "voice.sideband.tool_call"
    : transcript?.eventType || "voice.sideband.event";

  const actor = toolCall ? "assistant" : s(transcript?.actor || "system");
  const role = toolCall ? "assistant" : s(transcript?.role || "system");
  const text = toolCall ? toolCall.name : clean(transcript?.text || item.text || item.transcript);

  return {
    ok: true,
    version: OPENAI_REALTIME_SIDEBAND_EVENT_SINK_VERSION,
    eventType,
    actor,
    role,
    text,
    realtimeType: type,
    provider,
    transport,
    providerRealtimeCallId,
    toolCall,
    transcript,
    payload: {
      sidebandEventSinkVersion: OPENAI_REALTIME_SIDEBAND_EVENT_SINK_VERSION,
      realtimeType: type,
      provider,
      transport,
      providerRealtimeCallId,
      ...(toolCall ? { toolCall } : {}),
      ...(transcript ? { transcript } : {}),
    },
  };
}

export function buildOpenAIRealtimeSidebandToolOutputEvents({
  toolCall = {},
  result = {},
  includeResponseCreate = true,
} = {}) {
  const callId = s(toolCall.id || toolCall.call_id || toolCall.callId);
  if (!callId) return [];

  const events = [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: stringifyToolOutput(result),
      },
    },
  ];

  if (includeResponseCreate) {
    events.push({
      type: "response.create",
    });
  }

  return events;
}

export function buildOpenAIRealtimeSidebandConnectionPlan({
  target = {},
  env = process.env,
} = {}) {
  const provider = lower(target.provider || OPENAI_REALTIME_PROVIDER);
  const transport = lower(target.transport || "webrtc");

  const providerRealtimeCallId = normalizeProviderRealtimeCallId(
    target.providerRealtimeCallId
  );

  const base = {
    version: OPENAI_REALTIME_SIDEBAND_CONNECTOR_VERSION,
    provider,
    transport,
    providerRealtimeCallId,
    enabled: false,
    status: "disabled",
    reasonCode: "sideband_disabled",
    url: "",
    networkIo: false,
    authorizationConfigured: false,
  };

  if (!isOpenAIRealtimeSidebandEnabled(env)) {
    return base;
  }

  if (provider !== OPENAI_REALTIME_PROVIDER) {
    return {
      ...base,
      status: "blocked",
      reasonCode: "unsupported_realtime_provider",
    };
  }

  if (!providerRealtimeCallId) {
    return {
      ...base,
      status: "blocked",
      reasonCode: "provider_realtime_call_id_missing",
    };
  }

  const authorizationConfigured = !!s(env.OPENAI_API_KEY);

  if (!authorizationConfigured) {
    return {
      ...base,
      status: "blocked",
      reasonCode: "openai_api_key_missing",
      authorizationConfigured: false,
    };
  }

  let url = "";

  try {
    url = buildSidebandUrl(
      env.OPENAI_REALTIME_SIDEBAND_URL || "wss://api.openai.com/v1/realtime",
      providerRealtimeCallId
    );
  } catch {
    return {
      ...base,
      status: "blocked",
      reasonCode: "invalid_sideband_url",
      authorizationConfigured,
    };
  }

  return {
    ...base,
    enabled: true,
    status: "ready",
    reasonCode: "",
    url,
    authorizationConfigured,
    headers: {
      Authorization: "Bearer <configured>",
      "OpenAI-Beta": "realtime=v1",
    },
  };
}

export function buildOpenAIRealtimeSidebandTrace(plan = {}) {
  return {
    version: clean(plan.version || OPENAI_REALTIME_SIDEBAND_CONNECTOR_VERSION, 240),
    enabled: plan.enabled === true,
    status: clean(plan.status || "disabled", 80),
    reasonCode: clean(plan.reasonCode, 120),
    provider: clean(plan.provider || OPENAI_REALTIME_PROVIDER, 80),
    transport: clean(plan.transport || "webrtc", 80),
    providerRealtimeCallId: normalizeProviderRealtimeCallId(
      plan.providerRealtimeCallId
    ),
    url: plan.enabled === true ? clean(plan.url, 300) : "",
    networkIo: false,
    authorizationConfigured: plan.authorizationConfigured === true,
  };
}
