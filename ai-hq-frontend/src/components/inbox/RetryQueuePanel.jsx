import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import { useRetryQueueSurface } from "./hooks/useRetryQueueSurface.js";

function s(v) {
  return String(v ?? "").trim();
}

function fmtDate(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const x = s(status).toLowerCase();

  const map = {
    queued: "bg-slate-100 text-slate-700 border-slate-200",
    sending: "bg-blue-50 text-blue-700 border-blue-200",
    sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-amber-50 text-amber-700 border-amber-200",
    retrying: "bg-violet-50 text-violet-700 border-violet-200",
    dead: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${map[x] || map.queued}`}
    >
      {x || "unknown"}
    </span>
  );
}

export default function RetryQueuePanel({
  tenantKey = "neox",
  actor = "operator",
  className = "",
}) {
  const {
    attempts,
    cards,
    statusFilter,
    setStatusFilter,
    surface,
    actionState,
    handleResend,
    handleMarkDead,
  } = useRetryQueueSurface({ tenantKey, actor });

  return (
    <section className={className}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Delivery resilience
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
              Retry Queue
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-500">
              Outbound delivery attempts that failed, are retrying, or need operator cleanup.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
            >
              <option value="">All problem states</option>
              <option value="failed">Failed</option>
              <option value="retrying">Retrying</option>
              <option value="dead">Dead</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
            </select>

            <button
              type="button"
              onClick={surface.refresh}
              disabled={surface.loading || surface.saving}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </div>

        <div className="mt-4">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Retry queue is temporarily unavailable."
            refreshLabel="Refresh retry queue"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
          {surface.loading ? (
            <div className="p-6 text-sm text-slate-500">Loading queue...</div>
          ) : attempts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No retry items.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {attempts.map((item) => {
                const id = s(item?.id);
                const retryBusy = actionState.isActionPending(`retry:${id}`);
                const deadBusy = actionState.isActionPending(`dead:${id}`);
                const isBusy = retryBusy || deadBusy;

                return (
                  <div
                    key={id}
                    className="grid gap-4 p-4 xl:grid-cols-[1.2fr_1fr_0.8fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={item?.status} />
                        <span className="text-xs text-slate-400">
                          attempts: {Number(item?.attempt_count || 0)} /{" "}
                          {Number(item?.max_attempts || 0)}
                        </span>
                      </div>

                      <div className="mt-2 truncate text-sm font-medium text-slate-900">
                        {s(item?.customer_name) ||
                          s(item?.external_username) ||
                          s(item?.external_user_id) ||
                          "Unknown recipient"}
                      </div>

                      <div className="mt-1 text-sm text-slate-600">
                        {s(item?.message_text) || "--"}
                      </div>

                      {s(item?.last_error) ? (
                        <div className="mt-2 text-xs text-rose-600">
                          {s(item?.last_error)}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-sm text-slate-500">
                      <div>
                        <span className="text-slate-400">Channel:</span>{" "}
                        {s(item?.channel) || "--"}
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-400">Next retry:</span>{" "}
                        {fmtDate(item?.next_retry_at)}
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-400">Updated:</span>{" "}
                        {fmtDate(item?.updated_at)}
                      </div>
                    </div>

                    <div className="text-sm text-slate-500">
                      <div>
                        <span className="text-slate-400">Provider:</span>{" "}
                        {s(item?.provider) || "--"}
                      </div>
                      <div className="mt-1 break-all">
                        <span className="text-slate-400">Attempt ID:</span>{" "}
                        {id}
                      </div>
                    </div>

                    <div className="flex items-start justify-start gap-2 xl:justify-end">
                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "sent"}
                        onClick={() => handleResend(id)}
                        className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {retryBusy ? "..." : "Retry"}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "dead"}
                        onClick={() => handleMarkDead(id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deadBusy ? "..." : "Dead"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
