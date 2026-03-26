import {
  getRuntimeMetricsSnapshot,
  listRuntimeSignals,
} from "./runtimeObservability.js";
import { validateDependencyReadinessEnvelope } from "@aihq/shared-contracts/health";

function buildSharedReadiness(bootReadiness = {}) {
  const checked = validateDependencyReadinessEnvelope(bootReadiness);
  return checked.ok
    ? checked.value
    : {
        status: "attention",
        checkedAt: "",
        enforced: false,
        reasonCode: "sidecar_health_contract_invalid",
        blockerReasonCodes: [],
        blockersTotal: 0,
        intentionallyUnavailable: false,
        error: checked.error,
        dependency: {},
        aihq: {},
        localDecision: {},
      };
}

export function buildHealthResponse({
  service = "twilio-voice-backend",
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
  service = "twilio-voice-backend",
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
        recentSignals: listRuntimeSignals().slice(0, 15).map((item) => ({
          ts: String(item?.ts || "").trim(),
          level: String(item?.level || "").trim(),
          category: String(item?.category || "").trim(),
          code: String(item?.code || "").trim(),
          reasonCode: String(item?.reasonCode || "").trim(),
          requestId: String(item?.requestId || "").trim(),
          correlationId: String(item?.correlationId || "").trim(),
          status: Number(item?.status || 0),
          callSid: String(item?.callSid || "").trim(),
          tenantKey: String(item?.tenantKey || "").trim(),
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
