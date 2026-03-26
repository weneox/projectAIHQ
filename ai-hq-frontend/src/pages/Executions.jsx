import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import {
  cn,
  displayValue,
  extractSummary,
  formatDate,
  formatRelative,
  pretty,
  queueLabel,
  statusMeta,
} from "../components/executions/execution-ui.jsx";
import { useExecutionsSurface } from "./hooks/useExecutionsSurface.js";

const STATUS_FILTERS = [
  { value: "", label: "All queues" },
  { value: "retryable", label: "Retryable" },
  { value: "dead_lettered", label: "Dead-lettered" },
  { value: "in_progress", label: "In progress" },
  { value: "terminal", label: "Terminal" },
  { value: "pending", label: "Pending" },
  { value: "succeeded", label: "Succeeded" },
];

export default function Executions() {
  const {
    summary,
    providers,
    channels,
    filteredItems,
    selectedId,
    openExecution,
    detail,
    detailSurface,
    statusFilter,
    setStatusFilter,
    providerFilter,
    setProviderFilter,
    channelFilter,
    setChannelFilter,
    tenantFilter,
    setTenantFilter,
    surface,
    actionState,
    retrySelectedExecution,
  } = useExecutionsSurface();

  const retryDisabled =
    !detail?.execution ||
    !["retryable", "terminal", "dead_lettered"].includes(String(detail?.execution?.status || "").toLowerCase()) ||
    surface.saving;

  return (
    <AdminPageShell
      eyebrow="Durable execution control plane"
      title="Operator execution surface"
      description="Primary queue view for durable runtime control. Legacy jobs stay out of this operator path."
      surface={surface}
      refreshLabel="Refresh durable surface"
      unavailableMessage="Durable execution controls are temporarily unavailable."
      actions={
        <button
          onClick={retrySelectedExecution}
          disabled={retryDisabled}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white/84 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className={cn("h-4 w-4", actionState.isActionPending("retry") && "animate-spin")} />
          Manual retry
        </button>
      }
    >
      <section className="rounded-[28px] border border-white/10 bg-[#07111d] px-5 py-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Retryable" value={summary?.counts?.retryable} tone="amber" />
          <SummaryCard label="Dead-lettered" value={summary?.deadLetterCount} tone="rose" />
          <SummaryCard
            label="Oldest retryable"
            value={formatRelative(summary?.oldestRetryable?.next_retry_at || summary?.oldestRetryable?.created_at)}
          />
          <SummaryCard
            label="Oldest in progress"
            value={formatRelative(summary?.oldestInProgress?.last_attempt_at || summary?.oldestInProgress?.created_at)}
          />
          <SummaryCard
            label="Worker health"
            value={displayWorker(summary?.operational?.workers?.durableExecution?.health?.status, summary?.worker)}
          />
        </div>

        {summary?.operational?.alerts?.length ? (
          <div className="mt-4 rounded-[22px] border border-amber-400/18 bg-amber-400/[0.08] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-100/72">Attention needed</div>
            <div className="mt-2 text-sm text-amber-50">
              {summary.operational.alerts.map((item) => item.message).join(" ")}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Metric
                label="Durable heartbeat"
                value={displayWorker(summary?.operational?.workers?.durableExecution?.health?.status, summary?.worker)}
              />
              <Metric
                label="Source sync heartbeat"
                value={displayWorker(summary?.operational?.workers?.sourceSync?.health?.status, summary?.sourceSyncWorker)}
              />
              <Metric
                label="Recent signal count"
                value={
                  Number(summary?.operational?.recentSignals?.realtimeAuthFailures || 0) +
                  Number(summary?.operational?.recentSignals?.sourceSyncAttentionEvents || 0)
                }
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
          <FilterSelect
            label="Provider"
            value={providerFilter}
            onChange={setProviderFilter}
            options={[{ value: "", label: "All providers" }, ...providers.map((item) => ({ value: item, label: item }))]}
          />
          <FilterSelect
            label="Channel"
            value={channelFilter}
            onChange={setChannelFilter}
            options={[{ value: "", label: "All channels" }, ...channels.map((item) => ({ value: item, label: item }))]}
          />
          <label className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Tenant</div>
            <input
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
              placeholder="tenant key or id"
              className="w-full rounded-2xl border border-white/10 bg-[#08111d] px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Queue view</div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {statusFilter ? queueLabel(statusFilter) : "All durable executions"}
              </h2>
            </div>
            <div className="text-sm text-white/48">{filteredItems.length} items</div>
          </div>

          {surface.loading ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-[#08111d] px-4 py-5 text-sm text-white/60">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading durable execution queues
            </div>
          ) : filteredItems.length ? (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <ExecutionRow key={item.id} item={item} selected={selectedId === item.id} onOpen={openExecution} />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-white/10 bg-[#08111d] px-4 py-5 text-sm text-white/56">
              No durable executions match the current filters.
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Execution detail</div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {detail?.execution?.action_type || "Select a durable execution"}
              </h2>
            </div>
          </div>

          {!detailSurface.unavailable && detailSurface.error ? (
            <div className="mb-4 rounded-[22px] border border-rose-400/16 bg-rose-400/[0.08] px-4 py-5 text-sm text-rose-100">
              {detailSurface.error}
            </div>
          ) : null}

          {detailSurface.loading ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-[#08111d] px-4 py-5 text-sm text-white/60">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading execution detail
            </div>
          ) : detail?.execution ? (
            <ExecutionDetail detail={detail} />
          ) : (
            <div className="rounded-[22px] border border-white/10 bg-[#08111d] px-4 py-5 text-sm text-white/56">
              Pick a durable execution from the queue to inspect attempts and manual retry audit.
            </div>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function displayWorker(healthStatus, workerState) {
  const normalized = String(healthStatus || "").toLowerCase();
  if (normalized === "stale") return "Stale";
  if (normalized === "running") return "Running";
  if (normalized === "idle") return "Idle";
  return workerState?.enabled ? (workerState?.running ? "Running" : "Idle") : "Disabled";
}

function SummaryCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-400/14 bg-amber-400/[0.06]"
      : tone === "rose"
        ? "border-rose-400/14 bg-rose-400/[0.06]"
        : "border-white/10 bg-white/[0.04]";

  return (
    <div className={cn("rounded-[22px] border px-4 py-4", toneClass)}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/42">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{displayValue(value)}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#08111d] px-4 py-3 text-sm text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExecutionRow({ item, selected, onOpen }) {
  const meta = statusMeta(item.status);
  return (
    <button
      onClick={() => onOpen(item.id)}
      className={cn(
        "w-full rounded-[22px] border px-4 py-4 text-left transition",
        selected ? "border-white/20 bg-white/[0.09]" : "border-white/10 bg-[#08111d] hover:bg-white/[0.06]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", meta.badge)}>
              {meta.label}
            </span>
            <span className="text-xs text-white/44">
              {item.provider} / {item.channel}
            </span>
          </div>
          <div className="mt-3 text-sm font-medium text-white">{item.action_type}</div>
          <div className="mt-1 text-xs text-white/46">
            tenant {displayValue(item.tenant_key)} · target {displayValue(item.target_id)}
          </div>
        </div>
        <div className="text-right text-xs text-white/44">
          <div>{formatRelative(item.next_retry_at || item.updated_at || item.created_at)}</div>
          <div className="mt-1">
            attempt {item.attempt_count}/{item.max_attempts}
          </div>
        </div>
      </div>
    </button>
  );
}

function ExecutionDetail({ detail }) {
  const execution = detail.execution;
  const meta = statusMeta(execution.status);

  return (
    <div className="space-y-4">
      <div className={cn("rounded-[22px] border p-4", meta.panel)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", meta.badge)}>{meta.label}</span>
          <span className="text-xs text-white/46">
            {execution.provider} / {execution.channel}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Metric label="Execution ID" value={execution.id} mono />
          <Metric label="Tenant" value={execution.tenant_key || execution.tenant_id} />
          <Metric label="Action" value={execution.action_type} />
          <Metric label="Target" value={execution.target_id || execution.thread_id || execution.conversation_id} />
          <Metric label="Created" value={formatDate(execution.created_at)} />
          <Metric label="Next retry" value={formatDate(execution.next_retry_at)} />
          <Metric label="Last error code" value={execution.last_error_code} />
          <Metric label="Last error classification" value={execution.last_error_classification} />
        </div>
        {execution.last_error_message ? (
          <div className="mt-4 rounded-[18px] border border-rose-400/14 bg-black/20 px-3 py-3 text-sm text-rose-100">
            {execution.last_error_message}
          </div>
        ) : null}
      </div>

      <section className="rounded-[22px] border border-white/10 bg-[#08111d] p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Payload summary</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {extractSummary(execution.payload_summary).length ? (
            extractSummary(execution.payload_summary).map((item) => <Metric key={item.key} label={item.key} value={item.value} />)
          ) : (
            <div className="text-sm text-white/56">No safe payload summary stored.</div>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#08111d] p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Attempt history</div>
        <div className="mt-3 space-y-3">
          {detail.attempts.length ? (
            detail.attempts.map((attempt) => (
              <div key={attempt.id} className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">Attempt {attempt.attempt_number}</div>
                  <div className="text-xs text-white/46">{formatDate(attempt.started_at)}</div>
                </div>
                <div className="mt-2 text-xs text-white/54">
                  {displayValue(attempt.status_from)} → {displayValue(attempt.status_to)}
                </div>
                {attempt.error_message ? <div className="mt-2 text-sm text-rose-100">{attempt.error_message}</div> : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-white/56">No attempt history available.</div>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#08111d] p-4">
        <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Manual retry audit</div>
        <div className="mt-3 space-y-3">
          {detail.auditTrail.length ? (
            detail.auditTrail.map((entry) => (
              <div key={entry.id} className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">{entry.action}</div>
                  <div className="text-xs text-white/46">{formatDate(entry.created_at)}</div>
                </div>
                <div className="mt-2 text-sm text-white/72">Actor: {displayValue(entry.actor)}</div>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-white/56">
                  {pretty(entry.meta)}
                </pre>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/56">
              <AlertTriangle className="h-4 w-4" />
              No manual retry audit entries for this execution yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, mono = false }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">{label}</div>
      <div className={cn("mt-2 break-words text-sm text-white/86", mono && "font-mono text-xs")}>{displayValue(value)}</div>
    </div>
  );
}
