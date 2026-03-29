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
    source: s(authority.source),
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
        value.projection_hash
    ),
    stale: authority.stale === true,
    reasonCode: s(authority.reasonCode),
  };
}

function buildRuntimeVersion(runtimeRef = {}) {
  const projectionId = s(runtimeRef.runtimeProjectionId);
  const projectionHash = s(runtimeRef.projectionHash);
  if (projectionId && projectionHash) return `${projectionId}:${projectionHash}`;
  return projectionId || projectionHash || "";
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
  promptBundle = null,
  channel = "",
  usecase = "",
  decisions = {},
  evaluation = {},
} = {}) {
  const runtimeRef = buildRuntimeRef(runtime || {});
  const prompt = buildPromptSummary(promptBundle || {}, channel, usecase);
  const effectiveChannel = s(prompt.channel || channel);
  const effectiveUsecase = s(prompt.usecase || usecase);
  const behaviorSummary = buildBehaviorSummary(
    behavior || runtime || {},
    effectiveChannel
  );
  const decisionInput = obj(decisions);

  return {
    schema: "agent_replay_trace.v1",
    channel: effectiveChannel,
    usecase: effectiveUsecase,
    runtimeVersion: buildRuntimeVersion(runtimeRef),
    runtimeRef,
    behavior: behaviorSummary,
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
  };
}
