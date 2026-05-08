import { Activity, AlertTriangle, Clock3, Filter, RefreshCcw } from "lucide-react";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import { MetricCard, Surface } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";
import { useAdminIncidentsSurface } from "./hooks/useAdminIncidentsSurface.js";

function severityTone(severity = "") {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function postureTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "degraded") return "danger";
  if (normalized === "attention") return "warning";
  return "success";
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
      <div className="text-[11px] uppercase tracking-[0.18em] text-text-subtle">{label}</div>
      {children}
    </label>
  );
}

function Control({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-text outline-none transition",
        "placeholder:text-text-subtle focus:border-brand focus:ring-4 focus:ring-brand/10",
        className
      )}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-text outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
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
      title="Incident trail"
      description="Recent durable runtime incidents across AI HQ, Meta, and Twilio."
      surface={surface}
      refreshLabel="Refresh incidents"
      unavailableMessage="Incident history is temporarily unavailable."
      actions={
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          {retentionPolicy ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
                <Clock3 className="h-3.5 w-3.5" />
                Retain {retentionPolicy.retainDays} days
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
                <Activity className="h-3.5 w-3.5" />
                Max {retentionPolicy.maxRows} incidents
              </span>
            </>
          ) : null}
        </div>
      }
    >
      {summary ? (
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Incident posture" value={postureLabel(summary.status)} tone={postureTone(summary.status)} />
          <MetricCard label="Recent incidents" value={summary.total || 0} />
          <MetricCard label="Errors" value={summary.errorCount || 0} />
          <MetricCard label="Warnings" value={summary.warnCount || 0} />
        </div>
      ) : null}

      <Surface className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-brand-soft text-brand">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text">Filters</div>
            <div className="text-xs text-text-muted">
              Filter the recent incident trail without leaving this page.
            </div>
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

          <FilterField label="Reason code">
            <Control
              value={filters.reasonCode}
              onChange={(e) => patchFilter("reasonCode", e.target.value)}
              placeholder="voice_sync_request_failed"
            />
          </FilterField>

          <FilterField label="Window">
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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyFilters}
            disabled={surface.loading}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand bg-brand px-4 text-sm font-medium text-white transition hover:border-brand-strong hover:bg-brand-strong disabled:opacity-50"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={surface.loading}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-text transition hover:border-line-strong hover:bg-surface-muted disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </Surface>

      <Surface className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-text">Recent durable incidents</div>
          <div className="text-xs text-text-muted">
            {incidents.length} incident{incidents.length === 1 ? "" : "s"} matched the current filter set.
          </div>
        </div>

        {!surface.loading && !incidents.length ? (
          <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">
            No recent durable incidents matched the current filters.
          </div>
        ) : null}

        {incidents.map((incident) => (
          <article key={incident.id} className="rounded-[24px] border border-line bg-surface-muted px-5 py-5">
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
                  <span className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1 text-[11px] text-text-muted">
                    {incident.service || "Unknown service"}
                  </span>
                  {incident.area ? (
                    <span className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1 text-[11px] text-text-muted">
                      {incident.area}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">{incident.code || "runtime_signal"}</div>
                    {incident.reasonCode ? (
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-text-subtle">
                        {incident.reasonCode}
                      </div>
                    ) : null}
                    {incident.detailSummary ? (
                      <p className="mt-3 text-sm leading-6 text-text-muted">{incident.detailSummary}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 text-xs text-text-subtle lg:min-w-[260px]">
                <div>Occurred: {incident.occurredAt ? new Date(incident.occurredAt).toLocaleString() : "-"}</div>
                <div>Tenant: {incident.tenantKey || "-"}</div>
                <div>Request ID: {incident.requestId || "-"}</div>
                <div>Correlation ID: {incident.correlationId || "-"}</div>
              </div>
            </div>
          </article>
        ))}
      </Surface>
    </AdminPageShell>
  );
}
