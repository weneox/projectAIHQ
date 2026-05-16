import test from "node:test";
import assert from "node:assert/strict";

import {
  SECTION_ORDER,
  __test__ as questionsTest,
  getNextQuestion,
  isQuestionSatisfied,
} from "../src/services/workspace/setup/setupAssistantApp/questions.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
} from "./setup-assistant-test-helpers.js";

test("business steps stay ordered and behavior steps are no longer part of setup interview", () => {
  const draft = buildDraft({
    businessProfile: {
      description: "Dental clinic in Baku",
    },
    pricingPosture: {
      publicSummary: "Starts from 20 AZN.",
    },
    contacts: [{ value: "+994551112233" }],
    handoffRules: {
      enabled: true,
      summary:
        "If the customer asks for an operator, there is a complaint, or it is urgent, route to a human.",
    },
  });

  assert.deepEqual(SECTION_ORDER, [
    "company",
    "description",
    "services",
    "contacts",
    "hours",
    "pricing",
    "handoff",
  ]);
  assert.equal(
    questionsTest.isBehaviorStepRelevant("pricing_behavior", draft),
    false
  );
  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }).key, "company");
});

test("getNextQuestion stops after business steps are complete", () => {
  const draft = buildCompleteBusinessDraft();

  const next = getNextQuestion({}, draft, {}, { locale: "en" });

  assert.equal(next, null);
});

test("legacy behavior steps are treated as satisfied compatibility no-ops", () => {
  const draft = buildCompleteBusinessDraft();

  assert.equal(isQuestionSatisfied("greeting_behavior", draft), true);
  assert.equal(isQuestionSatisfied("closing_behavior", draft), true);
  assert.equal(isQuestionSatisfied("tone_behavior", draft), true);
  assert.equal(isQuestionSatisfied("pricing_behavior", draft), true);
  assert.equal(isQuestionSatisfied("contact_behavior", draft), true);
  assert.equal(isQuestionSatisfied("handoff_behavior", draft), true);
  assert.equal(isQuestionSatisfied("location_behavior", draft), true);
  assert.equal(isQuestionSatisfied("booking_behavior", draft), true);
  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }), null);
});
