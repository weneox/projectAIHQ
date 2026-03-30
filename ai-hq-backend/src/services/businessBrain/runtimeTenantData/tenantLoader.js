import { resolveTenantKey } from "../../../tenancy/index.js";
import { hasDb, obj, s } from "../runtimeShared.js";
import {
  isHydratedTenant,
  mapLegacyTenantRow,
  normalizeProvidedTenant,
} from "./shared.js";

const LEGACY_TENANT_SELECT = `
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
`;

function hasProvidedTenantIdentity(tenant) {
  return Boolean(tenant && (tenant.id || tenant.tenant_key || tenant.tenantKey));
}

async function queryLegacyTenantById(db, tenantId) {
  return db.query(
    `
    ${LEGACY_TENANT_SELECT}
    where t.id = $1::uuid
    limit 1
    `,
    [tenantId]
  );
}

async function queryLegacyTenantByKey(db, tenantKey) {
  return db.query(
    `
    ${LEGACY_TENANT_SELECT}
    where t.tenant_key = $1::text
    limit 1
    `,
    [tenantKey]
  );
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
    if (hasProvidedTenantIdentity(providedTenant)) {
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
    result = await queryLegacyTenantById(db, id);
  } else if (resolvedTenantKey) {
    result = await queryLegacyTenantByKey(db, resolvedTenantKey);
  } else if (hasProvidedTenantIdentity(providedTenant)) {
    return normalizeProvidedTenant(providedTenant);
  } else {
    return null;
  }

  const row = result?.rows?.[0];
  if (!row) {
    if (hasProvidedTenantIdentity(providedTenant)) {
      return normalizeProvidedTenant(providedTenant);
    }
    return null;
  }

  return mapLegacyTenantRow(row);
}

export {
  LEGACY_TENANT_SELECT,
  hasProvidedTenantIdentity,
  loadLegacyTenant,
  queryLegacyTenantById,
  queryLegacyTenantByKey,
};
