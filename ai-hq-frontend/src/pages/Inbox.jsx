import { useEffect, useState } from "react";
import {
  Menu,
  MoreHorizontal,
  RefreshCw,
  Search,
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

function IconButton({ children, onClick, disabled = false, label = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || undefined}
      title={label || undefined}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-950 disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function hasSurfaceFeedback(surface) {
  const safe = surface && typeof surface === "object" ? surface : {};
  return Boolean(
    safe.unavailable ||
      safe.error ||
      safe.message ||
      safe.saveError ||
      safe.saveSuccess ||
      safe.successMessage ||
      safe.errorMessage ||
      safe.availability === "unavailable"
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

  const showTopBanner = hasSurfaceFeedback(surface);

  return (
    <section
      aria-labelledby="inbox-surface-title"
      aria-describedby="inbox-surface-description"
      className="min-h-[calc(100vh-48px)] bg-transparent"
    >
      <header className="sr-only">
        <h1 id="inbox-surface-title">Operator messaging workspace</h1>
        <p id="inbox-surface-description">
          Thread-first triage on the left, the live conversation in the center,
          and compact operational context on the right.
        </p>
        <p>{dbDisabled ? "Fallback mode" : "Live mode"}</p>
      </header>

      {showTopBanner ? (
        <div className="border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Inbox operations are temporarily unavailable."
            refreshLabel="Refresh inbox"
          />
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-48px)] xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:grid-rows-[68px_minmax(0,1fr)]">
        <div className="col-span-1 border-b border-r border-slate-200/70 bg-[#f7f8fa] xl:col-span-2 xl:row-start-1">
          <div className="flex h-[68px] items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <IconButton label="Inbox navigation">
                <Menu className="h-4 w-4" />
              </IconButton>

              <div className="relative w-full max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations"
                  aria-label="Search inbox"
                  className="h-11 w-full rounded-full border border-transparent bg-white pl-10 pr-4 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(100,116,139,0.22)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className="hidden rounded-full border border-slate-200/70 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 md:inline-flex">
                {wsState === "connected" ? "Realtime on" : `Realtime ${wsState || "idle"}`}
              </div>

              <IconButton
                onClick={surface?.refresh}
                disabled={surface?.loading || surface?.saving}
                label="Refresh inbox"
              >
                <RefreshCw className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        <div className="border-b border-l border-slate-200/70 bg-[#fbfbfc] xl:col-start-3 xl:row-start-1">
          <div className="flex h-[68px] items-center justify-between px-5">
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.02em] text-slate-950">
                Details
              </div>
              <div className="mt-0.5 text-[12px] text-slate-500">
                Conversation context
              </div>
            </div>

            <IconButton label="More detail actions">
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 border-r border-slate-200/70 bg-[#f7f8fa] xl:row-start-2">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
            searchQuery={searchQuery}
          />
        </div>

        <div className="min-h-0 bg-white xl:row-start-2">
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

        <div className="min-h-0 border-l border-slate-200/70 bg-[#fbfbfc] xl:row-start-2">
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
    </section>
  );
}