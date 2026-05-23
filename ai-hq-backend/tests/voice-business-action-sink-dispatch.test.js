import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveBusinessActionSinkNames,
} from "../src/modules/voice/sinks/businessActionSinkContracts.js";
import {
  buildBusinessActionSinkDeliverySnapshot,
  createBusinessActionSinkRegistry,
  dispatchBusinessActionSinks,
} from "../src/modules/voice/sinks/businessActionSinkRegistry.js";
import {
  buildBusinessActionRecordedVoiceEventPayload,
} from "../src/modules/voice/events/businessActionEvents.js";

const requestRecord = {
  id: "voice_request:hotel-demo:call-1:create_business_request:abc",
  tenantId: "tenant-1",
  tenantKey: "hotel-demo",
  callId: "call-1",
  requestType: "booking_request",
  businessFamily: "hotel",
  customer: {
    phone: "+994501112233",
  },
  payload: {
    issue: "Need a room",
    phone: "+994501112233",
  },
};

test("business action sink names always include voice_core and runtime-enabled sinks", () => {
  const names = resolveBusinessActionSinkNames({
    runtimeConfig: {
      businessActionSinks: {
        inbox: { enabled: true },
        calendar: { enabled: true },
      },
    },
  });

  assert.deepEqual(names, ["voice_core", "inbox", "calendar"]);
});

test("business action sink dispatch uses runtime-enabled sinks when explicit sinks are omitted", async () => {
  const registry = createBusinessActionSinkRegistry({
    inbox: async ({ requestRecord: record }) => ({
      ok: true,
      sink: "inbox",
      status: "delivered",
      requestId: record.id,
      inboxThreadId: "thread-1",
    }),
  });

  const dispatch = await dispatchBusinessActionSinks({
    requestRecord,
    result: {
      ok: true,
      action: "create_business_request",
      status: "request_recorded",
      requestRecord,
    },
    runtimeConfig: {
      businessActionSinks: {
        inbox: { enabled: true },
      },
    },
    registry,
  });

  assert.equal(dispatch.ok, true);
  assert.equal(dispatch.deliveries.length, 2);
  assert.equal(dispatch.deliveries[0].sink, "voice_core");
  assert.equal(dispatch.deliveries[0].status, "recorded");
  assert.equal(dispatch.deliveries[1].sink, "inbox");
  assert.equal(dispatch.deliveries[1].status, "delivered");
});

test("business request recorded event includes sink dispatch snapshot", () => {
  const deliveries = [
    {
      ok: true,
      sink: "voice_core",
      status: "recorded",
      requestId: requestRecord.id,
    },
    {
      ok: true,
      sink: "inbox",
      status: "delivered",
      requestId: requestRecord.id,
      inboxThreadId: "thread-1",
    },
  ];

  const sinkDelivery = buildBusinessActionSinkDeliverySnapshot({ deliveries });

  const payload = buildBusinessActionRecordedVoiceEventPayload({
    result: {
      ok: true,
      action: "create_business_request",
      status: "request_recorded",
      requestId: requestRecord.id,
      requestRecord,
    },
    sinkDispatch: {
      ok: true,
      requestId: requestRecord.id,
      deliveries,
    },
    sinkDelivery,
  });

  assert.equal(payload.sinkDelivery.voiceCore, "recorded");
  assert.equal(payload.sinkDelivery.inbox, "delivered");
  assert.equal(payload.sinkDispatch.deliveries.length, 2);
});
