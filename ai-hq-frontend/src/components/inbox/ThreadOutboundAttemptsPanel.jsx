import { useEffect, useState } from "react";
import {
  listThreadOutboundAttempts,
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

export default function ThreadOutboundAttemptsPanel({
  selectedThread,
  actor = "operator",
}) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const threadId = s(selectedThread?.id);

  async function load() {
    if (!threadId) {
      setAttempts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await listThreadOutboundAttempts(threadId, { limit: 30 });
      setAttempts(Array.isArray(res?.attempts) ? res.attempts : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [threadId]);

  useEffect(() => {
    const onRefresh = (ev) => {
      const evThreadId = s(ev?.detail?.threadId);
      if (!threadId) return;
      if (!evThreadId || evThreadId === threadId) {
        load();
      }
    };

    window.addEventListener("inbox:retry-queue-refresh", onRefresh);
    return () => {
      window.removeEventListener("inbox:retry-queue-refresh", onRefresh);
    };
  }, [threadId]);

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
    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
            Thread Delivery Attempts
          </div>
          <div className="mt-1 text-sm text-white/46">
            Seçilmiş thread üçün outbound send vəziyyəti.
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-[22px] border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20">
        {!threadId ? (
          <div className="px-4 py-5 text-sm text-white/46">No thread selected.</div>
        ) : loading ? (
          <div className="px-4 py-5 text-sm text-white/52">Loading attempts...</div>
        ) : attempts.length === 0 ? (
          <div className="px-4 py-5 text-sm text-white/46">No delivery attempts for this thread.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {attempts.map((item) => {
              const id = s(item?.id);
              const isBusy = busyId === id;

              return (
                <div key={id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item?.status} />
                    <span className="text-xs text-white/42">
                      attempts: {Number(item?.attempt_count || 0)} / {Number(item?.max_attempts || 0)}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-white/80">
                    {s(item?.message_text) || "—"}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-white/46 md:grid-cols-2">
                    <div>Updated: {fmtDate(item?.updated_at)}</div>
                    <div>Next retry: {fmtDate(item?.next_retry_at)}</div>
                    <div>Provider: {s(item?.provider) || "—"}</div>
                    <div>Attempt ID: {id}</div>
                  </div>

                  {s(item?.last_error) ? (
                    <div className="mt-2 text-xs text-rose-300">{s(item?.last_error)}</div>
                  ) : null}

                  <div className="mt-3 flex gap-2">
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
  );
}