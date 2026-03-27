import { s } from "../shared.js";

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function uniqStrings(list = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(list)) {
    const x = s(item);
    if (!x) continue;
    const key = x.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }

  return out;
}

export function normalizeJsonObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function normalizeJsonArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildTenantLanguages(row = {}, normalized = {}) {
  const enabled = arr(normalized.enabled_languages).length
    ? normalized.enabled_languages
    : normalizeJsonArray(row.enabled_languages);

  const supported = arr(normalized.supported_languages).length
    ? normalized.supported_languages
    : enabled.length
      ? enabled
      : [s(normalized.default_language || row.default_language || "az")];

  return {
    supported_languages: uniqStrings(supported),
    enabled_languages: uniqStrings(
      enabled.length ? enabled : [s(normalized.default_language || row.default_language || "az")]
    ),
  };
}

export async function queryRows(db, text, params = []) {
  try {
    const result = await db.query(text, params);
    return result.rows || [];
  } catch {
    return [];
  }
}

export function toAttempt(row) {
  if (!row) return null;

  return {
    ...row,
    payload:
      row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? row.payload
        : {},
    provider_response:
      row?.provider_response &&
      typeof row.provider_response === "object" &&
      !Array.isArray(row.provider_response)
        ? row.provider_response
        : {},
  };
}

export function normalizeTenantService(row) {
  if (!row) return null;

  const meta = normalizeJsonObject(row.metadata_json || row.meta);
  const highlights = normalizeJsonArray(row.highlights_json || row.highlights);
  const enabled =
    typeof row.enabled === "boolean"
      ? row.enabled
      : typeof row.is_active === "boolean"
        ? row.is_active
        : typeof row.active === "boolean"
          ? row.active
          : true;

  const visibleInAi =
    typeof row.visible_in_ai === "boolean"
      ? row.visible_in_ai
      : typeof row.visibleInAi === "boolean"
        ? row.visibleInAi
        : true;

  const title = s(row.title || row.name || row.service_name || row.label);
  const descriptionShort = s(row.description_short || row.description || row.summary);
  const descriptionFull = s(row.description_full || row.details || row.description);

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    service_key: s(row.service_key),
    title,
    name: title,
    enabled: Boolean(enabled),
    active: Boolean(enabled),
    sellable: typeof row.sellable === "boolean" ? row.sellable : true,
    visible_in_ai: Boolean(visibleInAi),
    visibleInAi: Boolean(visibleInAi),
    category: s(row.category || "general"),
    description_short: descriptionShort,
    description_full: descriptionFull,
    description: s(row.description || descriptionFull || descriptionShort),
    keywords: uniqStrings([
      ...normalizeJsonArray(row.keywords),
      ...highlights,
      title,
    ]),
    synonyms: normalizeJsonArray(row.synonyms),
    example_requests: normalizeJsonArray(row.example_requests),
    pricing_mode: s(row.pricing_mode || row.pricing_model || "quote_required"),
    pricing_model: s(row.pricing_model || row.pricing_mode || "quote_required"),
    contact_capture_mode: s(row.contact_capture_mode || "optional"),
    handoff_mode: s(row.handoff_mode || "optional"),
    response_mode: s(row.response_mode || "template"),
    faq_answer: s(row.faq_answer),
    disabled_reply_text: s(row.disabled_reply_text),
    sort_order: Number(row.sort_order || 0),
    price_from: row.price_from == null ? null : Number(row.price_from),
    currency: s(row.currency || "AZN"),
    duration_minutes:
      row.duration_minutes == null ? null : Number(row.duration_minutes),
    highlights,
    highlights_json: highlights,
    meta,
    metadata_json: meta,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeTenantKnowledgeEntry(row) {
  if (!row) return null;

  const valueJson = normalizeJsonObject(row.value_json);
  const meta = normalizeJsonObject(row.metadata_json || row.meta);

  const question = s(row.question || valueJson.question || row.title || row.item_key);
  const answer = s(
    row.answer ||
      valueJson.answer ||
      valueJson.summary ||
      valueJson.text ||
      row.value_text ||
      row.content ||
      row.text ||
      row.description
  );

  const enabled =
    typeof row.enabled === "boolean"
      ? row.enabled
      : ["approved", "active", "published"].includes(
          s(row.status || "").toLowerCase()
        ) || !row.status;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    entry_type: s(row.entry_type || row.category || "faq"),
    title: s(row.title || question),
    question,
    answer,
    language: s(row.language || valueJson.language || "az"),
    service_key: s(row.service_key || valueJson.service_key),
    intent_key: s(row.intent_key || valueJson.intent_key),
    keywords: uniqStrings([
      ...normalizeJsonArray(row.keywords),
      ...normalizeJsonArray(valueJson.keywords),
      s(row.title),
      question,
      s(row.item_key),
    ]),
    priority: Number(row.priority || 100),
    enabled: Boolean(enabled),
    meta: {
      ...meta,
      value_json: valueJson,
    },
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeTenantResponsePlaybook(row) {
  if (!row) return null;

  const meta = normalizeJsonObject(row.meta || row.metadata_json);
  const triggerKeywords =
    normalizeJsonArray(meta.triggerKeywords).length
      ? normalizeJsonArray(meta.triggerKeywords)
      : normalizeJsonArray(meta.triggers).length
        ? normalizeJsonArray(meta.triggers)
        : normalizeJsonArray(meta.keywords);

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    intent_key: s(row.intent_key || "general"),
    service_key: s(row.service_key),
    language: s(row.language || "az"),
    user_example: s(row.user_example),
    ideal_reply: s(row.ideal_reply),
    reply_style: s(row.reply_style),
    cta_type: s(row.cta_type),
    priority: Number(row.priority || 100),
    enabled:
      typeof row.enabled === "boolean"
        ? row.enabled
        : ["approved", "active", "published"].includes(
            s(row.status || "").toLowerCase()
          ) || !row.status,
    meta,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    name: s(meta.name || row.intent_key || "playbook"),
    triggerKeywords,
    replyTemplate: s(meta.replyTemplate || row.ideal_reply),
    actionType: s(meta.actionType || row.cta_type),
    createLead: Boolean(meta.createLead),
    handoff: Boolean(meta.handoff),
    handoffReason: s(meta.handoffReason),
    handoffPriority: s(meta.handoffPriority || "normal"),
  };
}

export function normalizeInboxThreadState(row) {
  if (!row) return null;

  return {
    thread_id: s(row.thread_id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    last_customer_intent: s(row.last_customer_intent),
    last_customer_service_key: s(row.last_customer_service_key),
    last_ai_intent: s(row.last_ai_intent),
    last_ai_service_key: s(row.last_ai_service_key),
    last_ai_reply_hash: s(row.last_ai_reply_hash),
    last_ai_reply_text: s(row.last_ai_reply_text),
    last_ai_cta_type: s(row.last_ai_cta_type),
    last_response_mode: s(row.last_response_mode),
    contact_requested_at: row.contact_requested_at || null,
    contact_shared_at: row.contact_shared_at || null,
    pricing_explained_at: row.pricing_explained_at || null,
    lead_created_at: row.lead_created_at || null,
    handoff_announced_at: row.handoff_announced_at || null,
    handoff_message_id: s(row.handoff_message_id),
    suppressed_until_operator_reply: Boolean(row.suppressed_until_operator_reply),
    repeat_intent_count: Number(row.repeat_intent_count || 0),
    repeat_service_count: Number(row.repeat_service_count || 0),
    awaiting_customer_answer_to: s(row.awaiting_customer_answer_to),
    last_decision_meta: normalizeJsonObject(row.last_decision_meta),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    handoffActive:
      Boolean(row.suppressed_until_operator_reply) ||
      Boolean(normalizeJsonObject(row.last_decision_meta)?.handoffActive),
    handoffReason: s(normalizeJsonObject(row.last_decision_meta)?.handoffReason),
    handoffPriority:
      s(normalizeJsonObject(row.last_decision_meta)?.handoffPriority || "normal") || "normal",
    operatorRecentlyReplied: Boolean(
      normalizeJsonObject(row.last_decision_meta)?.operatorRecentlyReplied
    ),
    closedLike: Boolean(normalizeJsonObject(row.last_decision_meta)?.closedLike),
  };
}

export function lowerSlug(v) {
  return s(v)
    .toLowerCase()
    .replace(/[^a-z0-9É™ÄŸÄ±Ã¶ÅŸÃ¼Ã§_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}
