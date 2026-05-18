import test from "node:test";
import assert from "node:assert/strict";

import { buildSetupBrainV5 } from "../src/services/workspace/setup/setupAssistantApp/brainV5.js";

test("setup brain v5 plans missing facts and blocks runtime before approval", () => {
  const brain = buildSetupBrainV5({
    setup: {
      businessProfile: {
        companyName: "Medhouse Klinika",
        description: "Clinic",
        websiteUrl: "https://medhouse.example",
      },
      services: [{ title: "Klinika Xidmətləri" }],
      sourceMetadata: {
        primarySourceType: "website",
        primarySourceUrl: "https://medhouse.example",
        sourceLabels: ["Official website"],
        evidenceSummary: ["Clinic services and contact page imported"],
      },
    },
    lifecycleState: {
      status: "missing_required_facts",
      canApprove: false,
      approvedLive: false,
      recommendedNextAction: "answer_missing_required_facts",
    },
    assistant: {
      nextQuestion: {
        key: "contacts",
        prompt: "Add a customer contact route.",
      },
      confidence: {
        contradictions: [],
      },
      sourceSignals: {
        strongestEvidence: ["Business profile is backed by website evidence"],
      },
    },
    reviewRoom: {
      sections: [
        {
          key: "profile",
          label: "Business profile",
          status: "complete",
          required: true,
          itemCount: 3,
          sourceBacked: true,
          action: "review_profile",
        },
        {
          key: "services",
          label: "Services",
          status: "complete",
          required: true,
          itemCount: 1,
          sourceBacked: true,
          action: "review_services",
        },
        {
          key: "contacts",
          label: "Contacts",
          status: "missing",
          required: true,
          itemCount: 0,
          sourceBacked: false,
          action: "review_contacts",
        },
      ],
      missingSections: ["contacts"],
      issues: [
        {
          id: "missing_contacts",
          type: "missing_required_fact",
          severity: "blocking",
          section: "contacts",
          message: "Contacts is required before approval.",
        },
      ],
      issueSummary: {
        blockingCount: 1,
      },
    },
  });

  assert.equal(brain.version, 5);
  assert.equal(brain.mode, "setup_brain_v5");
  assert.equal(brain.sourceIntelligence.quality, "strong");
  assert.equal(brain.missingFactsPlan.required, true);
  assert.equal(brain.missingFactsPlan.nextQuestionKey, "contacts");
  assert.equal(brain.decisionPlan.operatorDecision, "answer_missing_facts");
  assert.equal(brain.runtimeSimulation.canActivateAfterApproval, false);
  assert.ok(
    brain.runtimeSimulation.beforeApproval.every(
      (surface) => surface.state === "blocked_pending_approved_truth"
    )
  );
});

test("setup brain v5 recommends approval only when truth is ready", () => {
  const brain = buildSetupBrainV5({
    setup: {
      businessProfile: {
        companyName: "Medhouse Klinika",
        description: "Clinic",
      },
      services: [{ title: "Klinika Xidmətləri" }],
      contacts: [{ value: "0514005588" }],
      sourceMetadata: {
        evidenceSummary: ["Operator confirmed business details"],
      },
    },
    lifecycleState: {
      status: "ready_for_approval",
      canApprove: true,
      approvedLive: false,
      recommendedNextAction: "approve_and_publish_truth",
    },
    assistant: {
      confidence: {
        contradictions: [],
      },
    },
    reviewRoom: {
      sections: [
        {
          key: "profile",
          label: "Business profile",
          status: "complete",
          required: true,
          itemCount: 2,
        },
        {
          key: "services",
          label: "Services",
          status: "complete",
          required: true,
          itemCount: 1,
        },
        {
          key: "contacts",
          label: "Contacts",
          status: "complete",
          required: true,
          itemCount: 1,
        },
      ],
      missingSections: [],
      issues: [],
      issueSummary: {
        blockingCount: 0,
      },
    },
  });

  assert.equal(brain.missingFactsPlan.required, false);
  assert.equal(brain.conflictPlan.hasConflicts, false);
  assert.equal(brain.decisionPlan.operatorDecision, "approve_truth");
  assert.equal(brain.runtimeSimulation.canActivateAfterApproval, true);
  assert.ok(
    brain.runtimeSimulation.afterApproval.every(
      (surface) => surface.authority === "approved_truth"
    )
  );
});


test("setup brain v5 merges OpenAI reasoner decision hints", () => {
  const brain = buildSetupBrainV5({
    setup: {
      businessProfile: {
        companyName: "Acme",
        description: "Clinic",
      },
      services: [{ title: "Consultation" }],
      contacts: [{ value: "+994551112233" }],
      sourceMetadata: {
        evidenceSummary: ["Operator brief provided"],
      },
    },
    lifecycleState: {
      status: "draft_ready",
      canApprove: false,
      approvedLive: false,
      recommendedNextAction: "review_business_draft",
    },
    assistant: {
      brainDecision: {
        sourceQuality: "conflicting",
        missingSections: ["pricing"],
        conflictNotes: ["Website says one branch, operator says two branches."],
        operatorDecision: "resolve_conflicts",
        decisionReason: "Resolve source contradiction before approving.",
      },
      confidence: {
        contradictions: [],
      },
    },
    reviewRoom: {
      sections: [
        {
          key: "profile",
          label: "Business profile",
          status: "complete",
          required: true,
          itemCount: 2,
        },
        {
          key: "pricing",
          label: "Pricing posture",
          status: "complete",
          required: true,
          itemCount: 1,
        },
      ],
      missingSections: [],
      issues: [],
      issueSummary: {
        blockingCount: 0,
      },
    },
  });

  assert.equal(brain.sourceIntelligence.quality, "conflicting");
  assert.equal(brain.missingFactsPlan.missingSections.includes("pricing"), true);
  assert.equal(brain.conflictPlan.hasConflicts, true);
  assert.equal(brain.decisionPlan.operatorDecision, "resolve_conflicts");
  assert.match(brain.decisionPlan.reason, /source contradiction/i);
});
