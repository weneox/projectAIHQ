import * as businessRuntimeApi from "../businessBrain/getTenantBrainRuntime.js";
import {
  createRuntimeAuthorityError,
  isRuntimeAuthorityError,
} from "../businessBrain/runtimeAuthority.js";
import {
  arr,
  getResolvedTenantKey,
  lower,
  obj,
  s,
  uniqStrings,
} from "./shared.js";
import { resolveBehaviorProfile } from "./behavior/resolveBehaviorProfile.js";

function normalizeIndustry(value) {
  const x = lower(value);
  if (!x) return "generic_business";

  const aliases = {
    clinic: "clinic",
    dental: "clinic",
    dentist: "clinic",
    hospital: "clinic",
    health: "clinic",
    healthcare: "clinic",

    hotel: "hospitality",
    hospitality: "hospitality",
    travel: "hospitality",

    restaurant: "restaurant",
    cafe: "restaurant",
    coffee: "restaurant",
    food: "restaurant",

    retail: "retail",
    store: "retail",
    shop: "retail",

    ecommerce: "ecommerce",
    "e-commerce": "ecommerce",

    legal: "legal",
    law: "legal",

    finance: "finance",
    fintech: "finance",
    insurance: "finance",

    education: "education",
    school: "education",
    academy: "education",
    course: "education",

    technology: "technology",
    tech: "technology",
    saas: "technology",
    software: "technology",
    ai: "technology",

    automotive: "automotive",
    auto: "automotive",
    car: "automotive",

    logistics: "logistics",
    transport: "logistics",
    cargo: "logistics",

    real_estate: "real_estate",
    realestate: "real_estate",
    property: "real_estate",

    beauty: "beauty",
    salon: "beauty",
    spa: "beauty",
    cosmetics: "beauty",

    creative_agency: "creative_agency",
    agency: "creative_agency",
    marketing: "creative_agency",
    branding: "creative_agency",

    generic: "generic_business",
    generic_business: "generic_business",
  };

  return aliases[x] || x || "generic_business";
}

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

function normalizePriority(value, fallback = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStringList(...values) {
  return uniqStrings(
    values.flatMap((value) => arr(value).map((item) => s(item))).filter(Boolean)
  );
}

function normalizeLooseText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function normalizeLanguageCode(value = "") {
  const x = lower(value);
  if (!x) return "";

  if (["az", "aze", "azerbaijani"].includes(x)) return "az";
  if (["en", "eng", "english"].includes(x)) return "en";
  if (["tr", "tur", "turkish"].includes(x)) return "tr";
  if (["ru", "rus", "russian"].includes(x)) return "ru";
  if (["es", "spa", "spanish"].includes(x)) return "es";
  if (["de", "deu", "ger", "german"].includes(x)) return "de";
  if (["fr", "fra", "fre", "french"].includes(x)) return "fr";
  if (["it", "ita", "italian"].includes(x)) return "it";
  if (["pt", "por", "portuguese"].includes(x)) return "pt";
  if (["ar", "ara", "arabic"].includes(x)) return "ar";
  if (["nl", "dut", "nld", "dutch"].includes(x)) return "nl";
  if (["pl", "pol", "polish"].includes(x)) return "pl";
  if (["uk", "ukr", "ukrainian"].includes(x)) return "uk";
  if (["zh", "zho", "chi", "chinese"].includes(x)) return "zh";
  if (["ja", "jpn", "japanese"].includes(x)) return "ja";
  if (["ko", "kor", "korean"].includes(x)) return "ko";
  if (["hi", "hin", "hindi"].includes(x)) return "hi";

  return x;
}

function normalizeLanguageList(...sources) {
  const values = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      values.push(...source);
      continue;
    }
    if (typeof source === "string") {
      values.push(source);
    }
  }

  const normalized = uniqStrings(
    values.map((item) => normalizeLanguageCode(item)).filter(Boolean)
  );

  return normalized.length ? normalized : ["en"];
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function normalizeBehaviorObject(...sources) {
  for (const source of sources) {
    const safe = obj(source);
    if (Object.keys(safe).length) return safe;
  }
  return {};
}

function normalizePromptList(...sources) {
  const values = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      values.push(...source);
      continue;
    }
    if (typeof source === "string") {
      values.push(source);
    }
  }

  return uniqStrings(
    values.map((item) => normalizeLooseText(item)).filter(Boolean)
  );
}

function normalizeContactType(value = "") {
  const x = lower(value);
  if (!x) return "";

  if (["phone", "mobile", "tel", "call"].includes(x)) return "phone";
  if (["whatsapp", "wa"].includes(x)) return "whatsapp";
  if (["telegram", "tg"].includes(x)) return "telegram";
  if (["email", "mail", "e-mail"].includes(x)) return "email";
  if (["website", "site", "web"].includes(x)) return "website";
  if (["instagram", "ig"].includes(x)) return "instagram";
  if (["facebook", "fb", "messenger"].includes(x)) return "facebook";

  return x;
}

function normalizeContactValue(value = "") {
  return normalizeLooseText(value);
}

function normalizeContactEntry(item) {
  const x = obj(item);

  const rawType = pickFirstString(
    x.type,
    x.contact_type,
    x.contactType,
    x.channel,
    x.kind
  );

  const value = normalizeContactValue(
    pickFirstString(
      x.value,
      x.contact_value,
      x.contactValue,
      x.phone,
      x.phone_number,
      x.phoneNumber,
      x.email,
      x.website,
      x.url,
      x.href,
      x.username,
      x.handle
    )
  );

  const type = normalizeContactType(rawType);

  return {
    id: s(x.id || x.contact_id),
    type,
    label: pickFirstString(x.label, x.title, x.name),
    value,
    primary: normalizeBoolean(
      x.primary,
      typeof x.is_primary === "boolean" ? x.is_primary : false
    ),
    public: normalizeBoolean(
      x.public,
      typeof x.is_public === "boolean" ? x.is_public : true
    ),
    meta: x,
  };
}

function normalizeLocationEntry(item) {
  const x = obj(item);
  const address = pickFirstString(
    x.address_line,
    x.addressLine,
    x.address,
    x.title,
    x.label
  );

  return {
    id: s(x.id || x.location_id),
    title: pickFirstString(x.title, x.label, address),
    address,
    city: s(x.city),
    region: s(x.region),
    country: s(x.country),
    primary: normalizeBoolean(
      x.primary,
      typeof x.is_primary === "boolean" ? x.is_primary : false
    ),
    meta: x,
  };
}

function dedupeContacts(list = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const normalized = normalizeContactEntry(item);
    if (!normalized.value) continue;

    const key = `${normalized.type}:${lower(normalized.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function dedupeLocations(list = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const normalized = normalizeLocationEntry(item);
    const key = lower(
      normalized.address || normalized.title || JSON.stringify(normalized.meta)
    );
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function pickPrimaryContactValue(list = [], types = []) {
  const normalizedTypes = normalizeStringList(types).map((item) =>
    normalizeContactType(item)
  );

  const exactPrimary = arr(list).find(
    (item) =>
      normalizedTypes.includes(normalizeContactType(item?.type)) &&
      item?.primary &&
      s(item?.value)
  );
  if (exactPrimary?.value) return exactPrimary.value;

  const exactPublic = arr(list).find(
    (item) =>
      normalizedTypes.includes(normalizeContactType(item?.type)) &&
      item?.public !== false &&
      s(item?.value)
  );
  if (exactPublic?.value) return exactPublic.value;

  const anyExact = arr(list).find(
    (item) =>
      normalizedTypes.includes(normalizeContactType(item?.type)) && s(item?.value)
  );
  if (anyExact?.value) return anyExact.value;

  return "";
}

function listContactValues(list = [], types = []) {
  const normalizedTypes = normalizeStringList(types).map((item) =>
    normalizeContactType(item)
  );

  return uniqStrings(
    arr(list)
      .filter((item) => normalizedTypes.includes(normalizeContactType(item?.type)))
      .map((item) => s(item?.value))
      .filter(Boolean)
  );
}

function extractRawContacts(container = {}, rawTenant = {}, rawProfile = {}) {
  const tenantMeta = obj(rawTenant?.meta);
  const tenantProfile = obj(rawTenant?.profile);
  const tenantProfileExtra = obj(
    tenantProfile?.extra_context || tenantProfile?.extraContext
  );
  const profile = obj(rawProfile);
  const profileExtra = obj(profile?.extra_context || profile?.extraContext);
  const raw = obj(container?.raw);

  const primitiveContacts = [
    ...normalizeStringList(
      container?.contactPhones,
      tenantMeta?.contactPhones,
      tenantMeta?.contact_phones
    ).map((value) => ({ type: "phone", value })),
    ...normalizeStringList(
      container?.contactEmails,
      tenantMeta?.contactEmails,
      tenantMeta?.contact_emails
    ).map((value) => ({ type: "email", value })),
    ...normalizeStringList(
      pickFirstString(
        container?.primaryPhone,
        profile?.public_phone,
        tenantProfile?.public_phone
      )
    ).map((value) => ({ type: "phone", value, primary: true })),
    ...normalizeStringList(
      pickFirstString(
        container?.primaryEmail,
        profile?.public_email,
        tenantProfile?.public_email
      )
    ).map((value) => ({ type: "email", value, primary: true })),
    ...normalizeStringList(
      pickFirstString(
        container?.websiteUrl,
        profile?.website_url,
        tenantProfile?.website_url,
        tenantMeta?.websiteUrl,
        tenantMeta?.website_url
      )
    ).map((value) => ({ type: "website", value, primary: true })),
  ];

  return [
    ...arr(container?.contacts),
    ...arr(raw?.contacts),
    ...arr(tenantMeta?.contacts),
    ...arr(tenantProfileExtra?.contacts),
    ...arr(profileExtra?.contacts),
    ...primitiveContacts,
  ];
}

function extractRawLocations(container = {}, rawTenant = {}) {
  const tenantMeta = obj(rawTenant?.meta);
  const tenantProfile = obj(rawTenant?.profile);
  const tenantProfileExtra = obj(
    tenantProfile?.extra_context || tenantProfile?.extraContext
  );
  const raw = obj(container?.raw);

  const primitiveLocations = normalizeStringList(tenantMeta?.locations).map(
    (value) => ({
      address: value,
      primary: false,
    })
  );

  return [
    ...arr(container?.locations),
    ...arr(raw?.locations),
    ...arr(tenantMeta?.locationObjects),
    ...arr(tenantProfileExtra?.locations),
    ...primitiveLocations,
  ];
}

function buildServiceModeDefaults(service = {}) {
  const x = obj(service);

  return {
    responseMode: s(x.response_mode || x.responseMode || "template"),
    pricingMode: s(x.pricing_mode || x.pricingMode || "quote_required"),
    contactCaptureMode: s(
      x.contact_capture_mode || x.contactCaptureMode || "optional"
    ),
    handoffMode: s(x.handoff_mode || x.handoffMode || "optional"),
  };
}

function normalizeServiceEntry(item) {
  const x = obj(item);

  const name = pickFirstString(
    x.title,
    x.name,
    x.service_name,
    x.label
  );

  const description = pickFirstString(
    x.description_full,
    x.description_short,
    x.description,
    x.summary,
    x.details,
    x.value_proposition
  );

  const aliases = normalizeStringList(
    x.aliases,
    x.keywords,
    x.synonyms,
    x.example_requests
  );

  const active = normalizeBoolean(
    x.active,
    typeof x.enabled === "boolean"
      ? x.enabled
      : typeof x.is_active === "boolean"
        ? x.is_active
        : true
  );

  const visibleInAi = normalizeBoolean(
    x.visible_in_ai,
    typeof x.visibleInAi === "boolean" ? x.visibleInAi : true
  );

  const modes = buildServiceModeDefaults(x);

  return {
    id: s(x.id || x.service_id),
    key: lower(x.service_key || x.key || x.slug || name),
    name,
    description,
    aliases,
    active,
    visibleInAi,
    faqAnswer: s(x.faq_answer || x.faqAnswer),
    disabledReplyText: s(x.disabled_reply_text || x.disabledReplyText),
    responseMode: modes.responseMode,
    pricingMode: modes.pricingMode,
    contactCaptureMode: modes.contactCaptureMode,
    handoffMode: modes.handoffMode,
    meta: x,
  };
}

function normalizeKnowledgeEntry(item) {
  const x = obj(item);

  const title = pickFirstString(x.title, x.question, x.name);
  const answer = pickFirstString(
    x.answer,
    x.content,
    x.text,
    x.body,
    x.description
  );

  const keywords = normalizeStringList(
    x.keywords,
    x.aliases,
    s(x.question),
    s(x.title)
  );

  const active = normalizeBoolean(
    x.active,
    typeof x.enabled === "boolean" ? x.enabled : true
  );

  return {
    id: s(x.id || x.entry_id),
    title,
    question: s(x.question),
    answer,
    keywords,
    active,
    intentKey: s(x.intent_key || x.intentKey),
    serviceKey: s(x.service_key || x.serviceKey),
    language: normalizeLanguageCode(x.language || "en") || "en",
    priority: normalizePriority(x.priority, 100),
    meta: x,
  };
}

function normalizePlaybook(item) {
  const x = obj(item);

  const triggerKeywords = normalizeStringList(
    x.triggerKeywords,
    x.triggers,
    x.keywords,
    s(x.user_example),
    s(x.intent_key),
    s(x.service_key)
  );

  const replyTemplate = pickFirstString(
    x.ideal_reply,
    x.replyTemplate,
    x.reply,
    x.response,
    x.template
  );

  const actionType = lower(x.actionType || x.action || x.type || x.cta_type);

  const active = normalizeBoolean(
    x.active,
    typeof x.enabled === "boolean" ? x.enabled : true
  );

  return {
    id: s(x.id || x.playbook_id),
    name: s(x.name || x.title || x.intent_key || x.service_key),
    triggerKeywords,
    replyTemplate,
    actionType,
    createLead:
      normalizeBoolean(x.createLead, false) ||
      ["lead", "contact", "quote", "book", "capture_lead"].includes(actionType),
    handoff:
      normalizeBoolean(x.handoff, false) ||
      ["handoff", "operator", "human"].includes(actionType),
    handoffReason: s(x.handoffReason || x.intent_key || ""),
    handoffPriority: s(x.handoffPriority || "normal") || "normal",
    intentKey: s(x.intent_key),
    serviceKey: s(x.service_key),
    language: normalizeLanguageCode(x.language || "en") || "en",
    priority: normalizePriority(x.priority, 100),
    active,
    meta: x,
  };
}

function normalizeServiceCatalogList(rawList = []) {
  return arr(rawList)
    .map(normalizeServiceEntry)
    .filter((item) => item.name);
}

function normalizeKnowledgeList(rawList = []) {
  return arr(rawList)
    .map(normalizeKnowledgeEntry)
    .filter((item) => item.active && (item.title || item.answer || item.question));
}

function normalizePlaybookList(rawList = []) {
  return arr(rawList)
    .map(normalizePlaybook)
    .filter((item) => item.active);
}

function buildNormalizedServiceNames(serviceCatalog = [], active = true) {
  return uniqStrings(
    arr(serviceCatalog)
      .filter((item) =>
        active ? item?.active && item?.visibleInAi : !item?.active && item?.visibleInAi
      )
      .map((item) => s(item?.name))
      .filter(Boolean)
  );
}

function extractConversationAssets({
  profile = {},
  meta = {},
  behavior = {},
  rawBehavior = {},
}) {
  return {
    primaryCtaRaw: normalizeLooseText(
      pickFirstString(
        profile?.primary_cta,
        profile?.primaryCta,
        meta?.preferredCta,
        meta?.preferred_cta,
        meta?.primaryCta,
        meta?.primary_cta,
        behavior?.primaryCta,
        rawBehavior?.primaryCta,
        rawBehavior?.primary_cta
      )
    ),
    qualificationQuestions: normalizePromptList(
      profile?.qualificationQuestions,
      profile?.qualification_questions,
      meta?.qualificationQuestions,
      meta?.qualification_questions,
      behavior?.qualificationQuestions,
      rawBehavior?.qualificationQuestions,
      rawBehavior?.qualification_questions
    ),
    leadPrompts: normalizePromptList(
      behavior?.leadPrompts,
      rawBehavior?.leadPrompts,
      rawBehavior?.lead_prompts,
      meta?.leadPrompts,
      meta?.lead_prompts
    ),
    customGreeting: normalizeLooseText(
      pickFirstString(
        behavior?.customGreeting,
        rawBehavior?.customGreeting,
        rawBehavior?.custom_greeting,
        profile?.customGreeting,
        meta?.customGreeting
      )
    ),
  };
}

function buildFallbackBehavior({
  tenant = {},
  profile = {},
  meta = {},
  industry = "generic_business",
}) {
  return resolveBehaviorProfile({
    industry,
    tenant,
    profile,
    meta,
    runtimeBehavior: {},
    runtimeChannelBehavior: {},
    fallbackBehavior: {},
    fallbackChannelBehavior: {},
  });
}

function getTenantBusinessProfile(tenant, tenantKey, services = []) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const safeTenant = obj(tenant);
  const profile = obj(safeTenant?.profile);
  const brand = obj(safeTenant?.brand);
  const meta = obj(safeTenant?.meta);
  const aiPolicy = obj(safeTenant?.ai_policy);
  const inboxPolicy = obj(safeTenant?.inbox_policy);

  const normalizedServices = normalizeServiceCatalogList(services);
  const serviceNames = buildNormalizedServiceNames(normalizedServices, true);
  const disabledServiceNames = buildNormalizedServiceNames(normalizedServices, false);

  const displayName = pickFirstString(
    profile?.brand_name,
    profile?.brandName,
    brand?.displayName,
    brand?.name,
    safeTenant?.company_name,
    safeTenant?.name,
    resolvedTenantKey
  );

  const industry = normalizeIndustry(
    profile?.industry_key ||
      safeTenant?.industry_key ||
      meta?.industry ||
      brand?.industry ||
      "generic_business"
  );

  const businessSummary = pickFirstString(
    profile?.brand_summary,
    profile?.services_summary,
    profile?.value_proposition,
    meta?.businessSummary,
    meta?.business_description,
    meta?.about,
    brand?.tagline
  );

  const behavior = buildFallbackBehavior({
    tenant: safeTenant,
    profile,
    meta,
    industry,
  });

  const conversationAssets = extractConversationAssets({
    profile,
    meta,
    behavior,
    rawBehavior: {},
  });

  const contacts = dedupeContacts([
    ...extractRawContacts(
      {
        primaryPhone: pickFirstString(profile?.public_phone),
        primaryEmail: pickFirstString(profile?.public_email),
        websiteUrl: pickFirstString(profile?.website_url),
      },
      safeTenant,
      profile
    ),
  ]).filter((item) => item.public !== false);

  const locations = dedupeLocations(extractRawLocations({}, safeTenant));
  const primaryPhone = pickPrimaryContactValue(contacts, ["phone", "whatsapp"]);
  const primaryEmail = pickPrimaryContactValue(contacts, ["email"]);
  const websiteUrl = pickFirstString(
    pickPrimaryContactValue(contacts, ["website"]),
    profile?.website_url,
    meta?.websiteUrl,
    meta?.website_url
  );
  const primaryAddress = pickFirstString(
    arr(locations).find((item) => item?.primary && s(item?.address))?.address,
    arr(locations).find((item) => s(item?.address))?.address
  );
  const contactPhones = listContactValues(contacts, ["phone", "whatsapp"]);
  const contactEmails = listContactValues(contacts, ["email"]);
  const contactAddresses = normalizeStringList(
    arr(locations).map((item) => s(item?.address))
  );
  const websiteUrls = normalizeStringList(
    websiteUrl,
    pickPrimaryContactValue(contacts, ["website"])
  );

  return {
    tenantKey: resolvedTenantKey,
    displayName,
    industry,
    businessSummary,
    businessType: pickFirstString(
      profile?.business_type,
      meta?.businessType,
      meta?.business_type
    ),
    niche: pickFirstString(meta?.niche),
    subNiche: pickFirstString(meta?.subNiche, meta?.sub_niche),
    services: serviceNames,
    disabledServices: disabledServiceNames,
    serviceCatalog: normalizedServices,
    knowledgeEntries: [],
    responsePlaybooks: [],
    languages: normalizeLanguageList(
      safeTenant?.supported_languages,
      safeTenant?.enabled_languages,
      profile?.languages,
      meta?.languages,
      brand?.languages,
      safeTenant?.default_language,
      "en"
    ),
    tone: s(behavior.tone),
    toneProfile: s(behavior.toneProfile),
    formality: s(behavior.formality),
    warmth: s(behavior.warmth),
    brevity: s(behavior.brevity),
    emojiPolicy: s(behavior.emojiPolicy),
    maxSentences: Number(behavior.maxSentences || 2),
    leadPrompts: conversationAssets.leadPrompts,
    forbiddenClaims: normalizeStringList(
      profile?.banned_phrases,
      meta?.forbiddenClaims,
      behavior.forbiddenPhrases,
      behavior.doNotSay
    ),
    conversionGoal: pickFirstString(
      profile?.conversion_goal,
      meta?.conversionGoal,
      meta?.conversion_goal
    ),
    primaryCta:
      conversationAssets.primaryCtaRaw ||
      pickFirstString(profile?.preferred_cta, meta?.preferredCta),
    leadQualificationMode: pickFirstString(
      profile?.lead_qualification_mode,
      meta?.leadQualificationMode,
      meta?.lead_qualification_mode
    ),
    qualificationQuestions: conversationAssets.qualificationQuestions,
    bookingFlowType: pickFirstString(
      profile?.booking_flow_type,
      meta?.bookingFlowType,
      meta?.booking_flow_type
    ),
    handoffTriggers: normalizeStringList(
      meta?.handoffTriggers,
      meta?.handoff_triggers
    ),
    disallowedClaims: normalizeStringList(
      meta?.disallowedClaims,
      meta?.disallowed_claims,
      profile?.banned_phrases
    ),
    behavior,
    channelBehavior: behavior.channelBehavior,
    aiPolicy,
    inboxPolicy,
    profile,
    tenant: safeTenant,
    threadState: null,
    conversationAssets,
    primaryPhone,
    primaryEmail,
    primaryAddress,
    websiteUrl,
    contactPhones,
    contactEmails,
    contactAddresses,
    websiteUrls,
    bookingLinks: normalizeStringList(
      meta?.bookingLinks,
      obj(profile?.extra_context)?.bookingLinks
    ),
    socialLinks: normalizeStringList(
      meta?.socialLinks,
      obj(profile?.extra_context)?.socialLinks
    ),
    contacts,
    locations,
  };
}

function getRuntimeFactory() {
  const directCandidates = [
    businessRuntimeApi?.getTenantBrainRuntime,
    businessRuntimeApi?.getTenantBusinessRuntime,
    businessRuntimeApi?.buildBusinessRuntime,
    businessRuntimeApi?.getBusinessRuntime,
    businessRuntimeApi?.createBusinessRuntime,
    businessRuntimeApi?.getTenantBusinessBrainRuntime,
    businessRuntimeApi?.buildTenantBusinessRuntime,
    businessRuntimeApi?.createTenantBusinessRuntime,
    businessRuntimeApi?.resolveBusinessRuntime,
    businessRuntimeApi?.resolveTenantBusinessRuntime,
    typeof businessRuntimeApi?.default === "function" ? businessRuntimeApi.default : null,
  ].filter((fn) => typeof fn === "function");

  if (directCandidates.length) return directCandidates[0];

  const defaultObj = obj(businessRuntimeApi?.default);
  const nestedCandidates = [
    defaultObj.getTenantBrainRuntime,
    defaultObj.getTenantBusinessRuntime,
    defaultObj.buildBusinessRuntime,
    defaultObj.getBusinessRuntime,
    defaultObj.createBusinessRuntime,
    defaultObj.getTenantBusinessBrainRuntime,
    defaultObj.buildTenantBusinessRuntime,
    defaultObj.createTenantBusinessRuntime,
    defaultObj.resolveBusinessRuntime,
    defaultObj.resolveTenantBusinessRuntime,
  ].filter((fn) => typeof fn === "function");

  return nestedCandidates[0] || null;
}

function buildStrictRuntimeFallback({ tenantKey, threadState = null } = {}) {
  return {
    tenantKey: getResolvedTenantKey(tenantKey),
    tenant: null,
    profile: {},
    aiPolicy: {},
    inboxPolicy: {},
    threadState: threadState || null,
    displayName: "",
    industry: "generic_business",
    businessSummary: "",
    businessType: "",
    niche: "",
    subNiche: "",
    serviceCatalog: [],
    knowledgeEntries: [],
    responsePlaybooks: [],
    services: [],
    disabledServices: [],
    languages: ["en"],
    tone: "",
    toneProfile: "",
    formality: "",
    warmth: "",
    brevity: "",
    emojiPolicy: "",
    maxSentences: 2,
    leadPrompts: [],
    forbiddenClaims: [],
    conversionGoal: "",
    primaryCta: "",
    leadQualificationMode: "",
    qualificationQuestions: [],
    bookingFlowType: "",
    handoffTriggers: [],
    disallowedClaims: [],
    behavior: {},
    channelBehavior: {},
    conversationAssets: {
      primaryCtaRaw: "",
      qualificationQuestions: [],
      leadPrompts: [],
      customGreeting: "",
    },
    primaryPhone: "",
    primaryEmail: "",
    primaryAddress: "",
    websiteUrl: "",
    contactPhones: [],
    contactEmails: [],
    contactAddresses: [],
    websiteUrls: [],
    bookingLinks: [],
    socialLinks: [],
    contacts: [],
    locations: [],
  };
}

function assertAuthoritativeRuntimeTenant(runtime, tenantKey) {
  const container = obj(runtime?.runtime || runtime?.data || runtime);
  const tenant = obj(container?.tenant);

  if (tenant?.id || tenant?.tenant_key) return tenant;

  throw createRuntimeAuthorityError({
    mode: "strict",
    tenantKey: getResolvedTenantKey(tenantKey),
    reasonCode: "runtime_projection_missing",
    reason: "runtime_projection_missing",
    message:
      "Approved runtime authority is unavailable because no authoritative tenant payload was returned.",
  });
}

function extractRawServiceCatalog(container = {}) {
  return arr(container.serviceCatalog).length
    ? arr(container.serviceCatalog)
    : arr(container.servicesDetailed).length
      ? arr(container.servicesDetailed)
      : arr(container.service_catalog);
}

function extractRawKnowledgeEntries(container = {}) {
  return arr(container.knowledgeEntries).length
    ? arr(container.knowledgeEntries)
    : arr(container.knowledge).length
      ? arr(container.knowledge)
      : arr(container.knowledge_entries);
}

function extractRawPlaybooks(container = {}) {
  return arr(container.responsePlaybooks).length
    ? arr(container.responsePlaybooks)
    : arr(container.playbooks).length
      ? arr(container.playbooks)
      : arr(container.response_playbooks);
}

function normalizeRuntimeResult(rawRuntime, fallback, options = {}) {
  const strictAuthority = options?.strictAuthority === true;
  const container = obj(rawRuntime?.runtime || rawRuntime?.data || rawRuntime);

  const rawTenant = obj(container.tenant);
  const rawProfile = obj(container.profile);
  const rawAiPolicy = obj(container.aiPolicy || container.ai_policy);
  const rawInboxPolicy = obj(container.inboxPolicy || container.inbox_policy);
  const rawThreadState = obj(
    container.threadState || container.thread_state || container.state
  );
  const rawBehavior = normalizeBehaviorObject(
    container.behavior,
    container.behavior_json
  );
  const rawChannelBehavior = normalizeBehaviorObject(
    container.channelBehavior,
    container.channel_behavior,
    rawBehavior.channelBehavior,
    rawBehavior.channel_behavior
  );

  const normalizedCatalog = extractRawServiceCatalog(container).length
    ? normalizeServiceCatalogList(extractRawServiceCatalog(container))
    : strictAuthority
      ? []
      : arr(fallback.serviceCatalog);

  const normalizedKnowledge = extractRawKnowledgeEntries(container).length
    ? normalizeKnowledgeList(extractRawKnowledgeEntries(container))
    : strictAuthority
      ? []
      : arr(fallback.knowledgeEntries);

  const normalizedPlaybooks = extractRawPlaybooks(container).length
    ? normalizePlaybookList(extractRawPlaybooks(container))
    : strictAuthority
      ? []
      : arr(fallback.responsePlaybooks);

  const services = normalizeStringList(
    arr(container.services).length
      ? container.services
      : buildNormalizedServiceNames(normalizedCatalog, true)
  );

  const disabledServices = normalizeStringList(
    arr(container.disabledServices).length
      ? container.disabledServices
      : buildNormalizedServiceNames(normalizedCatalog, false)
  );

  const effectiveIndustry = normalizeIndustry(
    container.industry ||
      container.industryKey ||
      rawProfile.industry_key ||
      rawTenant.industry_key ||
      fallback.industry
  );

  const mergedTenant = strictAuthority
    ? rawTenant
    : { ...obj(fallback.tenant), ...rawTenant };
  const mergedProfile = strictAuthority
    ? rawProfile
    : { ...obj(fallback.profile), ...rawProfile };

  const resolvedBehavior = resolveBehaviorProfile({
    industry: effectiveIndustry,
    tenant: mergedTenant,
    profile: mergedProfile,
    meta: obj(rawTenant?.meta),
    runtimeBehavior: rawBehavior,
    runtimeChannelBehavior: rawChannelBehavior,
    fallbackBehavior: obj(fallback.behavior),
    fallbackChannelBehavior: obj(fallback.channelBehavior),
  });

  const conversationAssets = extractConversationAssets({
    profile: mergedProfile,
    meta: obj(rawTenant?.meta),
    behavior: resolvedBehavior,
    rawBehavior,
  });

  const contacts = dedupeContacts(
    extractRawContacts(container, rawTenant, mergedProfile)
  ).filter((item) => item.public !== false);

  const locations = dedupeLocations(extractRawLocations(container, rawTenant));

  const primaryPhone = pickFirstString(
    container.primaryPhone,
    pickPrimaryContactValue(contacts, ["phone", "whatsapp"]),
    mergedProfile?.public_phone,
    obj(rawTenant?.profile)?.public_phone,
    strictAuthority ? "" : fallback.primaryPhone
  );

  const primaryEmail = pickFirstString(
    container.primaryEmail,
    pickPrimaryContactValue(contacts, ["email"]),
    mergedProfile?.public_email,
    obj(rawTenant?.profile)?.public_email,
    strictAuthority ? "" : fallback.primaryEmail
  );

  const websiteUrl = pickFirstString(
    container.websiteUrl,
    pickPrimaryContactValue(contacts, ["website"]),
    mergedProfile?.website_url,
    obj(rawTenant?.profile)?.website_url,
    obj(rawTenant?.meta)?.websiteUrl,
    obj(rawTenant?.meta)?.website_url,
    strictAuthority ? "" : fallback.websiteUrl
  );

  const contactPhones = normalizeStringList(
    container.contactPhones,
    listContactValues(contacts, ["phone", "whatsapp"]),
    strictAuthority ? [] : fallback.contactPhones
  );

  const contactEmails = normalizeStringList(
    container.contactEmails,
    listContactValues(contacts, ["email"]),
    strictAuthority ? [] : fallback.contactEmails
  );

  const primaryAddress = pickFirstString(
    container.primaryAddress,
    arr(locations).find((item) => item?.primary && s(item?.address))?.address,
    arr(locations).find((item) => s(item?.address))?.address,
    mergedProfile?.primary_address,
    obj(rawTenant?.profile)?.primary_address,
    strictAuthority ? "" : fallback.primaryAddress
  );

  const contactAddresses = normalizeStringList(
    container.contactAddresses,
    arr(locations).map((item) => s(item?.address)),
    strictAuthority ? [] : fallback.contactAddresses
  );

  const websiteUrls = normalizeStringList(
    container.websiteUrls,
    container.websiteUrl,
    listContactValues(contacts, ["website"]),
    mergedProfile?.website_url,
    obj(rawTenant?.profile)?.website_url,
    obj(rawTenant?.meta)?.websiteUrl,
    obj(rawTenant?.meta)?.website_url,
    strictAuthority ? [] : fallback.websiteUrls
  );

  const bookingLinks = normalizeStringList(
    container.bookingLinks,
    obj(rawTenant?.meta)?.bookingLinks,
    obj(rawTenant?.profile?.extra_context)?.bookingLinks,
    strictAuthority ? [] : fallback.bookingLinks
  );

  const socialLinks = normalizeStringList(
    container.socialLinks,
    obj(rawTenant?.meta)?.socialLinks,
    obj(rawTenant?.profile?.extra_context)?.socialLinks,
    strictAuthority ? [] : fallback.socialLinks
  );

  return {
    ...fallback,
    ...container,
    tenant: Object.keys(rawTenant).length ? mergedTenant : fallback.tenant,
    profile: Object.keys(rawProfile).length ? mergedProfile : fallback.profile,
    aiPolicy: Object.keys(rawAiPolicy).length
      ? strictAuthority
        ? rawAiPolicy
        : { ...obj(fallback.aiPolicy), ...rawAiPolicy }
      : fallback.aiPolicy,
    inboxPolicy: Object.keys(rawInboxPolicy).length
      ? strictAuthority
        ? rawInboxPolicy
        : { ...obj(fallback.inboxPolicy), ...rawInboxPolicy }
      : fallback.inboxPolicy,
    threadState: Object.keys(rawThreadState).length
      ? rawThreadState
      : fallback.threadState,
    displayName: pickFirstString(
      container.displayName,
      container.companyName,
      mergedProfile.brand_name,
      mergedProfile.displayName,
      mergedTenant.company_name,
      fallback.displayName
    ),
    industry: effectiveIndustry,
    businessSummary: pickFirstString(
      container.businessSummary,
      container.summary,
      container.summaryShort,
      container.valueProposition,
      obj(rawTenant?.meta)?.businessSummary,
      fallback.businessSummary
    ),
    businessType: pickFirstString(
      container.businessType,
      rawBehavior.businessType,
      rawBehavior.business_type,
      fallback.businessType
    ),
    niche: pickFirstString(container.niche, rawBehavior.niche, fallback.niche),
    subNiche: pickFirstString(
      container.subNiche,
      container.sub_niche,
      rawBehavior.subNiche,
      rawBehavior.sub_niche,
      fallback.subNiche
    ),
    serviceCatalog: normalizedCatalog,
    knowledgeEntries: normalizedKnowledge,
    responsePlaybooks: normalizedPlaybooks,
    services: services.length ? services : strictAuthority ? [] : arr(fallback.services),
    disabledServices: disabledServices.length
      ? disabledServices
      : strictAuthority
        ? []
        : arr(fallback.disabledServices),
    languages: normalizeLanguageList(
      arr(container.languages).length
        ? container.languages
        : strictAuthority
          ? [
              ...arr(rawTenant.supported_languages),
              ...arr(rawTenant.enabled_languages),
              s(rawTenant.default_language),
            ]
          : arr(fallback.languages)
    ),
    tone: s(resolvedBehavior.tone),
    toneProfile: s(resolvedBehavior.toneProfile),
    formality: s(resolvedBehavior.formality),
    warmth: s(resolvedBehavior.warmth),
    brevity: s(resolvedBehavior.brevity),
    emojiPolicy: s(resolvedBehavior.emojiPolicy),
    maxSentences: Number(resolvedBehavior.maxSentences || 2),
    leadPrompts: conversationAssets.leadPrompts,
    forbiddenClaims: normalizeStringList(
      arr(container.forbiddenClaims).length
        ? container.forbiddenClaims
        : strictAuthority
          ? []
          : arr(fallback.forbiddenClaims),
      resolvedBehavior.forbiddenPhrases,
      resolvedBehavior.doNotSay
    ),
    conversionGoal: pickFirstString(
      container.conversionGoal,
      container.conversion_goal,
      rawBehavior.conversionGoal,
      rawBehavior.conversion_goal,
      fallback.conversionGoal
    ),
    primaryCta:
      conversationAssets.primaryCtaRaw ||
      pickFirstString(
        container.primaryCta,
        container.primary_cta,
        rawBehavior.primaryCta,
        rawBehavior.primary_cta,
        strictAuthority ? "" : fallback.primaryCta
      ),
    leadQualificationMode: pickFirstString(
      container.leadQualificationMode,
      container.lead_qualification_mode,
      rawBehavior.leadQualificationMode,
      rawBehavior.lead_qualification_mode,
      fallback.leadQualificationMode
    ),
    qualificationQuestions: conversationAssets.qualificationQuestions,
    bookingFlowType: pickFirstString(
      container.bookingFlowType,
      container.booking_flow_type,
      rawBehavior.bookingFlowType,
      rawBehavior.booking_flow_type,
      fallback.bookingFlowType
    ),
    handoffTriggers: normalizeStringList(
      container.handoffTriggers,
      container.handoff_triggers,
      rawBehavior.handoffTriggers,
      rawBehavior.handoff_triggers,
      fallback.handoffTriggers
    ),
    disallowedClaims: normalizeStringList(
      container.disallowedClaims,
      container.disallowed_claims,
      rawBehavior.disallowedClaims,
      rawBehavior.disallowed_claims,
      fallback.disallowedClaims
    ),
    behavior: resolvedBehavior,
    channelBehavior: resolvedBehavior.channelBehavior,
    conversationAssets,
    primaryPhone,
    primaryEmail,
    primaryAddress,
    websiteUrl,
    contactPhones,
    contactEmails,
    contactAddresses,
    websiteUrls,
    bookingLinks,
    socialLinks,
    contacts,
    locations,
  };
}

async function resolveInboxRuntime({
  tenantKey,
  tenant = null,
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  channel = "",
  thread = null,
  message = null,
  recentMessages = [],
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  runtime = null,
}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const fallback = buildStrictRuntimeFallback({
    tenantKey: resolvedTenantKey,
    threadState,
  });

  if (runtime && typeof runtime === "object") {
    assertAuthoritativeRuntimeTenant(runtime, resolvedTenantKey);
    return normalizeRuntimeResult(runtime, fallback, { strictAuthority: true });
  }

  const runtimeFactory = getRuntimeFactory();
  if (!runtimeFactory) {
    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantKey: resolvedTenantKey,
      reasonCode: "runtime_resolver_missing",
      reason: "runtime_resolver_missing",
      message:
        "Approved runtime authority is unavailable because no strict runtime resolver is configured.",
    });
  }

  try {
    const produced = await runtimeFactory({
      tenantKey: resolvedTenantKey,
      tenant,
      services,
      knowledgeEntries,
      responsePlaybooks,
      threadState,
      channel,
      thread,
      message,
      recentMessages,
      customerContext,
      formData,
      leadContext,
      conversationContext,
    });

    assertAuthoritativeRuntimeTenant(produced, resolvedTenantKey);
    return normalizeRuntimeResult(produced, fallback, { strictAuthority: true });
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      throw error;
    }

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantKey: resolvedTenantKey,
      reasonCode: "runtime_resolution_failed",
      reason: "runtime_resolution_failed",
      message:
        "Approved runtime authority is unavailable because runtime resolution failed for this execution path.",
    });
  }
}

function buildServiceLine(profile) {
  const services = normalizeStringList(profile?.services || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

function buildDisabledServiceLine(profile) {
  const services = normalizeStringList(profile?.disabledServices || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

function pickLeadPrompt(profile) {
  return s(
    profile?.conversationAssets?.leadPrompts?.[0] ||
      profile?.leadPrompts?.[0] ||
      ""
  );
}

function pickBehaviorLeadPrompt(profile) {
  return s(
    profile?.conversationAssets?.qualificationQuestions?.[0] ||
      profile?.qualificationQuestions?.[0] ||
      profile?.conversationAssets?.leadPrompts?.[0] ||
      profile?.leadPrompts?.[0] ||
      ""
  );
}

function getIndustryHints(industry) {
  const normalized = normalizeIndustry(industry);

  const map = {
    clinic: {
      keywords: [],
      pricingHint: "Pricing can vary by service type and case complexity.",
    },
    hospitality: {
      keywords: [],
      pricingHint: "Pricing can vary depending on dates, scope, and package details.",
    },
    restaurant: {
      keywords: [],
      pricingHint: "Pricing can vary depending on the service and request details.",
    },
    legal: {
      keywords: [],
      pricingHint: "Pricing can vary depending on matter type and complexity.",
    },
    finance: {
      keywords: [],
      pricingHint: "Pricing and fees can vary depending on the product and case details.",
    },
    education: {
      keywords: [],
      pricingHint: "Pricing can vary depending on the program and format.",
    },
    ecommerce: {
      keywords: [],
      pricingHint: "Pricing can vary depending on products, delivery, and scope.",
    },
    technology: {
      keywords: [],
      pricingHint: "Pricing can vary depending on scope, features, and implementation depth.",
    },
    creative_agency: {
      keywords: [],
      pricingHint: "Pricing can vary depending on scope, quality level, and deliverables.",
    },
    generic_business: {
      keywords: [],
      pricingHint: "Pricing can vary depending on the service, scope, and requirements.",
    },
  };

  return map[normalized] || map.generic_business;
}

export {
  normalizeIndustry,
  normalizeContactEntry,
  normalizeLocationEntry,
  normalizeServiceEntry,
  normalizeKnowledgeEntry,
  normalizePlaybook,
  getTenantBusinessProfile,
  getRuntimeFactory,
  normalizeRuntimeResult,
  resolveInboxRuntime,
  buildServiceLine,
  buildDisabledServiceLine,
  pickLeadPrompt,
  pickBehaviorLeadPrompt,
  getIndustryHints,
};