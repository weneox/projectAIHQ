import test from "node:test";
import assert from "node:assert/strict";

import {
  executeVoiceAction,
} from "../src/modules/voice/actions/voiceActionRuntime.js";

test("executeVoiceAction blocks live availability when provider is not configured", async () => {
  const result = await executeVoiceAction({
    name: "check_availability",
    args: {
      intent: "table",
      date: "2026-06-01",
      time: "20:00",
      partySize: 2,
    },
    runtimeConfig: {
      actions: {
        availability: {
          mode: "live",
        },
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "provider_not_configured");
  assert.equal(result.businessActionAdapter.ready, false);
  assert.equal(
    result.businessActionAdapter.reasonCode,
    "live_business_action_provider_not_configured"
  );
});

test("executeVoiceAction keeps demo availability as lab-only and exposes adapter evidence", async () => {
  const result = await executeVoiceAction({
    name: "check_availability",
    args: {
      intent: "room",
      date: "2026-06-01",
    },
    runtimeConfig: {
      actions: {
        businessFamily: "hotel",
        availability: {
          mode: "live",
          provider: "demo",
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "live_available");
  assert.equal(result.businessActionAdapter.provider, "demo");
  assert.equal(result.businessActionAdapter.productionReady, false);
  assert.equal(result.businessActionAdapter.reasonCode, "demo_business_action_provider");
});

test("executeVoiceAction records request-only business action through adapter contract", async () => {
  const result = await executeVoiceAction({
    name: "create_business_request",
    args: {
      requestType: "booking_request",
      issue: "Need a room for tomorrow",
      phone: "+994501112233",
    },
    call: {
      id: "call-1",
    },
    scope: {
      tenantId: "tenant-1",
      tenantKey: "hotel-demo",
    },
    runtimeConfig: {
      actions: {
        universalRequest: {
          mode: "request_only",
          provider: "internal_request",
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "request_recorded");
  assert.equal(result.confirmed, false);
  assert.equal(result.businessActionAdapter.provider, "internal_request");
  assert.equal(result.businessActionAdapter.recordsRequest, true);
  assert.equal(result.businessActionAdapter.confirmsLiveTransaction, false);
});

test("executeVoiceAction blocks request action when provider contract is not ready", async () => {
  const result = await executeVoiceAction({
    name: "create_appointment_request",
    args: {
      service: "consultation",
      date: "2026-06-01",
      customerName: "Test User",
      phone: "+994501112233",
    },
    runtimeConfig: {
      actions: {
        appointment: {
          mode: "request_only",
          provider: "unknown-provider",
        },
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "provider_not_configured");
  assert.equal(result.businessActionAdapter.ready, false);
  assert.equal(
    result.businessActionAdapter.reasonCode,
    "request_business_action_provider_not_configured"
  );
});
