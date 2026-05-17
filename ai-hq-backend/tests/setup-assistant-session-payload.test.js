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
  assert.equal(
    payload.setup.assistant.sections.some(
      (section) => section.key === "pricing_behavior"
    ),
    false
  );
  assert.ok(
    payload.setup.assistant.sections.some((section) => section.key === "pricing")
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


test("session payload declares setup as review room product model", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const model = payload.setup.productModel;

  assert.equal(model.primaryExperience, "review_room");
  assert.equal(model.setupPurpose, "business_truth_preparation");

  assert.equal(model.businessTruthSetup.required, true);
  assert.equal(model.businessTruthSetup.runtimeAuthority, "approved_truth");
  assert.equal(model.businessTruthSetup.draftAuthority, "not_runtime_authority");

  assert.equal(model.assistantBehaviour.required, false);
  assert.equal(model.assistantBehaviour.defaulted, true);
  assert.equal(model.assistantBehaviour.authority, "style_only_not_truth");
  assert.equal(model.assistantBehaviour.setupBlocking, false);

  assert.deepEqual(model.reviewSections, [
    "profile",
    "services",
    "contacts",
    "hours",
    "pricing",
    "handoff",
    "languages",
    "sources",
  ]);

  assert.ok(model.inputMethods.includes("website_source"));
  assert.ok(model.inputMethods.includes("manual_brief"));
  assert.ok(model.inputMethods.includes("document_upload"));
  assert.ok(model.inputMethods.includes("chat_answers"));

  assert.ok(model.productRules.includes("review_room_is_main_experience"));
  assert.ok(model.productRules.includes("approved_truth_is_runtime_authority"));
  assert.ok(model.productRules.includes("assistant_behaviour_never_mutates_truth"));

  assert.doesNotMatch(
    JSON.stringify(model),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("session payload exposes optional assistant style separate from truth", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
      }),
    })
  );

  const profile = payload.setup.assistantStyleProfile;
  const modelProfile = payload.setup.productModel.assistantBehaviour.defaultProfile;

  assert.equal(profile.profileKey, "default_professional");
  assert.equal(profile.setupBlocking, false);
  assert.equal(profile.truthAuthority, false);
  assert.equal(profile.purpose, "style_only");
  assert.equal(profile.toneProfile, "professional");
  assert.equal(profile.replyLength, "concise");
  assert.equal(profile.emojiPolicy, "off");
  assert.equal(profile.openingPolicy, "polite_not_repetitive");
  assert.equal(profile.languagePolicy, "follow_customer_when_possible");
  assert.equal(
    profile.handoffPolicy,
    "offer_human_help_for_risk_exact_quote_complaint_unclear"
  );
  assert.equal(profile.customizationState, "optional");
  assert.equal(profile.safeToUseWithoutUserCustomization, true);

  assert.deepEqual(modelProfile, profile);
  assert.equal(payload.setup.productModel.assistantBehaviour.required, false);
  assert.equal(payload.setup.productModel.assistantBehaviour.setupBlocking, false);
  assert.equal(payload.setup.productModel.assistantBehaviour.authority, "style_only_not_truth");

  assert.equal(payload.setup.rawDraft.businessProfile.companyName, "Acme Clinic");

  assert.doesNotMatch(
    JSON.stringify({ profile, modelProfile }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("session payload exposes setup lifecycle state model", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const state = payload.setup.lifecycleState;

  assert.equal(state.version, 1);
  assert.equal(state.status, "draft_ready");
  assert.equal(payload.setup.status, "draft_ready");
  assert.equal(payload.setup.review.status, "draft_ready");
  assert.equal(state.primaryExperience, "review_room");
  assert.equal(state.businessTruthRequired, true);
  assert.equal(state.runtimeAuthority, "approved_truth");
  assert.equal(state.draftAuthority, "not_runtime_authority");
  assert.equal(state.assistantStyleBlocking, false);
  assert.equal(state.hasDraft, true);
  assert.equal(state.readyForApproval, false);
  assert.equal(state.canApprove, false);
  assert.equal(state.needsReview, true);
  assert.equal(state.recommendedNextAction, "review_business_draft");

  assert.doesNotMatch(
    JSON.stringify(state),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});

test("ready setup lifecycle promotes approval action without making draft runtime authority", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
      }),
    })
  );

  const state = payload.setup.lifecycleState;

  assert.equal(state.status, "ready_for_approval");
  assert.equal(state.readyForApproval, true);
  assert.equal(state.canApprove, true);
  assert.equal(state.needsReview, true);
  assert.equal(state.runtimeAuthority, "approved_truth");
  assert.equal(state.draftAuthority, "not_runtime_authority");
  assert.equal(state.recommendedNextAction, "approve_and_publish_truth");
  assert.equal(payload.setup.review.lifecycleState.status, "ready_for_approval");
});


test("session payload exposes setup review room sections", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
        sourceMetadata: {
          primarySourceType: "website",
          primarySourceUrl: "https://acme.az",
          sourceLabels: ["Official website"],
          evidenceSummary: ["Acme Clinic website evidence"],
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const room = payload.setup.reviewRoom;

  assert.equal(room.version, 1);
  assert.equal(room.primaryExperience, "review_room");
  assert.equal(room.mainSurface, "business_truth_review");
  assert.equal(room.chatRole, "input_method");
  assert.equal(room.draftAuthority, "not_runtime_authority");
  assert.equal(room.runtimeAuthority, "approved_truth");

  assert.deepEqual(
    room.sections.map((section) => section.key),
    [
      "profile",
      "services",
      "contacts",
      "hours",
      "pricing",
      "handoff",
      "languages",
      "sources",
    ]
  );

  assert.ok(room.requiredSections.includes("profile"));
  assert.ok(room.requiredSections.includes("services"));
  assert.ok(room.requiredSections.includes("contacts"));
  assert.equal(room.requiredSections.includes("sources"), false);

  const byKey = Object.fromEntries(room.sections.map((section) => [section.key, section]));

  assert.equal(byKey.profile.status, "complete");
  assert.equal(byKey.services.status, "complete");
  assert.equal(byKey.contacts.status, "complete");
  assert.equal(byKey.pricing.status, "complete");
  assert.equal(byKey.sources.status, "complete");
  assert.equal(byKey.sources.required, false);
  assert.equal(byKey.sources.sourceBacked, true);

  assert.equal(room.readyForApproval, false);
  assert.equal(room.recommendedNextAction, "review_business_draft");

  assert.doesNotMatch(
    JSON.stringify(room),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});
