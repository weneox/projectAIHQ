import { useEffect, useRef } from "react";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";

function emitRetryQueueRefresh(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("inbox:retry-queue-refresh", {
        detail,
      })
    );
  } catch {}
}

export function useInboxRealtime({
  selectedThread,
  setWsState,
  setThreads,
  setSelectedThread,
  setMessages,
  loadThreads,
  loadThreadDetail,
  loadRelatedLead,
  setRelatedLead,
}) {
  const selectedThreadRef = useRef(selectedThread);
  const loadThreadsRef = useRef(loadThreads);
  const loadThreadDetailRef = useRef(loadThreadDetail);
  const loadRelatedLeadRef = useRef(loadRelatedLead);

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    loadThreadsRef.current = loadThreads;
    loadThreadDetailRef.current = loadThreadDetail;
    loadRelatedLeadRef.current = loadRelatedLead;
  }, [loadThreads, loadThreadDetail, loadRelatedLead]);

  useEffect(() => {
    const unsubscribeStatus = realtimeStore.subscribeStatus((status) => {
      setWsState(String(status?.state || "idle"));
    });

    const unsubscribeEvents = realtimeStore.subscribeEvents(({ type, payload }) => {
        if (!type) return;

        if (type === "inbox.thread.created" || type === "inbox.thread.updated") {
          const thread = payload?.thread;
          if (!thread?.id) return;

          setThreads((prev) => {
            const existing = prev.find((x) => x.id === thread.id);
            if (existing) {
              return prev.map((x) => (x.id === thread.id ? { ...x, ...thread } : x));
            }
            return [thread, ...prev];
          });

          setSelectedThread((prev) =>
            prev && prev.id === thread.id ? { ...prev, ...thread } : prev
          );

          return;
        }

        if (type === "inbox.thread.read") {
          const threadId = payload?.threadId;
          if (!threadId) return;

          setThreads((prev) =>
            prev.map((x) => (x.id === threadId ? { ...x, unread_count: 0 } : x))
          );

          setSelectedThread((prev) =>
            prev && prev.id === threadId ? { ...prev, unread_count: 0 } : prev
          );

          return;
        }

        if (type === "inbox.message.created") {
          const threadId = payload?.threadId;
          const message = payload?.message;
          if (!threadId || !message?.id) return;
          const currentSelectedThread = selectedThreadRef.current;

          if (currentSelectedThread?.id === threadId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === message.id)) return prev;
              return [...prev, message];
            });
          }

          loadThreadsRef.current?.(currentSelectedThread?.id || threadId);

          if (currentSelectedThread?.id === threadId) {
            loadThreadDetailRef.current?.(threadId);
            loadRelatedLeadRef.current?.(threadId);
          }

          return;
        }

        if (type === "inbox.message.updated") {
          const threadId = payload?.threadId || payload?.message?.thread_id;
          const message = payload?.message;
          if (!threadId || !message?.id) return;
          const currentSelectedThread = selectedThreadRef.current;

          if (currentSelectedThread?.id === threadId) {
            setMessages((prev) =>
              prev.map((m) => (m.id === message.id ? { ...m, ...message } : m))
            );
          }

          loadThreadsRef.current?.(currentSelectedThread?.id || threadId);

          if (currentSelectedThread?.id === threadId) {
            loadThreadDetailRef.current?.(threadId);
          }

          emitRetryQueueRefresh({
            threadId,
            reason: "message_updated",
          });

          return;
        }

        if (
          type === "inbox.outbound.attempt.created" ||
          type === "inbox.outbound.attempt.updated"
        ) {
          const attempt = payload?.attempt;
          const threadId = attempt?.thread_id || "";
          const currentSelectedThread = selectedThreadRef.current;
          if (!attempt?.id) return;

          if (threadId) {
            loadThreadsRef.current?.(currentSelectedThread?.id || threadId);

            if (currentSelectedThread?.id === threadId) {
              loadThreadDetailRef.current?.(threadId);
            }
          }

          emitRetryQueueRefresh({
            threadId,
            attemptId: attempt.id,
            status: attempt.status || "",
            reason:
              type === "inbox.outbound.attempt.created"
                ? "attempt_created"
                : "attempt_updated",
          });

          return;
        }

        if (type === "lead.created" || type === "lead.updated") {
          const lead = payload?.lead;
          if (!lead?.id) return;
          const currentSelectedThread = selectedThreadRef.current;

          if (String(lead?.inbox_thread_id || "") === String(currentSelectedThread?.id || "")) {
            setRelatedLead(lead);
          }
        }
    });
    if (!realtimeStore.canUseWs()) {
      setWsState("off");
    }

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, [
    setWsState,
    setThreads,
    setSelectedThread,
    setMessages,
    setRelatedLead,
  ]);
}
