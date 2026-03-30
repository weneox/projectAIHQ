// src/routes/api/inbox/shared.js
// FINAL v1.1 — inbox shared helpers and normalizers
// migrated from inbox.shared.js

import { deepFix, fixText } from "../../../utils/textFix.js";

export function toInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function s(v) {
  return String(v ?? "").trim();
}

export function truthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v ?? "").trim().toLowerCase());
}

function toMs(v) {
  if (!v) return 0;

  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;

  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function asObject(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? deepFix(x) : {};
}

function asArray(x) {
  return Array.isArray(x) ? deepFix(x) : [];
}

function asStringArray(x) {
  return Array.isArray(x)
    ? x.map((v) => fixText(String(v ?? ""))).filter(Boolean)
    : [];
}

function splitSummaryToList(text) {
  return fixText(text || "")
    .split(/[,;\n]/g)
    .map((x) => fixText(x))
    .filter(Boolean);
}

function boolOr(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}

export function sortMessagesChronologically(list = []) {
  return [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => toMs(a?.sent_at || a?.created_at) - toMs(b?.sent_at || b?.created_at)
  );
}

export function normalizeThread(row) {
  if (!row) return null;

  const meta = asObject(row.meta);
  const handoffMeta = asObject(meta.handoff);

  const labels = Array.isArray(row.labels)
    ? row.labels.map((x) => fixText(String(x ?? ""))).filter(Boolean)
    : [];

  return {
    ...row,
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    channel: fixText(row.channel || ""),
    external_thread_id: fixText(row.external_thread_id || ""),
    external_user_id: fixText(row.external_user_id || ""),
    external_username: fixText(row.external_username || ""),
    customer_name: fixText(row.customer_name || ""),
    status: fixText(row.status || ""),
    unread_count: Number(row.unread_count || 0),
    assigned_to: fixText(row.assigned_to || ""),
    labels,
    meta,

    handoff_active:
      typeof row.handoff_active === "boolean"
        ? row.handoff_active
        : Boolean(handoffMeta.active),

    handoff_reason: fixText(row.handoff_reason || handoffMeta.reason || ""),
    handoff_priority: fixText(row.handoff_priority || handoffMeta.priority || "normal"),
    handoff_at: row.handoff_at || handoffMeta.at || null,
    handoff_by: fixText(row.handoff_by || handoffMeta.by || ""),

    last_message_at: row.last_message_at || null,
    last_inbound_at: row.last_inbound_at || null,
    last_outbound_at: row.last_outbound_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeMessage(row) {
  if (!row) return null;

  return {
    ...row,
    id: s(row.id),
    thread_id: s(row.thread_id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    direction: fixText(row.direction || ""),
    sender_type: fixText(row.sender_type || ""),
    external_message_id: fixText(row.external_message_id || ""),
    message_type: fixText(row.message_type || ""),
    text: fixText(row.text || ""),
    attachments: asArray(row.attachments),
    meta: asObject(row.meta),
    sent_at: row.sent_at || null,
    created_at: row.created_at || null,
  };
}

export function buildOutboundAttemptCorrelation({
  messageId,
  attemptIds = [],
  latestAttemptId = null,
  durableExecutionIds = [],
  referencedAttemptIds = [],
} = {}) {
  const normalizedMessageId = s(messageId);
  if (!normalizedMessageId) return null;

  const normalizedAttemptIds = Array.isArray(attemptIds)
    ? attemptIds.map((id) => s(id)).filter(Boolean)
    : [];
  const normalizedLatestAttemptId =
    s(latestAttemptId || normalizedAttemptIds[0] || "") || null;
  const normalizedDurableExecutionIds = Array.isArray(durableExecutionIds)
    ? durableExecutionIds.map((id) => s(id)).filter(Boolean)
    : [];
  const normalizedReferencedAttemptIds = Array.isArray(referencedAttemptIds)
    ? referencedAttemptIds.map((id) => s(id)).filter(Boolean)
    : [];

  let correlationState = "historical_missing_attempt";
  let reasonCode = "legacy_message_without_attempt_records";
  let historicalException = true;

  if (normalizedAttemptIds.length) {
    correlationState = "correlated";
    reasonCode = "attempt_records_present";
    historicalException = false;
  } else if (
    normalizedDurableExecutionIds.length ||
    normalizedReferencedAttemptIds.length
  ) {
    correlationState = "missing_attempt";
    reasonCode = "durable_execution_without_attempt_record";
    historicalException = false;
  }

  return {
    message_id: normalizedMessageId,
    latest_attempt_id: normalizedLatestAttemptId,
    attempt_ids: normalizedAttemptIds,
    durable_execution_ids: normalizedDurableExecutionIds,
    referenced_attempt_ids: normalizedReferencedAttemptIds,
    correlation_state: correlationState,
    reason_code: reasonCode,
    historical_exception: historicalException,
  };
}

export function withMessageOutboundAttemptCorrelation(message, correlation = null) {
  if (!message || typeof message !== "object") return message;
  if (s(message.direction).toLowerCase() !== "outbound") return message;

  const normalized =
    correlation && typeof correlation === "object"
      ? buildOutboundAttemptCorrelation({
          messageId: correlation.message_id || correlation.messageId || message.id,
          attemptIds: correlation.attempt_ids || correlation.attemptIds || [],
          latestAttemptId:
            correlation.latest_attempt_id || correlation.latestAttemptId || null,
        })
      : buildOutboundAttemptCorrelation({ messageId: message.id });

  return {
    ...message,
    outbound_attempt_correlation: normalized,
  };
}

export function normalizeLead(row) {
  if (!row) return null;

  return {
    ...row,
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    source: fixText(row.source || ""),
    source_ref: fixText(row.source_ref || ""),
    inbox_thread_id: s(row.inbox_thread_id),
    proposal_id: s(row.proposal_id),

    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),

    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),

    stage: fixText(row.stage || ""),
    score: Number(row.score || 0),
    status: fixText(row.status || ""),

    owner: fixText(row.owner || ""),
    priority: fixText(row.priority || ""),
    value_azn: Number(row.value_azn || 0),
    follow_up_at: row.follow_up_at || null,
    next_action: fixText(row.next_action || ""),
    won_reason: fixText(row.won_reason || ""),
    lost_reason: fixText(row.lost_reason || ""),

    extra: asObject(row.extra),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeTenant(row) {
  if (!row) return null;

  const communicationRules = asObject(row.communication_rules);
  const visualStyle = asObject(row.visual_style);
  const extraContext = asObject(row.extra_context);

  const quietHours = asObject(row.quiet_hours);
  const inboxPolicyRaw = asObject(row.inbox_policy);
  const commentPolicy = asObject(row.comment_policy);
  const contentPolicy = asObject(row.content_policy);
  const escalationRules = asObject(row.escalation_rules);
  const riskRules = asObject(row.risk_rules);
  const leadScoringRules = asObject(row.lead_scoring_rules);
  const publishPolicy = asObject(row.publish_policy);

  const supportedLanguages = asStringArray(row.supported_languages);
  const enabledLanguages = asStringArray(row.enabled_languages);
  const finalLanguages = supportedLanguages.length
    ? supportedLanguages
    : enabledLanguages.length
      ? enabledLanguages
      : [fixText(row.default_language || "az")];

  const bannedPhrases = asStringArray(row.banned_phrases);

  const brandName = fixText(row.brand_name || row.company_name || row.tenant_key || "");
  const servicesList = splitSummaryToList(row.services_summary);
  const audienceSummary = fixText(row.audience_summary || "");
  const servicesSummary = fixText(row.services_summary || "");
  const valueProposition = fixText(row.value_proposition || "");
  const brandSummary = fixText(row.brand_summary || "");
  const toneOfVoice = fixText(row.tone_of_voice || "professional");
  const preferredCta = fixText(row.preferred_cta || "");
  const timezone = fixText(row.timezone || "Asia/Baku");
  const defaultLanguage = fixText(row.default_language || "az");
  const industryKey = fixText(row.industry_key || "generic_business");

  const aiPolicy = {
    auto_reply_enabled: boolOr(row.auto_reply_enabled, true),
    suppress_ai_during_handoff: boolOr(row.suppress_ai_during_handoff, true),
    mark_seen_enabled: boolOr(row.mark_seen_enabled, true),
    typing_indicator_enabled: boolOr(row.typing_indicator_enabled, true),
    create_lead_enabled: boolOr(row.create_lead_enabled, true),
    approval_required_content: boolOr(row.approval_required_content, true),
    approval_required_publish: boolOr(row.approval_required_publish, true),
    quiet_hours_enabled: boolOr(row.quiet_hours_enabled, false),
    quiet_hours: quietHours,
    inbox_policy: inboxPolicyRaw,
    comment_policy: commentPolicy,
    content_policy: contentPolicy,
    escalation_rules: escalationRules,
    risk_rules: riskRules,
    lead_scoring_rules: leadScoringRules,
    publish_policy: publishPolicy,
  };

  const inboxPolicy = {
    ...inboxPolicyRaw,

    autoReplyEnabled:
      typeof inboxPolicyRaw.autoReplyEnabled === "boolean"
        ? inboxPolicyRaw.autoReplyEnabled
        : aiPolicy.auto_reply_enabled,

    markSeenEnabled:
      typeof inboxPolicyRaw.markSeenEnabled === "boolean"
        ? inboxPolicyRaw.markSeenEnabled
        : aiPolicy.mark_seen_enabled,

    typingIndicatorEnabled:
      typeof inboxPolicyRaw.typingIndicatorEnabled === "boolean"
        ? inboxPolicyRaw.typingIndicatorEnabled
        : aiPolicy.typing_indicator_enabled,

    createLeadEnabled:
      typeof inboxPolicyRaw.createLeadEnabled === "boolean"
        ? inboxPolicyRaw.createLeadEnabled
        : aiPolicy.create_lead_enabled,

    suppressAiDuringHandoff:
      typeof inboxPolicyRaw.suppressAiDuringHandoff === "boolean"
        ? inboxPolicyRaw.suppressAiDuringHandoff
        : aiPolicy.suppress_ai_during_handoff,

    quietHoursEnabled:
      typeof inboxPolicyRaw.quietHoursEnabled === "boolean"
        ? inboxPolicyRaw.quietHoursEnabled
        : aiPolicy.quiet_hours_enabled,

    quietHours:
      Object.keys(asObject(inboxPolicyRaw.quietHours)).length
        ? asObject(inboxPolicyRaw.quietHours)
        : quietHours,

    timezone:
      fixText(inboxPolicyRaw.timezone || timezone) || "Asia/Baku",
  };

  return {
    id: s(row.id) || null,
    tenant_id: s(row.id) || null,
    tenant_key: fixText(row.tenant_key || ""),

    name: brandName,
    company_name: fixText(row.company_name || ""),
    legal_name: fixText(row.legal_name || ""),
    industry_key: industryKey,
    country_code: fixText(row.country_code || ""),
    timezone,
    default_language: defaultLanguage,
    supported_languages: finalLanguages,
    enabled_languages: finalLanguages,
    market_region: fixText(row.market_region || ""),
    plan_key: fixText(row.plan_key || ""),
    status: fixText(row.status || ""),
    active: row.active !== false,
    onboarding_completed_at: row.onboarding_completed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    profile: {
      brand_name: brandName,
      website_url: fixText(row.website_url || ""),
      public_email: fixText(row.public_email || ""),
      public_phone: fixText(row.public_phone || ""),
      audience_summary: audienceSummary,
      services_summary: servicesSummary,
      value_proposition: valueProposition,
      brand_summary: brandSummary,
      tone_of_voice: toneOfVoice,
      preferred_cta: preferredCta,
      banned_phrases: bannedPhrases,
      communication_rules: communicationRules,
      visual_style: visualStyle,
      extra_context: extraContext,
      services: servicesList,
      languages: finalLanguages,
      industry_key: industryKey,
    },

    ai_policy: aiPolicy,

    brand: {
      displayName: brandName,
      name: brandName,
      email: fixText(row.public_email || ""),
      phone: fixText(row.public_phone || ""),
      website: fixText(row.website_url || ""),
      tone: toneOfVoice,
      industry: industryKey,
      languages: finalLanguages,
    },

    features: {
      industry: industryKey,
    },

    meta: {
      industry: industryKey,
      businessSummary: brandSummary || valueProposition || servicesSummary,
      audienceSummary,
      servicesSummary,
      services: servicesList,
      valueProposition,
      tone: toneOfVoice,
      preferredCta,
      bannedPhrases,
      communicationRules,
      visualStyle,
      extraContext,
      languages: finalLanguages,
    },

    inbox_policy: inboxPolicy,
    comment_policy: commentPolicy,
    content_policy: contentPolicy,
    quiet_hours: quietHours,
    escalation_rules: escalationRules,
    risk_rules: riskRules,
    lead_scoring_rules: leadScoringRules,
    publish_policy: publishPolicy,
  };
}
