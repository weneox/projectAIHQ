import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceLabScenarioInstructions,
  getVoiceLabScenario,
  listVoiceLabScenarios,
  requireVoiceLabScenario,
} from "../src/modules/voice/labScenarios.js";
import { normalizeVoiceLabEvaluation } from "../src/modules/voice/labEvaluation.js";

test("voice lab canonical scenario library exposes hotel and business call scenarios", () => {
  const scenarios = listVoiceLabScenarios();

  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    [
      "hotel_booking_inquiry",
      "hotel_business_faq",
      "restaurant_order",
      "appointment_booking",
      "business_faq",
      "support_complaint",
      "sales_lead",
      "emergency_out_of_scope",
    ]
  );

  for (const scenario of scenarios) {
    assert.ok(scenario.callerScript);
    assert.ok(scenario.expectedOutcome);
    assert.ok(scenario.redFlags.length >= 3);
    assert.ok(scenario.checklist.length >= 4);
    assert.ok(scenario.requiredSlots.length >= 1);
    assert.ok(scenario.actionTarget);
    assert.ok(scenario.handoffPolicy);
  }
});

test("voice lab canonical scenario instructions include quality guardrails", () => {
  const instructions = buildVoiceLabScenarioInstructions({
    baseInstructions: "Base receptionist prompt.",
    scenarioId: "business_faq",
  });

  assert.match(instructions, /Base receptionist prompt/);
  assert.match(instructions, /Expected outcome:/);
  assert.match(instructions, /Red flags to avoid:/);
  assert.match(instructions, /no invented facts/i);
});

test("voice lab evaluation uses canonical scenario metadata", () => {
  const evaluation = normalizeVoiceLabEvaluation({
    scenarioId: "sales_lead",
    evaluation: {
      language: "good",
      naturalness: 4,
      brevity: 4,
      taskCompletion: 4,
      truthfulness: 4,
      handoffSense: 4,
    },
  });

  assert.equal(evaluation.scenarioId, "sales_lead");
  assert.equal(evaluation.scenarioTitle, "Sales lead qualification");
  assert.equal(evaluation.businessType, "sales");
});

test("voice lab unknown scenario fails closed", () => {
  assert.equal(getVoiceLabScenario("missing"), null);
  assert.throws(() => requireVoiceLabScenario("missing"), /voice_lab_scenario_unknown/);
});

test("voice lab scenario aliases keep legacy ids compatible", () => {
  assert.equal(getVoiceLabScenario("hotel")?.id, "hotel_booking_inquiry");
  assert.equal(getVoiceLabScenario("hotel_faq")?.id, "hotel_business_faq");
  assert.equal(getVoiceLabScenario("clinic_booking")?.id, "appointment_booking");
  assert.equal(getVoiceLabScenario("restaurant")?.id, "restaurant_order");
  assert.equal(getVoiceLabScenario("support")?.id, "support_complaint");
});

test("voice lab scenario instructions include slot capture contract", () => {
  const instructions = buildVoiceLabScenarioInstructions({
    baseInstructions: "Base receptionist prompt.",
    scenarioId: "restaurant_order",
  });

  assert.match(instructions, /Required information to collect:/);
  assert.match(instructions, /items/);
  assert.match(instructions, /customer_phone/);
  assert.match(instructions, /Action target after the call:/);
  assert.match(instructions, /Handoff policy:/);
});
