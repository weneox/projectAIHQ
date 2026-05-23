import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION,
  buildRealtimeSidebandToolOutputEvents,
  dispatchRealtimeSidebandToolCall,
} from "../src/modules/voice/realtimeSidebandToolDispatcher.js";

function allowReservation(input = {}) {
  return {
    ok: true,
    skipped: false,
    acquired: true,
    duplicate: false,
    reasonCode: "",
    idempotencyKey: "idem-allow",
    leaseToken: "lease-allow",
    recordState: "reserved",
    source: input.source,
  };
}

test("sideband tool dispatcher ignores non-tool realtime events", async () => {
  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.output_text.done",
      text: "Salam",
    },
  });

  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.dispatched, false);
  assert.equal(dispatched.reasonCode, "sideband_event_not_tool_call");
  assert.deepEqual(dispatched.outboundEvents, []);
});

test("sideband tool dispatcher executes missing-field action with structured followup hint", async () => {
  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-1",
      name: "create_appointment_request",
      arguments: "{\"service\":\"Dental consultation\"}",
    },
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_1",
    },
    call: {
      id: "voice-call-1",
      language: "az",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      defaultLanguage: "az",
      actions: {
        appointment: {
          mode: "request_only",
        },
      },
    },
    reserveExecution: allowReservation,
  });

  assert.equal(dispatched.dispatched, true);
  assert.equal(dispatched.result.status, "missing_required_fields");
  assert.equal(dispatched.result.confirmed, false);
  assert.equal(dispatched.result.nextMissing?.field, "preferredDateOrTime");
  assert.equal(dispatched.result.nextPromptHint?.field, "preferredDateOrTime");
  assert.equal("assistantInstruction" in dispatched.result, false);
  assert.equal("nextQuestion" in dispatched.result, false);

  assert.equal(dispatched.outboundEvents.length, 2);
  assert.equal(dispatched.outboundEvents[0].type, "conversation.item.create");
  assert.equal(dispatched.outboundEvents[0].item.call_id, "tool-call-1");
  assert.equal(dispatched.outboundEvents[1].type, "response.create");
  assert.equal(dispatched.outboundEvents[1].response?.instructions, undefined);

  assert.equal(dispatched.resultTrace.eventType, "voice.sideband.tool_result");
  assert.equal(
    dispatched.resultTrace.payload.sidebandToolDispatcherVersion,
    VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION
  );
  assert.equal(dispatched.resultTrace.payload.nextMissing.field, "preferredDateOrTime");
});

test("sideband tool dispatcher returns call patch for completed request actions", async () => {
  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-2",
      name: "create_handoff_request",
      arguments: {
        reason: "operator",
        phone: "+994501112233",
        summary: "Caller wants operator follow-up",
      },
    },
    call: {
      id: "voice-call-2",
      extraction: {},
      meta: {},
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      actions: {
        handoff: {
          mode: "request_only",
        },
      },
    },
    reserveExecution: allowReservation,
  });

  assert.equal(dispatched.dispatched, true);
  assert.equal(dispatched.result.status, "request_recorded");
  assert.equal(dispatched.result.confirmed, false);
  assert.equal(dispatched.callPatch.handoffRequested, true);
  assert.equal(dispatched.callPatch.callbackRequested, true);
  assert.equal(dispatched.callPatch.callbackPhone, "+994501112233");
  assert.equal(dispatched.callPatch.meta.lastVoiceAction.action, "create_handoff_request");
});

test("sideband tool dispatcher uses provider adapter output builder", async () => {
  const adapterCalls = [];
  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-adapter",
      name: "create_handoff_request",
      arguments: {
        reason: "operator",
        phone: "+994501112233",
      },
    },
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_1",
    },
    call: {
      id: "voice-call-adapter",
      extraction: {},
      meta: {},
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    reserveExecution: allowReservation,
    executeAction: async () => ({
      ok: true,
      status: "request_recorded",
    }),
    getProviderAdapter: (provider) => ({
      provider,
      status: "supported",
      reasonCode: "",
      buildToolOutputEvents: ({ toolCall, result, includeResponseCreate }) => {
        adapterCalls.push({
          toolCallId: toolCall.id,
          status: result.status,
          includeResponseCreate,
        });
        return {
          ok: true,
          provider,
          status: "built",
          reasonCode: "",
          outboundEvents: [
            {
              type: "adapter.output",
              callId: toolCall.id,
            },
          ],
        };
      },
    }),
  });

  assert.equal(dispatched.ok, true);
  assert.deepEqual(adapterCalls, [
    {
      toolCallId: "tool-call-adapter",
      status: "request_recorded",
      includeResponseCreate: true,
    },
  ]);
  assert.deepEqual(dispatched.outboundEvents, [
    {
      type: "adapter.output",
      callId: "tool-call-adapter",
    },
  ]);
});

test("sideband tool dispatcher returns unsupported result for unsupported provider", async () => {
  let executeCount = 0;

  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-unsupported",
      name: "create_handoff_request",
      arguments: {
        reason: "operator",
      },
    },
    target: {
      provider: "elevenlabs",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_unsupported",
    },
    call: {
      id: "voice-call-unsupported",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    executeAction: async () => {
      executeCount += 1;
      throw new Error("unsupported provider should not execute");
    },
  });

  assert.equal(dispatched.ok, false);
  assert.equal(dispatched.dispatched, false);
  assert.equal(dispatched.status, "unsupported");
  assert.equal(dispatched.reasonCode, "unsupported_realtime_provider");
  assert.equal(dispatched.providerAdapter.provider, "elevenlabs");
  assert.deepEqual(dispatched.outboundEvents, []);
  assert.equal(executeCount, 0);
});

test("sideband tool output events stay serializable", () => {
  const events = buildRealtimeSidebandToolOutputEvents({
    toolCall: {
      id: "tool-call-3",
      name: "create_handoff_request",
    },
    result: {
      ok: true,
      status: "request_recorded",
      requestId: "req-1",
    },
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].item.type, "function_call_output");
  assert.deepEqual(JSON.parse(events[0].item.output).status, "request_recorded");
  assert.equal(events[1].type, "response.create");
});
