import test from "node:test";
import assert from "node:assert/strict";

import {
  readSetupAssistantView,
  updateSetupAssistantDraft,
  __test__ as setupAssistantAppTest,
} from "../src/services/workspace/setup/setupAssistantApp.js";
import {
  runSetupAssistantOpenAIOrchestrator,
} from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function createBaseReview() {
  return {
    session: {
      id: "session-setup-1",
      status: "draft",
      mode: "setup",
      currentStep: "profile",
      updatedAt: "2026-04-15T10:00:00.000Z",
    },
    draft: {
      id: "draft-setup-1",
      version: 1,
      updatedAt: "2026-04-15T10:00:00.000Z",
      draftPayload: {},
      businessProfile: {},
      capabilities: {},
      services: [],
      contacts: [],
      hours: [],
      sourceSummary: {},
      warnings: [],
    },
    sources: [],
    events: [],
  };
}

function createBrainTurn(overrides = {}) {
  return {
    ok: true,
    provider: "openai",
    model: "gpt-5",
    usedFallback: false,
    error: "",
    latestUserInput: {
      step: "profile",
      text: "North Clinic - Cosmetic dentistry clinic in Baku",
    },
    phase: "interview",
    assistantMessage: "Identity locked. Now confirm the core services.",
    nextQuestion: {
      key: "services",
      step: "services",
      title: "Curate the service menu",
      prompt: "List the real customer-facing services you want AI to talk about.",
      group: "business_truth",
      groupLabel: "Business truth",
    },
    draft: {
      businessName: "North Clinic",
      whatThisBusinessIs: "Cosmetic dentistry clinic in Baku",
      websiteUrl: "https://north.example",
      coreServices: ["Dental implants", "Teeth whitening"],
      audience: "Adults and families in Baku",
      pricingPosture: "Public replies can say consultations start from 30 AZN.",
      contactRoutes: ["+994 50 222 33 44", "hello@north.example"],
      humanHandoff: "Escalate complaints, urgent cases, and custom treatment questions.",
      languages: ["az", "en"],
      tone: "warm reassuring",
      hours: ["Mon-Fri 09:00-18:00"],
      greetingStyle: "Warm and calm",
      afterHoursBehavior: "Collect the request and promise a callback.",
    },
    acceptedPatch: {
      identity: {
        businessName: "North Clinic",
        description: "Cosmetic dentistry clinic in Baku",
        websiteUrl: "https://north.example",
        audience: "Adults and families in Baku",
      },
      services: ["Dental implants", "Teeth whitening"],
      contacts: ["+994 50 222 33 44", "hello@north.example"],
      hours: ["Mon-Fri 09:00-18:00"],
      pricingPosture: "Public replies can say consultations start from 30 AZN.",
      humanHandoff:
        "Escalate complaints, urgent cases, and custom treatment questions.",
      aiBehavior: {
        languages: ["az", "en"],
        tone: "warm reassuring",
        greetingStyle: "Warm and calm",
        afterHoursBehavior: "Collect the request and promise a callback.",
      },
    },
    rejectedInputs: [
      {
        input: "ok davam",
        reason: "Acknowledgement-only text should not become business truth.",
        suggestedField: "none",
      },
    ],
    confidence: {
      strong: ["Business identity is anchored."],
      unclear: ["Pricing still needs a stricter policy."],
      contradictions: [],
    },
    recommendation: {
      notes: ["Keep only real customer-facing services."],
    },
    sourceSignals: {
      primarySourceType: "website",
      primarySourceLabel: "Website",
      primarySourceUrl: "https://north.example",
      primarySourceAuthorityClass: "website",
      pageCount: 4,
      sourceTypes: ["website"],
      strongestEvidence: [
        "Website source: https://north.example",
        "Source business name signal: North Clinic",
      ],
      discoveredPublicClaims: ["Dental implants", "Teeth whitening"],
      companyNameCandidates: ["North Clinic"],
      descriptionCandidates: ["Cosmetic dentistry clinic in Baku"],
      serviceCandidates: ["Dental implants", "Teeth whitening"],
      contactCandidates: ["+994 50 222 33 44", "hello@north.example"],
      hoursCandidates: ["Mon-Fri 09:00-18:00"],
      pricingCandidates: ["Consultations start from 30 AZN"],
      audienceCandidates: ["Adults and families in Baku"],
      languagesCandidates: ["az", "en"],
    },
    interviewPlan: {
      activeQuestionKeys: ["services", "pricing"],
      activeQuestions: [
        {
          key: "services",
          step: "services",
          title: "Curate the service menu",
          group: "business_truth",
          groupLabel: "Business truth",
          priority: 2,
        },
        {
          key: "pricing",
          step: "pricing",
          title: "Choose a safe pricing posture",
          group: "business_truth",
          groupLabel: "Business truth",
          priority: 1,
        },
      ],
      remainingQuestionKeys: ["pricing"],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    readyForApproval: false,
    ...overrides,
  };
}

test("setup assistant orchestrator seeds the first prompt when no input exists", async () => {
  const turn = await runSetupAssistantOpenAIOrchestrator({
    session: {},
    draft: {},
    sources: [],
    review: null,
    latestStep: "",
    latestMessage: "",
    forceFallback: true,
  });

  assert.equal(turn.ok, true);
  assert.equal(turn.phase, "source_capture");
  assert.equal(turn.usedFallback, true);
  assert.match(
    turn.assistantMessage,
    /send the best public source you have first/i
  );
  assert.equal(s(obj(turn.nextQuestion).key), "source_capture");
});

test("setup assistant orchestrator patch builder converts canonical draft output into stored setup state", () => {
  const patch = setupAssistantAppTest.buildSetupAssistantPatchFromOrchestrator(
    createBrainTurn(),
    {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {},
      assistantState: {},
      progress: {},
    }
  );

  assert.equal(patch.businessProfile.companyName, "North Clinic");
  assert.equal(
    patch.businessProfile.description,
    "Cosmetic dentistry clinic in Baku"
  );
  assert.equal(patch.businessProfile.websiteUrl, "https://north.example");
  assert.equal(arr(patch.services).length, 2);
  assert.equal(arr(patch.contacts).length, 2);
  assert.equal(arr(patch.hours).some((item) => item.enabled === true), true);
  assert.equal(
    patch.pricingPosture.publicSummary,
    "Public replies can say consultations start from 30 AZN."
  );
  assert.equal(
    patch.handoffRules.summary,
    "Escalate complaints, urgent cases, and custom treatment questions."
  );
  assert.equal(patch.assistantState.activeSection, "services");
  assert.equal(patch.progress.currentQuestionKey, "services");
});

test("message-mode setup draft update bridges orchestrator output into review draft and canonical review fields", async () => {
  let review = createBaseReview();
  const patchCalls = [];
  const stepUpdates = [];

  const deps = {
    getCurrentSetupReview: async () => review,
    patchSetupReviewDraft: async ({ patch }) => {
      patchCalls.push(patch);

      review = {
        ...review,
        draft: {
          ...review.draft,
          ...patch,
          draftPayload: {
            ...obj(review.draft.draftPayload),
            ...obj(patch.draftPayload),
          },
          businessProfile: {
            ...obj(review.draft.businessProfile),
            ...obj(patch.businessProfile),
          },
          services: arr(patch.services).length
            ? arr(patch.services)
            : review.draft.services,
          contacts: arr(patch.contacts).length
            ? arr(patch.contacts)
            : review.draft.contacts,
          sourceSummary: {
            ...obj(review.draft.sourceSummary),
            ...obj(patch.sourceSummary),
          },
          version: Number(review.draft.version || 0) + 1,
        },
      };
    },
    updateSetupReviewSession: async (_sessionId, payload) => {
      stepUpdates.push(payload);
      review = {
        ...review,
        session: {
          ...review.session,
          ...payload,
        },
      };
    },
    auditSetupAction: async () => {},
    runSetupAssistantOpenAIOrchestrator: async () => createBrainTurn(),
  };

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "north",
        user: {
          id: "11111111-1111-4111-8111-111111111111",
        },
      },
      body: {
        step: "profile",
        answer: "North Clinic - Cosmetic dentistry clinic in Baku",
      },
    },
    deps
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(patchCalls.length, 1);
  assert.equal(stepUpdates.length, 1);

  const reviewPatch = patchCalls[0];

  assert.equal(reviewPatch.businessProfile.companyName, "North Clinic");
  assert.equal(
    reviewPatch.businessProfile.description,
    "Cosmetic dentistry clinic in Baku"
  );
  assert.equal(reviewPatch.businessProfile.websiteUrl, "https://north.example");

  assert.equal(arr(reviewPatch.services).length, 2);
  assert.equal(arr(reviewPatch.services)[0].title, "Dental implants");
  assert.equal(arr(reviewPatch.contacts).length, 2);
  assert.equal(arr(reviewPatch.contacts)[0].channel, "phone");
  assert.equal(arr(reviewPatch.contacts)[1].channel, "email");
  assert.equal(reviewPatch.sourceSummary.primarySourceType, "website");
  assert.equal(reviewPatch.sourceSummary.primarySourceUrl, "https://north.example");

  const storedSetupAssistant = obj(
    obj(reviewPatch.draftPayload).setupAssistant
  );

  assert.equal(
    obj(storedSetupAssistant.businessProfile).companyName,
    "North Clinic"
  );
  assert.equal(
    obj(storedSetupAssistant.assistantState).activeSection,
    "services"
  );
  assert.equal(obj(storedSetupAssistant.progress).currentQuestionKey, "services");

  assert.equal(stepUpdates[0].currentStep, "services");
  assert.equal(
    s(obj(result.body.setup).draft.businessProfile.companyName),
    "North Clinic"
  );
});

test("read setup assistant view overlays brain payload and exposes compat response fields", async () => {
  const baseSessionPayload = {
    ok: true,
    session: {
      id: "session-setup-1",
      status: "draft",
      mode: "setup",
      currentStep: "profile",
      draftVersion: 2,
      reviewSessionId: "session-setup-1",
      draftOnly: true,
      storageModel: "tenant_setup_review",
      sourceType: "setup_assistant",
      namespace: "setup_assistant",
    },
    setup: {
      status: "draft_in_progress",
      draftOnly: true,
      sourceType: "setup_assistant",
      namespace: "setup_assistant",
      summary: {},
      websitePrefill: {},
      review: {
        status: "draft_in_progress",
        readyForReview: false,
        readyForApproval: false,
        finalizeAvailable: false,
        message: "Review in progress",
      },
      draft: {
        businessProfile: {},
        services: [],
        contacts: [],
        hours: [],
        pricingPosture: {},
        handoffRules: {},
        sourceMetadata: {},
        assistantState: {},
        progress: {},
        version: 2,
      },
      assistant: {
        mode: "structured_v2",
        phase: "interview",
        message: "Fallback question",
        assistantMessage: "Fallback question",
        nextQuestion: {
          key: "company",
          step: "company",
          title: "Confirm the business name",
          prompt: "What is the business name?",
          group: "business_truth",
          groupLabel: "Business truth",
        },
        completion: {
          ready: false,
          action: null,
          message: "Review in progress",
        },
        servicesCatalog: {},
        sourceInsights: [],
        confidence: {},
        recommendation: { notes: [] },
        sourceSignals: {},
        interviewPlan: {
          activeQuestionKeys: ["company"],
          activeQuestions: [],
          remainingQuestionKeys: [],
          nextGroup: "business_truth",
          nextGroupLabel: "Business truth",
        },
        draft: {},
        readyForApproval: false,
      },
    },
  };

  const result = await readSetupAssistantView(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "north",
      },
    },
    {
      loadCurrentSetupAssistantSession: async () => ({
        status: 200,
        body: baseSessionPayload,
      }),
      getCurrentSetupReview: async () => createBaseReview(),
      runSetupAssistantOpenAIOrchestrator: async () => createBrainTurn(),
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.assistant.provider, "openai");
  assert.equal(result.body.assistant.model, "gpt-5");
  assert.equal(result.body.assistant.readyForApproval, false);
  assert.equal(result.body.turn.role, "assistant");
  assert.equal(result.body.turn.payload.provider, "openai");
  assert.equal(result.body.question.key, "services");
  assert.equal(result.body.primaryQuestion.key, "services");
  assert.equal(result.body.businessFacts.companyName, "North Clinic");
  assert.equal(
    result.body.conversationStatus.phase,
    "interview"
  );
  assert.equal(arr(result.body.followupQueue).length, 1);
  assert.equal(
    arr(result.body.unknowns)[0],
    "Pricing still needs a stricter policy."
  );
});