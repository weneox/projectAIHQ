import { resolveTenantKey } from "../../tenancy/index.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";
import {
  dbListTenantBusinessFacts,
  dbListTenantChannelPolicies,
  dbListTenantContacts,
  dbListTenantLocations,
} from "../../db/helpers/tenantBusinessBrain.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
  refreshTenantRuntimeProjectionStrict,
} from "../../db/helpers/tenantRuntimeProjection.js";
import { createRuntimeAuthorityError } from "./runtimeAuthority.js";
import {
  arr,
  boolOrUndefined,
  hasDb,
  isHydratedTenant,
  normalizeLanguage,
  normalizeLanguageList,
  obj,
  s,
  safeQuery,
  sortRowsByPriority,
} from "./runtimeShared.js";

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

  const id = s(tenantId) || s(providedTenant.id) || s(providedTenant.tenant_id);
  const resolvedTenantKey = tenantKey
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

  const candidateTables = ["tenant_response_playbooks", "response_playbooks"];

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
      return { projection: current, freshness };
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
      return {
        projection: refreshed.projection,
        freshness: refreshed.freshness || freshness,
      };
    }

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantId,
      tenantKey,
      runtimeProjection: current,
      freshness,
      reasonCode: "runtime_projection_stale",
      reason: "runtime_projection_stale",
      message: "Approved runtime projection is stale and could not be refreshed.",
    });
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

  if (obj(refreshed?.projection).id) {
    return {
      projection: refreshed.projection,
      freshness: refreshed.freshness || null,
    };
  }

  return {
    projection: null,
    freshness: null,
  };
}

export {
  loadCurrentProjection,
  loadDbBrainData,
  loadLegacyTenant,
};
