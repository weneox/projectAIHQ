import { useEffect, useMemo, useState } from "react";
import {
  getOutboundSummary,
  listFailedOutboundAttempts,
  resendOutboundAttempt,
  markOutboundAttemptDead,
} from "../../api/inbox.js";

function s(v) {
  return String(v ?? "").trim();
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const x = s(status).toLowerCase();

  const map = {
    queued:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/10",
    sending:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    sent:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    failed:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    retrying:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
    dead:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
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
  const [summary, setSummary] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [sumRes, failedRes] = await Promise.all([
        getOutboundSummary({ tenantKey }),
        listFailedOutboundAttempts({
          tenantKey,
          limit: 50,
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);

      setSummary(sumRes?.summary || null);
      setAttempts(Array.isArray(failedRes?.attempts) ? failedRes.attempts : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantKey, statusFilter]);

  useEffect(() => {
    const onRefresh = () => {
      load();
    };

    window.addEventListener("inbox:retry-queue-refresh", onRefresh);
    return () => {
      window.removeEventListener("inbox:retry-queue-refresh", onRefresh);
    };
  }, [tenantKey, statusFilter]);

  const cards = useMemo(
    () => [
      ["Queued", Number(summary?.queued || 0)],
      ["Sending", Number(summary?.sending || 0)],
      ["Failed", Number(summary?.failed || 0)],
      ["Retrying", Number(summary?.retrying || 0)],
      ["Dead", Number(summary?.dead || 0)],
      ["Sent", Number(summary?.sent || 0)],
    ],
    [summary]
  );

  async function handleResend(attemptId) {
    if (!attemptId) return;
    setBusyId(attemptId);
    setError("");

    try {
      await resendOutboundAttempt(attemptId, {
        actor,
        retryDelaySeconds: 0,
      });
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId("");
    }
  }

  async function handleMarkDead(attemptId) {
    if (!attemptId) return;
    setBusyId(attemptId);
    setError("");

    try {
      await markOutboundAttemptDead(attemptId, { actor });
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={className}>
      <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
              Retry Queue
            </div>
            <div className="mt-1 text-sm text-white/46">
              Outbound failed / retrying / dead delivery attempts
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 outline-none"
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
              onClick={load}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08]"
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

        {error ? (
          <div className="mt-4 rounded-[22px] border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
          {loading ? (
            <div className="p-6 text-sm text-white/52">Loading queue...</div>
          ) : attempts.length === 0 ? (
            <div className="p-6 text-sm text-white/46">No retry items.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {attempts.map((item) => {
                const id = s(item?.id);
                const isBusy = busyId === id;

                return (
                  <div
                    key={id}
                    className="grid gap-4 p-4 xl:grid-cols-[1.2fr_1fr_0.8fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={item?.status} />
                        <span className="text-xs text-white/42">
                          attempts: {Number(item?.attempt_count || 0)} /{" "}
                          {Number(item?.max_attempts || 0)}
                        </span>
                      </div>

                      <div className="mt-2 truncate text-sm font-medium text-white">
                        {s(item?.customer_name) ||
                          s(item?.external_username) ||
                          s(item?.external_user_id) ||
                          "Unknown recipient"}
                      </div>

                      <div className="mt-1 text-sm text-white/62">
                        {s(item?.message_text) || "—"}
                      </div>

                      {s(item?.last_error) ? (
                        <div className="mt-2 text-xs text-rose-300">
                          {s(item?.last_error)}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-sm text-white/56">
                      <div>
                        <span className="text-white/34">Channel:</span>{" "}
                        {s(item?.channel) || "—"}
                      </div>
                      <div className="mt-1">
                        <span className="text-white/34">Next retry:</span>{" "}
                        {fmtDate(item?.next_retry_at)}
                      </div>
                      <div className="mt-1">
                        <span className="text-white/34">Updated:</span>{" "}
                        {fmtDate(item?.updated_at)}
                      </div>
                    </div>

                    <div className="text-sm text-white/56">
                      <div>
                        <span className="text-white/34">Provider:</span>{" "}
                        {s(item?.provider) || "—"}
                      </div>
                      <div className="mt-1 break-all">
                        <span className="text-white/34">Attempt ID:</span>{" "}
                        {id}
                      </div>
                    </div>

                    <div className="flex items-start justify-start gap-2 xl:justify-end">
                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "sent"}
                        onClick={() => handleResend(id)}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-900 transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBusy ? "..." : "Retry"}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || s(item?.status) === "dead"}
                        onClick={() => handleMarkDead(id)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Dead
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