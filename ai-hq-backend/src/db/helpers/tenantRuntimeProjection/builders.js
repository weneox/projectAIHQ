import {
  s,
  arr,
  num,
  compactText,
  uniqueBy,
} from "./shared.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function clamp01(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0;
  return Math.max(0, Math.min(1, normalized));
}

function hasMeaningfulProfileData(profile = {}) {
  const value = obj(profile);

  return Boolean(
    s(
      value.companyName ||
        value.company_name ||
        value.displayName ||
        value.display_name ||
        value.summaryShort ||
        value.summary_short ||
        value.summaryLong ||
        value.summary_long ||
        value.valueProposition ||
        value.value_proposition ||
        value.websiteUrl ||
        value.website_url ||
        value.industryKey ||
        value.industry_key
    )
  );
}

function hasCapabilitySignals(capabilities = {}) {
  const value = obj(capabilities);

  if (Object.keys(value).length === 0) return false;

  const textSignals = [
    value.replyStyle,
    value.reply_style,
    value.replyLength,
    value.reply_length,
    value.ctaStyle,
    value.cta_style,
    value.primaryLanguage,
    value.primary_language,
    value.bookingMode,
    value.booking_mode,
    value.pricingMode,
    value.pricing_mode,
  ].some((item) => !!s(item));

  const booleanSignals = [
    value.supportsInstagramDm,
    value.supports_instagram_dm,
    value.supportsFacebookMessenger,
    value.supports_facebook_messenger,
    value.supportsWhatsapp,
    value.supports_whatsapp,
    value.supportsComments,
    value.supports_comments,
    value.supportsVoice,
    value.supports_voice,
    value.canCaptureLeads,
    value.can_capture_leads,
    value.canOfferConsultation,
    value.can_offer_consultation,
    value.canOfferBooking,
    value.can_offer_booking,
    value.handoffEnabled,
    value.handoff_enabled,
  ].some((item) => typeof item === "boolean");

  return textSignals || booleanSignals || Object.keys(value).length > 2;
}

export function buildReadiness({
  profile,
  contacts,
  locations,
  services,
  products,
  faq,
  policies,
  channels,
  knowledge,
  facts,
}) {
  let score = 0;

  if (s(profile?.companyName || profile?.company_name)) score += 0.18;
  if (s(profile?.summaryShort || profile?.summary_short) || s(profile?.summaryLong || profile?.summary_long)) score += 0.16;
  if (arr(services).length > 0) score += 0.18;
  if (arr(contacts).length > 0) score += 0.12;
  if (arr(channels).length > 0) score += 0.10;
  if (arr(faq).length > 0) score += 0.08;
  if (arr(policies).length > 0) score += 0.08;
  if (arr(locations).length > 0) score += 0.04;
  if (arr(products).length > 0) score += 0.03;
  if (arr(knowledge).length > 0) score += 0.02;
  if (arr(facts).length > 0) score += 0.01;

  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  let label = "not_ready";
  if (normalized >= 0.85) label = "strong";
  else if (normalized >= 0.65) label = "ready";
  else if (normalized >= 0.35) label = "partial";

  return { score: normalized, label };
}

export function buildConfidence({
  synthesis,
  profile,
  capabilities,
  services,
  contacts,
  faq,
  policies,
}) {
  const synthesisConfidence = clamp01(num(synthesis?.confidence, 0));
  const profileConfidence = clamp01(num(profile?.confidence, 0));

  const profilePresent = hasMeaningfulProfileData(profile);
  const capabilitiesPresent = hasCapabilitySignals(capabilities);
  const servicesPresent = arr(services).length > 0;
  const contactsPresent = arr(contacts).length > 0;
  const faqPresent = arr(faq).length > 0;
  const policiesPresent = arr(policies).length > 0;

  const structuredCoverage = clamp01(
    (profilePresent ? 0.24 : 0) +
      (capabilitiesPresent ? 0.14 : 0) +
      (servicesPresent ? 0.20 : 0) +
      (contactsPresent ? 0.14 : 0) +
      (faqPresent ? 0.14 : 0) +
      (policiesPresent ? 0.14 : 0)
  );

  let evidenceScore = 0;

  if (synthesisConfidence > 0 || profileConfidence > 0) {
    evidenceScore = clamp01(
      synthesisConfidence * 0.55 + profileConfidence * 0.45
    );
  } else if (profilePresent && capabilitiesPresent) {
    evidenceScore = 0.58;
  } else if (profilePresent) {
    evidenceScore = 0.42;
  }

  const value = clamp01(
    Number((structuredCoverage * 0.55 + evidenceScore * 0.45).toFixed(4))
  );

  let label = "low";
  if (value >= 0.85) label = "very_high";
  else if (value >= 0.65) label = "high";
  else if (value >= 0.35) label = "medium";

  return { score: value, label };
}

export function buildRetrievalCorpus({
  profile,
  services,
  products,
  faq,
  policies,
  knowledge,
  facts,
}) {
  const out = [];

  if (s(profile.summaryShort || profile.summaryLong)) {
    out.push({
      type: "profile_summary",
      key: "profile:summary",
      text: compactText(
        [profile.summaryShort, profile.summaryLong, profile.valueProposition]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(services)) {
    out.push({
      type: "service",
      key: item.serviceKey,
      text: compactText(
        [item.title, item.description, arr(item.highlights).join(" ")]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(products)) {
    out.push({
      type: "product",
      key: item.productKey,
      text: compactText(
        [item.title, item.description, arr(item.highlights).join(" ")]
          .filter(Boolean)
          .join(" ")
      ),
    });
  }

  for (const item of arr(faq)) {
    out.push({
      type: "faq",
      key: item.faqKey,
      text: compactText(`${item.question} ${item.answer}`),
    });
  }

  for (const item of arr(policies)) {
    out.push({
      type: "policy",
      key: item.policyKey,
      text: compactText(
        [item.title, item.summaryText, item.policyText].filter(Boolean).join(" ")
      ),
    });
  }

  for (const item of arr(knowledge)) {
    out.push({
      type: "knowledge",
      key: item.canonicalKey || item.itemKey,
      text: compactText(
        [item.title, item.valueText, item.normalizedText].filter(Boolean).join(" ")
      ),
    });
  }

  for (const item of arr(facts)) {
    out.push({
      type: "fact",
      key: item.factKey,
      text: compactText([item.title, item.valueText].filter(Boolean).join(" ")),
    });
  }

  return uniqueBy(
    out.filter((x) => s(x.text)),
    (x) => `${x.type}:${x.key}`
  );
}

export function buildRuntimeContextText({
  identity,
  profile,
  contacts,
  locations,
  services,
  products,
  faq,
  policies,
  knowledge,
  facts,
}) {
  const parts = [
    identity.displayName || identity.companyName,
    profile.summaryShort,
    profile.summaryLong,
    profile.valueProposition,
    profile.targetAudience,
    ...services.map((x) =>
      [x.title, x.description, arr(x.highlights).join(" ")].filter(Boolean).join(" — ")
    ),
    ...products.map((x) => [x.title, x.description].filter(Boolean).join(" — ")),
    ...faq.map((x) => `${x.question} ${x.answer}`),
    ...policies.map((x) =>
      [x.title, x.summaryText, x.policyText].filter(Boolean).join(" — ")
    ),
    ...contacts.map((x) => `${x.channel} ${x.label} ${x.value}`),
    ...locations.map((x) => `${x.title} ${x.city} ${x.addressLine}`),
    ...knowledge.map((x) =>
      [x.title, x.valueText, x.normalizedText].filter(Boolean).join(" — ")
    ),
    ...facts.map((x) => [x.title, x.valueText].filter(Boolean).join(" — ")),
  ];

  return compactText(parts.filter(Boolean).join("\n"), 24000);
}

export function buildInboxJson(capabilities, services, contacts, channelPolicies) {
  const dmPolicy =
    arr(channelPolicies).find((x) =>
      ["instagram", "messenger", "whatsapp"].includes(x.channel)
    ) || null;

  return {
    enabled:
      capabilities.supportsInstagramDm ||
      capabilities.supportsFacebookMessenger ||
      capabilities.supportsWhatsapp,
    replyStyle: capabilities.replyStyle,
    replyLength: capabilities.replyLength,
    pricingMode: capabilities.pricingMode,
    canCaptureLeads: capabilities.canCaptureLeads,
    handoffEnabled: capabilities.handoffEnabled,
    contactCaptureMode: dmPolicy?.contactCaptureMode || "inherit",
    escalationMode: dmPolicy?.escalationMode || "inherit",
    serviceCount: arr(services).length,
    contactCount: arr(contacts).length,
  };
}

export function buildCommentsJson(capabilities, faq, channelPolicies) {
  const commentsPolicy = arr(channelPolicies).find((x) => x.channel === "comments") || null;

  return {
    enabled: capabilities.supportsComments,
    aiReplyEnabled: commentsPolicy?.aiReplyEnabled ?? true,
    publicReplyMode: commentsPolicy?.publicReplyMode || "inherit",
    replyStyle: commentsPolicy?.replyStyle || capabilities.replyStyle,
    maxReplySentences: commentsPolicy?.maxReplySentences ?? 2,
    faqCount: arr(faq).length,
  };
}

export function buildContentJson(profile, capabilities, services, products, socialAccounts) {
  return {
    enabled: true,
    toneProfile: profile.toneProfile,
    replyStyle: capabilities.replyStyle,
    ctaStyle: capabilities.ctaStyle,
    targetAudience: profile.targetAudience,
    valueProposition: profile.valueProposition,
    serviceCount: arr(services).length,
    productCount: arr(products).length,
    activeSocialPlatforms: uniqueBy(arr(socialAccounts), (x) => x.platform).map(
      (x) => x.platform
    ),
  };
}

export function buildVoiceJson(capabilities, channels, contacts) {
  return {
    enabled:
      capabilities.supportsVoice ||
      arr(channels).some((x) => x.channelType === "voice"),
    supportsCalls:
      capabilities.supportsVoice ||
      arr(channels).some((x) => x.supportsCalls),
    canOfferCallback: capabilities.canOfferCallback,
    canOfferConsultation: capabilities.canOfferConsultation,
    primaryPhone:
      arr(contacts).find((x) => x.isPrimary && x.channel === "phone")?.value ||
      arr(contacts).find((x) => x.channel === "phone")?.value ||
      "",
  };
}

export function buildLeadCaptureJson(capabilities, channelPolicies, contacts) {
  const strongestPolicy =
    arr(channelPolicies).find((x) => x.contactCaptureMode !== "inherit") || null;

  return {
    enabled: capabilities.canCaptureLeads,
    canCapturePhone: capabilities.canCapturePhone,
    canCaptureEmail: capabilities.canCaptureEmail,
    contactCaptureMode: strongestPolicy?.contactCaptureMode || "inherit",
    availableContactChannels: uniqueBy(
      arr(contacts).filter((x) => x.enabled),
      (x) => `${x.channel}:${x.value}`
    ).map((x) => x.channel),
  };
}

export function buildHandoffJson(capabilities, channelPolicies) {
  const strongestPolicy =
    arr(channelPolicies).find((x) => x.escalationMode !== "inherit") || null;

  return {
    enabled: capabilities.handoffEnabled,
    autoOnHumanRequest: capabilities.autoHandoffOnHumanRequest,
    autoOnLowConfidence: capabilities.autoHandoffOnLowConfidence,
    escalationMode: strongestPolicy?.escalationMode || "inherit",
  };
}

export function buildBehaviorJson(profile, capabilities, channelPolicies) {
  const profileMeta = obj(profile?.metadataJson);
  const profileJsonBehavior = obj(profile?.profileJson?.nicheBehavior);
  const capabilitiesMeta = obj(capabilities?.metadataJson);
  const overrides = obj(
    profileMeta.nicheBehavior ||
      profileMeta.niche_behavior ||
      profileJsonBehavior ||
      capabilitiesMeta.nicheBehavior ||
      capabilitiesMeta.niche_behavior
  );

  const industryKey = s(
    overrides.businessType || overrides.niche || profile?.industryKey
  ).toLowerCase();
  const subNiche = s(
    overrides.subNiche || overrides.sub_niche || profile?.subindustryKey
  ).toLowerCase();
  const conversionGoal = s(
    overrides.conversionGoal ||
      overrides.conversion_goal ||
      (capabilities?.canOfferBooking
        ? "book_appointment"
        : capabilities?.canOfferConsultation
          ? "book_consultation"
          : capabilities?.canCaptureLeads
            ? "capture_qualified_lead"
            : "answer_and_route")
  ).toLowerCase();
  const primaryCta = s(
    overrides.primaryCta ||
      overrides.primary_cta ||
      profile?.preferredCta ||
      (conversionGoal === "book_appointment"
        ? "book_now"
        : conversionGoal === "book_consultation"
          ? "request_consultation"
          : "contact_us")
  ).toLowerCase();

  const defaultQualificationQuestionsByNiche = {
    clinic: [
      "What service or concern do you need help with?",
      "What day or time works best for you?",
      "Should we confirm by call or message?",
    ],
    restaurant: [
      "For which day and time do you need a table?",
      "How many guests will be joining?",
      "What is the best contact number for confirmation?",
    ],
    beauty: [
      "Which treatment are you interested in?",
      "What day or time works best for you?",
      "Should we confirm by call or message?",
    ],
    law: [
      "What type of legal matter is this about?",
      "Is there any urgent deadline or hearing date?",
      "What is the best callback number?",
    ],
    course: [
      "Which course or program are you interested in?",
      "What is your current level or goal?",
      "What is the best way to contact you?",
    ],
    real_estate: [
      "Are you buying, renting, or selling?",
      "Which area or budget range are you targeting?",
      "What is the best callback number?",
    ],
  };

  const leadQualificationMode = s(
    overrides.leadQualificationMode ||
      overrides.lead_qualification_mode ||
      (industryKey === "clinic"
        ? "service_booking_triage"
        : industryKey === "restaurant"
          ? "reservation_capture"
          : industryKey === "beauty"
            ? "service_booking_triage"
            : industryKey === "law"
              ? "matter_intake"
              : industryKey === "course"
                ? "program_fit_intake"
                : industryKey === "real_estate"
                  ? "buyer_seller_intake"
                  : "basic_contact_capture")
  ).toLowerCase();

  const qualificationQuestions = uniqStrings(
    arr(
      overrides.qualificationQuestions ||
        overrides.qualification_questions ||
        defaultQualificationQuestionsByNiche[industryKey] ||
        [
          "What are you looking for help with?",
          "What outcome are you trying to achieve?",
          "What is the best way to contact you?",
        ]
    )
  );

  const bookingFlowType = s(
    overrides.bookingFlowType ||
      overrides.booking_flow_type ||
      capabilities?.bookingMode ||
      (conversionGoal.includes("book")
        ? "appointment_request"
        : "manual_follow_up")
  ).toLowerCase();

  const handoffTriggers = uniqStrings(
    arr(
      overrides.handoffTriggers ||
        overrides.handoff_triggers ||
        [
          capabilities?.autoHandoffOnHumanRequest ? "human_request" : "",
          capabilities?.autoHandoffOnLowConfidence ? "low_confidence" : "",
          industryKey === "clinic" ? "urgent_health_claim" : "",
          industryKey === "law" ? "legal_risk_claim" : "",
          industryKey === "real_estate"
            ? "financing_or_document_review"
            : "",
        ]
    )
  );

  const disallowedClaims = uniqStrings(
    arr(
      overrides.disallowedClaims ||
        overrides.disallowed_claims ||
        [
          capabilities?.shouldAvoidLegalClaims
            ? "legal_advice_or_guarantees"
            : "",
          capabilities?.shouldAvoidUnverifiedPromises
            ? "unverified_outcome_promises"
            : "",
          industryKey === "clinic"
            ? "diagnosis_or_treatment_guarantees"
            : "",
          industryKey === "beauty" ? "instant_result_guarantees" : "",
          industryKey === "real_estate"
            ? "guaranteed_roi_or_approval"
            : "",
        ]
    )
  );

  const toneProfile = s(
    overrides.toneProfile ||
      overrides.tone_profile ||
      profile?.toneProfile ||
      (industryKey === "clinic"
        ? "calm_professional_reassuring"
        : industryKey === "restaurant"
          ? "warm_fast_hospitable"
          : industryKey === "law"
            ? "formal_clear_confident"
            : "professional")
  ).toLowerCase();

  return {
    businessType: industryKey || "general_business",
    niche: industryKey || "general_business",
    subNiche: subNiche || "",
    conversionGoal,
    primaryCta,
    leadQualificationMode,
    qualificationQuestions,
    bookingFlowType,
    handoffTriggers,
    disallowedClaims,
    toneProfile,
    channelBehavior: {
      inbox: {
        primaryAction: conversionGoal,
        qualificationDepth:
          leadQualificationMode === "basic_contact_capture" ? "light" : "guided",
        handoffBias: handoffTriggers.length > 0 ? "conditional" : "minimal",
      },
      comments: {
        primaryAction: "qualify_then_move_to_dm",
        qualificationDepth: "light",
        handoffBias: "minimal",
      },
      voice: {
        primaryAction:
          bookingFlowType === "appointment_request"
            ? "book_or_route_call"
            : "route_or_capture_callback",
        qualificationDepth: "guided",
        handoffBias: handoffTriggers.length > 0 ? "conditional" : "manual",
      },
    },
  };
}