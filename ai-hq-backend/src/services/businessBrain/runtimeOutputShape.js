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

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function readExtraContext(profile = {}) {
  return obj(profile?.extra_context || profile?.extraContext);
}

function normalizeContactType(value = "") {
  const x = s(value).toLowerCase();
  if (!x) return "";

  if (["phone", "mobile", "tel", "call", "telephone"].includes(x)) return "phone";
  if (["whatsapp", "wa"].includes(x)) return "whatsapp";
  if (["telegram", "tg"].includes(x)) return "telegram";
  if (["email", "mail", "e-mail"].includes(x)) return "email";
  if (["website", "site", "web", "url"].includes(x)) return "website";
  if (["instagram", "ig"].includes(x)) return "instagram";
  if (["facebook", "fb", "messenger"].includes(x)) return "facebook";

  return x;
}

function normalizeContactEntry(item) {
  const x = obj(item);

  const type = normalizeContactType(
    x.type ||
      x.contact_type ||
      x.contactType ||
      x.channel ||
      x.kind ||
      ""
  );

  const value = pickFirstString(
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
  );

  if (!s(value)) return null;

  return {
    id: s(x.id || x.contact_id),
    type,
    label: pickFirstString(x.label, x.title, x.name),
    value: s(value),
    primary:
      x.primary === true ||
      x.is_primary === true ||
      x.isPrimary === true,
    public:
      x.public !== false &&
      x.is_public !== false &&
      x.isPublic !== false &&
      x.visible_public !== false &&
      x.visiblePublic !== false &&
      x.visible_in_ai !== false &&
      x.visibleInAi !== false,
    meta: x,
  };
}

function normalizeLocationEntry(item) {
  const x = obj(item);

  const address = pickFirstString(
    x.address,
    x.address_line,
    x.addressLine,
    x.title,
    x.label
  );

  if (!s(address) && !s(x.city)) return null;

  return {
    id: s(x.id || x.location_id),
    title: pickFirstString(x.title, x.label, address),
    address: s(address),
    city: s(x.city),
    region: s(x.region),
    country: s(x.country),
    primary:
      x.primary === true ||
      x.is_primary === true ||
      x.isPrimary === true,
    meta: x,
  };
}

function dedupeContacts(list = []) {
  const seen = new Set();
  const out = [];

  for (const raw of arr(list)) {
    const item = normalizeContactEntry(raw);
    if (!item?.value) continue;

    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function dedupeLocations(list = []) {
  const seen = new Set();
  const out = [];

  for (const raw of arr(list)) {
    const item = normalizeLocationEntry(raw);
    if (!item) continue;

    const key = JSON.stringify([
      item.address.toLowerCase(),
      item.city.toLowerCase(),
      item.title.toLowerCase(),
    ]);

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function toStringList(...sources) {
  const out = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      for (const item of source) {
        const text =
          typeof item === "string"
            ? s(item)
            : s(
                item?.value ||
                  item?.url ||
                  item?.address ||
                  item?.addressLine ||
                  item?.address_line ||
                  item?.title
              );
        if (text) out.push(text);
      }
      continue;
    }

    const text = s(source);
    if (text) out.push(text);
  }

  return uniqStrings(out);
}

function listContactValues(list = [], types = []) {
  const wanted = new Set(arr(types).map((x) => normalizeContactType(x)));

  return uniqStrings(
    arr(list)
      .filter((item) => wanted.has(normalizeContactType(item?.type)))
      .filter((item) => item?.public !== false)
      .map((item) => s(item?.value))
      .filter(Boolean)
  );
}

function listLocationAddresses(list = []) {
  return uniqStrings(
    arr(list)
      .map((item) => s(item?.address))
      .filter(Boolean)
  );
}

function pickPrimaryContactValue(list = [], types = []) {
  const wanted = new Set(arr(types).map((x) => normalizeContactType(x)));

  const primary = arr(list).find(
    (item) =>
      wanted.has(normalizeContactType(item?.type)) &&
      item?.public !== false &&
      item?.primary === true &&
      s(item?.value)
  );
  if (primary?.value) return s(primary.value);

  const firstPublic = arr(list).find(
    (item) =>
      wanted.has(normalizeContactType(item?.type)) &&
      item?.public !== false &&
      s(item?.value)
  );
  if (firstPublic?.value) return s(firstPublic.value);

  return "";
}

function buildRuntimeOutput({
  tenant,
  services,
  knowledgeEntries,
  responsePlaybooks,
  threadState = null,
  authority = null,
  policyControls = {},
  raw = {},
}) {
  const profile = obj(tenant?.profile);
  const aiPolicy = obj(tenant?.ai_policy);
  const inboxPolicy = obj(tenant?.inbox_policy);
  const commentPolicy = obj(tenant?.comment_policy);
  const normalizedPolicyControls = obj(
    policyControls || tenant?.policy_controls || tenant?.policyControls
  );
  const meta = obj(tenant?.meta);
  const normalizedServices = (Array.isArray(services) ? services : [])
    .map((item, idx) => normalizeServiceEntry(item, idx))
    .filter((x) => x.title);
  const normalizedKnowledgeEntries = dedupeKnowledgeEntries(knowledgeEntries, tenant);
  const normalizedResponsePlaybooks = dedupePlaybooks(responsePlaybooks, tenant);
  const behavior = obj(raw?.behavior || raw?.behavior_json || raw?.projection?.behavior_json);
  const projection = obj(raw?.projection);
  const projectionIdentity = obj(projection?.identity_json);
  const projectionProfile = obj(projection?.profile_json);
  const projectionCapabilities = obj(projection?.capabilities_json);
  const projectionContent = obj(projection?.content_json);
  const projectionComments = obj(projection?.comments_json);
  const activeVisibleServices = normalizedServices.filter((x) => x.enabled && x.visibleInAi);
  const disabledVisibleServices = normalizedServices.filter((x) => !x.enabled || !x.visibleInAi);
  const displayName =
    s(projectionIdentity.displayName) ||
    s(projectionProfile.displayName) ||
    s(projectionProfile.companyName) ||
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
    s(projectionProfile.summaryShort) ||
      s(projectionProfile.summaryLong) ||
      s(projectionProfile.valueProposition) ||
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
      Number(
        projectionComments.maxReplySentences ||
          profile?.communication_rules?.maxSentences ||
          inboxPolicy?.max_reply_sentences ||
          2
      )
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

  const extraContext = readExtraContext(profile);

  const contacts = dedupeContacts([
    ...arr(tenant?.contacts),
    ...arr(meta?.contacts),
    ...arr(extraContext?.contacts),
    ...arr(raw?.contacts),
    ...arr(projection?.contacts_json),

    ...toStringList(
      tenant?.primaryPhone,
      tenant?.publicPhone,
      profile?.public_phone,
      projectionProfile?.primaryPhone
    ).map((value) => ({
      type: "phone",
      value,
      primary: true,
      public: true,
    })),

    ...toStringList(
      tenant?.primaryEmail,
      tenant?.publicEmail,
      profile?.public_email,
      projectionProfile?.primaryEmail
    ).map((value) => ({
      type: "email",
      value,
      primary: true,
      public: true,
    })),

    ...toStringList(
      tenant?.websiteUrl,
      profile?.website_url,
      projectionProfile?.websiteUrl
    ).map((value) => ({
      type: "website",
      value,
      primary: true,
      public: true,
    })),
  ]);

  const locations = dedupeLocations([
    ...arr(tenant?.locations),
    ...arr(meta?.locations),
    ...arr(extraContext?.locations),
    ...arr(raw?.locations),
    ...arr(projection?.locations_json),

    ...toStringList(
      tenant?.primaryAddress,
      profile?.primary_address,
      projectionProfile?.primaryAddress
    ).map((value) => ({
      address: value,
      primary: true,
    })),
  ]);

  const primaryPhone = pickFirstString(
    tenant?.primaryPhone,
    tenant?.publicPhone,
    profile?.public_phone,
    projectionProfile?.primaryPhone,
    pickPrimaryContactValue(contacts, ["phone", "whatsapp"])
  );

  const primaryEmail = pickFirstString(
    tenant?.primaryEmail,
    tenant?.publicEmail,
    profile?.public_email,
    projectionProfile?.primaryEmail,
    pickPrimaryContactValue(contacts, ["email"])
  );

  const websiteUrl = pickFirstString(
    tenant?.websiteUrl,
    profile?.website_url,
    projectionProfile?.websiteUrl,
    pickPrimaryContactValue(contacts, ["website"])
  );

  const primaryAddress = pickFirstString(
    projectionProfile?.primaryAddress,
    tenant?.primaryAddress,
    profile?.primary_address,
    arr(locations).find((item) => item?.primary && s(item?.address))?.address,
    arr(locations).find((item) => s(item?.address))?.address
  );

  const contactPhones = uniqStrings([
    primaryPhone,
    ...toStringList(tenant?.contactPhones, meta?.contactPhones, profile?.contact_phones),
    ...listContactValues(contacts, ["phone", "whatsapp"]),
  ]);

  const contactEmails = uniqStrings([
    primaryEmail,
    ...toStringList(tenant?.contactEmails, meta?.contactEmails, profile?.contact_emails),
    ...listContactValues(contacts, ["email"]),
  ]);

  const contactAddresses = uniqStrings([
    primaryAddress,
    ...toStringList(
      tenant?.contactAddresses,
      meta?.contactAddresses,
      profile?.contact_addresses
    ),
    ...listLocationAddresses(locations),
  ]);

  const websiteUrls = uniqStrings([
    websiteUrl,
    ...toStringList(
      tenant?.websiteUrls,
      meta?.websiteUrls,
      extraContext?.websiteUrls
    ),
    ...listContactValues(contacts, ["website"]),
  ]);

  const bookingLinks = uniqStrings([
    ...toStringList(
      tenant?.bookingLinks,
      meta?.bookingLinks,
      extraContext?.bookingLinks,
      projection?.booking_links_json
    ),
  ]);

  const socialLinks = uniqStrings([
    ...toStringList(
      tenant?.socialLinks,
      meta?.socialLinks,
      extraContext?.socialLinks,
      projection?.social_links_json
    ),
  ]);

  return {
    tenantKey: s(tenant?.tenant_key),
    tenantId: s(tenant?.id),
    displayName,
    brandName: displayName,
    companyName: s(projectionProfile.companyName || projectionIdentity.companyName || tenant?.company_name || displayName),
    companySummaryShort: compactText(
      s(profile.brand_summary) || s(profile.value_proposition) || businessSummary,
      500
    ),
    companySummaryLong: compactText(businessSummary || s(profile.brand_summary), 1800),
    businessType: s(behavior.businessType || behavior.niche || tenant?.industry_key),
    niche: s(behavior.niche || behavior.businessType || tenant?.industry_key),
    subNiche: s(behavior.subNiche || behavior.sub_niche),
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
    conversionGoal: s(behavior.conversionGoal || behavior.conversion_goal),
    primaryCta: s(behavior.primaryCta || behavior.primary_cta || preferredCta),
    leadQualificationMode: s(
      behavior.leadQualificationMode || behavior.lead_qualification_mode
    ),
    qualificationQuestions: flattenStringList(
      behavior.qualificationQuestions,
      behavior.qualification_questions
    ),
    bookingFlowType: s(behavior.bookingFlowType || behavior.booking_flow_type),
    handoffTriggers: flattenStringList(
      behavior.handoffTriggers,
      behavior.handoff_triggers
    ),
    disallowedClaims: flattenStringList(
      behavior.disallowedClaims,
      behavior.disallowed_claims
    ),

    // CRITICAL: expose contact truth into live runtime
    primaryPhone,
    publicPhone: primaryPhone,
    primaryEmail,
    publicEmail: primaryEmail,
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

    behavior,
    channelBehavior: obj(behavior.channelBehavior || behavior.channel_behavior),
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
    policyControls: normalizedPolicyControls,
    profile,
    tenant,
    authority: authority && typeof authority === "object" ? authority : null,
    threadState: threadState || null,
    raw: {
      ...obj(raw),
      authority: authority && typeof authority === "object" ? authority : null,
      behavior,
      policyControls: normalizedPolicyControls,
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
    primaryPhone: "",
    publicPhone: "",
    primaryEmail: "",
    publicEmail: "",
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