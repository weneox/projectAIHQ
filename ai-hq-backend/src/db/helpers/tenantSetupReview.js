// src/db/helpers/tenantSetupReview.js
// FINAL v1.1 — setup review session lifecycle helper
// fixes:
// - prevent email/text values from being written into uuid columns
// - normalize optional uuid fields safely across session/draft/source helpers
// - keep canonical business truth untouched during setup retests
// - keep current setup work in a separate active session + draft layer
// - link sources to a setup session cleanly
// - provide tx-safe read/write/discard/finalize helpers
// - allow finalize to project draft -> canonical via injected callback

import { db, getDb } from "../index.js";
import {
  refreshTenantRuntimeProjectionStrict,
  getCurrentTenantRuntimeProjection,
  loadTenantCanonicalGraph,
  buildTenantRuntimeProjection,
} from "./tenantRuntimeProjection.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function bool(v, d = false) {
  if (typeof v === "boolean") return v;
  const x = s(v).toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

function oneOf(value, allowed = [], fallback = "") {
  const x = s(value).toLowerCase();
  return allowed.includes(x) ? x : fallback;
}

function asJson(v, d) {
  if (v == null) return d;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return d;
    }
  }
  return v;
}

function nowIso() {
  return new Date().toISOString();
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s(value)
  );
}

function safeUuidOrNull(value = null) {
  const x = s(value);
  return isUuid(x) ? x : null;
}

function getDbHandle() {
  if (db) return db;
  if (typeof getDb === "function") {
    const x = getDb();
    if (x) return x;
  }
  throw new Error("Database is not initialized.");
}

async function withClient(fn) {
  const handle = getDbHandle();

  if (typeof handle.connect === "function") {
    const client = await handle.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  return await fn(handle);
}

async function withTx(fn) {
  return withClient(async (client) => {
    const canTx = typeof client.query === "function";

    if (!canTx) {
      throw new Error("Database client does not support query().");
    }

    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  });
}

function normalizeSessionStatus(v, d = "draft") {
  return oneOf(v, ["draft", "processing", "ready", "finalized", "discarded", "failed"], d);
}

function normalizeSessionMode(v, d = "setup") {
  return oneOf(v, ["setup", "refresh", "rescan"], d);
}

function normalizeSourceRole(v, d = "context") {
  return oneOf(v, ["primary", "context", "supporting"], d);
}

function normalizeSessionRow(row = {}) {
  const x = obj(row);
  return {
    id: s(x.id),
    tenantId: s(x.tenant_id),
    status: normalizeSessionStatus(x.status, "draft"),
    mode: normalizeSessionMode(x.mode, "setup"),
    primarySourceType: s(x.primary_source_type),
    primarySourceId: safeUuidOrNull(x.primary_source_id),
    currentStep: s(x.current_step),
    startedBy: safeUuidOrNull(x.started_by),
    baseRuntimeProjectionId: safeUuidOrNull(x.base_runtime_projection_id),
    title: s(x.title),
    notes: s(x.notes),
    metadata: asJson(x.metadata, {}),
    failurePayload: asJson(x.failure_payload, {}),
    startedAt: x.started_at || null,
    updatedAt: x.updated_at || null,
    finalizedAt: x.finalized_at || null,
    discardedAt: x.discarded_at || null,
    failedAt: x.failed_at || null,
  };
}

function normalizeDraftRow(row = {}) {
  const x = obj(row);
  return {
    id: s(x.id),
    sessionId: s(x.session_id),
    tenantId: s(x.tenant_id),
    draftPayload: asJson(x.draft_payload, {}),
    businessProfile: asJson(x.business_profile, {}),
    capabilities: asJson(x.capabilities, {}),
    services: asJson(x.services, []),
    knowledgeItems: asJson(x.knowledge_items, []),
    channels: asJson(x.channels, []),
    sourceSummary: asJson(x.source_summary, {}),
    warnings: asJson(x.warnings, []),
    completeness: asJson(x.completeness, {}),
    confidenceSummary: asJson(x.confidence_summary, {}),
    diffFromCanonical: asJson(x.diff_from_canonical, {}),
    lastSnapshotId: safeUuidOrNull(x.last_snapshot_id),
    version: n(x.version, 1),
    createdAt: x.created_at || null,
    updatedAt: x.updated_at || null,
  };
}

function normalizeSourceRow(row = {}) {
  const x = obj(row);
  return {
    id: s(x.id),
    sessionId: s(x.session_id),
    tenantId: s(x.tenant_id),
    sourceId: safeUuidOrNull(x.source_id),
    sourceType: s(x.source_type),
    role: normalizeSourceRole(x.role, "context"),
    label: s(x.label),
    position: n(x.position, 0),
    metadata: asJson(x.metadata, {}),
    attachedAt: x.attached_at || null,
  };
}

function normalizeEventRow(row = {}) {
  const x = obj(row);
  return {
    id: s(x.id),
    sessionId: s(x.session_id),
    tenantId: s(x.tenant_id),
    eventType: s(x.event_type),
    payload: asJson(x.payload, {}),
    createdAt: x.created_at || null,
  };
}

function emptyDraftPayload(sessionId = "", tenantId = "") {
  return {
    id: "",
    sessionId: s(sessionId),
    tenantId: s(tenantId),
    draftPayload: {},
    businessProfile: {},
    capabilities: {},
    services: [],
    knowledgeItems: [],
    channels: [],
    sourceSummary: {},
    warnings: [],
    completeness: {},
    confidenceSummary: {},
    diffFromCanonical: {},
    lastSnapshotId: null,
    version: 1,
    createdAt: null,
    updatedAt: null,
  };
}

async function captureCanonicalBaseline(tenantId, client) {
  const tid = s(tenantId);
  if (!tid) return null;

  try {
    const graph = await loadTenantCanonicalGraph({ tenantId: tid }, client);
    const projection = buildTenantRuntimeProjection(graph);

    return {
      tenantId: tid,
      projectionHash: s(projection?.projection_hash),
      synthesisSnapshotId: safeUuidOrNull(graph?.synthesis?.id),
      capturedAt: nowIso(),
    };
  } catch (error) {
    return {
      tenantId: tid,
      projectionHash: "",
      synthesisSnapshotId: null,
      capturedAt: nowIso(),
      error: s(error?.message || "baseline_capture_failed"),
    };
  }
}

function normalizeBaselineMetadata(input = {}) {
  const x = obj(input);
  return {
    tenantId: s(x.tenantId),
    projectionHash: s(x.projectionHash),
    synthesisSnapshotId: safeUuidOrNull(x.synthesisSnapshotId),
    capturedAt: x.capturedAt || null,
    error: s(x.error),
  };
}

export function hasCanonicalBaselineDrift(baselineInput = {}, currentInput = {}) {
  const baseline = normalizeBaselineMetadata(baselineInput);
  const current = normalizeBaselineMetadata(currentInput);

  if (!baseline.capturedAt) return false;

  return (
    s(baseline.projectionHash) !== s(current.projectionHash) ||
    safeUuidOrNull(baseline.synthesisSnapshotId) !==
      safeUuidOrNull(current.synthesisSnapshotId)
  );
}

export function createCanonicalBaselineDriftError(
  baselineInput = {},
  currentInput = {}
) {
  const err = new Error(
    "finalizeSetupReviewSession: canonical baseline drift detected."
  );
  err.code = "SETUP_REVIEW_BASELINE_DRIFT";
  err.baseline = normalizeBaselineMetadata(baselineInput);
  err.current = normalizeBaselineMetadata(currentInput);
  return err;
}

async function resolveBaselineForSession(
  { tenantId, baseRuntimeProjectionId = null, metadata = {} } = {},
  client
) {
  const existing = normalizeBaselineMetadata(obj(metadata).canonicalBaseline);
  if (existing.capturedAt) {
    return {
      baseRuntimeProjectionId: safeUuidOrNull(baseRuntimeProjectionId),
      canonicalBaseline: existing,
    };
  }

  const currentRuntimeProjection = await getCurrentTenantRuntimeProjection(
    { tenantId },
    client
  );
  const captured = normalizeBaselineMetadata(
    await captureCanonicalBaseline(tenantId, client)
  );

  return {
    baseRuntimeProjectionId:
      safeUuidOrNull(baseRuntimeProjectionId) ||
      safeUuidOrNull(currentRuntimeProjection?.id) ||
      null,
    canonicalBaseline: captured,
  };
}

async function detectCanonicalBaselineDrift(session = {}, client) {
  const baseline = normalizeBaselineMetadata(obj(session.metadata).canonicalBaseline);
  if (!baseline.capturedAt) {
    return {
      drifted: false,
      baseline,
      current: null,
    };
  }

  const current = normalizeBaselineMetadata(
    await captureCanonicalBaseline(session.tenantId, client)
  );

  return {
    drifted: hasCanonicalBaselineDrift(baseline, current),
    baseline,
    current,
  };
}

async function insertSetupReviewEvent(
  client,
  {
    sessionId,
    tenantId,
    eventType,
    payload = {},
  } = {},
) {
  const sid = s(sessionId);
  const tid = s(tenantId);
  const type = s(eventType);

  if (!sid || !tid || !type) return null;

  const { rows } = await client.query(
    `
      INSERT INTO public.tenant_setup_review_events (
        session_id,
        tenant_id,
        event_type,
        payload
      )
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *
    `,
    [sid, tid, type, JSON.stringify(obj(payload))]
  );

  return normalizeEventRow(rows?.[0] || {});
}

export async function getSetupReviewSessionById(sessionId, client = null) {
  const sid = s(sessionId);
  if (!sid) return null;

  const run = async (cx) => {
    const { rows } = await cx.query(
      `
        SELECT *
        FROM public.tenant_setup_review_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sid]
    );
    return rows?.[0] ? normalizeSessionRow(rows[0]) : null;
  };

  return client ? run(client) : withClient(run);
}

export async function listSetupReviewSessionsByTenant(
  tenantId,
  { limit = 20, includeFinished = true } = {},
  client = null,
) {
  const tid = s(tenantId);
  if (!tid) return [];

  const safeLimit = Math.max(1, Math.min(100, n(limit, 20)));

  const run = async (cx) => {
    const values = [tid, safeLimit];
    let sql = `
      SELECT *
      FROM public.tenant_setup_review_sessions
      WHERE tenant_id = $1
    `;

    if (!bool(includeFinished, true)) {
      sql += ` AND status IN ('draft', 'processing', 'ready')`;
    }

    sql += ` ORDER BY updated_at DESC, started_at DESC LIMIT $2`;

    const { rows } = await cx.query(sql, values);
    return arr(rows).map(normalizeSessionRow);
  };

  return client ? run(client) : withClient(run);
}

export async function getActiveSetupReviewSession(tenantId, client = null) {
  const tid = s(tenantId);
  if (!tid) return null;

  const run = async (cx) => {
    const { rows } = await cx.query(
      `
        SELECT *
        FROM public.tenant_setup_review_sessions
        WHERE tenant_id = $1
          AND status IN ('draft', 'processing', 'ready')
        ORDER BY updated_at DESC, started_at DESC
        LIMIT 1
      `,
      [tid]
    );

    return rows?.[0] ? normalizeSessionRow(rows[0]) : null;
  };

  return client ? run(client) : withClient(run);
}

export async function createSetupReviewSession(
  {
    tenantId,
    mode = "setup",
    status = "draft",
    primarySourceType = "",
    primarySourceId = null,
    startedBy = null,
    currentStep = "",
    baseRuntimeProjectionId = null,
    title = "",
    notes = "",
    metadata = {},
    ensureDraft = true,
  } = {},
  client = null,
) {
  const tid = s(tenantId);
  if (!tid) {
    throw new Error("createSetupReviewSession: tenantId is required.");
  }

  const run = async (cx) => {
    const safePrimarySourceId = safeUuidOrNull(primarySourceId);
    const safeStartedBy = safeUuidOrNull(startedBy);
    const baseline = await resolveBaselineForSession(
      {
        tenantId: tid,
        baseRuntimeProjectionId,
        metadata,
      },
      cx
    );
    const safeBaseRuntimeProjectionId = safeUuidOrNull(
      baseline.baseRuntimeProjectionId
    );
    const sessionMetadata = {
      ...obj(metadata),
      canonicalBaseline: baseline.canonicalBaseline,
    };

    const { rows } = await cx.query(
      `
        INSERT INTO public.tenant_setup_review_sessions (
          tenant_id,
          status,
          mode,
          primary_source_type,
          primary_source_id,
          started_by,
          current_step,
          base_runtime_projection_id,
          title,
          notes,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        RETURNING *
      `,
      [
        tid,
        normalizeSessionStatus(status, "draft"),
        normalizeSessionMode(mode, "setup"),
        s(primarySourceType),
        safePrimarySourceId,
        safeStartedBy,
        s(currentStep),
        safeBaseRuntimeProjectionId,
        s(title),
        s(notes),
        JSON.stringify(sessionMetadata),
      ]
    );

    const session = normalizeSessionRow(rows?.[0] || {});

    if (bool(ensureDraft, true)) {
      await ensureSetupReviewDraft(
        {
          sessionId: session.id,
          tenantId: session.tenantId,
        },
        cx,
      );
    }

    await insertSetupReviewEvent(cx, {
      sessionId: session.id,
      tenantId: session.tenantId,
      eventType: "session_created",
      payload: {
        mode: session.mode,
        status: session.status,
        primarySourceType: session.primarySourceType,
        primarySourceId: session.primarySourceId,
        currentStep: session.currentStep,
        title: session.title,
        at: nowIso(),
      },
    });

    return session;
  };

  return client ? run(client) : withTx(run);
}

export async function getOrCreateActiveSetupReviewSession(
  {
    tenantId,
    mode = "setup",
    primarySourceType = "",
    primarySourceId = null,
    startedBy = null,
    currentStep = "",
    baseRuntimeProjectionId = null,
    title = "",
    notes = "",
    metadata = {},
    ensureDraft = true,
  } = {},
  client = null,
) {
  const tid = s(tenantId);
  if (!tid) {
    throw new Error("getOrCreateActiveSetupReviewSession: tenantId is required.");
  }

  const run = async (cx) => {
    const locked = await cx.query(
      `
        SELECT *
        FROM public.tenant_setup_review_sessions
        WHERE tenant_id = $1
          AND status IN ('draft', 'processing', 'ready')
        ORDER BY updated_at DESC, started_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [tid]
    );

    if (locked.rows?.[0]) {
      const session = normalizeSessionRow(locked.rows[0]);

      if (bool(ensureDraft, true)) {
        await ensureSetupReviewDraft(
          {
            sessionId: session.id,
            tenantId: session.tenantId,
          },
          cx,
        );
      }

      return session;
    }

    return createSetupReviewSession(
      {
        tenantId: tid,
        mode,
        status: "draft",
        primarySourceType,
        primarySourceId: safeUuidOrNull(primarySourceId),
        startedBy: safeUuidOrNull(startedBy),
        currentStep,
        baseRuntimeProjectionId: safeUuidOrNull(baseRuntimeProjectionId),
        title,
        notes,
        metadata,
        ensureDraft,
      },
      cx,
    );
  };

  return client ? run(client) : withTx(run);
}

export async function updateSetupReviewSession(
  sessionId,
  {
    status,
    mode,
    primarySourceType,
    primarySourceId,
    currentStep,
    startedBy,
    baseRuntimeProjectionId,
    title,
    notes,
    metadata,
    failurePayload,
    finalizedAt,
    discardedAt,
    failedAt,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  if (!sid) {
    throw new Error("updateSetupReviewSession: sessionId is required.");
  }

  const updates = [];
  const values = [];
  let i = 1;

  if (status !== undefined) {
    updates.push(`status = $${i++}`);
    values.push(normalizeSessionStatus(status, "draft"));
  }
  if (mode !== undefined) {
    updates.push(`mode = $${i++}`);
    values.push(normalizeSessionMode(mode, "setup"));
  }
  if (primarySourceType !== undefined) {
    updates.push(`primary_source_type = $${i++}`);
    values.push(s(primarySourceType));
  }
  if (primarySourceId !== undefined) {
    updates.push(`primary_source_id = $${i++}`);
    values.push(safeUuidOrNull(primarySourceId));
  }
  if (currentStep !== undefined) {
    updates.push(`current_step = $${i++}`);
    values.push(s(currentStep));
  }
  if (startedBy !== undefined) {
    updates.push(`started_by = $${i++}`);
    values.push(safeUuidOrNull(startedBy));
  }
  if (baseRuntimeProjectionId !== undefined) {
    updates.push(`base_runtime_projection_id = $${i++}`);
    values.push(safeUuidOrNull(baseRuntimeProjectionId));
  }
  if (title !== undefined) {
    updates.push(`title = $${i++}`);
    values.push(s(title));
  }
  if (notes !== undefined) {
    updates.push(`notes = $${i++}`);
    values.push(s(notes));
  }
  if (metadata !== undefined) {
    updates.push(`metadata = $${i++}::jsonb`);
    values.push(JSON.stringify(obj(metadata)));
  }
  if (failurePayload !== undefined) {
    updates.push(`failure_payload = $${i++}::jsonb`);
    values.push(JSON.stringify(obj(failurePayload)));
  }
  if (finalizedAt !== undefined) {
    updates.push(`finalized_at = $${i++}`);
    values.push(finalizedAt || null);
  }
  if (discardedAt !== undefined) {
    updates.push(`discarded_at = $${i++}`);
    values.push(discardedAt || null);
  }
  if (failedAt !== undefined) {
    updates.push(`failed_at = $${i++}`);
    values.push(failedAt || null);
  }

  if (!updates.length) {
    return getSetupReviewSessionById(sid, client);
  }

  const run = async (cx) => {
    values.push(sid);

    const { rows } = await cx.query(
      `
        UPDATE public.tenant_setup_review_sessions
        SET ${updates.join(", ")}
        WHERE id = $${i}
        RETURNING *
      `,
      values
    );

    return rows?.[0] ? normalizeSessionRow(rows[0]) : null;
  };

  return client ? run(client) : withTx(run);
}

export async function setSetupReviewSessionStatus(
  sessionId,
  {
    status,
    currentStep,
    failurePayload,
    eventType = "",
    eventPayload = {},
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  if (!sid) {
    throw new Error("setSetupReviewSessionStatus: sessionId is required.");
  }

  const nextStatus = normalizeSessionStatus(status, "draft");

  const run = async (cx) => {
    const existing = await getSetupReviewSessionById(sid, cx);
    if (!existing) return null;

    const patch = {
      status: nextStatus,
    };

    if (currentStep !== undefined) patch.currentStep = currentStep;
    if (failurePayload !== undefined) patch.failurePayload = failurePayload;

    if (nextStatus === "finalized") patch.finalizedAt = new Date();
    if (nextStatus === "discarded") patch.discardedAt = new Date();
    if (nextStatus === "failed") patch.failedAt = new Date();

    const session = await updateSetupReviewSession(sid, patch, cx);

    if (s(eventType)) {
      await insertSetupReviewEvent(cx, {
        sessionId: sid,
        tenantId: session?.tenantId || existing.tenantId,
        eventType: s(eventType),
        payload: obj(eventPayload),
      });
    }

    return session;
  };

  return client ? run(client) : withTx(run);
}

export async function markSetupReviewSessionProcessing(
  sessionId,
  { currentStep = "", payload = {} } = {},
  client = null,
) {
  return setSetupReviewSessionStatus(
    sessionId,
    {
      status: "processing",
      currentStep,
      eventType: "processing_started",
      eventPayload: { currentStep: s(currentStep), ...obj(payload) },
    },
    client,
  );
}

export async function markSetupReviewSessionReady(
  sessionId,
  { currentStep = "review", payload = {} } = {},
  client = null,
) {
  return setSetupReviewSessionStatus(
    sessionId,
    {
      status: "ready",
      currentStep,
      eventType: "draft_ready",
      eventPayload: { currentStep: s(currentStep), ...obj(payload) },
    },
    client,
  );
}

export async function failSetupReviewSession(
  sessionId,
  error,
  { currentStep = "", payload = {} } = {},
  client = null,
) {
  const message =
    error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    s(error, "Setup review session failed.");

  return setSetupReviewSessionStatus(
    sessionId,
    {
      status: "failed",
      currentStep,
      failurePayload: {
        message,
        ...obj(payload),
      },
      eventType: "session_failed",
      eventPayload: {
        message,
        currentStep: s(currentStep),
        ...obj(payload),
      },
    },
    client,
  );
}

export async function listSetupReviewSessionSources(sessionId, client = null) {
  const sid = s(sessionId);
  if (!sid) return [];

  const run = async (cx) => {
    const { rows } = await cx.query(
      `
        SELECT *
        FROM public.tenant_setup_review_session_sources
        WHERE session_id = $1
        ORDER BY position ASC, attached_at ASC
      `,
      [sid]
    );

    return arr(rows).map(normalizeSourceRow);
  };

  return client ? run(client) : withClient(run);
}

export async function attachSourceToSetupReviewSession(
  {
    sessionId,
    tenantId,
    sourceId,
    sourceType = "",
    role = "context",
    label = "",
    position = 0,
    metadata = {},
    promotePrimary = false,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);
  const safeSourceId = safeUuidOrNull(sourceId);

  if (!sid) {
    throw new Error("attachSourceToSetupReviewSession: sessionId is required.");
  }
  if (!tid) {
    throw new Error("attachSourceToSetupReviewSession: tenantId is required.");
  }
  if (!safeSourceId) {
    throw new Error("attachSourceToSetupReviewSession: valid sourceId is required.");
  }

  const normalizedRole = normalizeSourceRole(role, "context");
  const safePosition = Math.max(0, n(position, 0));

  const run = async (cx) => {
    const { rows } = await cx.query(
      `
        INSERT INTO public.tenant_setup_review_session_sources (
          session_id,
          tenant_id,
          source_id,
          source_type,
          role,
          label,
          position,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (session_id, source_id)
        DO UPDATE SET
          source_type = EXCLUDED.source_type,
          role = EXCLUDED.role,
          label = EXCLUDED.label,
          position = EXCLUDED.position,
          metadata = EXCLUDED.metadata
        RETURNING *
      `,
      [
        sid,
        tid,
        safeSourceId,
        s(sourceType),
        normalizedRole,
        s(label),
        safePosition,
        JSON.stringify(obj(metadata)),
      ]
    );

    const linked = normalizeSourceRow(rows?.[0] || {});

    if (normalizedRole === "primary" || bool(promotePrimary, false)) {
      await updateSetupReviewSession(
        sid,
        {
          primarySourceType: linked.sourceType,
          primarySourceId: linked.sourceId,
        },
        cx,
      );
    }

    await insertSetupReviewEvent(cx, {
      sessionId: sid,
      tenantId: tid,
      eventType: "source_attached",
      payload: {
        sourceId: linked.sourceId,
        sourceType: linked.sourceType,
        role: linked.role,
        label: linked.label,
        position: linked.position,
      },
    });

    return linked;
  };

  return client ? run(client) : withTx(run);
}

export async function ensureSetupReviewDraft(
  {
    sessionId,
    tenantId,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  if (!sid) {
    throw new Error("ensureSetupReviewDraft: sessionId is required.");
  }
  if (!tid) {
    throw new Error("ensureSetupReviewDraft: tenantId is required.");
  }

  const run = async (cx) => {
    const { rows } = await cx.query(
      `
        INSERT INTO public.tenant_setup_review_drafts (
          session_id,
          tenant_id
        )
        VALUES ($1, $2)
        ON CONFLICT (session_id)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id
        RETURNING *
      `,
      [sid, tid]
    );

    return normalizeDraftRow(rows?.[0] || {});
  };

  return client ? run(client) : withTx(run);
}

export async function readSetupReviewDraft(
  { sessionId = "", tenantId = "" } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  const run = async (cx) => {
    if (sid) {
      const { rows } = await cx.query(
        `
          SELECT *
          FROM public.tenant_setup_review_drafts
          WHERE session_id = $1
          LIMIT 1
        `,
        [sid]
      );

      if (rows?.[0]) return normalizeDraftRow(rows[0]);

      if (tid) return emptyDraftPayload(sid, tid);

      return null;
    }

    if (tid) {
      const active = await getActiveSetupReviewSession(tid, cx);
      if (!active?.id) return null;

      return readSetupReviewDraft(
        { sessionId: active.id, tenantId: tid },
        cx,
      );
    }

    return null;
  };

  return client ? run(client) : withClient(run);
}

export async function writeSetupReviewDraft(
  {
    sessionId,
    tenantId,
    draftPayload = {},
    businessProfile = {},
    capabilities = {},
    services = [],
    knowledgeItems = [],
    channels = [],
    sourceSummary = {},
    warnings = [],
    completeness = {},
    confidenceSummary = {},
    diffFromCanonical = {},
    lastSnapshotId = null,
    bumpVersion = true,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  if (!sid) {
    throw new Error("writeSetupReviewDraft: sessionId is required.");
  }
  if (!tid) {
    throw new Error("writeSetupReviewDraft: tenantId is required.");
  }

  const run = async (cx) => {
    await ensureSetupReviewDraft(
      { sessionId: sid, tenantId: tid },
      cx,
    );

    const { rows } = await cx.query(
      `
        INSERT INTO public.tenant_setup_review_drafts (
          session_id,
          tenant_id,
          draft_payload,
          business_profile,
          capabilities,
          services,
          knowledge_items,
          channels,
          source_summary,
          warnings,
          completeness,
          confidence_summary,
          diff_from_canonical,
          last_snapshot_id,
          version
        )
        VALUES (
          $1, $2,
          $3::jsonb,
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb,
          $12::jsonb,
          $13::jsonb,
          $14,
          1
        )
        ON CONFLICT (session_id)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          draft_payload = EXCLUDED.draft_payload,
          business_profile = EXCLUDED.business_profile,
          capabilities = EXCLUDED.capabilities,
          services = EXCLUDED.services,
          knowledge_items = EXCLUDED.knowledge_items,
          channels = EXCLUDED.channels,
          source_summary = EXCLUDED.source_summary,
          warnings = EXCLUDED.warnings,
          completeness = EXCLUDED.completeness,
          confidence_summary = EXCLUDED.confidence_summary,
          diff_from_canonical = EXCLUDED.diff_from_canonical,
          last_snapshot_id = EXCLUDED.last_snapshot_id,
          version = CASE
            WHEN $15::boolean THEN public.tenant_setup_review_drafts.version + 1
            ELSE public.tenant_setup_review_drafts.version
          END
        RETURNING *
      `,
      [
        sid,
        tid,
        JSON.stringify(obj(draftPayload)),
        JSON.stringify(obj(businessProfile)),
        JSON.stringify(obj(capabilities)),
        JSON.stringify(arr(services)),
        JSON.stringify(arr(knowledgeItems)),
        JSON.stringify(arr(channels)),
        JSON.stringify(obj(sourceSummary)),
        JSON.stringify(arr(warnings)),
        JSON.stringify(obj(completeness)),
        JSON.stringify(obj(confidenceSummary)),
        JSON.stringify(obj(diffFromCanonical)),
        safeUuidOrNull(lastSnapshotId),
        bool(bumpVersion, true),
      ]
    );

    const draft = normalizeDraftRow(rows?.[0] || {});

    await insertSetupReviewEvent(cx, {
      sessionId: sid,
      tenantId: tid,
      eventType: "draft_written",
      payload: {
        version: draft.version,
        lastSnapshotId: draft.lastSnapshotId,
        warningsCount: arr(draft.warnings).length,
        servicesCount: arr(draft.services).length,
        knowledgeCount: arr(draft.knowledgeItems).length,
      },
    });

    return draft;
  };

  return client ? run(client) : withTx(run);
}

export async function patchSetupReviewDraft(
  {
    sessionId,
    tenantId,
    patch = {},
    bumpVersion = true,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  if (!sid) {
    throw new Error("patchSetupReviewDraft: sessionId is required.");
  }
  if (!tid) {
    throw new Error("patchSetupReviewDraft: tenantId is required.");
  }

  const run = async (cx) => {
    const current =
      (await readSetupReviewDraft({ sessionId: sid, tenantId: tid }, cx)) ||
      emptyDraftPayload(sid, tid);

    const next = {
      draftPayload:
        patch.draftPayload !== undefined
          ? obj(patch.draftPayload)
          : current.draftPayload,

      businessProfile:
        patch.businessProfile !== undefined
          ? obj(patch.businessProfile)
          : current.businessProfile,

      capabilities:
        patch.capabilities !== undefined
          ? obj(patch.capabilities)
          : current.capabilities,

      services:
        patch.services !== undefined
          ? arr(patch.services)
          : current.services,

      knowledgeItems:
        patch.knowledgeItems !== undefined
          ? arr(patch.knowledgeItems)
          : current.knowledgeItems,

      channels:
        patch.channels !== undefined
          ? arr(patch.channels)
          : current.channels,

      sourceSummary:
        patch.sourceSummary !== undefined
          ? obj(patch.sourceSummary)
          : current.sourceSummary,

      warnings:
        patch.warnings !== undefined
          ? arr(patch.warnings)
          : current.warnings,

      completeness:
        patch.completeness !== undefined
          ? obj(patch.completeness)
          : current.completeness,

      confidenceSummary:
        patch.confidenceSummary !== undefined
          ? obj(patch.confidenceSummary)
          : current.confidenceSummary,

      diffFromCanonical:
        patch.diffFromCanonical !== undefined
          ? obj(patch.diffFromCanonical)
          : current.diffFromCanonical,

      lastSnapshotId:
        patch.lastSnapshotId !== undefined
          ? safeUuidOrNull(patch.lastSnapshotId)
          : current.lastSnapshotId,
    };

    const draft = await writeSetupReviewDraft(
      {
        sessionId: sid,
        tenantId: tid,
        draftPayload: next.draftPayload,
        businessProfile: next.businessProfile,
        capabilities: next.capabilities,
        services: next.services,
        knowledgeItems: next.knowledgeItems,
        channels: next.channels,
        sourceSummary: next.sourceSummary,
        warnings: next.warnings,
        completeness: next.completeness,
        confidenceSummary: next.confidenceSummary,
        diffFromCanonical: next.diffFromCanonical,
        lastSnapshotId: next.lastSnapshotId,
        bumpVersion,
      },
      cx,
    );

    await insertSetupReviewEvent(cx, {
      sessionId: sid,
      tenantId: tid,
      eventType: "draft_patched",
      payload: {
        version: draft.version,
        patchedKeys: Object.keys(obj(patch)),
      },
    });

    return draft;
  };

  return client ? run(client) : withTx(run);
}

export async function getCurrentSetupReview(tenantId, client = null) {
  const tid = s(tenantId);
  if (!tid) {
    throw new Error("getCurrentSetupReview: tenantId is required.");
  }

  const run = async (cx) => {
    const session = await getActiveSetupReviewSession(tid, cx);
    if (!session?.id) {
      return {
        session: null,
        draft: null,
        sources: [],
      };
    }

    const [draft, sources] = await Promise.all([
      readSetupReviewDraft({ sessionId: session.id, tenantId: tid }, cx),
      listSetupReviewSessionSources(session.id, cx),
    ]);

    return {
      session,
      draft: draft || emptyDraftPayload(session.id, tid),
      sources,
    };
  };

  return client ? run(client) : withClient(run);
}

export async function discardSetupReviewSession(
  {
    sessionId = "",
    tenantId = "",
    reason = "",
    metadata = {},
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  const run = async (cx) => {
    let session = null;

    if (sid) {
      session = await getSetupReviewSessionById(sid, cx);
    } else if (tid) {
      session = await getActiveSetupReviewSession(tid, cx);
    }

    if (!session?.id) return null;
    if (["finalized", "discarded"].includes(session.status)) return session;

    const updated = await updateSetupReviewSession(
      session.id,
      {
        status: "discarded",
        discardedAt: new Date(),
      },
      cx,
    );

    await insertSetupReviewEvent(cx, {
      sessionId: session.id,
      tenantId: session.tenantId,
      eventType: "session_discarded",
      payload: {
        reason: s(reason),
        ...obj(metadata),
      },
    });

    return updated;
  };

  return client ? run(client) : withTx(run);
}

export async function finalizeSetupReviewSession(
  {
    sessionId = "",
    tenantId = "",
    currentStep = "finalize",
    refreshRuntime = true,
    allowBaselineDrift = false,
    projectDraftToCanonical,
    metadata = {},
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);

  const run = async (cx) => {
    let session = null;

    if (sid) {
      const locked = await cx.query(
        `
          SELECT *
          FROM public.tenant_setup_review_sessions
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [sid]
      );
      session = locked.rows?.[0] ? normalizeSessionRow(locked.rows[0]) : null;
    } else if (tid) {
      const locked = await cx.query(
        `
          SELECT *
          FROM public.tenant_setup_review_sessions
          WHERE tenant_id = $1
            AND status IN ('draft', 'processing', 'ready')
          ORDER BY updated_at DESC, started_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [tid]
      );
      session = locked.rows?.[0] ? normalizeSessionRow(locked.rows[0]) : null;
    }

    if (!session?.id) {
      throw new Error("finalizeSetupReviewSession: active session not found.");
    }

    const baselineCheck = await detectCanonicalBaselineDrift(session, cx);
    if (baselineCheck.drifted && !bool(allowBaselineDrift, false)) {
      const driftError = createCanonicalBaselineDriftError(
        baselineCheck.baseline,
        baselineCheck.current
      );
      throw driftError;
    }

    const draft =
      (await readSetupReviewDraft(
        { sessionId: session.id, tenantId: session.tenantId },
        cx,
      )) || emptyDraftPayload(session.id, session.tenantId);

    const sources = await listSetupReviewSessionSources(session.id, cx);

    await updateSetupReviewSession(
      session.id,
      {
        status: "processing",
        currentStep,
      },
      cx,
    );

      let projectionResult = null;

      if (typeof projectDraftToCanonical === "function") {
        projectionResult = await projectDraftToCanonical({
          client: cx,
          tenantId: session.tenantId,
          session,
          draft,
          sources,
      });
    } else {
      throw new Error(
        "finalizeSetupReviewSession: projectDraftToCanonical callback is required.",
      );
    }

    let runtimeProjection = null;
    let runtimeProjectionFreshness = null;

    if (bool(refreshRuntime, true)) {
      const refreshed = await refreshTenantRuntimeProjectionStrict(
        {
          tenantId: session.tenantId,
          triggerType: "review_approval",
          requestedBy:
            s(obj(metadata).reviewerId) ||
            s(obj(metadata).reviewerEmail) ||
            "setup_review_finalize",
          runnerKey: "tenantSetupReview.finalizeSetupReviewSession",
          generatedBy:
            s(obj(metadata).reviewerName) ||
            s(obj(metadata).reviewerEmail) ||
            "system",
          metadata: {
            source: "finalizeSetupReviewSession",
            sessionId: session.id,
          },
        },
        cx
      );
      runtimeProjection = obj(refreshed?.projection);
      runtimeProjectionFreshness = obj(refreshed?.freshness);
    }

    const finalized = await updateSetupReviewSession(
      session.id,
      {
        status: "finalized",
        currentStep: "finalized",
        finalizedAt: new Date(),
      },
      cx,
    );

      await insertSetupReviewEvent(cx, {
        sessionId: session.id,
        tenantId: session.tenantId,
        eventType: "session_finalized",
        payload: {
        refreshRuntime: bool(refreshRuntime, true),
        servicesCount: arr(draft.services).length,
        knowledgeCount: arr(draft.knowledgeItems).length,
        warningsCount: arr(draft.warnings).length,
        baselineDriftChecked: true,
        baselineProjectionHash: s(baselineCheck.baseline?.projectionHash),
        currentProjectionHash: s(baselineCheck.current?.projectionHash),
        runtimeProjectionId: s(runtimeProjection?.id),
        runtimeProjectionStatus: s(runtimeProjection?.status),
          runtimeProjectionHash: s(runtimeProjection?.projection_hash),
          runtimeProjectionFresh: !runtimeProjectionFreshness.stale,
          runtimeProjectionFreshnessReasons: arr(runtimeProjectionFreshness.reasons),
          finalizeImpact: obj(projectionResult?.impactSummary),
          ...obj(metadata),
        },
      });

      return {
        session: finalized,
        draft,
        sources,
        runtimeProjection: runtimeProjection || null,
        runtimeProjectionFreshness: runtimeProjectionFreshness || null,
        impactSummary: obj(projectionResult?.impactSummary),
      };
  };

  return client ? run(client) : withTx(run);
}

export async function listSetupReviewEvents(
  {
    sessionId = "",
    tenantId = "",
    limit = 50,
  } = {},
  client = null,
) {
  const sid = s(sessionId);
  const tid = s(tenantId);
  const safeLimit = Math.max(1, Math.min(200, n(limit, 50)));

  const run = async (cx) => {
    if (!sid && !tid) return [];

    const values = [];
    let sql = `
      SELECT *
      FROM public.tenant_setup_review_events
      WHERE 1=1
    `;

    if (sid) {
      values.push(sid);
      sql += ` AND session_id = $${values.length}`;
    }

    if (tid) {
      values.push(tid);
      sql += ` AND tenant_id = $${values.length}`;
    }

    values.push(safeLimit);
    sql += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const { rows } = await cx.query(sql, values);
    return arr(rows).map(normalizeEventRow);
  };

  return client ? run(client) : withClient(run);
}

export default {
  getSetupReviewSessionById,
  listSetupReviewSessionsByTenant,
  getActiveSetupReviewSession,
  createSetupReviewSession,
  getOrCreateActiveSetupReviewSession,
  updateSetupReviewSession,
  setSetupReviewSessionStatus,
  markSetupReviewSessionProcessing,
  markSetupReviewSessionReady,
  failSetupReviewSession,
  listSetupReviewSessionSources,
  attachSourceToSetupReviewSession,
  ensureSetupReviewDraft,
  readSetupReviewDraft,
  writeSetupReviewDraft,
  patchSetupReviewDraft,
  getCurrentSetupReview,
  discardSetupReviewSession,
  finalizeSetupReviewSession,
  listSetupReviewEvents,
};
