import { db } from "../../index.js";
import {
  s,
  arr,
  obj,
  num,
  pickDb,
  one,
} from "./shared.js";
import { resolveTenant, loadTenantCanonicalGraph } from "./graph.js";
import { buildTenantRuntimeProjection } from "./projection.js";

function normalizeProjectionSources(input = {}) {
  return {
    sourceSnapshotId: s(input.sourceSnapshotId || input.source_snapshot_id),
    sourceProfileId: s(input.sourceProfileId || input.source_profile_id),
    sourceCapabilitiesId: s(
      input.sourceCapabilitiesId || input.source_capabilities_id
    ),
  };
}

function refsMatch(left = "", right = "") {
  return s(left) === s(right);
}

function normalizeProjectionRunRow(row = {}) {
  const value = obj(row);
  return {
    id: s(value.id),
    tenant_id: s(value.tenant_id),
    tenant_key: s(value.tenant_key),
    runtime_projection_id: s(value.runtime_projection_id),
    trigger_type: s(value.trigger_type),
    status: s(value.status),
    projection_version: s(value.projection_version),
    requested_by: s(value.requested_by),
    runner_key: s(value.runner_key),
    started_at: s(value.started_at),
    finished_at: s(value.finished_at),
    duration_ms: num(value.duration_ms, 0),
    source_snapshot_id: s(value.source_snapshot_id),
    error_code: s(value.error_code),
    error_message: s(value.error_message),
    input_summary_json: obj(value.input_summary_json),
    output_summary_json: obj(value.output_summary_json),
    metadata_json: obj(value.metadata_json),
    created_at: s(value.created_at),
    updated_at: s(value.updated_at),
  };
}

export function assessTenantRuntimeProjectionFreshness(
  {
    runtimeProjection = null,
    graph = null,
    expectedProjection = null,
  } = {}
) {
  const current = obj(runtimeProjection);
  const runtimeProjectionId = s(current.id);
  const tenantId = s(current.tenant_id || graph?.tenant?.id);
  const tenantKey = s(current.tenant_key || graph?.tenant?.tenant_key);
  const normalizedExpectedProjection =
    expectedProjection && typeof expectedProjection === "object"
      ? expectedProjection
      : buildTenantRuntimeProjection(obj(graph));
  const expectedSources = normalizeProjectionSources({
    sourceSnapshotId: graph?.synthesis?.id,
    sourceProfileId: graph?.profile?.id,
    sourceCapabilitiesId: graph?.capabilities?.id,
  });
  const currentSources = normalizeProjectionSources(current);
  const reasons = [];

  if (!runtimeProjectionId) {
    reasons.push("missing_runtime_projection");
  } else {
    if (s(current.status) !== "ready") {
      reasons.push("runtime_status_not_ready");
    }

    if (
      !refsMatch(currentSources.sourceSnapshotId, expectedSources.sourceSnapshotId)
    ) {
      reasons.push("source_snapshot_mismatch");
    }

    if (
      !refsMatch(currentSources.sourceProfileId, expectedSources.sourceProfileId)
    ) {
      reasons.push("source_profile_mismatch");
    }

    if (
      !refsMatch(
        currentSources.sourceCapabilitiesId,
        expectedSources.sourceCapabilitiesId
      )
    ) {
      reasons.push("source_capabilities_mismatch");
    }

    if (
      s(current.projection_hash) !==
      s(normalizedExpectedProjection?.projection_hash)
    ) {
      reasons.push("projection_hash_mismatch");
    }
  }

  return {
    ok: reasons.length === 0,
    stale: reasons.length > 0,
    reasons,
    tenantId,
    tenantKey,
    runtimeProjectionId,
    runtimeStatus: s(current.status),
    currentProjectionHash: s(current.projection_hash),
    expectedProjectionHash: s(normalizedExpectedProjection?.projection_hash),
    currentSources,
    expectedSources,
    runtimeProjection: runtimeProjectionId ? current : null,
  };
}

export function createRuntimeProjectionStaleError(freshness = {}) {
  const normalized = obj(freshness);
  const error = new Error(
    "Runtime projection is stale or missing for the current canonical state."
  );
  error.code = "TENANT_RUNTIME_PROJECTION_STALE";
  error.freshness = {
    stale: Boolean(normalized.stale),
    reasons: arr(normalized.reasons),
    tenantId: s(normalized.tenantId),
    tenantKey: s(normalized.tenantKey),
    runtimeProjectionId: s(normalized.runtimeProjectionId),
    runtimeStatus: s(normalized.runtimeStatus),
    currentProjectionHash: s(normalized.currentProjectionHash),
    expectedProjectionHash: s(normalized.expectedProjectionHash),
    currentSources: obj(normalized.currentSources),
    expectedSources: obj(normalized.expectedSources),
  };
  return error;
}

async function markTenantRuntimeProjectionStale(
  client,
  { runtimeProjectionId = "", freshness = {} } = {}
) {
  const projectionId = s(runtimeProjectionId);
  if (!projectionId) return null;

  return await one(
    client,
    `
    update tenant_business_runtime_projection
    set
      status = 'stale',
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || $2::jsonb,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      projectionId,
      JSON.stringify({
        staleDetectedAt: new Date().toISOString(),
        staleReasons: arr(obj(freshness).reasons),
        expectedProjectionHash: s(obj(freshness).expectedProjectionHash),
        currentProjectionHash: s(obj(freshness).currentProjectionHash),
        expectedSources: obj(obj(freshness).expectedSources),
        currentSources: obj(obj(freshness).currentSources),
      }),
    ]
  );
}

export async function upsertTenantRuntimeProjection(
  {
    tenantId = "",
    tenantKey = "",
    sourceSnapshotId = null,
    sourceProfileId = null,
    sourceCapabilitiesId = null,
    projection = null,
    generatedBy = "system",
    approvedBy = "",
    metadata = {},
  } = {},
  dbOrClient = db
) {
  const client = pickDb(dbOrClient);

  if (!s(tenantId)) throw new Error("tenantId is required");
  if (!projection || typeof projection !== "object") {
    throw new Error("projection is required");
  }

  const row = await one(
    client,
    `
    insert into tenant_business_runtime_projection (
      tenant_id,
      tenant_key,
      projection_version,
      status,
      is_current,
      source_snapshot_id,
      source_profile_id,
      source_capabilities_id,
      projection_hash,
      identity_json,
      profile_json,
      capabilities_json,
      contacts_json,
      locations_json,
      hours_json,
      services_json,
      products_json,
      faq_json,
      policies_json,
      social_accounts_json,
      channels_json,
      media_assets_json,
      approved_knowledge_json,
      active_facts_json,
      channel_policies_json,
      inbox_json,
      comments_json,
      content_json,
      voice_json,
      lead_capture_json,
      handoff_json,
      retrieval_corpus_json,
      runtime_context_text,
      readiness_score,
      readiness_label,
      confidence,
      confidence_label,
      generated_by,
      approved_by,
      generated_at,
      approved_at,
      last_refreshed_at,
      metadata_json
    )
    values (
      $1, $2, 'runtime_projection_v1', $3, true,
      $4, $5, $6, $7,
      $8::jsonb, $9::jsonb, $10::jsonb,
      $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb,
      $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb,
      $21::jsonb, $22::jsonb, $23::jsonb,
      $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28::jsonb, $29::jsonb,
      $30::jsonb, $31,
      $32, $33, $34, $35,
      $36, $37, now(),
      case when btrim($37) <> '' then now() else null end,
      now(),
      $38::jsonb
    )
    on conflict (tenant_id) do update
    set
      tenant_key = excluded.tenant_key,
      projection_version = excluded.projection_version,
      status = excluded.status,
      is_current = true,
      source_snapshot_id = excluded.source_snapshot_id,
      source_profile_id = excluded.source_profile_id,
      source_capabilities_id = excluded.source_capabilities_id,
      projection_hash = excluded.projection_hash,
      identity_json = excluded.identity_json,
      profile_json = excluded.profile_json,
      capabilities_json = excluded.capabilities_json,
      contacts_json = excluded.contacts_json,
      locations_json = excluded.locations_json,
      hours_json = excluded.hours_json,
      services_json = excluded.services_json,
      products_json = excluded.products_json,
      faq_json = excluded.faq_json,
      policies_json = excluded.policies_json,
      social_accounts_json = excluded.social_accounts_json,
      channels_json = excluded.channels_json,
      media_assets_json = excluded.media_assets_json,
      approved_knowledge_json = excluded.approved_knowledge_json,
      active_facts_json = excluded.active_facts_json,
      channel_policies_json = excluded.channel_policies_json,
      inbox_json = excluded.inbox_json,
      comments_json = excluded.comments_json,
      content_json = excluded.content_json,
      voice_json = excluded.voice_json,
      lead_capture_json = excluded.lead_capture_json,
      handoff_json = excluded.handoff_json,
      retrieval_corpus_json = excluded.retrieval_corpus_json,
      runtime_context_text = excluded.runtime_context_text,
      readiness_score = excluded.readiness_score,
      readiness_label = excluded.readiness_label,
      confidence = excluded.confidence,
      confidence_label = excluded.confidence_label,
      generated_by = excluded.generated_by,
      approved_by = excluded.approved_by,
      generated_at = excluded.generated_at,
      approved_at = excluded.approved_at,
      last_refreshed_at = excluded.last_refreshed_at,
      metadata_json = excluded.metadata_json,
      updated_at = now()
    returning *
    `,
    [
      tenantId,
      tenantKey,
      s(projection.status || "draft"),
      sourceSnapshotId,
      sourceProfileId,
      sourceCapabilitiesId,
      s(projection.projection_hash),
      JSON.stringify(obj(projection.identity_json)),
      JSON.stringify(obj(projection.profile_json)),
      JSON.stringify(obj(projection.capabilities_json)),
      JSON.stringify(arr(projection.contacts_json)),
      JSON.stringify(arr(projection.locations_json)),
      JSON.stringify(arr(projection.hours_json)),
      JSON.stringify(arr(projection.services_json)),
      JSON.stringify(arr(projection.products_json)),
      JSON.stringify(arr(projection.faq_json)),
      JSON.stringify(arr(projection.policies_json)),
      JSON.stringify(arr(projection.social_accounts_json)),
      JSON.stringify(arr(projection.channels_json)),
      JSON.stringify(arr(projection.media_assets_json)),
      JSON.stringify(arr(projection.approved_knowledge_json)),
      JSON.stringify(arr(projection.active_facts_json)),
      JSON.stringify(arr(projection.channel_policies_json)),
      JSON.stringify(obj(projection.inbox_json)),
      JSON.stringify(obj(projection.comments_json)),
      JSON.stringify(obj(projection.content_json)),
      JSON.stringify(obj(projection.voice_json)),
      JSON.stringify(obj(projection.lead_capture_json)),
      JSON.stringify(obj(projection.handoff_json)),
      JSON.stringify(arr(projection.retrieval_corpus_json)),
      s(projection.runtime_context_text),
      num(projection.readiness_score, 0),
      s(projection.readiness_label || "not_ready"),
      num(projection.confidence, 0),
      s(projection.confidence_label || "low"),
      s(generatedBy || "system"),
      s(approvedBy),
      JSON.stringify(obj(metadata)),
    ]
  );

  return row;
}

export async function getCurrentTenantRuntimeProjection(
  { tenantId = "", tenantKey = "" } = {},
  dbOrClient = db
) {
  const client = pickDb(dbOrClient);
  const tenant = await resolveTenant(client, { tenantId, tenantKey });
  if (!tenant) return null;

  return await one(
    client,
    `
    select *
    from tenant_business_runtime_projection
    where tenant_id = $1
      and is_current = true
    limit 1
    `,
    [tenant.id]
  );
}

export async function getLatestTenantRuntimeProjectionRun(
  { tenantId = "", tenantKey = "" } = {},
  dbOrClient = db
) {
  const client = pickDb(dbOrClient);
  const tenant = await resolveTenant(client, { tenantId, tenantKey });
  if (!tenant) return null;

  const row = await one(
    client,
    `
    select *
    from tenant_business_runtime_projection_runs
    where tenant_id = $1
    order by started_at desc, created_at desc
    limit 1
    `,
    [tenant.id]
  );

  return row ? normalizeProjectionRunRow(row) : null;
}

export async function getTenantRuntimeProjectionFreshness(
  {
    tenantId = "",
    tenantKey = "",
    runtimeProjection = null,
    markStale = true,
  } = {},
  dbOrClient = db
) {
  const client = pickDb(dbOrClient);
  const tenant = await resolveTenant(client, { tenantId, tenantKey });
  if (!tenant) return null;

  const current =
    runtimeProjection ||
    (await getCurrentTenantRuntimeProjection(
      { tenantId: tenant.id, tenantKey: tenant.tenant_key },
      client
    ));
  const graph = await loadTenantCanonicalGraph(
    { tenantId: tenant.id, tenantKey: tenant.tenant_key },
    client
  );
  const expectedProjection = buildTenantRuntimeProjection(graph);
  const freshness = assessTenantRuntimeProjectionFreshness({
    runtimeProjection: current,
    graph,
    expectedProjection,
  });

  if (freshness.stale && markStale && s(current?.id)) {
    await markTenantRuntimeProjectionStale(client, {
      runtimeProjectionId: s(current.id),
      freshness,
    });
  }

  return freshness;
}

export async function ensureTenantRuntimeProjectionFresh(
  {
    tenantId = "",
    tenantKey = "",
    runtimeProjection = null,
    markStale = true,
  } = {},
  dbOrClient = db
) {
  const freshness = await getTenantRuntimeProjectionFreshness(
    {
      tenantId,
      tenantKey,
      runtimeProjection,
      markStale,
    },
    dbOrClient
  );

  if (!freshness || freshness.stale) {
    throw createRuntimeProjectionStaleError(freshness);
  }

  return freshness;
}

export async function refreshTenantRuntimeProjection(
  {
    tenantId = "",
    tenantKey = "",
    triggerType = "manual",
    requestedBy = "",
    runnerKey = "runtime_projection",
    generatedBy = "system",
    approvedBy = "",
    metadata = {},
  } = {},
  dbOrPool = db
) {
  const ownsClient = typeof dbOrPool?.connect === "function";
  const client = ownsClient ? await dbOrPool.connect() : pickDb(dbOrPool);

  let runId = "";

  try {
    if (ownsClient) await client.query("begin");

    const graph = await loadTenantCanonicalGraph({ tenantId, tenantKey }, client);

    const run = await one(
      client,
      `
      insert into tenant_business_runtime_projection_runs (
        tenant_id,
        tenant_key,
        trigger_type,
        status,
        projection_version,
        started_at,
        requested_by,
        runner_key,
        input_summary_json,
        metadata_json
      )
      values (
        $1, $2, $3, 'running', 'runtime_projection_v1', now(), $4, $5, $6::jsonb, $7::jsonb
      )
      returning id
      `,
      [
        graph.tenant.id,
        s(graph.tenant.tenant_key),
        s(triggerType || "manual"),
        s(requestedBy),
        s(runnerKey || "runtime_projection"),
        JSON.stringify({
          sourceSnapshotId: s(graph.synthesis?.id),
          profileId: s(graph.profile?.id),
          capabilitiesId: s(graph.capabilities?.id),
        }),
        JSON.stringify(obj(metadata)),
      ]
    );

    runId = s(run?.id);

    const projection = buildTenantRuntimeProjection(graph);

    const saved = await upsertTenantRuntimeProjection(
      {
        tenantId: graph.tenant.id,
        tenantKey: s(graph.tenant.tenant_key),
        sourceSnapshotId: graph.synthesis?.id || null,
        sourceProfileId: graph.profile?.id || null,
        sourceCapabilitiesId: graph.capabilities?.id || null,
        projection,
        generatedBy,
        approvedBy,
        metadata: {
          ...obj(metadata),
          source: "refreshTenantRuntimeProjection",
        },
      },
      client
    );

    await client.query(
      `
      update tenant_business_runtime_projection_runs
      set
        runtime_projection_id = $2,
        source_snapshot_id = $3,
        status = 'success',
        finished_at = now(),
        duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)),
        profile_changed = true,
        capabilities_changed = true,
        graph_changed = true,
        policies_changed = true,
        channels_changed = true,
        output_summary_json = $4::jsonb,
        updated_at = now()
      where id = $1
      `,
      [
        runId,
        saved.id,
        graph.synthesis?.id || null,
        JSON.stringify({
          readinessLabel: projection.readiness_label,
          readinessScore: projection.readiness_score,
          confidence: projection.confidence,
          serviceCount: arr(projection.services_json).length,
          faqCount: arr(projection.faq_json).length,
          channelCount: arr(projection.channels_json).length,
          retrievalCorpusCount: arr(projection.retrieval_corpus_json).length,
        }),
      ]
    );

    if (ownsClient) await client.query("commit");

    return {
      ok: true,
      runId,
      tenantId: graph.tenant.id,
      tenantKey: s(graph.tenant.tenant_key),
      projection: saved,
    };
  } catch (error) {
    try {
      if (runId) {
        await client.query(
          `
          update tenant_business_runtime_projection_runs
          set
            status = 'failed',
            finished_at = now(),
            duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)),
            error_code = $2,
            error_message = $3,
            errors_json = jsonb_build_array(jsonb_build_object('message', $3)),
            updated_at = now()
          where id = $1
          `,
          [runId, "runtime_projection_failed", s(error?.message || "runtime projection failed")]
        );
      }
    } catch {}

    if (ownsClient) {
      try {
        await client.query("rollback");
      } catch {}
    }

    throw error;
  } finally {
    if (ownsClient) {
      try {
        client.release();
      } catch {}
    }
  }
}

export async function refreshTenantRuntimeProjectionStrict(
  args = {},
  dbOrPool = db
) {
  const result = await refreshTenantRuntimeProjection(args, dbOrPool);
  const freshness = await ensureTenantRuntimeProjectionFresh(
    {
      tenantId: s(result?.tenantId || args?.tenantId),
      tenantKey: s(result?.tenantKey || args?.tenantKey),
      runtimeProjection: obj(result?.projection),
      markStale: true,
    },
    dbOrPool
  );

  return {
    ...result,
    freshness,
  };
}
