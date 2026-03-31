import { useEffect, useState } from "react";
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

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const requestedThreadId = String(
    location.state?.selectedThreadId || searchParams.get("threadId") || ""
  ).trim();

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setTenantKey(String(next?.tenantKey || "").trim().toLowerCase());
        setOperatorName(
          (prev) => prev || String(next?.actorName || "operator").trim()
        );
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

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setDetailOpen(false);
    }

    if (!detailOpen) return undefined;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen]);

  const showTopBanner = shouldRenderSurfaceBanner(surface);

  return (
    <section
      aria-labelledby="inbox-surface-title"
      aria-describedby="inbox-surface-description"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <header className="sr-only">
        <h1 id="inbox-surface-title">Operator messaging workspace</h1>
        <p id="inbox-surface-description">
          Thread-first triage on the left and the live conversation on the
          right, with details opening as an overlay drawer.
        </p>
        <p>{dbDisabled ? "Fallback mode" : "Live mode"}</p>
      </header>

      {showTopBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
          <div className="pointer-events-auto w-full max-w-[920px]">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Inbox operations are temporarily unavailable."
              refreshLabel="Refresh inbox"
            />
          </div>
        </div>
      ) : null}

      <div className="relative grid flex-1 min-h-0 overflow-hidden grid-cols-[344px_minmax(0,1fr)] bg-[#f6f6f7]">
        <div className="min-h-0 overflow-hidden border-r border-slate-200/80 bg-[#f6f6f7]">
          <InboxThreadListPanel
            threadList={threadList}
            selectedThreadId={selectedThread?.id || ""}
            searchQuery=""
          />
        </div>

        <div className="min-h-0 overflow-hidden bg-[#f6f6f7]">
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
            onOpenDetails={() => setDetailOpen(true)}
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

        <div
          className={[
            "absolute inset-0 z-30 transition",
            detailOpen ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          <div
            onClick={() => setDetailOpen(false)}
            className={[
              "absolute inset-0 bg-slate-950/10 transition-opacity duration-200",
              detailOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          <aside
            className={[
              "absolute inset-y-0 right-0 w-[360px] max-w-[92vw] border-l border-slate-200/80 bg-[#fbfbfc] shadow-[0_18px_60px_rgba(15,23,42,0.18)] transition-transform duration-200",
              detailOpen ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
          >
            <InboxLeadPanel
              selectedThread={selectedThread}
              surface={leadSurface}
              relatedLead={relatedLead}
              openLeadDetail={openLeadDetail}
              operatorName={operatorName}
              tenantKey={tenantKey}
              wsState={wsState}
              onClose={() => setDetailOpen(false)}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}