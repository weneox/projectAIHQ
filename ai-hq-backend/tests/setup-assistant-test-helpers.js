import {
  buildStoredSetupAssistantBrainPayload,
  buildStoredSetupAssistantPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

export const FIXED_ISO = "2026-04-17T00:00:00.000Z";

export function buildDraft(overrides = {}) {
  return buildStoredSetupAssistantPayload({
    businessProfile: {},
    services: [],
    contacts: [],
    hours: [],
    pricingPosture: {},
    handoffRules: {},
    assistantBehaviorDraft: {},
    sourceMetadata: {},
    assistantState: {
      activeSection: "company",
      lastUpdatedSection: "",
      activeBehaviorPolicy: "",
    },
    progress: {
      currentQuestionKey: "company",
      lastAnsweredStep: "",
      skippedQuestions: [],
      updatedAt: FIXED_ISO,
    },
    languages: ["en"],
    tone: "",
    greetingStyle: "",
    afterHoursBehavior: "",
    ...overrides,
  });
}

export function buildCompleteBusinessDraft(overrides = {}) {
  return buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ type: "phone", value: "+994551112233", preferred: true }],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        allDay: false,
        appointmentOnly: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    pricingPosture: {
      publicSummary: "Starts from 20 AZN.",
    },
    handoffRules: {
      enabled: true,
      summary:
        "If the customer asks for an operator, there is a complaint, or it is urgent, route to a human.",
    },
    assistantState: {
      activeSection: "handoff",
      lastUpdatedSection: "handoff",
      activeBehaviorPolicy: "",
    },
    progress: {
      currentQuestionKey: "handoff",
      lastAnsweredStep: "handoff",
      skippedQuestions: [],
      updatedAt: FIXED_ISO,
    },
    ...overrides,
  });
}

export function buildReview({
  sessionId = "session-1",
  currentStep = "company",
  draftVersion = 1,
  setupAssistant = null,
  setupAssistantBrain = null,
  setupAssistantTimeline = [],
  sources = [],
} = {}) {
  const draft =
    setupAssistant ||
    buildDraft({
      assistantState: {
        activeSection: currentStep,
        lastUpdatedSection: currentStep,
        activeBehaviorPolicy: currentStep.endsWith("_behavior")
          ? currentStep.replace("_behavior", "")
          : "",
      },
      progress: {
        currentQuestionKey: currentStep,
        lastAnsweredStep: currentStep,
        skippedQuestions: [],
        updatedAt: FIXED_ISO,
      },
    });

  return {
    session: {
      id: sessionId,
      status: "draft",
      mode: "setup",
      currentStep,
      startedAt: FIXED_ISO,
      updatedAt: FIXED_ISO,
      metadata: {},
    },
    draft: {
      id: "draft-1",
      version: draftVersion,
      updatedAt: FIXED_ISO,
      draftPayload: {
        setupAssistant: draft,
        setupAssistantBrain:
          setupAssistantBrain || buildStoredSetupAssistantBrainPayload({}),
        setupAssistantTimeline,
      },
    },
    sources,
  };
}

