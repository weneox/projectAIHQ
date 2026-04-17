import test from "node:test";
import assert from "node:assert/strict";

import {
  runSetupAssistantOpenAIOrchestrator,
  __test__ as orchestratorTest,
} from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";
import {
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
  buildSetupAssistantPatchFromAcceptedPatch,
} from "../src/services/workspace/setup/setupAssistantApp/patching.js";
import {
  buildSetupAssistantSessionPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";
import {
  buildStoredSetupAssistantPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";
import {
  buildAssistantQuestion,
} from "../src/services/workspace/setup/setupAssistantApp/questions.js";

function createDraft(overrides = {}) {
  return buildStoredSetupAssistantPayload({
    businessProfile: {},
    services: [],
    contacts: [],
    hours: [],
    pricingPosture: {},
    handoffRules: {},
    sourceMetadata: {},
    assistantState: {
      activeSection: "company",
      lastUpdatedSection: "",
    },
    progress: {
      currentQuestionKey: "company",
      lastAnsweredStep: "",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
    languages: ["az-AZ"],
    tone: "",
    greetingStyle: "",
    afterHoursBehavior: "",
    ...overrides,
  });
}

test("setup brain accepts short Azerbaijani services answer deterministically", async () => {
  const draft = createDraft({
    businessProfile: {
      companyName: "Mane MMC",
      description: "Logistika şirkəti",
    },
    assistantState: {
      activeSection: "services",
      lastUpdatedSection: "description",
    },
    progress: {
      currentQuestionKey: "services",
      lastAnsweredStep: "description",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
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
    latestMessage: "logistika, yükdaşıma",
    forceFallback: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "local_deterministic");
  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.acceptedPatch.services, [
    "logistika",
    "yükdaşıma",
  ]);
  assert.equal(result.readyForApproval, false);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.match(result.assistantMessage, /qeyd etdim/i);
});

test("setup brain accepts WhatsApp style contact answer and advances to pricing", async () => {
  const draft = createDraft({
    businessProfile: {
      companyName: "Mane MMC",
      description: "Logistika və yükdaşıma",
    },
    services: [
      { title: "Logistika" },
      { title: "Yükdaşıma" },
    ],
    assistantState: {
      activeSection: "contacts",
      lastUpdatedSection: "services",
    },
    progress: {
      currentQuestionKey: "contacts",
      lastAnsweredStep: "services",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
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
    latestMessage: "050 555 55 55 wp",
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "local_deterministic");
  assert.equal(result.nextQuestion.key, "pricing");
  assert.ok(
    result.acceptedPatch.contacts.some((item) =>
      /050|555|wp/i.test(String(item))
    )
  );
  assert.match(result.assistantMessage, /əlaqə|qeyd/i);
});

test("setup brain accepts Azerbaijani hours answer and advances to pricing", async () => {
  const draft = createDraft({
    businessProfile: {
      companyName: "Mane MMC",
      description: "Logistika və yükdaşıma",
    },
    services: [
      { title: "Logistika" },
      { title: "Yükdaşıma" },
    ],
    contacts: [
      { type: "phone", value: "050 555 55 55", preferred: true },
    ],
    assistantState: {
      activeSection: "hours",
      lastUpdatedSection: "contacts",
    },
    progress: {
      currentQuestionKey: "hours",
      lastAnsweredStep: "contacts",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "hours",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "hours",
      },
    },
    latestStep: "hours",
    latestMessage: "həftə içi 9-dan 6-ya",
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "local_deterministic");
  assert.equal(result.nextQuestion.key, "pricing");
  assert.ok(Array.isArray(result.acceptedPatch.hours));
  assert.ok(result.acceptedPatch.hours.length > 0);
});

test("normalizeSetupAssistantDraftPatchBody parses company answer with website into businessProfile", () => {
  const current = createDraft();

  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "company",
      answer: "Mane MMC mane.az",
    },
    current
  );

  assert.equal(patch.businessProfile.companyName, "Mane MMC");
  assert.equal(patch.businessProfile.websiteUrl, "https://mane.az");
  assert.equal(patch.assistantState.activeSection, "company");
  assert.equal(patch.progress.currentQuestionKey, "company");
});

test("mergeSetupAssistantDraft advances to next missing question instead of repeating same field", () => {
  const current = createDraft();

  const patch = {
    businessProfile: {
      companyName: "Mane MMC",
    },
    assistantState: {
      activeSection: "company",
      lastUpdatedSection: "company",
    },
    progress: {
      currentQuestionKey: "company",
      lastAnsweredStep: "company",
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  };

  const merged = mergeSetupAssistantDraft(current, patch, current);

  assert.equal(merged.businessProfile.companyName, "Mane MMC");
  assert.equal(merged.progress.currentQuestionKey, "description");
  assert.equal(merged.assistantState.activeSection, "description");
});

test("buildSetupAssistantPatchFromAcceptedPatch maps orchestrator acceptedPatch into canonical draft sections", () => {
  const current = createDraft({
    businessProfile: {
      companyName: "Mane MMC",
    },
    assistantState: {
      activeSection: "services",
      lastUpdatedSection: "company",
    },
    progress: {
      currentQuestionKey: "services",
      lastAnsweredStep: "company",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  });

  const turn = {
    latestUserInput: {
      step: "services",
      text: "logistika, yükdaşıma",
    },
    acceptedPatch: {
      identity: {},
      services: ["Logistika", "Yükdaşıma"],
      contacts: [],
      hours: [],
      pricingPosture: "",
      humanHandoff: "",
      aiBehavior: {},
    },
    nextQuestion: {
      key: "contacts",
      step: "contacts",
    },
  };

  const patch = buildSetupAssistantPatchFromAcceptedPatch(turn, current);

  assert.equal(Array.isArray(patch.services), true);
  assert.equal(patch.services.length, 2);
  assert.equal(patch.progress.lastAnsweredStep, "services");
  assert.equal(patch.progress.currentQuestionKey, "contacts");
  assert.equal(patch.assistantState.activeSection, "contacts");
});

test("buildSetupAssistantSessionPayload keeps a brain_v4 payload when stored brain has no next question", () => {
  const review = {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "company",
      startedAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
    draft: {
      id: "draft-1",
      version: 1,
      updatedAt: "2026-04-17T00:00:00.000Z",
      draftPayload: {
        setupAssistant: createDraft({
          businessProfile: {
            companyName: "Mane MMC",
          },
          assistantState: {
            activeSection: "company",
            lastUpdatedSection: "company",
          },
          progress: {
            currentQuestionKey: "company",
            lastAnsweredStep: "company",
            skippedQuestions: [],
            updatedAt: "2026-04-17T00:00:00.000Z",
          },
        }),
        setupAssistantBrain: {
          phase: "interview",
          assistantMessage: "Qeyd etdim.",
        },
      },
    },
    sources: [],
  };

  const payload = buildSetupAssistantSessionPayload(review);

  assert.equal(payload.ok, undefined);
  assert.equal(payload.session.id, "session-1");
  assert.equal(payload.setup.assistant.mode, "brain_v4");
  assert.equal(payload.setup.assistant.nextQuestion, null);
  assert.equal(payload.setup.assistant.readyForApproval, true);
});

test("orchestrator passive turn stays in interview mode when a setup draft shell already exists", async () => {
  const draft = createDraft();

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: {
      currentStep: "company",
    },
    draft,
    review: {
      draft,
      session: {
        currentStep: "company",
      },
    },
    latestStep: "company",
    latestMessage: "",
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "local_deterministic");
  assert.equal(result.nextQuestion.key, "company");
  assert.equal(result.phase, "interview");
});

test("orchestrator test helpers expose deterministic locale resolution", () => {
  const locale = orchestratorTest.resolveReplyLocale({
    draft: createDraft({
      languages: ["az-AZ"],
    }),
    latestMessage: "logistika",
  });

  assert.equal(locale, "az-AZ");
});

test("assistant question builder still produces localized company prompt", () => {
  const question = buildAssistantQuestion("company", {}, { locale: "az-AZ" });

  assert.equal(question.key, "company");
  assert.equal(question.step, "company");
  assert.match(question.prompt, /şirkət/i);
});
