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

function duplicateReservation(input = {}) {
  return {
    ok: true,
    skipped: false,
    acquired: false,
    duplicate: true,
    reasonCode: "voice_realtime_tool_execution_duplicate",
    idempotencyKey: input.idempotencyKey || "idem-duplicate",
    leaseToken: "lease-duplicate",
    recordState: "sent",
    source: input.source,
    record: {
      state: "sent",
      provider_response: input.providerResponse || {},
    },
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

test("sideband tool dispatcher dispatches inbox sink and links request-recorded call patch", async () => {
  const calls = [];
  const requestRecord = {
    id: "voice_request:acme:voice-call-sink:create_business_request:test",
    tenantId: "tenant-1",
    tenantKey: "acme",
    callId: "voice-call-sink",
    actionName: "create_business_request",
    requestType: "callback_request",
    businessFamily: "generic_business",
    priority: "normal",
    summary: "callback_request | Caller wants pricing follow-up | +994501112233",
    customer: {
      phone: "+994501112233",
    },
    payload: {
      requestType: "callback_request",
      issue: "Caller wants pricing follow-up",
      phone: "+994501112233",
    },
  };
  const actionResult = {
    ok: true,
    action: "create_business_request",
    status: "request_recorded",
    confirmed: false,
    requestOnly: true,
    requestId: requestRecord.id,
    idempotencyKey: requestRecord.id,
    provider: "internal_request",
    payload: requestRecord.payload,
    requestRecord,
    callId: "voice-call-sink",
    tenantId: "tenant-1",
    tenantKey: "acme",
    businessActionAdapter: {
      provider: "internal_request",
      ready: true,
      productionReady: true,
      recordsRequest: true,
      confirmsLiveTransaction: false,
    },
    message: "Request was recorded for human or operator follow-up.",
  };
  const sinkDelivery = {
    ok: true,
    sink: "inbox",
    status: "delivered",
    requestId: requestRecord.id,
    inboxThreadId: "inbox-thread-1",
    inboxMessageId: "inbox-message-1",
    reasonCode: "",
  };

  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-sink",
      name: "create_business_request",
      arguments: requestRecord.payload,
    },
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_sink",
    },
    call: {
      id: "voice-call-sink",
      extraction: {},
      meta: {},
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      tenantKey: "acme",
    },
    reserveExecution: allowReservation,
    markExecutionSent: async (input) => {
      calls.push("sent");
      assert.equal(input.providerResponse.source, "sideband_tool_dispatcher");
      assert.equal(input.providerResponse.result.status, "request_recorded");
      assert.equal(input.providerResponse.runtimeConfig.tenantKey, "acme");
      assert.equal(
        input.providerResponse.sinkRuntimeConfig.businessActionSinks.inbox.enabled,
        true
      );
      return {
        state: "sent",
      };
    },
    executeAction: async () => {
      calls.push("execute");
      return actionResult;
    },
    dispatchSinks: async (input) => {
      calls.push("sinks");
      assert.equal(input.requestRecord.id, requestRecord.id);
      assert.equal(input.result, actionResult);
      assert.equal(input.runtimeConfig.businessActionSinks.inbox.enabled, true);
      assert.ok(input.registry);
      return {
        ok: true,
        requestId: requestRecord.id,
        deliveries: [
          {
            ok: true,
            sink: "voice_core",
            status: "recorded",
            requestId: requestRecord.id,
            reasonCode: "",
          },
          sinkDelivery,
        ],
      };
    },
    sinkRegistry: {
      version: "test-sink-registry",
      executors: {},
    },
  });

  assert.deepEqual(calls, ["execute", "sent", "sinks"]);
  assert.equal(dispatched.dispatched, true);
  assert.equal(dispatched.result.status, "request_recorded");
  assert.equal(dispatched.sinkDelivery.inbox, "delivered");
  assert.equal(dispatched.inboxSinkDelivery.inboxThreadId, "inbox-thread-1");
  assert.equal(dispatched.callPatch.inboxThreadId, "inbox-thread-1");
  assert.equal(
    dispatched.callPatch.extraction.voiceOutcome.inboxSinkDelivery.inboxMessageId,
    "inbox-message-1"
  );
  assert.equal(
    dispatched.callPatch.meta.lastVoiceAction.inboxSinkDelivery.inboxThreadId,
    "inbox-thread-1"
  );
  assert.equal(dispatched.resultTrace.payload.sinkDelivery.inbox, "delivered");
  assert.equal(
    dispatched.resultTrace.payload.sinkDispatch.deliveries.some(
      (item) => item.sink === "inbox" && item.inboxThreadId === "inbox-thread-1"
    ),
    true
  );
  assert.equal(
    dispatched.resultTrace.payload.inboxSinkDelivery.inboxMessageId,
    "inbox-message-1"
  );
});

test("sideband duplicate redrives stored business request inbox sink without execution", async () => {
  const requestRecord = {
    id: "voice_request:acme:voice-call-duplicate:create_business_request:test",
    tenantId: "tenant-1",
    tenantKey: "acme",
    callId: "voice-call-duplicate",
    actionName: "create_business_request",
    requestType: "callback_request",
    businessFamily: "generic_business",
    priority: "normal",
    summary: "callback_request | Caller wants pricing follow-up | +994501112233",
    customer: {
      phone: "+994501112233",
    },
    payload: {
      requestType: "callback_request",
      issue: "Caller wants pricing follow-up",
      phone: "+994501112233",
    },
  };
  const storedResult = {
    ok: true,
    action: "create_business_request",
    status: "request_recorded",
    confirmed: false,
    requestOnly: true,
    requestId: requestRecord.id,
    idempotencyKey: requestRecord.id,
    provider: "internal_request",
    payload: requestRecord.payload,
    requestRecord,
    callId: "voice-call-duplicate",
    tenantId: "tenant-1",
    tenantKey: "acme",
    businessActionAdapter: {
      provider: "internal_request",
      ready: true,
      productionReady: true,
      recordsRequest: true,
      confirmsLiveTransaction: false,
    },
    message: "Request was recorded for human or operator follow-up.",
  };
  const storedProviderResponse = {
    source: "sideband_tool_dispatcher",
    toolCallId: "tool-call-duplicate",
    toolName: "create_business_request",
    providerRealtimeCallId: "call_realtime_duplicate",
    resultStatus: "request_recorded",
    result: storedResult,
    runtimeConfig: {
      tenantKey: "stored-runtime",
      businessActionSinks: {
        inbox: {
          enabled: false,
        },
      },
    },
    sinkRuntimeConfig: {
      tenantKey: "stored-sink-runtime",
      businessActionSinks: {
        inbox: {
          enabled: true,
        },
      },
    },
  };
  const calls = [];

  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-duplicate",
      name: "create_business_request",
      arguments: requestRecord.payload,
    },
    target: {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "call_realtime_duplicate",
    },
    call: {
      id: "voice-call-duplicate",
      extraction: {},
      meta: {},
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    runtimeConfig: {
      tenantKey: "current-runtime",
      businessActionSinks: {
        inbox: {
          enabled: false,
        },
      },
    },
    reserveExecution: async (input) =>
      duplicateReservation({
        idempotencyKey: input.idempotencyKey,
        providerResponse: storedProviderResponse,
        source: input.source,
      }),
    markExecutionSent: async () => {
      throw new Error("duplicate should not mark sent again");
    },
    executeAction: async () => {
      throw new Error("duplicate should not execute action");
    },
    dispatchSinks: async (input) => {
      calls.push("sinks");
      assert.equal(input.requestRecord.id, requestRecord.id);
      assert.equal(input.result, storedResult);
      assert.equal(input.runtimeConfig.tenantKey, "stored-sink-runtime");
      assert.equal(input.runtimeConfig.businessActionSinks.inbox.enabled, true);
      return {
        ok: true,
        requestId: requestRecord.id,
        deliveries: [
          {
            ok: true,
            sink: "voice_core",
            status: "recorded",
            requestId: requestRecord.id,
            reasonCode: "",
          },
          {
            ok: true,
            sink: "inbox",
            status: "delivered",
            requestId: requestRecord.id,
            inboxThreadId: "inbox-thread-duplicate",
            inboxMessageId: "inbox-message-duplicate",
            reasonCode: "",
          },
        ],
      };
    },
    sinkRegistry: {
      version: "test-sink-registry",
      executors: {},
    },
  });

  assert.deepEqual(calls, ["sinks"]);
  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.dispatched, false);
  assert.equal(dispatched.status, "duplicate_skipped");
  assert.equal(dispatched.result.status, "duplicate_skipped");
  assert.equal(dispatched.duplicateRedrive.attempted, true);
  assert.equal(dispatched.duplicateRedrive.ok, true);
  assert.equal(dispatched.sinkDelivery.inbox, "delivered");
  assert.equal(dispatched.inboxSinkDelivery.inboxThreadId, "inbox-thread-duplicate");
  assert.equal(dispatched.callPatch.inboxThreadId, "inbox-thread-duplicate");
  assert.equal(
    dispatched.callPatch.extraction.voiceOutcome.inboxSinkDelivery.inboxMessageId,
    "inbox-message-duplicate"
  );
  assert.equal(dispatched.outboundEvents.length, 1);
  assert.deepEqual(JSON.parse(dispatched.outboundEvents[0].item.output).status, "duplicate_skipped");
  assert.equal(dispatched.resultTrace.payload.result.status, "duplicate_skipped");
  assert.equal(dispatched.resultTrace.payload.duplicateRedrive.ok, true);
  assert.equal(dispatched.resultTrace.payload.sinkDelivery.inbox, "delivered");
  assert.equal(
    dispatched.resultTrace.payload.inboxSinkDelivery.inboxThreadId,
    "inbox-thread-duplicate"
  );
});

test("sideband duplicate redrive failure does not crash duplicate response", async () => {
  const requestRecord = {
    id: "voice_request:acme:voice-call-redrive-fail:create_business_request:test",
    tenantId: "tenant-1",
    tenantKey: "acme",
    callId: "voice-call-redrive-fail",
    actionName: "create_business_request",
    requestType: "callback_request",
    payload: {
      requestType: "callback_request",
      phone: "+994501112233",
    },
  };
  const storedProviderResponse = {
    result: {
      ok: true,
      action: "create_business_request",
      status: "request_recorded",
      requestId: requestRecord.id,
      requestRecord,
      payload: requestRecord.payload,
    },
    sinkRuntimeConfig: {
      businessActionSinks: {
        inbox: {
          enabled: true,
        },
      },
    },
  };

  const dispatched = await dispatchRealtimeSidebandToolCall({
    event: {
      type: "response.function_call_arguments.done",
      call_id: "tool-call-redrive-fail",
      name: "create_business_request",
      arguments: requestRecord.payload,
    },
    target: {
      provider: "openai",
      providerRealtimeCallId: "call_realtime_redrive_fail",
    },
    call: {
      id: "voice-call-redrive-fail",
      extraction: {},
      meta: {},
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    reserveExecution: async (input) =>
      duplicateReservation({
        idempotencyKey: input.idempotencyKey,
        providerResponse: storedProviderResponse,
        source: input.source,
      }),
    executeAction: async () => {
      throw new Error("duplicate should not execute action");
    },
    dispatchSinks: async () => {
      throw new Error("sink unavailable");
    },
  });

  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.status, "duplicate_skipped");
  assert.deepEqual(dispatched.callPatch, {});
  assert.equal(dispatched.duplicateRedrive.ok, false);
  assert.equal(dispatched.duplicateRedrive.reasonCode, "sideband_duplicate_redrive_failed");
  assert.match(dispatched.resultTrace.payload.duplicateRedrive.errorMessage, /sink unavailable/);
  assert.equal(dispatched.outboundEvents.length, 1);
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
