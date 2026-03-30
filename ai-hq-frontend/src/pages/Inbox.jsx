import { useEffect, useState } from "react";
import {
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import InboxComposer from "../components/inbox/InboxComposer.jsx";
import { useInboxComposerSurface } from "../components/inbox/hooks/useInboxComposerSurface.js";
import { useInboxThreadListSurface } from "../components/inbox/hooks/useInboxThreadListSurface.js";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxThreadListPanel from "../components/inbox/InboxThreadListPanel.jsx";
import { useThreadOutboundAttemptsSurface } from "../components/inbox/hooks/useThreadOutboundAttemptsSurface.js";
import SettingsSurfaceBanner from "../components/settings/SettingsSurfaceBanner.jsx";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";
import { getAppSessionContext } from "../lib/appSession.js";

function IconButton({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[#f3f4f6] hover:text-slate-950 disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
      {surface?.availability === "unavailable" || surface?.error ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Inbox operations are temporarily unavailable."
            refreshLabel="Refresh inbox"
          />
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-48px)] xl:grid-cols-[316px_minmax(0,1fr)_312px] xl:grid-rows-[64px_minmax(0,1fr)]">
        <div className="col-span-1 border-b border-r border-slate-200/80 xl:col-span-2 xl:row-start-1">
          <div className="flex h-16 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <IconButton>
                <Menu className="h-4 w-4" />
              </IconButton>

              <div className="relative w-full max-w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search inbox..."
                  className="h-11 w-full rounded-full border border-slate-200 bg-[#f4f5f7] pl-10 pr-4 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
              </div>

              <IconButton>
                <Star className="h-4 w-4" />
              </IconButton>

              <IconButton
                onClick={surface?.refresh}
                disabled={surface?.loading || surface?.saving}
              >
                <RefreshCw className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="hidden items-center gap-1 md:flex">
              <IconButton>
                <MessageSquare className="h-4 w-4" />
              </IconButton>
              <IconButton>
                <Mail className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="border-b border-l border-slate-200/80 xl:col-start-3 xl:row-start-1">
          <div className="flex h-16 items-center justify-between px-5">
            <div className="text-[14px] font-semibold tracking-[-0.02em] text-slate-950">
              Task Details
            </div>

            <div className="flex items-center gap-1">
              <IconButton>
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
              <IconButton>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="min-h-0 border-r border-slate-200/80 xl:row-start-2">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
            wsState={wsState}
            dbDisabled={dbDisabled}
            operatorName={operatorName}
            searchQuery={searchQuery}
          />
        </div>

        <div className="min-h-0 xl:row-start-2">
          <InboxDetailPanel
            selectedThread={selectedThread}
            messages={messages}
            outboundAttempts={threadAttemptSurface.attempts}
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

        <div className="min-h-0 border-l border-slate-200/80 xl:row-start-2">
          <InboxLeadPanel
            selectedThread={selectedThread}
            surface={leadSurface}
            relatedLead={relatedLead}
            openLeadDetail={openLeadDetail}
            operatorName={operatorName}
            tenantKey={tenantKey}
            wsState={wsState}
          />
        </div>
      </div>
    </div>
  );
}