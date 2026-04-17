import test from "node:test";
import assert from "node:assert/strict";

import { runSetupAssistantOpenAIOrchestrator } from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
} from "./setup-assistant-test-helpers.js";

test("local orchestrator accepts a direct business answer and carries draft state into the turn", async () => {
  const draft = buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "services",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "services",
      },
    },
    latestStep: "services",
    latestMessage: "consultation, implants",
  });

  assert.equal(result.provider, "local_reasoning");
  assert.deepEqual(result.acceptedPatch.services, ["consultation", "implants"]);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.equal(result.draft.businessName, "Acme Clinic");
  assert.deepEqual(result.sourceSignals.serviceCandidates, [
    "consultation",
    "implants",
  ]);
  assert.deepEqual(result.interviewPlan.activeQuestionKeys, ["contacts"]);
});

test("local orchestrator accepts a behavior-step answer and keeps approval guarded", async () => {
  const draft = buildCompleteBusinessDraft({
    progress: {
      currentQuestionKey: "pricing_behavior",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "pricing_behavior",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "pricing_behavior",
      },
    },
    latestStep: "pricing_behavior",
    latestMessage: "ask service first",
  });

  assert.equal(
    result.acceptedPatch.assistantBehaviorDraft.pricingPolicy.mode,
    "ask_service_first"
  );
  assert.equal(
    result.acceptedPatch.assistantBehaviorDraft.pricingPolicy.askServiceFirst,
    true
  );
  assert.equal(result.nextQuestion.key, "contact_behavior");
  assert.equal(result.readyForApproval, false);
});

test("local orchestrator handles explicit corrections before current-step parsing", async () => {
  const draft = buildCompleteBusinessDraft({
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "services",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "services",
      },
    },
    latestStep: "services",
    latestMessage: "actually company Alpha Clinic",
  });

  assert.match(result.assistantMessage, /company/i);
  assert.match(
    result.acceptedPatch.identity.businessName,
    /Alpha Clinic/i
  );
  assert.deepEqual(result.acceptedPatch.services || [], []);
});

test("local orchestrator captures useful behavior signals without polluting unrelated business fields", async () => {
  const draft = buildCompleteBusinessDraft({
    contacts: [],
    progress: {
      currentQuestionKey: "contacts",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "contacts",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "contacts",
      },
    },
    latestStep: "contacts",
    latestMessage: "WhatsApp +994551112233, WhatsApp first",
  });

  assert.ok(result.acceptedPatch.contacts.some((item) => /\+994551112233/.test(item)));
  assert.equal(
    result.acceptedPatch.assistantBehaviorDraft.contactPolicy.mode,
    "whatsapp_first"
  );
  assert.equal(
    result.acceptedPatch.assistantBehaviorDraft.bookingPolicy.mode,
    "route_whatsapp"
  );
  assert.deepEqual(result.acceptedPatch.identity || {}, {});
  assert.equal(result.nextQuestion.key, "pricing_behavior");
});

test("clarify turns reject off-topic chat and do not loop blindly on the same step", async () => {
  const draft = buildCompleteBusinessDraft({
    progress: {
      currentQuestionKey: "pricing",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "pricing",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "pricing",
      },
      timeline: [
        {
          role: "assistant",
          questionKey: "pricing",
          text: "What pricing should AI share?",
        },
        {
          role: "assistant",
          questionKey: "pricing",
          text: "Please answer pricing in one sentence.",
        },
      ],
    },
    latestStep: "pricing",
    latestMessage: "how are you?",
  });

  assert.deepEqual(result.acceptedPatch, {});
  assert.equal(result.rejectedInputs.length, 1);
  assert.equal(result.readyForApproval, false);
  assert.equal(result.nextQuestion.key, "pricing_behavior");
});
