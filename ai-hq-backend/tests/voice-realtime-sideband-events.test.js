import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION,
  buildRealtimeSidebandEventTrace,
  extractRealtimeSidebandToolCall,
  extractRealtimeSidebandTranscript,
  normalizeRealtimeSidebandEvent,
} from "../src/modules/voice/realtimeSidebandEvents.js";
import {
  normalizeOpenAIRealtimeSidebandEvent,
} from "../src/modules/voice/providers/openaiRealtimeSidebandAdapter.js";

test("sideband event sink extracts tool calls from realtime function argument events", () => {
  const toolCall = extractRealtimeSidebandToolCall({
    type: "response.function_call_arguments.done",
    call_id: "call-tool-1",
    name: "create_appointment_request",
    arguments: "{\"service\":\"Dental consultation\"}",
  });

  assert.equal(toolCall.id, "call-tool-1");
  assert.equal(toolCall.name, "create_appointment_request");
  assert.equal(toolCall.arguments.service, "Dental consultation");
});

test("sideband event sink extracts tool calls from response.done output", () => {
  const toolCall = extractRealtimeSidebandToolCall({
    type: "response.done",
    response: {
      output: [
        { type: "message", text: "noop" },
        {
          id: "item-1",
          call_id: "call-tool-2",
          name: "create_handoff_request",
          arguments: {
            reason: "caller asked for operator",
          },
        },
      ],
    },
  });

  assert.equal(toolCall.id, "call-tool-2");
  assert.equal(toolCall.name, "create_handoff_request");
  assert.equal(toolCall.arguments.reason, "caller asked for operator");
});

test("sideband event sink normalizes caller and assistant transcripts", () => {
  const caller = extractRealtimeSidebandTranscript({
    type: "conversation.item.input_audio_transcription.completed",
    transcript: "Salam, qəbul üçün zəng etmişəm",
  });

  assert.equal(caller.eventType, "voice.sideband.transcript.final");
  assert.equal(caller.actor, "caller");
  assert.equal(caller.role, "caller");

  const assistant = extractRealtimeSidebandTranscript({
    type: "response.audio_transcript.done",
    transcript: "Salam, necə kömək edə bilərəm?",
  });

  assert.equal(assistant.actor, "assistant");
  assert.equal(assistant.role, "assistant");
});

test("sideband event sink builds durable trace payloads", () => {
  const normalized = normalizeRealtimeSidebandEvent(
    {
      type: "response.function_call_arguments.done",
      call_id: "call-tool-3",
      name: "create_appointment_request",
      arguments: "{\"service\":\"Dental consultation\"}",
    },
    {
      target: {
        provider: "openai",
        transport: "webrtc",
        providerRealtimeCallId: "call_realtime_1",
      },
    }
  );

  assert.equal(normalized.version, VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION);
  assert.equal(normalized.eventType, "voice.sideband.tool_call");
  assert.equal(normalized.actor, "assistant");
  assert.equal(normalized.providerRealtimeCallId, "call_realtime_1");
  assert.equal(normalized.payload.toolCall.name, "create_appointment_request");

  const trace = buildRealtimeSidebandEventTrace(
    {
      type: "response.output_text.done",
      text: "Sizə hansı gün uyğundur?",
    },
    {
      providerRealtimeCallId: "call_realtime_1",
    }
  );

  assert.equal(trace.eventType, "voice.sideband.transcript.final");
  assert.equal(trace.actor, "assistant");
  assert.equal(trace.payload.sidebandEventSinkVersion, VOICE_REALTIME_SIDEBAND_EVENT_SINK_VERSION);
});

test("compatibility sideband event normalizer delegates to OpenAI adapter behavior", () => {
  const event = {
    type: "response.output_item.done",
    item: {
      call_id: "tool-call-openai-adapter",
      name: "create_handoff_request",
      arguments: "{\"reason\":\"operator\"}",
    },
  };
  const context = {
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_1",
    },
  };

  assert.deepEqual(
    normalizeRealtimeSidebandEvent(event, context),
    normalizeOpenAIRealtimeSidebandEvent(event, context)
  );
});
