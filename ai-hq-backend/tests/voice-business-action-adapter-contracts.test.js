import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBusinessActionAdapterContract,
  buildBusinessActionAdapterContracts,
  normalizeBusinessActionProvider,
} from "../src/modules/voice/adapters/businessActionAdapterContracts.js";

test("business action provider aliases normalize into canonical providers", () => {
  assert.equal(normalizeBusinessActionProvider("google-calendar"), "calendar");
  assert.equal(normalizeBusinessActionProvider("internal_demo"), "demo");
  assert.equal(normalizeBusinessActionProvider("webhook"), "external_api");
  assert.equal(normalizeBusinessActionProvider("excel"), "spreadsheet");
});

test("live availability without a real provider is blocked", () => {
  const contract = buildBusinessActionAdapterContract({
    actionName: "check_availability",
    runtimeConfig: {
      actions: {
        availability: {
          mode: "live",
        },
      },
    },
  });

  assert.equal(contract.actionName, "check_availability");
  assert.equal(contract.live, true);
  assert.equal(contract.ready, false);
  assert.equal(contract.productionReady, false);
  assert.equal(contract.reasonCode, "live_business_action_provider_not_configured");
});

test("live appointment with calendar provider can confirm live transaction", () => {
  const contract = buildBusinessActionAdapterContract({
    actionName: "create_appointment_request",
    runtimeConfig: {
      actions: {
        appointment: {
          mode: "live",
          provider: "calendar",
        },
      },
    },
  });

  assert.equal(contract.provider, "calendar");
  assert.equal(contract.live, true);
  assert.equal(contract.ready, true);
  assert.equal(contract.productionReady, true);
  assert.equal(contract.confirmsLiveTransaction, true);
});

test("request-only universal business request records request without live confirmation", () => {
  const contract = buildBusinessActionAdapterContract({
    actionName: "create_business_request",
    runtimeConfig: {
      actions: {
        universalRequest: {
          mode: "request_only",
          provider: "internal_request",
        },
      },
    },
  });

  assert.equal(contract.provider, "internal_request");
  assert.equal(contract.requestOnly, true);
  assert.equal(contract.ready, true);
  assert.equal(contract.recordsRequest, true);
  assert.equal(contract.confirmsLiveTransaction, false);
});

test("demo provider is allowed for lab but not production-ready", () => {
  const contract = buildBusinessActionAdapterContract({
    actionName: "check_availability",
    runtimeConfig: {
      actions: {
        availability: {
          mode: "live",
          provider: "demo",
        },
      },
    },
  });

  assert.equal(contract.provider, "demo");
  assert.equal(contract.ready, true);
  assert.equal(contract.productionReady, false);
  assert.equal(contract.reasonCode, "demo_business_action_provider");
});

test("business action adapter contract list covers core voice actions", () => {
  const contracts = buildBusinessActionAdapterContracts({
    actions: {
      availability: { mode: "disabled" },
      universalRequest: { mode: "request_only", provider: "internal_request" },
      handoff: { mode: "request_only", provider: "manual" },
    },
  });

  assert.ok(contracts.find((item) => item.actionName === "check_availability"));
  assert.ok(contracts.find((item) => item.actionName === "create_business_request"));
  assert.ok(contracts.find((item) => item.actionName === "create_handoff_request"));
  assert.ok(contracts.find((item) => item.actionName === "end_call"));
});
