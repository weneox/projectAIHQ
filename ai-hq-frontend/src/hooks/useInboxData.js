import { useCallback, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";

export function useInboxData({ filter, operatorName, navigate }) {
  const actorName = String(operatorName || "").trim() || "operator";
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [relatedLead, setRelatedLead] = useState(null);

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [dbDisabled, setDbDisabled] = useState(false);

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
          setRelatedLead(null);
        }
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoadingThreads(false);
      }
    },
    [filter]
  );

  const loadThreadDetail = useCallback(async (threadId) => {
    if (!threadId) return;

    try {
      const j = await apiGet(`/api/inbox/threads/${threadId}`);
      if (j?.thread) {
        setSelectedThread(j.thread);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, ...j.thread } : t))
        );
      }
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, []);

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      const j = await apiGet(`/api/inbox/threads/${threadId}/messages?limit=200`);
      setMessages(Array.isArray(j?.messages) ? j.messages : []);
    } catch (e) {
      setMessages([]);
      setError(String(e?.message || e));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadRelatedLead = useCallback(async (threadId) => {
    if (!threadId) {
      setRelatedLead(null);
      return;
    }

    try {
      setLoadingLead(true);
      const j = await apiGet("/api/leads");
      const arr = Array.isArray(j?.leads) ? j.leads : [];
      const found = arr.find((x) => String(x?.inbox_thread_id || "") === String(threadId));
      setRelatedLead(found || null);
    } catch (e) {
      setRelatedLead(null);
      setError(String(e?.message || e));
    } finally {
      setLoadingLead(false);
    }
  }, []);

  const syncSelected = useCallback(
    async (threadId) => {
      await Promise.all([
        loadThreadDetail(threadId),
        loadMessages(threadId),
        loadRelatedLead(threadId),
      ]);
    },
    [loadMessages, loadRelatedLead, loadThreadDetail]
  );

  const markRead = useCallback(
    async (threadId) => {
      if (!threadId) return;

      try {
        setBusyAction("read");
        await apiPost(`/api/inbox/threads/${threadId}/read`, {});
        await syncSelected(threadId);
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
      if (!threadId) return;

      try {
        setBusyAction("assign");
        await apiPost(`/api/inbox/threads/${threadId}/assign`, {
          assignedTo: actorName,
          actor: actorName,
        });
        await loadThreads(threadId);
        await syncSelected(threadId);
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
      if (!threadId) return;

      try {
        setBusyAction("handoff");
        await apiPost(`/api/inbox/threads/${threadId}/handoff/activate`, {
          reason: "manual_review",
          priority: "high",
          assignedTo: actorName,
          actor: actorName,
        });
        await loadThreads(threadId);
        await syncSelected(threadId);
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
      if (!threadId) return;

      try {
        setBusyAction("release");
        await apiPost(`/api/inbox/threads/${threadId}/handoff/release`, {
          actor: actorName,
        });
        await loadThreads(threadId);
        await syncSelected(threadId);
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
      if (!threadId) return;

      try {
        setBusyAction(status);
        await apiPost(`/api/inbox/threads/${threadId}/status`, {
          status,
          actor: actorName,
        });
        await loadThreads(threadId);
        await syncSelected(threadId);
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
      if (!selectedThreadArg?.id) return;
      if (!replyText.trim()) return;

      try {
        setBusyAction("reply");
        await apiPost(`/api/inbox/threads/${selectedThreadArg.id}/messages`, {
          direction: "outbound",
          senderType: "agent",
          operatorName: actorName,
          messageType: "text",
          text: replyText.trim(),
          releaseHandoff: false,
          meta: {
            source: "inbox_ui",
          },
        });

        setReplyText("");
        await loadThreads(selectedThreadArg.id);
        await syncSelected(selectedThreadArg.id);
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
    selectedThread,
    setSelectedThread,
    relatedLead,
    setRelatedLead,
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
