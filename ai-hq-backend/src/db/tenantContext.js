import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";

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

const LEGACY_TENANT_SCOPED_TABLES = [
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

const TENANT_CONTEXT_EXEMPT_SYSTEM_TABLES = [
  "auth_identity_memberships",
  "auth_identity_sessions",
  "auth_sessions",
  "runtime_incidents",
];

const SYSTEM_LEVEL_TABLES = [
  "admin_auth_sessions",
  "auth_identities",
  "auth_identity_memberships",
  "auth_sessions",
  "auth_identity_sessions",
  "auth_login_attempts",
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

function uniqSorted(items = []) {
  return [...new Set(items.map((item) => lower(item)).filter(Boolean))].sort();
}

function unquoteIdentifierPart(value = "") {
  return s(value).replace(/^"+|"+$/g, "").toLowerCase();
}

function normalizeTableIdentifier(value = "") {
  const raw = s(value);
  if (!raw) return "";
  const parts = raw
    .split(".")
    .map((part) => unquoteIdentifierPart(part))
    .filter(Boolean);
  return parts.at(-1) || "";
}

function stripSqlComments(sql = "") {
  return String(sql || "")
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

function readSchemaSqlFiles() {
  try {
    const schemaDir = new URL("./schema/", import.meta.url);
    return readdirSync(schemaDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(new URL(file, schemaDir), "utf8"));
  } catch {
    return [];
  }
}

function extractCreateTableBlocks(sql = "") {
  const cleaned = stripSqlComments(sql);
  const tableName =
    String.raw`(?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?`;
  const re = new RegExp(
    String.raw`\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(${tableName})\s*\(`,
    "gi"
  );
  const blocks = [];
  let match;

  while ((match = re.exec(cleaned))) {
    const table = normalizeTableIdentifier(match[1]);
    const openIndex = cleaned.indexOf("(", match.index);
    if (!table || openIndex < 0) continue;

    let depth = 0;
    let endIndex = -1;
    for (let i = openIndex; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex > openIndex) {
      blocks.push({
        table,
        body: cleaned.slice(openIndex + 1, endIndex),
      });
      re.lastIndex = endIndex + 1;
    }
  }

  return blocks;
}

function discoverTenantShapedTablesFromSql(sql = "") {
  const cleaned = stripSqlComments(sql);
  const tables = new Set();

  for (const block of extractCreateTableBlocks(cleaned)) {
    const body = lower(block.body);
    if (
      block.table !== "tenants" &&
      (block.table.startsWith("tenant_") ||
        /\btenant_id\b/.test(body) ||
        /\btenant_key\b/.test(body) ||
        /\breferences\s+(?:public\.)?tenants\b/.test(body) ||
        /\breferences\s+(?:public\.)?"tenants"\b/.test(body))
    ) {
      tables.add(block.table);
    }
  }

  const tableName =
    String.raw`(?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?`;
  const alterRe = new RegExp(
    String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(${tableName})\b([\s\S]*?);`,
    "gi"
  );
  let match;
  while ((match = alterRe.exec(cleaned))) {
    const table = normalizeTableIdentifier(match[1]);
    const statement = lower(match[2] || "");
    if (
      table &&
      table !== "tenants" &&
      (table.startsWith("tenant_") ||
        /\btenant_id\b/.test(statement) ||
        /\btenant_key\b/.test(statement) ||
        /\breferences\s+(?:public\.)?tenants\b/.test(statement) ||
        /\breferences\s+(?:public\.)?"tenants"\b/.test(statement))
    ) {
      tables.add(table);
    }
  }

  return uniqSorted([...tables]);
}

function discoverTenantShapedSchemaTables() {
  return uniqSorted(readSchemaSqlFiles().flatMap(discoverTenantShapedTablesFromSql));
}

const TENANT_SHAPED_SCHEMA_TABLES = discoverTenantShapedSchemaTables();
const TENANT_SCOPED_TABLES = uniqSorted([
  ...LEGACY_TENANT_SCOPED_TABLES,
  ...TENANT_SHAPED_SCHEMA_TABLES.filter(
    (table) => !TENANT_CONTEXT_EXEMPT_SYSTEM_TABLES.includes(table)
  ),
]);

function referencesTable(sql, table) {
  return new RegExp(`\\b${table}\\b`, "i").test(sql);
}

function referencesUnregisteredTenantNamespaceTable(sql = "") {
  const scoped = new Set(TENANT_SCOPED_TABLES);
  const systemExempt = new Set(TENANT_CONTEXT_EXEMPT_SYSTEM_TABLES);
  const tableName =
    String.raw`(?:"[^"]+"|[a-zA-Z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w$]*))?`;
  const tableRefRe = new RegExp(
    String.raw`\b(?:from|join|update|into|table)\s+(?:only\s+)?(${tableName})\b`,
    "gi"
  );

  let match;
  while ((match = tableRefRe.exec(String(sql || "")))) {
    const table = normalizeTableIdentifier(match[1]);
    if (table.startsWith("tenant_") && !scoped.has(table) && !systemExempt.has(table)) {
      return true;
    }
  }

  return false;
}

function isSystemOnlyQuery(normalizedSql = "") {
  if (!normalizedSql) return true;
  if (TRANSACTION_COMMAND_RE.test(normalizedSql)) return true;

  const referencesTenantTable =
    TENANT_SCOPED_TABLES.some((table) => referencesTable(normalizedSql, table)) ||
    referencesUnregisteredTenantNamespaceTable(normalizedSql);
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
  discoverTenantShapedTablesFromSql,
  valuesContainTenant,
  LEGACY_TENANT_SCOPED_TABLES,
  TENANT_CONTEXT_EXEMPT_SYSTEM_TABLES,
  TENANT_SHAPED_SCHEMA_TABLES,
  TENANT_SCOPED_TABLES,
  SYSTEM_LEVEL_TABLES,
};
