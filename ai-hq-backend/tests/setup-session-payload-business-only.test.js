import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

test("setup session payload source has no behavior setup leftovers", () => {
  const source = fs.readFileSync(
    new URL(
      "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js",
      import.meta.url
    ),
    "utf8"
  );

  for (const token of [
    "BEHAVIOR_SECTION_KEYS",
    "isBehaviorStepRelevant",
    "assistantBehaviorDraft",
    "pricingBehaviorSummary",
    "locationBehaviorSummary",
    "bookingBehaviorSummary",
    "contactBehaviorSummary",
    "handoffBehaviorSummary",
    "pricingTargetCandidates",
    "locationTargetCandidates",
    "bookingTargetCandidates",
    "contactTargetCandidates",
    "suggestedAssistantBehaviorDraft",
  ]) {
    assert.equal(source.includes(token), false, `${token} must not remain`);
  }
});

test("stored setup brain payload ignores legacy behavior fields", () => {
  const payload = buildStoredSetupAssistantBrainPayload({
    aiBehavior: {
      tone: "friendly",
      greetingStyle: "warm",
      afterHoursBehavior: "take a message",
    },
    sourceSignals: {
      primarySourceType: "website",
      pricingTargetCandidates: [{ url: "https://acme.az/pricing" }],
      suggestedAssistantBehaviorDraft: {
        pricingPolicy: {
          mode: "ask_service_first",
        },
      },
    },
  });

  assert.deepEqual(payload.aiBehavior || {}, {});
  assert.equal(payload.sourceSignals.primarySourceType, "website");
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      payload.sourceSignals,
      "pricingTargetCandidates"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      payload.sourceSignals,
      "suggestedAssistantBehaviorDraft"
    ),
    false
  );
});
