function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sanitizeContext(context = {}) {
  if (!isObj(context)) return {};

  const out = {};
  for (const [key, value] of Object.entries(context)) {
    const safeKey = s(key);
    if (!safeKey || value === undefined || value === null) continue;
    if (typeof value === "string") {
      out[safeKey] = s(value).slice(0, 240);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[safeKey] = value;
    }
  }

  return out;
}

function normalizeSeverity(value = "") {
  const severity = lower(value || "info");
  if (severity === "error") return "error";
  if (severity === "warn" || severity === "warning") return "warn";
  return "info";
}

function normalizeIncident(input = {}) {
  return {
    service: s(input.service || "unknown-service").slice(0, 80),
    area: s(input.area || input.category || "runtime").slice(0, 120),
    severity: normalizeSeverity(input.severity || input.level),
    code: s(input.code || "runtime_signal").slice(0, 120),
    reasonCode: s(input.reasonCode || "").slice(0, 120),
    requestId: s(input.requestId || "").slice(0, 120) || null,
    correlationId: s(input.correlationId || "").slice(0, 120) || null,
    tenantId: s(input.tenantId || "") || null,
    tenantKey: lower(input.tenantKey || "").slice(0, 120) || null,
    detailSummary: s(input.detailSummary || input.message || input.error || "").slice(0, 320),
    context: sanitizeContext(input.context),
    occurredAt: s(input.occurredAt || new Date().toISOString()),
  };
}

function mapRow(row = {}) {
  return {
    id: s(row.id),
    service: s(row.service),
    area: s(row.area),
    severity: lower(row.severity || "info"),
    code: s(row.code),
    reasonCode: s(row.reason_code),
    requestId: s(row.request_id),
    correlationId: s(row.correlation_id),
    tenantId: s(row.tenant_id),
    tenantKey: s(row.tenant_key),
    detailSummary: s(row.detail_summary),
    context: isObj(row.context) ? row.context : {},
    occurredAt: s(row.occurred_at),
    createdAt: s(row.created_at),
  };
}

function normalizeFilters({
  limit = 20,
  service = "",
  severity = "",
  reasonCode = "",
  sinceHours = 0,
} = {}) {
  return {
    limit: Math.max(1, Math.min(100, n(limit, 20))),
    service: s(service).slice(0, 80),
    severity: normalizeSeverity(severity || ""),
    reasonCode: s(reasonCode).slice(0, 120),
    sinceHours: Math.max(0, Math.min(24 * 30, n(sinceHours, 0))),
  };
}

export function createRuntimeIncidentHelpers({ db }) {
  return {
    async recordIncident(input = {}) {
      const incident = normalizeIncident(input);
      const result = await db.query(
        `
          insert into runtime_incidents (
            service,
            area,
            severity,
            code,
            reason_code,
            request_id,
            correlation_id,
            tenant_id,
            tenant_key,
            detail_summary,
            context,
            occurred_at
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11::jsonb,$12::timestamptz)
          returning *
        `,
        [
          incident.service,
          incident.area,
          incident.severity,
          incident.code,
          incident.reasonCode,
          incident.requestId,
          incident.correlationId,
          incident.tenantId,
          incident.tenantKey,
          incident.detailSummary,
          JSON.stringify(incident.context),
          incident.occurredAt,
        ]
      );

      return mapRow(result?.rows?.[0] || {});
    },

    async listRecentIncidents(filters = {}) {
      const { limit, service, severity, reasonCode, sinceHours } = normalizeFilters(filters);
      const args = [];
      const where = [];

      if (service) {
        args.push(service);
        where.push(`service = $${args.length}`);
      }

      if (severity && severity !== "info") {
        args.push(severity);
        where.push(`severity = $${args.length}`);
      }

      if (reasonCode) {
        args.push(reasonCode);
        where.push(`reason_code = $${args.length}`);
      }

      if (sinceHours > 0) {
        args.push(sinceHours);
        where.push(`occurred_at >= now() - ($${args.length}::int * interval '1 hour')`);
      }

      args.push(limit);

      const result = await db.query(
        `
          select *
          from runtime_incidents
          ${where.length ? `where ${where.join(" and ")}` : ""}
          order by occurred_at desc, created_at desc
          limit $${args.length}
        `,
        args
      );

      return Array.isArray(result?.rows) ? result.rows.map(mapRow) : [];
    },

    async pruneIncidents({ retainDays = 14, maxRows = 5000 } = {}) {
      const safeRetainDays = Math.max(1, Math.min(365, n(retainDays, 14)));
      const safeMaxRows = Math.max(100, Math.min(100_000, n(maxRows, 5000)));

      const byAgeResult = await db.query(
        `
          delete from runtime_incidents
          where occurred_at < now() - ($1::int * interval '1 day')
        `,
        [safeRetainDays]
      );

      const byCountResult = await db.query(
        `
          with stale as (
            select id
            from runtime_incidents
            order by occurred_at desc, created_at desc
            offset $1
          )
          delete from runtime_incidents
          where id in (select id from stale)
        `,
        [safeMaxRows]
      );

      return {
        retainDays: safeRetainDays,
        maxRows: safeMaxRows,
        deletedByAge: Number(byAgeResult?.rowCount || 0),
        deletedByCount: Number(byCountResult?.rowCount || 0),
      };
    },
  };
}

export const __test__ = {
  normalizeIncident,
  sanitizeContext,
  normalizeFilters,
};
