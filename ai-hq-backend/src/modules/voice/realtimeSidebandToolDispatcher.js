import {
  buildVoiceActionCallPatch,
  executeVoiceAction,
} from "./actions/voiceActionRuntime.js";
import {
  normalizeRealtimeSidebandEvent,
} from "./realtimeSidebandEvents.js";

export const VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION =
  "voice-realtime-sideband-tool-dispatcher-v1";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function stringifyToolOutput(result = {}) {
  try {
    return JSON.stringify(obj(result));
  } catch {
    return JSON.stringify({
      ok: false,
      status: "tool_output_serialization_failed",
      message: "Tool output could not be serialized.",
    });
  }
}

export function buildRealtimeSidebandToolOutputEvents({
  toolCall = {},
  result = {},
} = {}) {
  const callId = s(toolCall.id || toolCall.call_id || toolCall.callId);
  if (!callId) return [];

  const assistantInstruction = s(
    result.assistantInstruction || result.nextAssistantInstruction
  );

  return [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: stringifyToolOutput(result),
      },
    },
    assistantInstruction
      ? {
          type: "response.create",
          response: {
            instructions: assistantInstruction,
          },
        }
      : {
          type: "response.create",
        },
  ];
}

export function buildRealtimeSidebandToolResultTrace({
  normalized = {},
  toolCall = {},
  result = {},
} = {}) {
  return {
    eventType: "voice.sideband.tool_result",
    actor: "system",
    role: "system",
    text: s(result.message || result.status || toolCall.name),
    payload: {
      sidebandToolDispatcherVersion: VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION,
      realtimeType: s(normalized.realtimeType),
      providerRealtimeCallId: s(normalized.providerRealtimeCallId),
      toolCallId: s(toolCall.id),
      toolName: s(toolCall.name),
      resultStatus: s(result.status),
      assistantInstruction: s(
        result.assistantInstruction || result.nextAssistantInstruction
      ),
      nextQuestion: s(result.nextQuestion),
      missingRequired: arr(result.missingRequired),
      result,
    },
  };
}

export async function dispatchRealtimeSidebandToolCall({
  event = {},
  target = {},
  call = {},
  scope = {},
  runtimeConfig = {},
  executeAction = executeVoiceAction,
} = {}) {
  const normalized = normalizeRealtimeSidebandEvent(event, { target });
  const toolCall = normalized.toolCall;

  if (!toolCall?.name) {
    return {
      ok: true,
      dispatched: false,
      status: "ignored",
      reasonCode: "sideband_event_not_tool_call",
      normalized,
      outboundEvents: [],
      callPatch: {},
      resultTrace: null,
    };
  }

  const result = await executeAction({
    name: toolCall.name,
    args: obj(toolCall.arguments),
    call,
    scope,
    runtimeConfig,
  });

  const callPatch = buildVoiceActionCallPatch({
    result,
    call,
  });

  const outboundEvents = buildRealtimeSidebandToolOutputEvents({
    toolCall,
    result,
  });

  const resultTrace = buildRealtimeSidebandToolResultTrace({
    normalized,
    toolCall,
    result,
  });

  return {
    ok: true,
    dispatched: true,
    status: "dispatched",
    reasonCode: "",
    normalized,
    toolCall,
    result,
    callPatch,
    outboundEvents,
    resultTrace,
  };
}
