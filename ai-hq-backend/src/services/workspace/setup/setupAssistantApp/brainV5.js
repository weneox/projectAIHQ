import { arr, compactDraftObject, obj, s } from "../draftShared.js";

const REQUIRED_SECTION_PROMPTS = {
  profile: "Confirm the business name, short description, and website.",
  services: "List the core services customers can ask about.",
  contacts: "Add customer-facing phone, WhatsApp, email, address, or links.",
  hours: "Add operating hours or availability rules.",
  pricing: "Define what AI may safely say about pricing.",
  handoff: "Define when AI must route the customer to a person.",
  languages: "Confirm supported customer languages.",
};

const RUNTIME_SURFACES = [
  {
    key: "public_widget",
    label: "Public website widget",
    risk: "customer_facing_public_reply",
  },
  {
    key: "inbox_ai",
    label: "Inbox AI replies",
    risk: "operator_visible_ai_reply",
  },
  {
    key: "voice_assistant",
    label: "Voice assistant",
    risk: "real_time_customer_voice",
  },
  {
    key: "automation_runtime",
    label: "Automation runtime",
    risk: "automated_business_action",
  },
  {
    key: "operator_copilot",
    label: "Operator copilot",
    risk: "human_assisted_context",
  },
];

function uniqueStrings(items = [], max = 24) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function sourceEvidenceTexts({ setup = {}, assistant = {} } = {}) {
  const sourceMetadata = obj(setup.sourceMetadata);
  const sourceSignals = obj(assistant.sourceSignals);

  return uniqueStrings(
    [
      ...arr(sourceMetadata.evidenceSummary),
      ...arr(sourceMetadata.sourceLabels),
      ...arr(sourceSignals.strongestEvidence),
      ...arr(sourceSignals.discoveredPublicClaims),
    ],
    30
  );
}

function buildSourceIntelligence({ setup = {}, assistant = {} } = {}) {
  const profile = obj(setup.businessProfile);
  const brainDecision = obj(assistant.brainDecision);
  const sourceMetadata = obj(setup.sourceMetadata);
  const sourceSignals = obj(assistant.sourceSignals);
  const evidence = sourceEvidenceTexts({ setup, assistant });
  const primarySourceUrl = s(
    sourceMetadata.primarySourceUrl ||
      sourceSignals.primarySourceUrl ||
      profile.websiteUrl
  );
  const primarySourceType = s(
    sourceMetadata.primarySourceType || sourceSignals.primarySourceType
  );

  const contradictionCount = arr(obj(assistant.confidence).contradictions).length;
  const deterministicQuality =
    contradictionCount > 0
      ? "conflicting"
      : primarySourceUrl && evidence.length >= 2
        ? "strong"
        : primarySourceUrl || evidence.length
          ? "partial"
          : "missing";
  const aiQuality = s(brainDecision.sourceQuality).toLowerCase();
  const quality = ["strong", "partial", "missing", "conflicting"].includes(aiQuality)
    ? aiQuality
    : deterministicQuality;

  return compactDraftObject({
    version: 1,
    authority: "review_evidence_not_runtime_truth",
    primarySourceType,
    primarySourceUrl,
    evidenceCount: evidence.length,
    evidence,
    quality,
    risks: [
      !primarySourceUrl && !evidence.length ? "no_source_evidence" : "",
      contradictionCount > 0 ? "conflicting_evidence" : "",
    ].filter(Boolean),
    recommendation:
      quality === "missing"
        ? "Add a website, pasted text, manual brief, or document before approval."
        : quality === "conflicting"
          ? "Resolve conflicting evidence before approval."
          : "Use source evidence as review context only; approved truth remains the runtime authority.",
  });
}

function buildSectionCompletion({ reviewRoom = {} } = {}) {
  const sections = arr(reviewRoom.sections);

  const completed = sections.filter((section) => s(section.status) === "complete");
  const missing = sections.filter((section) => s(section.status) === "missing");
  const needsReview = sections.filter((section) =>
    ["needs_review", "conflict", "blocked"].includes(s(section.status))
  );

  const required = sections.filter((section) => section.required !== false);
  const requiredComplete = required.filter(
    (section) => s(section.status) === "complete"
  );

  return {
    total: sections.length,
    requiredCount: required.length,
    completeCount: completed.length,
    missingCount: missing.length,
    needsReviewCount: needsReview.length,
    requiredCompleteCount: requiredComplete.length,
    percent:
      required.length > 0
        ? Math.round((requiredComplete.length / required.length) * 100)
        : 0,
  };
}

function buildMissingFactsPlan({ assistant = {}, reviewRoom = {} } = {}) {
  const brainDecision = obj(assistant.brainDecision);
  const sectionByKey = Object.fromEntries(
    arr(reviewRoom.sections).map((section) => [s(section.key), section])
  );

  const missingSections = uniqueStrings(
    [...arr(reviewRoom.missingSections), ...arr(brainDecision.missingSections)],
    20
  );
  const nextQuestion = obj(assistant.nextQuestion);
  const nextKey = s(nextQuestion.key || missingSections[0]);
  const recommendedQuestions = missingSections.map((key, index) => {
    const section = obj(sectionByKey[key]);

    return compactDraftObject({
      key,
      label: s(section.label || key),
      priority: index + 1,
      prompt: s(nextKey === key ? nextQuestion.prompt : "") ||
        REQUIRED_SECTION_PROMPTS[key] ||
        `Complete ${key}.`,
      action: s(section.action || "review_section"),
    });
  });

  return {
    required: missingSections.length > 0,
    missingSections,
    nextQuestionKey: nextKey,
    nextQuestion:
      recommendedQuestions.find((question) => question.key === nextKey) ||
      recommendedQuestions[0] ||
      null,
    recommendedQuestions,
  };
}

function buildConflictPlan({ assistant = {}, reviewRoom = {} } = {}) {
  const confidence = obj(assistant.confidence);
  const brainDecision = obj(assistant.brainDecision);
  const issueConflicts = arr(reviewRoom.issues)
    .filter((issue) => s(issue.type) === "source_conflict")
    .map((issue) => s(issue.message))
    .filter(Boolean);

  const conflicts = uniqueStrings(
    [...arr(confidence.contradictions), ...issueConflicts, ...arr(brainDecision.conflictNotes)],
    20
  );

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    action: conflicts.length ? "resolve_conflicts_before_approval" : "none",
    operatorGuidance: conflicts.length
      ? "Do not approve until the conflicting source evidence is resolved."
      : "No conflicting setup evidence detected.",
  };
}

function buildRuntimeSimulation({ lifecycleState = {} } = {}) {
  const approvedLive = lifecycleState.approvedLive === true;
  const canApprove = lifecycleState.canApprove === true;

  const beforeApproval = RUNTIME_SURFACES.map((surface) =>
    compactDraftObject({
      ...surface,
      state: approvedLive ? "active" : "blocked_pending_approved_truth",
      authority: approvedLive ? "approved_truth" : "none",
      safeToUseDraft: false,
    })
  );

  const afterApproval = RUNTIME_SURFACES.map((surface) =>
    compactDraftObject({
      ...surface,
      state: canApprove || approvedLive ? "ready" : "not_ready",
      authority: "approved_truth",
      safeToUseDraft: false,
    })
  );

  return {
    version: 1,
    rule: "draft_never_powers_runtime",
    beforeApproval,
    afterApproval,
    canActivateAfterApproval: canApprove || approvedLive,
  };
}

function buildDecisionPlan({
  lifecycleState = {},
  sourceIntelligence = {},
  missingFactsPlan = {},
  conflictPlan = {},
  sectionCompletion = {},
  assistant = {},
} = {}) {
  const status = s(lifecycleState.status || "not_started");
  const canApprove = lifecycleState.canApprove === true;

  const brainDecision = obj(assistant.brainDecision);
  const aiDecision = s(brainDecision.operatorDecision).toLowerCase();
  let operatorDecision = "add_business_input";

  if (
    ["approve_truth", "answer_missing_facts", "resolve_conflicts", "review_or_continue", "clarify_input"].includes(aiDecision)
  ) {
    operatorDecision = aiDecision;
  }

  if (conflictPlan.hasConflicts) {
    operatorDecision = "resolve_conflicts";
  } else if (missingFactsPlan.required) {
    operatorDecision = "answer_missing_facts";
  } else if (canApprove) {
    operatorDecision = "approve_truth";
  } else if (sectionCompletion.completeCount > 0 && operatorDecision === "add_business_input") {
    operatorDecision = "review_or_continue";
  }

  const deterministicReason =
    operatorDecision === "approve_truth"
      ? "Required business truth is complete and ready for approval."
      : operatorDecision === "resolve_conflicts"
        ? "Conflicting evidence blocks approval."
        : operatorDecision === "answer_missing_facts"
          ? "Required business facts are missing."
          : sourceIntelligence.quality === "missing"
            ? "No strong business evidence has been provided yet."
            : "Review the prepared business draft before approval.";

  return {
    status,
    canApprove,
    operatorDecision,
    recommendedNextAction: s(lifecycleState.recommendedNextAction),
    reason: s(brainDecision.decisionReason) || deterministicReason,
  };
}

export function buildSetupBrainV5({
  setup = {},
  lifecycleState = {},
  assistant = {},
  reviewRoom = {},
} = {}) {
  const sourceIntelligence = buildSourceIntelligence({ setup, assistant });
  const sectionCompletion = buildSectionCompletion({ reviewRoom });
  const missingFactsPlan = buildMissingFactsPlan({ assistant, reviewRoom });
  const conflictPlan = buildConflictPlan({ assistant, reviewRoom });
  const runtimeSimulation = buildRuntimeSimulation({ lifecycleState });
  const decisionPlan = buildDecisionPlan({
    lifecycleState,
    sourceIntelligence,
    missingFactsPlan,
    conflictPlan,
    sectionCompletion,
    assistant,
  });

  return {
    version: 5,
    mode: "setup_brain_v5",
    primaryGoal: "prepare_approved_business_truth",
    sourceIntelligence,
    sectionCompletion,
    missingFactsPlan,
    conflictPlan,
    decisionPlan,
    runtimeSimulation,
    productRules: [
      "business_truth_is_required",
      "draft_is_not_runtime_authority",
      "approved_truth_is_runtime_authority",
      "source_evidence_is_review_context_only",
      "assistant_style_never_changes_truth",
    ],
  };
}
