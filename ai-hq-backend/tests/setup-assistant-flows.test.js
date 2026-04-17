import test from "node:test";
import assert from "node:assert/strict";

import { updateSetupAssistantDraft } from "../src/services/workspace/setup/setupAssistantApp/flows.js";
import {
  FIXED_ISO,
  buildDraft,
  buildReview,
} from "./setup-assistant-test-helpers.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFlowHarness({
  review = buildReview(),
  runSetupAssistantOpenAIOrchestrator,
} = {}) {
  let currentReview = clone(review);
  const actor = {
    tenantId: "tenant-1",
    user: {
      id: "4f08d501-1c8f-4f0b-a7bf-2c924f7dad55",
    },
  };
  const calls = {
    orchestration: [],
    patchedDrafts: [],
    sessionUpdates: [],
  };

  const deps = {
    getCurrentSetupReview: async () => clone(currentReview),
    patchSetupReviewDraft: async ({ patch, bumpVersion }) => {
      calls.patchedDrafts.push(clone(patch));
      currentReview = {
        ...currentReview,
        draft: {
          ...currentReview.draft,
          version: bumpVersion
            ? Number(currentReview.draft.version || 0) + 1
            : currentReview.draft.version,
          updatedAt: FIXED_ISO,
          draftPayload: clone(patch.draftPayload),
        },
      };
    },
    updateSetupReviewSession: async (reviewSessionId, patch) => {
      calls.sessionUpdates.push({
        reviewSessionId,
        ...clone(patch),
      });
      currentReview = {
        ...currentReview,
        session: {
          ...currentReview.session,
          ...clone(patch),
          updatedAt: FIXED_ISO,
        },
      };
    },
    auditSetupAction: async () => {},
  };

  if (typeof runSetupAssistantOpenAIOrchestrator === "function") {
    deps.runSetupAssistantOpenAIOrchestrator = async (payload) => {
      calls.orchestration.push(clone(payload));
      return clone(await runSetupAssistantOpenAIOrchestrator(payload));
    };
  }

  return {
    actor,
    calls,
    getReview() {
      return clone(currentReview);
    },
    async update(body) {
      return updateSetupAssistantDraft(
        {
          db: null,
          actor,
          body,
        },
        deps
      );
    },
  };
}

test("message mode persists hidden synthesis, appends raw evidence, and keeps timeline clean", async () => {
  const harness = createFlowHarness({
    review: buildReview({
      currentStep: "company",
      setupAssistant: buildDraft({
        languages: ["en"],
      }),
    }),
    runSetupAssistantOpenAIOrchestrator: async () => ({
      phase: "interview",
      assistantMessage: "Okay. Briefly: what does this business do?",
      nextQuestion: {
        key: "description",
        step: "description",
        prompt: "Briefly: what does this business do?",
        group: "business_truth",
      },
      acceptedPatch: {
        identity: {
          businessName: "Acme Clinic",
          websiteUrl: "https://acme.az",
        },
      },
      draft: {
        businessName: "Acme Clinic",
        whatThisBusinessIs: "Independent dental clinic in Baku.",
        websiteUrl: "https://acme.az",
        coreServices: ["Consultation"],
      },
      confidence: {
        strong: ["company"],
        unclear: [],
        contradictions: [],
      },
      recommendation: {
        notes: ["Collect the short description next."],
      },
      sourceSignals: {
        primarySourceType: "website",
        primarySourceUrl: "https://internal.example/private-profile",
        strongestEvidence: ["Website captured internally"],
      },
      provider: "local_reasoning",
      model: "test-model",
      readyForApproval: false,
    }),
  });

  const result = await harness.update({
    mode: "message",
    step: "company",
    message: "Acme Clinic https://acme.az",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.setup.hiddenSynthesis.synthesisStatus, "synthesized");
  assert.equal(result.body.setup.hiddenSynthesis.hasPolishedDraft, true);
  assert.equal(result.body.setup.draftPreviewHidden, true);
  assert.equal(result.body.setup.assistant.draftPreviewHidden, true);
  assert.equal(
    result.body.setup.assistant.draftVisibilityMode,
    "hidden_until_review"
  );
  assert.equal(result.body.setup.reviewDraft.businessName, "Acme Clinic");
  assert.equal(result.body.setup.rawDraft.businessProfile.companyName, "Acme Clinic");
  assert.equal(
    result.body.assistant.sourceSignals.primarySourceUrl,
    "https://internal.example/private-profile"
  );

  const persisted = harness.getReview().draft.draftPayload.setupAssistant;
  assert.equal(persisted.silentSynthesis.rawEvidenceLog.length, 1);
  assert.deepEqual(persisted.silentSynthesis.rawEvidenceLog[0], {
    id: persisted.silentSynthesis.rawEvidenceLog[0].id,
    kind: "user_answer",
    step: "company",
    text: "Acme Clinic https://acme.az",
    normalizedText: "Acme Clinic https://acme.az",
    fieldKey: "company",
    confidence: "high",
    hidden: true,
    createdAt: persisted.silentSynthesis.rawEvidenceLog[0].createdAt,
  });
  assert.equal(
    persisted.silentSynthesis.structuredDraft.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(
    persisted.silentSynthesis.polishedDraft.businessName,
    "Acme Clinic"
  );
  assert.equal(
    persisted.silentSynthesis.polishedDraft.businessDescription,
    "Independent dental clinic in Baku."
  );

  const timeline = harness.getReview().draft.draftPayload.setupAssistantTimeline;
  assert.equal(timeline.length, 2);
  assert.deepEqual(
    timeline.map((turn) => ({
      role: turn.role,
      questionKey: turn.questionKey,
      meta: turn.meta,
    })),
    [
      {
        role: "user",
        questionKey: "company",
        meta: "",
      },
      {
        role: "assistant",
        questionKey: "description",
        meta: "",
      },
    ]
  );
  assert.ok(
    timeline
      .filter((turn) => turn.role === "assistant")
      .every(
      (turn) =>
        !String(turn.text || "").includes("http") &&
        !String(turn.meta || "").includes("http")
      )
  );
  assert.equal(harness.calls.sessionUpdates[0].currentStep, "description");
});

test("direct patch mode also refreshes hidden synthesis without appending raw evidence", async () => {
  const harness = createFlowHarness({
    review: buildReview({
      currentStep: "company",
      setupAssistant: buildDraft({
        languages: ["en"],
      }),
    }),
    runSetupAssistantOpenAIOrchestrator: async () => ({
      phase: "interview",
      assistantMessage: "Okay. Briefly: what does this business do?",
      nextQuestion: {
        key: "description",
        step: "description",
        prompt: "Briefly: what does this business do?",
        group: "business_truth",
      },
      acceptedPatch: {},
      draft: {
        businessName: "Acme Clinic",
        whatThisBusinessIs: "Independent dental clinic in Baku.",
        websiteUrl: "https://acme.az",
      },
      confidence: {
        strong: [],
        unclear: ["description"],
        contradictions: [],
      },
      recommendation: {
        notes: ["Capture a short description next."],
      },
      provider: "local_reasoning",
      model: "test-model",
      readyForApproval: false,
    }),
  });

  const result = await harness.update({
    draft: {
      businessProfile: {
        companyName: "Acme Clinic",
        websiteUrl: "https://acme.az",
      },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.setup.hiddenSynthesis.synthesisStatus, "synthesized");
  assert.equal(result.body.setup.hiddenSynthesis.hasPolishedDraft, true);
  assert.equal(result.body.setup.reviewDraft.businessName, "Acme Clinic");
  assert.equal(result.body.setup.rawDraft.businessProfile.companyName, "Acme Clinic");

  const persisted = harness.getReview().draft.draftPayload.setupAssistant;
  assert.equal(
    Array.isArray(persisted.silentSynthesis.rawEvidenceLog)
      ? persisted.silentSynthesis.rawEvidenceLog.length
      : 0,
    0
  );
  assert.equal(
    persisted.silentSynthesis.structuredDraft.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(
    persisted.silentSynthesis.polishedDraft.businessName,
    "Acme Clinic"
  );
  assert.equal(
    persisted.silentSynthesis.recommendationNotes[0],
    "Capture a short description next."
  );
  assert.deepEqual(
    harness.getReview().draft.draftPayload.setupAssistantTimeline,
    []
  );
  assert.equal(harness.calls.sessionUpdates[0].currentStep, "description");
});
