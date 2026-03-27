import { isDbReady } from "../../../../utils/http.js";
import { resolveTenantKey } from "../../../../tenancy/index.js";
import {
  getTenantBrainRuntime,
  inspectTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import {
  normalizeTenantRow,
  s,
} from "./shared.js";

export async function getTenantByKey(
  db,
  tenantKey,
  {
    allowLegacyInspection = false,
    strictRuntimeLoader = getTenantBrainRuntime,
    inspectionRuntimeLoader = inspectTenantBrainRuntime,
  } = {}
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(tenantKey);
  const runtimeLoader = allowLegacyInspection
    ? inspectionRuntimeLoader
    : strictRuntimeLoader;

  try {
    const runtime = await runtimeLoader({
      db,
      tenantKey: resolvedTenantKey,
    });

    if (runtime?.tenant?.id) {
      return runtime.tenant;
    }
  } catch (error) {
    if (!allowLegacyInspection && isRuntimeAuthorityError(error)) {
      return null;
    }
    if (!allowLegacyInspection) {
      return null;
    }
  }

  if (!allowLegacyInspection) return null;

  try {
    const result = await db.query(
      `
      select
        t.id, t.tenant_key, t.company_name, t.legal_name, t.industry_key,
        t.timezone, t.default_language, t.supported_languages, t.enabled_languages,
        tp.brand_name, tp.website_url, tp.public_email, tp.public_phone, tp.audience_summary,
        tp.services_summary, tp.value_proposition, tp.brand_summary, tp.tone_of_voice,
        tp.preferred_cta, tp.banned_phrases, tp.communication_rules, tp.visual_style, tp.extra_context,
        ap.auto_reply_enabled, ap.suppress_ai_during_handoff, ap.mark_seen_enabled,
        ap.typing_indicator_enabled, ap.create_lead_enabled, ap.approval_required_content,
        ap.approval_required_publish, ap.quiet_hours_enabled, ap.quiet_hours, ap.inbox_policy,
        ap.comment_policy, ap.content_policy, ap.escalation_rules, ap.risk_rules,
        ap.lead_scoring_rules, ap.publish_policy
      from tenants t
      left join tenant_profiles tp on tp.tenant_id = t.id
      left join tenant_ai_policies ap on ap.tenant_id = t.id
      where t.tenant_key = $1::text
      limit 1
      `,
      [resolvedTenantKey]
    );

    return normalizeTenantRow(result.rows?.[0] || null);
  } catch {
    return null;
  }
}

export async function resolveTenantScopeForLead(
  db,
  tenantKey,
  { tenantLoader = getTenantByKey } = {}
) {
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const tenant = await tenantLoader(db, resolvedTenantKey);
  if (tenant?.id || tenant?.tenant_key) {
    return {
      tenantId: s(tenant?.id || ""),
      tenantKey: s(tenant?.tenant_key || resolvedTenantKey),
      companyName: s(tenant?.company_name || "") || s(tenant?.profile?.brand_name || ""),
    };
  }

  return {
    tenantId: "",
    tenantKey: resolvedTenantKey,
    companyName: "",
  };
}
