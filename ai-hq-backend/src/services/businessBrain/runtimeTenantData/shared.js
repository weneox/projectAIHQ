import {
  arr,
  boolOrUndefined,
  isHydratedTenant,
  normalizeLanguage,
  normalizeLanguageList,
  obj,
  s,
  sortRowsByPriority,
} from "../runtimeShared.js";

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
    industry_key: s(
      tenant.industry_key || tenant.industryKey || "generic_business"
    ),
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
      industry: s(
        tenant?.brand?.industry || tenant.industry_key || "generic_business"
      ),
      defaultLanguage,
      languages: supportedLanguages,
    },
    ai_policy: obj(tenant.ai_policy || tenant.aiPolicy),
    inbox_policy: obj(tenant.inbox_policy || tenant.inboxPolicy),
    comment_policy: obj(tenant.comment_policy || tenant.commentPolicy),
    meta: obj(tenant.meta),
  };
}

function mapLegacyTenantRow(row = {}) {
  const defaultLanguage = normalizeLanguage(row.default_language || "az", "az");
  const enabledLanguages = normalizeLanguageList(
    row.enabled_languages,
    row.default_language,
    defaultLanguage
  );
  const supportedLanguages = enabledLanguages.length
    ? enabledLanguages
    : [defaultLanguage];
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
      suppress_ai_during_handoff: boolOrUndefined(
        row.suppress_ai_during_handoff
      ),
      mark_seen_enabled: boolOrUndefined(row.mark_seen_enabled),
      typing_indicator_enabled: boolOrUndefined(row.typing_indicator_enabled),
      create_lead_enabled: boolOrUndefined(row.create_lead_enabled),
      approval_required_content: boolOrUndefined(
        row.approval_required_content
      ),
      approval_required_publish: boolOrUndefined(
        row.approval_required_publish
      ),
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

export {
  isHydratedTenant,
  mapLegacyTenantRow,
  normalizeProvidedTenant,
  sortRowsByPriority,
};
