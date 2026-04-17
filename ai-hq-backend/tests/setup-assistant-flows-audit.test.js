import test from "node:test";
import assert from "node:assert/strict";

import {
  updateSetupAssistantDraft,
} from "../src/services/workspace/setup/setupAssistantApp/flows.js";
import {
  buildStoredSetupAssistantPayload,
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

function createSetupAssistantDraft(overrides = {}) {
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

function createReview({
  sessionId = "session-1",
  currentStep = "company",
  draftVersion = 1,
  setupAssistant = null,
  setupAssistantBrain = null,
  setupAssistantTimeline = [],
} = {}) {
  return {
    session: {
      id: sessionId,
      status: "draft",
      mode: "setup",
      currentStep,
      startedAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
      metadata: {},
    },
    draft: {
      id: "draft-1",
      version: draftVersion,
      updatedAt: "2026-04-17T00:00:00.000Z",
      draftPayload: {
        setupAssistant:
          setupAssistant ||
          createSetupAssistantDraft({
            assistantState: {
              activeSection: currentStep,
              lastUpdatedSection: currentStep,
            },
            progress: {
              currentQuestionKey: currentStep,
              lastAnsweredStep: currentStep,
              skippedQuestions: [],
              updatedAt: "2026-04-17T00:00:00.000Z",
            },
          }),
        setupAssistantBrain:
          setupAssistantBrain || buildStoredSetupAssistantBrainPayload({}),
        setupAssistantTimeline,
      },
    },
    sources: [],
  };
}

function createPollutedDraft() {
  return createSetupAssistantDraft({
    businessProfile: {
      companyName: "Mand",
      description: "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      websiteUrl: "https://mand.az",
    },
    services: [{ title: "Salam" }],
    contacts: [{ type: "primary", value: "Necəsən" }],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    pricingPosture: {
      publicSummary: "How are you?",
      pricingMode: "quote_required",
    },
    handoffRules: {
      enabled: true,
      summary: "Hey? I dont understand",
      triggers: ["Hey? I dont understand"],
    },
    assistantState: {
      activeSection: "pricing",
      lastUpdatedSection: "pricing",
    },
    progress: {
      currentQuestionKey: "pricing",
      lastAnsweredStep: "pricing",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  });
}

function createValidDraft() {
  return createSetupAssistantDraft({
    businessProfile: {
      companyName: "Mand",
      description: "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      websiteUrl: "https://mand.az",
    },
    services: [
      { title: "Saç kəsimi" },
      { title: "Saç boyama" },
      { title: "Baxım" },
    ],
    contacts: [
      {
        type: "phone",
        value: "+994 50 555 55 55",
        preferred: true,
      },
    ],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
      {
        day: "tuesday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    pricingPosture: {
      pricingMode: "starting_from",
      publicSummary: "Qiymətlər 20 AZN-dən başlayır.",
      startingAt: 20,
      minPrice: 20,
      currency: "AZN",
    },
    handoffRules: {
      enabled: true,
      summary:
        "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
      triggers: ["operator request", "complaint"],
    },
    assistantState: {
      activeSection: "handoff",
      lastUpdatedSection: "handoff",
    },
    progress: {
      currentQuestionKey: "handoff",
      lastAnsweredStep: "handoff",
      skippedQuestions: [],
      updatedAt: "2026-04-17T00:00:00.000Z",
    },
  });
}

function createRejectedTurn(step = "pricing") {
  return {
    ok: true,
    provider: "local_validation",
    model: "gpt-5",
    usedFallback: true,
    error: "semantic_validation_rejected",
    latestUserInput: {
      step,
      text: "How are you?",
    },
    phase: "interview",
    assistantMessage:
      "İndi bunu bağlayaq: Qiymət cavablarını AI necə versin: dəqiq qiymət, başlanğıc qiymət, yoxsa əvvəlcə sorğu alsın?",
    message:
      "İndi bunu bağlayaq: Qiymət cavablarını AI necə versin: dəqiq qiymət, başlanğıc qiymət, yoxsa əvvəlcə sorğu alsın?",
    nextQuestion: {
      key: "services",
      step: "services",
      label: "Əsas xidmətlər",
      title: "Əsas xidmətlər",
      prompt: "Əsas xidmətləri vergüllə yazın.",
      group: "business_truth",
      groupLabel: "Business truth",
      priority: 1,
    },
    draft: {
      businessName: "Mand",
      whatThisBusinessIs: "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      coreServices: ["Salam"],
      contactRoutes: ["Necəsən"],
      pricingPosture: "How are you?",
      humanHandoff: "Hey? I dont understand",
    },
    acceptedPatch: {
      identity: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: "",
      humanHandoff: "",
      aiBehavior: {},
    },
    rejectedInputs: [
      {
        input: "How are you?",
        reason:
          "The message does not look like a pricing instruction or pricing rule.",
        suggestedField: "pricing",
      },
    ],
    confidence: {
      strong: [],
      unclear: ["pricing"],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: {
      primarySourceType: "website",
      primarySourceLabel: "Website",
      primarySourceUrl: "https://mand.az",
      primarySourceAuthorityClass: "official",
      pageCount: 0,
      sourceTypes: ["website"],
      strongestEvidence: [],
      discoveredPublicClaims: [],
      companyNameCandidates: ["Mand"],
      descriptionCandidates: [
        "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      ],
      serviceCandidates: ["Salam"],
      contactCandidates: ["Necəsən"],
      hoursCandidates: [],
      pricingCandidates: ["How are you?"],
      audienceCandidates: [],
      languagesCandidates: ["az-AZ"],
    },
    interviewPlan: {
      activeQuestionKeys: ["services"],
      activeQuestions: [
        {
          key: "services",
          step: "services",
          title: "Əsas xidmətlər",
          group: "business_truth",
          groupLabel: "Business truth",
          priority: 1,
        },
      ],
      remainingQuestionKeys: ["services"],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    aiBehavior: {
      languages: ["az-AZ"],
    },
    readyForApproval: false,
  };
}

function createApprovedTurn() {
  return {
    ok: true,
    provider: "openai",
    model: "gpt-5",
    usedFallback: false,
    error: "",
    latestUserInput: {
      step: "handoff",
      text:
        "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
    },
    phase: "ready",
    assistantMessage:
      "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
    message:
      "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
    nextQuestion: null,
    draft: {
      businessName: "Mand",
      whatThisBusinessIs: "Xanım saç kəsimi, baxımı və gözəllik salonu işləri",
      coreServices: ["Saç kəsimi", "Saç boyama", "Baxım"],
      contactRoutes: ["+994 50 555 55 55"],
      hours: ["monday 09:00-18:00", "tuesday 09:00-18:00"],
      pricingPosture: "Qiymətlər 20 AZN-dən başlayır.",
      humanHandoff:
        "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
    },
    acceptedPatch: {
      identity: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: "",
      humanHandoff:
        "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
      aiBehavior: {
        languages: ["az-AZ"],
      },
    },
    rejectedInputs: [],
    confidence: {
      strong: ["handoff"],
      unclear: [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: {
      strongestEvidence: ["Business name: Mand"],
    },
    interviewPlan: {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    aiBehavior: {
      languages: ["az-AZ"],
    },
    readyForApproval: true,
  };
}

test("updateSetupAssistantDraft audit includes approval blocker metadata for polluted draft", async () => {
  const audits = [];
  const persistedDrafts = [];
  const reviewStepUpdates = [];

  const initialReview = createReview({
    currentStep: "pricing",
    setupAssistant: createPollutedDraft(),
  });

  const refreshedReview = createReview({
    currentStep: "services",
    draftVersion: 2,
    setupAssistant: createPollutedDraft(),
  });

  let readCount = 0;

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "mand",
        user: {
          id: "user-1",
          name: "Owner",
        },
      },
      body: {
        mode: "message",
        step: "pricing",
        message: "How are you?",
      },
    },
    {
      getCurrentSetupReview: async () => {
        readCount += 1;
        return readCount === 1 ? initialReview : refreshedReview;
      },
      runSetupAssistantOpenAIOrchestrator: async () =>
        createRejectedTurn("pricing"),
      patchSetupReviewDraft: async (input) => {
        persistedDrafts.push(input);
        return {
          ok: true,
        };
      },
      updateSetupReviewSession: async (sessionId, patch) => {
        reviewStepUpdates.push({ sessionId, patch });
        return {
          ok: true,
        };
      },
      auditSetupAction: async (_db, _actor, action, objectType, objectId, meta) => {
        audits.push({ action, objectType, objectId, meta });
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.setup.assistant.readyForApproval, false);
  assert.equal(result.body.setup.assistant.finalizeAvailable, false);

  assert.equal(persistedDrafts.length, 1);
  assert.equal(reviewStepUpdates.length, 1);
  assert.equal(reviewStepUpdates[0].patch.currentStep, "services");

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "setup_assistant.draft.updated");
  assert.equal(audits[0].meta.readyForApproval, false);
  assert.equal(audits[0].meta.finalizeAvailable, false);
  assert.ok(audits[0].meta.approvalBlockerCount >= 1);
  assert.ok(Array.isArray(audits[0].meta.approvalBlockerSteps));
  assert.ok(audits[0].meta.approvalBlockerSteps.includes("services"));
  assert.ok(audits[0].meta.approvalBlockerSteps.includes("contacts"));
  assert.ok(audits[0].meta.approvalBlockerSteps.includes("pricing"));
  assert.ok(audits[0].meta.approvalBlockerSteps.includes("handoff"));
  assert.ok(Array.isArray(audits[0].meta.approvalBlockerReasonCodes));
  assert.ok(audits[0].meta.approvalBlockerReasonCodes.includes("rejected_services"));
  assert.ok(audits[0].meta.approvalBlockerReasonCodes.includes("rejected_contacts"));
  assert.ok(audits[0].meta.approvalBlockerReasonCodes.includes("rejected_pricing"));
  assert.ok(audits[0].meta.approvalBlockerReasonCodes.includes("rejected_handoff"));
});

test("updateSetupAssistantDraft audit shows zero approval blockers for valid ready draft", async () => {
  const audits = [];

  const initialReview = createReview({
    currentStep: "handoff",
    setupAssistant: createValidDraft(),
  });

  const refreshedReview = createReview({
    currentStep: "handoff",
    draftVersion: 2,
    setupAssistant: createValidDraft(),
  });

  let readCount = 0;

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "mand",
        user: {
          id: "user-1",
          name: "Owner",
        },
      },
      body: {
        mode: "message",
        step: "handoff",
        message:
          "Müştəri operator istəyəndə və ya şikayət olduqda insana yönləndir.",
      },
    },
    {
      getCurrentSetupReview: async () => {
        readCount += 1;
        return readCount === 1 ? initialReview : refreshedReview;
      },
      runSetupAssistantOpenAIOrchestrator: async () => createApprovedTurn(),
      patchSetupReviewDraft: async () => ({ ok: true }),
      updateSetupReviewSession: async () => ({ ok: true }),
      auditSetupAction: async (_db, _actor, action, objectType, objectId, meta) => {
        audits.push({ action, objectType, objectId, meta });
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.setup.assistant.readyForApproval, true);
  assert.equal(result.body.setup.assistant.finalizeAvailable, true);

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "setup_assistant.draft.updated");
  assert.equal(audits[0].meta.readyForApproval, true);
  assert.equal(audits[0].meta.finalizeAvailable, true);
  assert.equal(audits[0].meta.approvalBlockerCount, 0);
  assert.deepEqual(audits[0].meta.approvalBlockerSteps, []);
  assert.deepEqual(audits[0].meta.approvalBlockerReasonCodes, []);
});