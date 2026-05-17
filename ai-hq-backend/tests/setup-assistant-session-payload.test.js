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


test("setup review room exposes action model for approval and edits", () => {
  const readyPayload = buildSetupAssistantSessionPayload(
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

  const readyActions = readyPayload.setup.reviewRoom.actions;

  assert.equal(readyActions.version, 1);
  assert.equal(readyActions.primary.id, "approve_and_publish_truth");
  assert.equal(readyActions.primary.intent, "finalize_review");
  assert.equal(readyActions.primary.enabled, true);
  assert.equal(readyActions.approval.enabled, true);
  assert.equal(readyActions.approval.blockedReason, "");
  assert.equal(readyActions.approval.runtimeAuthorityAfterApproval, "approved_truth");

  assert.ok(
    readyActions.secondary.some(
      (action) =>
        action.id === "customize_assistant_style" &&
        action.setupBlocking === false
    )
  );

  const incompletePayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Only Name",
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const incompleteActions = incompletePayload.setup.reviewRoom.actions;

  assert.equal(incompleteActions.primary.id, "answer_missing_required_facts");
  assert.equal(incompleteActions.primary.intent, "answer_missing_facts");
  assert.equal(incompleteActions.approval.enabled, false);
  assert.equal(incompleteActions.approval.blockedReason, "missing_required_sections");
  assert.ok(incompleteActions.approval.missingSections.length > 0);

  assert.doesNotMatch(
    JSON.stringify({ readyActions, incompleteActions }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes missing and conflict issues", () => {
  const incompletePayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Only Name",
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
        confidence: {
          strong: [],
          unclear: ["services_missing"],
          contradictions: [],
        },
      }),
    })
  );

  const incompleteRoom = incompletePayload.setup.reviewRoom;

  assert.equal(incompleteRoom.issueSummary.hasBlockingIssues, true);
  assert.ok(incompleteRoom.issueSummary.missingCount > 0);
  assert.equal(incompleteRoom.issueSummary.conflictCount, 0);
  assert.ok(
    incompleteRoom.issues.some(
      (issue) =>
        issue.type === "missing_required_fact" &&
        issue.severity === "blocking" &&
        issue.section === "services"
    )
  );

  const conflictPayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
        confidence: {
          strong: ["business_name_present"],
          unclear: [],
          contradictions: ["Website says Old Clinic, owner says New Clinic."],
        },
      }),
    })
  );

  const conflictRoom = conflictPayload.setup.reviewRoom;

  assert.equal(conflictPayload.setup.lifecycleState.status, "conflict_needs_review");
  assert.equal(conflictRoom.issueSummary.conflictCount, 1);
  assert.equal(conflictRoom.issueSummary.hasBlockingIssues, true);
  assert.ok(
    conflictRoom.issues.some(
      (issue) =>
        issue.type === "source_conflict" &&
        issue.action === "resolve_conflicts" &&
        /Old Clinic/.test(issue.message)
    )
  );

  assert.doesNotMatch(
    JSON.stringify({
      incompleteRoom,
      conflictRoom,
    }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes evidence panel for source-grounded review", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
        sourceMetadata: {
          primarySourceType: "website",
          primarySourceUrl: "https://acme.az",
          sourceLabels: ["Official website"],
          evidenceSummary: ["Acme Clinic website says it offers dental consultation."],
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
        sourceSignals: {
          primarySourceType: "website",
          primarySourceUrl: "https://acme.az",
          strongestEvidence: [
            "Acme Clinic has WhatsApp +994551112233 and consultation service.",
          ],
        },
      }),
    })
  );

  const evidence = payload.setup.reviewRoom.evidence;

  assert.equal(evidence.version, 1);
  assert.equal(evidence.authority, "evidence_for_review_not_runtime_truth");
  assert.equal(evidence.runtimeAuthorityAfterApproval, "approved_truth");
  assert.equal(evidence.hasEvidence, true);
  assert.equal(evidence.primarySource.type, "website");
  assert.equal(evidence.primarySource.url, "https://acme.az");
  assert.ok(evidence.sourceLabels.includes("Official website"));

  assert.ok(
    evidence.evidenceCards.some((card) =>
      /dental consultation/i.test(card.text)
    )
  );
  assert.ok(
    evidence.evidenceCards.some((card) =>
      /WhatsApp \+994551112233/i.test(card.text)
    )
  );

  const sectionEvidenceByKey = Object.fromEntries(
    evidence.sectionEvidence.map((item) => [item.section, item])
  );

  assert.equal(sectionEvidenceByKey.profile.sourceBacked, true);
  assert.ok(sectionEvidenceByKey.profile.evidenceCount > 0);
  assert.equal(sectionEvidenceByKey.sources.sourceBacked, true);

  assert.doesNotMatch(
    JSON.stringify(evidence),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes runtime consumers gated by approved truth", () => {
  const draftPayload = buildSetupAssistantSessionPayload(
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

  const draftConsumers = draftPayload.setup.reviewRoom.runtimeConsumers;

  assert.equal(draftConsumers.version, 1);
  assert.equal(draftConsumers.authority, "approved_truth");
  assert.ok(draftConsumers.blockedCount > 0);
  assert.equal(draftConsumers.readyAfterApprovalCount, 0);
  assert.equal(draftConsumers.activeCount, 0);

  const draftByKey = Object.fromEntries(
    draftConsumers.consumers.map((consumer) => [consumer.key, consumer])
  );

  for (const key of [
    "public_widget",
    "inbox_ai",
    "voice_assistant",
    "automation_runtime",
    "operator_copilot",
  ]) {
    assert.equal(draftByKey[key].requiresApprovedTruth, true);
    assert.equal(draftByKey[key].runtimeAuthority, "approved_truth");
    assert.equal(draftByKey[key].draftAuthority, "not_runtime_authority");
    assert.equal(draftByKey[key].currentState, "blocked_pending_approved_truth");
  }

  const readyPayload = buildSetupAssistantSessionPayload(
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

  const readyConsumers = readyPayload.setup.reviewRoom.runtimeConsumers;

  assert.equal(readyConsumers.blockedCount, 0);
  assert.ok(readyConsumers.readyAfterApprovalCount > 0);
  assert.equal(readyConsumers.activeCount, 0);
  assert.ok(
    readyConsumers.consumers.every(
      (consumer) => consumer.currentState === "ready_after_approval"
    )
  );

  assert.doesNotMatch(
    JSON.stringify({ draftConsumers, readyConsumers }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes intake options beyond website source", () => {
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

  const intake = payload.setup.reviewRoom.intake;
  const byId = Object.fromEntries(intake.options.map((option) => [option.id, option]));

  assert.equal(intake.version, 1);
  assert.equal(intake.purpose, "collect_business_truth_inputs");
  assert.equal(intake.websiteIsInputNotSetupModel, true);
  assert.equal(intake.chatIsInputNotMainExperience, true);
  assert.equal(intake.primaryExperience, "review_room");

  for (const id of [
    "website_source",
    "manual_brief",
    "pasted_text",
    "chat_answers",
    "existing_truth",
    "document_upload",
    "channel_metadata",
  ]) {
    assert.ok(byId[id], id);
  }

  assert.equal(byId.website_source.enabled, true);
  assert.equal(byId.website_source.status, "captured");
  assert.equal(byId.website_source.action, "review_website_source");

  assert.equal(byId.manual_brief.enabled, true);
  assert.equal(byId.pasted_text.enabled, true);
  assert.equal(byId.chat_answers.enabled, true);
  assert.equal(byId.existing_truth.enabled, true);

  assert.equal(byId.document_upload.enabled, false);
  assert.equal(byId.document_upload.status, "planned");
  assert.equal(byId.channel_metadata.enabled, false);
  assert.equal(byId.channel_metadata.status, "planned");

  assert.ok(intake.enabledOptions.includes("website_source"));
  assert.ok(intake.enabledOptions.includes("manual_brief"));
  assert.ok(intake.plannedOptions.includes("document_upload"));

  assert.doesNotMatch(
    JSON.stringify(intake),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("response body keeps review room aligned with guarded approval state", () => {
  const blockedBase = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Only Name",
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const blockedResponse = buildSetupAssistantResponseBody(blockedBase, {
    readyForApproval: true,
    phase: "ready",
    assistantMessage: "Approve it.",
  });

  assert.equal(blockedResponse.setup.review.readyForApproval, false);
  assert.equal(blockedResponse.setup.lifecycleState.readyForApproval, false);
  assert.equal(blockedResponse.setup.reviewRoom.readyForApproval, false);
  assert.equal(blockedResponse.setup.reviewRoom.actions.approval.enabled, false);
  assert.equal(
    blockedResponse.setup.reviewRoom.runtimeConsumers.blockedCount > 0,
    true
  );

  const readyBase = buildSetupAssistantSessionPayload(
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

  const readyResponse = buildSetupAssistantResponseBody(readyBase, {
    readyForApproval: true,
    phase: "ready",
    assistantMessage: "The draft is ready to approve.",
  });

  assert.equal(readyResponse.setup.review.readyForApproval, true);
  assert.equal(readyResponse.setup.lifecycleState.status, "ready_for_approval");
  assert.equal(readyResponse.setup.reviewRoom.readyForApproval, true);
  assert.equal(
    readyResponse.setup.reviewRoom.actions.primary.id,
    "approve_and_publish_truth"
  );
  assert.equal(readyResponse.setup.reviewRoom.actions.approval.enabled, true);
  assert.equal(readyResponse.setup.reviewRoom.runtimeConsumers.blockedCount, 0);
  assert.ok(
    readyResponse.setup.reviewRoom.runtimeConsumers.readyAfterApprovalCount > 0
  );

  assert.doesNotMatch(
    JSON.stringify({
      blocked: blockedResponse.setup.reviewRoom,
      ready: readyResponse.setup.reviewRoom,
    }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes approval preview for publishable truth", () => {
  const readyPayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "company",
      setupAssistant: buildHiddenSynthesisDraft({
        languages: ["en"],
        sourceMetadata: {
          primarySourceType: "website",
          primarySourceUrl: "https://acme.az",
          sourceLabels: ["Official website"],
          evidenceSummary: ["Acme Clinic source evidence"],
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
      }),
    })
  );

  const preview = readyPayload.setup.reviewRoom.approvalPreview;

  assert.equal(preview.version, 1);
  assert.equal(preview.canApprove, true);
  assert.equal(preview.action, "approve_and_publish_truth");
  assert.equal(preview.draftAuthorityBeforeApproval, "not_runtime_authority");
  assert.equal(preview.runtimeAuthorityAfterApproval, "approved_truth");
  assert.equal(preview.blockedBy.length, 0);
  assert.equal(preview.missingSections.length, 0);

  const publishKeys = preview.publishes.map((item) => item.key);

  assert.ok(publishKeys.includes("profile"));
  assert.ok(publishKeys.includes("services"));
  assert.ok(publishKeys.includes("contacts"));
  assert.ok(publishKeys.includes("pricing"));
  assert.ok(publishKeys.includes("sources"));
  assert.ok(preview.publishCount > 0);

  assert.ok(preview.excludedFromTruth.includes("assistant_style_profile"));
  assert.ok(preview.excludedFromTruth.includes("raw_source_evidence"));
  assert.ok(preview.excludedFromTruth.includes("transient_chat_turns"));

  const blockedPayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Only Name",
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const blockedPreview = blockedPayload.setup.reviewRoom.approvalPreview;

  assert.equal(blockedPreview.canApprove, false);
  assert.equal(blockedPreview.action, "blocked");
  assert.ok(blockedPreview.blockedBy.length > 0);
  assert.ok(blockedPreview.missingSections.length > 0);
  assert.equal(blockedPreview.runtimeAuthorityAfterApproval, "approved_truth");

  assert.doesNotMatch(
    JSON.stringify({ preview, blockedPreview }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});


test("setup review room exposes product header copy from lifecycle state", () => {
  const readyPayload = buildSetupAssistantSessionPayload(
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

  const readyHeader = readyPayload.setup.reviewRoom.header;

  assert.equal(readyHeader.version, 1);
  assert.equal(readyHeader.status, "ready_for_approval");
  assert.equal(readyHeader.statusLabel, "Ready for approval");
  assert.equal(readyHeader.badgeTone, "success");
  assert.match(readyHeader.title, /ready to approve/i);
  assert.match(readyHeader.subtitle, /runtime authority/i);
  assert.match(readyHeader.trustNote, /Draft data is not runtime authority/i);
  assert.equal(readyHeader.nextAction, "approve_and_publish_truth");

  const missingPayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "services",
      setupAssistant: buildDraft({
        languages: ["en"],
        businessProfile: {
          companyName: "Only Name",
        },
      }),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const missingHeader = missingPayload.setup.reviewRoom.header;

  assert.equal(missingHeader.status, "missing_required_facts");
  assert.equal(missingHeader.statusLabel, "Missing facts");
  assert.equal(missingHeader.badgeTone, "warning");
  assert.ok(missingHeader.blockingCount > 0);
  assert.match(missingHeader.primaryMessage, /required section/i);
  assert.equal(missingHeader.nextAction, "answer_missing_required_facts");

  assert.doesNotMatch(
    JSON.stringify({ readyHeader, missingHeader }),
    /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
  );
});
