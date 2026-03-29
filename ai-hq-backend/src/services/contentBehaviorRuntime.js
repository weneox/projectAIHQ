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

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function pickFirst(...values) {
  for (const value of values) {
    const normalized = s(value);
    if (normalized) return normalized;
  }
  return "";
}

function looksLikeBehaviorProfile(input = {}) {
  const value = obj(input);
  return Boolean(
    value.niche ||
      value.conversionGoal ||
      value.primaryCta ||
      value.toneProfile ||
      value.reviewBias ||
      value.contentBehavior ||
      value.mediaBehavior
  );
}

function buildReviewBias(runtime = {}, contentBehavior = {}, mediaBehavior = {}) {
  const value = obj(runtime);
  const executionPolicy = obj(value.executionPolicy);
  const posture = obj(executionPolicy.posture);
  const approvalPolicy = obj(executionPolicy.approvalPolicy);
  const affectedSurfaces = uniqStrings([
    ...arr(posture.affectedSurfaces),
    ...arr(approvalPolicy.affectedSurfaces),
  ]);
  const strictestOutcome = lower(
    posture.truthApprovalOutcome ||
      approvalPolicy.strictestOutcome ||
      approvalPolicy.outcome
  );
  const riskLevel = lower(posture.truthRiskLevel || obj(approvalPolicy.risk).level);
  const explicitBias = lower(
    contentBehavior.reviewBias || mediaBehavior.reviewBias
  );

  if (explicitBias) return explicitBias;
  if (
    affectedSurfaces.includes("content") ||
    affectedSurfaces.includes("media") ||
    affectedSurfaces.includes("automation_executions") ||
    strictestOutcome.includes("review") ||
    strictestOutcome.includes("blocked") ||
    riskLevel === "high"
  ) {
    return "human_review_required";
  }

  return "standard_review";
}

export function buildContentBehaviorProfile(input = {}) {
  const provided = obj(input);
  if (looksLikeBehaviorProfile(provided)) {
    const contentBehavior = obj(provided.contentBehavior);
    const mediaBehavior = obj(provided.mediaBehavior);
    return {
      niche: pickFirst(provided.niche, provided.businessType, "generic_business"),
      conversionGoal: pickFirst(provided.conversionGoal, "inform_and_convert"),
      primaryCta: pickFirst(provided.primaryCta, "contact us"),
      toneProfile: pickFirst(provided.toneProfile, "professional"),
      disallowedClaims: uniqStrings(provided.disallowedClaims),
      handoffTriggers: uniqStrings(provided.handoffTriggers),
      channelBehavior: {
        content: contentBehavior,
        media: mediaBehavior,
      },
      contentBehavior,
      mediaBehavior,
      contentAngle: pickFirst(
        contentBehavior.contentAngle,
        contentBehavior.primaryAction,
        provided.conversionGoal,
        "general_conversion"
      ),
      ctaMode: pickFirst(
        contentBehavior.ctaMode,
        mediaBehavior.ctaMode,
        "direct"
      ),
      mediaDirection: pickFirst(
        mediaBehavior.visualDirection,
        mediaBehavior.primaryAction,
        "brand_aligned"
      ),
      reviewBias: pickFirst(provided.reviewBias, "standard_review"),
    };
  }

  const runtime = obj(input);
  const behavior = obj(runtime.behavior);
  const channelBehavior = obj(behavior.channelBehavior);
  const contentBehavior = obj(channelBehavior.content);
  const mediaBehavior = obj(channelBehavior.media);

  return {
    niche: pickFirst(
      behavior.niche,
      behavior.businessType,
      runtime.industryKey,
      "generic_business"
    ),
    conversionGoal: pickFirst(behavior.conversionGoal, "inform_and_convert"),
    primaryCta: pickFirst(behavior.primaryCta, "contact us"),
    toneProfile: pickFirst(behavior.toneProfile, "professional"),
    disallowedClaims: uniqStrings(behavior.disallowedClaims),
    handoffTriggers: uniqStrings(behavior.handoffTriggers),
    channelBehavior: {
      content: contentBehavior,
      media: mediaBehavior,
    },
    contentBehavior,
    mediaBehavior,
    contentAngle: pickFirst(
      contentBehavior.contentAngle,
      contentBehavior.primaryAction,
      behavior.conversionGoal,
      "general_conversion"
    ),
    ctaMode: pickFirst(contentBehavior.ctaMode, mediaBehavior.ctaMode, "direct"),
    mediaDirection: pickFirst(
      mediaBehavior.visualDirection,
      mediaBehavior.primaryAction,
      "brand_aligned"
    ),
    reviewBias: buildReviewBias(runtime, contentBehavior, mediaBehavior),
  };
}
