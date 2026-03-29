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

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeChannelBehavior(value = {}) {
  const channels = obj(value);
  const out = {};

  for (const [key, channelValue] of Object.entries(channels)) {
    const normalized = compactObject({
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

    if (Object.keys(normalized).length) {
      out[key] = normalized;
    }
  }

  return out;
}

function looksLikeBehavior(value = {}) {
  const item = obj(value);
  return !!(
    s(item.businessType || item.business_type) ||
    s(item.niche) ||
    s(item.subNiche || item.sub_niche) ||
    s(item.conversionGoal || item.conversion_goal) ||
    s(item.primaryCta || item.primary_cta) ||
    s(item.leadQualificationMode || item.lead_qualification_mode) ||
    arr(item.qualificationQuestions || item.qualification_questions).length ||
    s(item.bookingFlowType || item.booking_flow_type) ||
    arr(item.handoffTriggers || item.handoff_triggers).length ||
    arr(item.disallowedClaims || item.disallowed_claims).length ||
    s(item.toneProfile || item.tone_profile) ||
    Object.keys(obj(item.channelBehavior || item.channel_behavior)).length
  );
}

export function extractTruthBehavior(value = {}) {
  const root = obj(value);
  const profileJson = obj(root.profileJson || root.profile_json);
  const metadataJson = obj(root.metadataJson || root.metadata_json);
  const profile = obj(root.profile);
  const candidates = [
    root,
    root.nicheBehavior,
    root.niche_behavior,
    root.behavior,
    root.behavior_json,
    profile.nicheBehavior,
    profile.niche_behavior,
    profile.behavior,
    profileJson.nicheBehavior,
    profileJson.niche_behavior,
    metadataJson.nicheBehavior,
    metadataJson.niche_behavior,
  ];

  const first = candidates.find((item) => looksLikeBehavior(item)) || {};

  return compactObject({
    businessType: s(first.businessType || first.business_type),
    niche: s(first.niche),
    subNiche: s(first.subNiche || first.sub_niche),
    conversionGoal: s(first.conversionGoal || first.conversion_goal),
    primaryCta: s(first.primaryCta || first.primary_cta),
    leadQualificationMode: s(
      first.leadQualificationMode || first.lead_qualification_mode
    ),
    qualificationQuestions: uniqueStrings(
      first.qualificationQuestions || first.qualification_questions
    ),
    bookingFlowType: s(first.bookingFlowType || first.booking_flow_type),
    handoffTriggers: uniqueStrings(first.handoffTriggers || first.handoff_triggers),
    disallowedClaims: uniqueStrings(
      first.disallowedClaims || first.disallowed_claims
    ),
    toneProfile: s(first.toneProfile || first.tone_profile),
    channelBehavior: normalizeChannelBehavior(
      first.channelBehavior || first.channel_behavior
    ),
  });
}

function summarizeChannel(channelKey = "", value = {}) {
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

  if (!parts.length) return "";
  return `${titleize(channelKey)}: ${parts.join(" · ")}`;
}

function formatList(value = []) {
  return uniqueStrings(value)
    .map((item) => titleize(item))
    .join(", ");
}

export function getTruthBehaviorRows(behavior = {}) {
  const x = extractTruthBehavior(behavior);
  const rows = [
    ["businessType", "Business type", titleize(x.businessType)],
    ["niche", "Niche", titleize(x.niche)],
    ["subNiche", "Sub-niche", titleize(x.subNiche)],
    ["conversionGoal", "Conversion goal", titleize(x.conversionGoal)],
    ["primaryCta", "Primary CTA", s(x.primaryCta)],
    [
      "leadQualificationMode",
      "Lead qualification mode",
      titleize(x.leadQualificationMode),
    ],
    [
      "qualificationQuestions",
      "Qualification questions",
      arr(x.qualificationQuestions).join(" · "),
    ],
    ["bookingFlowType", "Booking flow", titleize(x.bookingFlowType)],
    ["handoffTriggers", "Handoff triggers", formatList(x.handoffTriggers)],
    ["disallowedClaims", "Disallowed claims", formatList(x.disallowedClaims)],
    ["toneProfile", "Tone profile", titleize(x.toneProfile)],
    [
      "channelBehavior",
      "Channel behavior",
      Object.entries(obj(x.channelBehavior))
        .map(([key, value]) => summarizeChannel(key, value))
        .filter(Boolean)
        .join(" | "),
    ],
  ]
    .map(([key, label, value]) => ({ key, label, value: s(value) }))
    .filter((item) => item.value);

  return rows;
}

export function getTruthBehaviorSummary(behavior = {}) {
  const rows = getTruthBehaviorRows(behavior);
  return rows.slice(0, 4).map((item) => item.value).filter(Boolean).join(" · ");
}

function normalizeValueForCompare(key = "", behavior = {}) {
  const x = extractTruthBehavior(behavior);

  if (key === "qualificationQuestions") return arr(x.qualificationQuestions).join(" · ");
  if (key === "handoffTriggers") return formatList(x.handoffTriggers);
  if (key === "disallowedClaims") return formatList(x.disallowedClaims);
  if (key === "channelBehavior") {
    return Object.entries(obj(x.channelBehavior))
      .map(([channelKey, value]) => summarizeChannel(channelKey, value))
      .filter(Boolean)
      .join(" | ");
  }

  return getTruthBehaviorRows(x).find((item) => item.key === key)?.value || "";
}

export function getTruthBehaviorChanges(before = {}, after = {}) {
  const labels = new Map(
    getTruthBehaviorRows({
      ...extractTruthBehavior(before),
      ...extractTruthBehavior(after),
    }).map((item) => [item.key, item.label])
  );

  return [
    "businessType",
    "niche",
    "subNiche",
    "conversionGoal",
    "primaryCta",
    "leadQualificationMode",
    "qualificationQuestions",
    "bookingFlowType",
    "handoffTriggers",
    "disallowedClaims",
    "toneProfile",
    "channelBehavior",
  ]
    .map((key) => {
      const beforeValue = normalizeValueForCompare(key, before);
      const afterValue = normalizeValueForCompare(key, after);

      if (beforeValue === afterValue || (!beforeValue && !afterValue)) return null;

      return {
        key: `behavior.${key}`,
        label: labels.get(key) || titleize(key),
        beforeSummary: beforeValue || "Not set",
        afterSummary: afterValue || "Not set",
        summary: `${labels.get(key) || titleize(key)} changed.`,
      };
    })
    .filter(Boolean);
}

export function isTruthBehaviorFieldKey(value = "") {
  const key = s(value).toLowerCase();
  return (
    key.includes("nichebehavior") ||
    key.includes("behavior.") ||
    key.includes("behavior_") ||
    [
      "businesstype",
      "niche",
      "subniche",
      "conversiongoal",
      "primarycta",
      "leadqualificationmode",
      "qualificationquestions",
      "bookingflowtype",
      "handofftriggers",
      "disallowedclaims",
      "toneprofile",
      "channelbehavior",
    ].some((token) => key.includes(token))
  );
}

export function formatTruthBehaviorFieldLabel(value = "") {
  const key = s(value).split(".").pop();
  switch (key.toLowerCase()) {
    case "businesstype":
      return "Business type";
    case "niche":
      return "Niche";
    case "subniche":
      return "Sub-niche";
    case "conversiongoal":
      return "Conversion goal";
    case "primarycta":
      return "Primary CTA";
    case "leadqualificationmode":
      return "Lead qualification mode";
    case "qualificationquestions":
      return "Qualification questions";
    case "bookingflowtype":
      return "Booking flow";
    case "handofftriggers":
      return "Handoff triggers";
    case "disallowedclaims":
      return "Disallowed claims";
    case "toneprofile":
      return "Tone profile";
    case "channelbehavior":
      return "Channel behavior";
    default:
      return titleize(key);
  }
}
