import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";
import {
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
} from "../src/services/workspace/setup/setupAssistantApp/patching.js";
import { getNextQuestion } from "../src/services/workspace/setup/setupAssistantApp/questions.js";
import { buildDraft, buildReview } from "./setup-assistant-test-helpers.js";

test("a draft moves through business questions, then behavior questions, and only then becomes approval-ready", () => {
  let draft = buildDraft();

  const businessTurns = [
    ["company", "Acme Clinic acme.az"],
    ["description", "Dental clinic in Baku"],
    ["services", "consultation"],
    ["contacts", "https://wa.me/994551112233, https://acme.az/book"],
    ["hours", "weekdays 09:00-18:00"],
    ["pricing", "Starts from 20 AZN."],
    [
      "handoff",
      "If the customer asks for an operator, there is a complaint, or it is urgent, route to a human.",
    ],
  ];

  for (const [step, answer] of businessTurns) {
    draft = mergeSetupAssistantDraft(
      draft,
      normalizeSetupAssistantDraftPatchBody({ step, answer }, draft),
      draft
    );
  }

  assert.equal(getNextQuestion({}, draft, {}, { locale: "en" }).key, "pricing_behavior");

  const beforeBehavior = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "pricing_behavior",
      setupAssistant: draft,
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
      }),
    })
  );

  assert.equal(beforeBehavior.setup.assistant.readyForApproval, false);
  assert.equal(beforeBehavior.setup.review.finalizeAvailable, false);

  const behaviorTurns = [
    ["pricing_behavior", "ask service first"],
    ["booking_behavior", "route to WhatsApp"],
    ["contact_behavior", "WhatsApp first"],
    ["handoff_behavior", "direct handoff"],
  ];

  for (const [step, answer] of behaviorTurns) {
    draft = mergeSetupAssistantDraft(
      draft,
      normalizeSetupAssistantDraftPatchBody({ step, answer }, draft),
      draft
    );
  }

  const readyPayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "handoff_behavior",
      setupAssistant: draft,
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
        assistantMessage: "Ready to approve.",
      }),
    })
  );

  assert.equal(readyPayload.setup.assistant.readyForApproval, true);
  assert.equal(readyPayload.setup.review.finalizeAvailable, true);
  assert.deepEqual(readyPayload.setup.assistant.approvalBlockers, []);
  assert.equal(readyPayload.setup.assistant.nextQuestion, null);
});

