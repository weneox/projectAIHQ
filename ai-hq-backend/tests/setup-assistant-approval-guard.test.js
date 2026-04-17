import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantSessionPayload,
  buildSetupAssistantResponseBody,
  buildStoredSetupAssistantPayload,
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

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
          createDraft({
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
          setupAssistantBrain ||
          buildStoredSetupAssistantBrainPayload({}),
        setupAssistantTimeline,
      },
    },
    sources: [],
  };
}

function createPollutedDraft() {
  return createDraft({
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

function createValidDraft() {
  return createDraft({
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
      { type: "phone", value: "+994 50 555 55 55", preferred: true },
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

test("polluted setup draft cannot become readyForApproval even when stored brain says true", () => {
  const review = createReview({
    currentStep: "handoff",
    setupAssistant: createPollutedDraft(),
    setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
      phase: "ready",
      assistantMessage: "Everything looks good. Approve and finish setup.",
      message: "Everything looks good. Approve and finish setup.",
      readyForApproval: true,
      nextQuestion: null,
      provider: "openai",
      model: "gpt-5",
    }),
  });

  const payload = buildSetupAssistantSessionPayload(review);

  assert.equal(payload.setup.assistant.readyForApproval, false);
  assert.equal(payload.setup.assistant.finalizeAvailable, false);
  assert.equal(payload.setup.review.readyForApproval, false);
  assert.equal(payload.setup.review.finalizeAvailable, false);

  assert.ok(Array.isArray(payload.setup.assistant.approvalBlockers));
  assert.ok(payload.setup.assistant.approvalBlockers.length >= 1);
  assert.ok(
    payload.setup.assistant.approvalBlockers.some(
      (item) => item.step === "services"
    )
  );
  assert.ok(
    payload.setup.assistant.approvalBlockers.some(
      (item) => item.step === "contacts"
    )
  );
  assert.ok(
    payload.setup.assistant.approvalBlockers.some(
      (item) => item.step === "pricing"
    )
  );
  assert.ok(
    payload.setup.assistant.approvalBlockers.some(
      (item) => item.step === "handoff"
    )
  );

  assert.equal(payload.setup.assistant.nextQuestion.key, "services");
});

test("valid setup draft may become readyForApproval when brain says true", () => {
  const review = createReview({
    currentStep: "handoff",
    setupAssistant: createValidDraft(),
    setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
      phase: "ready",
      assistantMessage:
        "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
      message:
        "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
      readyForApproval: true,
      nextQuestion: null,
      provider: "openai",
      model: "gpt-5",
    }),
  });

  const payload = buildSetupAssistantSessionPayload(review);

  assert.equal(payload.setup.assistant.readyForApproval, true);
  assert.equal(payload.setup.assistant.finalizeAvailable, true);
  assert.equal(payload.setup.review.readyForApproval, true);
  assert.equal(payload.setup.review.finalizeAvailable, true);
  assert.deepEqual(payload.setup.assistant.approvalBlockers, []);
  assert.equal(payload.setup.assistant.nextQuestion, null);
});

test("response body keeps finalize locked when base payload has approval blockers", () => {
  const pollutedReview = createReview({
    currentStep: "handoff",
    setupAssistant: createPollutedDraft(),
    setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
      phase: "interview",
      assistantMessage: "Qeyd etdim.",
      message: "Qeyd etdim.",
      readyForApproval: false,
      provider: "local_validation",
      model: "gpt-5",
    }),
  });

  const basePayload = buildSetupAssistantSessionPayload(pollutedReview);

  const response = buildSetupAssistantResponseBody(basePayload, {
    phase: "ready",
    assistantMessage: "Approve and finish setup",
    message: "Approve and finish setup",
    readyForApproval: true,
    nextQuestion: null,
    confidence: {
      strong: [],
      unclear: [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: {
      strongestEvidence: [],
    },
    interviewPlan: {},
    aiBehavior: {},
    draft: {},
    rejectedInputs: [],
    provider: "openai",
    model: "gpt-5",
  });

  assert.equal(response.setup.assistant.readyForApproval, false);
  assert.equal(response.setup.assistant.finalizeAvailable, false);
  assert.equal(response.setup.review.readyForApproval, false);
  assert.equal(response.setup.review.finalizeAvailable, false);
  assert.ok(Array.isArray(response.setup.assistant.approvalBlockers));
  assert.ok(response.setup.assistant.approvalBlockers.length >= 1);
});

test("response body allows finalize only when base payload is already semantically valid", () => {
  const validReview = createReview({
    currentStep: "handoff",
    setupAssistant: createValidDraft(),
    setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
      phase: "ready",
      assistantMessage:
        "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
      message:
        "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
      readyForApproval: true,
      provider: "openai",
      model: "gpt-5",
    }),
  });

  const basePayload = buildSetupAssistantSessionPayload(validReview);

  const response = buildSetupAssistantResponseBody(basePayload, {
    phase: "ready",
    assistantMessage:
      "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
    message:
      "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
    readyForApproval: true,
    nextQuestion: null,
    confidence: {
      strong: ["company", "description", "services"],
      unclear: [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: {
      strongestEvidence: ["Business name: Mand"],
    },
    interviewPlan: {},
    aiBehavior: {},
    draft: {},
    rejectedInputs: [],
    provider: "openai",
    model: "gpt-5",
  });

  assert.equal(response.setup.assistant.readyForApproval, true);
  assert.equal(response.setup.assistant.finalizeAvailable, true);
  assert.equal(response.setup.review.readyForApproval, true);
  assert.equal(response.setup.review.finalizeAvailable, true);
  assert.deepEqual(response.setup.assistant.approvalBlockers, []);
});

test("polluted draft points nextQuestion back to the first invalid semantic section", () => {
  const review = createReview({
    currentStep: "handoff",
    setupAssistant: createPollutedDraft(),
    setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
      phase: "ready",
      assistantMessage: "Approve and finish setup",
      message: "Approve and finish setup",
      readyForApproval: true,
      provider: "openai",
      model: "gpt-5",
    }),
  });

  const payload = buildSetupAssistantSessionPayload(review);

  assert.equal(payload.setup.assistant.nextQuestion.key, "services");
  assert.equal(payload.setup.assistant.nextQuestion.step, "services");
  assert.ok(/xidmət|service/i.test(String(payload.setup.assistant.nextQuestion.prompt)));
});