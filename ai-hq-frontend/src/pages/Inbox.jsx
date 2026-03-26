import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import InboxComposer from "../components/inbox/InboxComposer.jsx";
import { useInboxComposerSurface } from "../components/inbox/hooks/useInboxComposerSurface.js";
import { useInboxThreadListSurface } from "../components/inbox/hooks/useInboxThreadListSurface.js";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxThreadListPanel from "../components/inbox/InboxThreadListPanel.jsx";
import RetryQueuePanel from "../components/inbox/RetryQueuePanel.jsx";
import ThreadOutboundAttemptsPanel from "../components/inbox/ThreadOutboundAttemptsPanel.jsx";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import { areInternalRoutesEnabled } from "../lib/appEntry.js";
import { getAppSessionContext } from "../lib/appSession.js";

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showInternalDebug = areInternalRoutesEnabled();
  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
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

  return (
    <AdminPageShell
      eyebrow="Operator inbox"
      title="Inbox"
      description="DM triage, operator handoff, and AI reply workflow."
      surface={surface}
      refreshLabel="Refresh inbox"
      unavailableMessage="Inbox operations are temporarily unavailable."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/72">
            Operator:
            <input
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="ml-2 w-[100px] bg-transparent text-white outline-none placeholder:text-white/25"
              placeholder="Name"
            />
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/60">
            WS: {wsState}
          </div>

          {dbDisabled ? (
            <div className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-100">
              DB disabled
            </div>
          ) : null}
        </div>
      }
    >
      <InboxThreadListPanel threadList={threadList} selectedThreadId={selectedThread?.id || ""} />

      <RetryQueuePanel tenantKey={tenantKey} actor={operatorName || "operator"} className="mt-6" />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <InboxDetailPanel
            selectedThread={selectedThread}
            messages={messages}
            surface={detailSurface}
            actionState={actionState}
            markRead={markRead}
            assignThread={assignThread}
            activateHandoff={activateHandoff}
            releaseHandoff={releaseHandoff}
            setThreadStatus={setThreadStatus}
          />

          <InboxLeadPanel selectedThread={selectedThread} surface={leadSurface} relatedLead={relatedLead} openLeadDetail={openLeadDetail} />

          <InboxComposer
            selectedThread={selectedThread}
            surface={composerSurface}
            actionState={actionState}
            replyText={replyText}
            setReplyText={setReplyText}
            onSend={handleSend}
            onReleaseHandoff={handleRelease}
          />

          <ThreadOutboundAttemptsPanel selectedThread={selectedThread} actor={operatorName || "operator"} />

          {showInternalDebug ? (
            <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <UserRound className="h-4 w-4 text-white/72" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">Thread Meta</div>
                  <div className="mt-1 text-sm text-white/46">Raw visibility data for internal operator debugging.</div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/20 px-4 py-4">
                {selectedThread ? (
                  <pre className="overflow-auto text-xs leading-6 text-white/58">{JSON.stringify(selectedThread, null, 2)}</pre>
                ) : (
                  <div className="text-sm text-white/46">No thread selected.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminPageShell>
  );
}
