import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRealtimeSidebandConnectionPlan,
} from "../src/modules/voice/realtimeSidebandConnector.js";
import {
  normalizeRealtimeSidebandEvent,
} from "../src/modules/voice/realtimeSidebandEvents.js";
import {
  buildOpenAIRealtimeSidebandToolOutputEvents,
} from "../src/modules/voice/providers/openaiRealtimeSidebandAdapter.js";
import {
  OPENAI_REALTIME_PROVIDER,
  VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION,
  buildRealtimeProviderSidebandTrace,
  buildRealtimeProviderSidebandPlan,
  getRealtimeProviderAdapter,
  normalizeRealtimeProviderEvent,
  normalizeRealtimeProviderName,
} from "../src/modules/voice/realtimeProviderAdapters.js";

function target(provider = "openai") {
  return {
    provider,
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
  };
}

test("normalizes provider names", () => {
  assert.equal(normalizeRealtimeProviderName(" OpenAI "), OPENAI_REALTIME_PROVIDER);
  assert.equal(normalizeRealtimeProviderName("GPT"), OPENAI_REALTIME_PROVIDER);
  assert.equal(normalizeRealtimeProviderName("openai-realtime"), OPENAI_REALTIME_PROVIDER);
  assert.equal(normalizeRealtimeProviderName("openai realtime"), OPENAI_REALTIME_PROVIDER);
  assert.equal(normalizeRealtimeProviderName("ElevenLabs"), "elevenlabs");
  assert.equal(normalizeRealtimeProviderName(""), OPENAI_REALTIME_PROVIDER);
});

test("returns OpenAI adapter for openai/gpt/openai_realtime aliases", () => {
  for (const alias of ["openai", "gpt", "openai_realtime"]) {
    const adapter = getRealtimeProviderAdapter(alias);

    assert.equal(adapter.version, VOICE_REALTIME_PROVIDER_ADAPTERS_VERSION);
    assert.equal(adapter.provider, OPENAI_REALTIME_PROVIDER);
    assert.equal(adapter.status, "supported");
    assert.equal(adapter.reasonCode, "");
    assert.equal(typeof adapter.buildSidebandPlan, "function");
    assert.equal(typeof adapter.buildSidebandTrace, "function");
    assert.equal(typeof adapter.normalizeEvent, "function");
    assert.equal(typeof adapter.buildToolOutputEvents, "function");
  }
});

test("unknown provider returns unsupported adapter and result", () => {
  const adapter = getRealtimeProviderAdapter("elevenlabs");
  const sidebandPlan = adapter.buildSidebandPlan({
    target: target("elevenlabs"),
    env: {},
  });
  const normalized = adapter.normalizeEvent({
    event: {
      type: "response.output_text.done",
      text: "Hello",
    },
    target: target("elevenlabs"),
  });

  assert.equal(adapter.provider, "elevenlabs");
  assert.equal(adapter.status, "unsupported");
  assert.equal(adapter.reasonCode, "unsupported_realtime_provider");
  assert.deepEqual(sidebandPlan, {
    ok: false,
    provider: "elevenlabs",
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    sidebandPlan: null,
    normalized: null,
  });
  assert.deepEqual(normalized, sidebandPlan);
  assert.deepEqual(adapter.buildToolOutputEvents(), {
    ok: false,
    provider: "elevenlabs",
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    outboundEvents: [],
  });
});

test("OpenAI sideband plan delegates to existing sideband connector behavior", () => {
  const env = {
    VOICE_REALTIME_SIDEBAND_ENABLED: "true",
  };
  const expected = buildRealtimeSidebandConnectionPlan({
    target: target("openai"),
    env,
  });
  const result = buildRealtimeProviderSidebandPlan({
    provider: "gpt",
    target: target("gpt"),
    env,
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, OPENAI_REALTIME_PROVIDER);
  assert.equal(result.status, expected.status);
  assert.equal(result.reasonCode, expected.reasonCode);
  assert.deepEqual(result.sidebandPlan, expected);
  assert.equal(result.normalized, null);
});

test("OpenAI adapter builds outbound tool output events without direct assistant instructions", () => {
  const adapter = getRealtimeProviderAdapter("openai");
  const input = {
    toolCall: {
      id: "tool-call-1",
      name: "create_handoff_request",
    },
    result: {
      ok: true,
      status: "request_recorded",
      assistantInstruction: "legacy instruction must be stripped",
      nextQuestion: "legacy question must be stripped",
    },
  };

  const expected = buildOpenAIRealtimeSidebandToolOutputEvents(input);
  const result = adapter.buildToolOutputEvents(input);

  assert.equal(result.ok, true);
  assert.equal(result.provider, OPENAI_REALTIME_PROVIDER);
  assert.equal(result.status, "built");
  assert.deepEqual(result.outboundEvents, expected);
  assert.equal(result.outboundEvents[0].type, "conversation.item.create");
  assert.equal(result.outboundEvents[0].item.type, "function_call_output");

  const payload = JSON.parse(result.outboundEvents[0].item.output);
  assert.equal(payload.assistantInstruction, undefined);
  assert.equal(payload.nextQuestion, undefined);

  assert.equal(result.outboundEvents[1].type, "response.create");
  assert.equal(result.outboundEvents[1].response?.instructions, undefined);
});

test("OpenAI event normalization delegates to existing sideband event behavior", () => {
  const event = {
    type: "response.function_call_arguments.done",
    call_id: "tool-call-1",
    name: "create_appointment_request",
    arguments: "{\"service\":\"Dental consultation\"}",
  };
  const expected = normalizeRealtimeSidebandEvent(event, {
    target: target("openai"),
  });
  const result = normalizeRealtimeProviderEvent({
    provider: "openai_realtime",
    event,
    target: target("openai_realtime"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, OPENAI_REALTIME_PROVIDER);
  assert.equal(result.status, "normalized");
  assert.equal(result.reasonCode, "");
  assert.equal(result.sidebandPlan, null);
  assert.deepEqual(result.normalized, expected);
});

test("unknown provider event normalization returns unsupported result", () => {
  const result = normalizeRealtimeProviderEvent({
    provider: "elevenlabs",
    event: {
      type: "response.output_text.done",
      text: "Hello",
    },
    target: target("elevenlabs"),
  });

  assert.deepEqual(result, {
    ok: false,
    provider: "elevenlabs",
    status: "unsupported",
    reasonCode: "unsupported_realtime_provider",
    sidebandPlan: null,
    normalized: null,
  });
});

test("unknown provider sideband trace returns compatible unsupported trace", () => {
  const result = buildRealtimeProviderSidebandTrace({
    provider: "elevenlabs",
    target: target("elevenlabs"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.provider, "elevenlabs");
  assert.equal(result.status, "unsupported");
  assert.equal(result.reasonCode, "unsupported_realtime_provider");
  assert.equal(result.sidebandTrace.enabled, false);
  assert.equal(result.sidebandTrace.status, "unsupported");
  assert.equal(result.sidebandTrace.reasonCode, "unsupported_realtime_provider");
  assert.equal(result.sidebandTrace.provider, "elevenlabs");
  assert.equal(result.sidebandTrace.providerRealtimeCallId, "call_realtime_1");
  assert.equal(result.sidebandTrace.networkIo, false);
});

test("no network or socket behavior exists", () => {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  let fetchCalls = 0;
  let socketCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };
  globalThis.WebSocket = function WebSocket() {
    socketCalls += 1;
    throw new Error("WebSocket should not be constructed");
  };

  try {
    const planned = buildRealtimeProviderSidebandPlan({
      provider: "openai",
      target: target("openai"),
      env: {
        VOICE_REALTIME_SIDEBAND_ENABLED: "1",
        OPENAI_API_KEY: "sk-test",
      },
    });
    const normalized = normalizeRealtimeProviderEvent({
      provider: "openai",
      event: {
        type: "response.output_text.done",
        text: "Sure, I can help.",
      },
      target: target("openai"),
    });
    const unsupported = buildRealtimeProviderSidebandPlan({
      provider: "elevenlabs",
      target: target("elevenlabs"),
      env: {},
    });

    assert.equal(planned.status, "ready");
    assert.equal(planned.sidebandPlan.networkIo, false);
    assert.equal(normalized.status, "normalized");
    assert.equal(unsupported.status, "unsupported");
    assert.equal(fetchCalls, 0);
    assert.equal(socketCalls, 0);
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
    if (originalWebSocket === undefined) {
      delete globalThis.WebSocket;
    } else {
      globalThis.WebSocket = originalWebSocket;
    }
  }
});
