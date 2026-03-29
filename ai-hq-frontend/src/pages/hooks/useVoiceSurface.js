import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  endLiveVoiceSession,
  getLiveVoiceSession,
  getVoiceCall,
  getVoiceOverview,
  joinVoiceCall,
  listLiveVoiceSessions,
  listVoiceCallEvents,
  listVoiceCalls,
  listVoiceCallSessions,
  requestVoiceHandoff,
  takeoverVoiceSession,
} from "../../api/voice.js";
import { useSurfaceActionState } from "../../components/settings/hooks/useSurfaceActionState.js";
import { useSettingsSurfaceState } from "../Settings/hooks/useSettingsSurfaceState.js";

const EMPTY_SURFACE = {
  overview: null,
  calls: [],
  liveSessions: [],
};

const EMPTY_DETAIL = {
  selectedCall: null,
  selectedLiveSession: null,
  events: [],
  sessions: [],
};

function s(v, d = "") {
  return String(v ?? d).trim();
}

function getErrorMessage(error, fallback) {
  return s(error?.message || error || fallback, fallback);
}

function pickCallId(x) {
  return s(x?.id || x?.callId || x?.call_id || x?.sid);
}

function pickSessionId(x) {
  return s(x?.id || x?.sessionId || x?.session_id);
}

function pickSessionCallId(x) {
  return s(x?.callId || x?.call_id || x?.voiceCallId || x?.voice_call_id);
}

function pickStatus(x) {
  return s(x?.status || x?.callStatus || x?.call_status || "unknown").toLowerCase();
}

function isLiveStatus(status) {
  return ["live", "active", "in_progress", "ongoing", "ringing", "queued", "bridged"].includes(
    String(status || "").toLowerCase()
  );
}

function pickOverviewData(x) {
  if (!x || typeof x !== "object") return {};
  if (x?.overview && typeof x.overview === "object") return x.overview;
  return x;
}

function pickDuration(x) {
  const value = Number(x?.durationSec ?? x?.duration_sec ?? x?.duration ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function findPreferredLiveSessionId({
  preferredLiveSessionId = "",
  liveSessions = [],
  sessions = [],
  callId = "",
} = {}) {
  const preferred = s(preferredLiveSessionId);
  if (preferred && liveSessions.some((item) => pickSessionId(item) === preferred)) {
    return preferred;
  }

  const sessionIds = new Set((sessions || []).map((item) => pickSessionId(item)).filter(Boolean));
  for (const item of liveSessions || []) {
    const liveId = pickSessionId(item);
    if (liveId && sessionIds.has(liveId)) return liveId;
  }

  const normalizedCallId = s(callId);
  if (normalizedCallId) {
    const byCall = (liveSessions || []).find(
      (item) => pickSessionCallId(item) === normalizedCallId
    );
    if (byCall) return pickSessionId(byCall);
  }

  return "";
}

export function useVoiceSurface() {
  const [selectedId, setSelectedId] = useState("");
  const [selectedLiveSessionId, setSelectedLiveSessionId] = useState("");
  const selectedIdRef = useRef("");
  const selectedLiveSessionIdRef = useRef("");
  const liveSessionsRef = useRef([]);
  const actionState = useSurfaceActionState();

  const {
    data,
    setData: _setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: EMPTY_SURFACE,
  });

  const {
    data: detail,
    setData: setDetail,
    surface: detailSurface,
    beginRefresh: beginDetailRefresh,
    succeedRefresh: succeedDetailRefresh,
    failRefresh: failDetailRefresh,
  } = useSettingsSurfaceState({
    initialData: EMPTY_DETAIL,
    initialLoading: false,
  });

  const refresh = useCallback(
    async ({
      preferredId = "",
      preferredLiveSessionId = "",
      silent = false,
    } = {}) => {
      if (!silent) beginRefresh();

      try {
        const [overview, calls, liveSessions] = await Promise.all([
          getVoiceOverview(),
          listVoiceCalls({ limit: 50 }),
          listLiveVoiceSessions({ limit: 50 }),
        ]);

        const safeCalls = Array.isArray(calls) ? calls : [];
        const safeLiveSessions = Array.isArray(liveSessions) ? liveSessions : [];
        liveSessionsRef.current = safeLiveSessions;

        const nextData = {
          overview: overview || null,
          calls: safeCalls,
          liveSessions: safeLiveSessions,
        };
        succeedRefresh(nextData);

        const nextSelectedId = s(
          preferredId || selectedIdRef.current || pickCallId(safeCalls[0]) || ""
        );
        const nextSelectedLiveSessionId = findPreferredLiveSessionId({
          preferredLiveSessionId:
            preferredLiveSessionId || selectedLiveSessionIdRef.current,
          liveSessions: safeLiveSessions,
          callId: nextSelectedId,
        });

        setSelectedId(nextSelectedId);
        setSelectedLiveSessionId(nextSelectedLiveSessionId);
        selectedIdRef.current = nextSelectedId;
        selectedLiveSessionIdRef.current = nextSelectedLiveSessionId;

        if (!nextSelectedId) {
          setDetail(EMPTY_DETAIL);
        }

        return nextData;
      } catch (error) {
        return failRefresh(
          getErrorMessage(error, "Voice operations are temporarily unavailable."),
          {
            fallbackData: EMPTY_SURFACE,
            unavailable: true,
          }
        );
      }
    },
    [beginRefresh, failRefresh, setDetail, succeedRefresh]
  );

  const openCall = useCallback(
    async (callId, preferredLiveSessionId = "") => {
      const nextId = s(callId);
      if (!nextId) return;

      setSelectedId(nextId);
      selectedIdRef.current = nextId;
      beginDetailRefresh();

      try {
        const [callRes, events, sessions] = await Promise.all([
          getVoiceCall(nextId),
          listVoiceCallEvents(nextId, { limit: 100 }),
          listVoiceCallSessions(nextId, { limit: 50 }),
        ]);

        const safeSessions = Array.isArray(sessions) ? sessions : [];
        const liveSessionId = findPreferredLiveSessionId({
          preferredLiveSessionId:
            preferredLiveSessionId || selectedLiveSessionIdRef.current,
          liveSessions: liveSessionsRef.current,
          sessions: safeSessions,
          callId: nextId,
        });

        let selectedLiveSession = null;
        if (liveSessionId) {
          selectedLiveSession = await getLiveVoiceSession(liveSessionId);
        }

        setSelectedLiveSessionId(liveSessionId);
        selectedLiveSessionIdRef.current = liveSessionId;

        succeedDetailRefresh({
          selectedCall:
            callRes?.call && typeof callRes.call === "object"
              ? callRes.call
              : callRes || null,
          selectedLiveSession,
          events: Array.isArray(events) ? events : [],
          sessions: safeSessions,
        });
      } catch (error) {
        failDetailRefresh(
          getErrorMessage(error, "Voice call detail is temporarily unavailable."),
          {
            fallbackData: EMPTY_DETAIL,
            unavailable: false,
          }
        );
      }
    },
    [beginDetailRefresh, failDetailRefresh, succeedDetailRefresh]
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    selectedLiveSessionIdRef.current = selectedLiveSessionId;
  }, [selectedLiveSessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    openCall(selectedId);
  }, [openCall, selectedId]);

  useEffect(() => {
    const hasLiveSession =
      (Array.isArray(data?.liveSessions) && data.liveSessions.length > 0) ||
      !!selectedLiveSessionId;
    if (!hasLiveSession) return undefined;

    const timer = window.setInterval(() => {
      refresh({
        preferredId: selectedIdRef.current,
        preferredLiveSessionId: selectedLiveSessionIdRef.current,
        silent: true,
      }).then(() => {
        if (selectedIdRef.current) {
          openCall(selectedIdRef.current, selectedLiveSessionIdRef.current);
        }
      });
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [data?.liveSessions, openCall, refresh, selectedLiveSessionId]);

  const calls = data?.calls || [];
  const liveSessions = data?.liveSessions || [];
  const overview = data?.overview || null;
  const overviewData = useMemo(() => pickOverviewData(overview), [overview]);
  const selectedCall = detail?.selectedCall || null;
  const selectedLiveSession = detail?.selectedLiveSession || null;
  const events = detail?.events || [];
  const sessions = detail?.sessions || [];
  const selectedStatus = useMemo(() => pickStatus(selectedCall), [selectedCall]);
  const selectedLive = useMemo(() => isLiveStatus(selectedStatus), [selectedStatus]);
  const selectedLiveSessionStatus = useMemo(
    () => pickStatus(selectedLiveSession),
    [selectedLiveSession]
  );

  const liveCount = useMemo(
    () => calls.filter((item) => isLiveStatus(pickStatus(item))).length,
    [calls]
  );
  const totalCount = useMemo(() => calls.length, [calls]);
  const totalMinutes = useMemo(
    () => Math.floor(calls.reduce((sum, item) => sum + pickDuration(item), 0) / 60),
    [calls]
  );

  const refreshAndReopen = useCallback(
    async (preferredLiveSessionId = "") => {
      await refresh({
        preferredId: selectedIdRef.current,
        preferredLiveSessionId,
      });
      if (selectedIdRef.current) {
        await openCall(selectedIdRef.current, preferredLiveSessionId);
      }
    },
    [openCall, refresh]
  );

  const joinSelectedCall = useCallback(async () => {
    if (!selectedId) return null;
    const sessionId = pickSessionId(sessions?.[0]);
    if (!sessionId) {
      return failSave("No voice session is available for operator join.");
    }

    beginSave();
    try {
      await actionState.runAction("join", () =>
        joinVoiceCall(selectedId, {
          sessionId,
          joinMode: "live",
        })
      );
      await refreshAndReopen(selectedLiveSessionIdRef.current);
      return succeedSave({ message: "Operator join requested." });
    } catch (error) {
      return failSave(getErrorMessage(error, "Unable to join the selected call."));
    }
  }, [
    actionState,
    beginSave,
    failSave,
    refreshAndReopen,
    selectedId,
    sessions,
    succeedSave,
  ]);

  const requestSelectedLiveHandoff = useCallback(async () => {
    const sessionId = s(selectedLiveSessionIdRef.current);
    if (!sessionId) {
      return failSave("No live session is selected for handoff.");
    }

    beginSave();
    try {
      await actionState.runAction("handoff", () =>
        requestVoiceHandoff(sessionId, {})
      );
      await refreshAndReopen(sessionId);
      return succeedSave({ message: "Operator handoff requested." });
    } catch (error) {
      return failSave(getErrorMessage(error, "Unable to request handoff."));
    }
  }, [actionState, beginSave, failSave, refreshAndReopen, succeedSave]);

  const takeoverSelectedLiveSession = useCallback(async () => {
    const sessionId = s(selectedLiveSessionIdRef.current);
    if (!sessionId) {
      return failSave("No live session is selected for takeover.");
    }

    beginSave();
    try {
      await actionState.runAction("takeover", () =>
        takeoverVoiceSession(sessionId, {})
      );
      await refreshAndReopen(sessionId);
      return succeedSave({ message: "Operator takeover activated." });
    } catch (error) {
      return failSave(
        getErrorMessage(error, "Unable to take over the live session.")
      );
    }
  }, [actionState, beginSave, failSave, refreshAndReopen, succeedSave]);

  const endSelectedLiveSession = useCallback(async () => {
    const sessionId = s(selectedLiveSessionIdRef.current);
    if (!sessionId) {
      return failSave("No live session is selected to end.");
    }

    beginSave();
    try {
      await actionState.runAction("end", () =>
        endLiveVoiceSession(sessionId, {})
      );
      await refreshAndReopen("");
      return succeedSave({ message: "Live session ended." });
    } catch (error) {
      return failSave(getErrorMessage(error, "Unable to end the live session."));
    }
  }, [actionState, beginSave, failSave, refreshAndReopen, succeedSave]);

  const canControlSelectedLiveSession = Boolean(selectedLiveSessionId);
  const canRequestHandoff =
    canControlSelectedLiveSession &&
    selectedLiveSessionStatus !== "completed" &&
    selectedLiveSessionStatus !== "agent_ringing";
  const canTakeover =
    canControlSelectedLiveSession &&
    selectedLiveSessionStatus !== "completed" &&
    selectedLiveSessionStatus !== "agent_live";
  const canEnd =
    canControlSelectedLiveSession &&
    selectedLiveSessionStatus !== "completed";

  return {
    overviewData,
    calls,
    liveSessions,
    liveCount,
    totalCount,
    totalMinutes,
    selectedId,
    setSelectedId,
    selectedLiveSessionId,
    setSelectedLiveSessionId,
    openCall,
    selectedCall,
    selectedLiveSession,
    selectedStatus,
    selectedLive,
    selectedLiveSessionStatus,
    events,
    sessions,
    surface: {
      ...surface,
      refresh: () =>
        refresh({
          preferredId: selectedIdRef.current,
          preferredLiveSessionId: selectedLiveSessionIdRef.current,
        }),
      clearSaveState,
    },
    detailSurface: {
      ...detailSurface,
      refresh: selectedId
        ? () => openCall(selectedId, selectedLiveSessionIdRef.current)
        : null,
    },
    actionState,
    joinSelectedCall,
    requestSelectedLiveHandoff,
    takeoverSelectedLiveSession,
    endSelectedLiveSession,
    canControlSelectedLiveSession,
    canRequestHandoff,
    canTakeover,
    canEnd,
  };
}
