import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  INTENT_ONLY_RESPONSES,
  SECTION_ORDER,
  getNextQuestion,
  isQuestionSatisfied,
  normalizeQuestionKey,
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
  assert.equal(isQuestionSatisfied("pricing_behavior", draft), false);
  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }).key, "company");
});

test("getNextQuestion stops after business steps are complete", () => {
  const draft = buildCompleteBusinessDraft();

  const next = getNextQuestion({}, draft, {}, { locale: "en" });

  assert.equal(next, null);
});

test("legacy behavior keys are not setup questions anymore", () => {
  const draft = buildCompleteBusinessDraft();

  for (const key of [
    "greeting_behavior",
    "closing_behavior",
    "tone_behavior",
    "pricing_behavior",
    "contact_behavior",
    "handoff_behavior",
    "location_behavior",
    "booking_behavior",
  ]) {
    assert.equal(isQuestionSatisfied(key, draft), false);
  }

  assert.equal(normalizeQuestionKey("pricing_policy"), "pricing_policy");
  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }), null);
});

test("setup question module keeps only navigation intents, not business fact keywords", () => {
  assert.equal(INTENT_ONLY_RESPONSES.ok, "__continue__");
  assert.equal(INTENT_ONLY_RESPONSES.skip, "__skip__");
  assert.equal(Object.prototype.hasOwnProperty.call(INTENT_ONLY_RESPONSES, "24/7"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(INTENT_ONLY_RESPONSES, "quote required"),
    false
  );

  const source = fs.readFileSync(
    new URL(
      "../src/services/workspace/setup/setupAssistantApp/questions.js",
      import.meta.url
    ),
    "utf8"
  );

  for (const token of [
    "appointment only",
    "quote required",
    "greeting_policy",
    "pricing_policy",
    "_behavior$",
    "isBehaviorStepRelevant",
    "hasGreetingBehaviorConfigured",
  ]) {
    assert.equal(source.includes(token), false, `${token} must not remain`);
  }
});
