import test from "node:test";
import assert from "node:assert/strict";

import {
  readSetupAssistantView,
  startSetupAssistantSession,
  loadCurrentSetupAssistantSession,
  updateSetupAssistantDraft,
} from "../src/services/workspace/setup/setupAssistantApp/flows.js";
import {
  buildStoredSetupAssistantPayload,
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
  draftVersion = 1,
  currentStep = "company",
  draftPayload = null,
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
      sessionId,
      version: draftVersion,
      updatedAt: "2026-04-17T00:00:00.000Z",
      businessProfile: {},
      capabilities: {},
      services: [],
      knowledgeItems: [],
      warnings: [],
      completeness: {},
      confidenceSummary: {},
      sourceSummary: {},
      draftPayload:
        draftPayload ||
        {
          setupAssistant: createSetupAssistantDraft({
            assistantState: {
              activeSection: currentStep,
              lastUpdatedSection: "",
            },
            progress: {
              currentQuestionKey: currentStep,
              lastAnsweredStep: "",
              skippedQuestions: [],
              updatedAt: "2026-04-17T00:00:00.000Z",
            },
          }),
          setupAssistantBrain: {},
          setupAssistantTimeline: [],
        },
    },
    sources: [],
  };
}

test("readSetupAssistantView delegates to current-session loader", async () => {
  let called = false;

  const result = await readSetupAssistantView(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
      },
    },
    {
      loadCurrentSetupAssistantSession: async () => {
        called = true;
        return {
          status: 200,
          body: {
            ok: true,
            session: {
              id: "session-1",
            },
          },
        };
      },
    }
  );

  assert.equal(called, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.session.id, "session-1");
});

test("startSetupAssistantSession creates a setup review session when none exists", async () => {
  const createdSessions = [];
  const audits = [];

  const createdReview = createReview({
    sessionId: "session-created",
    currentStep: "company",
  });

  let readCount = 0;

  const result = await startSetupAssistantSession(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          id: "user-1",
          name: "Owner",
        },
      },
    },
    {
      getCurrentSetupReview: async () => {
        readCount += 1;
        return readCount === 1 ? null : createdReview;
      },
      getOrCreateActiveSetupReviewSession: async (input) => {
        createdSessions.push(input);
        return {
          sessionId: "session-created",
        };
      },
      auditSetupAction: async (_db, _actor, action, objectType, objectId, meta) => {
        audits.push({ action, objectType, objectId, meta });
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.created, true);
  assert.equal(result.body.session.id, "session-created");
  assert.equal(createdSessions.length, 1);
  assert.equal(createdSessions[0].mode, "setup");
  assert.equal(createdSessions[0].ensureDraft, true);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "setup_assistant.session.started");
});

test("loadCurrentSetupAssistantSession returns not found when no active review exists", async () => {
  const result = await loadCurrentSetupAssistantSession(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
      },
    },
    {
      getCurrentSetupReview: async () => null,
    }
  );

  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "SetupAssistantSessionNotFound");
});

test("updateSetupAssistantDraft in message mode persists brain snapshot, timeline, and next step", async () => {
  const audits = [];
  const reviewSessionUpdates = [];
  const persistedDrafts = [];

  const initialReview = createReview({
    sessionId: "session-1",
    currentStep: "services",
    draftPayload: {
      setupAssistant: createSetupAssistantDraft({
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
      }),
      setupAssistantBrain: {},
      setupAssistantTimeline: [],
    },
  });

  const refreshedReview = createReview({
    sessionId: "session-1",
    currentStep: "contacts",
    draftVersion: 2,
    draftPayload: initialReview.draft.draftPayload,
  });

  let reviewReadCount = 0;

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: {
          id: "user-1",
          name: "Owner",
        },
      },
      body: {
        mode: "message",
        step: "services",
        message: "logistika, yükdaşıma",
      },
    },
    {
      getCurrentSetupReview: async () => {
        reviewReadCount += 1;
        return reviewReadCount === 1 ? initialReview : refreshedReview;
      },
      runSetupAssistantOpenAIOrchestrator: async () => ({
        ok: true,
        provider: "local_deterministic",
        model: "gpt-5",
        usedFallback: false,
        error: "",
        phase: "interview",
        assistantMessage:
          "Qeyd etdim: əsas xidmətlərə logistika və yükdaşıma daxildir. Əlaqə üçün əsas nömrəni yazın.",
        message:
          "Qeyd etdim: əsas xidmətlərə logistika və yükdaşıma daxildir. Əlaqə üçün əsas nömrəni yazın.",
        nextQuestion: {
          key: "contacts",
          step: "contacts",
          label: "Əlaqə yolu",
          title: "Əlaqə yolu",
          prompt:
            "Əlaqə üçün əsas nömrəni, WhatsApp-ı, emaili və ya linki yazın.",
          group: "business_truth",
          groupLabel: "Business truth",
          priority: 1,
        },
        draft: {
          businessName: "Mane MMC",
          whatThisBusinessIs: "Logistika şirkəti",
          coreServices: ["logistika", "yükdaşıma"],
        },
        acceptedPatch: {
          identity: {},
          services: ["logistika", "yükdaşıma"],
          contacts: [],
          hours: [],
          pricingPosture: "",
          humanHandoff: "",
          aiBehavior: {
            languages: ["az-AZ"],
          },
        },
        rejectedInputs: [],
        confidence: {
          strong: ["services"],
          unclear: [],
          contradictions: [],
        },
        recommendation: {
          notes: [],
        },
        sourceSignals: {
          primarySourceType: "",
          primarySourceLabel: "",
          primarySourceUrl: "",
          primarySourceAuthorityClass: "",
          pageCount: 0,
          sourceTypes: [],
          strongestEvidence: [],
          discoveredPublicClaims: [],
          companyNameCandidates: [],
          descriptionCandidates: [],
          serviceCandidates: ["logistika", "yükdaşıma"],
          contactCandidates: [],
          hoursCandidates: [],
          pricingCandidates: [],
          audienceCandidates: [],
          languagesCandidates: ["az-AZ"],
        },
        interviewPlan: {
          activeQuestionKeys: ["contacts"],
          activeQuestions: [
            {
              key: "contacts",
              step: "contacts",
              title: "Əlaqə yolu",
              group: "business_truth",
              groupLabel: "Business truth",
              priority: 1,
            },
          ],
          remainingQuestionKeys: ["contacts"],
          nextGroup: "business_truth",
          nextGroupLabel: "Business truth",
        },
        aiBehavior: {
          languages: ["az-AZ"],
        },
        readyForApproval: false,
      }),
      patchSetupReviewDraft: async (input) => {
        persistedDrafts.push(input);
        return {
          ok: true,
        };
      },
      updateSetupReviewSession: async (sessionId, patch) => {
        reviewSessionUpdates.push({ sessionId, patch });
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
  assert.equal(result.body.setup.assistant.mode, "brain_v4");
  assert.equal(result.body.setup.assistant.nextQuestion.key, "contacts");

  assert.equal(persistedDrafts.length, 1);
  assert.equal(persistedDrafts[0].sessionId, "session-1");
  assert.equal(persistedDrafts[0].bumpVersion, true);

  const payload = persistedDrafts[0].patch.draftPayload;
  assert.ok(payload.setupAssistant);
  assert.ok(payload.setupAssistantBrain);
  assert.equal(Array.isArray(payload.setupAssistantTimeline), true);
  assert.equal(payload.setupAssistantTimeline.length, 2);
  assert.equal(payload.setupAssistantTimeline[0].role, "user");
  assert.equal(payload.setupAssistantTimeline[1].role, "assistant");

  assert.equal(reviewSessionUpdates.length, 1);
  assert.equal(reviewSessionUpdates[0].sessionId, "session-1");
  assert.equal(reviewSessionUpdates[0].patch.currentStep, "contacts");

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "setup_assistant.draft.updated");
  assert.equal(audits[0].meta.nextQuestion, "contacts");
});

test("updateSetupAssistantDraft returns 400 for empty direct-patch request", async () => {
  const review = createReview({
    sessionId: "session-1",
    currentStep: "company",
  });

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
      },
      body: {},
    },
    {
      getCurrentSetupReview: async () => review,
      runSetupAssistantOpenAIOrchestrator: async () => {
        throw new Error("should not be called");
      },
    }
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "SetupAssistantDraftInvalid");
});