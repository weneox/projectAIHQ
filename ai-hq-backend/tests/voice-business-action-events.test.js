import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessActionRecordedVoiceEventPayload,
  shouldRecordBusinessActionVoiceEvent,
} from "../src/modules/voice/events/businessActionEvents.js";

test("business action voice event is emitted only for recorded request results", () => {
  assert.equal(
    shouldRecordBusinessActionVoiceEvent({
      ok: true,
      action: "create_business_request",
      status: "request_recorded",
      requestRecord: {
        id: "voice_request:tenant:call:create_business_request:abc",
      },
    }),
    true
  );

  assert.equal(
    shouldRecordBusinessActionVoiceEvent({
      ok: false,
      action: "create_business_request",
      status: "missing_required_fields",
    }),
    false
  );

  assert.equal(
    shouldRecordBusinessActionVoiceEvent({
      ok: true,
      action: "check_availability",
      status: "live_available",
    }),
    false
  );
});

test("business action recorded voice event preserves request record and sink state", () => {
  const payload = buildBusinessActionRecordedVoiceEventPayload({
    result: {
      ok: true,
      action: "create_business_request",
      status: "request_recorded",
      requestId: "voice_request:hotel-demo:call-1:create_business_request:abc",
      idempotencyKey: "voice_request:hotel-demo:call-1:create_business_request:abc",
      tenantKey: "hotel-demo",
      callId: "call-1",
      businessActionAdapter: {
        version: "voice_business_action_adapter_contract.v1",
        provider: "internal_request",
        mode: "request_only",
        ready: true,
        productionReady: true,
        recordsRequest: true,
        confirmsLiveTransaction: false,
      },
      requestRecord: {
        id: "voice_request:hotel-demo:call-1:create_business_request:abc",
        idempotencyKey: "voice_request:hotel-demo:call-1:create_business_request:abc",
        tenantKey: "hotel-demo",
        callId: "call-1",
        requestType: "booking_request",
        businessFamily: "hotel",
        priority: "normal",
        summary: "booking_request | Need a room | +994501112233",
        customer: {
          phone: "+994501112233",
        },
        payload: {
          requestType: "booking_request",
          issue: "Need a room",
          phone: "+994501112233",
        },
      },
    },
    toolCallId: "tool-1",
    toolName: "create_business_request",
    providerRealtimeCallId: "rt-1",
    runtimeConfig: {
      tenantKey: "hotel-demo",
    },
    idempotency: {
      idempotencyKey: "tool-finality-key",
      recordState: "sent",
    },
  });

  assert.equal(payload.version, "voice_business_action_event.v1");
  assert.equal(payload.type, "business_request_recorded");
  assert.equal(payload.requestId, "voice_request:hotel-demo:call-1:create_business_request:abc");
  assert.equal(payload.tenantKey, "hotel-demo");
  assert.equal(payload.callId, "call-1");
  assert.equal(payload.customer.phone, "+994501112233");
  assert.equal(payload.adapter.provider, "internal_request");
  assert.equal(payload.tool.toolCallId, "tool-1");
  assert.equal(payload.sinkDelivery.voiceCore, "recorded");
  assert.equal(payload.sinkDelivery.inbox, "not_attempted");
  assert.equal(payload.sinkDelivery.calendar, "not_attempted");
});
