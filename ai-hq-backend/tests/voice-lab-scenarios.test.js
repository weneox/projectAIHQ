import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceLabScenarioInstructions,
  getVoiceLabScenario,
  listVoiceLabScenarios,
  requireVoiceLabScenario,
} from "../src/modules/voice/labScenarios.js";
import { normalizeVoiceLabEvaluation } from "../src/modules/voice/labEvaluation.js";

test("voice lab canonical scenario library exposes six business call scenarios", () => {
  const scenarios = listVoiceLabScenarios();

  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    [
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
