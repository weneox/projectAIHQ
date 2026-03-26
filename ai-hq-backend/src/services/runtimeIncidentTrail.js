import { createRuntimeIncidentHelpers } from "../db/helpers/runtimeIncidents.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

export async function persistRuntimeIncident({ db, incident = {} } = {}) {
  if (!db?.query) return null;
  const helpers = createRuntimeIncidentHelpers({ db });
  return helpers.recordIncident({
    service: s(incident.service || "ai-hq-backend"),
    area: s(incident.category || incident.area || "runtime"),
    severity: s(incident.level || incident.severity || "info"),
    code: s(incident.code || "runtime_signal"),
    reasonCode: s(incident.reasonCode || ""),
    requestId: s(incident.requestId || ""),
    correlationId: s(incident.correlationId || ""),
    tenantId: s(incident.tenantId || ""),
    tenantKey: s(incident.tenantKey || ""),
    detailSummary: s(incident.message || ""),
    context: incident.context || {},
    occurredAt: incident.ts || new Date().toISOString(),
  });
}

export async function listRecentRuntimeIncidents({
  db,
  limit = 20,
  service = "",
  severity = "",
  reasonCode = "",
  sinceHours = 0,
} = {}) {
  if (!db?.query) return [];
  const helpers = createRuntimeIncidentHelpers({ db });
  return helpers.listRecentIncidents({
    limit,
    service,
    severity,
    reasonCode,
    sinceHours,
  });
}

export async function pruneRuntimeIncidentTrail({
  db,
  retainDays = 14,
  maxRows = 5000,
} = {}) {
  if (!db?.query) {
    return {
      retainDays,
      maxRows,
      deletedByAge: 0,
      deletedByCount: 0,
    };
  }

  const helpers = createRuntimeIncidentHelpers({ db });
  return helpers.pruneIncidents({
    retainDays,
    maxRows,
  });
}
