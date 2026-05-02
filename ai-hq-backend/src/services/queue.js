import crypto from "node:crypto";
import { createDurableExecutionHelpers } from "../db/helpers/durableExecutions.js";

function s(value = "", fallback = "") {
  const out = String(value ?? "").trim();
  return out || String(fallback ?? "").trim();
}

function lower(value = "") {
  return s(value).toLowerCase();
}

export function buildQueueIdempotencyKey(parts = {}) {
  const stable = Object.entries(parts || {})
    .map(([key, value]) => [key, s(value)])
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!stable.length) return "";

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex");
}

export async function enqueueQueueJob({
  db,
  tenantId = "",
  tenantKey = "",
  queue = "default",
  actionType = "",
  targetType = "runtime",
  targetId = "",
  payload = {},
  metadata = {},
  correlationIds = {},
  idempotencyKey = "",
  maxAttempts = 5,
  nextRetryAt = new Date().toISOString(),
} = {}) {
  if (!db || typeof db.query !== "function") {
    const err = new Error("queue db is unavailable");
    err.code = "QUEUE_DB_UNAVAILABLE";
    throw err;
  }

  const safeActionType = s(actionType);
  if (!safeActionType) {
    const err = new Error("queue job actionType is required");
    err.code = "QUEUE_ACTION_REQUIRED";
    throw err;
  }

  const helpers = createDurableExecutionHelpers({ db });
  const key =
    s(idempotencyKey) ||
    buildQueueIdempotencyKey({
      tenantId,
      tenantKey,
      queue,
      actionType: safeActionType,
      targetType,
      targetId,
    });

  return helpers.enqueueExecution({
    tenantId,
    tenantKey,
    channel: lower(queue || "default") || "default",
    provider: "queue",
    actionType: safeActionType,
    targetType,
    targetId,
    idempotencyKey: key,
    payloadSummary: payload && typeof payload === "object" ? payload : {},
    safeMetadata: metadata && typeof metadata === "object" ? metadata : {},
    correlationIds: correlationIds && typeof correlationIds === "object" ? correlationIds : {},
    maxAttempts,
    nextRetryAt,
  });
}

export const __test__ = {
  buildQueueIdempotencyKey,
};
