import { useEffect, useMemo, useState } from "react";

import { deriveThreadState } from "../../../lib/inbox-ui.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function clearFailure(current, threadId) {
  if (current.id !== threadId) return current;
  return { id: "", message: "" };
}

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
  const [resolvedRequestedThreadId, setResolvedRequestedThreadId] = useState("");
  const [failedRequest, setFailedRequest] = useState({
    id: "",
    message: "",
  });

  const requestedId = s(requestedThreadId);
  const selectedThreadId = s(selectedThread?.id);

  const pendingThreadId =
    requestedId &&
    requestedId !== selectedThreadId &&
    requestedId !== resolvedRequestedThreadId &&
    failedRequest.id !== requestedId
      ? requestedId
      : "";

  const deepLinkNotice =
    requestedId && failedRequest.id === requestedId ? failedRequest.message : "";

  useEffect(() => {
    loadThreads(pendingThreadId || requestedId);
  }, [loadThreads, pendingThreadId, requestedId]);

  useEffect(() => {
    if (!pendingThreadId || surface?.loading) return;

    let cancelled = false;

    async function syncRequestedThread() {
      const matchingThread = threads.find(
        (thread) => s(thread?.id) === pendingThreadId
      );

      if (matchingThread) {
        if (selectedThreadId !== s(matchingThread.id)) {
          setSelectedThread(matchingThread);
        }
        if (cancelled) return;

        setFailedRequest((current) => clearFailure(current, pendingThreadId));
        setResolvedRequestedThreadId(pendingThreadId);
        return;
      }

      try {
        await Promise.all([
          loadThreadDetail(pendingThreadId),
          loadMessages(pendingThreadId),
          loadRelatedLead(pendingThreadId),
        ]);

        if (cancelled) return;

        let opened = false;

        setSelectedThread((current) => {
          if (s(current?.id) === pendingThreadId) {
            opened = true;
          }
          return current;
        });

        if (cancelled) return;

        if (opened) {
          setFailedRequest((current) => clearFailure(current, pendingThreadId));
          setResolvedRequestedThreadId(pendingThreadId);
          return;
        }

        setFailedRequest({
          id: pendingThreadId,
          message: "The requested inbox thread is no longer available.",
        });
      } catch {
        if (cancelled) return;

        setFailedRequest({
          id: pendingThreadId,
          message: "The requested inbox thread could not be opened.",
        });
      }
    }

    syncRequestedThread();

    return () => {
      cancelled = true;
    };
  }, [
    loadMessages,
    loadRelatedLead,
    loadThreadDetail,
    pendingThreadId,
    selectedThreadId,
    setSelectedThread,
    surface?.loading,
    threads,
  ]);

  const filteredThreads = useMemo(() => {
    if (filter === "handoff") {
      return threads.filter((thread) => Boolean(thread?.handoff_active));
    }

    if (filter === "open") {
      return threads.filter((thread) => deriveThreadState(thread) === "open");
    }

    if (filter === "assigned") {
      return threads.filter((thread) => deriveThreadState(thread) === "assigned");
    }

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
      refresh: () => loadThreads(selectedThreadId || requestedId || ""),
    },
  };
}