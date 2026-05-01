import { useCallback, useRef, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { useActionState } from "./useActionState.js";
import { useAsyncSurfaceState } from "./useAsyncSurfaceState.js";

function s(value) {
  return String(value ?? "").trim();
}

function resolveThreadId(value) {
  if (typeof value === "string" || typeof value === "number") {
    return s(value);
  }
  return s(value?.id);
}

function readApiError(e, fallback = "Request failed") {
  return String(e?.message || e || fallback);
}

export function useInboxData({ filter, operatorName, navigate }) {
  const actorName = s(operatorName) || "operator";

  const selectedThreadRef = useRef(null);
  const messagesThreadIdRef = useRef("");
  const relatedLeadThreadIdRef = useRef("");

  const messagesRequestRef = useRef(0);
  const leadRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const actionState = useActionState();

  const inboxSurfaceState = useAsyncSurfaceState({
    initialData: [],
    initialLoading: true,
  });

  const detailSurfaceState = useAsyncSurfaceState({
    initialData: null,
    initialLoading: false,
  });

  const leadSurfaceState = useAsyncSurfaceState({
    initialData: null,
    initialLoading: false,
  });

  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedThreadState, setSelectedThreadState] = useState(null);
  const [relatedLead, setRelatedLead] = useState(null);

  const [messagesThreadId, setMessagesThreadId] = useState("");
  const [loadingMessagesThreadId, setLoadingMessagesThreadId] = useState("");

  const [relatedLeadThreadId, setRelatedLeadThreadId] = useState("");
  const [loadingLeadThreadId, setLoadingLeadThreadId] = useState("");

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [dbDisabled, setDbDisabled] = useState(false);

  const commitSelectedThread = useCallback((nextOrUpdater) => {
    setSelectedThreadState((prev) => {
      const next =
        typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;

      selectedThreadRef.current = next || null;
      return next || null;
    });
  }, []);

  const commitMessagesThreadId = useCallback((threadId) => {
    const safeThreadId = s(threadId);
    messagesThreadIdRef.current = safeThreadId;
    setMessagesThreadId(safeThreadId);
  }, []);

  const commitRelatedLeadThreadId = useCallback((threadId) => {
    const safeThreadId = s(threadId);
    relatedLeadThreadIdRef.current = safeThreadId;
    setRelatedLeadThreadId(safeThreadId);
  }, []);

  const primeThreadSwitch = useCallback(
    (thread) => {
      const nextThreadId = s(thread?.id);

      commitSelectedThread(thread || null);

      if (!nextThreadId) {
        messagesRequestRef.current += 1;
        leadRequestRef.current += 1;

        commitMessagesThreadId("");
        commitRelatedLeadThreadId("");

        setMessages([]);
        setRelatedLead(null);

        setLoadingMessages(false);
        setLoadingLead(false);

        setLoadingMessagesThreadId("");
        setLoadingLeadThreadId("");

        detailSurfaceState.succeedRefresh(null);
        leadSurfaceState.succeedRefresh(null);
        return;
      }

      if (messagesThreadIdRef.current !== nextThreadId) {
        messagesRequestRef.current += 1;
        commitMessagesThreadId(nextThreadId);
        setMessages([]);
        setLoadingMessages(true);
        setLoadingMessagesThreadId(nextThreadId);
      }

      if (relatedLeadThreadIdRef.current !== nextThreadId) {
        leadRequestRef.current += 1;
        commitRelatedLeadThreadId(nextThreadId);
        setRelatedLead(null);
        setLoadingLead(true);
        setLoadingLeadThreadId(nextThreadId);
        leadSurfaceState.beginRefresh();
      }

      detailSurfaceState.succeedRefresh(thread || null);
    },
    [
      commitMessagesThreadId,
      commitRelatedLeadThreadId,
      commitSelectedThread,
      detailSurfaceState,
      leadSurfaceState,
    ]
  );

  const openThread = useCallback(
    (thread) => {
      primeThreadSwitch(thread);
    },
    [primeThreadSwitch]
  );

  const loadThreads = useCallback(
    async (preferredId = "") => {
      try {
        setLoadingThreads(true);
        setError("");
        inboxSurfaceState.beginRefresh();

        const qs =
          filter === "handoff"
            ? "/api/inbox/threads?handoffOnly=true"
            : "/api/inbox/threads";

        const j = await apiGet(qs);
        const arr = Array.isArray(j?.threads) ? j.threads : [];

        setThreads(arr);
        setDbDisabled(Boolean(j?.dbDisabled));
        inboxSurfaceState.succeedRefresh(arr);

        if (arr.length > 0) {
          const previousThread = selectedThreadRef.current;
          const wantedId = s(preferredId) || s(previousThread?.id);

          const nextThread =
            (wantedId && arr.find((x) => s(x?.id) === wantedId)) || arr[0];

          if (s(previousThread?.id) !== s(nextThread?.id)) {
            primeThreadSwitch(nextThread);
          } else {
            commitSelectedThread((current) => ({
              ...(current || {}),
              ...(nextThread || {}),
            }));
            detailSurfaceState.succeedRefresh({
              ...(selectedThreadRef.current || {}),
              ...(nextThread || {}),
            });
          }
        } else {
          primeThreadSwitch(null);
        }

        return arr;
      } catch (e) {
        const message = readApiError(e, "Failed to load inbox threads");
        setError(message);
        inboxSurfaceState.failRefresh(message, {
          fallbackData: [],
          unavailable: true,
        });
        return [];
      } finally {
        setLoadingThreads(false);
      }
    },
    [
      commitSelectedThread,
      detailSurfaceState,
      filter,
      inboxSurfaceState,
      primeThreadSwitch,
    ]
  );

  const loadThreadDetail = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return null;

      const requestId = ++detailRequestRef.current;

      try {
        detailSurfaceState.beginRefresh();

        const j = await apiGet(`/api/inbox/threads/${safeThreadId}`);
        if (requestId !== detailRequestRef.current) return null;

        const nextThread = j?.thread || null;

        if (nextThread) {
          setThreads((prev) =>
            prev.map((t) => (s(t?.id) === safeThreadId ? { ...t, ...nextThread } : t))
          );

          commitSelectedThread((current) => {
            const currentId = s(current?.id);

            if (currentId && currentId !== safeThreadId) {
              return current;
            }

            return nextThread;
          });
        }

        detailSurfaceState.succeedRefresh(nextThread);
        return nextThread;
      } catch (e) {
        if (requestId === detailRequestRef.current) {
          const message = readApiError(e, "Failed to load thread detail");
          setError(message);
          detailSurfaceState.failRefresh(message, {
            fallbackData: null,
            unavailable: false,
          });
        }
        return null;
      }
    },
    [commitSelectedThread, detailSurfaceState]
  );

  const loadMessages = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      const requestId = ++messagesRequestRef.current;

      if (!safeThreadId) {
        commitMessagesThreadId("");
        setMessages([]);
        setLoadingMessages(false);
        setLoadingMessagesThreadId("");
        return [];
      }

      const sameThread = messagesThreadIdRef.current === safeThreadId;

      commitMessagesThreadId(safeThreadId);
      setLoadingMessages(true);
      setLoadingMessagesThreadId(safeThreadId);

      if (!sameThread) {
        setMessages([]);
      }

      try {
        const j = await apiGet(`/api/inbox/threads/${safeThreadId}/messages?limit=200`);

        if (requestId !== messagesRequestRef.current) return [];
        if (s(selectedThreadRef.current?.id) !== safeThreadId) return [];

        const nextMessages = Array.isArray(j?.messages) ? j.messages : [];
        setMessages(nextMessages);
        commitMessagesThreadId(safeThreadId);
        return nextMessages;
      } catch (e) {
        if (requestId === messagesRequestRef.current) {
          const message = readApiError(e, "Failed to load thread messages");
          setMessages([]);
          commitMessagesThreadId(safeThreadId);
          setError(message);
        }
        return [];
      } finally {
        if (requestId === messagesRequestRef.current) {
          setLoadingMessages(false);
          setLoadingMessagesThreadId("");
        }
      }
    },
    [commitMessagesThreadId]
  );

  const loadRelatedLead = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      const requestId = ++leadRequestRef.current;

      if (!safeThreadId) {
        commitRelatedLeadThreadId("");
        setRelatedLead(null);
        setLoadingLead(false);
        setLoadingLeadThreadId("");
        leadSurfaceState.succeedRefresh(null);
        return null;
      }

      const sameThread = relatedLeadThreadIdRef.current === safeThreadId;

      commitRelatedLeadThreadId(safeThreadId);
      setLoadingLead(true);
      setLoadingLeadThreadId(safeThreadId);
      leadSurfaceState.beginRefresh();

      if (!sameThread) {
        setRelatedLead(null);
      }

      try {
        let found = null;

        try {
          const direct = await apiGet(
            `/api/leads/by-thread/${encodeURIComponent(safeThreadId)}`
          );
          found = direct?.lead || direct?.relatedLead || null;
        } catch {
          const fallback = await apiGet("/api/leads");
          const arr = Array.isArray(fallback?.leads) ? fallback.leads : [];
          found = arr.find((x) => s(x?.inbox_thread_id) === safeThreadId) || null;
        }

        if (requestId !== leadRequestRef.current) return null;
        if (s(selectedThreadRef.current?.id) !== safeThreadId) return null;

        setRelatedLead(found || null);
        commitRelatedLeadThreadId(safeThreadId);
        leadSurfaceState.succeedRefresh(found || null);
        return found || null;
      } catch (e) {
        if (requestId === leadRequestRef.current) {
          const message = readApiError(e, "Failed to load related lead");
          setRelatedLead(null);
          commitRelatedLeadThreadId(safeThreadId);
          setError(message);
          leadSurfaceState.failRefresh(message, {
            fallbackData: null,
            unavailable: false,
          });
        }
        return null;
      } finally {
        if (requestId === leadRequestRef.current) {
          setLoadingLead(false);
          setLoadingLeadThreadId("");
        }
      }
    },
    [commitRelatedLeadThreadId, leadSurfaceState]
  );

  const syncSelected = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return null;

      const [thread] = await Promise.all([
        loadThreadDetail(safeThreadId),
        loadMessages(safeThreadId),
        loadRelatedLead(safeThreadId),
      ]);

      return thread;
    },
    [loadMessages, loadRelatedLead, loadThreadDetail]
  );

  const markRead = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("read");
        await actionState.runAction("read", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/read`, {})
        );
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(readApiError(e, "Failed to mark thread as read"));
      } finally {
        setBusyAction("");
      }
    },
    [actionState, syncSelected]
  );

  const assignThread = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("assign");
        await actionState.runAction("assign", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/assign`, {
            assignedTo: actorName,
            actor: actorName,
          })
        );
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(readApiError(e, "Failed to assign thread"));
      } finally {
        setBusyAction("");
      }
    },
    [actionState, actorName, loadThreads, syncSelected]
  );

  const activateHandoff = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("handoff");
        await actionState.runAction("handoff", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/handoff/activate`, {
            reason: "manual_review",
            priority: "high",
            assignedTo: actorName,
            actor: actorName,
          })
        );
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(readApiError(e, "Failed to activate handoff"));
      } finally {
        setBusyAction("");
      }
    },
    [actionState, actorName, loadThreads, syncSelected]
  );

  const releaseHandoff = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("release");
        await actionState.runAction("release", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/handoff/release`, {
            actor: actorName,
          })
        );
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(readApiError(e, "Failed to release handoff"));
      } finally {
        setBusyAction("");
      }
    },
    [actionState, actorName, loadThreads, syncSelected]
  );

  const setThreadStatus = useCallback(
    async (threadId, status) => {
      const safeThreadId = s(threadId);
      const safeStatus = s(status);
      if (!safeThreadId || !safeStatus) return;

      try {
        setBusyAction(safeStatus);
        await actionState.runAction(safeStatus, () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/status`, {
            status: safeStatus,
            actor: actorName,
          })
        );
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(readApiError(e, "Failed to update thread status"));
      } finally {
        setBusyAction("");
      }
    },
    [actionState, actorName, loadThreads, syncSelected]
  );

  const sendOperatorReply = useCallback(
    async (selectedThreadArg, replyText, setReplyText) => {
      const safeThreadId = resolveThreadId(selectedThreadArg);
      const safeReply = s(replyText);

      if (!safeThreadId || !safeReply) return null;

      try {
        setBusyAction("reply");
        inboxSurfaceState.beginSave();

        const response = await actionState.runAction("reply", () =>
          apiPost(`/api/inbox/threads/${safeThreadId}/messages`, {
            direction: "outbound",
            senderType: "agent",
            operatorName: actorName,
            messageType: "text",
            text: safeReply,
            releaseHandoff: false,
            meta: {
              source: "inbox_ui",
            },
          })
        );

        if (response?.ok === false) {
          throw new Error(
            response?.error ||
              response?.details?.message ||
              "Failed to send operator reply"
          );
        }

        if (typeof setReplyText === "function") {
          setReplyText("");
        }

        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);

        inboxSurfaceState.succeedSave({
          message: "Reply accepted. Waiting for outbound attempt status.",
        });

        return response;
      } catch (e) {
        const message = readApiError(e, "Failed to send operator reply");
        setError(message);
        inboxSurfaceState.failSave(message);
        return null;
      } finally {
        setBusyAction("");
      }
    },
    [actionState, actorName, inboxSurfaceState, loadThreads, syncSelected]
  );

  const openLeadDetail = useCallback(
    (relatedLeadArg) => {
      if (!relatedLeadArg?.id) return;

      navigate("/leads", {
        state: {
          selectedLeadId: relatedLeadArg.id,
        },
      });
    },
    [navigate]
  );

  return {
    threads,
    setThreads,
    messages,
    setMessages,
    messagesThreadId,
    loadingMessagesThreadId,

    selectedThread: selectedThreadState,
    setSelectedThread: commitSelectedThread,
    openThread,

    relatedLead,
    setRelatedLead,
    relatedLeadThreadId,
    loadingLeadThreadId,

    loadingThreads,
    loadingMessages,
    loadingLead,
    busyAction,

    error,
    setError,
    dbDisabled,

    surface: {
      ...inboxSurfaceState.surface,
      refresh: loadThreads,
      clearSaveState: inboxSurfaceState.clearSaveState,
    },
    detailSurface: {
      ...detailSurfaceState.surface,
      refresh: () => loadThreadDetail(selectedThreadRef.current?.id),
    },
    leadSurface: {
      ...leadSurfaceState.surface,
      refresh: () => loadRelatedLead(selectedThreadRef.current?.id),
    },
    actionState,
    actionLoading: actionState.pendingAction,

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
    openLeadDetail,
  };
}
