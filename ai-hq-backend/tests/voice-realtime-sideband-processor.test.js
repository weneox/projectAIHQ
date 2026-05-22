import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
  processRealtimeSidebandEvent,
} from "../src/modules/voice/realtimeSidebandProcessor.js";
import {
  dispatchRealtimeSidebandToolCall,
} from "../src/modules/voice/realtimeSidebandToolDispatcher.js";

function target() {
  return {
    provider: "openai",
    transport: "webrtc",
    providerRealtimeCallId: "call_realtime_1",
  };
}

function call() {
  return {
    id: "voice-call-1",
    extraction: {},
    meta: {},
  };
}

function scope() {
  return {
    tenantId: "tenant-1",
    tenantKey: "acme",
  };
}

function allowReservation(input = {}) {
  return {
    ok: true,
    skipped: false,
    acquired: true,
    duplicate: false,
    reasonCode: "",
    idempotencyKey: "idem-processor",
    leaseToken: "lease-processor",
    recordState: "reserved",
    source: input.source,
  };
}

function dispatchWithReservation(input = {}) {
  return dispatchRealtimeSidebandToolCall({
    ...input,
    reserveExecution: allowReservation,
  });
}

test("transcript event is normalized and persisted without dispatching", async () => {
  const persistedArgs = [];
  let dispatchCount = 0;

  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "I need an appointment tomorrow.",
    },
    target: target(),
    call: call(),
    scope: scope(),
    dispatchToolCall: async () => {
      dispatchCount += 1;
      throw new Error("dispatch should not be called");
    },
    persistTrace: async (input) => {
      persistedArgs.push(input);
      return {
        ok: true,
        skipped: false,
        events: [{ id: "event-1" }],
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.processorVersion, VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION);
  assert.equal(result.normalized.eventType, "voice.sideband.transcript.final");
  assert.equal(result.normalized.toolCall, null);
  assert.equal(result.dispatched, false);
  assert.equal(dispatchCount, 0);
  assert.equal(persistedArgs.length, 1);
  assert.equal(persistedArgs[0].normalized, result.normalized);
  assert.equal(persistedArgs[0].resultTrace, undefined);
  assert.equal(result.reasonCode, "");
});

test("tool call event is dispatched and persisted", async () => {
  const persistedArgs = [];

  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-1",
      name: "create_appointment_request",
      arguments: "{\"service\":\"Dental consultation\"}",
    },
    target: target(),
    call: call(),
    scope: scope(),
    runtimeConfig: {
      actions: {
        appointment: {
          mode: "request_only",
        },
      },
    },
    dispatchToolCall: dispatchWithReservation,
    persistTrace: async (input) => {
      persistedArgs.push(input);
      return {
        ok: true,
        skipped: false,
        events: [{ id: "tool-call-event" }, { id: "tool-result-event" }],
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dispatched, true);
  assert.equal(result.dispatchResult.result.status, "missing_required_fields");
  assert.equal(result.normalized.eventType, "voice.sideband.tool_call");
  assert.equal(persistedArgs.length, 1);
  assert.equal(persistedArgs[0].normalized, result.normalized);
  assert.equal(persistedArgs[0].resultTrace.eventType, "voice.sideband.tool_result");
  assert.equal(persistedArgs[0].callPatch.outcome, "unknown");
  assert.equal(
    persistedArgs[0].callPatch.extraction.voiceOutcome.type,
    "voice_action_missing_required_fields"
  );
  assert.equal(
    persistedArgs[0].callPatch.extraction.voiceOutcome.action,
    "create_appointment_request"
  );
  assert.equal(
    persistedArgs[0].callPatch.extraction.voiceOutcome.status,
    "missing_required_fields"
  );
});

test("outboundEvents from dispatcher are returned", async () => {
  const outboundEvents = [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "tool-call-2",
        output: "{\"ok\":true}",
      },
    },
    {
      type: "response.create",
    },
  ];

  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-2",
      name: "create_handoff_request",
      arguments: "{}",
    },
    target: target(),
    call: call(),
    scope: scope(),
    dispatchToolCall: async () => ({
      ok: true,
      dispatched: true,
      reasonCode: "",
      outboundEvents,
      resultTrace: {
        eventType: "voice.sideband.tool_result",
        payload: {
          resultStatus: "request_recorded",
        },
      },
      callPatch: {},
    }),
    persistTrace: async () => ({
      ok: true,
      skipped: false,
      events: [],
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.outboundEvents, outboundEvents);
});

test("callPatch from dispatcher is passed into persistence", async () => {
  const callPatch = {
    summary: "Caller wants operator follow-up",
    handoffRequested: true,
  };
  let persistedCallPatch = null;

  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-3",
      name: "create_handoff_request",
      arguments: "{}",
    },
    target: target(),
    call: call(),
    scope: scope(),
    dispatchToolCall: async () => ({
      ok: true,
      dispatched: true,
      reasonCode: "",
      outboundEvents: [],
      resultTrace: {
        eventType: "voice.sideband.tool_result",
        payload: {},
      },
      callPatch,
    }),
    persistTrace: async (input) => {
      persistedCallPatch = input.callPatch;
      return {
        ok: true,
        skipped: false,
        events: [],
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.dispatched, true);
  assert.equal(persistedCallPatch, callPatch);
});

test("missing event returns skipped structured result", async () => {
  const result = await processRealtimeSidebandEvent({
    db: {},
    call: call(),
    scope: scope(),
  });

  assert.deepEqual(result, {
    ok: false,
    skipped: true,
    processorVersion: VOICE_REALTIME_SIDEBAND_PROCESSOR_VERSION,
    normalized: null,
    dispatched: false,
    dispatchResult: null,
    outboundEvents: [],
    persisted: null,
    reasonCode: "sideband_event_missing",
  });
});

test("dispatch failure is returned as structured error, not swallowed silently", async () => {
  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-4",
      name: "create_handoff_request",
      arguments: "{}",
    },
    target: target(),
    call: call(),
    scope: scope(),
    dispatchToolCall: async () => {
      throw new Error("dispatcher exploded");
    },
    persistTrace: async () => {
      throw new Error("persist should not be called after dispatch failure");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, false);
  assert.equal(result.reasonCode, "sideband_tool_dispatch_failed");
  assert.equal(result.dispatchResult.ok, false);
  assert.equal(result.dispatchResult.reasonCode, "sideband_tool_dispatch_failed");
  assert.match(result.error, /dispatcher exploded/);
  assert.equal(result.persisted, null);
});

test("injected normalize, dispatch, and persist functions are used", async () => {
  const calls = [];
  const normalized = {
    ok: true,
    eventType: "voice.sideband.tool_call",
    actor: "assistant",
    realtimeType: "custom.tool",
    providerRealtimeCallId: "call_custom",
    toolCall: {
      id: "tool-call-custom",
      name: "create_handoff_request",
      arguments: {},
    },
    payload: {},
  };

  const result = await processRealtimeSidebandEvent({
    db: {},
    event: {
      type: "custom.tool",
    },
    target: target(),
    call: call(),
    scope: scope(),
    normalizeEvent: (event, context) => {
      calls.push(["normalize", event.type, context.target.providerRealtimeCallId]);
      return normalized;
    },
    dispatchToolCall: async (input) => {
      calls.push(["dispatch", input.normalized, input.event.type]);
      return {
        ok: true,
        dispatched: true,
        outboundEvents: [{ type: "response.create" }],
        resultTrace: {
          eventType: "voice.sideband.tool_result",
          payload: {},
        },
        callPatch: {
          summary: "Injected patch",
        },
      };
    },
    persistTrace: async (input) => {
      calls.push(["persist", input.normalized, input.callPatch.summary]);
      return {
        ok: true,
        skipped: false,
        events: [],
      };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    ["normalize", "custom.tool", "call_realtime_1"],
    ["dispatch", normalized, "custom.tool"],
    ["persist", normalized, "Injected patch"],
  ]);
});

test("no network or socket behavior exists", async () => {
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
    const result = await processRealtimeSidebandEvent({
      db: {},
      event: {
        type: "response.function_call_arguments.done",
        call_id: "tool-call-5",
        name: "create_handoff_request",
        arguments: "{\"reason\":\"operator\",\"phone\":\"+994501112233\"}",
      },
      target: target(),
      call: call(),
      scope: scope(),
      runtimeConfig: {
        actions: {
          handoff: {
            mode: "request_only",
          },
        },
      },
      dispatchToolCall: dispatchWithReservation,
      persistTrace: async () => ({
        ok: true,
        skipped: false,
        events: [],
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.dispatched, true);
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
