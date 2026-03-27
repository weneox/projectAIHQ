import {
  firstFact,
  listFactsByCategory,
  pickPrimaryContact,
} from "./runtimeCatalog.js";
import {
  arr,
  compactText,
  lower,
  normalizeLanguage,
  normalizeLanguageList,
  obj,
  s,
  uniqStrings,
} from "./runtimeShared.js";

function mergeTenantRuntime({
  legacy,
  businessProfile,
  capabilities,
  facts,
  contacts,
  locations,
  channelPolicies,
  services,
  activeKnowledge,
}) {
  const firstCanonical = (categories = [], itemKeys = []) =>
    firstFact(activeKnowledge, categories, itemKeys);
  const listCanonical = (categories = []) =>
    listFactsByCategory(activeKnowledge, categories);
  const summaryShort =
    s(businessProfile?.summary_short) ||
    s(legacy?.profile?.brand_summary) ||
    firstCanonical(["summary"], ["summary_company_summary_short", "company_summary_short"]) ||
    firstCanonical(["summary"]) ||
    firstFact(facts, ["summary"]);
  const summaryLong =
    s(businessProfile?.summary_long) ||
    s(legacy?.profile?.extra_context?.about) ||
    firstCanonical(["summary"], ["summary_company_summary_long", "company_summary_long"]) ||
    "";
  const audienceSummary =
    s(businessProfile?.target_audience) ||
    s(legacy?.profile?.audience_summary) ||
    firstCanonical(["audience"]) ||
    firstFact(facts, ["audience"]);
  const valueProposition =
    s(businessProfile?.value_proposition) ||
    s(legacy?.profile?.value_proposition) ||
    firstCanonical(["brand", "summary"], ["value_proposition"]);
  const toneOfVoice =
    s(legacy?.profile?.tone_of_voice) ||
    s(businessProfile?.tone_profile) ||
    firstCanonical(["tone", "brand"]) ||
    "professional, warm, concise";
  const servicesText =
    uniqStrings(arr(services).map((x) => s(x.title))).join(", ") ||
    s(legacy?.profile?.services_summary);
  const primaryEmail =
    s(legacy?.profile?.public_email) ||
    s(businessProfile?.primary_email) ||
    pickPrimaryContact(contacts, ["email"]) ||
    firstCanonical(["contact"], ["email_primary", "primary_email"]) ||
    firstFact(facts, ["contact"]);
  const primaryPhone =
    s(legacy?.profile?.public_phone) ||
    s(businessProfile?.primary_phone) ||
    pickPrimaryContact(contacts, ["phone", "whatsapp"]) ||
    firstCanonical(["contact"], ["phone_primary", "primary_phone"]) ||
    firstFact(facts, ["contact"]);
  const websiteUrl = s(legacy?.profile?.website_url) || s(businessProfile?.website_url);
  const preferredCta =
    s(legacy?.profile?.preferred_cta) ||
    firstCanonical(["cta", "booking"]) ||
    firstFact(facts, ["cta", "booking"]);
  const defaultLanguage = normalizeLanguage(
    s(businessProfile?.main_language) ||
      s(capabilities?.primary_language) ||
      s(legacy?.default_language || "az"),
    "az"
  );
  const supportedLanguages = normalizeLanguageList(
    businessProfile?.supported_languages,
    capabilities?.supported_languages,
    legacy?.supported_languages,
    legacy?.enabled_languages,
    businessProfile?.main_language,
    capabilities?.primary_language,
    defaultLanguage
  );
  const maxSentences =
    lower(capabilities?.reply_length) === "short"
      ? 1
      : lower(capabilities?.reply_length) === "detailed"
        ? 3
        : 2;
  const bannedPhrases = uniqStrings([
    ...arr(legacy?.profile?.banned_phrases),
    ...(capabilities?.should_avoid_competitor_comparisons
      ? ["Do not compare competitors aggressively."]
      : []),
    ...(capabilities?.should_avoid_legal_claims ? ["Do not make legal claims."] : []),
    ...(capabilities?.should_avoid_unverified_promises
      ? ["Do not make promises you cannot verify."]
      : []),
  ]);
  const displayName =
    s(businessProfile?.display_name) ||
    s(businessProfile?.company_name) ||
    s(legacy?.profile?.brand_name) ||
    s(legacy?.company_name) ||
    s(legacy?.tenant_key);
  const channelPolicy =
    arr(channelPolicies).find(
      (x) => lower(x.channel) === "instagram" && lower(x.subchannel || "default") === "default"
    ) ||
    arr(channelPolicies).find(
      (x) => lower(x.channel) === "comments" && lower(x.subchannel || "default") === "default"
    ) ||
    arr(channelPolicies)[0] ||
    null;
  const autoReplyEnabled =
    typeof legacy?.ai_policy?.auto_reply_enabled === "boolean"
      ? legacy.ai_policy.auto_reply_enabled
      : typeof channelPolicy?.ai_reply_enabled === "boolean"
        ? channelPolicy.ai_reply_enabled
        : undefined;
  const createLeadEnabled =
    typeof legacy?.ai_policy?.create_lead_enabled === "boolean"
      ? legacy.ai_policy.create_lead_enabled
      : typeof capabilities?.can_capture_leads === "boolean"
        ? capabilities.can_capture_leads
        : undefined;
  const businessSummary = compactText(
    [summaryShort, valueProposition, servicesText].filter(Boolean).join(" - "),
    1400
  );

  return {
    ...legacy,
    company_name: s(businessProfile?.company_name) || s(legacy?.company_name),
    legal_name: s(businessProfile?.legal_name) || s(legacy?.legal_name),
    industry_key: s(businessProfile?.industry_key) || s(legacy?.industry_key || "generic_business"),
    timezone: s(legacy?.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,
    profile: {
      ...obj(legacy?.profile),
      brand_name: displayName,
      website_url: websiteUrl,
      public_email: primaryEmail,
      public_phone: primaryPhone,
      audience_summary: audienceSummary,
      services_summary: servicesText,
      value_proposition: valueProposition,
      brand_summary: summaryShort || summaryLong || s(legacy?.profile?.brand_summary),
      tone_of_voice: toneOfVoice,
      preferred_cta: preferredCta,
      banned_phrases: bannedPhrases,
      communication_rules: {
        ...obj(legacy?.profile?.communication_rules),
        maxSentences,
        replyStyle: s(capabilities?.reply_style || "professional"),
        replyLength: s(capabilities?.reply_length || "medium"),
        emojiLevel: s(capabilities?.emoji_level || "low"),
        ctaStyle: s(capabilities?.cta_style || "soft"),
      },
      extra_context: {
        ...obj(legacy?.profile?.extra_context),
        business_brain_enabled: true,
        canonical_priority: true,
        source_summary_json: obj(businessProfile?.source_summary_json),
        contacts,
        locations,
      },
    },
    brand: {
      name: displayName,
      displayName,
      tone: toneOfVoice,
      industry: s(businessProfile?.industry_key || legacy?.industry_key || "generic_business"),
      defaultLanguage,
      languages: supportedLanguages,
    },
    meta: {
      ...obj(legacy?.meta),
      businessSummary,
      about: summaryLong || summaryShort,
      services: uniqStrings(arr(services).map((x) => s(x.title))),
      products: listCanonical(["product"]).length
        ? listCanonical(["product"])
        : listFactsByCategory(facts, ["product"]),
      pricingHints: listCanonical(["pricing"]).length
        ? listCanonical(["pricing"])
        : listFactsByCategory(facts, ["pricing"]),
      pricingPolicy: firstCanonical(["pricing_policy"]) || firstFact(facts, ["pricing_policy"]),
      supportMode: firstCanonical(["support"]) || firstFact(facts, ["support"]),
      bookingLinks: listCanonical(["booking"]).length
        ? listCanonical(["booking"])
        : listFactsByCategory(facts, ["booking"]),
      socialLinks: listCanonical(["social_link"]).length
        ? listCanonical(["social_link"])
        : listFactsByCategory(facts, ["social_link"]),
      contactEmails: primaryEmail ? [primaryEmail] : [],
      contactPhones: primaryPhone ? [primaryPhone] : [],
      locations: arr(locations).map((x) => s(x.address_line || x.addressLine || x.title)).filter(Boolean),
      preferredCta,
    },
    ai_policy: {
      ...obj(legacy?.ai_policy),
      auto_reply_enabled: autoReplyEnabled,
      create_lead_enabled: createLeadEnabled,
      businessContext: businessSummary,
      toneText: toneOfVoice,
      servicesText,
    },
    inbox_policy: {
      ...obj(legacy?.inbox_policy),
      reply_style: s(capabilities?.reply_style || ""),
      max_reply_sentences: maxSentences,
      pricing_visibility: s(channelPolicy?.pricing_visibility || ""),
      human_handoff_enabled:
        typeof channelPolicy?.human_handoff_enabled === "boolean"
          ? Boolean(channelPolicy.human_handoff_enabled)
          : typeof capabilities?.handoff_enabled === "boolean"
            ? Boolean(capabilities.handoff_enabled)
            : undefined,
    },
    comment_policy: {
      ...obj(legacy?.comment_policy),
      reply_style: s(capabilities?.reply_style || ""),
      cta_style: s(capabilities?.cta_style || ""),
    },
  };
}

function buildTenantFromProjection({
  legacy,
  projection,
  services = [],
  facts = [],
  contacts = [],
  locations = [],
  channelPolicies = [],
  activeKnowledge = [],
}) {
  const identity = obj(projection?.identity_json);
  const profileJson = obj(projection?.profile_json);
  const capabilitiesJson = obj(projection?.capabilities_json);
  const inboxJson = obj(projection?.inbox_json);
  const commentsJson = obj(projection?.comments_json);
  const contentJson = obj(projection?.content_json);
  const leadCaptureJson = obj(projection?.lead_capture_json);
  const handoffJson = obj(projection?.handoff_json);
  const displayName =
    s(identity.displayName) ||
    s(profileJson.displayName) ||
    s(profileJson.companyName) ||
    s(identity.companyName) ||
    s(identity.tenantKey) ||
    s(legacy?.tenant_key);
  const defaultLanguage = normalizeLanguage(
    identity.mainLanguage ||
      capabilitiesJson.primaryLanguage ||
      profileJson.mainLanguage ||
      "az",
    "az"
  );
  const supportedLanguages = normalizeLanguageList(
    identity.supportedLanguages,
    capabilitiesJson.supportedLanguages,
    profileJson.supportedLanguages,
    defaultLanguage
  );
  const businessSummary = compactText(
    [
      s(profileJson.summaryShort),
      s(profileJson.summaryLong),
      s(profileJson.valueProposition),
      uniqStrings(arr(services).map((x) => s(x.title))).join(", "),
    ]
      .filter(Boolean)
      .join(" - "),
    1400
  );
  const preferredCta =
    firstFact(activeKnowledge, ["cta", "booking"]) ||
    firstFact(facts, ["cta", "booking"]) ||
    s(contentJson.ctaStyle);
  const primaryEmail = s(profileJson.primaryEmail) || pickPrimaryContact(contacts, ["email"]);
  const primaryPhone =
    s(profileJson.primaryPhone) || pickPrimaryContact(contacts, ["phone", "whatsapp"]);
  const toneOfVoice =
    s(profileJson.toneProfile) ||
    s(contentJson.toneProfile) ||
    s(capabilitiesJson.replyStyle) ||
    "professional, warm, concise";
  const maxSentences =
    lower(capabilitiesJson.replyLength) === "short"
      ? 1
      : lower(capabilitiesJson.replyLength) === "detailed"
        ? 3
        : Number(commentsJson.maxReplySentences || 2);
  const bannedPhrases = uniqStrings([
    ...(capabilitiesJson.shouldAvoidCompetitorComparisons
      ? ["Do not compare competitors aggressively."]
      : []),
    ...(capabilitiesJson.shouldAvoidLegalClaims ? ["Do not make legal claims."] : []),
    ...(capabilitiesJson.shouldAvoidUnverifiedPromises
      ? ["Do not make promises you cannot verify."]
      : []),
  ]);
  const preferredChannelPolicy =
    arr(channelPolicies).find((x) => lower(x.channel) === "instagram") ||
    arr(channelPolicies).find((x) => lower(x.channel) === "comments") ||
    arr(channelPolicies)[0] ||
    null;

  return {
    id: s(identity.tenantId || legacy?.id),
    tenant_key: s(identity.tenantKey || legacy?.tenant_key),
    company_name: s(profileJson.companyName || identity.companyName),
    legal_name: s(profileJson.legalName || identity.legalName),
    industry_key: s(profileJson.industryKey || identity.industryKey || "generic_business"),
    timezone: s(legacy?.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,
    profile: {
      brand_name: displayName,
      website_url: s(profileJson.websiteUrl || identity.websiteUrl),
      public_email: primaryEmail,
      public_phone: primaryPhone,
      audience_summary: s(profileJson.targetAudience),
      services_summary: uniqStrings(arr(services).map((x) => s(x.title))).join(", "),
      value_proposition: s(profileJson.valueProposition),
      brand_summary: s(profileJson.summaryShort || profileJson.summaryLong),
      tone_of_voice: toneOfVoice,
      preferred_cta: preferredCta,
      banned_phrases: bannedPhrases,
      communication_rules: {
        maxSentences,
        replyStyle: s(capabilitiesJson.replyStyle || "professional"),
        replyLength: s(capabilitiesJson.replyLength || "medium"),
        emojiLevel: s(capabilitiesJson.emojiLevel || "low"),
        ctaStyle: s(capabilitiesJson.ctaStyle || "soft"),
      },
      extra_context: {
        business_brain_enabled: true,
        projection_first: true,
        projection_status: s(projection?.status),
        projection_confidence: projection?.confidence || 0,
        projection_readiness: s(projection?.readiness_label || ""),
        contacts,
        locations,
      },
    },
    brand: {
      name: displayName,
      displayName,
      tone: toneOfVoice,
      industry: s(profileJson.industryKey || identity.industryKey || "generic_business"),
      defaultLanguage,
      languages: supportedLanguages,
    },
    meta: {
      businessSummary,
      about: s(profileJson.summaryLong || profileJson.summaryShort),
      services: uniqStrings(arr(services).map((x) => s(x.title))),
      products: listFactsByCategory(activeKnowledge, ["product"]).length
        ? listFactsByCategory(activeKnowledge, ["product"])
        : listFactsByCategory(facts, ["product"]),
      pricingHints: listFactsByCategory(activeKnowledge, ["pricing"]).length
        ? listFactsByCategory(activeKnowledge, ["pricing"])
        : listFactsByCategory(facts, ["pricing"]),
      pricingPolicy: firstFact(activeKnowledge, ["pricing_policy"]) || firstFact(facts, ["pricing_policy"]),
      supportMode: firstFact(activeKnowledge, ["support"]) || firstFact(facts, ["support"]),
      bookingLinks: listFactsByCategory(activeKnowledge, ["booking"]).length
        ? listFactsByCategory(activeKnowledge, ["booking"])
        : listFactsByCategory(facts, ["booking"]),
      socialLinks: listFactsByCategory(activeKnowledge, ["social_link"]).length
        ? listFactsByCategory(activeKnowledge, ["social_link"])
        : listFactsByCategory(facts, ["social_link"]),
      contactEmails: primaryEmail ? [primaryEmail] : [],
      contactPhones: primaryPhone ? [primaryPhone] : [],
      locations: arr(locations).map((x) => s(x.address_line || x.addressLine || x.title)).filter(Boolean),
      preferredCta,
      runtimeProjectionId: s(projection?.id),
      readinessLabel: s(projection?.readiness_label || projection?.readinessLabel),
      confidenceLabel: s(projection?.confidence_label || projection?.confidenceLabel),
    },
    ai_policy: {
      auto_reply_enabled:
        typeof inboxJson.enabled === "boolean"
          ? inboxJson.enabled
          : undefined,
      create_lead_enabled:
        typeof leadCaptureJson.enabled === "boolean"
          ? leadCaptureJson.enabled
          : undefined,
      businessContext: businessSummary,
      toneText: toneOfVoice,
      servicesText: uniqStrings(arr(services).map((x) => s(x.title))).join(", "),
    },
    inbox_policy: {
      reply_style: s(capabilitiesJson.replyStyle || ""),
      max_reply_sentences: maxSentences,
      pricing_visibility: s(preferredChannelPolicy?.pricing_visibility || ""),
      human_handoff_enabled:
        typeof handoffJson.enabled === "boolean"
          ? handoffJson.enabled
          : typeof preferredChannelPolicy?.human_handoff_enabled === "boolean"
            ? preferredChannelPolicy.human_handoff_enabled
            : undefined,
    },
    comment_policy: {
      reply_style: s(commentsJson.replyStyle || capabilitiesJson.replyStyle || ""),
      cta_style: s(capabilitiesJson.ctaStyle || ""),
      public_reply_mode: s(commentsJson.publicReplyMode || preferredChannelPolicy?.public_reply_mode || ""),
    },
  };
}

export {
  buildTenantFromProjection,
  mergeTenantRuntime,
};
