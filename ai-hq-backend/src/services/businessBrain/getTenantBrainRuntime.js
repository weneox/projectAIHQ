// src/services/businessBrain/getTenantBrainRuntime.js
// FINAL v3.0 — projection-first business runtime with safe fallback

import { resolveTenantKey } from "../../tenancy/index.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";
import {
  dbListTenantBusinessFacts,
  dbListTenantContacts,
  dbListTenantLocations,
  dbListTenantChannelPolicies,
} from "../../db/helpers/tenantBusinessBrain.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
  refreshTenantRuntimeProjectionStrict,
} from "../../db/helpers/tenantRuntimeProjection.js";

function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function boolOrUndefined(v) {
  return typeof v === "boolean" ? v : undefined;
}

function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const k = lower(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }

  return out;
}

function compactText(v = "", max = 1200) {
  const x = s(v).replace(/\s+/g, " ").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1).trim()}…`;
}

function lowerSlug(v = "") {
  return s(v)
    .toLowerCase()
    .replace(/[^a-z0-9əğıöşüç_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function splitTextList(v = "") {
  const x = s(v);
  if (!x) return [];
  return uniqStrings(
    x
      .split(/[,\n|/]+/)
      .map((item) => s(item))
      .filter(Boolean)
  );
}

function flattenStringList(...values) {
  const out = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          out.push(item);
        } else if (item && typeof item === "object") {
          out.push(
            s(
              item.title ||
                item.name ||
                item.label ||
                item.value ||
                item.valueText ||
                item.service_name ||
                item.service_key ||
                item.serviceKey ||
                item.item_key ||
                item.itemKey ||
                item.key ||
                item.language ||
                item.code
            )
          );
        }
      }
      continue;
    }

    if (typeof value === "string") {
      out.push(...splitTextList(value));
    }
  }

  return uniqStrings(out);
}

async function safeQuery(fn, fallback) {
  try {
    const result = await fn();
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeIndustry(v) {
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

function normalizeLanguage(v, fallback = "az") {
  const x = lower(v);
  if (!x) return fallback;
  if (["az", "aze", "azerbaijani"].includes(x)) return "az";
  if (["en", "eng", "english"].includes(x)) return "en";
  if (["ru", "rus", "russian"].includes(x)) return "ru";
  if (["tr", "tur", "turkish"].includes(x)) return "tr";
  return fallback;
}

function normalizeLanguageList(...values) {
  const out = [];
  const seen = new Set();

  for (const item of flattenStringList(...values)) {
    const code = normalizeLanguage(item, "");
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }

  if (!out.length) return ["az"];
  return out;
}

function getDefaultLeadPrompt(language = "az") {
  const lang = normalizeLanguage(language, "az");

  if (lang === "en") {
    return "Briefly tell us which service or product you need.";
  }

  if (lang === "ru") {
    return "Коротко напишите, какая услуга или продукт вам нужны.";
  }

  if (lang === "tr") {
    return "Kısaca hangi hizmete veya ürüne ihtiyacınız olduğunu yazın.";
  }

  return "Qısa olaraq sizə hansı xidmət və ya məhsul lazım olduğunu yazın.";
}

function parseDateMs(v) {
  const ms = Date.parse(s(v));
  return Number.isFinite(ms) ? ms : 0;
}

function sortRowsByPriority(list = []) {
  return [...arr(list)].sort((a, b) => {
    const ap = Number(a?.priority ?? 100);
    const bp = Number(b?.priority ?? 100);
    if (ap !== bp) return ap - bp;

    const aso = Number(a?.sort_order ?? a?.sortOrder ?? 0);
    const bso = Number(b?.sort_order ?? b?.sortOrder ?? 0);
    if (aso !== bso) return aso - bso;

    return parseDateMs(a?.created_at) - parseDateMs(b?.created_at);
  });
}

function isHydratedTenant(input) {
  const tenant = obj(input);
  return Boolean(
    Object.keys(obj(tenant.profile)).length ||
      Object.keys(obj(tenant.brand)).length ||
      Object.keys(obj(tenant.ai_policy || tenant.aiPolicy)).length ||
      Object.keys(obj(tenant.inbox_policy || tenant.inboxPolicy)).length ||
      Object.keys(obj(tenant.comment_policy || tenant.commentPolicy)).length
  );
}

function normalizeProvidedTenant(input = {}) {
  const tenant = obj(input);

  const defaultLanguage = normalizeLanguage(
    tenant.default_language || tenant.defaultLanguage || tenant.language || "az",
    "az"
  );

  const supportedLanguages = normalizeLanguageList(
    tenant.supported_languages,
    tenant.enabled_languages,
    tenant.brand?.languages,
    tenant.profile?.supported_languages,
    tenant.profile?.languages,
    defaultLanguage
  );

  const displayName =
    s(tenant?.profile?.brand_name) ||
    s(tenant?.brand?.displayName) ||
    s(tenant?.brand?.name) ||
    s(tenant.company_name) ||
    s(tenant.companyName) ||
    s(tenant.tenant_key) ||
    s(tenant.tenantKey);

  return {
    ...tenant,
    id: s(tenant.id || tenant.tenant_id),
    tenant_key: s(tenant.tenant_key || tenant.tenantKey),
    company_name: s(tenant.company_name || tenant.companyName || displayName),
    legal_name: s(tenant.legal_name || tenant.legalName),
    industry_key: s(tenant.industry_key || tenant.industryKey || "generic_business"),
    country_code: s(tenant.country_code || tenant.countryCode || "AZ"),
    timezone: s(tenant.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,
    market_region: s(tenant.market_region || tenant.marketRegion),
    plan_key: s(tenant.plan_key || tenant.planKey),
    status: s(tenant.status),
    active: typeof tenant.active === "boolean" ? tenant.active : true,

    profile: {
      brand_name: s(tenant?.profile?.brand_name || displayName),
      website_url: s(tenant?.profile?.website_url),
      public_email: s(tenant?.profile?.public_email),
      public_phone: s(tenant?.profile?.public_phone),
      audience_summary: s(tenant?.profile?.audience_summary),
      services_summary: s(tenant?.profile?.services_summary),
      value_proposition: s(tenant?.profile?.value_proposition),
      brand_summary: s(tenant?.profile?.brand_summary),
      tone_of_voice: s(tenant?.profile?.tone_of_voice),
      preferred_cta: s(tenant?.profile?.preferred_cta),
      banned_phrases: arr(tenant?.profile?.banned_phrases),
      communication_rules: obj(tenant?.profile?.communication_rules),
      visual_style: obj(tenant?.profile?.visual_style),
      extra_context: obj(tenant?.profile?.extra_context),
    },

    brand: {
      name: displayName,
      displayName,
      tone: s(tenant?.brand?.tone || tenant?.profile?.tone_of_voice),
      industry: s(tenant?.brand?.industry || tenant.industry_key || "generic_business"),
      defaultLanguage,
      languages: supportedLanguages,
    },

    ai_policy: obj(tenant.ai_policy || tenant.aiPolicy),
    inbox_policy: obj(tenant.inbox_policy || tenant.inboxPolicy),
    comment_policy: obj(tenant.comment_policy || tenant.commentPolicy),
    meta: obj(tenant.meta),
  };
}

function normalizeServiceEntry(item, idx = 0) {
  const x = obj(item);

  const enabled =
    typeof x.enabled === "boolean"
      ? x.enabled
      : typeof x.active === "boolean"
        ? x.active
        : typeof x.is_active === "boolean"
          ? x.is_active
          : typeof x.isActive === "boolean"
            ? x.isActive
            : true;

  const visibleInAi =
    typeof x.visible_in_ai === "boolean"
      ? x.visible_in_ai
      : typeof x.visibleInAi === "boolean"
        ? x.visibleInAi
        : true;

  const title =
    s(x.title) ||
    s(x.name) ||
    s(x.service_name) ||
    s(x.serviceName) ||
    s(x.label);

  const serviceKey =
    s(x.service_key) ||
    s(x.serviceKey) ||
    s(x.key) ||
    s(x.slug) ||
    s(x.item_key) ||
    s(x.itemKey) ||
    lowerSlug(title) ||
    `service-${idx + 1}`;

  return {
    id: s(x.id || `runtime-service-${idx + 1}`),
    tenant_id: s(x.tenant_id || x.tenantId || ""),
    service_key: serviceKey,
    title,
    name: title,
    enabled: Boolean(enabled),
    active: Boolean(enabled),
    sellable: typeof x.sellable === "boolean" ? x.sellable : true,
    visible_in_ai: Boolean(visibleInAi),
    visibleInAi: Boolean(visibleInAi),
    category: s(x.category || "general"),
    description_short: s(x.description_short || x.descriptionShort || x.description || x.summary),
    description_full: s(x.description_full || x.descriptionFull || x.details || x.description),
    keywords: uniqStrings(flattenStringList(x.keywords, x.aliases, x.synonyms)),
    synonyms: uniqStrings(flattenStringList(x.synonyms, x.aliases)),
    example_requests: uniqStrings(
      flattenStringList(
        x.example_requests,
        x.exampleRequests,
        x.highlights_json,
        x.highlights
      )
    ),
    pricing_mode: s(x.pricing_mode || x.pricingModel || "quote_required"),
    contact_capture_mode: s(x.contact_capture_mode || x.contactCaptureMode || "optional"),
    handoff_mode: s(x.handoff_mode || x.handoffMode || "optional"),
    response_mode: s(x.response_mode || x.responseMode || "template"),
    faq_answer: s(x.faq_answer || x.faqAnswer),
    disabled_reply_text: s(x.disabled_reply_text || x.disabledReplyText),
    sort_order: Number(x.sort_order ?? x.sortOrder ?? idx),
    meta: obj(x.meta, x.metadata, x),
  };
}

function normalizeKnowledgeEntry(item, idx = 0, tenant = null) {
  const x = obj(item);
  const valueJson = obj(x.value_json || x.valueJson);

  const title =
    s(x.title) ||
    s(x.question) ||
    s(valueJson.question) ||
    s(x.name);

  const question =
    s(x.question) ||
    s(valueJson.question) ||
    title;

  const answer =
    s(x.answer) ||
    s(valueJson.answer) ||
    s(valueJson.summary) ||
    s(valueJson.text) ||
    s(x.value_text || x.valueText) ||
    s(x.content) ||
    s(x.text) ||
    s(x.body) ||
    s(x.description);

  const active =
    typeof x.enabled === "boolean"
      ? x.enabled
      : typeof x.active === "boolean"
        ? x.active
        : true;

  return {
    id: s(x.id || `runtime-knowledge-${idx + 1}`),
    tenant_id: s(x.tenant_id || x.tenantId || tenant?.id || ""),
    entry_type: s(x.entry_type || x.entryType || x.category || "faq"),
    title,
    question,
    answer,
    language: normalizeLanguage(x.language || tenant?.default_language || "az", "az"),
    service_key: s(x.service_key || x.serviceKey || valueJson.service_key || valueJson.serviceKey || ""),
    intent_key: s(x.intent_key || x.intentKey || valueJson.intent_key || valueJson.intentKey || ""),
    keywords: uniqStrings([
      ...flattenStringList(x.keywords, x.aliases, valueJson.keywords),
      title,
      question,
      s(x.item_key || x.itemKey || x.canonical_key || x.canonicalKey),
    ]),
    priority: Number(x.priority || 100),
    enabled: Boolean(active),
    active: Boolean(active),
    meta: obj(x.meta, x.metadata, x),
  };
}

function normalizePlaybook(item, idx = 0, tenant = null) {
  const x = obj(item);
  const meta = obj(x.meta, x.metadata, x);

  const triggerKeywords = uniqStrings([
    ...flattenStringList(
      x.triggerKeywords,
      x.triggers,
      x.keywords,
      meta.triggerKeywords,
      meta.triggers,
      meta.keywords
    ),
    s(x.user_example || x.userExample),
    s(x.intent_key || x.intentKey),
    s(x.service_key || x.serviceKey),
  ]);

  const replyTemplate =
    s(x.ideal_reply || x.idealReply) ||
    s(x.replyTemplate) ||
    s(x.reply) ||
    s(x.response) ||
    s(x.template) ||
    s(meta.replyTemplate);

  const actionType =
    lower(x.actionType || x.action || x.type || x.cta_type || x.ctaType || meta.actionType);

  const active =
    typeof x.enabled === "boolean"
      ? x.enabled
      : typeof x.active === "boolean"
        ? x.active
        : true;

  return {
    id: s(x.id || `runtime-playbook-${idx + 1}`),
    tenant_id: s(x.tenant_id || x.tenantId || tenant?.id || ""),
    intent_key: s(x.intent_key || x.intentKey || "general"),
    service_key: s(x.service_key || x.serviceKey || ""),
    language: normalizeLanguage(x.language || tenant?.default_language || "az", "az"),
    user_example: s(x.user_example || x.userExample),
    ideal_reply: s(x.ideal_reply || x.idealReply || replyTemplate),
    reply_style: s(x.reply_style || x.replyStyle || ""),
    cta_type: s(x.cta_type || x.ctaType || actionType),
    priority: Number(x.priority || 100),
    enabled: Boolean(active),
    active: Boolean(active),
    meta,

    name: s(x.name || x.title || x.intent_key || x.intentKey || x.service_key || x.serviceKey || "playbook"),
    triggerKeywords,
    replyTemplate,
    actionType,
    createLead:
      Boolean(x.createLead) ||
      Boolean(meta.createLead) ||
      ["lead", "contact", "quote", "book", "capture_lead"].includes(actionType),
    handoff:
      Boolean(x.handoff) ||
      Boolean(meta.handoff) ||
      ["handoff", "operator", "human"].includes(actionType),
    handoffReason: s(x.handoffReason || meta.handoffReason || x.intent_key || x.intentKey || ""),
    handoffPriority: s(x.handoffPriority || meta.handoffPriority || "normal") || "normal",
  };
}

function dedupeServices(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const normalized = normalizeServiceEntry(item, out.length);
    const key = lower(normalized.service_key || normalized.title || normalized.name);
    if (!normalized.title || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function dedupeKnowledgeEntries(list = [], tenant = null) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const normalized = normalizeKnowledgeEntry(item, out.length, tenant);
    if (!normalized.enabled || (!normalized.title && !normalized.answer)) continue;

    const key = lower(
      [
        normalized.entry_type,
        normalized.service_key,
        normalized.intent_key,
        normalized.language,
        normalized.title || normalized.question,
        compactText(normalized.answer, 180),
      ].join("|")
    );

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function dedupePlaybooks(list = [], tenant = null) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const normalized = normalizePlaybook(item, out.length, tenant);
    if (!normalized.enabled) continue;

    const key = lower(
      [
        normalized.intent_key,
        normalized.service_key,
        normalized.language,
        normalized.name,
        normalized.replyTemplate || normalized.ideal_reply,
      ].join("|")
    );

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

async function loadLegacyTenant({
  db,
  tenantId = "",
  tenantKey = "",
  tenant = null,
}) {
  const providedTenant = obj(tenant);

  if (providedTenant && isHydratedTenant(providedTenant)) {
    return normalizeProvidedTenant(providedTenant);
  }

  if (!hasDb(db)) {
    if (providedTenant && (providedTenant.id || providedTenant.tenant_key || providedTenant.tenantKey)) {
      return normalizeProvidedTenant(providedTenant);
    }
    return null;
  }

  const id =
    s(tenantId) ||
    s(providedTenant.id) ||
    s(providedTenant.tenant_id);

  const resolvedTenantKey =
    tenantKey
      ? resolveTenantKey(tenantKey)
      : resolveTenantKey(s(providedTenant.tenant_key || providedTenant.tenantKey));

  let result;

  if (id) {
    result = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.legal_name,
        t.industry_key,
        t.country_code,
        t.timezone,
        t.default_language,
        t.enabled_languages,
        t.market_region,
        t.plan_key,
        t.status,
        t.active,
        t.onboarding_completed_at,
        t.created_at,
        t.updated_at,

        tp.brand_name,
        tp.website_url,
        tp.public_email,
        tp.public_phone,
        tp.audience_summary,
        tp.services_summary,
        tp.value_proposition,
        tp.brand_summary,
        tp.tone_of_voice,
        tp.preferred_cta,
        tp.banned_phrases,
        tp.communication_rules,
        tp.visual_style,
        tp.extra_context,

        ap.auto_reply_enabled,
        ap.suppress_ai_during_handoff,
        ap.mark_seen_enabled,
        ap.typing_indicator_enabled,
        ap.create_lead_enabled,
        ap.approval_required_content,
        ap.approval_required_publish,
        ap.quiet_hours_enabled,
        ap.quiet_hours,
        ap.inbox_policy,
        ap.comment_policy,
        ap.content_policy,
        ap.escalation_rules,
        ap.risk_rules,
        ap.lead_scoring_rules,
        ap.publish_policy

      from tenants t
      left join tenant_profiles tp
        on tp.tenant_id = t.id
      left join tenant_ai_policies ap
        on ap.tenant_id = t.id
      where t.id = $1::uuid
      limit 1
      `,
      [id]
    );
  } else if (resolvedTenantKey) {
    result = await db.query(
      `
      select
        t.id,
        t.tenant_key,
        t.company_name,
        t.legal_name,
        t.industry_key,
        t.country_code,
        t.timezone,
        t.default_language,
        t.enabled_languages,
        t.market_region,
        t.plan_key,
        t.status,
        t.active,
        t.onboarding_completed_at,
        t.created_at,
        t.updated_at,

        tp.brand_name,
        tp.website_url,
        tp.public_email,
        tp.public_phone,
        tp.audience_summary,
        tp.services_summary,
        tp.value_proposition,
        tp.brand_summary,
        tp.tone_of_voice,
        tp.preferred_cta,
        tp.banned_phrases,
        tp.communication_rules,
        tp.visual_style,
        tp.extra_context,

        ap.auto_reply_enabled,
        ap.suppress_ai_during_handoff,
        ap.mark_seen_enabled,
        ap.typing_indicator_enabled,
        ap.create_lead_enabled,
        ap.approval_required_content,
        ap.approval_required_publish,
        ap.quiet_hours_enabled,
        ap.quiet_hours,
        ap.inbox_policy,
        ap.comment_policy,
        ap.content_policy,
        ap.escalation_rules,
        ap.risk_rules,
        ap.lead_scoring_rules,
        ap.publish_policy

      from tenants t
      left join tenant_profiles tp
        on tp.tenant_id = t.id
      left join tenant_ai_policies ap
        on ap.tenant_id = t.id
      where t.tenant_key = $1::text
      limit 1
      `,
      [resolvedTenantKey]
    );
  } else if (providedTenant && (providedTenant.id || providedTenant.tenant_key || providedTenant.tenantKey)) {
    return normalizeProvidedTenant(providedTenant);
  } else {
    return null;
  }

  const row = result?.rows?.[0];
  if (!row) {
    if (providedTenant && (providedTenant.id || providedTenant.tenant_key || providedTenant.tenantKey)) {
      return normalizeProvidedTenant(providedTenant);
    }
    return null;
  }

  const defaultLanguage = normalizeLanguage(row.default_language || "az", "az");
  const enabledLanguages = normalizeLanguageList(
    row.enabled_languages,
    row.default_language,
    defaultLanguage
  );
  const supportedLanguages = enabledLanguages.length ? enabledLanguages : [defaultLanguage];
  const displayName = s(row.brand_name || row.company_name || row.tenant_key);

  return {
    id: s(row.id),
    tenant_key: s(row.tenant_key),
    company_name: s(row.company_name),
    legal_name: s(row.legal_name),
    industry_key: s(row.industry_key || "generic_business"),
    country_code: s(row.country_code || "AZ"),
    timezone: s(row.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,
    market_region: s(row.market_region),
    plan_key: s(row.plan_key),
    status: s(row.status),
    active: typeof row.active === "boolean" ? row.active : true,

    profile: {
      brand_name: s(row.brand_name),
      website_url: s(row.website_url),
      public_email: s(row.public_email),
      public_phone: s(row.public_phone),
      audience_summary: s(row.audience_summary),
      services_summary: s(row.services_summary),
      value_proposition: s(row.value_proposition),
      brand_summary: s(row.brand_summary),
      tone_of_voice: s(row.tone_of_voice),
      preferred_cta: s(row.preferred_cta),
      banned_phrases: arr(row.banned_phrases),
      communication_rules: obj(row.communication_rules),
      visual_style: obj(row.visual_style),
      extra_context: obj(row.extra_context),
    },

    brand: {
      name: displayName,
      displayName,
      tone: s(row.tone_of_voice),
      industry: s(row.industry_key || "generic_business"),
      defaultLanguage,
      languages: supportedLanguages,
    },

    ai_policy: {
      auto_reply_enabled: boolOrUndefined(row.auto_reply_enabled),
      suppress_ai_during_handoff: boolOrUndefined(row.suppress_ai_during_handoff),
      mark_seen_enabled: boolOrUndefined(row.mark_seen_enabled),
      typing_indicator_enabled: boolOrUndefined(row.typing_indicator_enabled),
      create_lead_enabled: boolOrUndefined(row.create_lead_enabled),
      approval_required_content: boolOrUndefined(row.approval_required_content),
      approval_required_publish: boolOrUndefined(row.approval_required_publish),
      quiet_hours_enabled: boolOrUndefined(row.quiet_hours_enabled),
      quiet_hours: obj(row.quiet_hours),
      inbox_policy: obj(row.inbox_policy),
      comment_policy: obj(row.comment_policy),
      content_policy: obj(row.content_policy),
      escalation_rules: obj(row.escalation_rules),
      risk_rules: obj(row.risk_rules),
      lead_scoring_rules: obj(row.lead_scoring_rules),
      publish_policy: obj(row.publish_policy),
    },

    inbox_policy: obj(row.inbox_policy),
    comment_policy: obj(row.comment_policy),
    meta: {},
  };
}

async function loadTenantServices({ db, tenantId }) {
  if (!hasDb(db) || !tenantId) return [];

  try {
    const result = await db.query(
      `
      select *
      from tenant_services
      where tenant_id = $1::uuid
      `,
      [tenantId]
    );

    return sortRowsByPriority(arr(result?.rows));
  } catch {
    return [];
  }
}

async function loadTenantResponsePlaybooks({ db, tenantId }) {
  if (!hasDb(db) || !tenantId) return [];

  const candidateTables = [
    "tenant_response_playbooks",
    "response_playbooks",
  ];

  for (const tableName of candidateTables) {
    try {
      const result = await db.query(
        `
        select *
        from ${tableName}
        where tenant_id = $1::uuid
        `,
        [tenantId]
      );

      const rows = sortRowsByPriority(arr(result?.rows));
      if (rows.length) return rows;
    } catch {
      // ignore
    }
  }

  return [];
}

function firstFact(facts = [], categories = [], itemKeys = []) {
  const cats = new Set(arr(categories).map((x) => lower(x)));
  const keys = new Set(arr(itemKeys).map((x) => lower(x)));

  for (const item of arr(facts)) {
    const cat = lower(item.category || item.entry_type || item.fact_group || item.factGroup);
    const key = lower(
      item.fact_key ||
        item.factKey ||
        item.item_key ||
        item.itemKey ||
        item.intent_key ||
        item.intentKey ||
        ""
    );
    if (cats.size && !cats.has(cat)) continue;
    if (keys.size && !keys.has(key)) continue;

    const value =
      s(item.value_text || item.valueText) ||
      s(item.answer) ||
      s(item.content) ||
      s(item.text) ||
      s(item.title);

    if (value) return value;
  }

  return "";
}

function listFactsByCategory(facts = [], categories = []) {
  const cats = new Set(arr(categories).map((x) => lower(x)));

  return uniqStrings(
    arr(facts)
      .filter((item) => !cats.size || cats.has(lower(item.category || item.entry_type || item.fact_group || item.factGroup)))
      .map((item) =>
        s(item.value_text || item.valueText) ||
        s(item.answer) ||
        s(item.content) ||
        s(item.text) ||
        s(item.title)
      )
      .filter(Boolean)
  );
}

function pickPrimaryContact(contacts = [], channels = []) {
  const wanted = arr(channels).map((x) => lower(x));

  const exactPrimary = arr(contacts).find(
    (x) => Boolean(x.is_primary || x.isPrimary) && wanted.includes(lower(x.channel))
  );
  if (exactPrimary?.value) return s(exactPrimary.value);

  const first = arr(contacts).find((x) => wanted.includes(lower(x.channel)));
  return s(first?.value);
}

function mapFactService(text, idx = 0, tenant = null, source = "business_fact") {
  return normalizeServiceEntry(
    {
      id: `${source}-service-${idx + 1}`,
      tenant_id: s(tenant?.id),
      service_key: lowerSlug(text) || `service-${idx + 1}`,
      title: s(text),
      enabled: true,
      sellable: true,
      visible_in_ai: true,
      category: "general",
      description_short: s(text),
      description_full: s(text),
      keywords: [s(text)],
      synonyms: [],
      example_requests: [],
      pricing_mode: "quote_required",
      contact_capture_mode: "optional",
      handoff_mode: "optional",
      response_mode: "template",
      faq_answer: "",
      disabled_reply_text: "",
      sort_order: idx,
      meta: { source },
    },
    idx
  );
}

function buildServices({
  incomingServices = [],
  tenantServices = [],
  facts = [],
  activeKnowledge = [],
  tenant = null,
  legacy = null,
}) {
  const normalizedIncoming = arr(incomingServices).map((item, idx) =>
    normalizeServiceEntry(item, idx)
  );

  const normalizedTenantServices = arr(tenantServices).map((item, idx) =>
    normalizeServiceEntry(item, normalizedIncoming.length + idx)
  );

  const knowledgeServices = arr(activeKnowledge)
    .filter((x) => ["service", "product"].includes(lower(x.category || x.entry_type)))
    .map((x, idx) =>
      mapFactService(
        s(x.value_text || x.valueText || x.title || x.item_key || x.itemKey),
        normalizedIncoming.length + normalizedTenantServices.length + idx,
        tenant,
        "canonical_knowledge"
      )
    );

  const summaryServices = splitTextList(
    s(legacy?.profile?.services_summary)
  ).map((item, idx) =>
    mapFactService(
      item,
      normalizedIncoming.length +
        normalizedTenantServices.length +
        knowledgeServices.length +
        idx,
      tenant,
      "legacy_profile_summary"
    )
  );

  const fallbackFactServices =
    normalizedTenantServices.length || knowledgeServices.length
      ? []
      : [
          ...listFactsByCategory(facts, ["service"]).map((item, idx) =>
            mapFactService(
              item,
              normalizedIncoming.length +
                normalizedTenantServices.length +
                knowledgeServices.length +
                summaryServices.length +
                idx,
              tenant,
              "business_fact"
            )
          ),
          ...listFactsByCategory(facts, ["product"]).map((item, idx) =>
            mapFactService(
              item,
              normalizedIncoming.length +
                normalizedTenantServices.length +
                knowledgeServices.length +
                summaryServices.length +
                listFactsByCategory(facts, ["service"]).length +
                idx,
              tenant,
              "business_fact"
            )
          ),
        ];

  return dedupeServices([
    ...normalizedIncoming,
    ...normalizedTenantServices,
    ...knowledgeServices,
    ...summaryServices,
    ...fallbackFactServices,
  ]);
}

function buildKnowledgeEntries({
  incomingKnowledgeEntries = [],
  facts = [],
  activeKnowledge = [],
  tenant = null,
}) {
  const fromKnowledge = arr(activeKnowledge)
    .filter((x) =>
      [
        "faq",
        "pricing",
        "pricing_policy",
        "support",
        "company",
        "summary",
        "service",
        "product",
        "location",
        "hours",
        "contact",
        "booking",
        "social_link",
      ].includes(lower(x.category || x.entry_type))
    )
    .map((x, idx) =>
      normalizeKnowledgeEntry(x, idx, tenant)
    );

  const fromIncoming = arr(incomingKnowledgeEntries).map((item, idx) =>
    normalizeKnowledgeEntry(item, fromKnowledge.length + idx, tenant)
  );

  const fromFacts = arr(facts)
    .filter((x) =>
      [
        "faq",
        "pricing",
        "pricing_policy",
        "support",
        "company",
        "summary",
        "service",
        "product",
        "location",
        "hours",
        "contact",
        "booking",
        "social_link",
      ].includes(lower(x.category || x.entry_type || x.fact_group || x.factGroup))
    )
    .map((x, idx) =>
      normalizeKnowledgeEntry(x, fromKnowledge.length + fromIncoming.length + idx, tenant)
    );

  return dedupeKnowledgeEntries([
    ...fromKnowledge,
    ...fromIncoming,
    ...fromFacts,
  ], tenant);
}

function buildResponsePlaybooks({
  incomingResponsePlaybooks = [],
  storedResponsePlaybooks = [],
  facts = [],
  activeKnowledge = [],
  capabilities = {},
  tenant = null,
}) {
  const normalizedIncoming = arr(incomingResponsePlaybooks).map((item, idx) =>
    normalizePlaybook(item, idx, tenant)
  );

  const normalizedStored = arr(storedResponsePlaybooks).map((item, idx) =>
    normalizePlaybook(item, normalizedIncoming.length + idx, tenant)
  );

  const replyStyle = s(capabilities.reply_style || capabilities.replyStyle || "professional");
  const generated = [];

  const bookingText =
    firstFact(activeKnowledge, ["booking"]) ||
    firstFact(facts, ["booking"]);

  if (bookingText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-booking",
          intent_key: "booking",
          language: s(tenant?.default_language || "az"),
          ideal_reply: bookingText,
          reply_style: replyStyle,
          cta_type: "booking",
          priority: 20,
          enabled: true,
          meta: {
            name: "booking",
            triggerKeywords: [
              "booking",
              "book",
              "appointment",
              "meeting",
              "demo",
              "consultation",
              "randevu",
              "rezervasiya",
            ],
            replyTemplate: bookingText,
            actionType: "book",
            createLead: true,
            handoff: false,
            handoffReason: "",
            handoffPriority: "normal",
          },
        },
        normalizedIncoming.length + normalizedStored.length,
        tenant
      )
    );
  }

  const supportText =
    firstFact(activeKnowledge, ["support"]) ||
    firstFact(facts, ["support"]);

  if (supportText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-support",
          intent_key: "support",
          language: s(tenant?.default_language || "az"),
          ideal_reply: supportText,
          reply_style: replyStyle,
          cta_type: "handoff",
          priority: 30,
          enabled: true,
          meta: {
            name: "support",
            triggerKeywords: [
              "problem",
              "issue",
              "support",
              "help",
              "kömək",
              "komek",
              "dəstək",
              "destek",
            ],
            replyTemplate: supportText,
            actionType: "handoff",
            createLead: false,
            handoff: true,
            handoffReason: "support_request",
            handoffPriority: "high",
          },
        },
        normalizedIncoming.length + normalizedStored.length + generated.length,
        tenant
      )
    );
  }

  const ctaText =
    firstFact(activeKnowledge, ["cta", "booking"]) ||
    firstFact(facts, ["cta", "booking"]);

  if (ctaText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-cta",
          intent_key: "general_cta",
          language: s(tenant?.default_language || "az"),
          ideal_reply: ctaText,
          reply_style: replyStyle,
          cta_type: "contact",
          priority: 40,
          enabled: true,
          meta: {
            name: "general_cta",
            triggerKeywords: [
              "əlaqə",
              "elaqe",
              "contact",
              "write me",
              "dm",
              "reach out",
            ],
            replyTemplate: ctaText,
            actionType: "lead",
            createLead: true,
            handoff: false,
            handoffReason: "",
            handoffPriority: "normal",
          },
        },
        normalizedIncoming.length + normalizedStored.length + generated.length,
        tenant
      )
    );
  }

  return dedupePlaybooks([
    ...normalizedIncoming,
    ...normalizedStored,
    ...generated,
  ], tenant);
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

  const websiteUrl =
    s(legacy?.profile?.website_url) ||
    s(businessProfile?.website_url);

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
    ...(capabilities?.should_avoid_competitor_comparisons ? ["Do not compare competitors aggressively."] : []),
    ...(capabilities?.should_avoid_legal_claims ? ["Do not make legal claims."] : []),
    ...(capabilities?.should_avoid_unverified_promises ? ["Do not make promises you cannot verify."] : []),
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
    [summaryShort, valueProposition, servicesText].filter(Boolean).join(" — "),
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
      pricingPolicy:
        firstCanonical(["pricing_policy"]) ||
        firstFact(facts, ["pricing_policy"]),
      supportMode:
        firstCanonical(["support"]) ||
        firstFact(facts, ["support"]),
      bookingLinks: listCanonical(["booking"]).length
        ? listCanonical(["booking"])
        : listFactsByCategory(facts, ["booking"]),
      socialLinks: listCanonical(["social_link"]).length
        ? listCanonical(["social_link"])
        : listFactsByCategory(facts, ["social_link"]),
      contactEmails: primaryEmail ? [primaryEmail] : [],
      contactPhones: primaryPhone ? [primaryPhone] : [],
      locations: arr(locations)
        .map((x) => s(x.address_line || x.addressLine || x.title))
        .filter(Boolean),
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

function buildRuntimeOutput({
  tenant,
  services,
  knowledgeEntries,
  responsePlaybooks,
  threadState = null,
  raw = {},
}) {
  const profile = obj(tenant?.profile);
  const aiPolicy = obj(tenant?.ai_policy);
  const inboxPolicy = obj(tenant?.inbox_policy);
  const commentPolicy = obj(tenant?.comment_policy);
  const meta = obj(tenant?.meta);

  const normalizedServices = arr(services)
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

  const defaultLanguage = normalizeLanguage(
    s(tenant?.default_language || "az"),
    "az"
  );

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

  const disabledServicesList = uniqStrings(
    disabledVisibleServices.map((x) => x.title)
  );

  const businessSummary = compactText(
    s(meta.businessSummary) ||
      s(aiPolicy.businessContext) ||
      s(profile.brand_summary) ||
      s(profile.value_proposition) ||
      s(profile.services_summary),
    1400
  );

  const tone =
    s(profile.tone_of_voice) ||
    s(aiPolicy.toneText) ||
    "professional, warm, concise";

  const preferredCta =
    s(profile.preferred_cta) ||
    s(meta.preferredCta);

  const maxSentences = Math.max(
    1,
    Math.min(
      4,
      Number(
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

  const bannedPhrases = uniqStrings([
    ...flattenStringList(profile.banned_phrases),
  ]);

  const urgentKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.urgentKeywords, meta.urgentKeywords),
    "urgent",
    "təcili",
    "tecili",
    "asap",
    "indi",
    "hemen",
  ]);

  const pricingKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.pricingKeywords, meta.pricingKeywords),
    "qiymət",
    "qiymet",
    "price",
    "cost",
    "tarif",
    "paket",
    "neçəyə",
    "neceye",
    "nömrə",
    "nomre",
    "əlaqə",
    "elaqe",
  ]);

  const humanKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.humanKeywords, meta.humanKeywords),
    "operator",
    "human",
    "canlı",
    "canli",
    "manager",
    "satış",
    "satis",
  ]);

  const supportKeywords = uniqStrings([
    ...flattenStringList(inboxPolicy.supportKeywords, meta.supportKeywords),
    "problem",
    "issue",
    "dəstək",
    "destek",
    "support",
    "help",
    "kömək",
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
    companySummaryLong: compactText(
      businessSummary || s(profile.brand_summary),
      1800
    ),

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
      typeof aiPolicy.auto_reply_enabled === "boolean"
        ? aiPolicy.auto_reply_enabled
        : true,

    createLeadEnabled:
      typeof aiPolicy.create_lead_enabled === "boolean"
        ? aiPolicy.create_lead_enabled
        : true,

    aiPolicy,
    inboxPolicy,
    commentPolicy,

    profile,
    tenant,
    threadState: threadState || null,

    raw: {
      ...obj(raw),
      services,
      knowledgeEntries,
      responsePlaybooks,
    },
  };
}

function normalizeProjectionFacts(facts = []) {
  return arr(facts).map((item) => ({
    ...obj(item),
    category: s(item.category || item.fact_group || item.factGroup),
    entry_type: s(item.entry_type || item.fact_group || item.factGroup),
    fact_key: s(item.fact_key || item.factKey),
    value_text: s(item.value_text || item.valueText),
  }));
}

function normalizeProjectionChannelsPolicies(policies = []) {
  return arr(policies).map((item) => ({
    ...obj(item),
    channel: s(item.channel),
    subchannel: s(item.subchannel || "default"),
    ai_reply_enabled:
      typeof item.ai_reply_enabled === "boolean"
        ? item.ai_reply_enabled
        : typeof item.aiReplyEnabled === "boolean"
          ? item.aiReplyEnabled
          : undefined,
    human_handoff_enabled:
      typeof item.human_handoff_enabled === "boolean"
        ? item.human_handoff_enabled
        : typeof item.humanHandoffEnabled === "boolean"
          ? item.humanHandoffEnabled
          : undefined,
    pricing_visibility: s(item.pricing_visibility || item.pricingVisibility),
    public_reply_mode: s(item.public_reply_mode || item.publicReplyMode),
    contact_capture_mode: s(item.contact_capture_mode || item.contactCaptureMode),
    escalation_mode: s(item.escalation_mode || item.escalationMode),
    reply_style: s(item.reply_style || item.replyStyle),
    max_reply_sentences: Number(item.max_reply_sentences ?? item.maxReplySentences ?? 2),
  }));
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
    s(legacy?.profile?.brand_name) ||
    s(legacy?.company_name) ||
    s(legacy?.tenant_key);

  const defaultLanguage = normalizeLanguage(
    identity.mainLanguage ||
      capabilitiesJson.primaryLanguage ||
      profileJson.mainLanguage ||
      legacy?.default_language ||
      "az",
    "az"
  );

  const supportedLanguages = normalizeLanguageList(
    identity.supportedLanguages,
    capabilitiesJson.supportedLanguages,
    profileJson.supportedLanguages,
    legacy?.supported_languages,
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
      .join(" — "),
    1400
  );

  const preferredCta =
    firstFact(activeKnowledge, ["cta", "booking"]) ||
    firstFact(facts, ["cta", "booking"]) ||
    s(contentJson.ctaStyle);

  const primaryEmail =
    s(profileJson.primaryEmail) ||
    pickPrimaryContact(contacts, ["email"]);

  const primaryPhone =
    s(profileJson.primaryPhone) ||
    pickPrimaryContact(contacts, ["phone", "whatsapp"]);

  const toneOfVoice =
    s(profileJson.toneProfile) ||
    s(contentJson.toneProfile) ||
    s(capabilitiesJson.replyStyle) ||
    s(legacy?.profile?.tone_of_voice) ||
    "professional, warm, concise";

  const maxSentences =
    lower(capabilitiesJson.replyLength) === "short"
      ? 1
      : lower(capabilitiesJson.replyLength) === "detailed"
        ? 3
        : Number(commentsJson.maxReplySentences || 2);

  const bannedPhrases = uniqStrings([
    ...arr(legacy?.profile?.banned_phrases),
    ...(capabilitiesJson.shouldAvoidCompetitorComparisons ? ["Do not compare competitors aggressively."] : []),
    ...(capabilitiesJson.shouldAvoidLegalClaims ? ["Do not make legal claims."] : []),
    ...(capabilitiesJson.shouldAvoidUnverifiedPromises ? ["Do not make promises you cannot verify."] : []),
  ]);

  const preferredChannelPolicy =
    arr(channelPolicies).find((x) => lower(x.channel) === "instagram") ||
    arr(channelPolicies).find((x) => lower(x.channel) === "comments") ||
    arr(channelPolicies)[0] ||
    null;

  return {
    ...legacy,
    id: s(identity.tenantId || legacy?.id),
    tenant_key: s(identity.tenantKey || legacy?.tenant_key),
    company_name: s(profileJson.companyName || identity.companyName || legacy?.company_name),
    legal_name: s(profileJson.legalName || identity.legalName || legacy?.legal_name),
    industry_key: s(profileJson.industryKey || identity.industryKey || legacy?.industry_key || "generic_business"),
    timezone: s(legacy?.timezone || "Asia/Baku"),
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    enabled_languages: supportedLanguages,

    profile: {
      ...obj(legacy?.profile),
      brand_name: displayName,
      website_url: s(profileJson.websiteUrl || identity.websiteUrl || legacy?.profile?.website_url),
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
        ...obj(legacy?.profile?.communication_rules),
        maxSentences,
        replyStyle: s(capabilitiesJson.replyStyle || "professional"),
        replyLength: s(capabilitiesJson.replyLength || "medium"),
        emojiLevel: s(capabilitiesJson.emojiLevel || "low"),
        ctaStyle: s(capabilitiesJson.ctaStyle || "soft"),
      },
      extra_context: {
        ...obj(legacy?.profile?.extra_context),
        business_brain_enabled: true,
        projection_first: true,
        projection_status: s(projection?.status),
        projection_confidence: projection?.confidence || 0,
        projection_readiness: projection?.readiness_label || "",
        contacts,
        locations,
      },
    },

    brand: {
      name: displayName,
      displayName,
      tone: toneOfVoice,
      industry: s(profileJson.industryKey || identity.industryKey || legacy?.industry_key || "generic_business"),
      defaultLanguage,
      languages: supportedLanguages,
    },

    meta: {
      ...obj(legacy?.meta),
      businessSummary,
      about: s(profileJson.summaryLong || profileJson.summaryShort),
      services: uniqStrings(arr(services).map((x) => s(x.title))),
      products: listFactsByCategory(activeKnowledge, ["product"]).length
        ? listFactsByCategory(activeKnowledge, ["product"])
        : listFactsByCategory(facts, ["product"]),
      pricingHints: listFactsByCategory(activeKnowledge, ["pricing"]).length
        ? listFactsByCategory(activeKnowledge, ["pricing"])
        : listFactsByCategory(facts, ["pricing"]),
      pricingPolicy:
        firstFact(activeKnowledge, ["pricing_policy"]) ||
        firstFact(facts, ["pricing_policy"]),
      supportMode:
        firstFact(activeKnowledge, ["support"]) ||
        firstFact(facts, ["support"]),
      bookingLinks: listFactsByCategory(activeKnowledge, ["booking"]).length
        ? listFactsByCategory(activeKnowledge, ["booking"])
        : listFactsByCategory(facts, ["booking"]),
      socialLinks: listFactsByCategory(activeKnowledge, ["social_link"]).length
        ? listFactsByCategory(activeKnowledge, ["social_link"])
        : listFactsByCategory(facts, ["social_link"]),
      contactEmails: primaryEmail ? [primaryEmail] : [],
      contactPhones: primaryPhone ? [primaryPhone] : [],
      locations: arr(locations)
        .map((x) => s(x.address_line || x.addressLine || x.title))
        .filter(Boolean),
      preferredCta,
      runtimeProjectionId: s(projection?.id),
      readinessLabel: s(projection?.readiness_label || projection?.readinessLabel),
      confidenceLabel: s(projection?.confidence_label || projection?.confidenceLabel),
    },

    ai_policy: {
      ...obj(legacy?.ai_policy),
      auto_reply_enabled:
        typeof inboxJson.enabled === "boolean"
          ? inboxJson.enabled
          : legacy?.ai_policy?.auto_reply_enabled,
      create_lead_enabled:
        typeof leadCaptureJson.enabled === "boolean"
          ? leadCaptureJson.enabled
          : legacy?.ai_policy?.create_lead_enabled,
      businessContext: businessSummary,
      toneText: toneOfVoice,
      servicesText: uniqStrings(arr(services).map((x) => s(x.title))).join(", "),
    },

    inbox_policy: {
      ...obj(legacy?.inbox_policy),
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
      ...obj(legacy?.comment_policy),
      reply_style: s(commentsJson.replyStyle || capabilitiesJson.replyStyle || ""),
      cta_style: s(capabilitiesJson.ctaStyle || ""),
      public_reply_mode: s(commentsJson.publicReplyMode || preferredChannelPolicy?.public_reply_mode || ""),
    },
  };
}

async function loadDbBrainData({ db, tenant }) {
  if (!hasDb(db) || !tenant?.id) {
    return {
      businessProfile: null,
      capabilities: null,
      activeKnowledge: [],
      facts: [],
      contacts: [],
      locations: [],
      channelPolicies: [],
      tenantServices: [],
      storedResponsePlaybooks: [],
    };
  }

  const knowledge = createTenantKnowledgeHelpers({ db });

  const businessProfile = await safeQuery(
    () => knowledge.getBusinessProfile({ tenantId: tenant.id, tenantKey: tenant.tenant_key }),
    null
  );

  const capabilities = await safeQuery(
    () => knowledge.getBusinessCapabilities({ tenantId: tenant.id, tenantKey: tenant.tenant_key }),
    null
  );

  const activeKnowledge = await safeQuery(
    () => knowledge.listActiveKnowledge({ tenantId: tenant.id, tenantKey: tenant.tenant_key }),
    []
  );

  const facts = await safeQuery(
    () => dbListTenantBusinessFacts(db, tenant.id, { enabledOnly: true }),
    []
  );

  const contacts = await safeQuery(() => dbListTenantContacts(db, tenant.id), []);
  const locations = await safeQuery(() => dbListTenantLocations(db, tenant.id), []);
  const channelPolicies = await safeQuery(() => dbListTenantChannelPolicies(db, tenant.id), []);
  const tenantServices = await safeQuery(
    () => loadTenantServices({ db, tenantId: tenant.id }),
    []
  );

  const storedResponsePlaybooks = await safeQuery(async () => {
    if (typeof knowledge.listResponsePlaybooks === "function") {
      return knowledge.listResponsePlaybooks({ tenantId: tenant.id, tenantKey: tenant.tenant_key });
    }

    if (typeof knowledge.listTenantResponsePlaybooks === "function") {
      return knowledge.listTenantResponsePlaybooks({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      });
    }

    if (typeof knowledge.listActiveResponsePlaybooks === "function") {
      return knowledge.listActiveResponsePlaybooks({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      });
    }

    return loadTenantResponsePlaybooks({ db, tenantId: tenant.id });
  }, []);

  return {
    businessProfile,
    capabilities,
    activeKnowledge,
    facts,
    contacts,
    locations,
    channelPolicies,
    tenantServices,
    storedResponsePlaybooks,
  };
}

async function loadCurrentProjection({ db, tenantId = "", tenantKey = "" }) {
  if (!hasDb(db)) return null;

  const current = await safeQuery(
    () => getCurrentTenantRuntimeProjection({ tenantId, tenantKey }, db),
    null
  );

  if (current) {
    const freshness = await safeQuery(
      () =>
        getTenantRuntimeProjectionFreshness(
          {
            tenantId,
            tenantKey,
            runtimeProjection: current,
          },
          db
        ),
      null
    );

    if (!freshness?.stale) {
      return current;
    }

    const refreshed = await safeQuery(
      () =>
        refreshTenantRuntimeProjectionStrict(
          {
            tenantId,
            tenantKey,
            triggerType: "system",
            requestedBy: "getTenantBusinessRuntime",
            runnerKey: "getTenantBusinessRuntime",
            generatedBy: "system",
            metadata: {
              source: "getTenantBusinessRuntime",
              staleProjectionRecovery: true,
              staleReasons: arr(freshness?.reasons),
            },
          },
          db
        ),
      null
    );

    if (obj(refreshed?.projection).id) {
      return refreshed.projection;
    }

    const error = new Error(
      "Runtime projection is stale and could not be refreshed."
    );
    error.code = "TENANT_RUNTIME_PROJECTION_STALE";
    error.freshness = freshness;
    throw error;
  }

  const refreshed = await safeQuery(
    () =>
      refreshTenantRuntimeProjectionStrict(
        {
          tenantId,
          tenantKey,
          triggerType: "system",
          requestedBy: "getTenantBusinessRuntime",
          runnerKey: "getTenantBusinessRuntime",
          generatedBy: "system",
        },
        db
      ),
    null
  );

  return obj(refreshed?.projection) && refreshed?.projection?.id ? refreshed.projection : null;
}

async function buildProjectionFirstRuntime({
  db,
  legacyTenant,
  input,
  projection,
  dbData,
}) {
  const projectionServices = arr(projection?.services_json);
  const projectionKnowledge = arr(projection?.approved_knowledge_json);
  const projectionFacts = normalizeProjectionFacts(projection?.active_facts_json);
  const projectionContacts = arr(projection?.contacts_json);
  const projectionLocations = arr(projection?.locations_json);
  const projectionChannelPolicies = normalizeProjectionChannelsPolicies(
    projection?.channel_policies_json
  );

  const services = buildServices({
    incomingServices: input?.services,
    tenantServices: projectionServices.length ? projectionServices : dbData.tenantServices,
    facts: projectionFacts.length ? projectionFacts : dbData.facts,
    activeKnowledge: projectionKnowledge.length ? projectionKnowledge : dbData.activeKnowledge,
    tenant: legacyTenant,
    legacy: legacyTenant,
  });

  const knowledgeEntries = buildKnowledgeEntries({
    incomingKnowledgeEntries: input?.knowledgeEntries,
    facts: projectionFacts.length ? projectionFacts : dbData.facts,
    activeKnowledge: projectionKnowledge.length ? projectionKnowledge : dbData.activeKnowledge,
    tenant: legacyTenant,
  });

  const responsePlaybooks = buildResponsePlaybooks({
    incomingResponsePlaybooks: input?.responsePlaybooks,
    storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    facts: projectionFacts.length ? projectionFacts : dbData.facts,
    activeKnowledge: projectionKnowledge.length ? projectionKnowledge : dbData.activeKnowledge,
    capabilities: obj(projection?.capabilities_json),
    tenant: legacyTenant,
  });

  const mergedTenant = buildTenantFromProjection({
    legacy: legacyTenant,
    projection,
    services,
    facts: projectionFacts.length ? projectionFacts : dbData.facts,
    contacts: projectionContacts.length ? projectionContacts : dbData.contacts,
    locations: projectionLocations.length ? projectionLocations : dbData.locations,
    channelPolicies: projectionChannelPolicies.length ? projectionChannelPolicies : dbData.channelPolicies,
    activeKnowledge: projectionKnowledge.length ? projectionKnowledge : dbData.activeKnowledge,
  });

  return buildRuntimeOutput({
    tenant: mergedTenant,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState: input?.threadState || null,
    raw: {
      mode: "projection_first",
      projection,
      businessProfile: dbData.businessProfile,
      capabilities: dbData.capabilities,
      facts: projectionFacts.length ? projectionFacts : dbData.facts,
      contacts: projectionContacts.length ? projectionContacts : dbData.contacts,
      locations: projectionLocations.length ? projectionLocations : dbData.locations,
      channelPolicies:
        projectionChannelPolicies.length ? projectionChannelPolicies : dbData.channelPolicies,
      activeKnowledge: projectionKnowledge.length ? projectionKnowledge : dbData.activeKnowledge,
      tenantServices: projectionServices.length ? projectionServices : dbData.tenantServices,
      storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    },
  });
}

export async function getTenantBusinessRuntime(input = {}) {
  const db = input?.db || null;

  const tenantIdInput =
    s(input?.tenantId) ||
    s(input?.tenant?.id) ||
    s(input?.tenant?.tenant_id);

  const tenantKeyInput =
    s(input?.tenantKey) ||
    s(input?.tenant?.tenant_key) ||
    s(input?.tenant?.tenantKey);

  const resolvedTenantKey = tenantKeyInput ? resolveTenantKey(tenantKeyInput) : "";

  const legacyTenant = await loadLegacyTenant({
    db,
    tenantId: tenantIdInput,
    tenantKey: resolvedTenantKey,
    tenant: input?.tenant || null,
  });

  if (!legacyTenant?.id && !legacyTenant?.tenant_key) {
    const fallbackKey = resolvedTenantKey || tenantKeyInput || "default";
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

  const projection = await loadCurrentProjection({
    db,
    tenantId: legacyTenant.id,
    tenantKey: legacyTenant.tenant_key,
  });

  const dbData = await loadDbBrainData({ db, tenant: legacyTenant });

  if (projection?.id) {
    return buildProjectionFirstRuntime({
      db,
      legacyTenant,
      input,
      projection,
      dbData,
    });
  }

  const services = buildServices({
    incomingServices: input?.services,
    tenantServices: dbData.tenantServices,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    tenant: legacyTenant,
    legacy: legacyTenant,
  });

  const knowledgeEntries = buildKnowledgeEntries({
    incomingKnowledgeEntries: input?.knowledgeEntries,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    tenant: legacyTenant,
  });

  const responsePlaybooks = buildResponsePlaybooks({
    incomingResponsePlaybooks: input?.responsePlaybooks,
    storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    facts: dbData.facts,
    activeKnowledge: dbData.activeKnowledge,
    capabilities: obj(dbData.capabilities),
    tenant: legacyTenant,
  });

  const mergedTenant = mergeTenantRuntime({
    legacy: legacyTenant,
    businessProfile: obj(dbData.businessProfile),
    capabilities: obj(dbData.capabilities),
    facts: dbData.facts,
    contacts: dbData.contacts,
    locations: dbData.locations,
    channelPolicies: dbData.channelPolicies,
    services,
    activeKnowledge: dbData.activeKnowledge,
  });

  return buildRuntimeOutput({
    tenant: mergedTenant,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState: input?.threadState || null,
    raw: {
      mode: "legacy_fallback",
      businessProfile: dbData.businessProfile,
      capabilities: dbData.capabilities,
      facts: dbData.facts,
      contacts: dbData.contacts,
      locations: dbData.locations,
      channelPolicies: dbData.channelPolicies,
      activeKnowledge: dbData.activeKnowledge,
      tenantServices: dbData.tenantServices,
      storedResponsePlaybooks: dbData.storedResponsePlaybooks,
    },
  });
}

export const buildBusinessRuntime = getTenantBusinessRuntime;
export const getBusinessRuntime = getTenantBusinessRuntime;
export const createBusinessRuntime = getTenantBusinessRuntime;
export const getTenantBrainRuntime = getTenantBusinessRuntime;
export const getTenantBusinessBrainRuntime = getTenantBusinessRuntime;
export const buildTenantBusinessRuntime = getTenantBusinessRuntime;
export const createTenantBusinessRuntime = getTenantBusinessRuntime;
export const resolveBusinessRuntime = getTenantBusinessRuntime;
export const resolveTenantBusinessRuntime = getTenantBusinessRuntime;

export default getTenantBusinessRuntime;
