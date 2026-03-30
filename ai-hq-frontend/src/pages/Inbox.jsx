import { useEffect, useMemo, useRef, useState } from "react";
import { UserRound } from "lucide-react";
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

function shellSection() {
  return "rounded-[32px] border border-[#ece2d3] bg-[#fffdf9]/92 shadow-[0_18px_44px_rgba(120,102,73,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]";
}

function QuietMetric({ label, value, tone = "neutral" }) {
  const toneMap = {
    neutral: "border-[#ece2d3] bg-[#fffdfa] text-stone-900",
    warm: "border-[#e7d7ba] bg-[#faf3e6] text-stone-900",
    soft: "border-[#e4eadf] bg-[#f6faf4] text-stone-900",
  };

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneMap[tone] || toneMap.neutral}`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">{value}</div>
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
  const requestedThreadId = String(location.state?.selectedThreadId || searchParams.get("threadId") || "").trim();

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

  return (
    <div className="mx-auto max-w-[1240px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className={`${shellSection()} overflow-hidden px-6 py-6 sm:px-7 sm:py-7`}>
        <div className="pointer-events-none absolute" />
        <div className="space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                Conversation Work
              </div>
              <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.05em] text-stone-950">
                Inbox
              </h1>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">
                See what needs attention, which threads need human review, and what the system is already handling.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[#e7dece] bg-[#fffaf4] px-3 py-2 text-[12px] text-stone-600">
                Operator:
                <input
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="ml-2 w-[100px] bg-transparent text-stone-900 outline-none placeholder:text-stone-400"
                  placeholder="Name"
                />
              </div>

              <div className="rounded-full border border-[#e7dece] bg-[#fffaf4] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                WS: {wsState}
              </div>

              {dbDisabled ? (
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-800">
                  DB disabled
                </div>
              ) : null}

              {surface?.refresh ? (
                <button
                  type="button"
                  onClick={surface.refresh}
                  disabled={surface.loading || surface.saving}
                  className="rounded-full border border-[#dfcfb2] bg-[#efe0c0] px-4 py-2 text-sm font-medium text-stone-900 transition hover:border-[#d4bf99] hover:bg-[#ead7b2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh inbox
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <QuietMetric label="Open conversations" value={pageSummary.openCount} />
            <QuietMetric label="Waiting for handoff" value={pageSummary.handoffCount} tone="warm" />
            <QuietMetric label="Unread pressure" value={pageSummary.unreadCount} tone="soft" />
          </div>

          <div className="rounded-[22px] border border-[#ece2d3] bg-[#fffdfa] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              What this surface is for
            </div>
            <div className="mt-2 text-sm leading-6 text-stone-600">
              Start with the thread list, review handoff and unread pressure, then move into conversation detail to understand why a thread matters and what to do next.
            </div>
          </div>

          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Inbox operations are temporarily unavailable."
            refreshLabel="Refresh inbox"
          />
        </div>
      </section>

      <InboxThreadListPanel threadList={threadList} selectedThreadId={selectedThread?.id || ""} />

      <RetryQueuePanel tenantKey={tenantKey} actor={operatorName || "operator"} />

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
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

          <ThreadOutboundAttemptsPanel
            selectedThread={selectedThread}
            actor={operatorName || "operator"}
            attemptsSurface={threadAttemptSurface}
            panelRef={lineagePanelRef}
            attentionKey={lineageAttentionKey}
          />

          {showInternalDebug ? (
            <div className={`${shellSection()} px-5 py-5`}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8decf] bg-[#fffaf4]">
                  <UserRound className="h-4 w-4 text-stone-600" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold tracking-[-0.03em] text-stone-900">Thread Meta</div>
                  <div className="mt-1 text-sm text-stone-500">Raw visibility data for internal operator debugging.</div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-dashed border-[#ece2d3] bg-[#fffdfa] px-4 py-4">
                {selectedThread ? (
                  <pre className="overflow-auto text-xs leading-6 text-stone-600">{JSON.stringify(selectedThread, null, 2)}</pre>
                ) : (
                  <div className="text-sm text-stone-500">No thread selected.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <InboxLeadPanel
            selectedThread={selectedThread}
            surface={leadSurface}
            relatedLead={relatedLead}
            openLeadDetail={openLeadDetail}
          />
        </div>
      </div>
    </div>
  );
}
