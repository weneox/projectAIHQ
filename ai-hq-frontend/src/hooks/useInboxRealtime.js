import { useEffect, useRef } from "react";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";

const THREAD_REFRESH_DEBOUNCE_MS = 1100;
const SELECTED_THREAD_SYNC_DEBOUNCE_MS = 420;

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

function getMessageClientMutationId(message = {}) {
  const meta = obj(message?.meta);

  return s(
    message?.clientMutationId ||
      message?.client_mutation_id ||
      meta?.clientMutationId ||
      meta?.client_mutation_id
  );
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

function upsertRealtimeMessage(messages, nextMessage) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const nextId = s(nextMessage?.id);
  const nextClientMutationId = getMessageClientMutationId(nextMessage);

  let replaced = false;

  const nextMessages = safeMessages.map((message) => {
    const sameId = nextId && s(message?.id) === nextId;
    const sameClientMutationId =
      nextClientMutationId &&
      getMessageClientMutationId(message) === nextClientMutationId;

    if (!sameId && !sameClientMutationId) return message;

    replaced = true;

    return {
      ...message,
      ...nextMessage,
      meta: {
        ...obj(message?.meta),
        ...obj(nextMessage?.meta),
        optimistic: false,
      },
    };
  });

  if (replaced) return nextMessages;

  return [...safeMessages, nextMessage];
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

    if (inbound) {
      patch.last_inbound_at = messageTime;
    } else {
      patch.last_outbound_at = messageTime;
    }
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
  syncSelected,
  setRelatedLead,
  setTypingState = null,
}) {
  const selectedThreadRef = useRef(selectedThread);
  const loadThreadsRef = useRef(loadThreads);
  const syncSelectedRef = useRef(syncSelected);
  const threadRefreshTimerRef = useRef(null);
  const selectedThreadSyncTimerRef = useRef(null);
  const selectedThreadSyncReasonRef = useRef("");
  const threadRefreshPreferredIdRef = useRef("");
  const typingClearTimersRef = useRef(new Map());

  useEffect(() => {
    selectedThreadRef.current = selectedThread;
  }, [selectedThread]);

  useEffect(() => {
    loadThreadsRef.current = loadThreads;
  }, [loadThreads]);

  useEffect(() => {
    syncSelectedRef.current = syncSelected;
  }, [syncSelected]);

  useEffect(() => {
    const typingClearTimers = typingClearTimersRef.current;

    function scheduleSelectedThreadSync(threadId = "", reason = "realtime") {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;
      if (s(selectedThreadRef.current?.id) !== safeThreadId) return;

      selectedThreadSyncReasonRef.current = reason || "realtime";

      if (selectedThreadSyncTimerRef.current) {
        window.clearTimeout(selectedThreadSyncTimerRef.current);
      }

      selectedThreadSyncTimerRef.current = window.setTimeout(() => {
        selectedThreadSyncTimerRef.current = null;

        if (s(selectedThreadRef.current?.id) !== safeThreadId) return;

        Promise.resolve(
          syncSelectedRef.current?.(safeThreadId, {
            force: true,
            reason: selectedThreadSyncReasonRef.current || "realtime",
          })
        ).catch(() => {
          // Realtime refresh is best-effort; visible surfaces keep their current state on failure.
        });
      }, SELECTED_THREAD_SYNC_DEBOUNCE_MS);
    }

    function clearTypingTimer(key = "") {
      const safeKey = s(key);
      if (!safeKey) return;

      const existing = typingClearTimersRef.current.get(safeKey);
      if (existing) {
        window.clearTimeout(existing);
        typingClearTimersRef.current.delete(safeKey);
      }
    }

    function applyTypingRealtimeUpdate(payload = {}) {
      if (typeof setTypingState !== "function") return;

      const threadId = resolveThreadId(payload);
      if (!threadId) return;

      const typing = obj(payload?.typing);
      const actor = s(typing?.actor || payload?.actor || "business").toLowerCase() || "business";
      const active = typing?.active === true || payload?.active === true;
      const key = `${threadId}:${actor}`;
      const now = Date.now();
      const expiresAt = s(typing?.expiresAt || typing?.expires_at);
      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
      const safeExpiresAt =
        active && Number.isFinite(expiresMs) && expiresMs > now
          ? expiresAt
          : active
            ? new Date(now + 9000).toISOString()
            : "";

      clearTypingTimer(key);

      setTypingState((current) => {
        const previous = obj(current);
        const previousThread = obj(previous[threadId]);

        const nextThread = {
          ...previousThread,
          [actor]: {
            active,
            actor,
            reason: s(typing?.reason || payload?.reason),
            updatedAt: s(typing?.updatedAt || typing?.updated_at) || new Date(now).toISOString(),
            expiresAt: safeExpiresAt || null,
          },
        };

        if (!active) {
          nextThread[actor] = {
            ...nextThread[actor],
            active: false,
            expiresAt: null,
          };
        }

        return {
          ...previous,
          [threadId]: nextThread,
        };
      });

      if (active && safeExpiresAt) {
        const delay = Math.max(800, new Date(safeExpiresAt).getTime() - now);

        const timer = window.setTimeout(() => {
          typingClearTimersRef.current.delete(key);

          setTypingState((current) => {
            const previous = obj(current);
            const previousThread = obj(previous[threadId]);
            const previousActorState = obj(previousThread[actor]);

            if (!previousActorState.active) return previous;

            return {
              ...previous,
              [threadId]: {
                ...previousThread,
                [actor]: {
                  ...previousActorState,
                  active: false,
                  expiresAt: null,
                },
              },
            };
          });
        }, delay);

        typingClearTimersRef.current.set(key, timer);
      }
    }

    function clearTypingActor(threadId = "", actor = "", reason = "message_arrived") {
      const safeThreadId = s(threadId);
      const safeActor = s(actor).toLowerCase();
      if (!safeThreadId || !safeActor) return;

      applyTypingRealtimeUpdate({
        threadId: safeThreadId,
        typing: {
          actor: safeActor,
          active: false,
          reason,
        },
      });
    }

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

      if (type === "inbox.typing.updated") {
        applyTypingRealtimeUpdate(payload);
        return;
      }

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

        if (s(selectedThreadRef.current?.id) === s(thread.id)) {
          scheduleSelectedThreadSync(thread.id, type);
        }

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

        clearTypingActor(
          threadId,
          isInboundMessage(message) ? "customer" : "business",
          "message_updated"
        );

        if (selected) {
          setMessages((prev) => upsertRealtimeMessage(prev, message));
          scheduleSelectedThreadSync(threadId, type);
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
          setMessages((prev) => upsertRealtimeMessage(prev, message));
          scheduleSelectedThreadSync(threadId, type);
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
          scheduleSelectedThreadSync(threadId, type);
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

      if (selectedThreadSyncTimerRef.current) {
        window.clearTimeout(selectedThreadSyncTimerRef.current);
        selectedThreadSyncTimerRef.current = null;
      }

      for (const timer of typingClearTimers.values()) {
        window.clearTimeout(timer);
      }
      typingClearTimers.clear();
    };
  }, [
    setWsState,
    setThreads,
    setSelectedThread,
    setMessages,
    setRelatedLead,
    setTypingState,
  ]);
}