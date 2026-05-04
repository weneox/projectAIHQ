import { cfg } from "../config.js";
import {
  getTenantContext,
  runWithSystemDbContext,
} from "../db/tenantContext.js";

export const V1_RETENTION_POLICY_VERSION = "aihq_v1_data_retention_2026_05";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BUSINESS_TRUTH_EXCLUSIONS = [
  "tenant_truth_versions",
  "tenant_business_profiles",
  "tenant_business_capabilities",
  "tenant_runtime_projections",
  "tenant_runtime_projection_runs",
  "tenant_setup_review_sessions",
  "tenant_setup_review_events",
  "tenant_sources",
  "tenant_channels",
  "tenant_secrets",
  "tenant_provider_secrets",
  "tenant_channel_secrets",
  "content_media_assets",
];

function s(value = "", fallback = "") {
  const out = String(value ?? "").trim();
  return out || String(fallback ?? "").trim();
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function clampInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function bool(value, fallback = false) {
  const raw = lower(value);
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

function isoCutoff(now, retainDays) {
  const date = now instanceof Date ? now : new Date(now);
  return new Date(date.getTime() - retainDays * MS_PER_DAY).toISOString();
}

function readCount(result) {
  const value = result?.rows?.[0]?.count ?? result?.rows?.[0]?.total ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getStore(policy, key) {
  return policy.stores.find((item) => item.key === key) || null;
}

function buildStore({
  key,
  label,
  retainDays,
  tables,
  classification,
  action,
  deletionMode = "delete",
  automatedCleanup = true,
}) {
  return {
    key,
    label,
    retainDays,
    tables,
    classification,
    action,
    deletionMode,
    automatedCleanup,
  };
}

export function buildV1RetentionPolicy(input = cfg.retention || {}) {
  const websiteWidgetDays = clampInt(input.websiteWidgetDays, 30, 1, 3650);
  const inboxMessageDays = clampInt(input.inboxMessageDays, 90, 1, 3650);
  const sourceRawArtifactDays = clampInt(
    input.sourceRawArtifactDays,
    30,
    1,
    3650
  );
  const runtimeIncidentDays = clampInt(input.runtimeIncidentDays, 14, 1, 3650);
  const auditLogDays = clampInt(input.auditLogDays, 365, 90, 3650);
  const maxDeleteRows = clampInt(input.maxDeleteRows, 1000, 1, 100000);
  const tenantBatchLimit = clampInt(input.tenantBatchLimit, 100, 1, 10000);

  return {
    version: V1_RETENTION_POLICY_VERSION,
    defaultDryRun: input.dryRunDefault !== false,
    maxDeleteRows,
    tenantBatchLimit,
    stores: [
      buildStore({
        key: "website_widget_conversations",
        label: "Website widget visitor sessions and messages",
        retainDays: websiteWidgetDays,
        tables: ["inbox_threads", "inbox_messages", "inbox_outbound_attempts"],
        classification: "visitor_and_customer_pii",
        action:
          "Delete old website-channel messages, outbound attempts, and empty threads.",
      }),
      buildStore({
        key: "inbox_conversations",
        label: "Inbox conversations and manual operator replies",
        retainDays: inboxMessageDays,
        tables: ["inbox_threads", "inbox_messages", "inbox_outbound_attempts"],
        classification: "customer_and_operator_interaction_history",
        action:
          "Delete old non-website inbox messages, outbound attempts, and empty threads.",
      }),
      buildStore({
        key: "source_raw_artifacts",
        label: "Raw imported website source artifacts and chunks",
        retainDays: sourceRawArtifactDays,
        tables: [
          "tenant_source_raw_artifacts",
          "tenant_source_artifact_chunks",
        ],
        classification: "raw_imported_website_customer_content",
        action:
          "Delete expired website raw artifacts and derived chunks; approved Business Truth, configuration, and non-website artifacts are excluded.",
      }),
      buildStore({
        key: "runtime_incidents",
        label: "Runtime and observability events",
        retainDays: runtimeIncidentDays,
        tables: ["runtime_incidents"],
        classification: "operational_event_history",
        action: "Delete old tenant-scoped runtime incident rows.",
      }),
      buildStore({
        key: "audit_log",
        label: "Audit and security logs",
        retainDays: auditLogDays,
        tables: ["audit_log"],
        classification: "governance_and_security_history",
        action:
          "Delete old tenant-scoped audit rows only after the longer audit retention window.",
      }),
    ],
    excludedTables: [...BUSINESS_TRUTH_EXCLUSIONS],
  };
}

export function assertTenantRetentionScope({ tenantKey } = {}) {
  const requestedTenantKey = lower(tenantKey);
  if (!requestedTenantKey) {
    const error = new Error("Data retention cleanup requires tenant_key scope");
    error.code = "RETENTION_TENANT_KEY_REQUIRED";
    throw error;
  }

  const context = getTenantContext() || {};
  if (context.system === true) return true;

  const contextTenantKey = lower(context.tenantKey || context.tenant_key);
  if (!contextTenantKey) {
    const error = new Error("Data retention cleanup requires tenant context");
    error.code = "TENANT_CONTEXT_REQUIRED";
    throw error;
  }

  if (contextTenantKey !== requestedTenantKey) {
    const error = new Error("Data retention cleanup tenant scope mismatch");
    error.code = "TENANT_SCOPE_MISMATCH";
    error.details = {
      contextTenantKey,
      requestedTenantKey,
    };
    throw error;
  }

  return true;
}

async function runRetentionStep({
  db,
  key,
  table,
  action,
  retainDays,
  cutoff,
  dryRun,
  countSql,
  deleteSql,
  values,
}) {
  const countResult = await db.query(countSql, values.slice(0, 2));
  const matched = readCount(countResult);

  if (dryRun) {
    return {
      key,
      table,
      action,
      retainDays,
      cutoff,
      matched,
      deleted: 0,
      dryRun: true,
    };
  }

  const deleteResult = await db.query(deleteSql, values);
  return {
    key,
    table,
    action,
    retainDays,
    cutoff,
    matched,
    deleted: Number(deleteResult?.rowCount || 0),
    dryRun: false,
  };
}

function websiteChannelPredicate(alias = "t") {
  return `lower(coalesce(${alias}.channel, '')) in ('website', 'web')`;
}

function nonWebsiteChannelPredicate(alias = "t") {
  return `lower(coalesce(${alias}.channel, '')) not in ('website', 'web')`;
}

function websiteSourceArtifactPredicate(alias = "a") {
  return `(
    lower(coalesce(${alias}.source_type, '')) = 'website'
    or lower(coalesce(${alias}.artifact_type, '')) in (
      'website_site',
      'website_page',
      'website_sitemap',
      'website_feed',
      'website_asset_ref'
    )
  )`;
}

function valuesForStep(tenantKey, cutoff, maxRows) {
  return [tenantKey, cutoff, maxRows];
}

export async function runTenantDataRetentionCleanup({
  db,
  tenantKey,
  policy = buildV1RetentionPolicy(),
  dryRun = policy.defaultDryRun !== false,
  now = new Date(),
} = {}) {
  if (!db || typeof db.query !== "function") {
    const error = new Error("Data retention cleanup requires a db query client");
    error.code = "RETENTION_DB_REQUIRED";
    throw error;
  }

  const scopedTenantKey = lower(tenantKey);
  assertTenantRetentionScope({ tenantKey: scopedTenantKey });

  const maxRows = clampInt(policy.maxDeleteRows, 1000, 1, 100000);
  const steps = [];
  const websiteStore = getStore(policy, "website_widget_conversations");
  const inboxStore = getStore(policy, "inbox_conversations");
  const sourceStore = getStore(policy, "source_raw_artifacts");
  const runtimeStore = getStore(policy, "runtime_incidents");
  const auditStore = getStore(policy, "audit_log");

  const websiteCutoff = isoCutoff(now, websiteStore.retainDays);
  steps.push(
    {
      key: websiteStore.key,
      table: "inbox_outbound_attempts",
      action: "delete_expired_website_outbound_attempts",
      retainDays: websiteStore.retainDays,
      cutoff: websiteCutoff,
      values: valuesForStep(scopedTenantKey, websiteCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_outbound_attempts a
        join inbox_threads t on t.id = a.thread_id
        where a.tenant_key = $1::text
          and t.tenant_key = $1::text
          and ${websiteChannelPredicate("t")}
          and a.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select a.id
          from inbox_outbound_attempts a
          join inbox_threads t on t.id = a.thread_id
          where a.tenant_key = $1::text
            and t.tenant_key = $1::text
            and ${websiteChannelPredicate("t")}
            and a.created_at < $2::timestamptz
          order by a.created_at asc
          limit $3::int
        )
        delete from inbox_outbound_attempts
        where id in (select id from candidates)
      `,
    },
    {
      key: websiteStore.key,
      table: "inbox_messages",
      action: "delete_expired_website_messages",
      retainDays: websiteStore.retainDays,
      cutoff: websiteCutoff,
      values: valuesForStep(scopedTenantKey, websiteCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_messages m
        join inbox_threads t on t.id = m.thread_id
        where m.tenant_key = $1::text
          and t.tenant_key = $1::text
          and ${websiteChannelPredicate("t")}
          and m.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select m.id
          from inbox_messages m
          join inbox_threads t on t.id = m.thread_id
          where m.tenant_key = $1::text
            and t.tenant_key = $1::text
            and ${websiteChannelPredicate("t")}
            and m.created_at < $2::timestamptz
          order by m.created_at asc
          limit $3::int
        )
        delete from inbox_messages
        where id in (select id from candidates)
      `,
    },
    {
      key: websiteStore.key,
      table: "inbox_threads",
      action: "delete_expired_empty_website_threads",
      retainDays: websiteStore.retainDays,
      cutoff: websiteCutoff,
      values: valuesForStep(scopedTenantKey, websiteCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_threads t
        where t.tenant_key = $1::text
          and ${websiteChannelPredicate("t")}
          and coalesce(t.last_message_at, t.updated_at, t.created_at) < $2::timestamptz
          and not exists (
            select 1
            from inbox_messages m
            where m.thread_id = t.id
              and m.tenant_key = t.tenant_key
          )
      `,
      deleteSql: `
        with candidates as (
          select t.id
          from inbox_threads t
          where t.tenant_key = $1::text
            and ${websiteChannelPredicate("t")}
            and coalesce(t.last_message_at, t.updated_at, t.created_at) < $2::timestamptz
            and not exists (
              select 1
              from inbox_messages m
              where m.thread_id = t.id
                and m.tenant_key = t.tenant_key
            )
          order by coalesce(t.last_message_at, t.updated_at, t.created_at) asc
          limit $3::int
        )
        delete from inbox_threads
        where id in (select id from candidates)
      `,
    }
  );

  const inboxCutoff = isoCutoff(now, inboxStore.retainDays);
  steps.push(
    {
      key: inboxStore.key,
      table: "inbox_outbound_attempts",
      action: "delete_expired_inbox_outbound_attempts",
      retainDays: inboxStore.retainDays,
      cutoff: inboxCutoff,
      values: valuesForStep(scopedTenantKey, inboxCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_outbound_attempts a
        join inbox_threads t on t.id = a.thread_id
        where a.tenant_key = $1::text
          and t.tenant_key = $1::text
          and ${nonWebsiteChannelPredicate("t")}
          and a.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select a.id
          from inbox_outbound_attempts a
          join inbox_threads t on t.id = a.thread_id
          where a.tenant_key = $1::text
            and t.tenant_key = $1::text
            and ${nonWebsiteChannelPredicate("t")}
            and a.created_at < $2::timestamptz
          order by a.created_at asc
          limit $3::int
        )
        delete from inbox_outbound_attempts
        where id in (select id from candidates)
      `,
    },
    {
      key: inboxStore.key,
      table: "inbox_messages",
      action: "delete_expired_inbox_messages",
      retainDays: inboxStore.retainDays,
      cutoff: inboxCutoff,
      values: valuesForStep(scopedTenantKey, inboxCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_messages m
        join inbox_threads t on t.id = m.thread_id
        where m.tenant_key = $1::text
          and t.tenant_key = $1::text
          and ${nonWebsiteChannelPredicate("t")}
          and m.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select m.id
          from inbox_messages m
          join inbox_threads t on t.id = m.thread_id
          where m.tenant_key = $1::text
            and t.tenant_key = $1::text
            and ${nonWebsiteChannelPredicate("t")}
            and m.created_at < $2::timestamptz
          order by m.created_at asc
          limit $3::int
        )
        delete from inbox_messages
        where id in (select id from candidates)
      `,
    },
    {
      key: inboxStore.key,
      table: "inbox_threads",
      action: "delete_expired_empty_inbox_threads",
      retainDays: inboxStore.retainDays,
      cutoff: inboxCutoff,
      values: valuesForStep(scopedTenantKey, inboxCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from inbox_threads t
        where t.tenant_key = $1::text
          and ${nonWebsiteChannelPredicate("t")}
          and coalesce(t.last_message_at, t.updated_at, t.created_at) < $2::timestamptz
          and not exists (
            select 1
            from inbox_messages m
            where m.thread_id = t.id
              and m.tenant_key = t.tenant_key
          )
      `,
      deleteSql: `
        with candidates as (
          select t.id
          from inbox_threads t
          where t.tenant_key = $1::text
            and ${nonWebsiteChannelPredicate("t")}
            and coalesce(t.last_message_at, t.updated_at, t.created_at) < $2::timestamptz
            and not exists (
              select 1
              from inbox_messages m
              where m.thread_id = t.id
                and m.tenant_key = t.tenant_key
            )
          order by coalesce(t.last_message_at, t.updated_at, t.created_at) asc
          limit $3::int
        )
        delete from inbox_threads
        where id in (select id from candidates)
      `,
    }
  );

  const sourceCutoff = isoCutoff(now, sourceStore.retainDays);
  steps.push(
    {
      key: sourceStore.key,
      table: "tenant_source_artifact_chunks",
      action: "delete_expired_source_artifact_chunks",
      retainDays: sourceStore.retainDays,
      cutoff: sourceCutoff,
      values: valuesForStep(scopedTenantKey, sourceCutoff, maxRows),
      countSql: `
        select count(*)::int as count
          from tenant_source_artifact_chunks c
        join tenant_source_raw_artifacts a on a.id = c.artifact_id
        where c.tenant_key = $1::text
          and a.tenant_key = $1::text
          and ${websiteSourceArtifactPredicate("a")}
          and a.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select c.id
          from tenant_source_artifact_chunks c
          join tenant_source_raw_artifacts a on a.id = c.artifact_id
          where c.tenant_key = $1::text
            and a.tenant_key = $1::text
            and ${websiteSourceArtifactPredicate("a")}
            and a.created_at < $2::timestamptz
          order by c.created_at asc
          limit $3::int
        )
        delete from tenant_source_artifact_chunks
        where id in (select id from candidates)
      `,
    },
    {
      key: sourceStore.key,
      table: "tenant_source_raw_artifacts",
      action: "delete_expired_source_raw_artifacts",
      retainDays: sourceStore.retainDays,
      cutoff: sourceCutoff,
      values: valuesForStep(scopedTenantKey, sourceCutoff, maxRows),
      countSql: `
        select count(*)::int as count
        from tenant_source_raw_artifacts a
        where a.tenant_key = $1::text
          and ${websiteSourceArtifactPredicate("a")}
          and a.created_at < $2::timestamptz
      `,
      deleteSql: `
        with candidates as (
          select a.id
          from tenant_source_raw_artifacts a
          where a.tenant_key = $1::text
            and ${websiteSourceArtifactPredicate("a")}
            and a.created_at < $2::timestamptz
          order by a.created_at asc
          limit $3::int
        )
        delete from tenant_source_raw_artifacts
        where id in (select id from candidates)
      `,
    }
  );

  const runtimeCutoff = isoCutoff(now, runtimeStore.retainDays);
  steps.push({
    key: runtimeStore.key,
    table: "runtime_incidents",
    action: "delete_expired_runtime_incidents",
    retainDays: runtimeStore.retainDays,
    cutoff: runtimeCutoff,
    values: valuesForStep(scopedTenantKey, runtimeCutoff, maxRows),
    countSql: `
      select count(*)::int as count
      from runtime_incidents
      where tenant_key = $1::text
        and occurred_at < $2::timestamptz
    `,
    deleteSql: `
      with candidates as (
        select id
        from runtime_incidents
        where tenant_key = $1::text
          and occurred_at < $2::timestamptz
        order by occurred_at asc
        limit $3::int
      )
      delete from runtime_incidents
      where id in (select id from candidates)
    `,
  });

  const auditCutoff = isoCutoff(now, auditStore.retainDays);
  steps.push({
    key: auditStore.key,
    table: "audit_log",
    action: "delete_expired_audit_log_rows",
    retainDays: auditStore.retainDays,
    cutoff: auditCutoff,
    values: valuesForStep(scopedTenantKey, auditCutoff, maxRows),
    countSql: `
      select count(*)::int as count
      from audit_log
      where tenant_key = $1::text
        and created_at < $2::timestamptz
    `,
    deleteSql: `
      with candidates as (
        select id
        from audit_log
        where tenant_key = $1::text
          and created_at < $2::timestamptz
        order by created_at asc
        limit $3::int
      )
      delete from audit_log
      where id in (select id from candidates)
    `,
  });

  const results = [];
  for (const step of steps) {
    results.push(
      await runRetentionStep({
        db,
        dryRun,
        ...step,
      })
    );
  }

  return {
    ok: true,
    policyVersion: policy.version,
    tenantKey: scopedTenantKey,
    dryRun: dryRun === true,
    maxDeleteRows: maxRows,
    generatedAt: new Date().toISOString(),
    cutoffs: {
      websiteWidget: websiteCutoff,
      inbox: inboxCutoff,
      sourceRawArtifacts: sourceCutoff,
      runtimeIncidents: runtimeCutoff,
      auditLog: auditCutoff,
    },
    excludedTables: policy.excludedTables,
    results,
  };
}

export async function runDataRetentionCleanupForAllTenants({
  db,
  policy = buildV1RetentionPolicy(),
  dryRun = policy.defaultDryRun !== false,
  now = new Date(),
} = {}) {
  if (!db || typeof db.query !== "function") {
    const error = new Error("Data retention cleanup requires a db query client");
    error.code = "RETENTION_DB_REQUIRED";
    throw error;
  }

  const tenantBatchLimit = clampInt(policy.tenantBatchLimit, 100, 1, 10000);
  return runWithSystemDbContext("data_retention_cleanup", async () => {
    const tenants = await db.query(
      `
        select tenant_key
        from tenants
        where tenant_key is not null
          and btrim(tenant_key) <> ''
        order by tenant_key asc
        limit $1::int
      `,
      [tenantBatchLimit]
    );

    const results = [];
    for (const row of tenants?.rows || []) {
      results.push(
        await runTenantDataRetentionCleanup({
          db,
          tenantKey: row.tenant_key,
          policy,
          dryRun,
          now,
        })
      );
    }

    return {
      ok: true,
      dryRun: dryRun === true,
      policyVersion: policy.version,
      tenantCount: results.length,
      results,
    };
  });
}

export function parseRetentionDryRunFlag(value, fallback = true) {
  return bool(value, fallback);
}

export const __test__ = {
  BUSINESS_TRUTH_EXCLUSIONS,
  clampInt,
  isoCutoff,
  websiteChannelPredicate,
  nonWebsiteChannelPredicate,
  websiteSourceArtifactPredicate,
};
