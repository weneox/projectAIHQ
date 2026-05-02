import { AsyncLocalStorage } from "node:async_hooks";

function s(value = "", fallback = "") {
  const out = String(value ?? "").trim();
  return out || String(fallback ?? "").trim();
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function compactContext(input = {}) {
  return {
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey: lower(input.tenantKey || input.tenant_key),
    userId: s(input.userId || input.user_id),
    requestId: s(input.requestId || input.request_id),
    source: s(input.source || "runtime"),
    system: input.system === true,
    reason: s(input.reason || ""),
  };
}

const tenantContextStorage = new AsyncLocalStorage();

const TENANT_SCOPED_TABLES = [
  "comments",
  "external_idempotency_keys",
  "inbox_threads",
  "inbox_messages",
  "inbox_thread_state",
  "inbox_outbound_attempts",
  "leads",
  "lead_events",
  "notifications",
  "jobs",
  "proposals",
  "push_subscriptions",
  "tenant_ai_policies",
  "tenant_lifecycle_events",
  "tenant_business_capabilities",
  "tenant_business_profiles",
  "tenant_channel_secrets",
  "tenant_channels",
  "tenant_domain_verifications",
  "tenant_execution_policy_controls",
  "tenant_facts",
  "tenant_knowledge",
  "tenant_knowledge_approvals",
  "tenant_knowledge_candidates",
  "tenant_locations",
  "tenant_provider_secrets",
  "tenant_runtime_projection_runs",
  "tenant_runtime_projections",
  "tenant_secrets",
  "tenant_setup_review_events",
  "tenant_setup_review_sessions",
  "tenant_source_artifacts",
  "tenant_source_sync_runs",
  "tenant_source_runs",
  "tenant_sources",
  "tenant_truth_versions",
  "tenant_usage_daily",
  "tenant_users",
  "workspace_import_jobs",
];

const SYSTEM_LEVEL_TABLES = [
  "admin_auth_sessions",
  "auth_identities",
  "auth_identity_memberships",
  "auth_identity_sessions",
  "auth_login_attempts",
  "audit_log",
  "durable_execution_attempts",
  "durable_executions",
  "runtime_incidents",
  "schema_migrations",
  "tenants",
];

const TRANSACTION_COMMAND_RE =
  /^\s*(begin|commit|rollback|savepoint|release\s+savepoint|set\s+local|select\s+1\b)/i;

function queryText(query) {
  if (typeof query === "string") return query;
  if (query && typeof query === "object") return String(query.text || "");
  return "";
}

function normalizeSql(sql = "") {
  return String(sql || "")
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function referencesTable(sql, table) {
  return new RegExp(`\\b${table}\\b`, "i").test(sql);
}

function isSystemOnlyQuery(normalizedSql = "") {
  if (!normalizedSql) return true;
  if (TRANSACTION_COMMAND_RE.test(normalizedSql)) return true;

  const referencesTenantTable = TENANT_SCOPED_TABLES.some((table) =>
    referencesTable(normalizedSql, table)
  );
  if (referencesTenantTable) return false;

  return SYSTEM_LEVEL_TABLES.some((table) => referencesTable(normalizedSql, table));
}

function hasTenantPredicate(normalizedSql = "") {
  return /\btenant_id\b/.test(normalizedSql) || /\btenant_key\b/.test(normalizedSql);
}

function valuesContainTenant(values = [], context = {}) {
  const normalizedValues = Array.isArray(values)
    ? values.map((item) => s(item).toLowerCase()).filter(Boolean)
    : [];

  if (!normalizedValues.length) return false;

  const tenantId = lower(context.tenantId);
  const tenantKey = lower(context.tenantKey);

  return Boolean(
    (tenantId && normalizedValues.includes(tenantId)) ||
      (tenantKey && normalizedValues.includes(tenantKey))
  );
}

export function getTenantContext() {
  return tenantContextStorage.getStore() || null;
}

export function setTenantContext(input = {}) {
  const previous = getTenantContext() || {};
  const next = {
    ...previous,
    ...compactContext(input),
  };

  tenantContextStorage.enterWith(next);
  return next;
}

export function runWithTenantContext(input = {}, fn) {
  const context = compactContext(input);
  return tenantContextStorage.run(context, fn);
}

export function runWithSystemDbContext(reason = "system", fn) {
  return runWithTenantContext(
    {
      system: true,
      source: "system",
      reason,
    },
    fn
  );
}

export function buildTenantContextFromRequest(req = {}) {
  return compactContext({
    tenantId:
      req.auth?.tenantId ||
      req.auth?.tenant_id ||
      req.user?.tenantId ||
      req.user?.tenant_id ||
      req.tenantId ||
      req.tenant?.id,
    tenantKey:
      req.auth?.tenantKey ||
      req.auth?.tenant_key ||
      req.user?.tenantKey ||
      req.user?.tenant_key ||
      req.tenantKey ||
      req.tenant?.tenant_key,
    userId: req.auth?.userId || req.auth?.user?.id || req.user?.id,
    requestId: req.requestId,
    source: "http",
  });
}

export function assertTenantQueryAllowed(query, values = [], options = {}) {
  const normalizedSql = normalizeSql(queryText(query));
  if (!normalizedSql || isSystemOnlyQuery(normalizedSql)) return true;

  const context = options.context || getTenantContext() || {};
  if (context.system === true) return true;

  const hasContext = Boolean(s(context.tenantId) || s(context.tenantKey));
  if (!hasContext) {
    const err = new Error("Tenant-scoped database query requires tenant context");
    err.code = "TENANT_CONTEXT_REQUIRED";
    err.details = {
      source: s(context.source),
      requestId: s(context.requestId),
    };
    throw err;
  }

  if (!hasTenantPredicate(normalizedSql)) {
    const err = new Error("Tenant-scoped database query requires tenant predicate");
    err.code = "TENANT_PREDICATE_REQUIRED";
    err.details = {
      tenantId: s(context.tenantId),
      tenantKey: s(context.tenantKey),
      source: s(context.source),
      requestId: s(context.requestId),
    };
    throw err;
  }

  if (!valuesContainTenant(values, context)) {
    const err = new Error("Tenant-scoped database query requires tenant binding");
    err.code = "TENANT_BINDING_REQUIRED";
    err.details = {
      tenantId: s(context.tenantId),
      tenantKey: s(context.tenantKey),
      source: s(context.source),
      requestId: s(context.requestId),
    };
    throw err;
  }

  return true;
}

export function createTenantGuardedDb(target, options = {}) {
  if (!target || typeof target.query !== "function") return target;
  if (target.__tenantGuardedDb) return target;

  const guarded = Object.create(target);

  guarded.__tenantGuardedDb = true;
  guarded.__poolRole = s(options.poolRole || target.__poolRole || "api");

  guarded.query = function guardedQuery(query, values, callback) {
    const queryValues =
      Array.isArray(values) ? values : Array.isArray(query?.values) ? query.values : [];
    assertTenantQueryAllowed(query, queryValues);
    return target.query.call(target, query, values, callback);
  };

  if (typeof target.connect === "function") {
    guarded.connect = async function guardedConnect(...args) {
      const client = await target.connect.apply(target, args);
      return createTenantGuardedClient(client, options);
    };
  }

  if (typeof target.end === "function") {
    guarded.end = (...args) => target.end.apply(target, args);
  }

  return guarded;
}

function createTenantGuardedClient(client, options = {}) {
  if (!client || typeof client.query !== "function") return client;
  if (client.__tenantGuardedDb) return client;

  const rawQuery = client.query.bind(client);
  const rawRelease = typeof client.release === "function" ? client.release.bind(client) : null;

  client.__tenantGuardedDb = true;
  client.__poolRole = s(options.poolRole || client.__poolRole || "api");
  client.query = function guardedClientQuery(query, values, callback) {
    const queryValues =
      Array.isArray(values) ? values : Array.isArray(query?.values) ? query.values : [];
    assertTenantQueryAllowed(query, queryValues);
    return rawQuery(query, values, callback);
  };

  if (rawRelease) {
    client.release = (...args) => rawRelease(...args);
  }

  return client;
}

export const __test__ = {
  normalizeSql,
  hasTenantPredicate,
  isSystemOnlyQuery,
  valuesContainTenant,
};
