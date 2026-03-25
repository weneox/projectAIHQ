import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";

import { deriveThreadState } from "../lib/inbox-ui.js";
import { useInboxData } from "../hooks/useInboxData.js";
import { useInboxRealtime } from "../hooks/useInboxRealtime.js";

import InboxStatCard from "../components/inbox/InboxStatCard.jsx";
import InboxThreadCard from "../components/inbox/InboxThreadCard.jsx";
import InboxToolbar from "../components/inbox/InboxToolbar.jsx";
import InboxDetailPanel from "../components/inbox/InboxDetailPanel.jsx";
import InboxLeadPanel from "../components/inbox/InboxLeadPanel.jsx";
import InboxComposer from "../components/inbox/InboxComposer.jsx";
import RetryQueuePanel from "../components/inbox/RetryQueuePanel.jsx";
import ThreadOutboundAttemptsPanel from "../components/inbox/ThreadOutboundAttemptsPanel.jsx";

import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getAppSessionContext } from "../lib/appSession.js";
import { areInternalRoutesEnabled } from "../lib/appEntry.js";

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showInternalDebug = areInternalRoutesEnabled();
  const [filter, setFilter] = useState("all");
  const [wsState, setWsState] = useState("idle");
  const [tenantKey, setTenantKey] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [replyText, setReplyText] = useState("");
  const [deepLinkNotice, setDeepLinkNotice] = useState("");
  const requestedThreadId = String(
    location.state?.selectedThreadId || searchParams.get("threadId") || ""
  ).trim();
  const [pendingThreadId, setPendingThreadId] = useState(requestedThreadId);

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
    loadingThreads,
    loadingMessages,
    loadingLead,
    busyAction,
    error,
    dbDisabled,
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
  } = useInboxData({ filter, operatorName, navigate });

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
    setPendingThreadId(requestedThreadId);
    if (!requestedThreadId) {
      setDeepLinkNotice("");
    }
  }, [requestedThreadId]);

  useEffect(() => {
    loadThreads(pendingThreadId || requestedThreadId);
  }, [loadThreads, pendingThreadId, requestedThreadId]);

  useEffect(() => {
    if (!pendingThreadId || loadingThreads) {
      return;
    }

    const matchingThread = threads.find(
      (thread) => String(thread?.id || "") === pendingThreadId
    );

    if (matchingThread) {
      if (selectedThread?.id !== matchingThread.id) {
        setSelectedThread(matchingThread);
      }
      setDeepLinkNotice("");
      setPendingThreadId("");
      return;
    }

    let cancelled = false;

    async function hydrateRequestedThread() {
      try {
        await Promise.all([
          loadThreadDetail(pendingThreadId),
          loadMessages(pendingThreadId),
          loadRelatedLead(pendingThreadId),
        ]);

        if (cancelled) return;

        setSelectedThread((current) => {
          if (String(current?.id || "") === pendingThreadId) {
            setDeepLinkNotice("");
            setPendingThreadId("");
            return current;
          }
          setDeepLinkNotice("The requested inbox thread is no longer available.");
          setPendingThreadId("");
          return current;
        });
      } catch {
        if (!cancelled) {
          setDeepLinkNotice("The requested inbox thread could not be opened.");
          setPendingThreadId("");
        }
      }
    }

    hydrateRequestedThread();

    return () => {
      cancelled = true;
    };
  }, [
    pendingThreadId,
    loadingThreads,
    threads,
    selectedThread?.id,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
    setSelectedThread,
  ]);

  useEffect(() => {
    if (!requestedThreadId) return;
    setSearchParams((prev) => {
      if (prev.get("threadId") === requestedThreadId) return prev;
      const next = new URLSearchParams(prev);
      next.set("threadId", requestedThreadId);
      return next;
    }, { replace: true });
  }, [requestedThreadId, setSearchParams]);

  useEffect(() => {
    if (selectedThread?.id) {
      loadMessages(selectedThread.id);
      loadRelatedLead(selectedThread.id);
    }
  }, [selectedThread?.id, loadMessages, loadRelatedLead]);

  const filteredThreads = useMemo(() => {
    if (filter === "handoff") {
      return threads.filter((t) => Boolean(t.handoff_active));
    }
    if (filter === "open") {
      return threads.filter((t) => deriveThreadState(t) === "open");
    }
    if (filter === "assigned") {
      return threads.filter((t) => deriveThreadState(t) === "assigned");
    }
    if (filter === "resolved") {
      return threads.filter((t) => {
        const s = deriveThreadState(t);
        return s === "resolved" || s === "closed";
      });
    }
    return threads;
  }, [threads, filter]);

  const stats = useMemo(() => {
    let open = 0;
    let aiActive = 0;
    let handoff = 0;
    let resolved = 0;

    for (const t of threads) {
      const s = deriveThreadState(t);
      if (s === "open") open += 1;
      else if (s === "ai_active") aiActive += 1;
      else if (s === "handoff" || s === "assigned") handoff += 1;
      else if (s === "resolved" || s === "closed") resolved += 1;
    }

    return { open, aiActive, handoff, resolved };
  }, [threads]);

  return (
    <div className="min-h-screen px-6 pb-6 pt-6 md:px-8">
      <InboxToolbar
        operatorName={operatorName}
        setOperatorName={setOperatorName}
        wsState={wsState}
        dbDisabled={dbDisabled}
        onRefresh={() => loadThreads(selectedThread?.id || "")}
      />

      {error ? (
        <div className="mb-6 rounded-[22px] border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {deepLinkNotice ? (
        <div className="mb-6 rounded-[22px] border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
          {deepLinkNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <InboxStatCard label="Open Threads" value={stats.open} icon={MessageSquareText} />
        <InboxStatCard label="AI Active" value={stats.aiActive} icon={Sparkles} tone="cyan" />
        <InboxStatCard label="Handoff" value={stats.handoff} icon={ShieldAlert} tone="amber" />
        <InboxStatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="emerald" />
      </div>

      <RetryQueuePanel
        tenantKey={tenantKey}
        actor={operatorName || "operator"}
        className="mt-6"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                Active Threads
              </div>
              <div className="mt-1 text-sm text-white/46">
                Real inbox axını və operator handoff vəziyyəti.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["all", "open", "handoff", "assigned", "resolved"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setFilter(x)}
                  className={`rounded-full border px-3.5 py-2 text-[12px] font-medium capitalize transition ${
                    filter === x
                      ? x === "handoff"
                        ? "border-amber-300/20 bg-amber-300/[0.08] text-amber-100"
                        : "border-white/10 bg-white/[0.04] text-white/78"
                      : "border-white/10 bg-white/[0.02] text-white/44 hover:border-white/16 hover:bg-white/[0.04] hover:text-white/70"
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {loadingThreads ? (
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/52">
                Loading threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                <div className="text-sm font-medium text-white/68">No threads yet</div>
                <div className="mt-2 text-sm leading-6 text-white/40">
                  Thread-lər gələndə burada tam status və handoff görünəcək.
                </div>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <InboxThreadCard
                  key={thread.id}
                  thread={thread}
                  selected={selectedThread?.id === thread.id}
                  onOpen={setSelectedThread}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <InboxDetailPanel
            selectedThread={selectedThread}
            messages={messages}
            loadingMessages={loadingMessages}
            busyAction={busyAction}
            markRead={markRead}
            assignThread={assignThread}
            activateHandoff={activateHandoff}
            releaseHandoff={releaseHandoff}
            setThreadStatus={setThreadStatus}
          />

          <InboxLeadPanel
            selectedThread={selectedThread}
            loadingLead={loadingLead}
            relatedLead={relatedLead}
            openLeadDetail={openLeadDetail}
          />

          <InboxComposer
            replyText={replyText}
            setReplyText={setReplyText}
            selectedThread={selectedThread}
            busyAction={busyAction}
            sendOperatorReply={() => sendOperatorReply(selectedThread, replyText, setReplyText)}
            releaseHandoff={releaseHandoff}
          />

          <ThreadOutboundAttemptsPanel
            selectedThread={selectedThread}
            actor={operatorName || "operator"}
          />

          {showInternalDebug ? (
            <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <UserRound className="h-4 w-4 text-white/72" />
              </div>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
                  Thread Meta
                </div>
                <div className="mt-1 text-sm text-white/46">
                  Debug və operator visibility üçün raw məlumat.
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/20 px-4 py-4">
              {selectedThread ? (
                <pre className="overflow-auto text-xs leading-6 text-white/58">
                  {JSON.stringify(selectedThread, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-white/46">No thread selected.</div>
              )}
            </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
