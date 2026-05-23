import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessActionSinkContract,
  normalizeBusinessActionSinkName,
} from "../src/modules/voice/sinks/businessActionSinkContracts.js";
import {
  buildBusinessActionSinkDeliverySnapshot,
  createBusinessActionSinkRegistry,
  dispatchBusinessActionSinks,
  resolveBusinessActionSinkExecutor,
} from "../src/modules/voice/sinks/businessActionSinkRegistry.js";

const requestRecord = {
  id: "voice_request:hotel-demo:call-1:create_business_request:abc",
  tenantId: "tenant-1",
  tenantKey: "hotel-demo",
  callId: "call-1",
  requestType: "booking_request",
  businessFamily: "hotel",
  payload: {
    issue: "Need a room",
    phone: "+994501112233",
  },
};

test("business action sink names normalize aliases", () => {
  assert.equal(normalizeBusinessActionSinkName("operator-inbox"), "inbox");
  assert.equal(normalizeBusinessActionSinkName("google calendar"), "calendar");
  assert.equal(normalizeBusinessActionSinkName("external_api"), "webhook");
  assert.equal(normalizeBusinessActionSinkName("core"), "voice_core");
});

test("voice core sink is ready by default", () => {
  const contract = buildBusinessActionSinkContract({
    sink: "voice_core",
    requestRecord,
  });

  assert.equal(contract.sink, "voice_core");
  assert.equal(contract.enabled, true);
  assert.equal(contract.ready, true);
  assert.equal(contract.requestId, requestRecord.id);
});

test("inbox sink is disabled unless runtime enables it", () => {
  const contract = buildBusinessActionSinkContract({
    sink: "inbox",
    requestRecord,
  });

  assert.equal(contract.sink, "inbox");
  assert.equal(contract.enabled, false);
  assert.equal(contract.ready, false);
  assert.equal(contract.reasonCode, "voice_business_action_sink_disabled");
});

test("enabled inbox sink needs a configured executor", async () => {
  const dispatch = await dispatchBusinessActionSinks({
    requestRecord,
    sinks: ["voice_core", "inbox"],
    runtimeConfig: {
      businessActionSinks: {
        inbox: {
          enabled: true,
        },
      },
    },
  });

  assert.equal(dispatch.ok, false);
  assert.equal(dispatch.sinkDelivery.voice_core, "recorded");
  assert.equal(dispatch.sinkDelivery.inbox, "not_configured");
  assert.equal(dispatch.deliveries[0].sink, "voice_core");
  assert.equal(dispatch.deliveries[0].status, "recorded");
  assert.equal(dispatch.deliveries[1].sink, "inbox");
  assert.equal(dispatch.deliveries[1].status, "not_configured");
  assert.equal(
    dispatch.deliveries[1].reasonCode,
    "voice_business_action_sink_executor_not_configured"
  );
});

test("custom inbox sink executor can deliver request record", async () => {
  const registry = createBusinessActionSinkRegistry({
    inbox: async ({ requestRecord: record }) => ({
      ok: true,
      sink: "inbox",
      status: "delivered",
      requestId: record.id,
      inboxThreadId: "thread-1",
    }),
  });

  const executor = resolveBusinessActionSinkExecutor({
    registry,
    sink: "inbox",
  });

  assert.equal(typeof executor, "function");

  const dispatch = await dispatchBusinessActionSinks({
    requestRecord,
    sinks: ["voice_core", "inbox"],
    runtimeConfig: {
      businessActionSinks: {
        inbox: {
          enabled: true,
        },
      },
    },
    registry,
  });

  assert.equal(dispatch.ok, true);
  assert.equal(dispatch.deliveries[1].status, "delivered");
  assert.equal(dispatch.deliveries[1].inboxThreadId, "thread-1");

  const snapshot = buildBusinessActionSinkDeliverySnapshot({
    deliveries: dispatch.deliveries,
  });

  assert.equal(snapshot.voiceCore, "recorded");
  assert.equal(snapshot.inbox, "delivered");
  assert.equal(snapshot.calendar, "not_attempted");
});
