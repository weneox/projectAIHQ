import { useCallback, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { useSurfaceActionState } from "../components/settings/hooks/useSurfaceActionState.js";
import { useSettingsSurfaceState } from "../pages/Settings/hooks/useSettingsSurfaceState.js";

export function useInboxData({ operatorName, navigate }) {
  const actorName = String(operatorName || "").trim() || "operator";
  const actionState = useSurfaceActionState();
  const [messages, setMessages] = useState([]);
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
  } = useSettingsSurfaceState({
    initialData: {
      threads: [],
      dbDisabled: false,
    },
  });
  const threads = Array.isArray(data?.threads) ? data.threads : [];
  const dbDisabled = Boolean(data?.dbDisabled);

  const loadThreads = useCallback(
    async (preferredId = "") => {
      try {
        beginRefresh();

        const j = await apiGet("/api/inbox/threads");
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
    [beginRefresh, failRefresh, setData, succeedRefresh]
  );

  const loadThreadDetail = useCallback(async (threadId) => {
    if (!threadId) return;

    try {
      setLoadingThreadDetail(true);
      setThreadDetailError("");
      const j = await apiGet(`/api/inbox/threads/${threadId}`);
      if (j?.thread) {
        setSelectedThread(j.thread);
        setData((prev) => ({
          ...prev,
          threads: (Array.isArray(prev?.threads) ? prev.threads : []).map((t) => (t.id === threadId ? { ...t, ...j.thread } : t)),
          dbDisabled: Boolean(prev?.dbDisabled),
        }));
      }
    } catch (e) {
      setThreadDetailError(String(e?.message || e || "Failed to load thread detail"));
    } finally {
      setLoadingThreadDetail(false);
    }
  }, [setData]);

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      setMessagesError("");
      const j = await apiGet(`/api/inbox/threads/${threadId}/messages?limit=200`);
      setMessages(Array.isArray(j?.messages) ? j.messages : []);
    } catch (e) {
      setMessages([]);
      setMessagesError(String(e?.message || e || "Failed to load messages"));
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
      setLeadError("");
      const j = await apiGet("/api/leads");
      const arr = Array.isArray(j?.leads) ? j.leads : [];
      const found = arr.find((x) => String(x?.inbox_thread_id || "") === String(threadId));
      setRelatedLead(found || null);
    } catch (e) {
      setRelatedLead(null);
      setLeadError(String(e?.message || e || "Failed to load related lead"));
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
        beginSave();
        await actionState.runAction("read", () => apiPost(`/api/inbox/threads/${threadId}/read`, {}));
        await syncSelected(threadId);
        succeedSave({ message: "Thread marked as read." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to mark thread as read"));
      }
    },
    [actionState, beginSave, failSave, succeedSave, syncSelected]
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
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Thread assigned." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to assign thread"));
      }
    },
    [actionState, actorName, beginSave, failSave, loadThreads, succeedSave, syncSelected]
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
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Handoff activated." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to activate handoff"));
      }
    },
    [actionState, actorName, beginSave, failSave, loadThreads, succeedSave, syncSelected]
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
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: "Handoff released." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to release handoff"));
      }
    },
    [actionState, actorName, beginSave, failSave, loadThreads, succeedSave, syncSelected]
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
        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({ message: status === "closed" ? "Thread closed." : "Thread resolved." });
      } catch (e) {
        failSave(String(e?.message || e || "Failed to update thread status"));
      }
    },
    [actionState, actorName, beginSave, failSave, loadThreads, succeedSave, syncSelected]
  );

  const sendOperatorReply = useCallback(
    async (threadId, replyText) => {
      if (!threadId) return false;
      if (!replyText.trim()) {
        failSave("Reply text is required");
        return false;
      }

      try {
        beginSave();
        await actionState.runAction("reply", () =>
          apiPost(`/api/inbox/threads/${threadId}/messages`, {
            direction: "outbound",
            senderType: "agent",
            operatorName: actorName,
            messageType: "text",
            text: replyText.trim(),
            releaseHandoff: false,
            meta: {
              source: "inbox_ui",
            },
          })
        );

        await loadThreads(threadId);
        await syncSelected(threadId);
        succeedSave({
          message:
            "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
        });
        return true;
      } catch (e) {
        failSave(String(e?.message || e || "Failed to send operator reply"));
        return false;
      }
    },
    [actionState, actorName, beginSave, failSave, loadThreads, succeedSave, syncSelected]
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
    setThreads: (next) =>
      setData((prev) => ({
        ...prev,
        threads: typeof next === "function" ? next(Array.isArray(prev?.threads) ? prev.threads : []) : next,
        dbDisabled: Boolean(prev?.dbDisabled),
      })),
    messages,
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
    openLeadDetail,
  };
}
