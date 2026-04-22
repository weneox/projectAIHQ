import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  __test__ as orchestratorTest,
  runSetupAssistantOpenAIOrchestrator,
} from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
} from "./setup-assistant-test-helpers.js";

function withOpenAISetupConfig(t, overrides = {}) {
  const previous = {
    openaiApiKey: cfg.ai.openaiApiKey,
    openaiSetupAssistantEnabled: cfg.ai.openaiSetupAssistantEnabled,
    openaiSetupForceFallback: cfg.ai.openaiSetupForceFallback,
    openaiSetupModel: cfg.ai.openaiSetupModel,
    openaiSetupEnableTurnPolisher: cfg.ai.openaiSetupEnableTurnPolisher,
    openaiSetupTurnPolisherReadyOnly: cfg.ai.openaiSetupTurnPolisherReadyOnly,
  };

  Object.assign(cfg.ai, overrides);

  t.after(() => {
    Object.assign(cfg.ai, previous);
    orchestratorTest.clearCachedClient();
  });
}

test("business-step answers stay minimal while still producing a deterministic hidden preview", async () => {
  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
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
    forceFallback: true,
  });

  assert.equal(result.provider, "local_reasoning");
  assert.deepEqual(result.acceptedPatch.services, ["consultation", "implants"]);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.equal(result.draft.businessName, "Acme Clinic");
  assert.deepEqual(result.draft.coreServices, ["consultation", "implants"]);
  assert.equal(result.sourceSignals.primarySourceUrl, "https://acme.az");
  assert.match(result.assistantMessage, /^Okay\./);
  assert.doesNotMatch(result.assistantMessage, /http|source|debug/i);
});

test("contact-step answers do not emit fake cross-step behavior chatter", async () => {
  const draft = buildCompleteBusinessDraft({
    languages: ["en"],
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
    forceFallback: true,
  });

  assert.ok(result.acceptedPatch.contacts.some((item) => /\+994551112233/.test(item)));
  assert.deepEqual(result.acceptedPatch.assistantBehaviorDraft || {}, {});
  assert.equal(result.readyForApproval, true);
  assert.equal(result.nextQuestion, null);
  assert.doesNotMatch(
    result.assistantMessage,
    /behavior|preference|pricing page|contact policy/i
  );
});

test("correction flow still works without leaking unrelated updates", async () => {
  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Old Brand",
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
    latestMessage: "actually company Alpha Clinic",
    forceFallback: true,
  });

  assert.match(result.acceptedPatch.identity.businessName, /Alpha Clinic/i);
  assert.deepEqual(result.acceptedPatch.services || [], []);
  assert.equal(result.nextQuestion.key, "services");
  assert.match(result.assistantMessage, /^Updated\./);
});

test("pricing answers like 'xidmete gore deyisir' are accepted as valid pricing posture", async () => {
  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ type: "phone", value: "+994551112233", preferred: true }],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
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
    },
    latestStep: "pricing",
    latestMessage: "xidmete gore deyisir",
    forceFallback: true,
  });

  assert.equal(result.provider, "local_reasoning");
  assert.match(result.acceptedPatch.pricingPosture, /deyisir/i);
  assert.equal(result.nextQuestion.key, "handoff");
});

test("clarify turns stay short and move on instead of getting noisy", async () => {
  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
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
          text: "What core pricing fact should AI share?",
        },
        {
          role: "assistant",
          questionKey: "pricing",
          text: "Please answer pricing in one short sentence.",
        },
      ],
    },
    latestStep: "pricing",
    latestMessage: "how are you?",
    forceFallback: true,
  });

  assert.deepEqual(result.acceptedPatch, {});
  assert.equal(result.rejectedInputs.length, 1);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.match(result.assistantMessage, /move to the next part/i);
  assert.ok(
    result.assistantMessage.split(/\s+/).filter(Boolean).length <= 25
  );
  assert.doesNotMatch(result.assistantMessage, /http|debug|source/i);
});

test("polished draft override path replaces the hidden preview when the polisher succeeds", async (t) => {
  withOpenAISetupConfig(t, {
    openaiApiKey: "test-key",
    openaiSetupAssistantEnabled: true,
    openaiSetupForceFallback: false,
    openaiSetupModel: "test-model",
    openaiSetupEnableTurnPolisher: true,
    openaiSetupTurnPolisherReadyOnly: false,
  });

  orchestratorTest.setCachedClient({
    responses: {
      create: async () => ({
        output_parsed: {
          businessName: "Acme Clinic",
          whatThisBusinessIs: "Professional dental clinic focused on implants.",
          websiteUrl: "https://acme.az",
          coreServices: ["Consultation", "Implants"],
          contactRoutes: ["WhatsApp"],
          hours: ["Mon-Fri 09:00-18:00"],
          pricingPosture: "Pricing depends on the service.",
          humanHandoff: "Escalate urgent or complaint cases.",
          pricingBehavior: "Ask service first.",
          locationBehavior: "Address + map.",
          bookingBehavior: "Route to WhatsApp.",
          contactBehavior: "WhatsApp first.",
          handoffBehavior: "Contextual handoff.",
          languages: ["en"],
          tone: "professional",
          greetingStyle: "warm",
          afterHoursBehavior: "take a message",
        },
      }),
    },
  });

  const draft = buildCompleteBusinessDraft({
    languages: ["en"],
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
  assert.equal(
    result.draft.whatThisBusinessIs,
    "Professional dental clinic focused on implants."
  );
  assert.deepEqual(result.draft.coreServices, ["Consultation", "Implants"]);
  assert.equal(result.draft.pricingBehavior, "Ask service first.");
  assert.equal(result.sourceSignals.primarySourceUrl, "https://acme.az");
});
