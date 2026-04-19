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

export function normalizeIndustry(value) {
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

function normalizeStringList(value = []) {
  return uniqStrings(arr(value).map((item) => s(item)).filter(Boolean));
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function normalizePriority(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function normalizeLanguageList(...sources) {
  const values = [];
  for (const source of sources) values.push(...arr(source));
  const normalized = normalizeStringList(values);
  return normalized.length ? normalized : ["az"];
}

function normalizeQualificationQuestions(...sources) {
  const values = [];
  for (const source of sources) values.push(...arr(source));
  return normalizeStringList(values);
}

function normalizeBehaviorObject(...sources) {
  for (const source of sources) {
    const safe = obj(source);
    if (Object.keys(safe).length) return safe;
  }
  return {};
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

export function normalizeServiceEntry(item) {
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

  const aliases = normalizeStringList([
    ...arr(x.aliases),
    ...arr(x.keywords),
    ...arr(x.synonyms),
    ...arr(x.example_requests),
  ]);

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

export function normalizeKnowledgeEntry(item) {
  const x = obj(item);

  const title = pickFirstString(x.title, x.question, x.name);
  const answer = pickFirstString(
    x.answer,
    x.content,
    x.text,
    x.body,
    x.description
  );

  const keywords = normalizeStringList([
    ...arr(x.keywords),
    ...arr(x.aliases),
    s(x.question),
    s(x.title),
  ]);

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
    language: s(x.language || "az"),
    priority: normalizePriority(x.priority, 100),
    meta: x,
  };
}

export function normalizePlaybook(item) {
  const x = obj(item);

  const triggerKeywords = normalizeStringList([
    ...arr(x.triggerKeywords),
    ...arr(x.triggers),
    ...arr(x.keywords),
    s(x.user_example),
    s(x.intent_key),
    s(x.service_key),
  ]);

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
    language: s(x.language || "az"),
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

export function getTenantBusinessProfile(tenant, tenantKey, services = []) {
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
      [safeTenant?.default_language || "az", "en"]
    ),
    tone: behavior.tone,
    toneProfile: behavior.toneProfile,
    formality: behavior.formality,
    warmth: behavior.warmth,
    brevity: behavior.brevity,
    emojiPolicy: behavior.emojiPolicy,
    maxSentences: behavior.maxSentences,
    leadPrompts: behavior.leadPrompts,
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
    primaryCta: pickFirstString(
      profile?.primary_cta,
      meta?.primaryCta,
      meta?.primary_cta
    ),
    leadQualificationMode: pickFirstString(
      profile?.lead_qualification_mode,
      meta?.leadQualificationMode,
      meta?.lead_qualification_mode
    ),
    qualificationQuestions: normalizeQualificationQuestions(
      profile?.qualificationQuestions,
      profile?.qualification_questions,
      meta?.qualificationQuestions,
      meta?.qualification_questions
    ),
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
    languages: ["az"],
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

export function normalizeRuntimeResult(rawRuntime, fallback, options = {}) {
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

  const resolvedBehavior = resolveBehaviorProfile({
    industry: effectiveIndustry,
    tenant: strictAuthority ? rawTenant : { ...obj(fallback.tenant), ...rawTenant },
    profile: strictAuthority ? rawProfile : { ...obj(fallback.profile), ...rawProfile },
    meta: obj(rawTenant?.meta),
    runtimeBehavior: rawBehavior,
    runtimeChannelBehavior: rawChannelBehavior,
    fallbackBehavior: obj(fallback.behavior),
    fallbackChannelBehavior: obj(fallback.channelBehavior),
  });

  return {
    ...fallback,
    ...container,
    tenant: Object.keys(rawTenant).length
      ? strictAuthority
        ? rawTenant
        : { ...obj(fallback.tenant), ...rawTenant }
      : fallback.tenant,
    profile: Object.keys(rawProfile).length
      ? strictAuthority
        ? rawProfile
        : { ...obj(fallback.profile), ...rawProfile }
      : fallback.profile,
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
      rawProfile.brand_name,
      rawProfile.displayName,
      rawTenant.company_name,
      fallback.displayName
    ),
    industry: effectiveIndustry,
    businessSummary: pickFirstString(
      container.businessSummary,
      container.summary,
      container.summaryShort,
      container.valueProposition,
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
    tone: resolvedBehavior.tone,
    toneProfile: resolvedBehavior.toneProfile,
    formality: resolvedBehavior.formality,
    warmth: resolvedBehavior.warmth,
    brevity: resolvedBehavior.brevity,
    emojiPolicy: resolvedBehavior.emojiPolicy,
    maxSentences: resolvedBehavior.maxSentences,
    leadPrompts: resolvedBehavior.leadPrompts,
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
    primaryCta: pickFirstString(
      container.primaryCta,
      container.primary_cta,
      rawBehavior.primaryCta,
      rawBehavior.primary_cta,
      fallback.primaryCta
    ),
    leadQualificationMode: pickFirstString(
      container.leadQualificationMode,
      container.lead_qualification_mode,
      rawBehavior.leadQualificationMode,
      rawBehavior.lead_qualification_mode,
      fallback.leadQualificationMode
    ),
    qualificationQuestions: normalizeQualificationQuestions(
      container.qualificationQuestions,
      container.qualification_questions,
      strictAuthority ? [] : fallback.qualificationQuestions
    ),
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

export function buildServiceLine(profile) {
  const services = normalizeStringList(profile?.services || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

export function buildDisabledServiceLine(profile) {
  const services = normalizeStringList(profile?.disabledServices || []);
  if (!services.length) return "";
  return services.slice(0, 12).join(", ");
}

export function pickLeadPrompt(profile) {
  const list = normalizeStringList(profile?.leadPrompts || []);
  return s(list[0] || "Əsas ehtiyacınızı bir cümlə ilə yaza bilərsiniz?");
}

export function pickBehaviorLeadPrompt(profile) {
  const qualificationQuestions = normalizeQualificationQuestions(
    profile?.qualificationQuestions
  );
  const resolvedBehavior = obj(profile?.behavior);
  const inboxBehavior = obj(
    profile?.channelBehavior?.inbox || resolvedBehavior?.channelBehavior?.inbox
  );
  const primaryCta = s(profile?.primaryCta).replace(/_/g, " ");
  const qualificationDepth = lower(inboxBehavior?.qualificationDepth || "");
  const toneProfile = lower(profile?.toneProfile || resolvedBehavior?.toneProfile || "");
  const firstQuestion = s(qualificationQuestions[0]);

  let prompt = pickLeadPrompt(profile);

  if (toneProfile.includes("calm") || toneProfile.includes("reassuring")) {
    prompt = "Daha dəqiq kömək üçün bir qısa sualı cavablandıra bilərsiniz.";
  } else if (toneProfile.includes("warm") || toneProfile.includes("welcoming")) {
    prompt = "Sizi düzgün yönləndirmək üçün bunu qısa yazın.";
  } else if (toneProfile.includes("formal") || toneProfile.includes("confident")) {
    prompt = "Düzgün yönləndirmə üçün bunu qeyd edin.";
  }

  if (firstQuestion && qualificationDepth === "guided") {
    const ctaLead = primaryCta ? `${primaryCta} üçün ` : "";
    return sanitizePrompt(`${ctaLead}${prompt} ${firstQuestion}`);
  }

  if (primaryCta) {
    return sanitizePrompt(`${primaryCta} üçün ${prompt}`);
  }

  return sanitizePrompt(prompt);
}

function sanitizePrompt(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

/**
 * Compatibility helper only.
 * Industry hints should not drive understanding logic anymore.
 */
export function getIndustryHints(industry) {
  const normalized = normalizeIndustry(industry);

  const map = {
    clinic: {
      keywords: [],
      pricingHint: "Qiymət xidmət növü və vəziyyətə görə dəyişə bilər.",
    },
    hospitality: {
      keywords: [],
      pricingHint: "Qiymət tarix və xidmət paketinə görə dəyişə bilər.",
    },
    restaurant: {
      keywords: [],
      pricingHint: "Qiymət xidmət və tələblərə görə dəyişə bilər.",
    },
    legal: {
      keywords: [],
      pricingHint: "Qiymət işin növü və mürəkkəbliyinə görə dəyişə bilər.",
    },
    finance: {
      keywords: [],
      pricingHint: "Qiymət və komissiya xidmət növündən asılıdır.",
    },
    education: {
      keywords: [],
      pricingHint: "Qiymət proqram və formatdan asılıdır.",
    },
    ecommerce: {
      keywords: [],
      pricingHint: "Qiymət məhsul və çatdırılma şərtlərinə görə dəyişə bilər.",
    },
    technology: {
      keywords: [],
      pricingHint: "Qiymət scope və funksionallığa görə dəyişə bilər.",
    },
    creative_agency: {
      keywords: [],
      pricingHint: "Qiymət görüləcək işin həcminə görə dəyişə bilər.",
    },
    generic_business: {
      keywords: [],
      pricingHint: "Qiymət xidmət və ya məhsulun növünə görə dəyişə bilər.",
    },
  };

  return map[normalized] || map.generic_business;
}