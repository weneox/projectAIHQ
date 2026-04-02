import { Activity, AlertTriangle, Clock3, Filter, RefreshCcw } from "lucide-react";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import { useAdminIncidentsSurface } from "./hooks/useAdminIncidentsSurface.js";

function cx(...items) {
  return items.filter(Boolean).join(" ");
}

function severityTone(severity = "") {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "error") return "border-rose-400/18 bg-rose-500/12 text-rose-200";
  if (normalized === "warn") return "border-amber-400/18 bg-amber-500/12 text-amber-200";
  return "border-sky-400/18 bg-sky-500/12 text-sky-200";
}

function prettyService(service = "") {
  const normalized = String(service || "").trim();
  if (!normalized) return "Unknown service";
  return normalized;
}

function postureTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "degraded") return "border-rose-400/18 text-rose-100";
  if (normalized === "attention") return "border-amber-400/18 text-amber-100";
  return "border-emerald-400/18 text-emerald-100";
}

function postureLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "degraded") return "Degraded";
  if (normalized === "attention") return "Attention";
  return "Clear";
}

function FilterField({ label, children }) {
  return (
    <label className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</div>
      {children}
    </label>
  );
}

function Control({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition",
        "placeholder:text-white/30 focus:border-cyan-400/28 focus:bg-white/[0.06] focus:ring-4 focus:ring-cyan-500/10",
        className
      )}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-2xl border border-white/10 bg-[#09121c] px-4 text-sm text-white outline-none transition focus:border-cyan-400/28 focus:ring-4 focus:ring-cyan-500/10"
    />
  );
}

export default function Incidents() {
  const {
    incidents,
    filters,
    patchFilter,
    applyFilters,
    clearFilters,
    retentionPolicy,
    summary,
    surface,
  } = useAdminIncidentsSurface();

  return (
    <AdminPageShell
      eyebrow="Operational review"
      title="Incident Trail"
      description="Recent durable runtime incidents across AI HQ, Meta, and Twilio. Filter by service, severity, and reason code to inspect the latest production-critical events."
      surface={surface}
      refreshLabel="Refresh incidents"
      unavailableMessage="Incident history is temporarily unavailable."
      actions={
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/48">
          {retentionPolicy ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                <Clock3 className="h-3.5 w-3.5" />
                Retain {retentionPolicy.retainDays} days
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                <Activity className="h-3.5 w-3.5" />
                Max {retentionPolicy.maxRows} incidents
              </span>
            </>
          ) : null}
        </div>
      }
    >
      <section className="border-t border-white/10 px-1 py-5">
        {summary ? (
          <div className={cx("mb-5 border-l-2 pl-4", postureTone(summary.status))}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/58">
                  Current incident posture
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {postureLabel(summary.status)} over the last {summary.sinceHours || filters.sinceHours}h
                </div>
                <div className="mt-2 text-sm text-white/72">
                  {summary.total || 0} recent incident{Number(summary.total || 0) === 1 ? "" : "s"}.{" "}
                  {summary.errorCount || 0} error, {summary.warnCount || 0} warn.
                </div>
              </div>

              <div className="grid gap-2 text-xs text-white/64">
                <div>Latest: {summary.latestOccurredAt ? new Date(summary.latestOccurredAt).toLocaleString() : "-"}</div>
                <div>Services: {summary.services?.length ? summary.services.join(", ") : "-"}</div>
                <div>Reasons: {summary.reasonCodes?.length ? summary.reasonCodes.join(", ") : "-"}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-cyan-300">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Filters</div>
            <div className="text-xs text-white/48">Filter the recent incident trail without leaving this page.</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <FilterField label="Service">
            <Select value={filters.service} onChange={(e) => patchFilter("service", e.target.value)}>
              <option value="">All services</option>
              <option value="ai-hq-backend">AI HQ backend</option>
              <option value="meta-bot-backend">Meta sidecar</option>
              <option value="twilio-voice-backend">Twilio voice</option>
            </Select>
          </FilterField>

          <FilterField label="Severity">
            <Select value={filters.severity} onChange={(e) => patchFilter("severity", e.target.value)}>
              <option value="">All severities</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </Select>
          </FilterField>

          <FilterField label="Reason Code">
            <Control
              value={filters.reasonCode}
              onChange={(e) => patchFilter("reasonCode", e.target.value)}
              placeholder="voice_sync_request_failed"
            />
          </FilterField>

          <FilterField label="Window (hours)">
            <Select value={filters.sinceHours} onChange={(e) => patchFilter("sinceHours", e.target.value)}>
              <option value="6">Last 6h</option>
              <option value="24">Last 24h</option>
              <option value="72">Last 72h</option>
              <option value="168">Last 7d</option>
            </Select>
          </FilterField>

          <FilterField label="Limit">
            <Select value={filters.limit} onChange={(e) => patchFilter("limit", e.target.value)}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </FilterField>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            disabled={surface.loading}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-400/24 bg-cyan-400 px-4 text-sm font-medium text-slate-950 transition hover:brightness-110 disabled:opacity-50"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={surface.loading}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="border-t border-white/10 px-1 py-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Recent durable incidents</div>
            <div className="text-xs text-white/48">
              {incidents.length} incident{incidents.length === 1 ? "" : "s"} matched the current filter set.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {!surface.loading && !incidents.length ? (
            <div className="border-l-2 border-dashed border-white/15 pl-4 text-sm text-white/48">
              No recent durable incidents matched the current filters.
            </div>
          ) : null}

          {incidents.map((incident) => (
            <article
              key={incident.id}
              className="border-t border-white/10 px-1 py-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        severityTone(incident.severity)
                      )}
                    >
                      {incident.severity || "info"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/62">
                      {prettyService(incident.service)}
                    </span>
                    {incident.area ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/62">
                        {incident.area}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{incident.code || "runtime_signal"}</div>
                      {incident.reasonCode ? (
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
                          {incident.reasonCode}
                        </div>
                      ) : null}
                      {incident.detailSummary ? (
                        <p className="mt-3 text-sm leading-6 text-white/68">{incident.detailSummary}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-white/46 lg:min-w-[260px]">
                  <div>Occurred: {incident.occurredAt ? new Date(incident.occurredAt).toLocaleString() : "-"}</div>
                  <div>Tenant: {incident.tenantKey || "-"}</div>
                  <div>Request ID: {incident.requestId || "-"}</div>
                  <div>Correlation ID: {incident.correlationId || "-"}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
