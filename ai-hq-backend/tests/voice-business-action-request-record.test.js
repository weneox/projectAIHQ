import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessActionRequestId,
  buildBusinessActionRequestRecord,
} from "../src/modules/voice/adapters/businessActionRequestRecord.js";
import {
  buildBusinessActionAdapterContract,
} from "../src/modules/voice/adapters/businessActionAdapterContracts.js";
import {
  executeBusinessActionWithAdapter,
} from "../src/modules/voice/adapters/businessActionExecutorRegistry.js";

test("business action request id is stable for same tenant call action payload", () => {
  const first = buildBusinessActionRequestId({
    tenantKey: "hotel-demo",
    callId: "call-1",
    actionName: "create_business_request",
    payload: {
      phone: "+994501112233",
      issue: "Need a room",
    },
  });

  const second = buildBusinessActionRequestId({
    tenantKey: "hotel-demo",
    callId: "call-1",
    actionName: "create_business_request",
    payload: {
      issue: "Need a room",
      phone: "+994501112233",
    },
  });

  assert.equal(first, second);
  assert.match(first, /^voice_request:hotel-demo:call-1:create_business_request:/);
});

test("business action request record contains tenant call customer adapter and audit evidence", () => {
  const adapter = buildBusinessActionAdapterContract({
    actionName: "create_appointment_request",
    runtimeConfig: {
      businessFamily: "clinic",
      actions: {
        appointment: {
          mode: "request_only",
          provider: "internal_request",
        },
      },
    },
  });

  const record = buildBusinessActionRequestRecord({
    actionName: "create_appointment_request",
    args: {
      service: "consultation",
      date: "2026-06-01",
      time: "11:00",
      customerName: "Test User",
      phone: "+994501112233",
    },
    call: {
      id: "call-1",
      sessionId: "session-1",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "clinic-demo",
    },
    runtimeConfig: {
      businessFamily: "clinic",
      version: "runtime.v1",
    },
    businessActionAdapter: adapter,
    now: "2026-05-23T00:00:00.000Z",
  });

  assert.equal(record.version, "voice_business_action_request_record.v1");
  assert.equal(record.status, "open");
  assert.equal(record.source, "voice");
  assert.equal(record.actionName, "create_appointment_request");
  assert.equal(record.businessFamily, "clinic");
  assert.equal(record.tenantKey, "clinic-demo");
  assert.equal(record.callId, "call-1");
  assert.equal(record.sessionId, "session-1");
  assert.equal(record.customer.phone, "+994501112233");
  assert.equal(record.adapter.provider, "internal_request");
  assert.equal(record.adapter.recordsRequest, true);
  assert.equal(record.audit.createdBy, "voice_action_executor");
});

test("internal request executor returns canonical requestRecord and idempotencyKey", async () => {
  const adapter = buildBusinessActionAdapterContract({
    actionName: "create_business_request",
    runtimeConfig: {
      businessFamily: "hotel",
      actions: {
        universalRequest: {
          mode: "request_only",
          provider: "internal_request",
        },
      },
    },
  });

  const result = await executeBusinessActionWithAdapter({
    actionName: "create_business_request",
    args: {
      requestType: "booking_request",
      issue: "Need a room tomorrow",
      phone: "+994501112233",
    },
    call: {
      id: "call-1",
      sessionId: "session-1",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "hotel-demo",
    },
    runtimeConfig: {
      businessFamily: "hotel",
    },
    businessActionAdapter: adapter,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "request_recorded");
  assert.equal(result.requestId, result.requestRecord.id);
  assert.equal(result.idempotencyKey, result.requestRecord.idempotencyKey);
  assert.equal(result.requestRecord.tenantKey, "hotel-demo");
  assert.equal(result.requestRecord.customer.phone, "+994501112233");
  assert.equal(result.requestRecord.adapter.provider, "internal_request");
});
