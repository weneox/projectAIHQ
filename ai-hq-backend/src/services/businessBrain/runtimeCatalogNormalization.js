import {
  arr,
  compactText,
  flattenStringList,
  lower,
  lowerSlug,
  normalizeLanguage,
  obj,
  s,
  uniqStrings,
} from "./runtimeShared.js";

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
    description_short: s(
      x.description_short || x.descriptionShort || x.description || x.summary
    ),
    description_full: s(
      x.description_full || x.descriptionFull || x.details || x.description
    ),
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
    contact_capture_mode: s(
      x.contact_capture_mode || x.contactCaptureMode || "optional"
    ),
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
  const title = s(x.title) || s(x.question) || s(valueJson.question) || s(x.name);
  const question = s(x.question) || s(valueJson.question) || title;
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
    service_key: s(
      x.service_key || x.serviceKey || valueJson.service_key || valueJson.serviceKey || ""
    ),
    intent_key: s(
      x.intent_key || x.intentKey || valueJson.intent_key || valueJson.intentKey || ""
    ),
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
    name: s(
      x.name ||
        x.title ||
        x.intent_key ||
        x.intentKey ||
        x.service_key ||
        x.serviceKey ||
        "playbook"
    ),
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
    handoffReason: s(
      x.handoffReason || meta.handoffReason || x.intent_key || x.intentKey || ""
    ),
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

export {
  dedupeKnowledgeEntries,
  dedupePlaybooks,
  dedupeServices,
  normalizeKnowledgeEntry,
  normalizePlaybook,
  normalizeServiceEntry,
};
