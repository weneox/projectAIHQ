// src/services/workspace/import/records.js
// source/run persistence helpers extracted from src/services/workspace/import.js

import {
  SOURCE_TABLES,
  SOURCE_RUN_TABLES,
  s,
  obj,
  nowIso,
  normalizeUrl,
  normalizeActorContext,
  normalizeSourceType,
  buildSourceKey,
  buildSourceDisplayName,
  sourceAuthorityClass,
  sourceTypeLabel,
  compactObject,
} from "./shared.js";
import {
  findFirstExistingTable,
  findSourceByKey,
  findSourceExact,
  findLatestRunForSource,
  insertRow,
  updateRowById,
} from "./dbRows.js";
import {
  buildSourceInsertLifecyclePatch,
  buildSourceSyncPatch,
  buildRunLifecyclePatch,
} from "./lifecycle.js";
import { buildRunKey } from "./shared.js";

function isTenantSourceDuplicateKeyError(error = null) {
  const code = s(error?.code);
  const detail = s(error?.detail).toLowerCase();
  const constraint = s(error?.constraint).toLowerCase();
  const message = s(error?.message).toLowerCase();

  if (code !== "23505") return false;

  return (
    constraint === "ux_tenant_sources_tenant_source_key" ||
    detail.includes("ux_tenant_sources_tenant_source_key") ||
    message.includes("ux_tenant_sources_tenant_source_key") ||
    (message.includes("tenant_sources") && message.includes("source_key"))
  );
}

async function refreshExistingSource(
  db,
  sourceTable,
  {
    existing,
    tenantId,
    tenantKey,
    sourceKey,
    sourceType,
    url,
    reviewSessionId,
    actor,
    intakeContext,
    requestId,
    displayName,
    now,
  }
) {
  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(url);
  const sourceMetadata = {
    requestId,
    reviewSessionId: s(reviewSessionId),
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    sourceLabel: sourceTypeLabel(normalizedType),
    intakeContext: obj(intakeContext),
    actor: compactObject({
      requestedBy: actor.auditValue,
      requestedByUserId: actor.userId,
      requestedByEmail: actor.email,
      requestedByName: actor.name,
    }),
  };
  const runningSyncPatch = await buildSourceSyncPatch(db, sourceTable, "running");

  const updated = await updateRowById(db, sourceTable, existing.id, {
    tenant_id: tenantId,
    tenant_key: tenantKey,
    source_key: s(existing.source_key) || sourceKey,
    source_type: normalizedType,
    type: normalizedType,
    source_url: normalizedUrl,
    url: normalizedUrl,
    name: s(existing.name) || displayName,
    display_name: s(existing.display_name) || displayName,
    label: s(existing.label) || displayName,
    source_name: s(existing.source_name) || displayName,
    review_session_id: s(reviewSessionId) || undefined,
    ...runningSyncPatch,
    is_enabled: existing.is_enabled ?? true,
    enabled: existing.enabled ?? true,
    last_sync_requested_at: now,
    requested_by: actor.auditValue,
    updated_at: now,
    metadata_json: sourceMetadata,
    meta_json: sourceMetadata,
    source_metadata_json: sourceMetadata,
    context_json: obj(intakeContext),
    input_summary_json: {
      sourceType: normalizedType,
      sourceUrl: normalizedUrl,
      reviewSessionId: s(reviewSessionId),
      ...obj(intakeContext),
    },
  });

  if (updated?.id) {
    return {
      table: sourceTable,
      source: updated,
      created: false,
    };
  }

  const resolvedExisting =
    (await findSourceByKey(db, sourceTable, {
      tenantId,
      tenantKey,
      sourceKey,
    })) ||
    (await findSourceExact(db, sourceTable, {
      tenantId,
      tenantKey,
      sourceType: normalizedType,
      url: normalizedUrl,
    }));

  if (resolvedExisting?.id) {
    return {
      table: sourceTable,
      source: resolvedExisting,
      created: false,
    };
  }

  throw new Error("SourceRowMissingAfterUpdate");
}

export async function ensureSource(
  db,
  {
    tenantId,
    tenantKey,
    sourceType,
    url,
    requestedBy = "",
    requestedByUserId = "",
    requestedByEmail = "",
    requestedByName = "",
    intakeContext = {},
    requestId = "",
    reviewSessionId = "",
  }
) {
  const sourceTable = await findFirstExistingTable(db, SOURCE_TABLES);
  if (!sourceTable) {
    throw new Error("Source import requires a sources table");
  }

  const actor = normalizeActorContext({
    requestedBy,
    requestedByUserId,
    requestedByEmail,
    requestedByName,
  });

  const normalizedUrl = normalizeUrl(url);
  const normalizedType = normalizeSourceType(sourceType);
  const sourceKey = buildSourceKey({
    sourceType: normalizedType,
    url: normalizedUrl,
  });
  const displayName = buildSourceDisplayName({
    sourceType: normalizedType,
    url: normalizedUrl,
  });
  const now = nowIso();

  const existing = await findSourceExact(db, sourceTable, {
    tenantId,
    tenantKey,
    sourceType: normalizedType,
    url: normalizedUrl,
  });

  const sourceMetadata = {
    requestId,
    reviewSessionId: s(reviewSessionId),
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    sourceLabel: sourceTypeLabel(normalizedType),
    intakeContext: obj(intakeContext),
    actor: compactObject({
      requestedBy: actor.auditValue,
      requestedByUserId: actor.userId,
      requestedByEmail: actor.email,
      requestedByName: actor.name,
    }),
  };

  if (existing?.id) {
    return refreshExistingSource(db, sourceTable, {
      existing,
      tenantId,
      tenantKey,
      sourceKey,
      sourceType: normalizedType,
      url: normalizedUrl,
      reviewSessionId,
      actor,
      intakeContext,
      requestId,
      displayName,
      now,
    });
  }

  const sourceInsertLifecycle = await buildSourceInsertLifecyclePatch(db, sourceTable);

  let inserted = null;

  try {
    inserted = await insertRow(db, sourceTable, {
      tenant_id: tenantId,
      tenant_key: tenantKey,
      source_key: sourceKey,
      source_type: normalizedType,
      type: normalizedType,
      source_url: normalizedUrl,
      url: normalizedUrl,
      name: displayName,
      display_name: displayName,
      label: displayName,
      source_name: displayName,
      review_session_id: s(reviewSessionId) || undefined,
      ...sourceInsertLifecycle,
      is_enabled: true,
      enabled: true,
      requested_by: actor.auditValue,
      created_by: actor.auditValue,
      last_sync_requested_at: now,
      created_at: now,
      updated_at: now,

      metadata_json: sourceMetadata,
      meta_json: sourceMetadata,
      source_metadata_json: sourceMetadata,
      context_json: obj(intakeContext),
      input_summary_json: {
        sourceType: normalizedType,
        sourceUrl: normalizedUrl,
        reviewSessionId: s(reviewSessionId),
        ...obj(intakeContext),
      },
    });
  } catch (error) {
    if (!isTenantSourceDuplicateKeyError(error)) {
      throw error;
    }

    const conflicted =
      (await findSourceByKey(db, sourceTable, {
        tenantId,
        tenantKey,
        sourceKey,
      })) ||
      (await findSourceExact(db, sourceTable, {
        tenantId,
        tenantKey,
        sourceType: normalizedType,
        url: normalizedUrl,
      }));

    if (conflicted?.id) {
      return refreshExistingSource(db, sourceTable, {
        existing: conflicted,
        tenantId,
        tenantKey,
        sourceKey,
        sourceType: normalizedType,
        url: normalizedUrl,
        reviewSessionId,
        actor,
        intakeContext,
        requestId,
        displayName,
        now,
      });
    }

    throw error;
  }

  if (inserted?.id) {
    return {
      table: sourceTable,
      source: inserted,
      created: true,
    };
  }

  const resolvedInserted = await findSourceExact(db, sourceTable, {
    tenantId,
    tenantKey,
    sourceType: normalizedType,
    url: normalizedUrl,
  });

  if (resolvedInserted?.id) {
    return {
      table: sourceTable,
      source: resolvedInserted,
      created: true,
    };
  }

  throw new Error("SourceRowMissingAfterInsert");
}

export async function createSourceRun(
  db,
  {
    tenantId,
    tenantKey,
    sourceId,
    sourceType,
    requestedBy = "",
    requestedByUserId = "",
    requestedByEmail = "",
    requestedByName = "",
    sourceUrl = "",
    intakeContext = {},
    requestId = "",
    reviewSessionId = "",
  }
) {
  const runTable = await findFirstExistingTable(db, SOURCE_RUN_TABLES);
  if (!runTable) {
    throw new Error("Source import requires a source sync runs table");
  }

  if (!s(sourceId)) {
    throw new Error("SourceIdRequiredForSyncRun");
  }

  const actor = normalizeActorContext({
    requestedBy,
    requestedByUserId,
    requestedByEmail,
    requestedByName,
  });

  const normalizedType = normalizeSourceType(sourceType);
  const normalizedUrl = normalizeUrl(sourceUrl);
  const sourceKey = buildSourceKey({
    sourceType: normalizedType,
    url: normalizedUrl,
  });
  const runKey = buildRunKey({
    sourceId,
    sourceType: normalizedType,
    sourceUrl: normalizedUrl,
  });
  const now = nowIso();

  const runLifecycle = await buildRunLifecyclePatch(db, runTable, "queued");

  const runMetadata = {
    requestId,
    reviewSessionId: s(reviewSessionId),
    workerTaskType: "setup_import_source_sync",
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    sourceLabel: sourceTypeLabel(normalizedType),
    intakeContext: obj(intakeContext),
    actor: compactObject({
      requestedBy: actor.auditValue,
      requestedByUserId: actor.userId,
      requestedByEmail: actor.email,
      requestedByName: actor.name,
    }),
  };

  const inserted = await insertRow(db, runTable, {
    tenant_id: tenantId,
    tenant_key: tenantKey,
    source_id: sourceId,
    source_key: sourceKey,
    run_key: runKey,
    source_type: normalizedType,
    source_url: normalizedUrl,
    url: normalizedUrl,
    review_session_id: s(reviewSessionId) || undefined,
    ...runLifecycle,
    requested_by: actor.auditValue,
    created_by: actor.auditValue,
    attempt_count: 0,
    max_attempts: 3,
    next_retry_at: now,
    lease_token: "",
    claimed_by: "",
    input_summary_json: {
      sourceType: normalizedType,
      sourceUrl: normalizedUrl,
      reviewSessionId: s(reviewSessionId),
      ...obj(intakeContext),
    },
    metadata_json: runMetadata,
    meta_json: runMetadata,
    created_at: now,
    updated_at: now,
    started_at: undefined,
  });

  if (inserted?.id) {
    return {
      table: runTable,
      run: inserted,
    };
  }

  const resolvedRun = await findLatestRunForSource(db, runTable, {
    tenantId,
    tenantKey,
    sourceId,
  });

  if (resolvedRun?.id) {
    return {
      table: runTable,
      run: resolvedRun,
    };
  }

  throw new Error("SourceSyncRunMissingAfterInsert");
}
