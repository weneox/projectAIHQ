import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApprovalBlockers,
  isDraftReadyForApproval,
  validateStepAnswer,
} from "../src/services/workspace/setup/setupAssistantApp/relevance.js";
import { buildCompleteBusinessDraft } from "./setup-assistant-test-helpers.js";

test("business validation rejects greetings and meta chat but accepts real business answers", () => {
  assert.equal(validateStepAnswer("services", "hello", {}).accepted, false);
  assert.equal(
    validateStepAnswer("pricing", "How are you?", {}).reasonCode,
    "rejected_pricing"
  );

  assert.equal(
    validateStepAnswer(
      "description",
      "Dental clinic for consultation, whitening, and implants.",
      {}
    ).accepted,
    true
  );
  assert.equal(
    validateStepAnswer(
      "handoff",
      "If the customer asks for an operator, there is a complaint, or it is urgent, route to a human.",
      {}
    ).accepted,
    true
  );
});

test("behavior validation accepts the new behavior-style answers", () => {
  const cases = [
    ["pricing_behavior", "q\u0131sa cavab + pricing page"],
    ["pricing_behavior", "ask service first"],
    ["location_behavior", "\u00FCnvan + x\u0259rit\u0259"],
    ["location_behavior", "map first"],
    ["booking_behavior", "route to WhatsApp"],
    ["booking_behavior", "Instagram DM"],
    ["booking_behavior", "collect details first"],
    ["contact_behavior", "WhatsApp first"],
    ["contact_behavior", "phone first"],
    ["contact_behavior", "email first"],
    ["handoff_behavior", "contextual handoff"],
    ["handoff_behavior", "ask reason first"],
    ["handoff_behavior", "direct handoff"],
  ];

  for (const [step, answer] of cases) {
    const result = validateStepAnswer(step, answer, {});
    assert.equal(result.accepted, true, `${step} should accept "${answer}"`);
  }
});

test("approval blockers include only relevant missing behavior steps", () => {
  const draft = buildCompleteBusinessDraft({
    contacts: [{ value: "https://wa.me/994551112233", preferred: true }],
    assistantBehaviorDraft: {
      pricingPolicy: {
        mode: "ask_service_first",
        askServiceFirst: true,
      },
    },
  });

  const blockers = buildApprovalBlockers(draft);
  const steps = blockers.map((item) => item.step);

  assert.deepEqual(steps, [
    "booking_behavior",
    "contact_behavior",
    "handoff_behavior",
  ]);
  assert.equal(steps.includes("location_behavior"), false);
  assert.equal(isDraftReadyForApproval(draft), false);
});

