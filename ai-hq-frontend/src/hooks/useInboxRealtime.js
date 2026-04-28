import { useEffect, useRef } from "react";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";

const THREAD_REFRESH_DEBOUNCE_MS = 1100;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function emitRetryQueueRefresh(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("inbox:retry-queue-refresh", {
        detail,
      })
    );
  } catch {
    // Ignore dispatch failures in unsupported environments.
  }
}

function resolveThreadId(payload = {}) {
  return s(
    payload?.threadId ||
      payload?.thread_id ||
      payload?.thread?.id ||
      payload?.message?.thread_id ||
      payload?.message?.threadId ||
      payload?.attempt?.thread_id ||
      payload?.attempt?.threadId
  );
}

function resolveMessageTime(message = {}) {
  return s(
    message?.sent_at ||
      message?.sentAt ||
      message?.created_at ||
      message?.createdAt ||
      message?.updated_at ||
      message?.updatedAt
  );
}

function resolveMessageText(message = {}) {
  return s(
    message?.text ||
      message?.body ||
      message?.message ||
      message?.caption ||
      message?.content
  );
}

function resolveMessageDirection(message = {}) {
  return s(message?.direction || message?.message_direction).toLowerCase();
}

function isInboundMessage(message = {}) {
  const direction = resolveMessageDirection(message);
  const senderType = s(message?.sender_type || message?.senderType).toLowerCase();

  if (direction === "inbound") return true;
  if (direction === "outbound") return false;
  return senderType === "customer" || senderType === "user";
}

function mergeIfChanged(current, patch) {
  const base = obj(current);
  const safePatch = obj(patch);

  let changed = false;
  const next = { ...base };

  for (const [key, value] of Object.entries(safePatch)) {
    if (value === undefined) continue;

    if (next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  }

  return changed ? next : current;
}

function buildThreadPatchFromMessage({
  currentThread = null,
  payloadThread = null,
  message = null,
  threadId = "",
  selected = false,
}) {
  const safeThreadId = s(threadId || currentThread?.id || payloadThread?.id);
  if (!safeThreadId) return null;

  const safeMessage = obj(message);
  const safePayloadThread = obj(payloadThread);

  const messageText = resolveMessageText(safeMessage);
  const messageTime = resolveMessageTime(safeMessage);
  const inbound = isInboundMessage(safeMessage);

  const patch = {
    id: safeThreadId,
    ...safePayloadThread,
  };

  if (messageText) {
    patch.last_message_text = messageText;
    patch.last_message_preview = messageText;
  }

  if (messageTime) {
    patch.last_message_at = messageTime;
    patch.updated_at = messageTime;
  }

  if (inbound && !selected) {
    const currentUnread = Number(currentThread?.unread_count ?? 0);
    const payloadUnread = Number(safePayloadThread?.unread_count ?? NaN);

    patch.unread_count = Number.isFinite(payloadUnread)
      ? payloadUnread
      : currentUnread + 1;
  }

  if (selected && Object.prototype.hasOwnProperty.call(patch, "unread_count")) {
    patch.unread_count = Number(patch.unread_count || 0);
  }

  return patch;
}

function patchThreadList({
  threads,
  threadId,
  payloadThread = null,
  message = null,
  selected = false,
}) {
  const safeThreadId = s(threadId);
  if (!safeThreadId) return threads;

  const safeThreads = Array.isArray(threads) ? threads : [];
  const index = safeThreads.findIndex((thread) => s(thread?.id) === safeThreadId);

  if (index === -1) {
    if (!payloadThread?.id) return safeThreads;

    const patch = buildThreadPatchFromMessage({
      currentThread: null,
      payloadThread,
      message,
      threadId: safeThreadId,
      selected,
    });

    return patch ? [patch, ...safeThreads] : safeThreads;
  }

  const currentThread = safeThreads[index];
  const patch = buildThreadPatchFromMessage({
    currentThread,
    payloadThread,
    message,
    threadId: safeThreadId,
    selected,
  });

  if (!patch) return safeThreads;

  const nextThread = mergeIfChanged(currentThread, patch);
  if (nextThread === currentThread) return safeThreads;

  const next = safeThreads.slice();
  next[index] = nextThread;
  return next;
}

function patchSelectedThread({
  selectedThread,
  threadId,
  payloadThread = null,
  message = null,
}) {
  const safeThreadId = s(threadId);
  if (!selectedThread || s(selectedThread?.id) !== safeThreadId) {
    return selectedThread;
  }

  const patch = buildThreadPatchFromMessage({
    currentThread: selectedThread,
    payloadThread,
    message,
    threadId: safeThreadId,
    selected: true,
  });

  if (!patch) return selectedThread;
  return mergeIfChanged(selectedThread, patch);
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
  const threadRefreshTimerRef = useRef(null);
  const threadRefreshPreferredIdRef = useRef("");

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    loadThreadsRef.current = loadThreads;
    loadThreadDetailRef.current = loadThreadDetail;
    loadRelatedLeadRef.current = loadRelatedLead;
  }, [loadThreads, loadThreadDetail, loadRelatedLead]);

  useEffect(() => {
    function scheduleThreadRefresh(preferredThreadId = "") {
      const safePreferredId = s(preferredThreadId);
      if (safePreferredId) {
        threadRefreshPreferredIdRef.current = safePreferredId;
      }

      if (threadRefreshTimerRef.current) {
        window.clearTimeout(threadRefreshTimerRef.current);
      }

      threadRefreshTimerRef.current = window.setTimeout(() => {
        threadRefreshTimerRef.current = null;

        const currentSelectedThreadId = s(selectedThreadRef.current?.id);
        const preferredId =
          currentSelectedThreadId || threadRefreshPreferredIdRef.current || "";

        threadRefreshPreferredIdRef.current = "";
        loadThreadsRef.current?.(preferredId);
      }, THREAD_REFRESH_DEBOUNCE_MS);
    }

    const unsubscribeStatus = realtimeStore.subscribeStatus((status) => {
      const nextState = s(status?.state || "idle") || "idle";

      setWsState((current) => {
        const currentState = s(current || "idle") || "idle";
        return currentState === nextState ? current : nextState;
      });
    });

    const unsubscribeEvents = realtimeStore.subscribeEvents(({ type, payload }) => {
      if (!type) return;

      if (type === "inbox.thread.created" || type === "inbox.thread.updated") {
        const thread = payload?.thread;
        if (!thread?.id) return;

        setThreads((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const existing = safePrev.find((item) => item.id === thread.id);

          if (existing) {
            return safePrev.map((item) =>
              item.id === thread.id ? mergeIfChanged(item, thread) : item
            );
          }

          return [thread, ...safePrev];
        });

        setSelectedThread((prev) =>
          prev && prev.id === thread.id ? mergeIfChanged(prev, thread) : prev
        );

        return;
      }

      if (type === "inbox.thread.read") {
        const threadId = s(payload?.threadId || payload?.thread_id);
        if (!threadId) return;

        setThreads((prev) =>
          Array.isArray(prev)
            ? prev.map((thread) =>
                thread.id === threadId
                  ? mergeIfChanged(thread, { unread_count: 0 })
                  : thread
              )
            : prev
        );

        setSelectedThread((prev) =>
          prev && prev.id === threadId
            ? mergeIfChanged(prev, { unread_count: 0 })
            : prev
        );

        return;
      }

      if (type === "inbox.message.created") {
        const threadId = resolveThreadId(payload);
        const message = payload?.message;
        const payloadThread = payload?.thread;

        if (!threadId || !message?.id) return;

        const currentSelectedThread = selectedThreadRef.current;
        const selected = s(currentSelectedThread?.id) === threadId;

        if (selected) {
          setMessages((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            if (safePrev.some((item) => item.id === message.id)) return safePrev;
            return [...safePrev, message];
          });
        }

        setThreads((prev) =>
          patchThreadList({
            threads: prev,
            threadId,
            payloadThread,
            message,
            selected,
          })
        );

        setSelectedThread((prev) =>
          patchSelectedThread({
            selectedThread: prev,
            threadId,
            payloadThread,
            message,
          })
        );

        if (!payloadThread?.id && !selected) {
          scheduleThreadRefresh(threadId);
        }

        return;
      }

      if (type === "inbox.message.updated") {
        const threadId = resolveThreadId(payload);
        const message = payload?.message;
        const payloadThread = payload?.thread;

        if (!threadId || !message?.id) return;

        const currentSelectedThread = selectedThreadRef.current;
        const selected = s(currentSelectedThread?.id) === threadId;

        if (selected) {
          setMessages((prev) =>
            Array.isArray(prev)
              ? prev.map((item) =>
                  item.id === message.id ? mergeIfChanged(item, message) : item
                )
              : prev
          );
        }

        setThreads((prev) =>
          patchThreadList({
            threads: prev,
            threadId,
            payloadThread,
            message,
            selected,
          })
        );

        setSelectedThread((prev) =>
          patchSelectedThread({
            selectedThread: prev,
            threadId,
            payloadThread,
            message,
          })
        );

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
        const threadId = s(attempt?.thread_id || attempt?.threadId);

        if (!attempt?.id) return;

        emitRetryQueueRefresh({
          threadId,
          attemptId: attempt.id,
          status: attempt.status || "",
          reason:
            type === "inbox.outbound.attempt.created"
              ? "attempt_created"
              : "attempt_updated",
        });

        if (threadId) {
          scheduleThreadRefresh(threadId);
        }

        return;
      }

      if (type === "lead.created" || type === "lead.updated") {
        const lead = payload?.lead;
        if (!lead?.id) return;

        const currentSelectedThread = selectedThreadRef.current;
        const selectedThreadId = s(currentSelectedThread?.id);
        const leadThreadId = s(lead?.inbox_thread_id || lead?.inboxThreadId);

        if (leadThreadId && leadThreadId === selectedThreadId) {
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

      if (threadRefreshTimerRef.current) {
        window.clearTimeout(threadRefreshTimerRef.current);
        threadRefreshTimerRef.current = null;
      }
    };
  }, [
    setWsState,
    setThreads,
    setSelectedThread,
    setMessages,
    setRelatedLead,
  ]);
}