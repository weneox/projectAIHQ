import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { getLeadByThreadId } from "../api/leads.js";
import { useActionState } from "./useActionState.js";
import { useAsyncSurfaceState } from "./useAsyncSurfaceState.js";

const inboxInflightRequests = new Map();

function withSharedInboxRequest(key, load) {
  const cacheKey = String(key || "").trim();
  if (!cacheKey) return load();

  if (inboxInflightRequests.has(cacheKey)) {
    return inboxInflightRequests.get(cacheKey);
  }

  const request = Promise.resolve()
    .then(load)
    .finally(() => {
      if (inboxInflightRequests.get(cacheKey) === request) {
        inboxInflightRequests.delete(cacheKey);
      }
    });

  inboxInflightRequests.set(cacheKey, request);
  return request;
}

function clearSharedInboxRequests(prefix = "") {
  const needle = String(prefix || "").trim();
  if (!needle) {
    inboxInflightRequests.clear();
    return;
  }

  for (const key of inboxInflightRequests.keys()) {
    if (key.startsWith(needle)) {
      inboxInflightRequests.delete(key);
    }
  }
}

function s(value = "", fallback = "") {
  return String(value ?? fallback).trim();
}

function makeClientMutationId() {
  return `inbox-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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

function normalizeApiMessagePayload(response = {}) {
  return (
    response?.message ||
    response?.inboxMessage ||
    response?.savedMessage ||
    response?.data?.message ||
    response?.data?.inboxMessage ||
    null
  );
}

function normalizeApiThreadPayload(response = {}) {
  return response?.thread || response?.data?.thread || null;
}

function buildOptimisticOutboundMessage({
  threadId,
  tenantKey,
  actorName,
  text,
  clientMutationId,
}) {
  const at = nowIso();

  return {
    id: clientMutationId,
    thread_id: threadId,
    tenant_key: tenantKey,
    direction: "outbound",
    sender_type: "agent",
    sender_name: actorName,
    message_type: "text",
    text,
    attachments: [],
    sent_at: at,
    created_at: at,
    is_renderable: true,
    meta: {
      source: "inbox_ui",
      optimistic: true,
      deliveryStatus: "pending",
      clientMutationId,
      client_mutation_id: clientMutationId,
    },
  };
}

function buildAcceptedFallbackMessage(optimisticMessage) {
  return {
    ...optimisticMessage,
    meta: {
      ...obj(optimisticMessage?.meta),
      optimistic: false,
      deliveryStatus: "accepted",
    },
  };
}

function upsertMessageByIdOrClientMutationId(messages, nextMessage) {
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

function removeOptimisticMessage(messages, clientMutationId) {
  const safeClientMutationId = s(clientMutationId);
  if (!safeClientMutationId) return messages;

  const safeMessages = Array.isArray(messages) ? messages : [];

  return safeMessages.filter((message) => {
    const sameId = s(message?.id) === safeClientMutationId;
    const sameClientMutationId =
      getMessageClientMutationId(message) === safeClientMutationId;

    return !sameId && !sameClientMutationId;
  });
}

function patchThreadPreviewFromMessage(thread, message) {
  if (!thread?.id || !message?.text) return thread;

  const at = s(message?.sent_at || message?.created_at || nowIso());

  return mergeIfChanged(thread, {
    last_message_text: message.text,
    last_message_preview: message.text,
    last_message_at: at,
    last_outbound_at: at,
    updated_at: at,
  });
}

function patchThreadListPreview(threads, threadId, message, apiThread = null) {
  const safeThreads = Array.isArray(threads) ? threads : [];
  const safeThreadId = s(threadId);
  if (!safeThreadId) return safeThreads;

  const index = safeThreads.findIndex((thread) => s(thread?.id) === safeThreadId);
  if (index === -1) return safeThreads;

  const current = safeThreads[index];
  const patchedFromMessage = patchThreadPreviewFromMessage(current, message);
  const nextThread = apiThread
    ? mergeIfChanged(patchedFromMessage, apiThread)
    : patchedFromMessage;

  if (nextThread === current) return safeThreads;

  const next = safeThreads.slice();
  next[index] = nextThread;
  return next;
}

export function useInboxData({
  operatorName,
  tenantKey = "",
  requireTenantScope = false,
}) {
  const actorName = String(operatorName || "").trim() || "operator";
  const tenantScope = s(tenantKey).toLowerCase();
  const requestScopePrefix = tenantScope ? `tenant:${tenantScope}:` : "";
  const actionState = useActionState();

  const [messages, setMessages] = useState([]);
  const [messagesThreadId, setMessagesThreadId] = useState("");
  const messagesThreadIdRef = useRef("");
  const messagesRequestSeqRef = useRef(0);
  const threadDetailRequestSeqRef = useRef(0);
  const leadRequestSeqRef = useRef(0);

  useEffect(() => {
    messagesThreadIdRef.current = messagesThreadId;
  }, [messagesThreadId]);

  const [selectedThread, setSelectedThread] = useState(null);
  const [relatedLead, setRelatedLead] = useState(null);

  const [loadingThreadDetail, setLoadingThreadDetail] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  const [threadDetailError, setThreadDetailError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [leadError, setLeadError] = useState("");

  const {
    data,
    setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useAsyncSurfaceState({
    initialData: {
      threads: [],
      dbDisabled: false,
    },
  });

  const threads = Array.isArray(data?.threads) ? data.threads : [];
  const dbDisabled = Boolean(data?.dbDisabled);

  useEffect(() => {
    clearSharedInboxRequests("tenant:");

    setData({
      threads: [],
      dbDisabled: false,
    });

    setMessages([]);
    setMessagesThreadId("");
    messagesRequestSeqRef.current += 1;
    threadDetailRequestSeqRef.current += 1;
    leadRequestSeqRef.current += 1;

    setSelectedThread(null);
    setRelatedLead(null);
    setThreadDetailError("");
    setMessagesError("");
    setLeadError("");
    clearSaveState();

    if (tenantScope) {
      beginRefresh();
    }
  }, [beginRefresh, clearSaveState, setData, tenantScope]);

  const loadThreads = useCallback(
    async (preferredId = "") => {
      if (requireTenantScope && !tenantScope) {
        return null;
      }

      try {
        beginRefresh();

        const j = await withSharedInboxRequest(
          `${requestScopePrefix}threads:list`,
          () => apiGet("/api/inbox/threads")
        );

        const arr = Array.isArray(j?.threads) ? j.threads : [];

        setData({
          threads: arr,
          dbDisabled: Boolean(j?.dbDisabled),
        });

        if (arr.length > 0) {
          setSelectedThread((prev) => {
            const wantedId = preferredId || prev?.id || "";
            if (wantedId && arr.some((x) => x.id === wantedId)) {
              return arr.find((x) => x.id === wantedId) || arr[0];
            }
            return arr[0];
          });
        } else {
          setSelectedThread(null);
          setMessages([]);
          setMessagesThreadId("");
          messagesRequestSeqRef.current += 1;
          threadDetailRequestSeqRef.current += 1;
          leadRequestSeqRef.current += 1;
          setRelatedLead(null);
          setThreadDetailError("");
          setMessagesError("");
          setLeadError("");
        }

        return succeedRefresh({
          threads: arr,
          dbDisabled: Boolean(j?.dbDisabled),
        });
      } catch (e) {
        return failRefresh(String(e?.message || e || "Failed to load inbox threads"), {
          fallbackData: {
            threads: [],
            dbDisabled: false,
          },
          unavailable: true,
        });
      }
    },
    [
      beginRefresh,
      failRefresh,
      requestScopePrefix,
      requireTenantScope,
      setData,
      succeedRefresh,
      tenantScope,
    ]
  );

  const loadThreadDetail = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      const requestSeq = threadDetailRequestSeqRef.current + 1;
      threadDetailRequestSeqRef.current = requestSeq;

      if (!safeThreadId) return;
      if (requireTenantScope && !tenantScope) return;

      try {
        setLoadingThreadDetail(true);
        setThreadDetailError("");

        const j = await withSharedInboxRequest(
          `${requestScopePrefix}threads:detail:${safeThreadId}`,
          () => apiGet(`/api/inbox/threads/${safeThreadId}`)
        );

        if (threadDetailRequestSeqRef.current !== requestSeq) return;

        if (j?.thread) {
          setSelectedThread((current) => {
            if (s(current?.id) && s(current?.id) !== safeThreadId) return current;
            return j.thread;
          });

          setData((prev) => ({
            ...prev,
            threads: (Array.isArray(prev?.threads) ? prev.threads : []).map((t) =>
              t.id === safeThreadId ? { ...t, ...j.thread } : t
            ),
            dbDisabled: Boolean(prev?.dbDisabled),
          }));
        }
      } catch (e) {
        if (threadDetailRequestSeqRef.current !== requestSeq) return;
        setThreadDetailError(String(e?.message || e || "Failed to load thread detail"));
      } finally {
        if (threadDetailRequestSeqRef.current === requestSeq) {
          setLoadingThreadDetail(false);
        }
      }
    },
    [requestScopePrefix, requireTenantScope, setData, tenantScope]
  );

  const loadMessages = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      const requestSeq = messagesRequestSeqRef.current + 1;
      messagesRequestSeqRef.current = requestSeq;

      if (!safeThreadId) {
        setMessagesThreadId("");
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      if (requireTenantScope && !tenantScope) {
        setMessagesThreadId("");
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      const previousMessagesThreadId = s(messagesThreadIdRef.current);

      setMessagesThreadId(safeThreadId);

      if (previousMessagesThreadId !== safeThreadId) {
        setMessages([]);
      }

      setLoadingMessages(true);
      setMessagesError("");

      try {
        const j = await withSharedInboxRequest(
          `${requestScopePrefix}threads:messages:${safeThreadId}`,
          () => apiGet(`/api/inbox/threads/${safeThreadId}/messages?limit=200`)
        );

        if (messagesRequestSeqRef.current !== requestSeq) return;

        setMessages(Array.isArray(j?.messages) ? j.messages : []);
      } catch (e) {
        if (messagesRequestSeqRef.current !== requestSeq) return;

        setMessages([]);
        setMessagesError(String(e?.message || e || "Failed to load messages"));
      } finally {
        if (messagesRequestSeqRef.current === requestSeq) {
          setLoadingMessages(false);
        }
      }
    },
    [requestScopePrefix, requireTenantScope, tenantScope]
  );

  const loadRelatedLead = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      const requestSeq = leadRequestSeqRef.current + 1;
      leadRequestSeqRef.current = requestSeq;

      if (!safeThreadId) {
        setRelatedLead(null);
        return;
      }

      if (requireTenantScope && !tenantScope) return;

      try {
        setLoadingLead(true);
        setLeadError("");

        const j = await withSharedInboxRequest(
          `${requestScopePrefix}threads:lead:${safeThreadId}`,
          () => getLeadByThreadId(safeThreadId)
        );

        if (leadRequestSeqRef.current !== requestSeq) return;

        setRelatedLead(j?.lead || null);
      } catch (e) {
        if (leadRequestSeqRef.current !== requestSeq) return;

        setRelatedLead(null);
        setLeadError(String(e?.message || e || "Failed to load related lead"));
      } finally {
        if (leadRequestSeqRef.current === requestSeq) {
          setLoadingLead(false);
        }
      }
    },
    [requestScopePrefix, requireTenantScope, tenantScope]
  );

  const syncSelected = useCallback(
    async (threadId, options = {}) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      const forceFresh = options?.force !== false;

      if (forceFresh) {
        clearSharedInboxRequests(`${requestScopePrefix}threads:detail:${safeThreadId}`);
        clearSharedInboxRequests(`${requestScopePrefix}threads:messages:${safeThreadId}`);
        clearSharedInboxRequests(`${requestScopePrefix}threads:lead:${safeThreadId}`);
      }

      await Promise.all([
        loadThreadDetail(safeThreadId),
        loadMessages(safeThreadId),
        loadRelatedLead(safeThreadId),
      ]);
    },
    [loadMessages, loadRelatedLead, loadThreadDetail, requestScopePrefix]
  );

  const markRead = useCallback(
    async (threadId) => {
      if (!threadId) return;

      try {
        beginSave();
        await actionState.runAction("read", () =>
          apiPost(`/api/inbox/threads/${threadId}/read`, {})
        );
        clearSharedInboxRequests(`${requestScopePrefix}threads:`);
        await syncSelected(threadId);
        succeedSave({ message: "Thread marked as read." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to mark thread as read"));
      }
    },
    [actionState, beginSave, failSave, requestScopePrefix, succeedSave, syncSelected]
  );

  const assignThread = useCallback(
    async (threadId) => {
      if (!threadId) return;

      try {
        beginSave();
        await actionState.runAction("assign", () =>
          apiPost(`/api/inbox/threads/${threadId}/assign`, {
            assignedTo: actorName,
            actor: actorName,
          })
        );
        clearSharedInboxRequests(`${requestScopePrefix}threads:`);
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Thread assigned." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to assign thread"));
      }
    },
    [
      actionState,
      actorName,
      beginSave,
      failSave,
      loadThreads,
      requestScopePrefix,
      succeedSave,
      syncSelected,
    ]
  );

  const activateHandoff = useCallback(
    async (threadId) => {
      if (!threadId) return;

      try {
        beginSave();
        await actionState.runAction("handoff", () =>
          apiPost(`/api/inbox/threads/${threadId}/handoff/activate`, {
            reason: "manual_review",
            priority: "high",
            assignedTo: actorName,
            actor: actorName,
          })
        );
        clearSharedInboxRequests(`${requestScopePrefix}threads:`);
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Handoff activated." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to activate handoff"));
      }
    },
    [
      actionState,
      actorName,
      beginSave,
      failSave,
      loadThreads,
      requestScopePrefix,
      succeedSave,
      syncSelected,
    ]
  );

  const releaseHandoff = useCallback(
    async (threadId) => {
      if (!threadId) return;

      try {
        beginSave();
        await actionState.runAction("release", () =>
          apiPost(`/api/inbox/threads/${threadId}/handoff/release`, {
            actor: actorName,
          })
        );
        clearSharedInboxRequests(`${requestScopePrefix}threads:`);
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Handoff released." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to release handoff"));
      }
    },
    [
      actionState,
      actorName,
      beginSave,
      failSave,
      loadThreads,
      requestScopePrefix,
      succeedSave,
      syncSelected,
    ]
  );

  const setThreadStatus = useCallback(
    async (threadId, status) => {
      if (!threadId) return;

      try {
        beginSave();
        await actionState.runAction(status, () =>
          apiPost(`/api/inbox/threads/${threadId}/status`, {
            status,
            actor: actorName,
          })
        );
        clearSharedInboxRequests(`${requestScopePrefix}threads:`);
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({
          message: status === "closed" ? "Thread closed." : "Thread resolved.",
        });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to update thread status"));
      }
    },
    [
      actionState,
      actorName,
      beginSave,
      failSave,
      loadThreads,
      requestScopePrefix,
      succeedSave,
      syncSelected,
    ]
  );

  const sendOperatorReply = useCallback(
    async (threadId, replyText) => {
      const safeThreadId = s(threadId);
      const trimmed = s(replyText);

      if (!safeThreadId) return false;

      if (!trimmed) {
        failSave("Reply text is required");
        return false;
      }

      const clientMutationId = makeClientMutationId();

      const optimisticMessage = buildOptimisticOutboundMessage({
        threadId: safeThreadId,
        tenantKey: tenantScope,
        actorName,
        text: trimmed,
        clientMutationId,
      });

      try {
        beginSave();
        setMessagesThreadId(safeThreadId);
        setMessagesError("");

        setMessages((prev) => {
          const activeMessagesThreadId = s(messagesThreadIdRef.current);
          if (activeMessagesThreadId && activeMessagesThreadId !== safeThreadId) {
            return prev;
          }

          return upsertMessageByIdOrClientMutationId(prev, optimisticMessage);
        });

        setSelectedThread((prev) =>
          prev && prev.id === safeThreadId
            ? patchThreadPreviewFromMessage(prev, optimisticMessage)
            : prev
        );

        setData((prev) => ({
          ...prev,
          threads: patchThreadListPreview(
            Array.isArray(prev?.threads) ? prev.threads : [],
            safeThreadId,
            optimisticMessage
          ),
          dbDisabled: Boolean(prev?.dbDisabled),
        }));

        const response = await actionState.runAction("reply", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/messages`, {
            direction: "outbound",
            senderType: "agent",
            operatorName: actorName,
            messageType: "text",
            text: trimmed,
            releaseHandoff: false,
            clientMutationId,
            meta: {
              source: "inbox_ui",
              clientMutationId,
              client_mutation_id: clientMutationId,
            },
          })
        );

        clearSharedInboxRequests(`${requestScopePrefix}threads:`);

        const apiMessage =
          normalizeApiMessagePayload(response) ||
          buildAcceptedFallbackMessage(optimisticMessage);

        const apiThread = normalizeApiThreadPayload(response);

        setMessages((prev) =>
          upsertMessageByIdOrClientMutationId(prev, apiMessage)
        );

        setSelectedThread((prev) => {
          if (!prev || prev.id !== safeThreadId) return prev;

          const patched = patchThreadPreviewFromMessage(prev, apiMessage);
          return apiThread ? mergeIfChanged(patched, apiThread) : patched;
        });

        setData((prev) => ({
          ...prev,
          threads: patchThreadListPreview(
            Array.isArray(prev?.threads) ? prev.threads : [],
            safeThreadId,
            apiMessage,
            apiThread
          ),
          dbDisabled: Boolean(prev?.dbDisabled),
        }));

        succeedSave({
          message:
            "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
        });

        return true;
      } catch (e) {
        setMessages((prev) => removeOptimisticMessage(prev, clientMutationId));

        failSave(String(e?.message || e || "Failed to send operator reply"));
        return false;
      }
    },
    [
      actionState,
      actorName,
      beginSave,
      failSave,
      requestScopePrefix,
      setData,
      succeedSave,
      tenantScope,
    ]
  );

  return {
    threads,
    setThreads: (next) =>
      setData((prev) => ({
        ...prev,
        threads:
          typeof next === "function"
            ? next(Array.isArray(prev?.threads) ? prev.threads : [])
            : next,
        dbDisabled: Boolean(prev?.dbDisabled),
      })),
    messages,
    messagesThreadId,
    setMessages,
    selectedThread,
    setSelectedThread,
    relatedLead,
    setRelatedLead,
    dbDisabled,
    surface: {
      ...surface,
      refresh: () => loadThreads(selectedThread?.id || ""),
      clearSaveState,
    },
    detailSurface: {
      loading: loadingThreadDetail || loadingMessages,
      error: threadDetailError || messagesError,
      unavailable: false,
      ready: Boolean(selectedThread?.id) && !loadingThreadDetail && !loadingMessages,
      lastUpdated: "",
      saving: surface.saving,
      saveError: surface.saveError,
      saveSuccess: surface.saveSuccess,
      refresh: selectedThread?.id ? () => syncSelected(selectedThread.id) : null,
      clearSaveState,
    },
    leadSurface: {
      loading: loadingLead,
      error: leadError,
      unavailable: false,
      ready: Boolean(selectedThread?.id) && !loadingLead,
      lastUpdated: "",
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: selectedThread?.id ? () => loadRelatedLead(selectedThread.id) : null,
      clearSaveState: () => {},
    },
    actionState,
    loadThreads,
    loadThreadDetail,
    loadMessages,
    loadRelatedLead,
    syncSelected,
    markRead,
    assignThread,
    activateHandoff,
    releaseHandoff,
    setThreadStatus,
    sendOperatorReply,
  };
}