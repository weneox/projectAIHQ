import { useEffect, useMemo, useState } from "react";

import { deriveThreadState } from "../../../lib/inbox-ui.js";

export function useInboxThreadListSurface({
  requestedThreadId = "",
  threads = [],
  selectedThread = null,
  setSelectedThread,
  surface,
  loadThreads,
  loadThreadDetail,
  loadMessages,
  loadRelatedLead,
}) {
  const [filter, setFilter] = useState("all");
  const [deepLinkNotice, setDeepLinkNotice] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState(String(requestedThreadId || "").trim());

  useEffect(() => {
    setPendingThreadId(String(requestedThreadId || "").trim());
    if (!requestedThreadId) {
      setDeepLinkNotice("");
    }
  }, [requestedThreadId]);

  useEffect(() => {
    loadThreads(pendingThreadId || requestedThreadId);
  }, [loadThreads, pendingThreadId, requestedThreadId]);

  useEffect(() => {
    if (!pendingThreadId || surface?.loading) return;

    const matchingThread = threads.find((thread) => String(thread?.id || "") === pendingThreadId);

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
        await Promise.all([loadThreadDetail(pendingThreadId), loadMessages(pendingThreadId), loadRelatedLead(pendingThreadId)]);
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
    loadMessages,
    loadRelatedLead,
    loadThreadDetail,
    pendingThreadId,
    selectedThread?.id,
    setSelectedThread,
    surface?.loading,
    threads,
  ]);

  const filteredThreads = useMemo(() => {
    if (filter === "handoff") return threads.filter((thread) => Boolean(thread?.handoff_active));
    if (filter === "open") return threads.filter((thread) => deriveThreadState(thread) === "open");
    if (filter === "assigned") return threads.filter((thread) => deriveThreadState(thread) === "assigned");
    if (filter === "resolved") {
      return threads.filter((thread) => {
        const state = deriveThreadState(thread);
        return state === "resolved" || state === "closed";
      });
    }
    return threads;
  }, [filter, threads]);

  const stats = useMemo(() => {
    let open = 0;
    let aiActive = 0;
    let handoff = 0;
    let resolved = 0;

    for (const thread of threads) {
      const state = deriveThreadState(thread);
      if (state === "open") open += 1;
      else if (state === "ai_active") aiActive += 1;
      else if (state === "handoff" || state === "assigned") handoff += 1;
      else if (state === "resolved" || state === "closed") resolved += 1;
    }

    return { open, aiActive, handoff, resolved };
  }, [threads]);

  return {
    filter,
    setFilter,
    stats,
    deepLinkNotice,
    filteredThreads,
    openThread: setSelectedThread,
    surface: {
      ...surface,
      refresh: () => loadThreads(selectedThread?.id || requestedThreadId || ""),
    },
  };
}
