import {
  getRuntimeMetricsSnapshot,
  listRuntimeSignals,
  listExecutionFailures,
} from "./runtimeReliability.js";

function buildSharedReadiness(bootReadiness = {}) {
  return {
    status: String(bootReadiness.status || "").trim().toLowerCase(),
    checkedAt: String(bootReadiness.checkedAt || "").trim(),
    enforced: bootReadiness.enforced === true,
    reasonCode: String(bootReadiness.reasonCode || "").trim(),
    blockerReasonCodes: Array.isArray(bootReadiness.blockerReasonCodes)
      ? bootReadiness.blockerReasonCodes
      : [],
    blockersTotal: Number(bootReadiness.blockersTotal || 0),
    intentionallyUnavailable: bootReadiness.intentionallyUnavailable === true,
    error: String(bootReadiness.error || "").trim(),
    dependency: bootReadiness.dependency || {},
    aihq: bootReadiness.aihq || {},
    localDecision: bootReadiness.localDecision || {},
  };
}

export function buildHealthResponse({
  service = "meta-bot-backend",
  bootReadiness = {},
} = {}) {
  const readiness = buildSharedReadiness(bootReadiness);
  const unavailable = readiness.intentionallyUnavailable;

  return {
    statusCode: unavailable ? 503 : 200,
    body: {
      ok: !unavailable,
      service,
      readiness,
      bootReadiness,
    },
  };
}

export function createHealthHandler(options = {}) {
  return (_req, res) => {
    const response = buildHealthResponse(options);
    return res.status(response.statusCode).json(response.body);
  };
}

export function buildRuntimeSignalsResponse({
  service = "meta-bot-backend",
  bootReadiness = {},
} = {}) {
  return {
    statusCode: 200,
    body: {
      ok: true,
      service,
      readiness: buildSharedReadiness(bootReadiness),
      runtime: {
        checkedAt: new Date().toISOString(),
        metrics: getRuntimeMetricsSnapshot(),
        recentExecutionFailures: listExecutionFailures().slice(0, 10).map((item) => ({
          ts: String(item?.ts || "").trim(),
          type: String(item?.type || "").trim(),
          channel: String(item?.channel || "").trim(),
          tenantKey: String(item?.tenantKey || "").trim(),
          threadId: String(item?.threadId || "").trim(),
          recipientId: String(item?.recipientId || "").trim(),
          status: Number(item?.status || 0),
          failureClass: String(item?.failureClass || "").trim(),
          retryable: item?.retryable === true,
          error: String(item?.error || "").trim(),
        })),
        recentSignals: listRuntimeSignals().slice(0, 15).map((item) => ({
          ts: String(item?.ts || "").trim(),
          level: String(item?.level || "").trim(),
          category: String(item?.category || "").trim(),
          code: String(item?.code || "").trim(),
          reasonCode: String(item?.reasonCode || "").trim(),
          requestId: String(item?.requestId || "").trim(),
          correlationId: String(item?.correlationId || "").trim(),
          tenantKey: String(item?.tenantKey || "").trim(),
          threadId: String(item?.threadId || "").trim(),
          status: Number(item?.status || 0),
          error: String(item?.error || "").trim(),
        })),
      },
    },
  };
}

export function createRuntimeSignalsHandler(options = {}) {
  return (_req, res) => {
    const response = buildRuntimeSignalsResponse(options);
    return res.status(response.statusCode).json(response.body);
  };
}
