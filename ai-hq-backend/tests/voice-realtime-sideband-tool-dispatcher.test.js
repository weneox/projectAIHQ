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

test("sideband tool dispatcher executes missing-field action with server-authored followup", async () => {
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
  assert.match(dispatched.result.assistantInstruction, /Ask exactly this one question next/);
  assert.equal(dispatched.outboundEvents.length, 2);
  assert.equal(dispatched.outboundEvents[0].type, "conversation.item.create");
  assert.equal(dispatched.outboundEvents[0].item.call_id, "tool-call-1");
  assert.equal(dispatched.outboundEvents[1].type, "response.create");
  assert.match(
    dispatched.outboundEvents[1].response.instructions,
    /Ask exactly this one question next/
  );
  assert.equal(dispatched.resultTrace.eventType, "voice.sideband.tool_result");
  assert.equal(
    dispatched.resultTrace.payload.sidebandToolDispatcherVersion,
    VOICE_REALTIME_SIDEBAND_TOOL_DISPATCHER_VERSION
  );
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
