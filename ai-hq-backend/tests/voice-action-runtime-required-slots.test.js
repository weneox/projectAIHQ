import test from "node:test";
import assert from "node:assert/strict";

import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("voice action runtime blocks incomplete appointment requests", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "implant consultation",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      appointmentMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "preferredDateOrTime"),
    true
  );
  assert.equal(
    result.missingRequired.some((item) => item.field === "customerName"),
    true
  );
});

test("voice action runtime allows complete appointment requests", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "implant consultation",
      date: "tomorrow",
      customerName: "Nigar",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      appointmentMode: "request_only",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "request_recorded");
  assert.equal(result.confirmed, false);
  assert.equal(result.requestOnly, true);
});

test("voice action runtime requires delivery address for delivery orders", async () => {
  const result = await executeVoiceAction({
    name: "create_order_request",
    args: {
      items: [{ name: "Pizza" }],
      fulfillment: "delivery",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "restaurant" },
    runtimeConfig: {
      orderingMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "address"),
    true
  );
});

test("voice action runtime blocks handoff without summary", async () => {
  const result = await executeVoiceAction({
    name: "create_handoff_request",
    args: {
      reason: "price confirmation",
      phone: "+994501112233",
    },
    call: { id: "call_1" },
    scope: { tenantId: "tenant_1", tenantKey: "clinic" },
    runtimeConfig: {
      handoffMode: "request_only",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_required_fields");
  assert.equal(
    result.missingRequired.some((item) => item.field === "summary"),
    true
  );
});
