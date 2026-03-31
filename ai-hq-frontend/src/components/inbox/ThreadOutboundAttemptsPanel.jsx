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
  compact = false,
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
      className={`rounded-[28px] border bg-[#121b2d] p-4 outline-none transition ${
        attentionVisible ? "border-violet-400/30 ring-2 ring-violet-400/20" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Delivery lineage
          </div>
          <div className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-slate-100">
            Thread attempts
          </div>
          {!compact ? (
            <div className="mt-1 text-sm leading-6 text-slate-400">
              Per-attempt outbound lineage for the selected conversation.
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={surface?.refresh}
          disabled={surface?.loading || surface?.saving || !threadId}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <SettingsSurfaceBanner
        surface={surface}
        unavailableMessage="Thread delivery attempts are temporarily unavailable."
        refreshLabel="Refresh attempts"
      />

      <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10">
        {!threadId ? (
          <div className="px-4 py-5 text-sm text-slate-400">No thread selected.</div>
        ) : surface?.loading ? (
          <div className="px-4 py-5 text-sm text-slate-400">Loading attempts...</div>
        ) : attempts.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-400">No delivery attempts for this thread.</div>
        ) : (
          <div className="divide-y divide-white/8">
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
                    <span className="text-xs text-slate-500">
                      attempt {Number(item?.attempt_count || 0)}
                      {Number(item?.max_attempts || 0) > 0
                        ? ` of ${Number(item?.max_attempts || 0)}`
                        : ""}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-medium text-slate-100">
                    {state.label}
                  </div>

                  <div className="mt-2 text-sm text-slate-300">
                    {s(item?.message_text) || "--"}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    {state.detail}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-slate-500">
                    <div>State updated: {fmtDate(item?.updated_at)}</div>
                    <div>Next retry: {fmtDate(item?.next_retry_at)}</div>
                    <div>Provider: {s(item?.provider) || "--"}</div>
                  </div>

                  {s(item?.last_error) ? (
                    <div className="mt-2 text-xs text-rose-300">{s(item?.last_error)}</div>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "sent"}
                      onClick={() => handleResend?.(id)}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {retryBusy ? "..." : "Retry"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || s(item?.status) === "dead"}
                      onClick={() => handleMarkDead?.(id)}
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
  );
}

function ThreadOutboundAttemptsPanelManaged({
  selectedThread,
  actor = "operator",
  panelRef,
  attentionKey = 0,
  compact = false,
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
      compact={compact}
    />
  );
}

export default function ThreadOutboundAttemptsPanel({
  selectedThread,
  actor = "operator",
  attemptsSurface = null,
  panelRef,
  attentionKey = 0,
  compact = false,
}) {
  if (!attemptsSurface) {
    return (
      <ThreadOutboundAttemptsPanelManaged
        selectedThread={selectedThread}
        actor={actor}
        panelRef={panelRef}
        attentionKey={attentionKey}
        compact={compact}
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
      compact={compact}
    />
  );
}
