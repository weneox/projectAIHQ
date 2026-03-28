import test from "node:test";
import assert from "node:assert/strict";

import {
  applyExecutionPolicyToActions,
  buildExecutionPolicySurfaceSummary,
  evaluateExecutionPolicy,
} from "../src/services/executionPolicy.js";
import { withOperationalReadinessContext } from "../src/services/operationalReadiness.js";

function buildRuntime({
  healthStatus = "ready",
  healthReasonCode = "",
  approvalOutcome = "auto_approvable",
  truthRiskLevel = "low",
  policyControls = null,
} = {}) {
  return {
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
      runtimeProjectionId: "projection-1",
      health: {
        status: healthStatus,
        primaryReasonCode: healthReasonCode,
      },
    },
    aiPolicy: {
      auto_reply_enabled: true,
      create_lead_enabled: true,
      suppress_ai_during_handoff: true,
    },
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
    },
    policyControls:
      policyControls || {
        tenantDefault: {
          surface: "tenant",
          controlMode: "autonomy_enabled",
          autonomyEnabled: true,
        },
        items: [],
      },
    raw: {
      projection: {
        metadata_json: {
          approvalPolicy: {
            strictestOutcome: approvalOutcome,
            risk: {
              level: truthRiskLevel,
            },
            affectedSurfaces: ["inbox", "comments", "voice"],
          },
        },
      },
    },
  };
}

test("execution policy allows healthy low-risk runtime actions", () => {
  const runtime = buildRuntime();
  const decision = evaluateExecutionPolicy({
    runtime,
    surface: "inbox",
    channelType: "instagram",
    action: {
      type: "send_message",
      meta: {
        intent: "knowledge_answer",
      },
    },
  });
  const summary = buildExecutionPolicySurfaceSummary({
    runtime,
    surface: "inbox",
    channelType: "instagram",
  });

  assert.equal(decision.outcome, "allowed");
  assert.equal(decision.autonomousAllowed, true);
  assert.equal(summary.lowRiskOutcome, "allowed");
});

test("execution policy restricts degraded and stale runtime execution", () => {
  const staleRuntime = buildRuntime({
    healthStatus: "stale",
    healthReasonCode: "projection_stale",
  });
  const applied = applyExecutionPolicyToActions({
    runtime: staleRuntime,
    surface: "inbox",
    channelType: "instagram",
    actions: [
      {
        type: "send_message",
        text: "We can help.",
        meta: { intent: "knowledge_answer" },
      },
      {
        type: "handoff",
        reason: "manual_review",
        meta: { intent: "handoff_request" },
      },
    ],
  });

  assert.equal(applied.summary.strictestOutcome, "blocked_until_repair");
  assert.equal(applied.summary.blockedUntilRepair, true);
  assert.equal(applied.actions.length, 1);
  assert.equal(applied.actions[0].type, "handoff");
  assert.equal(applied.filteredActions[0].type, "send_message");
});

test("execution policy escalates risky actions to human review or handoff", () => {
  const runtime = buildRuntime({
    approvalOutcome: "owner_approval_required",
    truthRiskLevel: "high",
  });

  const mediumRisk = evaluateExecutionPolicy({
    runtime,
    surface: "comments",
    channelType: "instagram",
    action: {
      type: "reply_comment",
      meta: {
        intent: "service_interest",
      },
    },
  });

  const highRisk = evaluateExecutionPolicy({
    runtime,
    surface: "inbox",
    channelType: "instagram",
    action: {
      type: "send_message",
      meta: {
        intent: "policy_claim",
      },
    },
  });

  assert.equal(mediumRisk.outcome, "allowed_with_human_review");
  assert.equal(mediumRisk.humanReviewRequired, true);
  assert.equal(highRisk.outcome, "handoff_required");
  assert.equal(highRisk.handoffRequired, true);
});

test("policy controls safely tighten per-channel autonomy", () => {
  const runtime = buildRuntime({
    policyControls: {
      tenantDefault: {
        surface: "tenant",
        controlMode: "handoff_preferred",
        handoffPreferred: true,
      },
      items: [
        {
          surface: "comments",
          controlMode: "operator_only_mode",
          operatorOnlyMode: true,
          changedBy: "admin@aihq.test",
        },
      ],
    },
  });

  const inboxDecision = evaluateExecutionPolicy({
    runtime,
    surface: "inbox",
    channelType: "instagram",
    action: {
      type: "send_message",
      meta: {
        intent: "service_interest",
      },
    },
  });
  const commentsDecision = evaluateExecutionPolicy({
    runtime,
    surface: "comments",
    channelType: "instagram",
    action: {
      type: "reply_comment",
      meta: {
        intent: "knowledge_answer",
      },
    },
  });

  assert.equal(inboxDecision.outcome, "allowed_with_human_review");
  assert.equal(inboxDecision.policyControl.controlMode, "handoff_preferred");
  assert.equal(commentsDecision.outcome, "operator_only");
  assert.equal(commentsDecision.policyControl.controlMode, "operator_only_mode");
});

test("unsafe runtime cannot be overridden into autonomous execution", () => {
  const runtime = buildRuntime({
    healthStatus: "stale",
    healthReasonCode: "projection_stale",
    policyControls: {
      tenantDefault: {
        surface: "tenant",
        controlMode: "autonomy_enabled",
        autonomyEnabled: true,
      },
      items: [],
    },
  });

  const decision = evaluateExecutionPolicy({
    runtime,
    surface: "voice",
    channelType: "voice",
    action: {
      type: "send_message",
      meta: {
        intent: "knowledge_answer",
      },
    },
  });

  assert.equal(decision.outcome, "blocked_until_repair");
  assert.equal(decision.autonomousAllowed, false);
});

test("operational readiness summaries carry execution policy posture", () => {
  const summary = withOperationalReadinessContext(
    {
      ok: true,
      enabled: true,
      blockers: {
        total: 1,
        voice: {
          missingSettings: 0,
          disabledSettings: 0,
          missingPhoneNumber: 0,
          samples: [],
        },
        meta: {
          missingChannelIds: 1,
          missingPageAccessToken: 0,
          samples: [{ tenantKey: "acme", reasonCode: "channel_identifiers_missing" }],
        },
        runtime: {
          missingProjection: 0,
          staleProjection: 0,
          invalidProjection: 0,
          samples: [],
        },
      },
    },
    { enforced: true, viewerRole: "operator" }
  );

  assert.equal(summary.executionPolicy?.strictestOutcome, "blocked_until_repair");
  assert.equal(summary.executionPolicy?.repairRequired, true);
  assert.ok(summary.executionPolicy?.reasonCodes.includes("channel_identifiers_missing"));
});
