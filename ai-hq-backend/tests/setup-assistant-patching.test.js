import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantPatchFromAcceptedPatch,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  patchFromAnswer,
} from "../src/services/workspace/setup/setupAssistantApp/patching.js";
import { buildCompleteBusinessDraft, buildDraft } from "./setup-assistant-test-helpers.js";

test("business answers patch business fields and progress cleanly", () => {
  const current = buildDraft();
  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "company",
      answer: "Acme Clinic acme.az",
    },
    current
  );

  assert.equal(patch.businessProfile.companyName, "Acme Clinic");
  assert.equal(patch.businessProfile.websiteUrl, "https://acme.az");
  assert.equal(patch.progress.currentQuestionKey, "company");
  assert.equal(patch.assistantState.activeSection, "company");
});

test("behavior answers patch assistantBehaviorDraft and set activeBehaviorPolicy", () => {
  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "pricing_behavior",
      answer: "ask service first",
    },
    buildDraft()
  );

  assert.equal(patch.assistantBehaviorDraft.pricingPolicy.mode, "ask_service_first");
  assert.equal(
    patch.assistantBehaviorDraft.pricingPolicy.askServiceFirst,
    true
  );
  assert.equal(patch.progress.currentQuestionKey, "pricing_behavior");
  assert.equal(patch.assistantState.activeSection, "pricing_behavior");
  assert.equal(patch.assistantState.activeBehaviorPolicy, "pricing");
});

test("intent-only messages preserve state without corrupting behavior data", () => {
  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "contact_behavior",
      answer: "next",
    },
    buildDraft({
      progress: {
        currentQuestionKey: "contact_behavior",
      },
      assistantState: {
        activeSection: "contact_behavior",
        activeBehaviorPolicy: "contact",
      },
    })
  );

  assert.deepEqual(patch.assistantBehaviorDraft || {}, {});
  assert.equal(patch.progress.currentQuestionKey, "contact_behavior");
  assert.equal(patch.assistantState.activeSection, "contact_behavior");
  assert.equal(patch.assistantState.activeBehaviorPolicy, "contact");
});

test("mergeSetupAssistantDraft preserves business data and behavior data together", () => {
  const merged = mergeSetupAssistantDraft(
    buildCompleteBusinessDraft(),
    patchFromAnswer("contact_behavior", "WhatsApp first", buildCompleteBusinessDraft()),
    {}
  );

  assert.equal(merged.businessProfile.companyName, "Acme Clinic");
  assert.equal(merged.pricingPosture.publicSummary, "Starts from 20 AZN.");
  assert.equal(merged.assistantBehaviorDraft.contactPolicy.mode, "whatsapp_first");
  assert.equal(merged.assistantBehaviorDraft.contactPolicy.preferredChannel, "whatsapp");
});

test("buildSetupAssistantPatchFromAcceptedPatch carries behavior policies forward", () => {
  const patch = buildSetupAssistantPatchFromAcceptedPatch(
    {
      latestUserInput: {
        step: "booking_behavior",
      },
      nextQuestion: {
        key: "contact_behavior",
      },
      acceptedPatch: {
        bookingPolicy: {
          mode: "route_whatsapp",
          preferredTargetUrl: "https://wa.me/994551112233",
        },
      },
    },
    buildDraft()
  );

  assert.equal(
    patch.assistantBehaviorDraft.bookingPolicy.mode,
    "route_whatsapp"
  );
  assert.equal(
    patch.assistantBehaviorDraft.bookingPolicy.preferredTargetUrl,
    "https://wa.me/994551112233"
  );
  assert.equal(patch.progress.lastAnsweredStep, "booking_behavior");
  assert.equal(patch.progress.currentQuestionKey, "contact_behavior");
  assert.equal(patch.assistantState.activeSection, "contact_behavior");
  assert.equal(patch.assistantState.activeBehaviorPolicy, "contact");
});

