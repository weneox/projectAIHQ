// ai-hq-backend/src/routes/api/inbox/repository/authority.js

import { isDbReady, isUuid } from "../../../../utils/http.js";
import {
  getDefaultTenantKey,
  resolveTenantKey,
} from "../../../../tenancy/index.js";
import {
  getTenantBrainRuntime,
  inspectTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { normalizeTenant, s } from "../shared.js";
import {
  arr,
  buildTenantLanguages,
  lowerSlug,
  normalizeJsonArray,
  normalizeJsonObject,
  normalizeTenantKnowledgeEntry,
  normalizeTenantResponsePlaybook,
  normalizeTenantService,
  obj,
  queryRows,
} from "./shared.js";
import { getInboxThreadState } from "./threadState.js";

function buildStrictRuntimeAuthorityError(error, tenantKey, extra = {}) {
  const source =
    error instanceof Error
      ? error
      : new Error(s(error?.message || "Runtime authority is unavailable"));

  const incoming = obj(error);
  const existingAuthority = obj(source.runtimeAuthority);
  const existingDetails = obj(source.details);
  const incomingDetails = obj(incoming.details);
  const extraObj = obj(extra);
  const resolvedTenantKey = resolveTenantKey(tenantKey);

  const code = s(
    existingAuthority.code ||
      incoming.code ||
      incomingDetails.code ||
      source.code ||
      "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE"
  );

  const reasonCode = s(
    existingAuthority.reasonCode ||
      incoming.reasonCode ||
      incoming.reason_code ||
      incomingDetails.reasonCode ||
      incomingDetails.reason_code ||
      source.reasonCode ||
      source.reason_code ||
      lowerSlug(code) ||
      "runtime_authority_unavailable"
  );

  const statusCode = Number(
    existingAuthority.statusCode ||
      incoming.statusCode ||
      incoming.status_code ||
      incomingDetails.statusCode ||
      incomingDetails.status_code ||
      source.statusCode ||
      source.status_code ||
      409
  );

  const message = s(
    existingAuthority.message ||
      incoming.message ||
      incomingDetails.message ||
      source.message ||
      "Runtime authority is unavailable"
  );

  const authorityPayload = {
    ...existingAuthority,
    ...obj(incoming.runtimeAuthority),
    ...obj(incoming.authority),
    ...obj(existingDetails.authority),
    ...obj(incomingDetails.authority),
    ...extraObj,

    required: true,
    blocked: true,
    failClosed: true,
    fail_closed: true,
    strict: true,
    strictMode: true,
    strict_mode: true,
    mode: "strict",
    unavailable: true,
    available: false,
    authorityMode: "strict",
    authority_mode: "strict",
    tenantKey: resolvedTenantKey,
    tenant_key: resolvedTenantKey,
    code,
    reasonCode,
    reason_code: reasonCode,
    statusCode,
    status_code: statusCode,
    message,
    status: "blocked",
    ok: false,
    retryable: false,
    isRuntimeAuthorityError: true,
    runtimeAuthorityError: true,
    runtime_authority_error: true,
    runtimeAuthorityUnavailable: true,
    runtime_authority_unavailable: true,
    authorityUnavailable: true,
    authority_unavailable: true,
    isAuthorityUnavailable: true,
    is_authority_unavailable: true,
    isFailClosed: true,
    is_fail_closed: true,
    isStrict: true,
    is_strict: true,
    resolved: false,
    authoritative: false,
  };

  const detailsPayload = {
    ...existingDetails,
    ...incomingDetails,
    ...extraObj,

    code,
    reasonCode,
    reason_code: reasonCode,
    statusCode,
    status_code: statusCode,
    message,
    tenantKey: resolvedTenantKey,
    tenant_key: resolvedTenantKey,

    blocked: true,
    failClosed: true,
    fail_closed: true,
    strict: true,
    strictMode: true,
    strict_mode: true,
    unavailable: true,
    available: false,
    authorityMode: "strict",
    authority_mode: "strict",
    ok: false,
    retryable: false,
    resolved: false,
    authoritative: false,

    authority: authorityPayload,
    runtimeAuthority: authorityPayload,
  };

  source.name = s(source.name || "Error");
  source.code = code;
  source.reasonCode = reasonCode;
  source.reason_code = reasonCode;
  source.statusCode = statusCode;
  source.status_code = statusCode;
  source.message = message;
  source.tenantKey = resolvedTenantKey;
  source.tenant_key = resolvedTenantKey;

  source.blocked = true;
  source.failClosed = true;
  source.fail_closed = true;
  source.strict = true;
  source.strictMode = true;
  source.strict_mode = true;
  source.unavailable = true;
  source.available = false;
  source.authorityMode = "strict";
  source.authority_mode = "strict";
  source.ok = false;
  source.retryable = false;
  source.resolved = false;
  source.authoritative = false;

  source.isRuntimeAuthorityError = true;
  source.runtimeAuthorityError = true;
  source.runtime_authority_error = true;

  source.runtimeAuthorityUnavailable = true;
  source.runtime_authority_unavailable = true;
  source.authorityUnavailable = true;
  source.authority_unavailable = true;
  source.isAuthorityUnavailable = true;
  source.is_authority_unavailable = true;

  source.isFailClosed = true;
  source.is_fail_closed = true;
  source.isStrict = true;
  source.is_strict = true;

  source.authority = authorityPayload;
  source.runtimeAuthority = authorityPayload;
  source.details = detailsPayload;

  return source;
}

function buildFailClosedInboxBrainContext() {
  return {
    tenant: null,
    services: [],
    knowledgeEntries: [],
    responsePlaybooks: [],
    threadState: null,
  };
}

function runtimeHasAuthorityMarkers(runtime = {}) {
  return (
    Object.keys(obj(runtime?.authority)).length > 0 ||
    Object.keys(obj(runtime?.runtimeAuthority)).length > 0 ||
    !!s(runtime?.code) ||
    !!s(runtime?.reasonCode) ||
    lowerSlug(runtime?.authorityMode) === "strict"
  );
}

function shouldThrowOnMissingTenantPayload(runtimeLoader, runtime) {
  if (runtimeLoader === getTenantBrainRuntime) return true;
  return runtimeHasAuthorityMarkers(runtime);
}

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

  const resolvedTenantKey = resolveTenantKey(
    tenantKey || getDefaultTenantKey()
  );

  const runtimeLoader = allowLegacyInspection
    ? inspectionRuntimeLoader
    : strictRuntimeLoader;

  try {
    const runtime = await runtimeLoader({
      db,
      tenantKey: resolvedTenantKey,
    });

    if (runtime?.tenant?.id || runtime?.tenant?.tenant_key) {
      return runtime.tenant;
    }
  } catch (error) {
    if (!allowLegacyInspection && isRuntimeAuthorityError(error)) {
      return null;
    }
    if (!allowLegacyInspection) return null;
  }

  if (!allowLegacyInspection) return null;

  try {
    const result = await db.query(
      `
      select
        t.id, t.tenant_key, t.company_name, t.legal_name, t.industry_key, t.country_code,
        t.timezone, t.default_language, t.enabled_languages, t.market_region, t.plan_key,
        t.status, t.active, t.onboarding_completed_at, t.created_at, t.updated_at,
        tp.brand_name, tp.website_url, tp.public_email, tp.public_phone, tp.audience_summary,
        tp.services_summary, tp.value_proposition, tp.brand_summary, tp.tone_of_voice,
        tp.preferred_cta, tp.banned_phrases, tp.communication_rules, tp.visual_style, tp.extra_context,
        ap.auto_reply_enabled, ap.suppress_ai_during_handoff, ap.mark_seen_enabled, ap.typing_indicator_enabled,
        ap.create_lead_enabled, ap.approval_required_content, ap.approval_required_publish,
        ap.quiet_hours_enabled, ap.quiet_hours, ap.inbox_policy, ap.comment_policy, ap.content_policy,
        ap.escalation_rules, ap.risk_rules, ap.lead_scoring_rules, ap.publish_policy
      from tenants t
      left join tenant_profiles tp on tp.tenant_id = t.id
      left join tenant_ai_policies ap on ap.tenant_id = t.id
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
      default_language: s(
        normalized?.default_language || row.default_language || "az"
      ),
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

export async function getTenantServices(db, tenantId) {
  if (!isDbReady(db)) return [];
  if (!tenantId || !isUuid(tenantId)) return [];

  const canonicalRows = await queryRows(
    db,
    `
    select
      id, tenant_id, tenant_key, service_key, title, description, category,
      price_from, currency, pricing_model, duration_minutes, is_active, sort_order,
      highlights_json, metadata_json, created_at, updated_at
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
      id, tenant_id, service_key, title, enabled, sellable, visible_in_ai, category,
      description_short, description_full, keywords, synonyms, example_requests,
      pricing_mode, contact_capture_mode, handoff_mode, response_mode, faq_answer,
      disabled_reply_text, sort_order, meta, created_at, updated_at
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
      id, tenant_id, tenant_key, category, item_key, title, value_text, value_json,
      normalized_text, normalized_json, status, priority, metadata_json, created_at, updated_at
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
      id, tenant_id, entry_type, title, question, answer, language, service_key,
      intent_key, keywords, priority, enabled, meta, created_at, updated_at
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
      id, tenant_id, intent_key, service_key, language, user_example, ideal_reply,
      reply_style, cta_type, priority, enabled, meta, created_at, updated_at
    from tenant_response_playbooks
    where tenant_id = $1::uuid
      and enabled = true
    order by priority asc, updated_at desc, created_at desc
    `,
    [tenantId]
  );

  return rows.map(normalizeTenantResponsePlaybook).filter(Boolean);
}

export async function getTenantInboxBrainContext(
  db,
  tenantKey,
  threadId = "",
  {
    runtimeLoader = getTenantBrainRuntime,
    threadStateLoader = getInboxThreadState,
  } = {}
) {
  let runtime = null;

  try {
    runtime = await runtimeLoader({
      db,
      tenantKey,
      authorityMode: "strict",
    });
  } catch (error) {
    throw buildStrictRuntimeAuthorityError(error, tenantKey, {
      consumer: "inbox_brain_context",
    });
  }

  const tenant = runtime?.tenant || null;

  if (!tenant?.id) {
    if (shouldThrowOnMissingTenantPayload(runtimeLoader, runtime)) {
      throw buildStrictRuntimeAuthorityError(
        {
          code: "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE",
          reasonCode: "runtime_authority_unavailable",
          statusCode: 409,
          message:
            "Tenant runtime authority is unavailable because no authoritative tenant payload was returned.",
        },
        tenantKey,
        {
          consumer: "inbox_brain_context",
        }
      );
    }

    return buildFailClosedInboxBrainContext();
  }

  let threadState = null;
  if (threadId && isUuid(threadId)) {
    threadState = await threadStateLoader(db, threadId);
  }

  return {
    tenant,
    services: Array.isArray(runtime?.serviceCatalog)
      ? runtime.serviceCatalog
      : [],
    knowledgeEntries: Array.isArray(runtime?.knowledgeEntries)
      ? runtime.knowledgeEntries
      : [],
    responsePlaybooks: Array.isArray(runtime?.responsePlaybooks)
      ? runtime.responsePlaybooks
      : [],
    threadState,
  };
}