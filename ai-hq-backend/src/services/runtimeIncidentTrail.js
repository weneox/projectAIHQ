import { createRuntimeIncidentHelpers } from "../db/helpers/runtimeIncidents.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function toTimeMs(value = "") {
  const ms = Date.parse(s(value));
  return Number.isFinite(ms) ? ms : null;
}

function normalizeIncidentList(incidents = []) {
  return Array.isArray(incidents)
    ? incidents.filter((item) => item && typeof item === "object")
    : [];
}

function isIncidentAtOrAfter(incident = {}, windowStartedAt = "") {
  const windowMs = toTimeMs(windowStartedAt);
  if (windowMs === null) return true;

  const occurredMs = toTimeMs(
    incident.occurredAt ||
      incident.occurred_at ||
      incident.createdAt ||
      incident.created_at
  );
  return occurredMs !== null && occurredMs >= windowMs;
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

export function summarizeRuntimeIncidents(incidents = [], { sinceHours = 0 } = {}) {
  const list = normalizeIncidentList(incidents);
  const errorCount = list.filter(
    (item) => lower(item.severity) === "error"
  ).length;
  const warnCount = list.filter((item) => lower(item.severity) === "warn").length;
  const latestOccurredAt = list[0]?.occurredAt || "";

  return {
    status: errorCount > 0 ? "degraded" : warnCount > 0 ? "attention" : "clear",
    total: list.length,
    errorCount,
    warnCount,
    latestOccurredAt: s(latestOccurredAt),
    sinceHours: Number(sinceHours || 0),
    services: Array.from(
      new Set(list.map((item) => s(item.service)).filter(Boolean))
    ).slice(0, 6),
    reasonCodes: Array.from(
      new Set(list.map((item) => s(item.reasonCode)).filter(Boolean))
    ).slice(0, 10),
  };
}

export function summarizeRuntimeIncidentHealthWindow(
  incidents = [],
  { activeWindowStartedAt = "", sinceHours = 0 } = {}
) {
  const list = normalizeIncidentList(incidents);
  const activeList = s(activeWindowStartedAt)
    ? list.filter((incident) =>
        isIncidentAtOrAfter(incident, activeWindowStartedAt)
      )
    : list;
  const activeSummary = summarizeRuntimeIncidents(activeList, { sinceHours });
  const recentSummary = summarizeRuntimeIncidents(list, { sinceHours });

  return {
    ...activeSummary,
    scope: s(activeWindowStartedAt) ? "current_runtime" : "recent_window",
    activeWindowStartedAt: s(activeWindowStartedAt),
    history: {
      status: recentSummary.status,
      total: recentSummary.total,
      errorCount: recentSummary.errorCount,
      warnCount: recentSummary.warnCount,
      latestOccurredAt: recentSummary.latestOccurredAt,
      sinceHours: recentSummary.sinceHours,
      staleBeforeActiveWindowCount: Math.max(
        0,
        list.length - activeList.length
      ),
    },
  };
}
