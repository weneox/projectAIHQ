function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function uniqueStrings(value = []) {
  return [...new Set(arr(value).map((item) => s(item)).filter(Boolean))];
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(obj(value)).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      if (item && typeof item === "object") return Object.keys(item).length > 0;
      return s(item).length > 0;
    })
  );
}

function findBehaviorContainer(value = {}) {
  const root = obj(value);
  const nested = obj(
    root.nicheBehavior ||
      root.niche_behavior ||
      root.behavior ||
      root.behaviorProfile ||
      root.behavior_profile
  );

  if (Object.keys(nested).length) {
    return {
      ...nested,
      ...(s(root.businessType) ? { businessType: root.businessType } : {}),
      ...(s(root.niche) ? { niche: root.niche } : {}),
      ...(s(root.subNiche) ? { subNiche: root.subNiche } : {}),
      ...(s(root.conversionGoal) ? { conversionGoal: root.conversionGoal } : {}),
      ...(s(root.primaryCta) ? { primaryCta: root.primaryCta } : {}),
      ...(s(root.leadQualificationMode)
        ? { leadQualificationMode: root.leadQualificationMode }
        : {}),
      ...(arr(root.qualificationQuestions).length
        ? { qualificationQuestions: root.qualificationQuestions }
        : {}),
      ...(s(root.bookingFlowType) ? { bookingFlowType: root.bookingFlowType } : {}),
      ...(arr(root.handoffTriggers).length
        ? { handoffTriggers: root.handoffTriggers }
        : {}),
      ...(arr(root.disallowedClaims).length
        ? { disallowedClaims: root.disallowedClaims }
        : {}),
      ...(s(root.toneProfile) ? { toneProfile: root.toneProfile } : {}),
      ...(Object.keys(obj(root.channelBehavior)).length
        ? { channelBehavior: root.channelBehavior }
        : {}),
    };
  }

  return root;
}

function normalizeChannelBehavior(value = {}) {
  const channels = obj(value);
  const out = {};

  for (const [channelKey, channelValue] of Object.entries(channels)) {
    const normalizedChannel = compactObject({
      ...obj(channelValue),
      primaryAction: s(channelValue?.primaryAction || channelValue?.primary_action),
      qualificationDepth: s(
        channelValue?.qualificationDepth || channelValue?.qualification_depth
      ),
      handoffBias: s(channelValue?.handoffBias || channelValue?.handoff_bias),
      ctaMode: s(channelValue?.ctaMode || channelValue?.cta_mode),
      contentAngle: s(channelValue?.contentAngle || channelValue?.content_angle),
      visualDirection: s(
        channelValue?.visualDirection || channelValue?.visual_direction
      ),
      reviewBias: s(channelValue?.reviewBias || channelValue?.review_bias),
    });

    if (Object.keys(normalizedChannel).length) {
      out[channelKey] = normalizedChannel;
    }
  }

  return out;
}

export const DEFAULT_BEHAVIOR_PROFILE = {
  businessType: "",
  niche: "",
  subNiche: "",
  conversionGoal: "",
  primaryCta: "",
  leadQualificationMode: "",
  qualificationQuestions: [],
  bookingFlowType: "",
  handoffTriggers: [],
  disallowedClaims: [],
  toneProfile: "",
  channelBehavior: {},
};

export function normalizeBehaviorProfile(value = {}, fallback = {}) {
  const raw = findBehaviorContainer(value);
  const existing = obj(fallback);

  return compactObject({
    ...obj(existing),
    businessType: s(raw.businessType || raw.business_type || existing.businessType),
    niche: s(raw.niche || existing.niche),
    subNiche: s(raw.subNiche || raw.sub_niche || existing.subNiche),
    conversionGoal: s(
      raw.conversionGoal || raw.conversion_goal || existing.conversionGoal
    ),
    primaryCta: s(raw.primaryCta || raw.primary_cta || existing.primaryCta),
    leadQualificationMode: s(
      raw.leadQualificationMode ||
        raw.lead_qualification_mode ||
        existing.leadQualificationMode
    ),
    qualificationQuestions: uniqueStrings(
      arr(
        raw.qualificationQuestions ||
          raw.qualification_questions ||
          existing.qualificationQuestions
      )
    ),
    bookingFlowType: s(
      raw.bookingFlowType || raw.booking_flow_type || existing.bookingFlowType
    ),
    handoffTriggers: uniqueStrings(
      arr(raw.handoffTriggers || raw.handoff_triggers || existing.handoffTriggers)
    ),
    disallowedClaims: uniqueStrings(
      arr(raw.disallowedClaims || raw.disallowed_claims || existing.disallowedClaims)
    ),
    toneProfile: s(raw.toneProfile || raw.tone_profile || existing.toneProfile),
    channelBehavior: normalizeChannelBehavior(
      raw.channelBehavior || raw.channel_behavior || existing.channelBehavior
    ),
  });
}

export function extractBehaviorProfile(value = {}, fallback = {}) {
  return normalizeBehaviorProfile(value, fallback);
}

export function formatBehaviorList(value = []) {
  return uniqueStrings(value).join(", ");
}

export function channelBehaviorSummary(channelKey = "", value = {}) {
  const channel = obj(value);
  const parts = [
    s(channel.primaryAction),
    s(channel.qualificationDepth),
    s(channel.handoffBias),
    s(channel.ctaMode),
    s(channel.contentAngle),
    s(channel.visualDirection),
    s(channel.reviewBias),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : `No ${s(channelKey)} behavior tuned yet.`;
}
