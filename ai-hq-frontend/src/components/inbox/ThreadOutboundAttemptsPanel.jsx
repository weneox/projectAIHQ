import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import { useThreadOutboundAttemptsSurface } from "./hooks/useThreadOutboundAttemptsSurface.js";

function s(v) {
  return String(v ?? "").trim();
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function describeAttemptState(item = {}) {
  const status = s(item?.status).toLowerCase();
  const attemptCount = Number(item?.attempt_count || 0);
  const maxAttempts = Number(item?.max_attempts || 0);

  if (status === "queued") {
    return {
      label: "Queued locally",
      detail: "Accepted into the outbound queue. Provider delivery has not completed yet.",
    };
  }

  if (status === "sending") {
    return {
      label: "Send in progress",
      detail: "An outbound attempt is actively trying to hand off to the provider.",
    };
  }

  if (status === "sent") {
    return {
      label: "Sent",
      detail:
        attemptCount > 0
          ? `Delivery succeeded on attempt ${attemptCount}${maxAttempts > 0 ? ` of ${maxAttempts}` : ""}.`
          : "Delivery succeeded.",
    };
  }

  if (status === "failed") {
    return {
      label: "Failed",
      detail:
        attemptCount > 0
          ? `Most recent delivery attempt failed${maxAttempts > 0 ? ` on attempt ${attemptCount} of ${maxAttempts}.` : "."}`
          : "Most recent delivery attempt failed.",
    };
  }

  if (status === "retrying") {
    return {
      label: "Retrying",
      detail:
        attemptCount > 0
          ? `Retry lineage is active after attempt ${attemptCount}${maxAttempts > 0 ? ` of ${maxAttempts}` : ""}.`
          : "Retry lineage is active for this outbound delivery.",
    };
  }

  if (status === "dead") {
    return {
      label: "Dead",
      detail:
        maxAttempts > 0
          ? `Automatic delivery stopped after ${attemptCount || maxAttempts} of ${maxAttempts} attempts.`
          : "Automatic delivery stopped. Operator cleanup is required.",
    };
  }

  return {
    label: status || "Unknown",
    detail: "The backend reported an outbound attempt state the UI does not recognize yet.",
  };
}

function StatusBadge({ status }) {
  const x = s(status).toLowerCase();

  const map = {
    queued: "bg-stone-100 text-stone-700 border-stone-200",
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

export default function ThreadOutboundAttemptsPanel({
  selectedThread,
  actor = "operator",
}) {
  const threadId = s(selectedThread?.id);
  const { attempts, surface, actionState, handleResend, handleMarkDead } =
    useThreadOutboundAttemptsSurface({ threadId, actor });

  return (
    <div className="rounded-[30px] border border-[#ece2d3] bg-[#fffdf9]/92 p-5 shadow-[0_18px_44px_rgba(120,102,73,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-stone-900">
            Thread Delivery Attempts
          </div>
          <div className="mt-1 text-sm text-stone-500">
            Per-attempt outbound lineage for the selected conversation. Queued, retrying, failed, dead, and sent stay distinct here.
          </div>
        </div>

        <button
          type="button"
          onClick={surface.refresh}
          disabled={surface.loading || surface.saving || !threadId}
          className="rounded-xl border border-[#e8decf] bg-[#fffaf4] px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Thread delivery attempts are temporarily unavailable."
          refreshLabel="Refresh attempts"
        />
      </div>

      <div className="mt-5 rounded-[22px] border border-[#ece2d3] bg-[#fffdfa]">
        {!threadId ? (
          <div className="px-4 py-5 text-sm text-stone-500">No thread selected.</div>
        ) : surface.loading ? (
          <div className="px-4 py-5 text-sm text-stone-500">Loading attempts...</div>
        ) : attempts.length === 0 ? (
          <div className="px-4 py-5 text-sm text-stone-500">No delivery attempts for this thread.</div>
        ) : (
          <div className="divide-y divide-[#ece2d3]">
            {attempts.map((item) => {
              const id = s(item?.id);
              const state = describeAttemptState(item);
              const retryBusy = actionState.isActionPending(`retry:${id}`);
              const deadBusy = actionState.isActionPending(`dead:${id}`);
              const isBusy = retryBusy || deadBusy;

              return (
                <div key={id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item?.status} />
                    <span className="text-xs text-stone-400">
                      attempt {Number(item?.attempt_count || 0)}
                      {Number(item?.max_attempts || 0) > 0
                        ? ` of ${Number(item?.max_attempts || 0)}`
                        : ""}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-medium text-stone-900">
                    {state.label}
                  </div>

                  <div className="mt-2 text-sm text-stone-700">
                    {s(item?.message_text) || "—"}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-stone-500">
                    {state.detail}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-stone-500 md:grid-cols-2">
                    <div>State updated: {fmtDate(item?.updated_at)}</div>
                    <div>Next retry: {fmtDate(item?.next_retry_at)}</div>
                    <div>Provider: {s(item?.provider) || "—"}</div>
                    <div>Attempt ID: {id}</div>
                  </div>

                  {s(item?.last_error) ? (
                    <div className="mt-2 text-xs text-rose-600">{s(item?.last_error)}</div>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "sent"}
                      onClick={() => handleResend(id)}
                      className="rounded-xl border border-[#dfcfb2] bg-[#efe0c0] px-3 py-2 text-sm font-medium text-stone-900 transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {retryBusy ? "..." : "Retry"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "dead"}
                      onClick={() => handleMarkDead(id)}
                      className="rounded-xl border border-[#e8decf] bg-[#fffaf4] px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}
