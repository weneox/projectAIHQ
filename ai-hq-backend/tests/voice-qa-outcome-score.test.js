import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVoiceQaOutcomeScore,
  VOICE_QA_OUTCOME_SCORE_VERSION,
} from "../src/modules/voice/qa/voiceQaOutcomeScore.js";

test("voice QA outcome score marks resolved pass calls", () => {
  const score = buildVoiceQaOutcomeScore({
    callSummary: {
      id: "call-pass",
      outcome: "resolved",
    },
    runtime: {
      blocked: false,
    },
    tools: {
      total: 0,
    },
    timeline: {
      total: 4,
    },
    qa: {
      latestVerdict: "pass",
    },
    flags: {
      qaPassed: true,
      needsHumanReview: false,
    },
  });

  assert.equal(score.version, VOICE_QA_OUTCOME_SCORE_VERSION);
  assert.equal(score.status, "resolved");
  assert.equal(score.outcome, "resolved");
  assert.equal(score.score, 100);
  assert.equal(score.needsHumanReview, false);
  assert.equal(score.operatorAction, "reviewed_pass");
});

test("voice QA outcome score prioritizes runtime issues", () => {
  const score = buildVoiceQaOutcomeScore({
    runtime: {
      blocked: true,
      reasonCode: "unsupported_realtime_provider",
    },
    tools: {
      hasMissingRequired: true,
      missingRequired: ["phone"],
    },
    flags: {
      blocked: true,
      hasMissingRequired: true,
    },
  });

  assert.equal(score.status, "runtime_issue");
  assert.equal(score.outcome, "runtime_issue");
  assert.equal(score.operatorAction, "fix_runtime");
  assert.equal(score.needsHumanReview, true);
  assert.ok(score.score < 60);
  assert.deepEqual(score.reasonCodes.slice(0, 1), ["unsupported_realtime_provider"]);
});

test("voice QA outcome score marks tool policy issues before naturalness", () => {
  const score = buildVoiceQaOutcomeScore({
    qa: {
      latestVerdict: "needs_fix",
      latestSeverity: "high",
      issueLabels: ["fake_confirmation", "unnatural_az"],
      lastAnnotation: {
        naturalnessLabels: ["recording_like"],
        naturalnessScore: 2,
      },
    },
    flags: {
      qaNeedsFix: true,
      needsHumanReview: true,
    },
  });

  assert.equal(score.status, "tool_issue");
  assert.equal(score.outcome, "tool_issue");
  assert.equal(score.signals.hasToolIssue, true);
  assert.equal(score.signals.hasNaturalnessIssue, true);
  assert.ok(score.reasonCodes.includes("tool_policy_issue"));
  assert.ok(score.reasonCodes.includes("naturalness_issue"));
});

test("voice QA outcome score marks naturalness-only repair", () => {
  const score = buildVoiceQaOutcomeScore({
    qa: {
      latestVerdict: "needs_fix",
      latestSeverity: "medium",
      lastAnnotation: {
        naturalnessLabels: ["too_formal", "turn_taking"],
        naturalnessScore: 2,
      },
    },
    flags: {
      qaNeedsFix: true,
      needsHumanReview: true,
    },
  });

  assert.equal(score.status, "naturalness_issue");
  assert.equal(score.outcome, "naturalness_issue");
  assert.deepEqual(score.signals.naturalnessLabels, ["too_formal", "turn_taking"]);
  assert.equal(score.signals.naturalnessScore, 2);
  assert.equal(score.operatorAction, "apply_qa_correction");
});

test("voice QA outcome score marks recorded requests as human follow-up", () => {
  const score = buildVoiceQaOutcomeScore({
    tools: {
      hasRequestRecorded: true,
      total: 1,
    },
    flags: {
      requestRecorded: true,
      operatorAction: "process_request",
      needsHumanReview: true,
    },
  });

  assert.equal(score.status, "needs_human");
  assert.equal(score.outcome, "request_followup");
  assert.equal(score.operatorAction, "process_request");
  assert.equal(score.needsHumanReview, true);
});
