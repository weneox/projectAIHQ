import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  RefreshCw,
  UserRound,
  Waves,
} from "lucide-react";
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
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import { areInternalRoutesEnabled } from "../lib/appEntry.js";
import { getAppSessionContext } from "../lib/appSession.js";
import SettingsSurfaceBanner from "../components/settings/SettingsSurfaceBanner.jsx";

function SurfaceShell({
  title,
  eyebrow = "",
  description = "",
  actions = null,
  children,
  className = "",
}) {
  return (
    <section
      className={[
        "min-h-0 rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_18px_40px_rgba(15,23,42,0.04)]",
        className,
      ].join(" ")}
    >
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {eyebrow}
              </div>
            ) : null}
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-[52ch] text-[13px] leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className="min-h-0">{children}</div>
    </section>
  );
}

function CompactMetric({ label, value, tone = "default" }) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    muted: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClasses[tone] || toneClasses.default}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">
        {value}
      </div>
    </div>
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

  const pageSummary = useMemo(() => {
    const openCount = threads.filter((thread) => {
      const status = String(thread?.status || "open").toLowerCase();
      return status !== "resolved" && status !== "closed";
    }).length;
    const handoffCount = threads.filter((thread) => Boolean(thread?.handoff_active)).length;
    const unreadCount = threads.reduce(
      (sum, thread) => sum + Number(thread?.unread_count || 0),
      0
    );

    return {
      openCount,
      handoffCount,
      unreadCount,
    };
  }, [threads]);

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

  const conversationActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        WS {wsState}
      </div>
      {dbDisabled ? (
        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-800">
          DB disabled
        </div>
      ) : null}
      {surface?.refresh ? (
        <button
          type="button"
          onClick={surface.refresh}
          disabled={surface.loading || surface.saving}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh inbox
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <SurfaceShell
        title="Inbox"
        eyebrow="Conversation workspace"
        description="A calmer operator queue on the left, a large conversation canvas in the center, and a quiet intelligence rail on the right."
        actions={conversationActions}
      >
        <div className="grid gap-3 border-b border-slate-200/80 px-5 py-4 md:grid-cols-3 xl:grid-cols-5">
          <CompactMetric label="Open" value={pageSummary.openCount} />
          <CompactMetric label="Unread" value={pageSummary.unreadCount} />
          <CompactMetric label="Handoff" value={pageSummary.handoffCount} tone="warning" />
          <CompactMetric label="Operator" value={operatorName || "operator"} tone="muted" />
          <CompactMetric label="Channel mode" value={dbDisabled ? "Fallback" : "Live"} tone={dbDisabled ? "warning" : "muted"} />
        </div>

        <div className="px-5 py-4">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Inbox operations are temporarily unavailable."
            refreshLabel="Refresh inbox"
          />
        </div>
      </SurfaceShell>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="min-h-0">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
          />
        </div>

        <div className="min-h-0 space-y-6">
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
            releaseHandoff={releaseHandoff}
            setThreadStatus={setThreadStatus}
          />

          <InboxComposer
            selectedThread={selectedThread}
            surface={composerSurface}
            actionState={actionState}
            replyText={replyText}
            setReplyText={setReplyText}
            onSend={handleSend}
            onReleaseHandoff={handleRelease}
          />

          {showInternalDebug ? (
            <SurfaceShell
              title="Thread meta"
              eyebrow="Internal only"
              description="Temporary diagnostic visibility for operator debugging."
            >
              <div className="px-5 py-4">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                  {selectedThread ? (
                    <pre className="overflow-auto text-xs leading-6 text-slate-600">
                      {JSON.stringify(selectedThread, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <UserRound className="h-4 w-4" />
                      No thread selected.
                    </div>
                  )}
                </div>
              </div>
            </SurfaceShell>
          ) : null}
        </div>

        <div className="min-h-0 space-y-6">
          <InboxLeadPanel
            selectedThread={selectedThread}
            surface={leadSurface}
            relatedLead={relatedLead}
            openLeadDetail={openLeadDetail}
          />

          <ThreadOutboundAttemptsPanel
            selectedThread={selectedThread}
            actor={operatorName || "operator"}
            attemptsSurface={threadAttemptSurface}
            panelRef={lineagePanelRef}
            attentionKey={lineageAttentionKey}
          />

          <RetryQueuePanel tenantKey={tenantKey} actor={operatorName || "operator"} />

          <SurfaceShell
            title="Operator notes"
            eyebrow="Placeholder"
            description="Customer intelligence block placeholder. Suggested replies, notes, and AI assist modules will live here in a later Inbox pass."
          >
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                Conversation empty-state visual placeholder.
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <Bot className="h-4 w-4 text-slate-400" />
                AI assist / operator controls will live here.
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <Waves className="h-4 w-4 text-slate-400" />
                Suggested replies module placeholder.
              </div>
            </div>
          </SurfaceShell>
        </div>
      </div>
    </div>
  );
}
