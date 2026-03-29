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

export function normalizeIndustry(v) {
  const x = lower(v);
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

export function normalizeServiceEntry(item) {
  const x = obj(item);

  const name =
    s(x.title) ||
    s(x.name) ||
    s(x.service_name) ||
    s(x.label);

  const description =
    s(x.description_full) ||
    s(x.description_short) ||
    s(x.description) ||
    s(x.summary) ||
    s(x.details) ||
    s(x.value_proposition);

  const aliases = uniqStrings([
    ...arr(x.aliases),
    ...arr(x.keywords),
    ...arr(x.synonyms),
    ...arr(x.example_requests),
  ]);

  const active =
    typeof x.active === "boolean"
      ? x.active
      : typeof x.enabled === "boolean"
        ? x.enabled
        : typeof x.is_active === "boolean"
          ? x.is_active
          : true;

  const visibleInAi =
    typeof x.visible_in_ai === "boolean"
      ? x.visible_in_ai
      : typeof x.visibleInAi === "boolean"
        ? x.visibleInAi
        : true;

  return {
    id: s(x.id || x.service_id),
    key: lower(x.service_key || x.key || x.slug || name),
    name,
    description,
    aliases,
    active: Boolean(active),
    visibleInAi: Boolean(visibleInAi),
    faqAnswer: s(x.faq_answer),
    disabledReplyText: s(x.disabled_reply_text),
    responseMode: s(x.response_mode || "template"),
    pricingMode: s(x.pricing_mode || "quote_required"),
    contactCaptureMode: s(x.contact_capture_mode || "optional"),
    handoffMode: s(x.handoff_mode || "optional"),
    meta: x,
  };
}

export function normalizeKnowledgeEntry(item) {
  const x = obj(item);

  const title =
    s(x.title) ||
    s(x.question) ||
    s(x.name);

  const answer =
    s(x.answer) ||
    s(x.content) ||
    s(x.text) ||
    s(x.body) ||
    s(x.description);

  const keywords = uniqStrings([
    ...arr(x.keywords),
    ...arr(x.aliases),
    s(x.question),
    s(x.title),
  ]);

  const active =
    typeof x.active === "boolean"
      ? x.active
      : typeof x.enabled === "boolean"
        ? x.enabled
        : true;

  return {
    id: s(x.id || x.entry_id),
    title,
    question: s(x.question),
    answer,
    keywords,
    active: Boolean(active),
    intentKey: s(x.intent_key),
    serviceKey: s(x.service_key),
    language: s(x.language || "az"),
    priority: Number(x.priority || 100),
    meta: x,
  };
}

export function normalizePlaybook(item) {
  const x = obj(item);

  const triggerKeywords = uniqStrings([
    ...arr(x.triggerKeywords),
    ...arr(x.triggers),
    ...arr(x.keywords),
    s(x.user_example),
    s(x.intent_key),
    s(x.service_key),
  ]);

  const replyTemplate =
    s(x.ideal_reply) ||
    s(x.replyTemplate) ||
    s(x.reply) ||
    s(x.response) ||
    s(x.template);

  const actionType =
    lower(x.actionType || x.action || x.type || x.cta_type);

  const active =
    typeof x.active === "boolean"
      ? x.active
      : typeof x.enabled === "boolean"
        ? x.enabled
        : true;

  return {
    id: s(x.id || x.playbook_id),
    name: s(x.name || x.title || x.intent_key || x.service_key),
    triggerKeywords,
    replyTemplate,
    actionType,
    createLead:
      Boolean(x.createLead) ||
      ["lead", "contact", "quote", "book", "capture_lead"].includes(actionType),
    handoff:
      Boolean(x.handoff) ||
      ["handoff", "operator", "human"].includes(actionType),
    handoffReason: s(x.handoffReason || x.intent_key || ""),
    handoffPriority: s(x.handoffPriority || "normal") || "normal",
    intentKey: s(x.intent_key),
    serviceKey: s(x.service_key),
    language: s(x.language || "az"),
    priority: Number(x.priority || 100),
    active: Boolean(active),
    meta: x,
  };
}

export function getTenantBusinessProfile(tenant, tenantKey, services = []) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const profile = obj(tenant?.profile);
  const brand = obj(tenant?.brand);
  const meta = obj(tenant?.meta);
  const aiPolicy = obj(tenant?.ai_policy);
  const inboxPolicy = obj(tenant?.inbox_policy);
  const features = obj(tenant?.features);

  const normalizedServices = arr(services)
    .map(normalizeServiceEntry)
    .filter((x) => x.name);

  const activeVisibleServices = normalizedServices.filter((x) => x.active && x.visibleInAi);
  const disabledVisibleServices = normalizedServices.filter((x) => !x.active && x.visibleInAi);

  const displayName =
    s(profile?.brand_name) ||
    s(profile?.brandName) ||
    s(brand?.displayName) ||
    s(brand?.name) ||
    s(tenant?.company_name) ||
    s(tenant?.name) ||
    resolvedTenantKey;

  const industry =
    normalizeIndustry(
      profile?.industry_key ||
        tenant?.industry_key ||
        meta?.industry ||
        brand?.industry ||
        features?.industry ||
        "generic_business"
    );

  const businessSummary =
    s(profile?.brand_summary) ||
    s(profile?.services_summary) ||
    s(profile?.value_proposition) ||
    s(meta?.businessSummary) ||
    s(meta?.business_description) ||
    s(meta?.about) ||
    s(brand?.tagline) ||
    "";

  const fallbackServices = uniqStrings(
    arr(profile?.services).length
      ? profile.services
      : arr(meta?.services).length
        ? meta.services
        : arr(meta?.products).length
          ? meta.products
          : arr(meta?.categories).length
            ? meta.categories
            : []
  );

  const serviceNames = uniqStrings(
    activeVisibleServices.length ? activeVisibleServices.map((x) => x.name) : fallbackServices
  );

  const disabledServiceNames = uniqStrings(
    disabledVisibleServices.map((x) => x.name)
  );

  const languages = uniqStrings(
    arr(tenant?.supported_languages).length
      ? tenant.supported_languages
      : arr(tenant?.enabled_languages).length
        ? tenant.enabled_languages
        : arr(profile?.languages).length
          ? profile.languages
          : arr(meta?.languages).length
            ? meta.languages
            : arr(brand?.languages).length
              ? brand.languages
              : [s(tenant?.default_language || "en"), "en"]
  );

  const communicationRules = obj(profile?.communication_rules);
  const tone =
    s(profile?.tone_of_voice) ||
    s(communicationRules?.tone) ||
    s(meta?.tone) ||
    s(brand?.tone) ||
    "professional, warm, concise";

  const maxSentences = Math.max(
    1,
    Math.min(
      3,
      Number(
        communicationRules?.maxSentences ||
          meta?.replyMaxSentences ||
          2
      )
    )
  );

  const leadPrompts = uniqStrings(
    arr(meta?.leadPrompts).length
      ? meta.leadPrompts
      : [
          "Qısa olaraq sizə hansı xidmət və ya məhsul lazım olduğunu yazın.",
          "Uyğun yönləndirmə üçün ehtiyacınızı qısa qeyd edin.",
        ]
  );

  const forbiddenClaims = uniqStrings(
    arr(profile?.banned_phrases).length
      ? profile.banned_phrases
      : arr(meta?.forbiddenClaims).length
        ? meta.forbiddenClaims
        : [
            "Do not invent prices.",
            "Do not promise unavailable features.",
            "Do not guarantee timelines unless known.",
          ]
  );

  const urgentKeywords = uniqStrings(
    arr(inboxPolicy?.urgentKeywords).length
      ? inboxPolicy.urgentKeywords
      : arr(meta?.urgentKeywords).length
        ? meta.urgentKeywords
        : ["urgent", "təcili", "tecili", "asap", "today", "indi", "hemen"]
  );

  const pricingKeywords = uniqStrings(
    arr(inboxPolicy?.pricingKeywords).length
      ? inboxPolicy.pricingKeywords
      : arr(meta?.pricingKeywords).length
        ? meta.pricingKeywords
        : [
            "qiymət",
            "qiymet",
            "price",
            "cost",
            "tarif",
            "paket",
            "neçəyə",
            "neceye",
            "əlaqə nömrəsi",
            "elaqe nomresi",
            "nömrə",
            "nomre",
          ]
  );

  const humanKeywords = uniqStrings(
    arr(inboxPolicy?.humanKeywords).length
      ? inboxPolicy.humanKeywords
      : arr(meta?.humanKeywords).length
        ? meta.humanKeywords
        : [
            "operator",
            "human",
            "canlı",
            "canli",
            "manager",
            "satış",
            "satis",
            "biri ilə danışım",
            "insanla danışım",
          ]
  );

  const supportKeywords = uniqStrings(
    arr(inboxPolicy?.supportKeywords).length
      ? inboxPolicy.supportKeywords
      : arr(meta?.supportKeywords).length
        ? meta.supportKeywords
        : ["problem", "issue", "dəstək", "destek", "support", "help", "kömək", "komek"]
  );

  return {
    tenantKey: resolvedTenantKey,
    displayName,
    industry,
    businessType: "",
    niche: "",
    subNiche: "",
    businessSummary,
    services: serviceNames,
    disabledServices: disabledServiceNames,
    serviceCatalog: normalizedServices,
    knowledgeEntries: [],
    responsePlaybooks: [],
    languages,
    tone,
    toneProfile: "",
    maxSentences,
    leadPrompts,
    forbiddenClaims,
    conversionGoal: "",
    primaryCta: "",
    leadQualificationMode: "",
    qualificationQuestions: [],
    bookingFlowType: "",
    handoffTriggers: [],
    disallowedClaims: [],
    behavior: {},
    channelBehavior: {},
    urgentKeywords,
    pricingKeywords,
    humanKeywords,
    supportKeywords,
    aiPolicy,
    profile,
    tenant,
    threadState: null,
  };
}

export function getRuntimeFactory() {
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

export function normalizeRuntimeResult(rawRuntime, fallback) {
  const container = obj(rawRuntime?.runtime || rawRuntime?.data || rawRuntime);
  const rawTenant = obj(container.tenant);
  const rawProfile = obj(container.profile);
  const rawAiPolicy = obj(container.aiPolicy || container.ai_policy);
  const rawThreadState = obj(container.threadState || container.thread_state || container.state);
  const rawBehavior = obj(container.behavior || container.behavior_json);
  const rawChannelBehavior = obj(
    container.channelBehavior ||
      container.channel_behavior ||
      rawBehavior.channelBehavior ||
      rawBehavior.channel_behavior
  );

  const rawServiceCatalog = arr(container.serviceCatalog).length
    ? arr(container.serviceCatalog)
    : arr(container.servicesDetailed).length
      ? arr(container.servicesDetailed)
      : arr(container.service_catalog);

  const rawKnowledgeEntries = arr(container.knowledgeEntries).length
    ? arr(container.knowledgeEntries)
    : arr(container.knowledge).length
      ? arr(container.knowledge)
      : arr(container.knowledge_entries);

  const rawPlaybooks = arr(container.responsePlaybooks).length
    ? arr(container.responsePlaybooks)
    : arr(container.playbooks).length
      ? arr(container.playbooks)
      : arr(container.response_playbooks);

  const normalizedCatalog = rawServiceCatalog.length
    ? rawServiceCatalog.map(normalizeServiceEntry).filter((x) => x.name)
    : arr(fallback.serviceCatalog);

  const normalizedKnowledge = rawKnowledgeEntries.length
    ? rawKnowledgeEntries
        .map(normalizeKnowledgeEntry)
        .filter((x) => x.active && (x.title || x.answer))
    : arr(fallback.knowledgeEntries);

  const normalizedPlaybooks = rawPlaybooks.length
    ? rawPlaybooks.map(normalizePlaybook).filter((x) => x.active)
    : arr(fallback.responsePlaybooks);

  const activeVisibleServices = normalizedCatalog.filter((x) => x.active && x.visibleInAi);
  const disabledVisibleServices = normalizedCatalog.filter((x) => !x.active && x.visibleInAi);

  const services = uniqStrings(
    arr(container.services).length
      ? arr(container.services)
      : activeVisibleServices.map((x) => x.name)
  );

  const disabledServices = uniqStrings(
    arr(container.disabledServices).length
      ? arr(container.disabledServices)
      : disabledVisibleServices.map((x) => x.name)
  );

  const disallowedClaims = uniqStrings(
    arr(container.disallowedClaims).length
      ? container.disallowedClaims
      : arr(rawBehavior.disallowedClaims).length
        ? rawBehavior.disallowedClaims
        : arr(rawBehavior.disallowed_claims)
  );

  const forbiddenClaims = uniqStrings([
    ...(arr(container.forbiddenClaims).length
      ? container.forbiddenClaims
      : arr(fallback.forbiddenClaims)),
    ...disallowedClaims,
  ]);

  return {
    ...fallback,
    ...container,
    tenant: Object.keys(rawTenant).length ? { ...obj(fallback.tenant), ...rawTenant } : fallback.tenant,
    profile: Object.keys(rawProfile).length ? { ...obj(fallback.profile), ...rawProfile } : fallback.profile,
    aiPolicy: Object.keys(rawAiPolicy).length ? { ...obj(fallback.aiPolicy), ...rawAiPolicy } : fallback.aiPolicy,
    threadState: Object.keys(rawThreadState).length ? rawThreadState : fallback.threadState,
    displayName:
      s(container.displayName) ||
      s(container.companyName) ||
      s(rawProfile.brand_name) ||
      s(rawProfile.displayName) ||
      s(rawTenant.company_name) ||
      s(fallback.displayName),
    industry: normalizeIndustry(
      container.industry ||
        container.industryKey ||
        rawProfile.industry_key ||
        rawTenant.industry_key ||
        fallback.industry
    ),
    businessSummary:
      s(container.businessSummary) ||
      s(container.summary) ||
      s(container.summaryShort) ||
      s(container.valueProposition) ||
      s(fallback.businessSummary),
    businessType: s(
      container.businessType ||
        rawBehavior.businessType ||
        rawBehavior.business_type ||
        fallback.businessType
    ),
    niche: s(container.niche || rawBehavior.niche || fallback.niche),
    subNiche: s(
      container.subNiche ||
        container.sub_niche ||
        rawBehavior.subNiche ||
        rawBehavior.sub_niche ||
        fallback.subNiche
    ),
    serviceCatalog: normalizedCatalog,
    knowledgeEntries: normalizedKnowledge,
    responsePlaybooks: normalizedPlaybooks,
    services: services.length ? services : arr(fallback.services),
    disabledServices: disabledServices.length ? disabledServices : arr(fallback.disabledServices),
    languages: uniqStrings(arr(container.languages).length ? container.languages : arr(fallback.languages)),
    tone: s(container.tone || container.toneText || fallback.tone),
    toneProfile: s(
      container.toneProfile ||
        container.tone_profile ||
        rawBehavior.toneProfile ||
        rawBehavior.tone_profile ||
        fallback.toneProfile
    ),
    maxSentences: Math.max(
      1,
      Math.min(4, Number(container.maxSentences || fallback.maxSentences || 2))
    ),
    leadPrompts: uniqStrings(arr(container.leadPrompts).length ? container.leadPrompts : arr(fallback.leadPrompts)),
    forbiddenClaims,
    conversionGoal: s(
      container.conversionGoal ||
        container.conversion_goal ||
        rawBehavior.conversionGoal ||
        rawBehavior.conversion_goal ||
        fallback.conversionGoal
    ),
    primaryCta: s(
      container.primaryCta ||
        container.primary_cta ||
        rawBehavior.primaryCta ||
        rawBehavior.primary_cta ||
        fallback.primaryCta
    ),
    leadQualificationMode: s(
      container.leadQualificationMode ||
        container.lead_qualification_mode ||
        rawBehavior.leadQualificationMode ||
        rawBehavior.lead_qualification_mode ||
        fallback.leadQualificationMode
    ),
    qualificationQuestions: uniqStrings(
      arr(container.qualificationQuestions).length
        ? container.qualificationQuestions
        : arr(container.qualification_questions).length
          ? container.qualification_questions
          : arr(rawBehavior.qualificationQuestions).length
            ? rawBehavior.qualificationQuestions
            : arr(rawBehavior.qualification_questions).length
              ? rawBehavior.qualification_questions
              : arr(fallback.qualificationQuestions)
    ),
    bookingFlowType: s(
      container.bookingFlowType ||
        container.booking_flow_type ||
        rawBehavior.bookingFlowType ||
        rawBehavior.booking_flow_type ||
        fallback.bookingFlowType
    ),
    handoffTriggers: uniqStrings(
      arr(container.handoffTriggers).length
        ? container.handoffTriggers
        : arr(container.handoff_triggers).length
          ? container.handoff_triggers
          : arr(rawBehavior.handoffTriggers).length
            ? rawBehavior.handoffTriggers
            : arr(rawBehavior.handoff_triggers).length
              ? rawBehavior.handoff_triggers
              : arr(fallback.handoffTriggers)
    ),
    disallowedClaims,
    behavior: Object.keys(rawBehavior).length ? rawBehavior : obj(fallback.behavior),
    channelBehavior: Object.keys(rawChannelBehavior).length
      ? rawChannelBehavior
      : obj(fallback.channelBehavior),
    urgentKeywords: uniqStrings(
      arr(container.urgentKeywords).length ? container.urgentKeywords : arr(fallback.urgentKeywords)
    ),
    pricingKeywords: uniqStrings(
      arr(container.pricingKeywords).length ? container.pricingKeywords : arr(fallback.pricingKeywords)
    ),
    humanKeywords: uniqStrings(
      arr(container.humanKeywords).length ? container.humanKeywords : arr(fallback.humanKeywords)
    ),
    supportKeywords: uniqStrings(
      arr(container.supportKeywords).length ? container.supportKeywords : arr(fallback.supportKeywords)
    ),
  };
}

export async function resolveInboxRuntime({
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
  const fallbackProfile = getTenantBusinessProfile(tenant, tenantKey, services);

  const fallback = {
    ...fallbackProfile,
    tenant,
    tenantKey: getResolvedTenantKey(tenantKey),
    serviceCatalog: arr(fallbackProfile.serviceCatalog),
    knowledgeEntries: arr(knowledgeEntries).map(normalizeKnowledgeEntry).filter((x) => x.active && (x.title || x.answer)),
    responsePlaybooks: arr(responsePlaybooks).map(normalizePlaybook).filter((x) => x.active),
    threadState: threadState || null,
  };

  if (runtime && typeof runtime === "object") {
    return normalizeRuntimeResult(runtime, fallback);
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

    return normalizeRuntimeResult(produced, fallback);
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

export function buildServiceLine(profile) {
  const services = uniqStrings(profile?.services || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

export function buildDisabledServiceLine(profile) {
  const services = uniqStrings(profile?.disabledServices || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

export function pickLeadPrompt(profile) {
  const list = arr(profile?.leadPrompts);
  return s(list[0] || "Qısa olaraq ehtiyacınızı yazın.");
}

export function pickBehaviorLeadPrompt(profile) {
  const qualificationQuestions = arr(profile?.qualificationQuestions)
    .map((x) => s(x))
    .filter(Boolean);
  const inboxBehavior = obj(profile?.channelBehavior?.inbox);
  const primaryCta = s(profile?.primaryCta).replace(/_/g, " ");
  const qualificationDepth = lower(inboxBehavior?.qualificationDepth || "");
  const toneProfile = lower(profile?.toneProfile || "");
  const firstQuestion = s(qualificationQuestions[0]);

  let prompt = pickLeadPrompt(profile);

  if (toneProfile.includes("calm") || toneProfile.includes("reassuring")) {
    prompt = "Daha deqiq komek ucun bir suali cavablandirin.";
  } else if (toneProfile.includes("warm") || toneProfile.includes("hospitable")) {
    prompt = "Sizi duzgun yonlendirmek ucun bunu yazin.";
  } else if (toneProfile.includes("formal") || toneProfile.includes("confident")) {
    prompt = "Duzgun yonlendirme ucun bunu qeyd edin.";
  }

  if (firstQuestion && qualificationDepth === "guided") {
    const ctaLead = primaryCta ? `${primaryCta} ucun ` : "";
    return `${ctaLead}${prompt} ${firstQuestion}`;
  }

  if (primaryCta) {
    return `${primaryCta} ucun ${prompt}`;
  }

  return prompt;
}

export function getIndustryHints(industry) {
  const x = normalizeIndustry(industry);

  const map = {
    clinic: {
      keywords: ["müayinə", "muayine", "implant", "ortodont", "dental", "clinic", "appointment", "randevu"],
      pricingHint: "Qiymət xidmət növü və vəziyyətə görə dəyişə bilər.",
    },
    hospitality: {
      keywords: ["reservation", "booking", "otaq", "room", "hotel", "stay"],
      pricingHint: "Qiymət tarix və xidmət paketinə görə dəyişə bilər.",
    },
    restaurant: {
      keywords: ["menu", "booking", "masa", "rezerv", "delivery", "restaurant"],
      pricingHint: "Qiymət məhsul və sifariş tərkibinə görə dəyişə bilər.",
    },
    legal: {
      keywords: ["məsləhət", "meslehet", "consultation", "law", "legal", "müqavilə", "muqavile", "court"],
      pricingHint: "Qiymət işin növü və mürəkkəbliyinə görə dəyişə bilər.",
    },
    finance: {
      keywords: ["loan", "credit", "investment", "insurance", "finance"],
      pricingHint: "Qiymət və komissiya xidmət növündən asılıdır.",
    },
    education: {
      keywords: ["course", "dərs", "ders", "training", "education", "program"],
      pricingHint: "Qiymət proqram və formatdan asılıdır.",
    },
    ecommerce: {
      keywords: ["product", "məhsul", "mehsul", "shipping", "çatdırılma", "catdirilma", "order"],
      pricingHint: "Qiymət məhsul və çatdırılma şərtlərinə görə dəyişə bilər.",
    },
    technology: {
      keywords: ["software", "saas", "app", "integration", "automation", "website", "xidmət", "xidmet", "whatsapp", "instagram", "bot", "ai", "chatbot", "məhsul", "mehsul"],
      pricingHint: "Qiymət scope və funksionallığa görə dəyişə bilər.",
    },
    creative_agency: {
      keywords: ["branding", "design", "creative", "smm", "content", "campaign"],
      pricingHint: "Qiymət görüləcək işin həcminə görə dəyişə bilər.",
    },
    generic_business: {
      keywords: [],
      pricingHint: "Qiymət xidmət və ya məhsulun növünə görə dəyişə bilər.",
    },
  };

  return map[x] || map.generic_business;
}
