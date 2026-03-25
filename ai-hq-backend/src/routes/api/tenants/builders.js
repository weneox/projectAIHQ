import { hashUserPassword } from "../../../utils/adminAuth.js";
import {
  asBool,
  asJsonArr,
  asJsonObj,
  cleanLower,
  cleanNullableString,
  cleanString,
  cleanUpper,
  defaultEnabledLanguages,
  normalizeUserRole,
  normalizeUserStatus,
  safeEmail,
  slugTenantKey,
} from "./utils.js";

export function buildTenantCoreInput(body = {}) {
  const tenant = asJsonObj(body.tenant, body);

  const tenantKey = slugTenantKey(tenant.tenant_key || tenant.tenantKey || "");
  const companyName = cleanString(tenant.company_name || tenant.companyName || "");
  const legalName = cleanNullableString(tenant.legal_name || tenant.legalName);
  const industryKey = cleanLower(
    tenant.industry_key || tenant.industryKey || "generic_business"
  );
  const countryCode = cleanUpper(tenant.country_code || tenant.countryCode || "AZ");
  const timezone = cleanString(tenant.timezone || "Asia/Baku");
  const defaultLanguage = cleanLower(
    tenant.default_language || tenant.defaultLanguage || "az"
  );
  const enabledLanguages = defaultEnabledLanguages(
    tenant.enabled_languages || tenant.enabledLanguages || [defaultLanguage]
  );
  const marketRegion = cleanNullableString(
    tenant.market_region || tenant.marketRegion
  );

  return {
    tenant_key: tenantKey,
    company_name: companyName,
    legal_name: legalName,
    industry_key: industryKey,
    country_code: countryCode,
    timezone,
    default_language: defaultLanguage,
    enabled_languages: enabledLanguages,
    market_region: marketRegion,
  };
}

export function buildProfileInput(body = {}, core = {}) {
  const p = asJsonObj(body.profile, {});

  return {
    brand_name: cleanString(
      p.brand_name || p.brandName || core.company_name || ""
    ),
    website_url: cleanNullableString(p.website_url || p.websiteUrl),
    public_email: cleanNullableString(p.public_email || p.publicEmail),
    public_phone: cleanNullableString(p.public_phone || p.publicPhone),
    audience_summary: cleanString(p.audience_summary || p.audienceSummary || ""),
    services_summary: cleanString(p.services_summary || p.servicesSummary || ""),
    value_proposition: cleanString(
      p.value_proposition || p.valueProposition || ""
    ),
    brand_summary: cleanString(p.brand_summary || p.brandSummary || ""),
    tone_of_voice: cleanLower(
      p.tone_of_voice || p.toneOfVoice || "professional"
    ),
    preferred_cta: cleanString(p.preferred_cta || p.preferredCta || ""),
    banned_phrases: asJsonArr(p.banned_phrases || p.bannedPhrases, []),
    communication_rules: asJsonObj(
      p.communication_rules || p.communicationRules,
      {}
    ),
    visual_style: asJsonObj(p.visual_style || p.visualStyle, {}),
    extra_context: asJsonObj(p.extra_context || p.extraContext, {}),
  };
}

export function buildAiPolicyInput(body = {}) {
  const x = asJsonObj(body.aiPolicy, {});

  return {
    auto_reply_enabled: asBool(x.auto_reply_enabled, true),
    suppress_ai_during_handoff: asBool(x.suppress_ai_during_handoff, true),
    mark_seen_enabled: asBool(x.mark_seen_enabled, true),
    typing_indicator_enabled: asBool(x.typing_indicator_enabled, true),
    create_lead_enabled: asBool(x.create_lead_enabled, true),
    approval_required_content: asBool(x.approval_required_content, true),
    approval_required_publish: asBool(x.approval_required_publish, true),
    quiet_hours_enabled: asBool(x.quiet_hours_enabled, false),
    quiet_hours: asJsonObj(x.quiet_hours, { startHour: 0, endHour: 0 }),
    inbox_policy: asJsonObj(x.inbox_policy, {}),
    comment_policy: asJsonObj(x.comment_policy, {}),
    content_policy: asJsonObj(x.content_policy, {}),
    escalation_rules: asJsonObj(x.escalation_rules, {}),
    risk_rules: asJsonObj(x.risk_rules, {}),
    lead_scoring_rules: asJsonObj(x.lead_scoring_rules, {}),
    publish_policy: asJsonObj(x.publish_policy, {}),
  };
}

export function buildOwnerInput(body = {}, core = {}) {
  const owner = asJsonObj(body.owner, {});

  return {
    user_email: safeEmail(owner.user_email || owner.email || ""),
    full_name: cleanString(
      owner.full_name || owner.fullName || core.company_name || "Owner"
    ),
    role: "owner",
    status: "active",
    password_hash: cleanString(owner.password || "")
      ? hashUserPassword(cleanString(owner.password))
      : null,
    auth_provider: "local",
    email_verified: true,
    session_version: 1,
    permissions: asJsonObj(owner.permissions, {}),
    meta: asJsonObj(owner.meta, {}),
    last_seen_at: null,
  };
}

export function buildTenantUserInput(body = {}) {
  const x = asJsonObj(body, {});
  const password = cleanString(x.password || "");

  return {
    user_email: safeEmail(x.user_email || x.email || ""),
    full_name: cleanString(x.full_name || x.fullName || ""),
    role: normalizeUserRole(x.role || "member"),
    status: normalizeUserStatus(x.status || "invited"),
    password_hash: password ? hashUserPassword(password) : undefined,
    auth_provider: cleanLower(x.auth_provider || "local"),
    email_verified: Object.prototype.hasOwnProperty.call(x, "email_verified")
      ? asBool(x.email_verified, false)
      : true,
    session_version: Number.isFinite(Number(x.session_version))
      ? Number(x.session_version)
      : 1,
    permissions: asJsonObj(x.permissions, {}),
    meta: asJsonObj(x.meta, {}),
    last_seen_at: cleanNullableString(x.last_seen_at),
    last_login_at: cleanNullableString(x.last_login_at),
  };
}

export function pickDefaultAgents(body = {}) {
  const agents = asJsonArr(body.defaultAgents, []);
  if (agents.length) return agents;

  return [
    {
      agent_key: "orion",
      display_name: "Orion",
      role_summary: "Strategic planner and high-level business thinker.",
      enabled: true,
      model: "gpt-5",
      temperature: 0.4,
      prompt_overrides: {},
      tool_access: {},
      limits: {},
    },
    {
      agent_key: "nova",
      display_name: "Nova",
      role_summary: "Creative and content generation specialist.",
      enabled: true,
      model: "gpt-5",
      temperature: 0.8,
      prompt_overrides: {},
      tool_access: {},
      limits: {},
    },
    {
      agent_key: "atlas",
      display_name: "Atlas",
      role_summary: "Sales, operations, CRM and inbox specialist.",
      enabled: true,
      model: "gpt-5",
      temperature: 0.5,
      prompt_overrides: {},
      tool_access: {},
      limits: {},
    },
    {
      agent_key: "echo",
      display_name: "Echo",
      role_summary: "Analytics, QA and insight specialist.",
      enabled: true,
      model: "gpt-5",
      temperature: 0.3,
      prompt_overrides: {},
      tool_access: {},
      limits: {},
    },
  ];
}

export function pickChannels(body = {}) {
  return asJsonArr(body.channels, []);
}