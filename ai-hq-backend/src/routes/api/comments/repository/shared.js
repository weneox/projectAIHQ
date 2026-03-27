import { deepFix } from "../../../../utils/textFix.js";
import { s, normalizeComment, normalizeLead } from "../utils.js";

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function normalizeTenantRow(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_key: s(row.tenant_key),
    company_name: s(row.company_name),
    legal_name: s(row.legal_name),
    industry_key: s(row.industry_key),
    timezone: s(row.timezone || "Asia/Baku"),
    default_language: s(row.default_language || "az"),
    supported_languages: arr(row.supported_languages),
    enabled_languages: arr(row.enabled_languages),
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
    ai_policy: {
      auto_reply_enabled: Boolean(row.auto_reply_enabled),
      suppress_ai_during_handoff: Boolean(row.suppress_ai_during_handoff),
      mark_seen_enabled: Boolean(row.mark_seen_enabled),
      typing_indicator_enabled: Boolean(row.typing_indicator_enabled),
      create_lead_enabled: Boolean(row.create_lead_enabled),
      approval_required_content: Boolean(row.approval_required_content),
      approval_required_publish: Boolean(row.approval_required_publish),
      quiet_hours_enabled: Boolean(row.quiet_hours_enabled),
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
  };
}

export async function queryOne(db, text, params = []) {
  try {
    const result = await db.query(text, params);
    return result.rows?.[0] || null;
  } catch {
    return null;
  }
}

export function normalizeLeadStage(v) {
  const x = s(v).toLowerCase();
  if (["new", "contacted", "qualified", "proposal", "won", "lost"].includes(x)) {
    return x;
  }
  return "new";
}

export function normalizeLeadStatus(v) {
  const x = s(v).toLowerCase();
  if (["open", "archived", "spam", "closed"].includes(x)) return x;
  return "open";
}

export function normalizePriority(v) {
  const x = s(v).toLowerCase();
  if (["low", "normal", "medium", "high", "urgent"].includes(x)) {
    return x === "medium" ? "normal" : x;
  }
  return "normal";
}

export function normalizeLeadScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export { deepFix, normalizeComment, normalizeLead, s };
