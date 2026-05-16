import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApprovalBlockers,
  isDraftReadyForApproval,
  validateStepAnswer,
} from "../src/services/workspace/setup/setupAssistantApp/relevance.js";
import { buildDraft } from "./setup-assistant-test-helpers.js";

test("setup readiness is business-only and does not use keyword parsing", () => {
  const draft = buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ type: "phone", value: "+994551112233" }],
    pricingPosture: {
      publicSummary: "Pricing depends on the service.",
    },
  });

  assert.deepEqual(buildApprovalBlockers(draft), []);
  assert.equal(isDraftReadyForApproval(draft), true);
});

test("setup readiness requires only company description services contacts pricing", () => {
  const draft = buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
  });

  assert.deepEqual(
    buildApprovalBlockers(draft).map((item) => item.step),
    ["services", "contacts", "pricing"]
  );
});

test("hours handoff and legacy behavior answers are optional for setup approval", () => {
  assert.equal(validateStepAnswer("hours", "Mon-Fri 09:00-18:00").accepted, true);
  assert.equal(validateStepAnswer("handoff", "urgent cases to operator").accepted, true);
  assert.equal(validateStepAnswer("pricing_behavior", "ask service first").accepted, true);
});
