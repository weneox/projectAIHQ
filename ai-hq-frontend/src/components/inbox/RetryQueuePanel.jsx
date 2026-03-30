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

function MetricPill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
      <span className="text-slate-500">{label}</span> <span className="font-semibold text-slate-200">{value}</span>
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
  compact = false,
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
      <div className="rounded-[28px] border border-white/10 bg-[#121b2d] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Delivery resilience
              </div>
              <div className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-slate-100">
                Retry queue
              </div>
              {!compact ? (
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  Outbound delivery attempts that failed, are retrying, or need operator cleanup.
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-300 outline-none"
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
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {cards.map(([label, value]) => (
              <MetricPill key={label} label={label} value={value} />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Retry queue is temporarily unavailable."
            refreshLabel="Refresh retry queue"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-black/10">
          {surface.loading ? (
            <div className="p-6 text-sm text-slate-400">Loading queue...</div>
          ) : attempts.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No retry items.</div>
          ) : (
            <div className="divide-y divide-white/8">
              {attempts.map((item) => {
                const id = s(item?.id);
                const retryBusy = actionState.isActionPending(`retry:${id}`);
                const deadBusy = actionState.isActionPending(`dead:${id}`);
                const isBusy = retryBusy || deadBusy;

                return (
                  <div key={id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item?.status} />
                      <span className="text-xs text-slate-500">
                        attempts: {Number(item?.attempt_count || 0)} / {Number(item?.max_attempts || 0)}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-medium text-slate-100">
                      {s(item?.customer_name) ||
                        s(item?.external_username) ||
                        s(item?.external_user_id) ||
                        "Unknown recipient"}
                    </div>

                    <div className="mt-1 text-sm text-slate-300">
                      {s(item?.message_text) || "--"}
                    </div>

                    {s(item?.last_error) ? (
                      <div className="mt-2 text-xs text-rose-300">{s(item?.last_error)}</div>
                    ) : null}

                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div>Channel: {s(item?.channel) || "--"}</div>
                      <div>Next retry: {fmtDate(item?.next_retry_at)}</div>
                      <div>Provider: {s(item?.provider) || "--"}</div>
                    </div>

                    <div className="mt-3 flex items-start gap-2">
                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "sent"}
                        onClick={() => handleResend(id)}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {retryBusy ? "..." : "Retry"}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "dead"}
                        onClick={() => handleMarkDead(id)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
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
