// src/routes/api/inbox/repository.js
// FINAL v1.3 — inbox repository layer
// canonical runtime-aware + legacy-safe DB helpers

import { isDbReady, isUuid } from "../../../utils/http.js";
import { getDefaultTenantKey, resolveTenantKey } from "../../../tenancy/index.js";
import { getTenantBrainRuntime } from "../../../services/businessBrain/getTenantBrainRuntime.js";
import {
  normalizeMessage,
  normalizeTenant,
  normalizeThread,
  s,
} from "./shared.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(list = []) {
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

function normalizeJsonObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeJsonArray(v) {
  return Array.isArray(v) ? v : [];
}

function buildTenantLanguages(row = {}, normalized = {}) {
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

async function queryRows(db, text, params = []) {
  try {
    const result = await db.query(text, params);
    return result.rows || [];
  } catch {
    return [];
  }
}

async function queryOne(db, text, params = []) {
  const rows = await queryRows(db, text, params);
  return rows[0] || null;
}

function toAttempt(row) {
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

function normalizeTenantService(row) {
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
  const descriptionShort = s(
    row.description_short || row.description || row.summary
  );
  const descriptionFull = s(
    row.description_full || row.details || row.description
  );

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

function normalizeTenantKnowledgeEntry(row) {
  if (!row) return null;

  const valueJson = normalizeJsonObject(row.value_json);
  const meta = normalizeJsonObject(row.metadata_json || row.meta);

  const question = s(
    row.question ||
      valueJson.question ||
      row.title ||
      row.item_key
  );

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

function normalizeTenantResponsePlaybook(row) {
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

function normalizeInboxThreadState(row) {
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

export async function getTenantByKey(db, tenantKey) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  try {
    const runtime = await getTenantBrainRuntime({
      db,
      tenantKey: resolvedTenantKey,
    });

    if (runtime?.tenant?.id || runtime?.tenant?.tenant_key) {
      return runtime.tenant;
    }
  } catch {
    // fallback below
  }

  try {
    const result = await db.query(
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

    const row = result.rows?.[0] || {};
    const normalized = normalizeTenant(row || null);
    if (!normalized && !row?.id) return null;

    const languages = buildTenantLanguages(row, normalized || {});

    return {
      ...(normalized || {}),
      id: s(normalized?.id || row.id),
      tenant_key: s(normalized?.tenant_key || row.tenant_key),
      company_name: s(normalized?.company_name || row.company_name),
      legal_name: s(normalized?.legal_name || row.legal_name),
      industry_key: s(normalized?.industry_key || row.industry_key),
      timezone: s(normalized?.timezone || row.timezone || "Asia/Baku"),
      default_language: s(normalized?.default_language || row.default_language || "az"),
      supported_languages: languages.supported_languages,
      enabled_languages: languages.enabled_languages,
      market_region: s(normalized?.market_region || row.market_region),
      plan_key: s(normalized?.plan_key || row.plan_key),
      status: s(normalized?.status || row.status),
      active:
        typeof normalized?.active === "boolean"
          ? normalized.active
          : Boolean(row.active),

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
        banned_phrases: normalizeJsonArray(row.banned_phrases),
        communication_rules: normalizeJsonObject(row.communication_rules),
        visual_style: normalizeJsonObject(row.visual_style),
        extra_context: normalizeJsonObject(row.extra_context),
      },

      ai_policy: {
        auto_reply_enabled: Boolean(row.auto_reply_enabled),
        suppress_ai_during_handoff: Boolean(row.suppress_ai_during_handoff),
        mark_seen_enabled: Boolean(row.mark_seen_enabled),
        typing_indicator_enabled: Boolean(row.typing_indicator_enabled),
        create_lead_enabled: Boolean(row.create_lead_enabled),
        approval_required_content: Boolean(row.approval_required_content),
        approval_required_publish: Boolean(row.approval_required_publish),
        quiet_hours_enabled: Boolean(row.quiet_hours_enabled),
        quiet_hours: normalizeJsonObject(row.quiet_hours),
        inbox_policy: normalizeJsonObject(row.inbox_policy),
        comment_policy: normalizeJsonObject(row.comment_policy),
        content_policy: normalizeJsonObject(row.content_policy),
        escalation_rules: normalizeJsonObject(row.escalation_rules),
        risk_rules: normalizeJsonObject(row.risk_rules),
        lead_scoring_rules: normalizeJsonObject(row.lead_scoring_rules),
        publish_policy: normalizeJsonObject(row.publish_policy),
      },

      inbox_policy: normalizeJsonObject(row.inbox_policy),
      comment_policy: normalizeJsonObject(row.comment_policy),
    };
  } catch {
    return null;
  }
}

export async function findExistingInboundMessage({
  db,
  tenantKey,
  threadId,
  externalMessageId,
}) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;
  if (!externalMessageId) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const result = await db.query(
    `
    select
      id,
      thread_id,
      tenant_key,
      direction,
      sender_type,
      external_message_id,
      message_type,
      text,
      attachments,
      meta,
      sent_at,
      created_at
    from inbox_messages
    where tenant_key = $1::text
      and thread_id = $2::uuid
      and direction = 'inbound'
      and external_message_id = $3::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, threadId, externalMessageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function findExistingOutboundMessage({
  db,
  tenantKey,
  threadId,
  externalMessageId,
}) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;
  if (!externalMessageId) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const result = await db.query(
    `
    select
      id,
      thread_id,
      tenant_key,
      direction,
      sender_type,
      external_message_id,
      message_type,
      text,
      attachments,
      meta,
      sent_at,
      created_at
    from inbox_messages
    where tenant_key = $1::text
      and thread_id = $2::uuid
      and direction = 'outbound'
      and external_message_id = $3::text
    order by created_at desc
    limit 1
    `,
    [resolvedTenantKey, threadId, externalMessageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function refreshThread(db, threadId, fallback = null) {
  if (!threadId || !isUuid(threadId)) return fallback;

  const refreshed = await db.query(
    `
    select
      id,
      tenant_key,
      channel,
      external_thread_id,
      external_user_id,
      external_username,
      customer_name,
      status,
      last_message_at,
      last_inbound_at,
      last_outbound_at,
      unread_count,
      assigned_to,
      labels,
      meta,
      handoff_active,
      handoff_reason,
      handoff_priority,
      handoff_at,
      handoff_by,
      created_at,
      updated_at
    from inbox_threads
    where id = $1::uuid
    limit 1
    `,
    [threadId]
  );

  return normalizeThread(refreshed.rows?.[0] || fallback);
}

export async function getThreadById(db, threadId) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  const result = await db.query(
    `
    select
      id,
      tenant_key,
      channel,
      external_thread_id,
      external_user_id,
      external_username,
      customer_name,
      status,
      last_message_at,
      last_inbound_at,
      last_outbound_at,
      unread_count,
      assigned_to,
      labels,
      meta,
      handoff_active,
      handoff_reason,
      handoff_priority,
      handoff_at,
      handoff_by,
      created_at,
      updated_at
    from inbox_threads
    where id = $1::uuid
    limit 1
    `,
    [threadId]
  );

  return normalizeThread(result.rows?.[0] || null);
}

export async function getMessageById(db, messageId) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const result = await db.query(
    `
    select
      id,
      thread_id,
      tenant_key,
      direction,
      sender_type,
      external_message_id,
      message_type,
      text,
      attachments,
      meta,
      sent_at,
      created_at
    from inbox_messages
    where id = $1::uuid
    limit 1
    `,
    [messageId]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function updateOutboundMessageProviderId({
  db,
  messageId,
  providerMessageId,
  providerResponse = {},
}) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const result = await db.query(
    `
    update inbox_messages
    set
      external_message_id = coalesce($2::text, external_message_id),
      meta = coalesce(meta, '{}'::jsonb) || $3::jsonb
    where id = $1::uuid
    returning
      id,
      thread_id,
      tenant_key,
      direction,
      sender_type,
      external_message_id,
      message_type,
      text,
      attachments,
      meta,
      sent_at,
      created_at
    `,
    [
      messageId,
      providerMessageId || null,
      JSON.stringify({
        providerResponse: providerResponse || null,
      }),
    ]
  );

  return normalizeMessage(result.rows?.[0] || null);
}

export async function createOutboundAttempt({
  db,
  messageId,
  threadId,
  tenantKey = getDefaultTenantKey(),
  channel = "instagram",
  provider = "meta",
  recipientId = null,
  payload = {},
  status = "queued",
  maxAttempts = 5,
  nextRetryAt = null,
}) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const result = await db.query(
    `
    insert into inbox_outbound_attempts (
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      payload,
      status,
      max_attempts,
      next_retry_at
    )
    values (
      $1::uuid,
      $2::uuid,
      $3::text,
      $4::text,
      $5::text,
      $6::text,
      $7::jsonb,
      $8::text,
      $9::int,
      $10::timestamptz
    )
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [
      messageId,
      threadId,
      resolvedTenantKey,
      channel,
      provider,
      recipientId,
      JSON.stringify(payload || {}),
      status,
      Number(maxAttempts || 5),
      nextRetryAt || null,
    ]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function getOutboundAttemptById(db, attemptId) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const result = await db.query(
    `
    select
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    from inbox_outbound_attempts
    where id = $1::uuid
    limit 1
    `,
    [attemptId]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function findLatestAttemptByMessageId(db, messageId) {
  if (!isDbReady(db)) return null;
  if (!messageId || !isUuid(messageId)) return null;

  const result = await db.query(
    `
    select
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    from inbox_outbound_attempts
    where message_id = $1::uuid
    order by created_at desc
    limit 1
    `,
    [messageId]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function listOutboundAttemptsByThread(db, threadId, limit = 100) {
  if (!isDbReady(db)) return [];
  if (!threadId || !isUuid(threadId)) return [];

  const result = await db.query(
    `
    select
      a.id,
      a.message_id,
      a.thread_id,
      a.tenant_key,
      a.channel,
      a.provider,
      a.recipient_id,
      a.provider_message_id,
      a.payload,
      a.provider_response,
      a.status,
      a.attempt_count,
      a.max_attempts,
      a.queued_at,
      a.first_attempt_at,
      a.last_attempt_at,
      a.next_retry_at,
      a.sent_at,
      a.last_error,
      a.last_error_code,
      a.created_at,
      a.updated_at,
      m.text as message_text,
      m.sender_type,
      m.message_type
    from inbox_outbound_attempts a
    left join inbox_messages m on m.id = a.message_id
    where a.thread_id = $1::uuid
    order by a.created_at desc
    limit $2::int
    `,
    [threadId, Number(limit || 100)]
  );

  return (result.rows || []).map((row) => ({
    ...toAttempt(row),
    message_text: row.message_text || "",
    sender_type: row.sender_type || "",
    message_type: row.message_type || "",
  }));
}

export async function listRetryableOutboundAttempts(db, limit = 50) {
  if (!isDbReady(db)) return [];

  const result = await db.query(
    `
    select
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    from inbox_outbound_attempts
    where status in ('queued','failed','retrying')
      and coalesce(next_retry_at, now()) <= now()
      and coalesce(attempt_count, 0) < coalesce(max_attempts, 5)
    order by coalesce(next_retry_at, created_at) asc, created_at asc
    limit $1::int
    `,
    [Number(limit || 50)]
  );

  return (result.rows || []).map(toAttempt);
}

export async function markOutboundAttemptSending(db, attemptId) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const result = await db.query(
    `
    update inbox_outbound_attempts
    set
      status = 'sending',
      attempt_count = coalesce(attempt_count, 0) + 1,
      first_attempt_at = coalesce(first_attempt_at, now()),
      last_attempt_at = now(),
      next_retry_at = null,
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [attemptId]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function markOutboundAttemptSent({
  db,
  attemptId,
  providerMessageId = null,
  providerResponse = {},
}) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const result = await db.query(
    `
    update inbox_outbound_attempts
    set
      status = 'sent',
      provider_message_id = coalesce($2::text, provider_message_id),
      provider_response = coalesce($3::jsonb, '{}'::jsonb),
      sent_at = now(),
      next_retry_at = null,
      last_error = null,
      last_error_code = null,
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [attemptId, providerMessageId, JSON.stringify(providerResponse || {})]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function markOutboundAttemptFailed({
  db,
  attemptId,
  error = "send failed",
  errorCode = "",
  providerResponse = {},
  retryDelaySeconds = 120,
}) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const existing = await getOutboundAttemptById(db, attemptId);
  if (!existing) return null;

  const attempts = Number(existing.attempt_count || 0);
  const maxAttempts = Number(existing.max_attempts || 5);
  const dead = attempts >= maxAttempts;
  const nextStatus = dead ? "dead" : "failed";

  const result = await db.query(
    `
    update inbox_outbound_attempts
    set
      status = $2::text,
      provider_response = coalesce($3::jsonb, '{}'::jsonb),
      last_error = $4::text,
      last_error_code = nullif($5::text, ''),
      next_retry_at = case
        when $2::text = 'dead' then null
        else now() + make_interval(secs => $6::int)
      end,
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [
      attemptId,
      nextStatus,
      JSON.stringify(providerResponse || {}),
      String(error || "send failed"),
      String(errorCode || ""),
      Number(retryDelaySeconds || 120),
    ]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function scheduleOutboundRetry({
  db,
  attemptId,
  retryDelaySeconds = 120,
}) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const result = await db.query(
    `
    update inbox_outbound_attempts
    set
      status = 'retrying',
      next_retry_at = now() + make_interval(secs => $2::int),
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [attemptId, Number(retryDelaySeconds || 120)]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function markOutboundAttemptDead(db, attemptId) {
  if (!isDbReady(db)) return null;
  if (!attemptId || !isUuid(attemptId)) return null;

  const result = await db.query(
    `
    update inbox_outbound_attempts
    set
      status = 'dead',
      next_retry_at = null,
      updated_at = now()
    where id = $1::uuid
    returning
      id,
      message_id,
      thread_id,
      tenant_key,
      channel,
      provider,
      recipient_id,
      provider_message_id,
      payload,
      provider_response,
      status,
      attempt_count,
      max_attempts,
      queued_at,
      first_attempt_at,
      last_attempt_at,
      next_retry_at,
      sent_at,
      last_error,
      last_error_code,
      created_at,
      updated_at
    `,
    [attemptId]
  );

  return toAttempt(result.rows?.[0] || null);
}

export async function getOutboundAttemptsSummary(
  db,
  tenantKey = getDefaultTenantKey()
) {
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  if (!isDbReady(db)) {
    return {
      tenantKey: resolvedTenantKey,
      queued: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
      dead: 0,
      total: 0,
    };
  }

  const result = await db.query(
    `
    select
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'sending')::int as sending,
      count(*) filter (where status = 'sent')::int as sent,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status = 'retrying')::int as retrying,
      count(*) filter (where status = 'dead')::int as dead,
      count(*)::int as total
    from inbox_outbound_attempts
    where tenant_key = $1::text
    `,
    [resolvedTenantKey]
  );

  const row = result.rows?.[0] || {};
  return {
    tenantKey: resolvedTenantKey,
    queued: Number(row.queued || 0),
    sending: Number(row.sending || 0),
    sent: Number(row.sent || 0),
    failed: Number(row.failed || 0),
    retrying: Number(row.retrying || 0),
    dead: Number(row.dead || 0),
    total: Number(row.total || 0),
  };
}

export async function listFailedOutboundAttempts(
  db,
  {
    tenantKey = getDefaultTenantKey(),
    limit = 50,
    status = "",
  } = {}
) {
  if (!isDbReady(db)) return [];

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const allowed = new Set(["failed", "retrying", "dead", "queued", "sending", "sent"]);
  const useStatus = allowed.has(String(status || "").trim()) ? String(status).trim() : "";

  const values = [resolvedTenantKey];
  let where = `where a.tenant_key = $1::text`;

  if (useStatus) {
    values.push(useStatus);
    where += ` and a.status = $${values.length}::text`;
  } else {
    where += ` and a.status in ('failed','retrying','dead')`;
  }

  values.push(Number(limit || 50));

  const result = await db.query(
    `
    select
      a.id,
      a.message_id,
      a.thread_id,
      a.tenant_key,
      a.channel,
      a.provider,
      a.recipient_id,
      a.provider_message_id,
      a.payload,
      a.provider_response,
      a.status,
      a.attempt_count,
      a.max_attempts,
      a.queued_at,
      a.first_attempt_at,
      a.last_attempt_at,
      a.next_retry_at,
      a.sent_at,
      a.last_error,
      a.last_error_code,
      a.created_at,
      a.updated_at,

      m.text as message_text,
      m.sender_type,
      m.message_type,

      t.external_username,
      t.external_user_id,
      t.customer_name
    from inbox_outbound_attempts a
    left join inbox_messages m on m.id = a.message_id
    left join inbox_threads t on t.id = a.thread_id
    ${where}
    order by coalesce(a.updated_at, a.created_at) desc
    limit $${values.length}::int
    `,
    values
  );

  return (result.rows || []).map((row) => ({
    ...toAttempt(row),
    message_text: row.message_text || "",
    sender_type: row.sender_type || "",
    message_type: row.message_type || "",
    external_username: row.external_username || "",
    external_user_id: row.external_user_id || "",
    customer_name: row.customer_name || "",
  }));
}

export async function getTenantServices(db, tenantId) {
  if (!isDbReady(db)) return [];
  if (!tenantId || !isUuid(tenantId)) return [];

  const canonicalRows = await queryRows(
    db,
    `
    select
      id,
      tenant_id,
      tenant_key,
      service_key,
      title,
      description,
      category,
      price_from,
      currency,
      pricing_model,
      duration_minutes,
      is_active,
      sort_order,
      highlights_json,
      metadata_json,
      created_at,
      updated_at
    from tenant_services
    where tenant_id = $1::uuid
    order by sort_order asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  if (canonicalRows.length) {
    return canonicalRows.map(normalizeTenantService).filter(Boolean);
  }

  const legacyRows = await queryRows(
    db,
    `
    select
      id,
      tenant_id,
      service_key,
      title,
      enabled,
      sellable,
      visible_in_ai,
      category,
      description_short,
      description_full,
      keywords,
      synonyms,
      example_requests,
      pricing_mode,
      contact_capture_mode,
      handoff_mode,
      response_mode,
      faq_answer,
      disabled_reply_text,
      sort_order,
      meta,
      created_at,
      updated_at
    from tenant_services
    where tenant_id = $1::uuid
    order by sort_order asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return legacyRows.map(normalizeTenantService).filter(Boolean);
}

export async function getTenantKnowledgeEntries(db, tenantId) {
  if (!isDbReady(db)) return [];
  if (!tenantId || !isUuid(tenantId)) return [];

  const canonicalRows = await queryRows(
    db,
    `
    select
      id,
      tenant_id,
      tenant_key,
      category,
      item_key,
      title,
      value_text,
      value_json,
      normalized_text,
      normalized_json,
      status,
      priority,
      metadata_json,
      created_at,
      updated_at
    from tenant_knowledge_items
    where tenant_id = $1::uuid
      and status in ('approved','active')
    order by priority asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  if (canonicalRows.length) {
    return canonicalRows.map(normalizeTenantKnowledgeEntry).filter(Boolean);
  }

  const legacyRows = await queryRows(
    db,
    `
    select
      id,
      tenant_id,
      entry_type,
      title,
      question,
      answer,
      language,
      service_key,
      intent_key,
      keywords,
      priority,
      enabled,
      meta,
      created_at,
      updated_at
    from tenant_knowledge_entries
    where tenant_id = $1::uuid
      and enabled = true
    order by priority asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return legacyRows.map(normalizeTenantKnowledgeEntry).filter(Boolean);
}

export async function getTenantResponsePlaybooks(db, tenantId) {
  if (!isDbReady(db)) return [];
  if (!tenantId || !isUuid(tenantId)) return [];

  const rows = await queryRows(
    db,
    `
    select
      id,
      tenant_id,
      intent_key,
      service_key,
      language,
      user_example,
      ideal_reply,
      reply_style,
      cta_type,
      priority,
      enabled,
      meta,
      created_at,
      updated_at
    from tenant_response_playbooks
    where tenant_id = $1::uuid
      and enabled = true
    order by priority asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return rows.map(normalizeTenantResponsePlaybook).filter(Boolean);
}

export async function getInboxThreadState(db, threadId) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  try {
    const result = await db.query(
      `
      select
        thread_id,
        tenant_id,
        tenant_key,
        last_customer_intent,
        last_customer_service_key,
        last_ai_intent,
        last_ai_service_key,
        last_ai_reply_hash,
        last_ai_reply_text,
        last_ai_cta_type,
        last_response_mode,
        contact_requested_at,
        contact_shared_at,
        pricing_explained_at,
        lead_created_at,
        handoff_announced_at,
        handoff_message_id,
        suppressed_until_operator_reply,
        repeat_intent_count,
        repeat_service_count,
        awaiting_customer_answer_to,
        last_decision_meta,
        created_at,
        updated_at
      from inbox_thread_state
      where thread_id = $1::uuid
      limit 1
      `,
      [threadId]
    );

    return normalizeInboxThreadState(result.rows?.[0] || null);
  } catch {
    return null;
  }
}

export async function upsertInboxThreadState(db, input = {}) {
  if (!isDbReady(db)) return null;

  const threadId = s(input.thread_id || input.threadId);
  if (!threadId || !isUuid(threadId)) return null;

  const tenantId = s(input.tenant_id || input.tenantId);
  const tenantKey = s(input.tenant_key || input.tenantKey);

  const handoffMessageId = s(input.handoff_message_id || input.handoffMessageId);
  const repeatIntentCount = Number.isFinite(Number(input.repeat_intent_count))
    ? Number(input.repeat_intent_count)
    : Number.isFinite(Number(input.repeatIntentCount))
      ? Number(input.repeatIntentCount)
      : 0;

  const repeatServiceCount = Number.isFinite(Number(input.repeat_service_count))
    ? Number(input.repeat_service_count)
    : Number.isFinite(Number(input.repeatServiceCount))
      ? Number(input.repeatServiceCount)
      : 0;

  const lastDecisionMeta = normalizeJsonObject(
    input.last_decision_meta || input.lastDecisionMeta
  );

  try {
    const result = await db.query(
      `
      insert into inbox_thread_state (
        thread_id,
        tenant_id,
        tenant_key,
        last_customer_intent,
        last_customer_service_key,
        last_ai_intent,
        last_ai_service_key,
        last_ai_reply_hash,
        last_ai_reply_text,
        last_ai_cta_type,
        last_response_mode,
        contact_requested_at,
        contact_shared_at,
        pricing_explained_at,
        lead_created_at,
        handoff_announced_at,
        handoff_message_id,
        suppressed_until_operator_reply,
        repeat_intent_count,
        repeat_service_count,
        awaiting_customer_answer_to,
        last_decision_meta
      )
      values (
        $1::uuid,
        nullif($2::text, '')::uuid,
        $3::text,
        nullif($4::text, ''),
        nullif($5::text, ''),
        nullif($6::text, ''),
        nullif($7::text, ''),
        nullif($8::text, ''),
        nullif($9::text, ''),
        nullif($10::text, ''),
        nullif($11::text, ''),
        $12::timestamptz,
        $13::timestamptz,
        $14::timestamptz,
        $15::timestamptz,
        $16::timestamptz,
        nullif($17::text, '')::uuid,
        $18::boolean,
        $19::int,
        $20::int,
        nullif($21::text, ''),
        $22::jsonb
      )
      on conflict (thread_id) do update
      set
        tenant_id = coalesce(excluded.tenant_id, inbox_thread_state.tenant_id),
        tenant_key = coalesce(nullif(excluded.tenant_key, ''), inbox_thread_state.tenant_key),
        last_customer_intent = coalesce(excluded.last_customer_intent, inbox_thread_state.last_customer_intent),
        last_customer_service_key = coalesce(excluded.last_customer_service_key, inbox_thread_state.last_customer_service_key),
        last_ai_intent = coalesce(excluded.last_ai_intent, inbox_thread_state.last_ai_intent),
        last_ai_service_key = coalesce(excluded.last_ai_service_key, inbox_thread_state.last_ai_service_key),
        last_ai_reply_hash = coalesce(excluded.last_ai_reply_hash, inbox_thread_state.last_ai_reply_hash),
        last_ai_reply_text = coalesce(excluded.last_ai_reply_text, inbox_thread_state.last_ai_reply_text),
        last_ai_cta_type = coalesce(excluded.last_ai_cta_type, inbox_thread_state.last_ai_cta_type),
        last_response_mode = coalesce(excluded.last_response_mode, inbox_thread_state.last_response_mode),
        contact_requested_at = coalesce(excluded.contact_requested_at, inbox_thread_state.contact_requested_at),
        contact_shared_at = coalesce(excluded.contact_shared_at, inbox_thread_state.contact_shared_at),
        pricing_explained_at = coalesce(excluded.pricing_explained_at, inbox_thread_state.pricing_explained_at),
        lead_created_at = coalesce(excluded.lead_created_at, inbox_thread_state.lead_created_at),
        handoff_announced_at = coalesce(excluded.handoff_announced_at, inbox_thread_state.handoff_announced_at),
        handoff_message_id = coalesce(excluded.handoff_message_id, inbox_thread_state.handoff_message_id),
        suppressed_until_operator_reply = excluded.suppressed_until_operator_reply,
        repeat_intent_count = excluded.repeat_intent_count,
        repeat_service_count = excluded.repeat_service_count,
        awaiting_customer_answer_to = coalesce(excluded.awaiting_customer_answer_to, inbox_thread_state.awaiting_customer_answer_to),
        last_decision_meta = coalesce(inbox_thread_state.last_decision_meta, '{}'::jsonb) || coalesce(excluded.last_decision_meta, '{}'::jsonb),
        updated_at = now()
      returning
        thread_id,
        tenant_id,
        tenant_key,
        last_customer_intent,
        last_customer_service_key,
        last_ai_intent,
        last_ai_service_key,
        last_ai_reply_hash,
        last_ai_reply_text,
        last_ai_cta_type,
        last_response_mode,
        contact_requested_at,
        contact_shared_at,
        pricing_explained_at,
        lead_created_at,
        handoff_announced_at,
        handoff_message_id,
        suppressed_until_operator_reply,
        repeat_intent_count,
        repeat_service_count,
        awaiting_customer_answer_to,
        last_decision_meta,
        created_at,
        updated_at
      `,
      [
        threadId,
        tenantId || null,
        tenantKey || "",
        s(input.last_customer_intent || input.lastCustomerIntent),
        s(input.last_customer_service_key || input.lastCustomerServiceKey),
        s(input.last_ai_intent || input.lastAiIntent),
        s(input.last_ai_service_key || input.lastAiServiceKey),
        s(input.last_ai_reply_hash || input.lastAiReplyHash),
        s(input.last_ai_reply_text || input.lastAiReplyText),
        s(input.last_ai_cta_type || input.lastAiCtaType),
        s(input.last_response_mode || input.lastResponseMode),
        input.contact_requested_at || input.contactRequestedAt || null,
        input.contact_shared_at || input.contactSharedAt || null,
        input.pricing_explained_at || input.pricingExplainedAt || null,
        input.lead_created_at || input.leadCreatedAt || null,
        input.handoff_announced_at || input.handoffAnnouncedAt || null,
        handoffMessageId || null,
        Boolean(
          input.suppressed_until_operator_reply || input.suppressedUntilOperatorReply
        ),
        repeatIntentCount,
        repeatServiceCount,
        s(input.awaiting_customer_answer_to || input.awaitingCustomerAnswerTo),
        JSON.stringify(lastDecisionMeta),
      ]
    );

    return normalizeInboxThreadState(result.rows?.[0] || null);
  } catch {
    return null;
  }
}

function lowerSlug(v) {
  return s(v)
    .toLowerCase()
    .replace(/[^a-z0-9əğıöşüç_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

async function getTenantServicesFallbackFromProfile(tenant) {
  const servicesRaw = arr(tenant?.profile?.services).length
    ? arr(tenant?.profile?.services)
    : arr(tenant?.meta?.services);

  return servicesRaw
    .map((item, idx) => {
      if (typeof item === "string") {
        return normalizeTenantService({
          id: `fallback-${idx + 1}`,
          tenant_id: s(tenant?.id),
          service_key: lowerSlug(item),
          title: s(item),
          is_active: true,
          category: "general",
          description: "",
          pricing_model: "quote_required",
          sort_order: idx,
          highlights_json: [s(item)],
          metadata_json: {},
        });
      }

      const x = obj(item);
      return normalizeTenantService({
        id: s(x.id || `fallback-${idx + 1}`),
        tenant_id: s(tenant?.id),
        service_key: s(x.service_key || x.key || lowerSlug(x.title || x.name)),
        title: s(x.title || x.name),
        is_active:
          typeof x.is_active === "boolean"
            ? x.is_active
            : typeof x.enabled === "boolean"
              ? x.enabled
              : true,
        visible_in_ai:
          typeof x.visible_in_ai === "boolean"
            ? x.visible_in_ai
            : true,
        category: s(x.category || "general"),
        description: s(x.description || x.description_short || x.details),
        pricing_model: s(x.pricing_model || "quote_required"),
        sort_order: Number(x.sort_order || idx),
        highlights_json: arr(x.highlights || x.keywords),
        metadata_json: x,
      });
    })
    .filter(Boolean);
}

async function getTenantKnowledgeFallback(tenant) {
  const meta = obj(tenant?.meta);
  const faq = arr(meta.faq).length ? meta.faq : arr(meta.knowledgeBase);

  return faq
    .map((item, idx) => {
      if (typeof item === "string") {
        return normalizeTenantKnowledgeEntry({
          id: `fallback-k-${idx + 1}`,
          tenant_id: s(tenant?.id),
          category: "faq",
          title: item,
          value_text: item,
          value_json: {},
          priority: idx + 1,
          status: "approved",
          metadata_json: {},
        });
      }

      const x = obj(item);
      return normalizeTenantKnowledgeEntry({
        id: s(x.id || `fallback-k-${idx + 1}`),
        tenant_id: s(tenant?.id),
        category: s(x.category || x.entry_type || "faq"),
        item_key: s(x.item_key || x.intent_key || ""),
        title: s(x.title || x.question),
        value_text: s(x.answer || x.content || x.text || x.value_text),
        value_json: {
          question: s(x.question),
          answer: s(x.answer || x.content || x.text),
          service_key: s(x.service_key),
          intent_key: s(x.intent_key),
          keywords: arr(x.keywords),
        },
        priority: Number(x.priority || idx + 1),
        status: typeof x.enabled === "boolean" && !x.enabled ? "inactive" : "approved",
        metadata_json: x,
      });
    })
    .filter((x) => x && (x.title || x.answer || x.value_text));
}

async function getTenantResponsePlaybooksFallback(tenant) {
  const meta = obj(tenant?.meta);
  const list = arr(meta.response_playbooks).length
    ? meta.response_playbooks
    : arr(meta.playbooks);

  return list
    .map((item, idx) => {
      const x = obj(item);
      return normalizeTenantResponsePlaybook({
        id: s(x.id || `fallback-p-${idx + 1}`),
        tenant_id: s(tenant?.id),
        intent_key: s(x.intent_key || x.intent || "general"),
        service_key: s(x.service_key),
        language: s(x.language || tenant?.default_language || "az"),
        user_example: s(x.user_example),
        ideal_reply: s(x.ideal_reply || x.replyTemplate || x.reply),
        reply_style: s(x.reply_style),
        cta_type: s(x.cta_type || x.actionType),
        priority: Number(x.priority || idx + 1),
        enabled: typeof x.enabled === "boolean" ? x.enabled : true,
        meta: x,
      });
    })
    .filter(Boolean);
}

export async function getTenantInboxBrainContext(db, tenantKey, threadId = "") {
  const runtime = await getTenantBrainRuntime({ db, tenantKey });
  const tenant = runtime?.tenant || null;

  if (!tenant?.id) {
    return {
      tenant: null,
      services: [],
      knowledgeEntries: [],
      responsePlaybooks: [],
      threadState: null,
    };
  }

  let threadState = null;

  if (threadId && isUuid(threadId)) {
    threadState = await getInboxThreadState(db, threadId);
  }

  let services = Array.isArray(runtime?.serviceCatalog)
    ? runtime.serviceCatalog
    : [];

  let knowledgeEntries = Array.isArray(runtime?.knowledgeEntries)
    ? runtime.knowledgeEntries
    : [];

  let responsePlaybooks = Array.isArray(runtime?.responsePlaybooks)
    ? runtime.responsePlaybooks
    : [];

  if (!services.length) {
    services = await getTenantServices(db, tenant.id);
  }
  if (!services.length) {
    services = await getTenantServicesFallbackFromProfile(tenant);
  }

  if (!knowledgeEntries.length) {
    knowledgeEntries = await getTenantKnowledgeEntries(db, tenant.id);
  }
  if (!knowledgeEntries.length) {
    knowledgeEntries = await getTenantKnowledgeFallback(tenant);
  }

  if (!responsePlaybooks.length) {
    responsePlaybooks = await getTenantResponsePlaybooks(db, tenant.id);
  }
  if (!responsePlaybooks.length) {
    responsePlaybooks = await getTenantResponsePlaybooksFallback(tenant);
  }

  return {
    tenant,
    services,
    knowledgeEntries,
    responsePlaybooks,
    threadState,
  };
}