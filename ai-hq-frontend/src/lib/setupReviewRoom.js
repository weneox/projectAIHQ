export function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

const FORBIDDEN_LEGACY_TOKENS = [
  "assistantBehaviorDraft",
  "pricingBehavior",
  "locationBehavior",
  "bookingBehavior",
  "contactBehavior",
  "handoffBehavior",
  "greetingStyle",
  "afterHoursBehavior",
  "local_reasoning",
];

export function setupReviewRoomHasLegacyTokens(value = {}) {
  const serialized = JSON.stringify(value || {});
  return FORBIDDEN_LEGACY_TOKENS.some((token) => serialized.includes(token));
}

export function normalizeSetupReviewRoomHeader(reviewRoom = {}) {
  const header = obj(obj(reviewRoom).header);

  return {
    status: s(header.status || "not_started"),
    title: s(header.title || "Prepare your AI business truth"),
    subtitle: s(
      header.subtitle ||
        "Add business information so AI can prepare a safe review draft."
    ),
    statusLabel: s(header.statusLabel || "Needs input"),
    badgeTone: s(header.badgeTone || "neutral"),
    primaryMessage: s(header.primaryMessage),
    trustNote: s(
      header.trustNote ||
        "Draft data is not runtime authority. Only approved truth can power customer-facing AI."
    ),
    nextAction: s(header.nextAction || "add_business_input"),
    blockingCount: Number(header.blockingCount || 0) || 0,
  };
}

export function normalizeSetupReviewRoomSections(reviewRoom = {}) {
  return arr(obj(reviewRoom).sections).map((section) => ({
    key: s(section?.key),
    label: s(section?.label || section?.key),
    status: s(section?.status || "missing"),
    required: section?.required !== false,
    itemCount: Number(section?.itemCount || 0) || 0,
    sourceBacked: section?.sourceBacked === true,
    action: s(section?.action || "review"),
  })).filter((section) => section.key);
}

export function normalizeSetupReviewRoomSectionDetails(reviewRoom = {}) {
  return arr(obj(reviewRoom).sectionDetails).map((section) => ({
    key: s(section?.key),
    title: s(section?.title || section?.key),
    status: s(section?.status || "missing"),
    action: s(section?.action || "review"),
    sourceBacked: section?.sourceBacked === true,
    facts: arr(section?.facts).map((fact) => ({
      key: s(fact?.key),
      label: s(fact?.label || fact?.key),
      value: s(fact?.value),
      kind: s(fact?.kind || "text"),
    })).filter((fact) => fact.key && fact.value),
    items: arr(section?.items).map((item) => s(item)).filter(Boolean),
    emptyState: s(section?.emptyState),
  })).filter((section) => section.key);
}

export function normalizeSetupReviewRoomActions(reviewRoom = {}) {
  const actions = obj(obj(reviewRoom).actions);
  const primary = obj(actions.primary);
  const approval = obj(actions.approval);

  return {
    primary: {
      id: s(primary.id || "add_business_input"),
      label: s(primary.label || "Add business information"),
      intent: s(primary.intent || "continue_setup"),
      enabled: primary.enabled !== false,
    },
    secondary: arr(actions.secondary).map((action) => ({
      id: s(action?.id),
      label: s(action?.label || action?.id),
      intent: s(action?.intent),
      enabled: action?.enabled !== false,
      setupBlocking: action?.setupBlocking === true,
    })).filter((action) => action.id),
    approval: {
      id: s(approval.id || "approve_and_publish_truth"),
      label: s(approval.label || "Approve and make live"),
      enabled: approval.enabled === true,
      blockedReason: s(approval.blockedReason),
      missingSections: arr(approval.missingSections).map((item) => s(item)).filter(Boolean),
      runtimeAuthorityAfterApproval: s(
        approval.runtimeAuthorityAfterApproval || "approved_truth"
      ),
    },
  };
}

export function normalizeSetupReviewRoomIssues(reviewRoom = {}) {
  return arr(obj(reviewRoom).issues).map((issue) => ({
    id: s(issue?.id),
    type: s(issue?.type),
    severity: s(issue?.severity || "info"),
    section: s(issue?.section),
    label: s(issue?.label || issue?.type),
    message: s(issue?.message),
    action: s(issue?.action),
  })).filter((issue) => issue.id && issue.message);
}

export function normalizeSetupReviewRoomRuntimeConsumers(reviewRoom = {}) {
  const runtimeConsumers = obj(obj(reviewRoom).runtimeConsumers);

  return {
    authority: s(runtimeConsumers.authority || "approved_truth"),
    blockedCount: Number(runtimeConsumers.blockedCount || 0) || 0,
    readyAfterApprovalCount:
      Number(runtimeConsumers.readyAfterApprovalCount || 0) || 0,
    activeCount: Number(runtimeConsumers.activeCount || 0) || 0,
    consumers: arr(runtimeConsumers.consumers).map((consumer) => ({
      key: s(consumer?.key),
      label: s(consumer?.label || consumer?.key),
      description: s(consumer?.description),
      currentState: s(consumer?.currentState || "blocked_pending_approved_truth"),
      requiresApprovedTruth: consumer?.requiresApprovedTruth !== false,
      runtimeAuthority: s(consumer?.runtimeAuthority || "approved_truth"),
      draftAuthority: s(consumer?.draftAuthority || "not_runtime_authority"),
    })).filter((consumer) => consumer.key),
  };
}

export function normalizeSetupReviewRoomIntake(reviewRoom = {}) {
  const intake = obj(obj(reviewRoom).intake);

  return {
    purpose: s(intake.purpose || "collect_business_truth_inputs"),
    websiteIsInputNotSetupModel: intake.websiteIsInputNotSetupModel === true,
    chatIsInputNotMainExperience: intake.chatIsInputNotMainExperience === true,
    primaryExperience: s(intake.primaryExperience || "review_room"),
    canAddMoreInput: intake.canAddMoreInput !== false,
    canStillAddInputAfterReady: intake.canStillAddInputAfterReady === true,
    options: arr(intake.options).map((option) => ({
      id: s(option?.id),
      label: s(option?.label || option?.id),
      description: s(option?.description),
      enabled: option?.enabled === true,
      status: s(option?.status || "available"),
      action: s(option?.action),
      primary: option?.primary === true,
      setupBlocking: option?.setupBlocking === true,
    })).filter((option) => option.id),
  };
}

export function normalizeSetupReviewRoomBrain(reviewRoom = {}) {
  const brain = obj(obj(reviewRoom).brain);
  const source = obj(brain.sourceIntelligence);
  const completion = obj(brain.sectionCompletion);
  const missing = obj(brain.missingFactsPlan);
  const conflict = obj(brain.conflictPlan);
  const decision = obj(brain.decisionPlan);
  const runtime = obj(brain.runtimeSimulation);

  return {
    version: Number(brain.version || 0) || 0,
    mode: s(brain.mode),
    primaryGoal: s(brain.primaryGoal || "prepare_approved_business_truth"),
    sourceIntelligence: {
      quality: s(source.quality || "missing"),
      evidenceCount: Number(source.evidenceCount || 0) || 0,
      primarySourceType: s(source.primarySourceType),
      primarySourceUrl: s(source.primarySourceUrl),
      risks: arr(source.risks).map((item) => s(item)).filter(Boolean),
      recommendation: s(source.recommendation),
      evidence: arr(source.evidence).map((item) => s(item)).filter(Boolean),
    },
    sectionCompletion: {
      total: Number(completion.total || 0) || 0,
      requiredCount: Number(completion.requiredCount || 0) || 0,
      completeCount: Number(completion.completeCount || 0) || 0,
      missingCount: Number(completion.missingCount || 0) || 0,
      needsReviewCount: Number(completion.needsReviewCount || 0) || 0,
      percent: Number(completion.percent || 0) || 0,
    },
    missingFactsPlan: {
      required: missing.required === true,
      missingSections: arr(missing.missingSections).map((item) => s(item)).filter(Boolean),
      nextQuestionKey: s(missing.nextQuestionKey),
      nextQuestion: obj(missing.nextQuestion),
      recommendedQuestions: arr(missing.recommendedQuestions).map((question) => ({
        key: s(question?.key),
        label: s(question?.label || question?.key),
        priority: Number(question?.priority || 0) || 0,
        prompt: s(question?.prompt),
        action: s(question?.action),
      })).filter((question) => question.key),
    },
    conflictPlan: {
      hasConflicts: conflict.hasConflicts === true,
      conflicts: arr(conflict.conflicts).map((item) => s(item)).filter(Boolean),
      action: s(conflict.action),
      operatorGuidance: s(conflict.operatorGuidance),
    },
    decisionPlan: {
      status: s(decision.status),
      canApprove: decision.canApprove === true,
      operatorDecision: s(decision.operatorDecision),
      recommendedNextAction: s(decision.recommendedNextAction),
      reason: s(decision.reason),
    },
    runtimeSimulation: {
      rule: s(runtime.rule || "draft_never_powers_runtime"),
      canActivateAfterApproval: runtime.canActivateAfterApproval === true,
      beforeApproval: arr(runtime.beforeApproval).map((surface) => ({
        key: s(surface?.key),
        label: s(surface?.label || surface?.key),
        risk: s(surface?.risk),
        state: s(surface?.state),
        authority: s(surface?.authority),
        safeToUseDraft: surface?.safeToUseDraft === true,
      })).filter((surface) => surface.key),
      afterApproval: arr(runtime.afterApproval).map((surface) => ({
        key: s(surface?.key),
        label: s(surface?.label || surface?.key),
        risk: s(surface?.risk),
        state: s(surface?.state),
        authority: s(surface?.authority),
        safeToUseDraft: surface?.safeToUseDraft === true,
      })).filter((surface) => surface.key),
    },
    productRules: arr(brain.productRules).map((item) => s(item)).filter(Boolean),
  };
}

export function normalizeSetupReviewRoomApprovalPreview(reviewRoom = {}) {
  const preview = obj(obj(reviewRoom).approvalPreview);

  return {
    version: Number(preview.version || 1) || 1,
    canApprove: preview.canApprove === true,
    action: s(preview.action || "blocked"),
    title: s(preview.title),
    draftAuthorityBeforeApproval: s(
      preview.draftAuthorityBeforeApproval || "not_runtime_authority"
    ),
    runtimeAuthorityAfterApproval: s(
      preview.runtimeAuthorityAfterApproval || "approved_truth"
    ),
    publishes: arr(preview.publishes).map((item) => ({
      key: s(item?.key),
      label: s(item?.label || item?.key),
      summary: s(item?.summary),
    })).filter((item) => item.key),
    publishCount:
      Number(preview.publishCount || arr(preview.publishes).length || 0) || 0,
    blockedBy: arr(preview.blockedBy).map((item) => ({
      id: s(item?.id),
      type: s(item?.type),
      section: s(item?.section),
      message: s(item?.message),
    })).filter((item) => item.id || item.message),
    missingSections: arr(preview.missingSections).map((item) => s(item)).filter(Boolean),
    excludedFromTruth: arr(preview.excludedFromTruth).map((item) => s(item)).filter(Boolean),
    notes: arr(preview.notes).map((item) => s(item)).filter(Boolean),
  };
}

export function normalizeSetupReviewRoom(reviewRoom = {}) {
  const safeRoom = obj(reviewRoom);

  return {
    primaryExperience: s(safeRoom.primaryExperience || "review_room"),
    mainSurface: s(safeRoom.mainSurface || "business_truth_review"),
    chatRole: s(safeRoom.chatRole || "input_method"),
    draftAuthority: s(safeRoom.draftAuthority || "not_runtime_authority"),
    runtimeAuthority: s(safeRoom.runtimeAuthority || "approved_truth"),
    readyForApproval: safeRoom.readyForApproval === true,
    recommendedNextAction: s(safeRoom.recommendedNextAction),
    hasLegacyTokens: setupReviewRoomHasLegacyTokens(safeRoom),
    header: normalizeSetupReviewRoomHeader(safeRoom),
    sections: normalizeSetupReviewRoomSections(safeRoom),
    sectionDetails: normalizeSetupReviewRoomSectionDetails(safeRoom),
    actions: normalizeSetupReviewRoomActions(safeRoom),
    issues: normalizeSetupReviewRoomIssues(safeRoom),
    runtimeConsumers: normalizeSetupReviewRoomRuntimeConsumers(safeRoom),
    intake: normalizeSetupReviewRoomIntake(safeRoom),
    approvalPreview: normalizeSetupReviewRoomApprovalPreview(safeRoom),
    brain: normalizeSetupReviewRoomBrain(safeRoom),
  };
}
