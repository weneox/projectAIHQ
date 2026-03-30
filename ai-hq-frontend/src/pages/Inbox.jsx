import { useEffect, useRef, useState } from "react";
import { Bot, RefreshCw, UserRound, Waves } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import InboxComposer from "../components/inbox/InboxComposer.jsx";
import { useInboxComposerSurface } from "../components/inbox/hooks/useInboxComposerSurface.js";
import { useInboxThreadListSurface } from "../components/inbox/hooks/useInboxThreadListSurface.js";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxThreadListPanel from "../components/inbox/InboxThreadListPanel.jsx";
import RetryQueuePanel from "../components/inbox/RetryQueuePanel.jsx";
import ThreadOutboundAttemptsPanel from "../components/inbox/ThreadOutboundAttemptsPanel.jsx";
import { useThreadOutboundAttemptsSurface } from "../components/inbox/hooks/useThreadOutboundAttemptsSurface.js";
import SettingsSurfaceBanner from "../components/settings/SettingsSurfaceBanner.jsx";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import { areInternalRoutesEnabled } from "../lib/appEntry.js";
import { getAppSessionContext } from "../lib/appSession.js";

function StatusPill({ label, tone = "default" }) {
  const toneMap = {
    default: "border-white/10 bg-white/[0.03] text-slate-300",
    success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
    warn: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
        toneMap[tone] || toneMap.default,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SecondaryModule({ title, eyebrow = "", children }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121b2d]">
      <div className="border-b border-white/8 px-4 py-4">
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-slate-100">
          {title}
        </h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showInternalDebug = areInternalRoutesEnabled();
  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const lineagePanelRef = useRef(null);
  const [lineageAttentionKey, setLineageAttentionKey] = useState(0);
  const requestedThreadId = String(
    location.state?.selectedThreadId || searchParams.get("threadId") || ""
  ).trim();

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setTenantKey(String(next?.tenantKey || "").trim().toLowerCase());
        setOperatorName((prev) => prev || String(next?.actorName || "operator").trim());
      })
      .catch(() => {
        if (!alive) return;
        setOperatorName((prev) => prev || "operator");
      });

    return () => {
      alive = false;
    };
  }, []);

  const {
    threads,
    setThreads,
    messages,
    setMessages,
    selectedThread,
    setSelectedThread,
    relatedLead,
    setRelatedLead,
    dbDisabled,
    surface,
    detailSurface,
    leadSurface,
    actionState,
    loadThreads,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
    markRead,
    assignThread,
    activateHandoff,
    releaseHandoff,
    setThreadStatus,
    sendOperatorReply,
    openLeadDetail,
  } = useInboxData({ operatorName, navigate });

  const threadList = useInboxThreadListSurface({
    requestedThreadId,
    threads,
    selectedThread,
    setSelectedThread,
    surface,
    loadThreads,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
  });

  const {
    replyText,
    setReplyText,
    composerSurface,
    handleSend,
    handleRelease,
  } = useInboxComposerSurface({
    selectedThread,
    actionState,
    surface,
    sendOperatorReply,
    releaseHandoff,
  });

  const threadAttemptSurface = useThreadOutboundAttemptsSurface({
    threadId: selectedThread?.id || "",
    actor: operatorName || "operator",
  });

  useInboxRealtime({
    selectedThread,
    setWsState,
    setThreads,
    setSelectedThread,
    setMessages,
    loadThreads,
    loadThreadDetail,
    loadRelatedLead,
    setRelatedLead,
  });

  useEffect(() => {
    if (!requestedThreadId) return;
    setSearchParams(
      (prev) => {
        if (prev.get("threadId") === requestedThreadId) return prev;
        const next = new URLSearchParams(prev);
        next.set("threadId", requestedThreadId);
        return next;
      },
      { replace: true }
    );
  }, [requestedThreadId, setSearchParams]);

  useEffect(() => {
    if (selectedThread?.id) {
      loadMessages(selectedThread.id);
      loadRelatedLead(selectedThread.id);
    }
  }, [selectedThread?.id, loadMessages, loadRelatedLead]);

  const handleInspectLineage = ({ truthKind = "" } = {}) => {
    if (truthKind === "awaiting_attempt" || truthKind === "stale_attempt") {
      threadAttemptSurface.surface?.refresh?.();
    }

    setLineageAttentionKey(Date.now());
    const panel = lineagePanelRef.current;
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      panel.focus?.();
    }, 120);
  };

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#0c1424]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Inbox
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-white">
              Operator messaging workspace
            </h1>
            <p className="mt-2 max-w-[58rem] text-sm leading-6 text-slate-400">
              Thread-first triage on the left, the live conversation in the center,
              and compact operational context on the right.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={`WS ${wsState}`} />
            <StatusPill
              label={dbDisabled ? "Fallback mode" : "Live mode"}
              tone={dbDisabled ? "warn" : "success"}
            />
            <StatusPill label={operatorName || "operator"} />
            {surface?.refresh ? (
              <button
                type="button"
                onClick={surface.refresh}
                disabled={surface.loading || surface.saving}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12px] font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh inbox
              </button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/8 px-5 py-4">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Inbox operations are temporarily unavailable."
            refreshLabel="Refresh inbox"
          />
        </div>
      </section>

      <div className="grid min-h-[calc(100vh-220px)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
        <div className="min-h-0">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
            wsState={wsState}
            dbDisabled={dbDisabled}
            operatorName={operatorName}
          />
        </div>

        <div className="min-h-0">
          <InboxDetailPanel
            selectedThread={selectedThread}
            messages={messages}
            outboundAttempts={threadAttemptSurface.attempts}
            onInspectLineage={handleInspectLineage}
            surface={detailSurface}
            actionState={actionState}
            markRead={markRead}
            assignThread={assignThread}
            activateHandoff={activateHandoff}
            setThreadStatus={setThreadStatus}
            composer={
              <InboxComposer
                embedded
                selectedThread={selectedThread}
                surface={composerSurface}
                actionState={actionState}
                replyText={replyText}
                setReplyText={setReplyText}
                onSend={handleSend}
                onReleaseHandoff={handleRelease}
              />
            }
          />
        </div>

        <div className="min-h-0 space-y-4">
          <InboxLeadPanel
            selectedThread={selectedThread}
            surface={leadSurface}
            relatedLead={relatedLead}
            openLeadDetail={openLeadDetail}
          />

          <ThreadOutboundAttemptsPanel
            compact
            selectedThread={selectedThread}
            actor={operatorName || "operator"}
            attemptsSurface={threadAttemptSurface}
            panelRef={lineagePanelRef}
            attentionKey={lineageAttentionKey}
          />

          <RetryQueuePanel compact tenantKey={tenantKey} actor={operatorName || "operator"} />

          <SecondaryModule title="Operator notes" eyebrow="Placeholder">
            <div className="space-y-3">
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3.5 py-4 text-sm leading-6 text-slate-400">
                Conversation empty-state visual placeholder.
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-slate-300">
                <Bot className="h-4 w-4 text-slate-500" />
                AI assist modules will land here in a later Inbox pass.
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-slate-300">
                <Waves className="h-4 w-4 text-slate-500" />
                Channel-aware reply controls will live here.
              </div>
            </div>
          </SecondaryModule>

          {showInternalDebug ? (
            <SecondaryModule title="Thread meta" eyebrow="Internal only">
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-3.5 py-4">
                {selectedThread ? (
                  <pre className="overflow-auto text-xs leading-6 text-slate-300">
                    {JSON.stringify(selectedThread, null, 2)}
                  </pre>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <UserRound className="h-4 w-4" />
                    No thread selected.
                  </div>
                )}
              </div>
            </SecondaryModule>
          ) : null}
        </div>
      </div>
    </div>
  );
}
