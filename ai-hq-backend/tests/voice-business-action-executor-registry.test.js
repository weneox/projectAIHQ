import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessActionAdapterContract,
} from "../src/modules/voice/adapters/businessActionAdapterContracts.js";
import {
  createBusinessActionExecutorRegistry,
  executeBusinessActionWithAdapter,
  resolveBusinessActionExecutor,
} from "../src/modules/voice/adapters/businessActionExecutorRegistry.js";

test("business action executor registry resolves demo availability executor", async () => {
  const registry = createBusinessActionExecutorRegistry();
  const executor = resolveBusinessActionExecutor({
    registry,
    provider: "demo",
    actionName: "check_availability",
  });

  assert.equal(typeof executor, "function");

  const result = await executeBusinessActionWithAdapter({
    actionName: "check_availability",
    args: {
      intent: "table",
      date: "2026-06-01",
      time: "20:00",
      partySize: 2,
    },
    businessActionAdapter: buildBusinessActionAdapterContract({
      actionName: "check_availability",
      runtimeConfig: {
        actions: {
          availability: {
            mode: "live",
            provider: "demo",
          },
        },
      },
    }),
    registry,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "live_available");
  assert.equal(result.confirmed, true);
  assert.equal(result.businessActionAdapter.provider, "demo");
});

test("business action executor registry records internal request", async () => {
  const result = await executeBusinessActionWithAdapter({
    actionName: "create_business_request",
    args: {
      requestType: "booking_request",
      issue: "Need a room tomorrow",
      phone: "+994501112233",
    },
    call: {
      id: "call-1",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "hotel-demo",
    },
    businessActionAdapter: buildBusinessActionAdapterContract({
      actionName: "create_business_request",
      runtimeConfig: {
        actions: {
          universalRequest: {
            mode: "request_only",
            provider: "internal_request",
          },
        },
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "request_recorded");
  assert.equal(result.confirmed, false);
  assert.equal(result.requestOnly, true);
  assert.equal(result.tenantKey, "hotel-demo");
  assert.match(result.requestId, /^voice_request:hotel-demo:call-1:create_business_request:/);
});

test("business action executor registry blocks not-ready adapter", async () => {
  const result = await executeBusinessActionWithAdapter({
    actionName: "create_appointment_request",
    args: {
      service: "consultation",
      phone: "+994501112233",
    },
    businessActionAdapter: buildBusinessActionAdapterContract({
      actionName: "create_appointment_request",
      runtimeConfig: {
        actions: {
          appointment: {
            mode: "request_only",
            provider: "unknown-provider",
          },
        },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "provider_not_configured");
  assert.equal(
    result.reasonCode,
    "request_business_action_provider_not_configured"
  );
});

test("business action executor registry reports configured provider without executor", async () => {
  const result = await executeBusinessActionWithAdapter({
    actionName: "create_appointment_request",
    args: {
      service: "consultation",
      date: "2026-06-01",
      customerName: "Test User",
      phone: "+994501112233",
    },
    businessActionAdapter: buildBusinessActionAdapterContract({
      actionName: "create_appointment_request",
      runtimeConfig: {
        actions: {
          appointment: {
            mode: "live",
            provider: "calendar",
          },
        },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "executor_not_implemented");
  assert.equal(result.reasonCode, "business_action_executor_not_implemented");
  assert.equal(result.businessActionAdapter.ready, true);
});

test("business action executor registry supports custom executors", async () => {
  const registry = createBusinessActionExecutorRegistry({
    "calendar:create_appointment_request": async ({ args, businessActionAdapter }) => ({
      ok: true,
      action: "create_appointment_request",
      status: "appointment_confirmed",
      confirmed: true,
      live: true,
      payload: args,
      businessActionAdapter,
    }),
  });

  const result = await executeBusinessActionWithAdapter({
    actionName: "create_appointment_request",
    args: {
      service: "consultation",
      date: "2026-06-01",
      customerName: "Test User",
      phone: "+994501112233",
    },
    businessActionAdapter: buildBusinessActionAdapterContract({
      actionName: "create_appointment_request",
      runtimeConfig: {
        actions: {
          appointment: {
            mode: "live",
            provider: "calendar",
          },
        },
      },
    }),
    registry,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "appointment_confirmed");
  assert.equal(result.confirmed, true);
});
