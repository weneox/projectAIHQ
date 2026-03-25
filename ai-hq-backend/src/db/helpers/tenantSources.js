// src/db/helpers/tenantSources.js
// FINAL v1.1
// ============================================================
// Tenant Sources helper layer
// ============================================================

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function b(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function iso(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function lower(v) {
  return s(v).toLowerCase();
}

function hasQueryApi(db) {
  return !!db && typeof db.query === "function";
}

async function q(db, text, params = []) {
  if (!hasQueryApi(db)) {
    throw new Error("tenantSources: db.query(...) is required");
  }
  return db.query(text, params);
}

function normalizeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") return value;
  return fallback;
}

function normalizeSourceType(v) {
  const x = lower(v);
  if (
    [
      "website",
      "instagram",
      "facebook_page",
      "facebook_comments",
      "messenger",
      "whatsapp_business",
      "google_maps",
      "google_business",
      "linkedin",
      "tiktok",
      "youtube",
      "telegram",
      "email",
      "pdf",
      "document",
      "spreadsheet",
      "notion",
      "drive_folder",
      "crm",
      "manual_note",
      "api",
      "other",
    ].includes(x)
  ) {
    return x;
  }
  return "other";
}

function normalizeSourceStatus(v) {
  const x = lower(v);
  if (["pending", "connected", "disconnected", "revoked", "error", "archived"].includes(x)) {
    return x;
  }
  return "pending";
}

function normalizeAuthStatus(v) {
  const x = lower(v);
  if (["not_required", "pending", "authorized", "expired", "revoked", "error"].includes(x)) {
    return x;
  }
  return "not_required";
}

function normalizeSyncStatus(v) {
  const x = lower(v);
  if (["idle", "queued", "running", "success", "partial", "error", "disabled"].includes(x)) {
    return x;
  }
  return "idle";
}

function normalizeConnectionMode(v) {
  const x = lower(v);
  if (["manual", "oauth", "api_key", "webhook", "crawler", "upload", "import", "system"].includes(x)) {
    return x;
  }
  return "manual";
}

function normalizeAccessScope(v) {
  const x = lower(v);
  if (["public", "private", "hybrid"].includes(x)) {
    return x;
  }
  return "public";
}

function normalizeRunType(v) {
  const x = lower(v);
  if (["connect", "sync", "resync", "crawl", "extract", "refresh", "disconnect"].includes(x)) {
    return x;
  }
  return "sync";
}

function normalizeTriggerType(v) {
  const x = lower(v);
  if (["manual", "scheduled", "webhook", "source_change", "system", "retry"].includes(x)) {
    return x;
  }
  return "manual";
}

function normalizeRunStatus(v) {
  const x = lower(v);
  if (["queued", "running", "success", "partial", "failed", "cancelled"].includes(x)) {
    return x;
  }
  return "queued";
}

function sanitizeSourceUrl(v) {
  let x = s(v);
  if (!x) return "";

  x = x.replace(/^ht+tps?:\/\//i, "https://");
  x = x.replace(/^https?:\/\/https?:\/\//i, "https://");
  x = x.replace(/^http:\/\/http:\/\//i, "http://");
  x = x.replace(/^https:\/\/https:\/\//i, "https://");

  if (!/^https?:\/\//i.test(x) && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(x)) {
    x = `https://${x}`;
  }

  try {
    const u = new URL(x);
    return u.toString();
  } catch {
    return x;
  }
}

function normalizeSourceKey({
  sourceType,
  sourceUrl,
  externalAccountId,
  externalPageId,
  externalUsername,
  customKey,
}) {
  const explicit = s(customKey);
  if (explicit) return explicit;

  const safeUrl = sanitizeSourceUrl(sourceUrl);

  const parts = [
    normalizeSourceType(sourceType),
    safeUrl,
    s(externalAccountId),
    s(externalPageId),
    lower(externalUsername),
  ].filter(Boolean);

  return parts.join(":") || `other:${Date.now()}`;
}

function rowToSource(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    source_type: normalizeSourceType(row.source_type),
    source_key: s(row.source_key),
    display_name: s(row.display_name),

    status: normalizeSourceStatus(row.status),
    auth_status: normalizeAuthStatus(row.auth_status),
    sync_status: normalizeSyncStatus(row.sync_status),

    connection_mode: normalizeConnectionMode(row.connection_mode),
    access_scope: normalizeAccessScope(row.access_scope),

    source_url: s(row.source_url),
    external_account_id: s(row.external_account_id),
    external_page_id: s(row.external_page_id),
    external_username: s(row.external_username),

    is_enabled: b(row.is_enabled, true),
    is_primary: b(row.is_primary, false),

    permissions_json: normalizeJson(row.permissions_json, {}),
    settings_json: normalizeJson(row.settings_json, {}),
    metadata_json: normalizeJson(row.metadata_json, {}),

    last_connected_at: iso(row.last_connected_at),
    last_sync_started_at: iso(row.last_sync_started_at),
    last_sync_finished_at: iso(row.last_sync_finished_at),
    last_successful_sync_at: iso(row.last_successful_sync_at),
    last_error_at: iso(row.last_error_at),

    last_error_code: s(row.last_error_code),
    last_error_message: s(row.last_error_message),

    created_by: s(row.created_by),
    updated_by: s(row.updated_by),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function rowToSyncRun(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    source_id: s(row.source_id),

    run_type: normalizeRunType(row.run_type),
    trigger_type: normalizeTriggerType(row.trigger_type),
    status: normalizeRunStatus(row.status),

    started_at: iso(row.started_at),
    finished_at: iso(row.finished_at),
    duration_ms: n(row.duration_ms, 0),

    input_summary_json: normalizeJson(row.input_summary_json, {}),
    extraction_summary_json: normalizeJson(row.extraction_summary_json, {}),
    result_summary_json: normalizeJson(row.result_summary_json, {}),

    pages_scanned: n(row.pages_scanned, 0),
    records_scanned: n(row.records_scanned, 0),
    candidates_created: n(row.candidates_created, 0),
    items_promoted: n(row.items_promoted, 0),
    conflicts_found: n(row.conflicts_found, 0),
    warnings_count: n(row.warnings_count, 0),
    errors_count: n(row.errors_count, 0),

    error_code: s(row.error_code),
    error_message: s(row.error_message),
    logs_json: normalizeJson(row.logs_json, []),

    requested_by: s(row.requested_by),
    runner_key: s(row.runner_key),
    review_session_id: s(row.review_session_id),
    metadata_json: normalizeJson(row.metadata_json, {}),
    meta_json: normalizeJson(row.meta_json, {}),
    attempt_count: n(row.attempt_count, 0),
    max_attempts: n(row.max_attempts, 3),
    last_attempt_at: iso(row.last_attempt_at),
    next_retry_at: iso(row.next_retry_at),
    lease_token: s(row.lease_token),
    lease_expires_at: iso(row.lease_expires_at),
    claimed_by: s(row.claimed_by),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

async function resolveTenantIdentity(db, { tenantId, tenantKey }) {
  const id = s(tenantId);
  const key = s(tenantKey);

  if (id) {
    const r = await q(
      db,
      `
      select id, tenant_key
      from tenants
      where id = $1
      limit 1
      `,
      [id]
    );
    if (r.rows[0]) {
      return {
        tenant_id: s(r.rows[0].id),
        tenant_key: s(r.rows[0].tenant_key),
      };
    }
  }

  if (key) {
    const r = await q(
      db,
      `
      select id, tenant_key
      from tenants
      where lower(tenant_key) = lower($1)
      limit 1
      `,
      [key]
    );
    if (r.rows[0]) {
      return {
        tenant_id: s(r.rows[0].id),
        tenant_key: s(r.rows[0].tenant_key),
      };
    }
  }

  return null;
}

export function createTenantSourcesHelpers({ db }) {
  if (!hasQueryApi(db)) {
    throw new Error("createTenantSourcesHelpers: valid db.query(...) adapter required");
  }

  return {
    async resolveTenantIdentity(input = {}) {
      return resolveTenantIdentity(db, input);
    },

    async getSourceById(sourceId) {
      const r = await q(
        db,
        `
        select *
        from tenant_sources
        where id = $1
        limit 1
        `,
        [s(sourceId)]
      );
      return rowToSource(r.rows[0]);
    },

    async getSourceByKey({ tenantId, tenantKey, sourceKey }) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return null;

      const r = await q(
        db,
        `
        select *
        from tenant_sources
        where tenant_id = $1
          and source_key = $2
        limit 1
        `,
        [tenant.tenant_id, s(sourceKey)]
      );

      return rowToSource(r.rows[0]);
    },

    async listSources({
      tenantId,
      tenantKey,
      sourceType = "",
      status = "",
      isEnabled,
      limit = 100,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = params.length;
      let where = `where tenant_id = $1`;

      if (s(sourceType)) {
        idx += 1;
        params.push(normalizeSourceType(sourceType));
        where += ` and source_type = $${idx}`;
      }

      if (s(status)) {
        idx += 1;
        params.push(normalizeSourceStatus(status));
        where += ` and status = $${idx}`;
      }

      if (typeof isEnabled === "boolean") {
        idx += 1;
        params.push(isEnabled);
        where += ` and is_enabled = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 100))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_sources
        ${where}
        order by is_primary desc, updated_at desc, created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map(rowToSource);
    },

    async createSource(input = {}) {
      const tenant = await resolveTenantIdentity(db, {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });
      if (!tenant) throw new Error("tenantSources.createSource: tenant not found");

      const sourceType = normalizeSourceType(input.sourceType);
      const safeSourceUrl = sanitizeSourceUrl(input.sourceUrl);
      const sourceKey = normalizeSourceKey({
        sourceType,
        sourceUrl: safeSourceUrl,
        externalAccountId: input.externalAccountId,
        externalPageId: input.externalPageId,
        externalUsername: input.externalUsername,
        customKey: input.sourceKey,
      });

      const r = await q(
        db,
        `
        insert into tenant_sources (
          tenant_id,
          tenant_key,
          source_type,
          source_key,
          display_name,
          status,
          auth_status,
          sync_status,
          connection_mode,
          access_scope,
          source_url,
          external_account_id,
          external_page_id,
          external_username,
          is_enabled,
          is_primary,
          permissions_json,
          settings_json,
          metadata_json,
          last_connected_at,
          created_by,
          updated_by
        )
        values (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17::jsonb,$18::jsonb,$19::jsonb,
          $20,$21,$22
        )
        returning *
        `,
        [
          tenant.tenant_id,
          tenant.tenant_key,
          sourceType,
          sourceKey,
          s(input.displayName),
          normalizeSourceStatus(input.status || "pending"),
          normalizeAuthStatus(input.authStatus || "not_required"),
          normalizeSyncStatus(input.syncStatus || "idle"),
          normalizeConnectionMode(input.connectionMode || "manual"),
          normalizeAccessScope(input.accessScope || "public"),
          safeSourceUrl,
          s(input.externalAccountId),
          s(input.externalPageId),
          s(input.externalUsername),
          b(input.isEnabled, true),
          b(input.isPrimary, false),
          JSON.stringify(obj(input.permissionsJson, {})),
          JSON.stringify(obj(input.settingsJson, {})),
          JSON.stringify(obj(input.metadataJson, {})),
          input.lastConnectedAt || null,
          s(input.createdBy),
          s(input.updatedBy || input.createdBy),
        ]
      );

      return rowToSource(r.rows[0]);
    },

    async upsertSource(input = {}) {
      const tenant = await resolveTenantIdentity(db, {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });
      if (!tenant) throw new Error("tenantSources.upsertSource: tenant not found");

      const sourceType = normalizeSourceType(input.sourceType);
      const safeSourceUrl = sanitizeSourceUrl(input.sourceUrl);
      const sourceKey = normalizeSourceKey({
        sourceType,
        sourceUrl: safeSourceUrl,
        externalAccountId: input.externalAccountId,
        externalPageId: input.externalPageId,
        externalUsername: input.externalUsername,
        customKey: input.sourceKey,
      });

      const r = await q(
        db,
        `
        insert into tenant_sources (
          tenant_id,
          tenant_key,
          source_type,
          source_key,
          display_name,
          status,
          auth_status,
          sync_status,
          connection_mode,
          access_scope,
          source_url,
          external_account_id,
          external_page_id,
          external_username,
          is_enabled,
          is_primary,
          permissions_json,
          settings_json,
          metadata_json,
          last_connected_at,
          created_by,
          updated_by
        )
        values (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17::jsonb,$18::jsonb,$19::jsonb,
          $20,$21,$22
        )
        on conflict (tenant_id, source_key)
        do update set
          source_type = excluded.source_type,
          display_name = case
            when btrim(excluded.display_name) <> '' then excluded.display_name
            else tenant_sources.display_name
          end,
          status = excluded.status,
          auth_status = excluded.auth_status,
          sync_status = excluded.sync_status,
          connection_mode = excluded.connection_mode,
          access_scope = excluded.access_scope,
          source_url = case
            when btrim(excluded.source_url) <> '' then excluded.source_url
            else tenant_sources.source_url
          end,
          external_account_id = case
            when btrim(excluded.external_account_id) <> '' then excluded.external_account_id
            else tenant_sources.external_account_id
          end,
          external_page_id = case
            when btrim(excluded.external_page_id) <> '' then excluded.external_page_id
            else tenant_sources.external_page_id
          end,
          external_username = case
            when btrim(excluded.external_username) <> '' then excluded.external_username
            else tenant_sources.external_username
          end,
          is_enabled = excluded.is_enabled,
          is_primary = excluded.is_primary,
          permissions_json = case
            when excluded.permissions_json <> '{}'::jsonb then excluded.permissions_json
            else tenant_sources.permissions_json
          end,
          settings_json = case
            when excluded.settings_json <> '{}'::jsonb then excluded.settings_json
            else tenant_sources.settings_json
          end,
          metadata_json = case
            when excluded.metadata_json <> '{}'::jsonb then excluded.metadata_json
            else tenant_sources.metadata_json
          end,
          last_connected_at = coalesce(excluded.last_connected_at, tenant_sources.last_connected_at),
          updated_by = excluded.updated_by,
          updated_at = now()
        returning *
        `,
        [
          tenant.tenant_id,
          tenant.tenant_key,
          sourceType,
          sourceKey,
          s(input.displayName),
          normalizeSourceStatus(input.status || "pending"),
          normalizeAuthStatus(input.authStatus || "not_required"),
          normalizeSyncStatus(input.syncStatus || "idle"),
          normalizeConnectionMode(input.connectionMode || "manual"),
          normalizeAccessScope(input.accessScope || "public"),
          safeSourceUrl,
          s(input.externalAccountId),
          s(input.externalPageId),
          s(input.externalUsername),
          b(input.isEnabled, true),
          b(input.isPrimary, false),
          JSON.stringify(obj(input.permissionsJson, {})),
          JSON.stringify(obj(input.settingsJson, {})),
          JSON.stringify(obj(input.metadataJson, {})),
          input.lastConnectedAt || null,
          s(input.createdBy),
          s(input.updatedBy || input.createdBy),
        ]
      );

      return rowToSource(r.rows[0]);
    },

    async updateSource(sourceId, patch = {}) {
      const current = await this.getSourceById(sourceId);
      if (!current) return null;

      const safeSourceUrl =
        patch.sourceUrl !== undefined
          ? sanitizeSourceUrl(patch.sourceUrl)
          : sanitizeSourceUrl(current.source_url);

      const r = await q(
        db,
        `
        update tenant_sources
        set
          display_name = $2,
          status = $3,
          auth_status = $4,
          sync_status = $5,
          connection_mode = $6,
          access_scope = $7,
          source_url = $8,
          external_account_id = $9,
          external_page_id = $10,
          external_username = $11,
          is_enabled = $12,
          is_primary = $13,
          permissions_json = $14::jsonb,
          settings_json = $15::jsonb,
          metadata_json = $16::jsonb,
          last_connected_at = $17,
          last_sync_started_at = $18,
          last_sync_finished_at = $19,
          last_successful_sync_at = $20,
          last_error_at = $21,
          last_error_code = $22,
          last_error_message = $23,
          updated_by = $24,
          updated_at = now()
        where id = $1
        returning *
        `,
        [
          s(sourceId),
          s(patch.displayName, current.display_name),
          normalizeSourceStatus(patch.status ?? current.status),
          normalizeAuthStatus(patch.authStatus ?? current.auth_status),
          normalizeSyncStatus(patch.syncStatus ?? current.sync_status),
          normalizeConnectionMode(patch.connectionMode ?? current.connection_mode),
          normalizeAccessScope(patch.accessScope ?? current.access_scope),
          safeSourceUrl,
          s(patch.externalAccountId, current.external_account_id),
          s(patch.externalPageId, current.external_page_id),
          s(patch.externalUsername, current.external_username),
          typeof patch.isEnabled === "boolean" ? patch.isEnabled : current.is_enabled,
          typeof patch.isPrimary === "boolean" ? patch.isPrimary : current.is_primary,
          JSON.stringify(
            patch.permissionsJson !== undefined
              ? obj(patch.permissionsJson, {})
              : current.permissions_json
          ),
          JSON.stringify(
            patch.settingsJson !== undefined
              ? obj(patch.settingsJson, {})
              : current.settings_json
          ),
          JSON.stringify(
            patch.metadataJson !== undefined
              ? obj(patch.metadataJson, {})
              : current.metadata_json
          ),
          patch.lastConnectedAt ?? current.last_connected_at,
          patch.lastSyncStartedAt ?? current.last_sync_started_at,
          patch.lastSyncFinishedAt ?? current.last_sync_finished_at,
          patch.lastSuccessfulSyncAt ?? current.last_successful_sync_at,
          patch.lastErrorAt ?? current.last_error_at,
          s(patch.lastErrorCode, current.last_error_code),
          s(patch.lastErrorMessage, current.last_error_message),
          s(patch.updatedBy, current.updated_by),
        ]
      );

      return rowToSource(r.rows[0]);
    },

    async setSourceEnabled(sourceId, isEnabled, updatedBy = "") {
      return this.updateSource(sourceId, {
        isEnabled: b(isEnabled, true),
        updatedBy,
      });
    },

    async markSourceConnected(sourceId, patch = {}) {
      return this.updateSource(sourceId, {
        status: "connected",
        authStatus: patch.authStatus || "authorized",
        syncStatus: patch.syncStatus || "idle",
        lastConnectedAt: patch.lastConnectedAt || new Date().toISOString(),
        lastErrorAt: null,
        lastErrorCode: "",
        lastErrorMessage: "",
        updatedBy: patch.updatedBy || "",
        permissionsJson: patch.permissionsJson,
        settingsJson: patch.settingsJson,
        metadataJson: patch.metadataJson,
        externalAccountId: patch.externalAccountId,
        externalPageId: patch.externalPageId,
        externalUsername: patch.externalUsername,
        sourceUrl: patch.sourceUrl,
      });
    },

    async markSourceDisconnected(sourceId, patch = {}) {
      return this.updateSource(sourceId, {
        status: patch.status || "disconnected",
        authStatus: patch.authStatus || "revoked",
        syncStatus: patch.syncStatus || "idle",
        updatedBy: patch.updatedBy || "",
        lastErrorAt: patch.lastErrorAt ?? null,
        lastErrorCode: s(patch.lastErrorCode),
        lastErrorMessage: s(patch.lastErrorMessage),
      });
    },

    async markSourceSyncStarted(sourceId, patch = {}) {
      return this.updateSource(sourceId, {
        syncStatus: "running",
        lastSyncStartedAt: patch.startedAt || new Date().toISOString(),
        updatedBy: patch.updatedBy || "",
        lastErrorAt: null,
        lastErrorCode: "",
        lastErrorMessage: "",
      });
    },

    async markSourceSyncFinished(sourceId, patch = {}) {
      const status = normalizeSyncStatus(patch.syncStatus || "success");
      return this.updateSource(sourceId, {
        syncStatus: status,
        lastSyncFinishedAt: patch.finishedAt || new Date().toISOString(),
        lastSuccessfulSyncAt:
          status === "success" || status === "partial"
            ? patch.finishedAt || new Date().toISOString()
            : undefined,
        updatedBy: patch.updatedBy || "",
        lastErrorAt: status === "error" ? patch.lastErrorAt || new Date().toISOString() : null,
        lastErrorCode: status === "error" ? s(patch.lastErrorCode) : "",
        lastErrorMessage: status === "error" ? s(patch.lastErrorMessage) : "",
      });
    },

    async clearSourceError(sourceId, updatedBy = "") {
      return this.updateSource(sourceId, {
        lastErrorAt: null,
        lastErrorCode: "",
        lastErrorMessage: "",
        updatedBy,
      });
    },

    async createSyncRun(input = {}) {
      const tenant = await resolveTenantIdentity(db, {
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });
      if (!tenant) throw new Error("tenantSources.createSyncRun: tenant not found");

      const sourceId = s(input.sourceId);
      if (!sourceId) throw new Error("tenantSources.createSyncRun: sourceId is required");

      const r = await q(
        db,
        `
        insert into tenant_source_sync_runs (
          tenant_id,
          tenant_key,
          source_id,
          run_type,
          trigger_type,
          status,
          started_at,
          finished_at,
          duration_ms,
          input_summary_json,
          extraction_summary_json,
          result_summary_json,
          pages_scanned,
          records_scanned,
          candidates_created,
          items_promoted,
          conflicts_found,
          warnings_count,
          errors_count,
          error_code,
          error_message,
          logs_json,
          requested_by,
          runner_key,
          review_session_id,
          metadata_json,
          meta_json,
          attempt_count,
          max_attempts,
          last_attempt_at,
          next_retry_at,
          lease_token,
          lease_expires_at,
          claimed_by
        )
        values (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,
          $10::jsonb,$11::jsonb,$12::jsonb,
          $13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22::jsonb,$23,$24,
          $25,$26::jsonb,$27::jsonb,$28,$29,$30,$31,$32,$33,$34
        )
        returning *
        `,
        [
          tenant.tenant_id,
          tenant.tenant_key,
          sourceId,
          normalizeRunType(input.runType || "sync"),
          normalizeTriggerType(input.triggerType || "manual"),
          normalizeRunStatus(input.status || "queued"),
          input.startedAt || null,
          input.finishedAt || null,
          Math.max(0, n(input.durationMs, 0)),
          JSON.stringify(obj(input.inputSummaryJson, {})),
          JSON.stringify(obj(input.extractionSummaryJson, {})),
          JSON.stringify(obj(input.resultSummaryJson, {})),
          Math.max(0, n(input.pagesScanned, 0)),
          Math.max(0, n(input.recordsScanned, 0)),
          Math.max(0, n(input.candidatesCreated, 0)),
          Math.max(0, n(input.itemsPromoted, 0)),
          Math.max(0, n(input.conflictsFound, 0)),
          Math.max(0, n(input.warningsCount, 0)),
          Math.max(0, n(input.errorsCount, 0)),
          s(input.errorCode),
          s(input.errorMessage),
          JSON.stringify(arr(input.logsJson, [])),
          s(input.requestedBy),
          s(input.runnerKey),
          s(input.reviewSessionId) || null,
          JSON.stringify(obj(input.metadataJson, {})),
          JSON.stringify(obj(input.metaJson, obj(input.metadataJson, {}))),
          Math.max(0, n(input.attemptCount, 0)),
          Math.max(1, n(input.maxAttempts, 3)),
          input.lastAttemptAt || null,
          input.nextRetryAt || null,
          s(input.leaseToken),
          input.leaseExpiresAt || null,
          s(input.claimedBy),
        ]
      );

      return rowToSyncRun(r.rows[0]);
    },

    async getSyncRunById(runId) {
      const r = await q(
        db,
        `
        select *
        from tenant_source_sync_runs
        where id = $1
        limit 1
        `,
        [s(runId)]
      );
      return rowToSyncRun(r.rows[0]);
    },

    async listSyncRuns({
      tenantId,
      tenantKey,
      sourceId = "",
      status = "",
      limit = 100,
      offset = 0,
    } = {}) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) return [];

      const params = [tenant.tenant_id];
      let idx = 1;
      let where = `where tenant_id = $1`;

      if (s(sourceId)) {
        idx += 1;
        params.push(s(sourceId));
        where += ` and source_id = $${idx}`;
      }

      if (s(status)) {
        idx += 1;
        params.push(normalizeRunStatus(status));
        where += ` and status = $${idx}`;
      }

      idx += 1;
      params.push(Math.max(1, Math.min(500, n(limit, 100))));
      const limitIdx = idx;

      idx += 1;
      params.push(Math.max(0, n(offset, 0)));
      const offsetIdx = idx;

      const r = await q(
        db,
        `
        select *
        from tenant_source_sync_runs
        ${where}
        order by created_at desc
        limit $${limitIdx}
        offset $${offsetIdx}
        `,
        params
      );

      return r.rows.map(rowToSyncRun);
    },

    async updateSyncRun(runId, patch = {}) {
      const current = await this.getSyncRunById(runId);
      if (!current) return null;

      const r = await q(
        db,
        `
        update tenant_source_sync_runs
        set
          run_type = $2,
          trigger_type = $3,
          status = $4,
          started_at = $5,
          finished_at = $6,
          duration_ms = $7,
          input_summary_json = $8::jsonb,
          extraction_summary_json = $9::jsonb,
          result_summary_json = $10::jsonb,
          pages_scanned = $11,
          records_scanned = $12,
          candidates_created = $13,
          items_promoted = $14,
          conflicts_found = $15,
          warnings_count = $16,
          errors_count = $17,
          error_code = $18,
          error_message = $19,
          logs_json = $20::jsonb,
          requested_by = $21,
          runner_key = $22,
          review_session_id = $23,
          metadata_json = $24::jsonb,
          meta_json = $25::jsonb,
          attempt_count = $26,
          max_attempts = $27,
          last_attempt_at = $28,
          next_retry_at = $29,
          lease_token = $30,
          lease_expires_at = $31,
          claimed_by = $32,
          updated_at = now()
        where id = $1
        returning *
        `,
        [
          s(runId),
          normalizeRunType(patch.runType ?? current.run_type),
          normalizeTriggerType(patch.triggerType ?? current.trigger_type),
          normalizeRunStatus(patch.status ?? current.status),
          patch.startedAt ?? current.started_at,
          patch.finishedAt ?? current.finished_at,
          Math.max(0, n(patch.durationMs, current.duration_ms)),
          JSON.stringify(
            patch.inputSummaryJson !== undefined
              ? obj(patch.inputSummaryJson, {})
              : current.input_summary_json
          ),
          JSON.stringify(
            patch.extractionSummaryJson !== undefined
              ? obj(patch.extractionSummaryJson, {})
              : current.extraction_summary_json
          ),
          JSON.stringify(
            patch.resultSummaryJson !== undefined
              ? obj(patch.resultSummaryJson, {})
              : current.result_summary_json
          ),
          Math.max(0, n(patch.pagesScanned, current.pages_scanned)),
          Math.max(0, n(patch.recordsScanned, current.records_scanned)),
          Math.max(0, n(patch.candidatesCreated, current.candidates_created)),
          Math.max(0, n(patch.itemsPromoted, current.items_promoted)),
          Math.max(0, n(patch.conflictsFound, current.conflicts_found)),
          Math.max(0, n(patch.warningsCount, current.warnings_count)),
          Math.max(0, n(patch.errorsCount, current.errors_count)),
          s(patch.errorCode, current.error_code),
          s(patch.errorMessage, current.error_message),
          JSON.stringify(
            patch.logsJson !== undefined ? arr(patch.logsJson, []) : current.logs_json
          ),
          s(patch.requestedBy, current.requested_by),
          s(patch.runnerKey, current.runner_key),
          s(patch.reviewSessionId, current.review_session_id) || null,
          JSON.stringify(
            patch.metadataJson !== undefined
              ? obj(patch.metadataJson, {})
              : current.metadata_json
          ),
          JSON.stringify(
            patch.metaJson !== undefined
              ? obj(patch.metaJson, {})
              : current.meta_json
          ),
          Math.max(0, n(patch.attemptCount, current.attempt_count)),
          Math.max(1, n(patch.maxAttempts, current.max_attempts || 3)),
          patch.lastAttemptAt ?? current.last_attempt_at,
          patch.nextRetryAt ?? current.next_retry_at,
          s(patch.leaseToken, current.lease_token),
          patch.leaseExpiresAt ?? current.lease_expires_at,
          s(patch.claimedBy, current.claimed_by),
        ]
      );

      return rowToSyncRun(r.rows[0]);
    },

    async markSourceSyncQueued(sourceId, patch = {}) {
      return this.updateSource(sourceId, {
        syncStatus: "queued",
        lastSyncRequestedAt: patch.queuedAt || new Date().toISOString(),
        updatedBy: patch.updatedBy || "",
      });
    },

    async markSyncRunStarted(runId, patch = {}) {
      return this.updateSyncRun(runId, {
        status: "running",
        startedAt: patch.startedAt || new Date().toISOString(),
        lastAttemptAt: patch.lastAttemptAt || new Date().toISOString(),
        errorCode: "",
        errorMessage: "",
        nextRetryAt: null,
        leaseToken: s(patch.leaseToken),
        leaseExpiresAt: patch.leaseExpiresAt || null,
        claimedBy: s(patch.claimedBy),
        runnerKey: s(patch.runnerKey),
      });
    },

    async markSyncRunFinished(runId, patch = {}) {
      const finishedAt = patch.finishedAt || new Date().toISOString();
      const startedAt = patch.startedAt || null;
      const durationMs =
        patch.durationMs != null
          ? Math.max(0, n(patch.durationMs, 0))
          : startedAt
            ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
            : undefined;

      return this.updateSyncRun(runId, {
        status: patch.status || "success",
        finishedAt,
        durationMs,
        inputSummaryJson: patch.inputSummaryJson,
        extractionSummaryJson: patch.extractionSummaryJson,
        resultSummaryJson: patch.resultSummaryJson,
        pagesScanned: patch.pagesScanned,
        recordsScanned: patch.recordsScanned,
        candidatesCreated: patch.candidatesCreated,
        itemsPromoted: patch.itemsPromoted,
        conflictsFound: patch.conflictsFound,
        warningsCount: patch.warningsCount,
        errorsCount: patch.errorsCount,
        errorCode: patch.errorCode,
        errorMessage: patch.errorMessage,
        logsJson: patch.logsJson,
        requestedBy: patch.requestedBy,
        runnerKey: patch.runnerKey,
        leaseToken: "",
        leaseExpiresAt: null,
        claimedBy: "",
        nextRetryAt: null,
      });
    },

    async claimNextSyncRun({
      runnerKey = "",
      leaseToken = "",
      leaseMs = 10 * 60 * 1000,
    } = {}) {
      const claimedBy = s(runnerKey) || "source-sync-worker";
      const token = s(leaseToken) || `${claimedBy}:${Date.now()}`;
      const safeLeaseMs = Math.max(5_000, n(leaseMs, 10 * 60 * 1000));

      const r = await q(
        db,
        `
        with claimable as (
          select id
          from tenant_source_sync_runs
          where (
            status = 'queued'
            and coalesce(next_retry_at, now()) <= now()
          ) or (
            status = 'running'
            and lease_expires_at is not null
            and lease_expires_at <= now()
          )
          order by
            case when status = 'queued' then 0 else 1 end,
            coalesce(next_retry_at, created_at) asc,
            created_at asc
          limit 1
          for update skip locked
        )
        update tenant_source_sync_runs runs
        set
          status = 'running',
          started_at = coalesce(runs.started_at, now()),
          last_attempt_at = now(),
          attempt_count = greatest(0, coalesce(runs.attempt_count, 0)) + 1,
          next_retry_at = null,
          lease_token = $1,
          lease_expires_at = now() + ($2 * interval '1 millisecond'),
          claimed_by = $3,
          runner_key = $3,
          updated_at = now()
        from claimable
        where runs.id = claimable.id
        returning runs.*
        `,
        [token, safeLeaseMs, claimedBy]
      );

      const claimed = rowToSyncRun(r.rows?.[0]);
      if (!claimed?.id) return null;

      try {
        await this.markSourceSyncStarted(claimed.source_id, {
          startedAt: claimed.started_at || new Date().toISOString(),
          updatedBy: claimedBy,
        });
      } catch {}

      return claimed;
    },

    async releaseSyncRunForRetry({
      runId,
      sourceId = "",
      requestedBy = "",
      errorCode = "",
      errorMessage = "",
      logsJson = [],
      resultSummaryJson = {},
      extractionSummaryJson = {},
      inputSummaryJson = {},
      retryDelayMs = 15_000,
    } = {}) {
      const current = await this.getSyncRunById(runId);
      if (!current?.id) return null;

      const nextRetryAt = new Date(
        Date.now() + Math.max(1_000, n(retryDelayMs, 15_000))
      ).toISOString();

      const retrySummary = {
        ...obj(current.result_summary_json),
        ...obj(resultSummaryJson),
        retry: {
          eligible: true,
          nextRetryAt,
          attemptCount: n(current.attempt_count, 0),
          maxAttempts: Math.max(1, n(current.max_attempts, 3)),
        },
      };

      const run = await this.updateSyncRun(runId, {
        status: "queued",
        triggerType: "retry",
        errorCode: s(errorCode),
        errorMessage: s(errorMessage),
        logsJson: arr(logsJson),
        resultSummaryJson: retrySummary,
        extractionSummaryJson:
          extractionSummaryJson !== undefined
            ? obj(extractionSummaryJson, {})
            : current.extraction_summary_json,
        inputSummaryJson:
          inputSummaryJson !== undefined
            ? obj(inputSummaryJson, {})
            : current.input_summary_json,
        nextRetryAt,
        leaseToken: "",
        leaseExpiresAt: null,
        claimedBy: "",
        finishedAt: null,
        requestedBy,
      });

      if (s(sourceId || current.source_id)) {
        await this.updateSource(sourceId || current.source_id, {
          syncStatus: "queued",
          updatedBy: requestedBy,
          lastErrorAt: new Date().toISOString(),
          lastErrorCode: s(errorCode),
          lastErrorMessage: s(errorMessage),
        });
      }

      return run;
    },

    async connectOrUpdateSource(input = {}) {
      const source = await this.upsertSource({
        ...input,
        status: input.status || "connected",
        authStatus: input.authStatus || "authorized",
        syncStatus: input.syncStatus || "idle",
        lastConnectedAt: input.lastConnectedAt || new Date().toISOString(),
      });

      return source;
    },

    async beginSourceSync({
      sourceId,
      requestedBy = "",
      runnerKey = "",
      runType = "sync",
      triggerType = "manual",
      reviewSessionId = "",
      metadataJson = {},
      maxAttempts = 3,
    }) {
      const source = await this.getSourceById(sourceId);
      if (!source) throw new Error("tenantSources.beginSourceSync: source not found");

      const queuedAt = new Date().toISOString();

      await this.markSourceSyncQueued(sourceId, {
        queuedAt,
        updatedBy: requestedBy,
      });

      const run = await this.createSyncRun({
        tenantId: source.tenant_id,
        tenantKey: source.tenant_key,
        sourceId: source.id,
        runType,
        triggerType,
        status: "queued",
        startedAt: null,
        requestedBy,
        runnerKey,
        reviewSessionId,
        metadataJson,
        metaJson: metadataJson,
        maxAttempts,
        nextRetryAt: queuedAt,
      });

      return {
        source: await this.getSourceById(sourceId),
        run,
      };
    },

    async finishSourceSync({
      sourceId,
      runId,
      syncStatus = "success",
      runStatus = "success",
      requestedBy = "",
      resultSummaryJson = {},
      extractionSummaryJson = {},
      inputSummaryJson = {},
      pagesScanned = 0,
      recordsScanned = 0,
      candidatesCreated = 0,
      itemsPromoted = 0,
      conflictsFound = 0,
      warningsCount = 0,
      errorsCount = 0,
      errorCode = "",
      errorMessage = "",
      logsJson = [],
      finishedAt,
    }) {
      const doneAt = finishedAt || new Date().toISOString();

      if (runId) {
        await this.markSyncRunFinished(runId, {
          status: runStatus,
          finishedAt: doneAt,
          inputSummaryJson,
          extractionSummaryJson,
          resultSummaryJson,
          pagesScanned,
          recordsScanned,
          candidatesCreated,
          itemsPromoted,
          conflictsFound,
          warningsCount,
          errorsCount,
          errorCode,
          errorMessage,
          logsJson,
          requestedBy,
        });
      }

      await this.markSourceSyncFinished(sourceId, {
        syncStatus,
        finishedAt: doneAt,
        updatedBy: requestedBy,
        lastErrorAt: syncStatus === "error" ? doneAt : null,
        lastErrorCode: syncStatus === "error" ? errorCode : "",
        lastErrorMessage: syncStatus === "error" ? errorMessage : "",
      });

      return {
        source: await this.getSourceById(sourceId),
        run: runId ? await this.getSyncRunById(runId) : null,
      };
    },

    async markSourceSyncError({
      sourceId,
      runId,
      requestedBy = "",
      errorCode = "",
      errorMessage = "",
      logsJson = [],
      resultSummaryJson = {},
      extractionSummaryJson = {},
      inputSummaryJson = {},
      pagesScanned = 0,
      recordsScanned = 0,
      candidatesCreated = 0,
      itemsPromoted = 0,
      conflictsFound = 0,
      warningsCount = 0,
      errorsCount = 1,
    }) {
      return this.finishSourceSync({
        sourceId,
        runId,
        syncStatus: "error",
        runStatus: "failed",
        requestedBy,
        resultSummaryJson,
        extractionSummaryJson,
        inputSummaryJson,
        pagesScanned,
        recordsScanned,
        candidatesCreated,
        itemsPromoted,
        conflictsFound,
        warningsCount,
        errorsCount,
        errorCode,
        errorMessage,
        logsJson,
      });
    },

    async setPrimarySourceForType({ tenantId, tenantKey, sourceType, sourceId, updatedBy = "" }) {
      const tenant = await resolveTenantIdentity(db, { tenantId, tenantKey });
      if (!tenant) throw new Error("tenantSources.setPrimarySourceForType: tenant not found");

      await q(
        db,
        `
        update tenant_sources
        set
          is_primary = false,
          updated_by = $3,
          updated_at = now()
        where tenant_id = $1
          and source_type = $2
        `,
        [tenant.tenant_id, normalizeSourceType(sourceType), s(updatedBy)]
      );

      const r = await q(
        db,
        `
        update tenant_sources
        set
          is_primary = true,
          updated_by = $3,
          updated_at = now()
        where id = $1
          and tenant_id = $2
        returning *
        `,
        [s(sourceId), tenant.tenant_id, s(updatedBy)]
      );

      return rowToSource(r.rows[0]);
    },

    async deleteSource(sourceId) {
      const current = await this.getSourceById(sourceId);
      if (!current) return false;

      await q(
        db,
        `
        delete from tenant_sources
        where id = $1
        `,
        [s(sourceId)]
      );

      return true;
    },

    async archiveSource(sourceId, updatedBy = "") {
      return this.updateSource(sourceId, {
        status: "archived",
        isEnabled: false,
        updatedBy,
      });
    },
  };
}
