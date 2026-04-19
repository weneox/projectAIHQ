export const GLOBAL_BEHAVIOR_DEFAULT = {
  presetKey: "platform_global_default",
  source: "platform_global_default",

  tone: "professional, warm, concise",
  toneProfile: "professional",
  formality: "balanced",
  warmth: "balanced",
  brevity: "concise",
  emojiPolicy: "none",

  answerFirst: true,
  maxQuestionsPerTurn: 1,
  maxSentences: 2,

  greetingEnabled: true,
  greetingMode: "neutral",
  introMode: "adaptive",
  brandedIntroMode: "auto",
  customGreeting: "",

  firstReplyStyle: "answer_first",
  followupQuestionStyle: "single_precise_question",
  qualificationStyle: "progressive",
  salesAggressiveness: "low",

  pricingStyle: "depends_scope",
  unsupportedServiceStyle: "honest_redirect",
  handoffStyle: "polite_operator_handoff",

  leadPrompts: [],
  preferredPhrases: [],
  forbiddenPhrases: [],
  doNotSay: [],

  channelBehavior: {
    inbox: {
      qualificationDepth: "guided",
      introOnFirstTurnOnly: true,
      suppressRepeatedIntro: true,
      preferShortReplies: true,
      answerFirst: true,
      maxQuestionsPerTurn: 1,
    },
  },
};

export const INDUSTRY_BEHAVIOR_DEFAULTS = {
  generic_business: {
    presetKey: "industry_generic_business",
    source: "platform_industry_default",
    toneProfile: "professional",
    qualificationStyle: "progressive",
    pricingStyle: "depends_scope",
  },

  technology: {
    presetKey: "industry_technology",
    source: "platform_industry_default",
    tone: "clear, professional, consultative",
    toneProfile: "consultative",
    formality: "balanced",
    warmth: "balanced",
    pricingStyle: "scope_and_features",
    qualificationStyle: "solution_discovery",
  },

  creative_agency: {
    presetKey: "industry_creative_agency",
    source: "platform_industry_default",
    tone: "confident, premium, consultative",
    toneProfile: "premium_consultative",
    formality: "balanced",
    warmth: "warm",
    pricingStyle: "scope_and_quality",
    qualificationStyle: "creative_brief",
  },

  clinic: {
    presetKey: "industry_clinic",
    source: "platform_industry_default",
    tone: "calm, reassuring, professional",
    toneProfile: "reassuring",
    formality: "formal",
    warmth: "warm",
    pricingStyle: "service_and_case",
    qualificationStyle: "careful_guided",
    handoffStyle: "careful_operator_handoff",
  },

  hospitality: {
    presetKey: "industry_hospitality",
    source: "platform_industry_default",
    tone: "polished, welcoming, concise",
    toneProfile: "polished_warm",
    formality: "balanced",
    warmth: "warm",
    pricingStyle: "dates_and_package",
    qualificationStyle: "reservation_focused",
  },

  restaurant: {
    presetKey: "industry_restaurant",
    source: "platform_industry_default",
    tone: "fast, warm, helpful",
    toneProfile: "fast_warm",
    formality: "casual_professional",
    warmth: "warm",
    brevity: "very_concise",
    pricingStyle: "menu_and_order",
    qualificationStyle: "fast_capture",
    channelBehavior: {
      inbox: {
        qualificationDepth: "light",
        introOnFirstTurnOnly: true,
        suppressRepeatedIntro: true,
        preferShortReplies: true,
        answerFirst: true,
        maxQuestionsPerTurn: 1,
      },
    },
  },

  legal: {
    presetKey: "industry_legal",
    source: "platform_industry_default",
    tone: "formal, careful, professional",
    toneProfile: "careful_formal",
    formality: "formal",
    warmth: "balanced",
    pricingStyle: "matter_scope",
    qualificationStyle: "matter_discovery",
    handoffStyle: "formal_operator_handoff",
  },

  finance: {
    presetKey: "industry_finance",
    source: "platform_industry_default",
    tone: "professional, precise, careful",
    toneProfile: "precise_professional",
    formality: "formal",
    warmth: "balanced",
    pricingStyle: "product_and_case",
    qualificationStyle: "fact_driven",
  },
};

export const TENANT_BEHAVIOR_PRESETS = {
  premium: {
    presetKey: "tenant_preset_premium",
    source: "tenant_preset",
    tone: "premium, calm, professional",
    toneProfile: "premium_consultative",
    formality: "balanced",
    warmth: "balanced",
    brevity: "concise",
    greetingMode: "formal",
    introMode: "adaptive",
    firstReplyStyle: "answer_first",
  },

  warm: {
    presetKey: "tenant_preset_warm",
    source: "tenant_preset",
    tone: "warm, welcoming, professional",
    toneProfile: "warm",
    warmth: "warm",
    greetingMode: "warm",
    introMode: "adaptive",
  },

  consultative: {
    presetKey: "tenant_preset_consultative",
    source: "tenant_preset",
    tone: "consultative, clear, professional",
    toneProfile: "consultative",
    firstReplyStyle: "answer_first",
    qualificationStyle: "solution_discovery",
    pricingStyle: "depends_scope",
  },

  fast: {
    presetKey: "tenant_preset_fast",
    source: "tenant_preset",
    tone: "direct, fast, clear",
    toneProfile: "direct",
    brevity: "very_concise",
    greetingMode: "neutral",
    introMode: "minimal",
    qualificationStyle: "fast_capture",
    channelBehavior: {
      inbox: {
        qualificationDepth: "light",
        introOnFirstTurnOnly: true,
        suppressRepeatedIntro: true,
        preferShortReplies: true,
        answerFirst: true,
        maxQuestionsPerTurn: 1,
      },
    },
  },

  formal: {
    presetKey: "tenant_preset_formal",
    source: "tenant_preset",
    tone: "formal, clear, professional",
    toneProfile: "formal",
    formality: "formal",
    warmth: "balanced",
    greetingMode: "formal",
  },
};