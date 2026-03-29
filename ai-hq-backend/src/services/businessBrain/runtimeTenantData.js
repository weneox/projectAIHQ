import { resolveTenantKey } from "../../tenancy/index.js";
import { createTenantKnowledgeHelpers } from "../../db/helpers/tenantKnowledge.js";
import {
  dbListTenantBusinessFacts,
  dbListTenantChannelPolicies,
  dbListTenantContacts,
  dbListTenantLocations,
} from "../../db/helpers/tenantBusinessBrain.js";
import { createTenantExecutionPolicyControlHelpers } from "../../db/helpers/tenantExecutionPolicyControls.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
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

function logDbStepError(step, tenant, error) {
  console.error(`[runtimeTenantData] ${step} failed`, {
    tenantId: s(tenant?.id),
    tenantKey: s(tenant?.tenant_key),
    message: error?.message || String(error),
    code: error?.code || null,
    detail: error?.detail || null,
    hint: error?.hint || null,
    where: error?.where || null,
    constraint: error?.constraint || null,
    table: error?.table || null,
    column: error?.column || null,
    stack: error?.stack || null,
  });
}

async function runDbStep(step, tenant, fn) {
  try {
    return await fn();
  } catch (error) {
    logDbStepError(step, tenant, error);
    throw error;
  }
}

function isMissingRelationError(error) {
  return s(error?.code) === "42P01";
}

function canUseSavepoint(db) {
  return Boolean(
    db && typeof db.query === "function" && typeof db.release === "function"
  );
}

function makeSavepointName(prefix = "runtime_optional") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function runOptionalDbStep(step, tenant, db, fn, fallbackValue = []) {
  const useSavepoint = canUseSavepoint(db);
  const savepoint = useSavepoint ? makeSavepointName("runtime_optional") : "";

  try {
    if (useSavepoint) {
      await db.query(`SAVEPOINT ${savepoint}`);
    }

    const result = await fn();

    if (useSavepoint) {
      await db.query(`RELEASE SAVEPOINT ${savepoint}`);
    }

    return result;
  } catch (error) {
    console.warn(
      `[runtimeTenantData] ${step} optional step failed; falling back`,
      {
        tenantId: s(tenant?.id),
        tenantKey: s(tenant?.tenant_key),
        message: error?.message || String(error),
        code: error?.code || null,
        detail: error?.detail || null,
        hint: error?.hint || null,
        where: error?.where || null,
        constraint: error?.constraint || null,
        table: error?.table || null,
        column: error?.column || null,
      }
    );

    if (useSavepoint) {
      try {
        await db.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await db.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (rollbackError) {
        console.error(`[runtimeTenantData] ${step} optional rollback failed`, {
          tenantId: s(tenant?.id),
          tenantKey: s(tenant?.tenant_key),
          message: rollbackError?.message || String(rollbackError),
          code: rollbackError?.code || null,
          detail: rollbackError?.detail || null,
          hint: rollbackError?.hint || null,
          where: rollbackError?.where || null,
          constraint: rollbackError?.constraint || null,
          table: rollbackError?.table || null,
          column: rollbackError?.column || null,
          stack: rollbackError?.stack || null,
        });
        throw rollbackError;
      }
    }

    return fallbackValue;
  }
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
    if (
      providedTenant &&
      (providedTenant.id ||
        providedTenant.tenant_key ||
        providedTenant.tenantKey)
    ) {
      return normalizeProvidedTenant(providedTenant);
    }
    return null;
  }

  const id = s(tenantId) || s(providedTenant.id) || s(providedTenant.tenant_id);
  const resolvedTenantKey = tenantKey
    ? resolveTenantKey(tenantKey)
    : resolveTenantKey(
        s(providedTenant.tenant_key || providedTenant.tenantKey)
      );

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
  } else if (
    providedTenant &&
    (providedTenant.id ||
      providedTenant.tenant_key ||
      providedTenant.tenantKey)
  ) {
    return normalizeProvidedTenant(providedTenant);
  } else {
    return null;
  }

  const row = result?.rows?.[0];
  if (!row) {
    if (
      providedTenant &&
      (providedTenant.id ||
        providedTenant.tenant_key ||
        providedTenant.tenantKey)
    ) {
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

async function loadTenantServices({ db, tenantId }) {
  if (!hasDb(db) || !tenantId) return [];

  const result = await db.query(
    `
    select *
    from tenant_services
    where tenant_id = $1::uuid
    `,
    [tenantId]
  );

  return sortRowsByPriority(arr(result?.rows));
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
    } catch (error) {
      if (isMissingRelationError(error)) {
        continue;
      }

      logDbStepError(
        `loadTenantResponsePlaybooks:${tableName}`,
        { id: tenantId },
        error
      );
      throw error;
    }
  }

  return [];
}

async function loadTenantPolicyControls({ db, tenant }) {
  if (!hasDb(db) || !tenant?.id) {
    return {
      tenantDefault: {},
      items: [],
    };
  }

  const controls = createTenantExecutionPolicyControlHelpers({ db });
  const rows = await runOptionalDbStep(
    "loadTenantPolicyControls",
    tenant,
    db,
    () =>
      controls.listControls({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      }),
    []
  );

  return {
    tenantDefault:
      arr(rows).find((item) => String(item.surface).toLowerCase() === "tenant") || {},
    items: arr(rows).filter((item) => String(item.surface).toLowerCase() !== "tenant"),
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

  const businessProfile = await runDbStep(
    "knowledge.getBusinessProfile",
    tenant,
    () =>
      knowledge.getBusinessProfile({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const capabilities = await runDbStep(
    "knowledge.getBusinessCapabilities",
    tenant,
    () =>
      knowledge.getBusinessCapabilities({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const activeKnowledge = await runDbStep(
    "knowledge.listActiveKnowledge",
    tenant,
    () =>
      knowledge.listActiveKnowledge({
        tenantId: tenant.id,
        tenantKey: tenant.tenant_key,
      })
  );

  const facts = await runDbStep("dbListTenantBusinessFacts", tenant, () =>
    dbListTenantBusinessFacts(db, tenant.id, { enabledOnly: true })
  );

  const contacts = await runDbStep("dbListTenantContacts", tenant, () =>
    dbListTenantContacts(db, tenant.id)
  );

  const locations = await runDbStep("dbListTenantLocations", tenant, () =>
    dbListTenantLocations(db, tenant.id)
  );

  const channelPolicies = await runDbStep(
    "dbListTenantChannelPolicies",
    tenant,
    () => dbListTenantChannelPolicies(db, tenant.id)
  );

  const tenantServices = await runDbStep("loadTenantServices", tenant, () =>
    loadTenantServices({ db, tenantId: tenant.id })
  );

  const storedResponsePlaybooks = await runOptionalDbStep(
    "loadStoredResponsePlaybooks",
    tenant,
    db,
    async () => {
      if (typeof knowledge.listResponsePlaybooks === "function") {
        return knowledge.listResponsePlaybooks({
          tenantId: tenant.id,
          tenantKey: tenant.tenant_key,
        });
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
    },
    []
  );

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

  const tenantRef = { id: tenantId, tenant_key: tenantKey };

  const current = await runDbStep(
    "getCurrentTenantRuntimeProjection",
    tenantRef,
    () => getCurrentTenantRuntimeProjection({ tenantId, tenantKey }, db)
  );

  if (current) {
    const freshness = await runDbStep(
      "getTenantRuntimeProjectionFreshness",
      tenantRef,
      () =>
        getTenantRuntimeProjectionFreshness(
          {
            tenantId,
            tenantKey,
            runtimeProjection: current,
          },
          db
        )
    );

    if (!freshness?.stale) {
      return { projection: current, freshness };
    }

    throw createRuntimeAuthorityError({
      mode: "strict",
      tenantId,
      tenantKey,
      runtimeProjection: current,
      freshness,
      reasonCode: "runtime_projection_stale",
      reason: "runtime_projection_stale",
      message:
        "Approved runtime projection is stale and automatic rebuild is disabled until a governed runtime refresh occurs.",
    });
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
  loadTenantPolicyControls,
};
