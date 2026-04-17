import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantResponseBody,
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
  buildReview,
} from "./setup-assistant-test-helpers.js";

function buildHiddenSynthesisDraft(overrides = {}) {
  return buildCompleteBusinessDraft({
    pricingPosture: {
      publicSummary: "Pricing depends on the service.",
    },
    silentSynthesis: {
      visibilityMode: "hidden_until_review",
      synthesisStatus: "synthesized",
      lastSynthesizedAt: "2026-04-18T10:00:00.000Z",
      rawEvidenceLog: [
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic https://acme.az",
          createdAt: "2026-04-18T09:58:00.000Z",
        },
      ],
      structuredDraft: {
        businessProfile: {
          companyName: "Acme Clinic",
          description: "Dental clinic in Baku",
          websiteUrl: "https://acme.az",
        },
        services: [{ title: "Consultation" }],
        contacts: [{ value: "+994551112233", preferred: true }],
        pricingPosture: {
          publicSummary: "Pricing depends on the service.",
        },
      },
      polishedDraft: {
        businessName: "Acme Clinic",
        businessDescription: "Professional dental clinic in Baku.",
        websiteUrl: "https://acme.az",
        coreServices: ["Consultation"],
        contactRoutes: ["+994551112233"],
        workingHoursLines: ["monday 09:00-18:00"],
        pricingSummary: "Pricing depends on the service.",
        professionalizedAt: "2026-04-18T10:00:00.000Z",
      },
      unresolvedNotes: ["Confirm Saturday hours"],
      recommendationNotes: ["Add booking page later"],
    },
    ...overrides,
  });
}

test("session payload hides the user-facing draft while exposing internal hidden synthesis state", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "pricing",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
        assistantMessage: "Okay. What should AI say about pricing?",
      }),
    })
  );

  assert.equal(payload.setup.draftPreviewHidden, true);
  assert.equal(payload.setup.assistant.draftPreviewHidden, true);
  assert.equal(payload.setup.draftVisibilityMode, "hidden_until_review");
  assert.equal(
    payload.setup.assistant.draftVisibilityMode,
    "hidden_until_review"
  );
  assert.deepEqual(payload.setup.draft, {});

  assert.deepEqual(payload.setup.hiddenSynthesis, {
    synthesisStatus: "synthesized",
    lastSynthesizedAt: "2026-04-18T10:00:00.000Z",
    hasPolishedDraft: true,
    unresolvedNotes: ["Confirm Saturday hours"],
    recommendationNotes: ["Add booking page later"],
  });

  assert.equal(payload.setup.reviewDraft.businessName, "Acme Clinic");
  assert.equal(
    payload.setup.reviewDraft.businessDescription,
    "Professional dental clinic in Baku."
  );
  assert.equal(
    payload.setup.rawDraft.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(
    payload.setup.rawDraft.pricingPosture.publicSummary,
    "Pricing depends on the service."
  );
  assert.ok(
    payload.setup.assistant.sections.some(
      (section) => section.key === "pricing_behavior"
    )
  );
  assert.deepEqual(payload.setup.assistant.approvalBlockers, []);
});

test("ready-for-approval payload reveals the user-facing draft while keeping raw and review drafts available", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "handoff_behavior",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
        assistantMessage: "Okay. The draft is ready.",
      }),
    })
  );

  assert.equal(payload.setup.assistant.readyForApproval, true);
  assert.equal(payload.setup.review.readyForApproval, true);
  assert.equal(payload.setup.review.finalizeAvailable, true);
  assert.equal(payload.setup.draftPreviewHidden, false);
  assert.equal(payload.setup.assistant.draftPreviewHidden, false);
  assert.equal(payload.setup.draft.businessName, "Acme Clinic");
  assert.equal(
    payload.setup.draft.businessDescription,
    "Professional dental clinic in Baku."
  );
  assert.equal(payload.setup.reviewDraft.businessName, "Acme Clinic");
  assert.equal(
    payload.setup.rawDraft.businessProfile.companyName,
    "Acme Clinic"
  );
});

test("response body does not promote finalize when the base payload still has blockers", () => {
  const basePayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Acme Clinic",
        },
        silentSynthesis: {
          visibilityMode: "hidden_until_review",
          synthesisStatus: "partial",
          polishedDraft: {
            businessName: "Acme Clinic",
          },
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const response = buildSetupAssistantResponseBody(basePayload, {
    readyForApproval: true,
    phase: "ready",
    assistantMessage: "Approve it.",
  });

  assert.equal(response.setup.assistant.readyForApproval, false);
  assert.equal(response.setup.review.finalizeAvailable, false);
  assert.equal(response.setup.draftPreviewHidden, true);
  assert.deepEqual(response.setup.draft, {});
});
