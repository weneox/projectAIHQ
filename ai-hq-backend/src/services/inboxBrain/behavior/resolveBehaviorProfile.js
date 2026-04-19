import { arr, lower, obj, s, uniqStrings } from "../shared.js";
import {
  GLOBAL_BEHAVIOR_DEFAULT,
  INDUSTRY_BEHAVIOR_DEFAULTS,
  TENANT_BEHAVIOR_PRESETS,
} from "./defaults.js";

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const x = lower(value);
    if (["true", "1", "yes"].includes(x)) return true;
    if (["false", "0", "no"].includes(x)) return false;
  }
  return fallback;
}

function normalizeStringList(...sources) {
  const values = [];
  for (const source of sources) values.push(...arr(source));
  return uniqStrings(values.map((item) => s(item)).filter(Boolean));
}

function normalizeMaxSentences(value, fallback = 2) {
  return Math.max(1, Math.min(4, Number(value || fallback || 2)));
}

function normalizeMaxQuestions(value, fallback = 1) {
  return Math.max(1, Math.min(2, Number(value || fallback || 1)));
}

function deepMergeBehavior(base = {}, override = {}) {
  const a = obj(base);
  const b = obj(override);

  const merged = {
    ...a,
    ...b,
    channelBehavior: {
      ...obj(a.channelBehavior),
      ...obj(b.channelBehavior),
      inbox: {
        ...obj(a.channelBehavior?.inbox),
        ...obj(b.channelBehavior?.inbox),
      },
    },
  };

  const listFields = [
    "leadPrompts",
    "preferredPhrases",
    "forbiddenPhrases",
    "doNotSay",
  ];

  for (const field of listFields) {
    if (arr(b[field]).length) {
      merged[field] = normalizeStringList(b[field]);
    } else if (arr(a[field]).length) {
      merged[field] = normalizeStringList(a[field]);
    } else {
      merged[field] = [];
    }
  }

  return merged;
}

function buildPresetKey({ tenant = {}, profile = {}, meta = {}, runtimeBehavior = {} }) {
  return s(
    runtimeBehavior?.presetKey ||
      runtimeBehavior?.preset_key ||
      profile?.behavior_preset ||
      profile?.behaviorPreset ||
      meta?.behaviorPreset ||
      meta?.behavior_preset ||
      tenant?.behavior_preset ||
      tenant?.behaviorPreset
  ).toLowerCase();
}

function buildCustomBehaviorLayer({
  tenant = {},
  profile = {},
  meta = {},
  runtimeBehavior = {},
  runtimeChannelBehavior = {},
}) {
  const behaviorProfile = obj(
    runtimeBehavior?.behaviorProfile ||
      runtimeBehavior?.behavior_profile ||
      profile?.behavior_profile ||
      profile?.behaviorProfile ||
      meta?.behaviorProfile ||
      meta?.behavior_profile ||
      tenant?.behavior_profile ||
      tenant?.behaviorProfile
  );

  const communicationRules = obj(
    profile?.communication_rules ||
      profile?.communicationRules ||
      meta?.communicationRules ||
      meta?.communication_rules
  );

  const inlineLayer = {
    source: "tenant_custom",
    tone: s(
      runtimeBehavior?.tone ||
        behaviorProfile?.tone ||
        communicationRules?.tone ||
        profile?.tone_of_voice ||
        profile?.tone
    ),
    toneProfile: s(
      runtimeBehavior?.toneProfile ||
        runtimeBehavior?.tone_profile ||
        behaviorProfile?.toneProfile ||
        behaviorProfile?.tone_profile ||
        profile?.tone_profile
    ),
    formality: s(
      runtimeBehavior?.formality ||
        behaviorProfile?.formality
    ),
    warmth: s(
      runtimeBehavior?.warmth ||
        behaviorProfile?.warmth
    ),
    brevity: s(
      runtimeBehavior?.brevity ||
        behaviorProfile?.brevity
    ),
    emojiPolicy: s(
      runtimeBehavior?.emojiPolicy ||
        runtimeBehavior?.emoji_policy ||
        behaviorProfile?.emojiPolicy ||
        behaviorProfile?.emoji_policy
    ),

    answerFirst: normalizeBoolean(
      runtimeBehavior?.answerFirst ??
        runtimeBehavior?.answer_first ??
        behaviorProfile?.answerFirst ??
        behaviorProfile?.answer_first,
      true
    ),

    maxQuestionsPerTurn: normalizeMaxQuestions(
      runtimeBehavior?.maxQuestionsPerTurn ||
        runtimeBehavior?.max_questions_per_turn ||
        behaviorProfile?.maxQuestionsPerTurn ||
        behaviorProfile?.max_questions_per_turn,
      1
    ),

    maxSentences: normalizeMaxSentences(
      runtimeBehavior?.maxSentences ||
        runtimeBehavior?.max_sentences ||
        behaviorProfile?.maxSentences ||
        behaviorProfile?.max_sentences ||
        communicationRules?.maxSentences,
      2
    ),

    greetingEnabled: normalizeBoolean(
      runtimeBehavior?.greetingEnabled ??
        runtimeBehavior?.greeting_enabled ??
        behaviorProfile?.greetingEnabled ??
        behaviorProfile?.greeting_enabled,
      true
    ),

    greetingMode: s(
      runtimeBehavior?.greetingMode ||
        runtimeBehavior?.greeting_mode ||
        behaviorProfile?.greetingMode ||
        behaviorProfile?.greeting_mode
    ),

    introMode: s(
      runtimeBehavior?.introMode ||
        runtimeBehavior?.intro_mode ||
        behaviorProfile?.introMode ||
        behaviorProfile?.intro_mode
    ),

    brandedIntroMode: s(
      runtimeBehavior?.brandedIntroMode ||
        runtimeBehavior?.branded_intro_mode ||
        behaviorProfile?.brandedIntroMode ||
        behaviorProfile?.branded_intro_mode
    ),

    customGreeting: s(
      runtimeBehavior?.customGreeting ||
        runtimeBehavior?.custom_greeting ||
        behaviorProfile?.customGreeting ||
        behaviorProfile?.custom_greeting
    ),

    firstReplyStyle: s(
      runtimeBehavior?.firstReplyStyle ||
        runtimeBehavior?.first_reply_style ||
        behaviorProfile?.firstReplyStyle ||
        behaviorProfile?.first_reply_style
    ),

    followupQuestionStyle: s(
      runtimeBehavior?.followupQuestionStyle ||
        runtimeBehavior?.followup_question_style ||
        behaviorProfile?.followupQuestionStyle ||
        behaviorProfile?.followup_question_style
    ),

    qualificationStyle: s(
      runtimeBehavior?.qualificationStyle ||
        runtimeBehavior?.qualification_style ||
        behaviorProfile?.qualificationStyle ||
        behaviorProfile?.qualification_style
    ),

    salesAggressiveness: s(
      runtimeBehavior?.salesAggressiveness ||
        runtimeBehavior?.sales_aggressiveness ||
        behaviorProfile?.salesAggressiveness ||
        behaviorProfile?.sales_aggressiveness
    ),

    pricingStyle: s(
      runtimeBehavior?.pricingStyle ||
        runtimeBehavior?.pricing_style ||
        behaviorProfile?.pricingStyle ||
        behaviorProfile?.pricing_style
    ),

    unsupportedServiceStyle: s(
      runtimeBehavior?.unsupportedServiceStyle ||
        runtimeBehavior?.unsupported_service_style ||
        behaviorProfile?.unsupportedServiceStyle ||
        behaviorProfile?.unsupported_service_style
    ),

    handoffStyle: s(
      runtimeBehavior?.handoffStyle ||
        runtimeBehavior?.handoff_style ||
        behaviorProfile?.handoffStyle ||
        behaviorProfile?.handoff_style
    ),

    leadPrompts: normalizeStringList(
      runtimeBehavior?.leadPrompts,
      runtimeBehavior?.lead_prompts,
      behaviorProfile?.leadPrompts,
      behaviorProfile?.lead_prompts
    ),

    preferredPhrases: normalizeStringList(
      runtimeBehavior?.preferredPhrases,
      runtimeBehavior?.preferred_phrases,
      behaviorProfile?.preferredPhrases,
      behaviorProfile?.preferred_phrases
    ),

    forbiddenPhrases: normalizeStringList(
      runtimeBehavior?.forbiddenPhrases,
      runtimeBehavior?.forbidden_phrases,
      behaviorProfile?.forbiddenPhrases,
      behaviorProfile?.forbidden_phrases
    ),

    doNotSay: normalizeStringList(
      runtimeBehavior?.doNotSay,
      runtimeBehavior?.do_not_say,
      behaviorProfile?.doNotSay,
      behaviorProfile?.do_not_say
    ),

    channelBehavior: {
      ...obj(behaviorProfile?.channelBehavior || behaviorProfile?.channel_behavior),
      ...obj(runtimeBehavior?.channelBehavior || runtimeBehavior?.channel_behavior),
      inbox: {
        ...obj(
          behaviorProfile?.channelBehavior?.inbox ||
            behaviorProfile?.channel_behavior?.inbox
        ),
        ...obj(
          runtimeBehavior?.channelBehavior?.inbox ||
            runtimeBehavior?.channel_behavior?.inbox
        ),
        ...obj(runtimeChannelBehavior?.inbox || runtimeChannelBehavior),
      },
    },
  };

  return inlineLayer;
}

export function resolveBehaviorProfile({
  industry = "generic_business",
  tenant = {},
  profile = {},
  meta = {},
  runtimeBehavior = {},
  runtimeChannelBehavior = {},
  fallbackBehavior = {},
  fallbackChannelBehavior = {},
}) {
  const normalizedIndustry = s(industry || "generic_business") || "generic_business";

  const presetKey = buildPresetKey({
    tenant,
    profile,
    meta,
    runtimeBehavior,
  });

  const industryLayer = obj(
    INDUSTRY_BEHAVIOR_DEFAULTS[normalizedIndustry] ||
      INDUSTRY_BEHAVIOR_DEFAULTS.generic_business
  );

  const presetLayer = obj(TENANT_BEHAVIOR_PRESETS[presetKey] || {});
  const fallbackLayer = deepMergeBehavior(
    obj(fallbackBehavior),
    {
      channelBehavior: {
        inbox: obj(fallbackChannelBehavior?.inbox || fallbackChannelBehavior),
      },
    }
  );

  const customLayer = buildCustomBehaviorLayer({
    tenant,
    profile,
    meta,
    runtimeBehavior,
    runtimeChannelBehavior,
  });

  let resolved = deepMergeBehavior(GLOBAL_BEHAVIOR_DEFAULT, industryLayer);
  resolved = deepMergeBehavior(resolved, presetLayer);
  resolved = deepMergeBehavior(resolved, fallbackLayer);
  resolved = deepMergeBehavior(resolved, customLayer);

  resolved = {
    ...resolved,
    source:
      customLayer?.customGreeting ||
      customLayer?.tone ||
      customLayer?.pricingStyle ||
      customLayer?.handoffStyle
        ? "tenant_custom"
        : presetLayer?.presetKey
          ? "tenant_preset"
          : industryLayer?.presetKey
            ? "platform_industry_default"
            : "platform_global_default",
    presetKey: s(presetLayer?.presetKey || industryLayer?.presetKey || GLOBAL_BEHAVIOR_DEFAULT.presetKey),
    channelBehavior: {
      ...obj(resolved.channelBehavior),
      inbox: {
        ...obj(resolved.channelBehavior?.inbox),
        answerFirst: normalizeBoolean(
          resolved.channelBehavior?.inbox?.answerFirst,
          normalizeBoolean(resolved.answerFirst, true)
        ),
        maxQuestionsPerTurn: normalizeMaxQuestions(
          resolved.channelBehavior?.inbox?.maxQuestionsPerTurn,
          normalizeMaxQuestions(resolved.maxQuestionsPerTurn, 1)
        ),
      },
    },
    greetingEnabled: normalizeBoolean(resolved.greetingEnabled, true),
    answerFirst: normalizeBoolean(resolved.answerFirst, true),
    maxQuestionsPerTurn: normalizeMaxQuestions(resolved.maxQuestionsPerTurn, 1),
    maxSentences: normalizeMaxSentences(resolved.maxSentences, 2),
    leadPrompts: normalizeStringList(resolved.leadPrompts),
    preferredPhrases: normalizeStringList(resolved.preferredPhrases),
    forbiddenPhrases: normalizeStringList(resolved.forbiddenPhrases),
    doNotSay: normalizeStringList(resolved.doNotSay),
  };

  return resolved;
}