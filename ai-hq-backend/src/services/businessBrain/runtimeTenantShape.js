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

function isTrueLike(value) {
  if (typeof value === "boolean") return value;

  const normalized = s(value).toLowerCase();
  if (!normalized) return false;

  return [
    "1",
    "true",
    "yes",
    "y",
    "on",
    "enabled",
    "active",
  ].includes(normalized);
}

function getChannelKey(value = "") {
  const normalized = s(value).toLowerCase();

  if (!normalized) return "";
  if (normalized === "ig") return "instagram";
  if (normalized === "insta") return "instagram";
  if (normalized === "messenger") return "facebook";
  if (normalized === "fb") return "facebook";
  if (normalized === "wa") return "whatsapp";
  if (normalized === "tg") return "telegram";

  return normalized;
}

function getContactChannelKey(value = "") {
  const normalized = s(value).toLowerCase();

  if (!normalized) return "";
  if (["tel", "telephone", "mobile", "call", "voice", "phone_number"].includes(normalized)) {
    return "phone";
  }
  if (
    [
      "wa",
      "whatsapp_business",
      "whatsapp-business",
      "whatsapp_phone",
      "whatsapp_number",
    ].includes(normalized)
  ) {
    return "whatsapp";
  }
  if (["mail", "e-mail"].includes(normalized)) return "email";
  if (["address", "location"].includes(normalized)) return "address";

  return normalized;
}

function resolveBooleanCandidate(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (s(value)) return isTrueLike(value);
  }
  return undefined;
}

function resolveChannelPolicyEnabled(policy = {}, fallback = true) {
  const value = obj(policy);

  const resolved = resolveBooleanCandidate(
    value.enabled,
    value.isEnabled,
    value.is_enabled,
    value.active,
    value.channelEnabled,
    value.channel_enabled,
    value.aiReplyEnabled,
    value.ai_reply_enabled
  );

  return typeof resolved === "boolean" ? resolved : fallback;
}

function findPreferredInboxChannelPolicy(channelPolicies = []) {
  const preferredOrder = ["telegram", "instagram", "facebook", "whatsapp"];

  for (const key of preferredOrder) {
    const match = arr(channelPolicies).find(
      (item) => getChannelKey(item?.channel) === key
    );
    if (match) return match;
  }

  return (
    arr(channelPolicies).find((item) =>
      ["telegram", "instagram", "facebook", "whatsapp"].includes(
        getChannelKey(item?.channel)
      )
    ) || null
  );
}

function resolveInboxSurfaceEnabled({
  inboxJson = {},
  channelPolicies = [],
  capabilities = {},
} = {}) {
  const inbox = obj(inboxJson);
  const capabilityBag = obj(capabilities);

  const explicitInboxEnabled = resolveBooleanCandidate(
    inbox.enabled,
    inbox.isEnabled,
    inbox.is_enabled
  );
  if (typeof explicitInboxEnabled === "boolean") return explicitInboxEnabled;

  const supportsInboxChannel = resolveBooleanCandidate(
    capabilityBag.supportsInstagramDm,
    capabilityBag.supports_instagram_dm,
    capabilityBag.supportsFacebookMessenger,
    capabilityBag.supports_facebook_messenger,
    capabilityBag.supportsWhatsapp,
    capabilityBag.supports_whatsapp,
    capabilityBag.supportsTelegram,
    capabilityBag.supports_telegram,
    capabilityBag.supportsTelegramDm,
    capabilityBag.supports_telegram_dm,
    capabilityBag.supportsTelegramBot,
    capabilityBag.supports_telegram_bot
  );

  if (typeof supportsInboxChannel === "boolean" && supportsInboxChannel) {
    return true;
  }

  const preferredPolicy = findPreferredInboxChannelPolicy(channelPolicies);
  if (preferredPolicy) {
    return resolveChannelPolicyEnabled(preferredPolicy, true);
  }

  return undefined;
}

function resolveInboxAutoReplyEnabled({
  inboxJson = {},
  legacyAutoReplyEnabled,
  channelPolicies = [],
  fallbackEnabled,
} = {}) {
  const inbox = obj(inboxJson);

  const explicit = resolveBooleanCandidate(
    inbox.aiReplyEnabled,
    inbox.ai_reply_enabled,
    inbox.autoReplyEnabled,
    inbox.auto_reply_enabled
  );
  if (typeof explicit === "boolean") return explicit;

  if (typeof legacyAutoReplyEnabled === "boolean") {
    return legacyAutoReplyEnabled;
  }

  const preferredPolicy = findPreferredInboxChannelPolicy(channelPolicies);
  if (preferredPolicy) {
    const fromPolicy = resolveBooleanCandidate(
      preferredPolicy.aiReplyEnabled,
      preferredPolicy.ai_reply_enabled,
      preferredPolicy.enabled,
      preferredPolicy.isEnabled,
      preferredPolicy.is_enabled
    );
    if (typeof fromPolicy === "boolean") return fromPolicy;
  }

  if (typeof fallbackEnabled === "boolean") return fallbackEnabled;
  return undefined;
}

function resolveCreateLeadEnabled({
  leadCaptureJson = {},
  legacyCreateLeadEnabled,
  capabilities = {},
} = {}) {
  const leadCapture = obj(leadCaptureJson);
  const capabilityBag = obj(capabilities);

  const explicit = resolveBooleanCandidate(
    leadCapture.enabled,
    leadCapture.isEnabled,
    leadCapture.is_enabled,
    leadCapture.canCaptureLeads,
    leadCapture.can_capture_leads
  );
  if (typeof explicit === "boolean") return explicit;

  if (typeof legacyCreateLeadEnabled === "boolean") {
    return legacyCreateLeadEnabled;
  }

  return resolveBooleanCandidate(
    capabilityBag.canCaptureLeads,
    capabilityBag.can_capture_leads
  );
}

function isShareableContact(contact = {}) {
  const item = obj(contact);
  if (!Object.keys(item).length) return false;
  if (item.enabled === false) return false;
  if (item.isActive === false || item.is_active === false) return false;
  if (item.visiblePublic === false && item.visibleInAi === false) return false;
  return true;
}

function collectContactValues(contacts = [], channels = []) {
  const wanted = new Set(
    arr(channels).map((x) => getContactChannelKey(x)).filter(Boolean)
  );

  return uniqStrings(
    arr(contacts)
      .filter((item) => isShareableContact(item))
      .filter((item) => {
        if (!wanted.size) return true;
        return wanted.has(
          getContactChannelKey(item?.channel || item?.type || item?.kind)
        );
      })
      .map((item) =>
        s(
          item?.value ||
            item?.phone ||
            item?.email ||
            item?.number ||
            item?.url ||
            ""
        )
      )
      .filter(Boolean)
  );
}

function collectLocationValues(locations = [], keys = []) {
  return uniqStrings(
    arr(locations)
      .map((location) => {
        const item = obj(location);
        for (const key of arr(keys)) {
          const text = s(item?.[key]);
          if (text) return text;
        }
        return "";
      })
      .filter(Boolean)
  );
}

function resolveProjectionPrimaryEmail({
  profileJson = {},
  contacts = [],
  activeKnowledge = [],
  facts = [],
}) {
  return (
    s(profileJson?.primaryEmail) ||
    pickPrimaryContact(contacts, ["email"]) ||
    firstFact(activeKnowledge, ["contact"], [
      "email_primary",
      "primary_email",
      "contact_email",
      "email",
    ]) ||
    firstFact(facts, ["contact"], [
      "email_primary",
      "primary_email",
      "contact_email",
      "email",
    ]) ||
    ""
  );
}

function resolveProjectionPrimaryPhone({
  profileJson = {},
  contacts = [],
  activeKnowledge = [],
  facts = [],
}) {
  return (
    s(profileJson?.primaryPhone) ||
    pickPrimaryContact(contacts, ["phone", "whatsapp"]) ||
    firstFact(activeKnowledge, ["contact"], [
      "phone_primary",
      "primary_phone",
      "contact_phone",
      "phone",
      "whatsapp_phone",
      "whatsapp_number",
    ]) ||
    firstFact(facts, ["contact"], [
      "phone_primary",
      "primary_phone",
      "contact_phone",
      "phone",
      "whatsapp_phone",
      "whatsapp_number",
    ]) ||
    ""
  );
}

function resolveProjectionWebsiteUrl({
  profileJson = {},
  identity = {},
  activeKnowledge = [],
  facts = [],
}) {
  return (
    s(profileJson?.websiteUrl) ||
    s(identity?.websiteUrl) ||
    firstFact(activeKnowledge, ["website", "social_link"], [
      "website_url",
      "site_url",
      "primary_website",
      "url",
    ]) ||
    firstFact(facts, ["website", "social_link"], [
      "website_url",
      "site_url",
      "primary_website",
      "url",
    ]) ||
    ""
  );
}

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

  const visibleContacts = arr(contacts).filter((item) => isShareableContact(item));
  const visibleLocations = arr(locations);

  const displayName =
    s(businessProfile?.display_name) ||
    s(businessProfile?.company_name) ||
    s(legacy?.profile?.brand_name) ||
    s(legacy?.company_name) ||
    s(legacy?.tenant_key);

  const summaryShort =
    s(businessProfile?.summary_short) ||
    s(legacy?.profile?.brand_summary) ||
    firstCanonical(
      ["summary"],
      ["summary_company_summary_short", "company_summary_short"]
    ) ||
    firstCanonical(["summary"]) ||
    firstFact(facts, ["summary"]);

  const summaryLong =
    s(businessProfile?.summary_long) ||
    s(legacy?.profile?.extra_context?.about) ||
    firstCanonical(
      ["summary"],
      ["summary_company_summary_long", "company_summary_long"]
    ) ||
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
    pickPrimaryContact(visibleContacts, ["email"]) ||
    firstCanonical(["contact"], ["email_primary", "primary_email"]) ||
    firstFact(facts, ["contact"]);

  const primaryPhone =
    s(legacy?.profile?.public_phone) ||
    s(businessProfile?.primary_phone) ||
    pickPrimaryContact(visibleContacts, ["phone", "whatsapp"]) ||
    firstCanonical(["contact"], ["phone_primary", "primary_phone"]) ||
    firstFact(facts, ["contact"]);

  const websiteUrl =
    s(legacy?.profile?.website_url) || s(businessProfile?.website_url);

  const primaryAddress =
    s(legacy?.profile?.primary_address) ||
    s(businessProfile?.primary_address) ||
    collectLocationValues(visibleLocations, [
      "addressLine",
      "address_line",
      "title",
      "city",
    ])[0] ||
    "";

  const contactPhones = uniqStrings([
    primaryPhone,
    ...collectContactValues(visibleContacts, [
      "phone",
      "mobile",
      "telephone",
      "tel",
      "call",
      "whatsapp",
    ]),
    ...collectLocationValues(visibleLocations, ["phone"]),
  ]);

  const contactEmails = uniqStrings([
    primaryEmail,
    ...collectContactValues(visibleContacts, ["email", "mail"]),
    ...collectLocationValues(visibleLocations, ["email"]),
  ]);

  const contactAddresses = uniqStrings([
    primaryAddress,
    ...collectLocationValues(visibleLocations, [
      "addressLine",
      "address_line",
      "title",
      "city",
    ]),
  ]);

  const websiteUrls = uniqStrings([
    websiteUrl,
    ...listCanonical(["website"]),
    ...listFactsByCategory(facts, ["website"]),
  ]);

  const bookingLinks = uniqStrings(
    listCanonical(["booking"]).length
      ? listCanonical(["booking"])
      : listFactsByCategory(facts, ["booking"])
  );

  const socialLinks = uniqStrings(
    listCanonical(["social_link"]).length
      ? listCanonical(["social_link"])
      : listFactsByCategory(facts, ["social_link"])
  );

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
    ...(capabilities?.should_avoid_legal_claims
      ? ["Do not make legal claims."]
      : []),
    ...(capabilities?.should_avoid_unverified_promises
      ? ["Do not make promises you cannot verify."]
      : []),
  ]);

  const channelPolicy = findPreferredInboxChannelPolicy(channelPolicies);

  const inboxEnabled = channelPolicy
    ? resolveChannelPolicyEnabled(channelPolicy, true)
    : undefined;

  const autoReplyEnabled =
    typeof legacy?.ai_policy?.auto_reply_enabled === "boolean"
      ? legacy.ai_policy.auto_reply_enabled
      : channelPolicy
        ? resolveBooleanCandidate(
            channelPolicy.ai_reply_enabled,
            channelPolicy.aiReplyEnabled,
            channelPolicy.enabled,
            channelPolicy.isEnabled,
            channelPolicy.is_enabled
          )
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
    industry_key:
      s(businessProfile?.industry_key) ||
      s(legacy?.industry_key || "generic_business"),
    timezone: s(legacy?.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,

    publicPhone: primaryPhone,
    primaryPhone,
    publicEmail: primaryEmail,
    primaryEmail,
    primaryAddress,
    websiteUrl,
    contacts: visibleContacts,
    locations: visibleLocations,
    contactPhones,
    contactEmails,
    contactAddresses,
    websiteUrls,
    bookingLinks,
    socialLinks,

    profile: {
      ...obj(legacy?.profile),
      brand_name: displayName,
      website_url: websiteUrl,
      public_email: primaryEmail,
      public_phone: primaryPhone,
      primary_address: primaryAddress,
      contact_emails: contactEmails,
      contact_phones: contactPhones,
      contact_addresses: contactAddresses,
      audience_summary: audienceSummary,
      services_summary: servicesText,
      value_proposition: valueProposition,
      brand_summary:
        summaryShort || summaryLong || s(legacy?.profile?.brand_summary),
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
        contacts: visibleContacts,
        locations: visibleLocations,
        bookingLinks,
        socialLinks,
        websiteUrls,
      },
    },
    brand: {
      name: displayName,
      displayName,
      tone: toneOfVoice,
      industry: s(
        businessProfile?.industry_key ||
          legacy?.industry_key ||
          "generic_business"
      ),
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
      policies: listCanonical(["policy"]).length
        ? listCanonical(["policy"])
        : listFactsByCategory(facts, ["policy"]),
      pricingPolicy:
        firstCanonical(["pricing_policy"]) ||
        firstFact(facts, ["pricing_policy"]),
      supportMode:
        firstCanonical(["support"]) || firstFact(facts, ["support"]),
      bookingLinks,
      socialLinks,
      contactEmails,
      contactPhones,
      contactAddresses,
      contacts: visibleContacts,
      locations: visibleLocations,
      websiteUrls,
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
      enabled: inboxEnabled,
      ai_reply_enabled: autoReplyEnabled,
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

  const visibleContacts = arr(contacts).filter((item) => isShareableContact(item));
  const visibleLocations = arr(locations);

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

  const primaryEmail = resolveProjectionPrimaryEmail({
    profileJson,
    contacts: visibleContacts,
    activeKnowledge,
    facts,
  });

  const primaryPhone = resolveProjectionPrimaryPhone({
    profileJson,
    contacts: visibleContacts,
    activeKnowledge,
    facts,
  });

  const websiteUrl = resolveProjectionWebsiteUrl({
    profileJson,
    identity,
    activeKnowledge,
    facts,
  });

  const primaryAddress =
    s(profileJson.primaryAddress) ||
    collectLocationValues(visibleLocations, [
      "addressLine",
      "address_line",
      "title",
      "city",
    ])[0] ||
    "";

  const contactPhones = uniqStrings([
    primaryPhone,
    ...collectContactValues(visibleContacts, [
      "phone",
      "mobile",
      "telephone",
      "tel",
      "call",
      "whatsapp",
    ]),
    ...collectLocationValues(visibleLocations, ["phone"]),
  ]);

  const contactEmails = uniqStrings([
    primaryEmail,
    ...collectContactValues(visibleContacts, ["email", "mail"]),
    ...collectLocationValues(visibleLocations, ["email"]),
  ]);

  const contactAddresses = uniqStrings([
    primaryAddress,
    ...collectLocationValues(visibleLocations, [
      "addressLine",
      "address_line",
      "title",
      "city",
    ]),
  ]);

  const websiteUrls = uniqStrings([
    websiteUrl,
    ...listFactsByCategory(activeKnowledge, ["website"]),
    ...listFactsByCategory(facts, ["website"]),
  ]);

  const bookingLinks = uniqStrings(
    listFactsByCategory(activeKnowledge, ["booking"]).length
      ? listFactsByCategory(activeKnowledge, ["booking"])
      : listFactsByCategory(facts, ["booking"])
  );

  const socialLinks = uniqStrings(
    listFactsByCategory(activeKnowledge, ["social_link"]).length
      ? listFactsByCategory(activeKnowledge, ["social_link"])
      : listFactsByCategory(facts, ["social_link"])
  );

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
    ...(capabilitiesJson.shouldAvoidLegalClaims
      ? ["Do not make legal claims."]
      : []),
    ...(capabilitiesJson.shouldAvoidUnverifiedPromises
      ? ["Do not make promises you cannot verify."]
      : []),
  ]);

  const preferredChannelPolicy =
    arr(channelPolicies).find((x) => lower(x.channel) === "instagram") ||
    arr(channelPolicies).find((x) => lower(x.channel) === "comments") ||
    arr(channelPolicies)[0] ||
    null;

  const legacyAutoReplyEnabled =
    typeof legacy?.ai_policy?.auto_reply_enabled === "boolean"
      ? legacy.ai_policy.auto_reply_enabled
      : undefined;

  const legacyCreateLeadEnabled =
    typeof legacy?.ai_policy?.create_lead_enabled === "boolean"
      ? legacy.ai_policy.create_lead_enabled
      : undefined;

  const inboxEnabled = resolveInboxSurfaceEnabled({
    inboxJson,
    channelPolicies,
    capabilities: capabilitiesJson,
  });

  const autoReplyEnabled = resolveInboxAutoReplyEnabled({
    inboxJson,
    legacyAutoReplyEnabled,
    channelPolicies,
    fallbackEnabled: inboxEnabled,
  });

  const createLeadEnabled = resolveCreateLeadEnabled({
    leadCaptureJson,
    legacyCreateLeadEnabled,
    capabilities: capabilitiesJson,
  });

  return {
    id: s(identity.tenantId || legacy?.id),
    tenant_key: s(identity.tenantKey || legacy?.tenant_key),
    company_name: s(profileJson.companyName || identity.companyName),
    legal_name: s(profileJson.legalName || identity.legalName),
    industry_key: s(
      profileJson.industryKey || identity.industryKey || "generic_business"
    ),
    timezone: s(legacy?.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,

    publicPhone: primaryPhone,
    primaryPhone,
    publicEmail: primaryEmail,
    primaryEmail,
    primaryAddress,
    websiteUrl,
    contacts: visibleContacts,
    locations: visibleLocations,
    contactPhones,
    contactEmails,
    contactAddresses,
    websiteUrls,
    bookingLinks,
    socialLinks,

    profile: {
      brand_name: displayName,
      website_url: websiteUrl,
      public_email: primaryEmail,
      public_phone: primaryPhone,
      primary_address: primaryAddress,
      contact_emails: contactEmails,
      contact_phones: contactPhones,
      contact_addresses: contactAddresses,
      audience_summary: s(profileJson.targetAudience),
      services_summary: uniqStrings(arr(services).map((x) => s(x.title))).join(
        ", "
      ),
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
        projection_readiness: s(
          projection?.readiness_label || projection?.readinessLabel || ""
        ),
        contacts: visibleContacts,
        locations: visibleLocations,
        bookingLinks,
        socialLinks,
        websiteUrls,
      },
    },
    brand: {
      name: displayName,
      displayName,
      tone: toneOfVoice,
      industry: s(
        profileJson.industryKey || identity.industryKey || "generic_business"
      ),
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
      policies: listFactsByCategory(activeKnowledge, ["policy"]).length
        ? listFactsByCategory(activeKnowledge, ["policy"])
        : listFactsByCategory(facts, ["policy"]),
      pricingPolicy:
        firstFact(activeKnowledge, ["pricing_policy"]) ||
        firstFact(facts, ["pricing_policy"]),
      supportMode:
        firstFact(activeKnowledge, ["support"]) ||
        firstFact(facts, ["support"]),
      bookingLinks,
      socialLinks,
      contactEmails,
      contactPhones,
      contactAddresses,
      contacts: visibleContacts,
      locations: visibleLocations,
      websiteUrls,
      preferredCta,
      runtimeProjectionId: s(projection?.id),
      readinessLabel: s(
        projection?.readiness_label || projection?.readinessLabel
      ),
      confidenceLabel: s(
        projection?.confidence_label || projection?.confidenceLabel
      ),
    },
    ai_policy: {
      auto_reply_enabled: autoReplyEnabled,
      create_lead_enabled: createLeadEnabled,
      businessContext: businessSummary,
      toneText: toneOfVoice,
      servicesText: uniqStrings(arr(services).map((x) => s(x.title))).join(", "),
    },
    inbox_policy: {
      enabled: inboxEnabled,
      ai_reply_enabled: autoReplyEnabled,
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
      reply_style: s(
        commentsJson.replyStyle || capabilitiesJson.replyStyle || ""
      ),
      cta_style: s(capabilitiesJson.ctaStyle || ""),
      public_reply_mode: s(
        commentsJson.publicReplyMode ||
          preferredChannelPolicy?.public_reply_mode ||
          ""
      ),
    },
  };
}

export {
  buildTenantFromProjection,
  mergeTenantRuntime,
};