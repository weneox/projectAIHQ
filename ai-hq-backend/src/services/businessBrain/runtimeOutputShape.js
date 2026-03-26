import {
  dedupeKnowledgeEntries,
  dedupePlaybooks,
  normalizeServiceEntry,
} from "./runtimeCatalog.js";
import {
  compactText,
  flattenStringList,
  getDefaultLeadPrompt,
  normalizeIndustry,
  normalizeLanguage,
  normalizeLanguageList,
  obj,
  s,
  splitTextList,
  uniqStrings,
} from "./runtimeShared.js";
import { buildRuntimeAuthority } from "./runtimeAuthority.js";

function buildRuntimeOutput({
  tenant,
  services,
  knowledgeEntries,
  responsePlaybooks,
  threadState = null,
  authority = null,
  raw = {},
}) {
  const profile = obj(tenant?.profile);
  const aiPolicy = obj(tenant?.ai_policy);
  const inboxPolicy = obj(tenant?.inbox_policy);
  const commentPolicy = obj(tenant?.comment_policy);
  const meta = obj(tenant?.meta);
  const normalizedServices = (Array.isArray(services) ? services : [])
    .map((item, idx) => normalizeServiceEntry(item, idx))
    .filter((x) => x.title);
  const normalizedKnowledgeEntries = dedupeKnowledgeEntries(knowledgeEntries, tenant);
  const normalizedResponsePlaybooks = dedupePlaybooks(responsePlaybooks, tenant);
  const activeVisibleServices = normalizedServices.filter((x) => x.enabled && x.visibleInAi);
  const disabledVisibleServices = normalizedServices.filter((x) => !x.enabled || !x.visibleInAi);
  const displayName =
    s(profile.brand_name) ||
    s(tenant?.brand?.displayName) ||
    s(tenant?.company_name) ||
    s(tenant?.tenant_key);
  const defaultLanguage = normalizeLanguage(s(tenant?.default_language || "az"), "az");
  const languages = normalizeLanguageList(
    tenant?.supported_languages,
    tenant?.enabled_languages,
    defaultLanguage
  );
  const servicesList = uniqStrings([
    ...activeVisibleServices.map((x) => x.title),
    ...flattenStringList(meta.services),
    ...splitTextList(profile.services_summary),
  ]);
  const disabledServicesList = uniqStrings(disabledVisibleServices.map((x) => x.title));
  const businessSummary = compactText(
    s(meta.businessSummary) ||
      s(aiPolicy.businessContext) ||
      s(profile.brand_summary) ||
      s(profile.value_proposition) ||
      s(profile.services_summary),
    1400
  );
  const tone = s(profile.tone_of_voice) || s(aiPolicy.toneText) || "professional, warm, concise";
  const preferredCta = s(profile.preferred_cta) || s(meta.preferredCta);
  const maxSentences = Math.max(
    1,
    Math.min(
      4,
      Number(profile?.communication_rules?.maxSentences || inboxPolicy?.max_reply_sentences || 2)
    )
  );
  const leadPrompts = uniqStrings([
    ...flattenStringList(meta.leadPrompts),
    getDefaultLeadPrompt(defaultLanguage),
  ]);
  const bannedPhrases = uniqStrings([...flattenStringList(profile.banned_phrases)]);
  const urgentKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.urgentKeywords, meta.urgentKeywords),
    "urgent",
    "tecili",
    "asap",
    "indi",
    "hemen",
  ]);
  const pricingKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.pricingKeywords, meta.pricingKeywords),
    "qiymet",
    "price",
    "cost",
    "tarif",
    "paket",
    "neceye",
    "nomre",
    "elaqe",
  ]);
  const humanKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.humanKeywords, meta.humanKeywords),
    "operator",
    "human",
    "canli",
    "manager",
    "satis",
  ]);
  const supportKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.supportKeywords, meta.supportKeywords),
    "problem",
    "issue",
    "destek",
    "support",
    "help",
    "komek",
  ]);

  return {
    tenantKey: s(tenant?.tenant_key),
    tenantId: s(tenant?.id),
    displayName,
    brandName: displayName,
    companyName: s(tenant?.company_name || displayName),
    companySummaryShort: compactText(
      s(profile.brand_summary) || s(profile.value_proposition) || businessSummary,
      500
    ),
    companySummaryLong: compactText(businessSummary || s(profile.brand_summary), 1800),
    industry: normalizeIndustry(tenant?.industry_key),
    industryKey: normalizeIndustry(tenant?.industry_key),
    businessSummary,
    businessContext: businessSummary,
    services: servicesList,
    disabledServices: disabledServicesList,
    serviceCatalog: normalizedServices,
    knowledgeEntries: normalizedKnowledgeEntries,
    responsePlaybooks: normalizedResponsePlaybooks,
    languages,
    defaultLanguage,
    outputLanguage: defaultLanguage,
    language: defaultLanguage,
    tone,
    toneText: tone,
    preferredCta,
    maxSentences,
    leadPrompts,
    bannedPhrases,
    forbiddenClaims: bannedPhrases,
    urgentKeywords,
    pricingKeywords,
    humanKeywords,
    supportKeywords,
    autoReplyEnabled:
      typeof aiPolicy.auto_reply_enabled === "boolean" ? aiPolicy.auto_reply_enabled : true,
    createLeadEnabled:
      typeof aiPolicy.create_lead_enabled === "boolean" ? aiPolicy.create_lead_enabled : true,
    aiPolicy,
    inboxPolicy,
    commentPolicy,
    profile,
    tenant,
    authority: authority && typeof authority === "object" ? authority : null,
    threadState: threadState || null,
    raw: {
      ...obj(raw),
      authority: authority && typeof authority === "object" ? authority : null,
      services,
      knowledgeEntries,
      responsePlaybooks,
    },
  };
}

function buildUnresolvedTenantFallback({
  authorityMode,
  tenantIdInput = "",
  fallbackKey = "",
  input,
}) {
  const fallbackLanguage = "az";
  return {
    tenantKey: fallbackKey,
    tenantId: s(tenantIdInput),
    displayName: fallbackKey,
    brandName: fallbackKey,
    companyName: fallbackKey,
    companySummaryShort: "",
    companySummaryLong: "",
    industry: "generic_business",
    industryKey: "generic_business",
    businessSummary: "",
    businessContext: "",
    services: [],
    disabledServices: [],
    serviceCatalog: [],
    knowledgeEntries: [],
    responsePlaybooks: [],
    languages: [fallbackLanguage],
    defaultLanguage: fallbackLanguage,
    outputLanguage: fallbackLanguage,
    language: fallbackLanguage,
    tone: "professional, warm, concise",
    toneText: "professional, warm, concise",
    preferredCta: "",
    maxSentences: 2,
    leadPrompts: [getDefaultLeadPrompt(fallbackLanguage)],
    bannedPhrases: [],
    forbiddenClaims: [],
    urgentKeywords: [],
    pricingKeywords: [],
    humanKeywords: [],
    supportKeywords: [],
    autoReplyEnabled: true,
    createLeadEnabled: true,
    aiPolicy: {},
    inboxPolicy: {},
    commentPolicy: {},
    profile: {},
    tenant: null,
    authority: buildRuntimeAuthority({
      mode: authorityMode,
      available: false,
      tenantId: tenantIdInput,
      tenantKey: fallbackKey,
      reasonCode: "tenant_not_resolved",
      reason: "tenant_not_resolved",
    }),
    threadState: input?.threadState || null,
    raw: {
      mode: "fallback_empty",
      businessProfile: null,
      capabilities: null,
      facts: [],
      contacts: [],
      locations: [],
      channelPolicies: [],
      activeKnowledge: [],
      tenantServices: [],
      storedResponsePlaybooks: [],
    },
  };
}

export {
  buildRuntimeOutput,
  buildUnresolvedTenantFallback,
};
