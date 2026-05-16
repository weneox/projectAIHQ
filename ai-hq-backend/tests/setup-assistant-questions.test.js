import test from "node:test";
import assert from "node:assert/strict";

import {
  __test__ as questionsTest,
  getNextQuestion,
  isQuestionSatisfied,
} from "../src/services/workspace/setup/setupAssistantApp/questions.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
} from "./setup-assistant-test-helpers.js";

test("business steps stay ahead of behavior even when behavior becomes relevant", () => {
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

  assert.equal(
    questionsTest.isBehaviorStepRelevant("pricing_behavior", draft),
    true
  );
  assert.equal(
    questionsTest.isBehaviorStepRelevant("location_behavior", draft),
    false
  );
  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }).key, "company");
});

test("getNextQuestion stops after business steps are complete", () => {
  const draft = buildCompleteBusinessDraft();

  const next = getNextQuestion({}, draft, {}, { locale: "en" });

  assert.equal(next, null);
});

test("satisfied behavior steps are skipped and irrelevant behavior is auto-satisfied", () => {
  const draft = buildCompleteBusinessDraft({
    assistantBehaviorDraft: {
      greetingPolicy: {
        mode: "brief_professional",
      },
      closingPolicy: {
        mode: "brief_invite",
      },
      tonePolicy: {
        mode: "direct_clear",
        messageLength: "concise",
      },
      pricingPolicy: {
        mode: "ask_service_first",
        askServiceFirst: true,
      },
      contactPolicy: {
        mode: "call_first",
        preferredChannel: "phone",
      },
      handoffPolicy: {
        mode: "direct_handoff",
        requiresReason: false,
      },
    },
  });

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
