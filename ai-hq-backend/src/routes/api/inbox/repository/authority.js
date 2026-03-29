import { isDbReady, isUuid } from "../../../../utils/http.js";
import {
  getDefaultTenantKey,
  resolveTenantKey,
} from "../../../../tenancy/index.js";
import {
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { s } from "../shared.js";
import {
  lowerSlug,
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

  const explicitReasonCode = s(
    existingAuthority.reasonCode ||
      existingAuthority.reason_code ||
      incoming.reasonCode ||
      incoming.reason_code ||
      incomingDetails.reasonCode ||
      incomingDetails.reason_code ||
      source.reasonCode ||
      source.reason_code
  );

  const fallbackReasonCode =
    code === "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE"
      ? "runtime_projection_missing"
      : lowerSlug(code) || "runtime_authority_unavailable";

  const reasonCode = s(explicitReasonCode || fallbackReasonCode);

  const statusCode = Number(
    existingAuthority.statusCode ||
      existingAuthority.status_code ||
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

export async function getTenantByKey(
  db,
  tenantKey,
  { runtimeLoader = getTenantBrainRuntime } = {}
) {
  if (!isDbReady(db)) return null;

  const resolvedTenantKey = resolveTenantKey(
    tenantKey || getDefaultTenantKey()
  );

  try {
    const runtime = await runtimeLoader({
      db,
      tenantKey: resolvedTenantKey,
      authorityMode: "strict",
    });

    if (runtime?.tenant?.id || runtime?.tenant?.tenant_key) {
      return runtime.tenant;
    }
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return null;
    }
    throw error;
  }

  return null;
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
    if (runtimeHasAuthorityMarkers(runtime)) {
      throw buildStrictRuntimeAuthorityError(
        {
          code: "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE",
          reasonCode: "runtime_projection_missing",
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
