import { useCallback, useRef, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";

function s(value) {
  return String(value ?? "").trim();
}

export function useInboxData({ filter, operatorName, navigate }) {
  const actorName = s(operatorName) || "operator";

  const selectedThreadRef = useRef(null);
  const messagesThreadIdRef = useRef("");
  const relatedLeadThreadIdRef = useRef("");

  const messagesRequestRef = useRef(0);
  const leadRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

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
      }
    },
    [commitMessagesThreadId, commitRelatedLeadThreadId, commitSelectedThread]
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

        const qs =
          filter === "handoff"
            ? "/api/inbox/threads?handoffOnly=true"
            : "/api/inbox/threads";

        const j = await apiGet(qs);
        const arr = Array.isArray(j?.threads) ? j.threads : [];

        setThreads(arr);
        setDbDisabled(Boolean(j?.dbDisabled));

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
          }
        } else {
          primeThreadSwitch(null);
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoadingThreads(false);
      }
    },
    [commitSelectedThread, filter, primeThreadSwitch]
  );

  const loadThreadDetail = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      const requestId = ++detailRequestRef.current;

      try {
        const j = await apiGet(`/api/inbox/threads/${safeThreadId}`);
        if (requestId !== detailRequestRef.current) return;

        if (j?.thread) {
          setThreads((prev) =>
            prev.map((t) => (s(t?.id) === safeThreadId ? { ...t, ...j.thread } : t))
          );

          commitSelectedThread((current) => {
            const currentId = s(current?.id);

            if (currentId && currentId !== safeThreadId) {
              return current;
            }

            return j.thread;
          });
        }
      } catch (e) {
        if (requestId === detailRequestRef.current) {
          setError(String(e?.message || e));
        }
      }
    },
    [commitSelectedThread]
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
        return;
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

        if (requestId !== messagesRequestRef.current) return;
        if (s(selectedThreadRef.current?.id) !== safeThreadId) return;

        setMessages(Array.isArray(j?.messages) ? j.messages : []);
        commitMessagesThreadId(safeThreadId);
      } catch (e) {
        if (requestId === messagesRequestRef.current) {
          setMessages([]);
          commitMessagesThreadId(safeThreadId);
          setError(String(e?.message || e));
        }
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
        return;
      }

      const sameThread = relatedLeadThreadIdRef.current === safeThreadId;

      commitRelatedLeadThreadId(safeThreadId);
      setLoadingLead(true);
      setLoadingLeadThreadId(safeThreadId);

      if (!sameThread) {
        setRelatedLead(null);
      }

      try {
        const j = await apiGet("/api/leads");
        const arr = Array.isArray(j?.leads) ? j.leads : [];
        const found = arr.find((x) => s(x?.inbox_thread_id) === safeThreadId);

        if (requestId !== leadRequestRef.current) return;
        if (s(selectedThreadRef.current?.id) !== safeThreadId) return;

        setRelatedLead(found || null);
        commitRelatedLeadThreadId(safeThreadId);
      } catch (e) {
        if (requestId === leadRequestRef.current) {
          setRelatedLead(null);
          commitRelatedLeadThreadId(safeThreadId);
          setError(String(e?.message || e));
        }
      } finally {
        if (requestId === leadRequestRef.current) {
          setLoadingLead(false);
          setLoadingLeadThreadId("");
        }
      }
    },
    [commitRelatedLeadThreadId]
  );

  const syncSelected = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      await Promise.all([
        loadThreadDetail(safeThreadId),
        loadMessages(safeThreadId),
        loadRelatedLead(safeThreadId),
      ]);
    },
    [loadMessages, loadRelatedLead, loadThreadDetail]
  );

  const markRead = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("read");
        await apiPost(`/api/inbox/threads/${safeThreadId}/read`, {});
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [syncSelected]
  );

  const assignThread = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("assign");
        await apiPost(`/api/inbox/threads/${safeThreadId}/assign`, {
          assignedTo: actorName,
          actor: actorName,
        });
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [actorName, loadThreads, syncSelected]
  );

  const activateHandoff = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("handoff");
        await apiPost(`/api/inbox/threads/${safeThreadId}/handoff/activate`, {
          reason: "manual_review",
          priority: "high",
          assignedTo: actorName,
          actor: actorName,
        });
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [actorName, loadThreads, syncSelected]
  );

  const releaseHandoff = useCallback(
    async (threadId) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction("release");
        await apiPost(`/api/inbox/threads/${safeThreadId}/handoff/release`, {
          actor: actorName,
        });
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [actorName, loadThreads, syncSelected]
  );

  const setThreadStatus = useCallback(
    async (threadId, status) => {
      const safeThreadId = s(threadId);
      if (!safeThreadId) return;

      try {
        setBusyAction(status);
        await apiPost(`/api/inbox/threads/${safeThreadId}/status`, {
          status,
          actor: actorName,
        });
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [actorName, loadThreads, syncSelected]
  );

  const sendOperatorReply = useCallback(
    async (selectedThreadArg, replyText, setReplyText) => {
      const safeThreadId = s(selectedThreadArg?.id);
      const safeReply = s(replyText);

      if (!safeThreadId || !safeReply) return;

      try {
        setBusyAction("reply");
        await apiPost(`/api/inbox/threads/${safeThreadId}/messages`, {
          direction: "outbound",
          senderType: "agent",
          operatorName: actorName,
          messageType: "text",
          text: safeReply,
          releaseHandoff: false,
          meta: {
            source: "inbox_ui",
          },
        });

        setReplyText("");
        await loadThreads(safeThreadId);
        await syncSelected(safeThreadId);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusyAction("");
      }
    },
    [actorName, loadThreads, syncSelected]
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
