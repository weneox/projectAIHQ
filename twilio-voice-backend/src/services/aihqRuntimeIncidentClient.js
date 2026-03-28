import { validateRuntimeIncidentResponse } from "@aihq/shared-contracts/critical";
import { buildCorrelationHeaders, createStructuredLogger } from "@aihq/shared-contracts/logger";

import { cfg } from "../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function trimSlash(v = "") {
  return s(v).replace(/\/+$/, "");
}

async function safeReadJson(res) {
  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const logger = createStructuredLogger({
  service: "twilio-voice-backend",
  component: "aihq-runtime-incident-client",
});

function normalizeIncident(incident = {}) {
  return {
    service: s(incident.service || "twilio-voice-backend"),
    area: s(incident.area || incident.category || "runtime"),
    severity: s(incident.severity || incident.level || "warn").toLowerCase(),
    code: s(incident.code || "runtime_signal"),
    reasonCode: s(incident.reasonCode || ""),
    requestId: s(incident.requestId || ""),
    correlationId: s(incident.correlationId || ""),
    tenantId: s(incident.tenantId || ""),
    tenantKey: s(incident.tenantKey || "").toLowerCase(),
    detailSummary: s(incident.detailSummary || incident.message || incident.error || "").slice(
      0,
      320
    ),
    context:
      incident.context && typeof incident.context === "object" && !Array.isArray(incident.context)
        ? incident.context
        : {},
    occurredAt: s(incident.occurredAt || incident.ts || new Date().toISOString()),
  };
}

export function createAihqRuntimeIncidentClient({
  fetchFn = globalThis.fetch?.bind(globalThis),
  baseUrl = cfg.AIHQ_BASE_URL,
  internalToken = cfg.AIHQ_INTERNAL_TOKEN,
  timeoutMs = 8000,
} = {}) {
  const root = trimSlash(baseUrl);
  const token = s(internalToken);

  function canUse() {
    return Boolean(root && token && fetchFn);
  }

  async function recordIncident(incident = {}) {
    if (!canUse()) {
      return {
        ok: false,
        skipped: true,
        status: 0,
        error: "aihq_runtime_incident_client_not_configured",
      };
    }

    const payload = normalizeIncident(incident);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(timeoutMs || 8000));

    try {
      const res = await fetchFn(`${root}/api/internal/runtime-signals/incidents`, {
        method: "POST",
        headers: buildCorrelationHeaders({
          requestId: payload.requestId,
          correlationId: payload.correlationId,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
            "x-internal-token": token,
            ...(s(cfg.AIHQ_INTERNAL_SERVICE)
              ? { "x-internal-service": s(cfg.AIHQ_INTERNAL_SERVICE) }
              : {}),
            "x-internal-audience": "aihq-backend.runtime-signals.incidents",
          },
        }),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const json = await safeReadJson(res);
      const checked = validateRuntimeIncidentResponse(json || { ok: false });
      if (!res.ok || !checked.ok) {
        logger.warn("voice.runtime_incident.persist_failed", {
          status: Number(res.status || 0),
          requestId: payload.requestId,
          correlationId: payload.correlationId,
          code: payload.code,
          reasonCode: payload.reasonCode,
          error: s(json?.error || checked.error || "runtime_incident_persist_failed"),
        });
        return {
          ok: false,
          skipped: false,
          status: Number(res.status || 0),
          error: s(json?.error || checked.error || "runtime_incident_persist_failed"),
        };
      }

      return {
        ok: true,
        skipped: false,
        status: Number(res.status || 0),
        incident: json?.incident || null,
      };
    } catch (error) {
      logger.warn("voice.runtime_incident.persist_exception", {
        requestId: payload.requestId,
        correlationId: payload.correlationId,
        code: payload.code,
        reasonCode: payload.reasonCode,
        error: error?.name === "AbortError" ? "aihq_runtime_incident_timeout" : s(error?.message || error),
      });
      return {
        ok: false,
        skipped: false,
        status: 0,
        error: error?.name === "AbortError" ? "aihq_runtime_incident_timeout" : s(error?.message || error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    canUse,
    recordIncident,
  };
}
