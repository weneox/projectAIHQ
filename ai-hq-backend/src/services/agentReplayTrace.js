function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function bool(v) {
  return v === true;
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function pickOptionalBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function compactRecord(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(obj(input))) {
    if (typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.length) {
      out[key] = value;
      continue;
    }
    if (value && typeof value === "object" && Object.keys(value).length) {
      out[key] = value;
      continue;
    }
    if (s(value)) {
      out[key] = value;
    }
  }
  return out;
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function pickBehavior(input = {}) {
  const value = obj(input);
  return obj(
    value.behavior ||
      value.behavior_json ||
      value.runtimeBehavior ||
      value
  );
}

function pickChannelBehavior(behavior = {}, channel = "") {
  return obj(obj(behavior.channelBehavior)[s(channel)]);
}

function buildRuntimeRef(runtime = {}) {
  const value = obj(runtime);
  const authority = obj(value.authority || value.runtimeAuthority);
  const raw = obj(value.raw);
  const projection = obj(
    raw.projection || raw.runtimeProjection || raw.currentProjection
  );
  const metadata = obj(
    projection.metadata_json ||
      projection.metadata ||
      raw.metadata_json ||
      value.metadata_json
  );
  const source = s(authority.source || authority.authoritySource);

  return {
    tenantKey: s(
      authority.tenantKey ||
        value.tenantKey ||
        value.tenant_key ||
        value.tenant?.tenant_key
    ),
    tenantId: s(
      authority.tenantId ||
        value.tenantId ||
        value.tenant_id ||
        value.tenant?.id ||
        value.tenant?.tenant_id
    ),
    source,
    runtimeProjectionId: s(
      authority.runtimeProjectionId ||
        value.runtimeProjectionId ||
        value.runtime_projection_id
    ),
    runtimeProjectionStatus: s(
      authority.runtimeProjectionStatus ||
        value.runtimeProjectionStatus ||
        value.runtime_projection_status
    ),
    projectionHash: s(
      authority.projectionHash ||
        value.projectionHash ||
        value.projection_hash ||
        projection.projection_hash
    ),
    stale: authority.stale === true,
    reasonCode: s(authority.reasonCode),
    truthVersionId: pickFirstString(
      authority.truthVersionId,
      authority.publishedTruthVersionId,
      value.truthVersionId,
      value.truth_version_id,
      value.publishedTruthVersionId,
      value.published_truth_version_id,
      projection.truthVersionId,
      projection.truth_version_id,
      metadata.publishedTruthVersionId,
      metadata.published_truth_version_id,
      metadata.currentPublishedTruthVersionId,
      metadata.current_published_truth_version_id
    ),
    approvedRuntime:
      source === "approved_runtime_projection" && authority.available !== false,
  };
}

function buildRuntimeVersion(runtimeRef = {}) {
  const projectionId = s(runtimeRef.runtimeProjectionId);
  const projectionHash = s(runtimeRef.projectionHash);
  if (projectionId && projectionHash) return `${projectionId}:${projectionHash}`;
  return projectionId || projectionHash || "";
}

function resolveBehaviorChannel(channel = "", usecase = "") {
  const safeChannel = s(channel);
  const safeUsecase = lower(usecase);
  if (safeUsecase.startsWith("inbox.")) return "inbox";
  if (safeUsecase.includes("comment")) return "comments";
  if (safeUsecase.startsWith("sales.chat")) return "chat";
  if (safeUsecase.startsWith("content.")) return "content";
  return safeChannel;
}

function buildBehaviorSummary(behaviorInput = {}, channel = "") {
  const behavior = pickBehavior(behaviorInput);
  const qualificationQuestions = uniqStrings(
    behavior.qualificationQuestions || behavior.qualification_questions
  );
  const handoffTriggers = uniqStrings(
    behavior.handoffTriggers || behavior.handoff_triggers
  );
  const disallowedClaims = uniqStrings(
    behavior.disallowedClaims || behavior.disallowed_claims
  );
  const channelBehavior = pickChannelBehavior(behavior, channel);
  const activeFields = [
    behavior.niche ? "niche" : "",
    behavior.conversionGoal ? "conversionGoal" : "",
    behavior.primaryCta ? "primaryCta" : "",
    behavior.toneProfile ? "toneProfile" : "",
    qualificationQuestions.length ? "qualificationQuestions" : "",
    handoffTriggers.length ? "handoffTriggers" : "",
    disallowedClaims.length ? "disallowedClaims" : "",
    Object.keys(channelBehavior).length ? "channelBehavior" : "",
  ].filter(Boolean);

  return {
    niche: s(behavior.niche),
    conversionGoal: s(behavior.conversionGoal || behavior.conversion_goal),
    primaryCta: s(behavior.primaryCta || behavior.primary_cta),
    toneProfile: s(behavior.toneProfile || behavior.tone_profile),
    qualificationQuestionCount: qualificationQuestions.length,
    qualificationQuestionsPreview: qualificationQuestions.slice(0, 3),
    handoffTriggers,
    disallowedClaims,
    activeFields,
    channelBehavior,
  };
}

function buildPolicySummary(runtime = {}, behaviorInput = {}, policyInput = {}, channel = "") {
  const value = obj(runtime);
  const policyValue = obj(policyInput);
  const behavior = pickBehavior(behaviorInput || value);
  const channelBehavior = pickChannelBehavior(behavior, channel);

  return compactRecord({
    language: pickFirstString(
      value.language,
      value.outputLanguage,
      arr(value.languages)[0],
      value.tenant?.mainLanguage,
      value.tenant?.main_language,
      value.tenant?.default_language
    ),
    autoReplyEnabled: pickOptionalBoolean(
      policyValue.autoReplyEnabled,
      policyValue.auto_reply_enabled,
      value.autoReplyEnabled,
      value.aiPolicy?.autoReplyEnabled,
      value.aiPolicy?.auto_reply_enabled,
      value.ai_policy?.auto_reply_enabled,
      value.tenant?.ai_policy?.auto_reply_enabled
    ),
    createLeadEnabled: pickOptionalBoolean(
      policyValue.createLeadEnabled,
      policyValue.create_lead_enabled,
      value.createLeadEnabled,
      value.aiPolicy?.createLeadEnabled,
      value.aiPolicy?.create_lead_enabled,
      value.ai_policy?.create_lead_enabled,
      value.tenant?.ai_policy?.create_lead_enabled
    ),
    handoffEnabled: pickOptionalBoolean(
      policyValue.handoffEnabled,
      policyValue.handoff_enabled,
      value.handoffEnabled,
      value.capabilities?.handoffEnabled,
      value.capabilities?.handoff_enabled,
      arr(behavior.handoffTriggers).length > 0 ? true : null
    ),
    qualificationMode: pickFirstString(
      channelBehavior.qualificationDepth,
      value.leadQualificationMode,
      value.lead_qualification_mode,
      behavior.leadQualificationMode,
      behavior.lead_qualification_mode
    ),
    primaryAction: s(channelBehavior.primaryAction),
    handoffBias: s(channelBehavior.handoffBias),
    leadCaptureMode: pickFirstString(
      channelBehavior.ctaMode,
      value.leadQualificationMode,
      behavior.leadQualificationMode
    ),
    tonePolicyPresent: Boolean(
      s(behavior.toneProfile || behavior.tone_profile)
    ),
  });
}

function buildPromptSummary(promptBundle = {}, channel = "", usecase = "") {
  const bundle = obj(promptBundle);
  const layers = arr(bundle.layers)
    .map((layer) => ({
      key: s(layer?.key),
      title: s(layer?.title),
    }))
    .filter((layer) => layer.key);

  return {
    channel: s(bundle.channelKey || channel),
    usecase: s(bundle.usecaseKey || bundle.event || usecase),
    event: s(bundle.event),
    promptRef: obj(bundle.promptRef),
    promptVersion: s(bundle.promptRef?.version),
    promptId: s(bundle.promptRef?.id),
    layerKeys: layers.map((layer) => layer.key),
    layerTitles: layers.map((layer) => layer.title),
    layerCount: layers.length,
  };
}

function normalizeDecisionPathStatus(value = "") {
  const safe = lower(value);
  if (!safe) return "";
  if (
    [
      "answered",
      "escalated_to_operator",
      "refused",
      "fallback_safe_response",
      "insufficient_runtime_context",
      "runtime_unavailable",
      "no_reply",
      "decision_pending",
    ].includes(safe)
  ) {
    return safe;
  }
  if (
    ["reply", "reply_generated", "public_reply", "private_reply"].includes(safe)
  ) {
    return "answered";
  }
  if (["handoff", "handoff_required", "escalated", "operator_handoff"].includes(safe)) {
    return "escalated_to_operator";
  }
  if (["blocked", "claim_blocked"].includes(safe)) return "refused";
  if (["fallback", "safe_reply"].includes(safe)) return "fallback_safe_response";
  if (["runtime_missing", "runtime_invalid"].includes(safe)) {
    return "runtime_unavailable";
  }
  return safe;
}

function deriveDecisionPathStatus({
  runtimeRef = {},
  decisions = {},
  evaluation = {},
} = {}) {
  if (runtimeRef.approvedRuntime !== true) return "runtime_unavailable";

  const claimBlocked =
    decisions?.claimBlock?.blocked === true ||
    evaluation?.claimBlock?.blocked === true ||
    lower(evaluation?.claimBlock?.status) === "blocked";
  const replyOutcome = lower(evaluation?.outcome);
  const handoffRecommended =
    lower(evaluation?.handoff?.status) === "recommended" ||
    replyOutcome === "handoff_recommended" ||
    s(decisions?.handoff?.trigger) ||
    s(decisions?.handoff?.reason);

  if (claimBlocked) {
    if (
      ["reply_recommended", "public_reply_recommended", "private_reply_recommended"].includes(
        replyOutcome
      )
    ) {
      return "fallback_safe_response";
    }
    if (handoffRecommended) return "fallback_safe_response";
    return "refused";
  }
  if (handoffRecommended) return "escalated_to_operator";
  if (
    ["reply_recommended", "public_reply_recommended", "private_reply_recommended", "reply_generated"].includes(
      replyOutcome
    )
  ) {
    return "answered";
  }
  if (replyOutcome === "no_reply_recommended") return "no_reply";
  return "decision_pending";
}

function deriveDecisionPathReasonCode({
  runtimeRef = {},
  decisions = {},
  evaluation = {},
} = {}) {
  if (runtimeRef.approvedRuntime !== true) {
    return s(runtimeRef.reasonCode || "runtime_authority_unavailable");
  }

  const claimBlocked =
    decisions?.claimBlock?.blocked === true ||
    evaluation?.claimBlock?.blocked === true ||
    lower(evaluation?.claimBlock?.status) === "blocked";
  if (claimBlocked) {
    return pickFirstString(
      decisions?.claimBlock?.reason,
      evaluation?.claimBlock?.reason,
      decisions?.claimBlock?.claim,
      evaluation?.claimBlock?.claim,
      "claim_blocked"
    );
  }

  const handoffReason = pickFirstString(
    decisions?.handoff?.reason,
    evaluation?.handoff?.reason,
    decisions?.handoff?.trigger,
    evaluation?.handoff?.trigger
  );
  if (handoffReason) return handoffReason;

  return pickFirstString(evaluation?.outcome, "approved_runtime_behavior");
}

function buildDecisionPath({
  runtimeRef = {},
  decisions = {},
  evaluation = {},
  decisionPath = {},
} = {}) {
  const provided = obj(decisionPath);
  return compactRecord({
    status:
      normalizeDecisionPathStatus(
        provided.status || provided.outcome || provided.path
      ) ||
      deriveDecisionPathStatus({ runtimeRef, decisions, evaluation }),
    reasonCode:
      s(provided.reasonCode || provided.reason_code || provided.reason) ||
      deriveDecisionPathReasonCode({ runtimeRef, decisions, evaluation }),
    detail: s(provided.detail || provided.note),
  });
}

function buildEvaluationSummary({
  decisions = {},
  evaluation = {},
} = {}) {
  const decisionInput = obj(decisions);
  const evaluationInput = obj(evaluation);
  const qualificationQuestionCount = Number(
    evaluationInput?.qualification?.questionCount ??
      decisionInput?.qualification?.questionCount ??
      0
  );
  const claimBlocked =
    bool(evaluationInput?.claimBlock?.blocked) ||
    bool(decisionInput?.claimBlock?.blocked);
  const handoffReason = s(
    evaluationInput?.handoff?.reason || decisionInput?.handoff?.reason
  );
  const handoffTrigger = s(
    evaluationInput?.handoff?.trigger || decisionInput?.handoff?.trigger
  );

  return {
    schema: "agent_evaluation.v1",
    outcome: s(evaluationInput.outcome),
    ctaDirection: s(
      evaluationInput.ctaDirection ||
        (s(decisionInput?.cta?.selected) ? "cta_present" : "")
    ),
    qualification: {
      status: s(
        evaluationInput?.qualification?.status ||
          (qualificationQuestionCount > 0 ? "questioned" : "none")
      ),
      questionCount: qualificationQuestionCount,
    },
    handoff: {
      status: s(
        evaluationInput?.handoff?.status ||
          (handoffReason || handoffTrigger ? "flagged" : "clear")
      ),
      trigger: handoffTrigger,
      reason: handoffReason,
      priority: s(
        evaluationInput?.handoff?.priority || decisionInput?.handoff?.priority
      ),
    },
    claimBlock: {
      status: s(
        evaluationInput?.claimBlock?.status ||
          (claimBlocked ? "blocked" : "clear")
      ),
      blocked: claimBlocked,
      claim: s(
        evaluationInput?.claimBlock?.claim || decisionInput?.claimBlock?.claim
      ),
      reason: s(
        evaluationInput?.claimBlock?.reason || decisionInput?.claimBlock?.reason
      ),
    },
  };
}

export function buildAgentReplayTrace({
  runtime = null,
  behavior = null,
  policy = {},
  promptBundle = null,
  channel = "",
  usecase = "",
  decisions = {},
  evaluation = {},
  decisionPath = {},
} = {}) {
  const runtimeRef = buildRuntimeRef(runtime || {});
  const prompt = buildPromptSummary(promptBundle || {}, channel, usecase);
  const effectiveChannel = s(prompt.channel || channel);
  const effectiveUsecase = s(prompt.usecase || usecase);
  const behaviorChannel = resolveBehaviorChannel(
    effectiveChannel,
    effectiveUsecase
  );
  const behaviorSummary = buildBehaviorSummary(
    behavior || runtime || {},
    behaviorChannel
  );
  const decisionInput = obj(decisions);

  return {
    schema: "agent_replay_trace.v1",
    channel: effectiveChannel,
    usecase: effectiveUsecase,
    runtimeVersion: buildRuntimeVersion(runtimeRef),
    runtimeRef,
    behavior: behaviorSummary,
    policy: buildPolicySummary(
      runtime || {},
      behavior || runtime || {},
      policy,
      behaviorChannel
    ),
    prompt,
    decisions: {
      cta: {
        selected: s(
          decisionInput?.cta?.selected || behaviorSummary.primaryCta
        ),
        reason: s(
          decisionInput?.cta?.reason ||
            (behaviorSummary.primaryCta ? "approved_runtime_behavior" : "")
        ),
      },
      qualification: {
        mode: s(
          decisionInput?.qualification?.mode ||
            behaviorSummary.channelBehavior?.qualificationDepth
        ),
        questionCount:
          Number(decisionInput?.qualification?.questionCount) ||
          behaviorSummary.qualificationQuestionCount,
        reason: s(
          decisionInput?.qualification?.reason ||
            (behaviorSummary.qualificationQuestionCount > 0
              ? "approved_runtime_behavior"
              : "")
        ),
      },
      handoff: {
        trigger: s(decisionInput?.handoff?.trigger),
        reason: s(decisionInput?.handoff?.reason),
        priority: s(decisionInput?.handoff?.priority),
      },
      claimBlock: {
        blocked: decisionInput?.claimBlock?.blocked === true,
        claim: s(decisionInput?.claimBlock?.claim),
        reason: s(decisionInput?.claimBlock?.reason),
      },
    },
    evaluation: buildEvaluationSummary({
      decisions: decisionInput,
      evaluation,
    }),
    decisionPath: buildDecisionPath({
      runtimeRef,
      decisions: decisionInput,
      evaluation,
      decisionPath,
    }),
  };
}
