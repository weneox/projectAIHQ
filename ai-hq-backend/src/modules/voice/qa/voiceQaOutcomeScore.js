export const VOICE_QA_OUTCOME_SCORE_VERSION = "voice-qa-outcome-score-v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function uniqueStrings(value = []) {
  return [
    ...new Set(
      arr(value)
        .map((item) => s(item))
        .filter(Boolean)
    ),
  ];
}

function hasAny(values = [], candidates = []) {
  const set = new Set(arr(values).map((item) => s(item)));
  return arr(candidates).some((candidate) => set.has(s(candidate)));
}

function clampScore(value = 0) {
  return Math.max(0, Math.min(100, Math.round(n(value, 0))));
}

function severityRank(value = "") {
  const raw = s(value).toLowerCase();
  if (raw === "critical") return 4;
  if (raw === "high") return 3;
  if (raw === "medium") return 2;
  if (raw === "low") return 1;
  return 0;
}

function highestSeverity(values = []) {
  let highest = "";
  let rank = 0;

  for (const value of arr(values)) {
    const next = s(value).toLowerCase();
    const nextRank = severityRank(next);
    if (nextRank > rank) {
      highest = next;
      rank = nextRank;
    }
  }

  return highest || "none";
}

function naturalnessLabelsFromQa(qa = {}) {
  const lastAnnotation = obj(qa.lastAnnotation);
  return uniqueStrings([
    ...arr(qa.naturalnessLabels),
    ...arr(qa.latestNaturalnessLabels),
    ...arr(lastAnnotation.naturalnessLabels),
    ...arr(qa.annotations).flatMap((annotation) => arr(obj(annotation).naturalnessLabels)),
  ]);
}

function issueLabelsFromQa(qa = {}) {
  return uniqueStrings([
    ...arr(qa.issueLabels),
    ...arr(qa.latestIssueLabels),
    ...arr(obj(qa.lastAnnotation).issueLabels),
    ...arr(qa.annotations).flatMap((annotation) => arr(obj(annotation).issueLabels)),
  ]);
}

function slotLabelsFromQa(qa = {}) {
  return uniqueStrings([
    ...arr(qa.slotLabels),
    ...arr(qa.latestSlotLabels),
    ...arr(obj(qa.lastAnnotation).slotLabels),
    ...arr(qa.annotations).flatMap((annotation) => arr(obj(annotation).slotLabels)),
  ]);
}

function naturalnessScoreFromQa(qa = {}) {
  const values = [
    qa.latestNaturalnessScore,
    obj(qa.lastAnnotation).naturalnessScore,
    ...arr(qa.annotations).map((annotation) => obj(annotation).naturalnessScore),
  ].map((value) => n(value, 0)).filter((value) => value > 0);

  if (!values.length) return 0;
  return Math.min(...values);
}

function pushReason(reasons, reason = {}) {
  const code = s(reason.reasonCode || reason.code);
  if (!code) return;

  reasons.push({
    reasonCode: code,
    label: s(reason.label || code),
    severity: s(reason.severity || "medium"),
    weight: n(reason.weight, 0),
  });
}

export function buildVoiceQaOutcomeScore({
  callSummary = {},
  runtime = {},
  tools = {},
  timeline = {},
  qa = {},
  flags = {},
} = {}) {
  const issueLabels = issueLabelsFromQa(qa);
  const slotLabels = slotLabelsFromQa(qa);
  const naturalnessLabels = naturalnessLabelsFromQa(qa);
  const naturalnessScore = naturalnessScoreFromQa(qa);
  const reasons = [];

  const runtimeBlocked = runtime.blocked === true || flags.blocked === true;
  const badCall = qa.badCall === true || flags.qaBadCall === true || s(qa.latestVerdict) === "bad_call";
  const needsFix = qa.needsFix === true || flags.qaNeedsFix === true || s(qa.latestVerdict) === "needs_fix";
  const qaPassed = flags.qaPassed === true || s(qa.latestVerdict) === "pass";
  const hasMissingRequired = tools.hasMissingRequired === true || flags.hasMissingRequired === true;
  const requestRecorded = tools.hasRequestRecorded === true || flags.requestRecorded === true;
  const handoffRequested = callSummary.handoffRequested === true;
  const handoffCompleted = callSummary.handoffCompleted === true;
  const hasToolIssue = hasAny(issueLabels, [
    "wrong_tool",
    "fake_confirmation",
    "booking_error",
    "handoff_error",
    "hallucination",
  ]);
  const hasNaturalnessIssue =
    naturalnessLabels.length > 0 ||
    naturalnessScore > 0 ||
    hasAny(issueLabels, [
      "robotic_voice",
      "unnatural_az",
      "interruption_issue",
      "silence_issue",
      "latency_issue",
    ]);

  if (runtimeBlocked) {
    pushReason(reasons, {
      reasonCode: s(runtime.reasonCode, "runtime_blocked"),
      label: "Runtime blocked or unsupported.",
      severity: "critical",
      weight: 45,
    });
  }

  if (badCall) {
    pushReason(reasons, {
      reasonCode: "qa_bad_call",
      label: "Operator marked the call as bad.",
      severity: "critical",
      weight: 40,
    });
  }

  if (hasToolIssue) {
    pushReason(reasons, {
      reasonCode: "tool_policy_issue",
      label: "Tool policy or confirmation issue detected.",
      severity: "high",
      weight: 30,
    });
  }

  if (hasMissingRequired) {
    pushReason(reasons, {
      reasonCode: "missing_required_details",
      label: "Required caller details are still missing.",
      severity: "medium",
      weight: 20,
    });
  }

  if (needsFix && !badCall) {
    pushReason(reasons, {
      reasonCode: "qa_needs_fix",
      label: "Operator correction is required.",
      severity: s(qa.latestSeverity, "medium"),
      weight: 18,
    });
  }

  if (hasNaturalnessIssue) {
    pushReason(reasons, {
      reasonCode: "naturalness_issue",
      label: "Voice naturalness needs repair.",
      severity: naturalnessScore > 0 && naturalnessScore <= 2 ? "medium" : "low",
      weight: naturalnessScore > 0 ? Math.max(8, 18 - naturalnessScore * 2) : 12,
    });
  }

  if (handoffRequested && !handoffCompleted) {
    pushReason(reasons, {
      reasonCode: "handoff_pending",
      label: "Human handoff is pending.",
      severity: "medium",
      weight: 18,
    });
  }

  let status = "review_optional";
  let outcome = "review_optional";
  let operatorAction = s(flags.operatorAction, "review_optional");

  if (runtimeBlocked) {
    status = "runtime_issue";
    outcome = "runtime_issue";
    operatorAction = "fix_runtime";
  } else if (badCall) {
    status = "bad_call";
    outcome = "bad_call";
    operatorAction = "review_bad_call";
  } else if (hasToolIssue) {
    status = "tool_issue";
    outcome = "tool_issue";
    operatorAction = operatorAction === "review_optional" ? "apply_qa_correction" : operatorAction;
  } else if (hasMissingRequired) {
    status = "missing_details";
    outcome = "missing_details";
    operatorAction = "ask_missing_details";
  } else if (hasNaturalnessIssue) {
    status = "naturalness_issue";
    outcome = "naturalness_issue";
    operatorAction = operatorAction === "review_optional" ? "apply_qa_correction" : operatorAction;
  } else if (handoffRequested && !handoffCompleted) {
    status = "needs_human";
    outcome = "needs_human";
    operatorAction = "complete_handoff";
  } else if (requestRecorded) {
    status = "needs_human";
    outcome = "request_followup";
    operatorAction = "process_request";
  } else if (qaPassed || s(callSummary.outcome) === "resolved") {
    status = "resolved";
    outcome = "resolved";
    operatorAction = "reviewed_pass";
  }

  const penalty = reasons.reduce((sum, reason) => sum + n(reason.weight, 0), 0);
  const score = clampScore(100 - penalty);

  return {
    version: VOICE_QA_OUTCOME_SCORE_VERSION,
    status,
    outcome,
    score,
    severity: highestSeverity(reasons.map((reason) => reason.severity)),
    needsHumanReview:
      status !== "resolved" &&
      (
        status !== "review_optional" ||
        flags.needsHumanReview === true ||
        reasons.length > 0
      ),
    operatorAction,
    reasonCodes: reasons.map((reason) => reason.reasonCode),
    reasons,
    signals: {
      runtimeBlocked,
      badCall,
      needsFix,
      qaPassed,
      hasMissingRequired,
      requestRecorded,
      handoffRequested,
      handoffCompleted,
      hasToolIssue,
      hasNaturalnessIssue,
      issueLabels,
      slotLabels,
      naturalnessLabels,
      naturalnessScore,
      toolOutcomeCount: n(tools.total, 0),
      timelineEventCount: n(timeline.total, 0),
    },
  };
}
