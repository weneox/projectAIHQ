// src/services/workspace/import/lifecycle.js
// lifecycle/status helpers extracted from src/services/workspace/import.js

import { getTableColumns } from "../db.js";
import { hasColumn, getAllowedColumnValues, pickPreferredAllowedValue } from "./dbRows.js";
import { lower } from "./shared.js";

export function normalizeLifecyclePhase(value = "") {
  const x = lower(value);

  if (["queued", "queue", "pending"].includes(x)) return "queued";
  if (["success", "completed", "done", "synced"].includes(x)) return "success";

  if (
    [
      "partial",
      "warning",
      "warnings",
      "completed_with_warnings",
      "finished_with_warnings",
      "needs_review",
    ].includes(x)
  ) {
    return "partial";
  }

  if (["error", "failed", "failure"].includes(x)) return "error";

  return "running";
}

export function preferredLifecycleValues(phase = "running") {
  const x = normalizeLifecyclePhase(phase);

  if (x === "queued") {
    return ["queued", "pending", "running", "processing"];
  }

  if (x === "success") {
    return ["success", "completed", "done", "synced"];
  }

  if (x === "partial") {
    return [
      "partial",
      "warning",
      "warnings",
      "completed_with_warnings",
      "finished_with_warnings",
      "needs_review",
      "success",
      "completed",
      "done",
      "synced",
    ];
  }

  if (x === "error") {
    return ["error", "failed"];
  }

  return ["running", "pending", "queued", "processing"];
}

export async function buildSourceInsertLifecyclePatch(db, sourceTable) {
  const columns = await getTableColumns(db, sourceTable);
  const out = {};

  if (hasColumn(columns, "status")) {
    const allowed = await getAllowedColumnValues(db, sourceTable, "status", columns);
    const value = pickPreferredAllowedValue(allowed, [
      "connected",
      "active",
      "enabled",
      "ready",
      "pending",
      "new",
      "draft",
    ]);
    if (value) out.status = value;
  }

  if (hasColumn(columns, "connection_status")) {
    const allowed = await getAllowedColumnValues(
      db,
      sourceTable,
      "connection_status",
      columns
    );
    const value = pickPreferredAllowedValue(allowed, [
      "connected",
      "active",
      "ready",
      "enabled",
      "pending",
    ]);
    if (value) out.connection_status = value;
  }

  if (hasColumn(columns, "sync_status")) {
    const allowed = await getAllowedColumnValues(db, sourceTable, "sync_status", columns);
    const value = pickPreferredAllowedValue(allowed, preferredLifecycleValues("running"));
    if (value) out.sync_status = value;
  }

  if (hasColumn(columns, "last_sync_status")) {
    const allowed = await getAllowedColumnValues(
      db,
      sourceTable,
      "last_sync_status",
      columns
    );
    const value = pickPreferredAllowedValue(allowed, preferredLifecycleValues("running"));
    if (value) out.last_sync_status = value;
  }

  return out;
}

export async function buildSourceSyncPatch(db, sourceTable, phase = "running") {
  const columns = await getTableColumns(db, sourceTable);
  const out = {};
  const preferred = preferredLifecycleValues(phase);

  if (hasColumn(columns, "sync_status")) {
    const allowed = await getAllowedColumnValues(db, sourceTable, "sync_status", columns);
    const value = pickPreferredAllowedValue(allowed, preferred);
    if (value) out.sync_status = value;
  }

  if (hasColumn(columns, "last_sync_status")) {
    const allowed = await getAllowedColumnValues(
      db,
      sourceTable,
      "last_sync_status",
      columns
    );
    const value = pickPreferredAllowedValue(allowed, preferred);
    if (value) out.last_sync_status = value;
  }

  return out;
}

export async function buildRunLifecyclePatch(db, runTable, phase = "running") {
  const columns = await getTableColumns(db, runTable);
  const out = {};
  const preferred = preferredLifecycleValues(phase);

  if (hasColumn(columns, "status")) {
    const allowed = await getAllowedColumnValues(db, runTable, "status", columns);
    const value = pickPreferredAllowedValue(allowed, preferred);
    if (value) out.status = value;
  }

  if (hasColumn(columns, "run_status")) {
    const allowed = await getAllowedColumnValues(db, runTable, "run_status", columns);
    const value = pickPreferredAllowedValue(allowed, preferred);
    if (value) out.run_status = value;
  }

  if (hasColumn(columns, "sync_status")) {
    const allowed = await getAllowedColumnValues(db, runTable, "sync_status", columns);
    const value = pickPreferredAllowedValue(allowed, preferred);
    if (value) out.sync_status = value;
  }

  return out;
}
