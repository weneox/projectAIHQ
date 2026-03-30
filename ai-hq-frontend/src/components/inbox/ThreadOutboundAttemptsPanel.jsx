import { useEffect, useState } from "react";

import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import { useThreadOutboundAttemptsSurface } from "./hooks/useThreadOutboundAttemptsSurface.js";
import {
  describeAttemptState,
  getAttemptStatusTone,
} from "./outboundAttemptTruth.js";

function s(v) {
  return String(v ?? "").trim();
}

function fmtDate(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString();
}

function StatusBadge({ status }) {
  const value = s(status).toLowerCase();

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getAttemptStatusTone(
        value
      )}`}
    >
      {value || "unknown"}
    </span>
  );
}

function ThreadOutboundAttemptsPanelView({
  threadId,
  attempts,
  surface,
  actionState,
  handleResend,
  handleMarkDead,
  panelRef,
  attentionKey = 0,
}) {
  const [attentionVisible, setAttentionVisible] = useState(false);

  useEffect(() => {
    if (!attentionKey) return;
    setAttentionVisible(true);
    const timeoutId = window.setTimeout(() => {
      setAttentionVisible(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [attentionKey]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`rounded-[28px] border bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)] outline-none transition ${
        attentionVisible
          ? "border-violet-300 ring-2 ring-violet-200"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Delivery lineage
          </div>
          <div className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-slate-900">
            Thread Delivery Attempts
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-500">
            Per-attempt outbound lineage for the selected conversation. Queued, retrying, failed, dead, and sent stay distinct here.
          </div>
        </div>

        <button
          type="button"
          onClick={surface?.refresh}
          disabled={surface?.loading || surface?.saving || !threadId}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
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

      <div className="mt-5 rounded-[22px] border border-slate-200 bg-white">
        {!threadId ? (
          <div className="px-4 py-5 text-sm text-slate-500">No thread selected.</div>
        ) : surface?.loading ? (
          <div className="px-4 py-5 text-sm text-slate-500">Loading attempts...</div>
        ) : attempts.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-500">No delivery attempts for this thread.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {attempts.map((item) => {
              const id = s(item?.id);
              const state = describeAttemptState(item);
              const retryBusy = actionState?.isActionPending?.(`retry:${id}`);
              const deadBusy = actionState?.isActionPending?.(`dead:${id}`);
              const isBusy = retryBusy || deadBusy;

              return (
                <div key={id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item?.status} />
                    <span className="text-xs text-slate-400">
                      attempt {Number(item?.attempt_count || 0)}
                      {Number(item?.max_attempts || 0) > 0
                        ? ` of ${Number(item?.max_attempts || 0)}`
                        : ""}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {state.label}
                  </div>

                  <div className="mt-2 text-sm text-slate-700">
                    {s(item?.message_text) || "--"}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    {state.detail}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <div>State updated: {fmtDate(item?.updated_at)}</div>
                    <div>Next retry: {fmtDate(item?.next_retry_at)}</div>
                    <div>Provider: {s(item?.provider) || "--"}</div>
                    <div>Attempt ID: {id}</div>
                  </div>

                  {s(item?.last_error) ? (
                    <div className="mt-2 text-xs text-rose-600">{s(item?.last_error)}</div>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "sent"}
                      onClick={() => handleResend?.(id)}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {retryBusy ? "..." : "Retry"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "dead"}
                      onClick={() => handleMarkDead?.(id)}
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
  );
}

function ThreadOutboundAttemptsPanelManaged({
  selectedThread,
  actor = "operator",
  panelRef,
  attentionKey = 0,
}) {
  const threadId = s(selectedThread?.id);
  const managedSurface = useThreadOutboundAttemptsSurface({ threadId, actor });

  return (
    <ThreadOutboundAttemptsPanelView
      threadId={threadId}
      attempts={Array.isArray(managedSurface?.attempts) ? managedSurface.attempts : []}
      surface={managedSurface?.surface}
      actionState={managedSurface?.actionState}
      handleResend={managedSurface?.handleResend}
      handleMarkDead={managedSurface?.handleMarkDead}
      panelRef={panelRef}
      attentionKey={attentionKey}
    />
  );
}

export default function ThreadOutboundAttemptsPanel({
  selectedThread,
  actor = "operator",
  attemptsSurface = null,
  panelRef,
  attentionKey = 0,
}) {
  if (!attemptsSurface) {
    return (
      <ThreadOutboundAttemptsPanelManaged
        selectedThread={selectedThread}
        actor={actor}
        panelRef={panelRef}
        attentionKey={attentionKey}
      />
    );
  }

  return (
    <ThreadOutboundAttemptsPanelView
      threadId={s(selectedThread?.id)}
      attempts={Array.isArray(attemptsSurface?.attempts) ? attemptsSurface.attempts : []}
      surface={attemptsSurface?.surface}
      actionState={attemptsSurface?.actionState}
      handleResend={attemptsSurface?.handleResend}
      handleMarkDead={attemptsSurface?.handleMarkDead}
      panelRef={panelRef}
      attentionKey={attentionKey}
    />
  );
}
