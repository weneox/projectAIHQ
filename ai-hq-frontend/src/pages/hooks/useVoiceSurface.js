import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getVoiceCall,
  getVoiceOverview,
  joinVoiceCall,
  listVoiceCallEvents,
  listVoiceCalls,
  listVoiceCallSessions,
} from "../../api/voice.js";
import { useSurfaceActionState } from "../../components/settings/hooks/useSurfaceActionState.js";
import { useSettingsSurfaceState } from "../Settings/hooks/useSettingsSurfaceState.js";

const EMPTY_SURFACE = {
  overview: null,
  calls: [],
};

const EMPTY_DETAIL = {
  selectedCall: null,
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

export function useVoiceSurface() {
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const actionState = useSurfaceActionState();

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
    async (preferredId = "") => {
      beginRefresh();
      try {
        const [overview, calls] = await Promise.all([getVoiceOverview(), listVoiceCalls({ limit: 50 })]);
        const safeCalls = Array.isArray(calls) ? calls : [];
        const nextData = {
          overview: overview || null,
          calls: safeCalls,
        };
        succeedRefresh(nextData);

        const nextSelectedId = String(preferredId || selectedIdRef.current || pickCallId(safeCalls[0]) || "").trim();
        setSelectedId(nextSelectedId);
        if (!nextSelectedId) {
          setDetail(EMPTY_DETAIL);
        }
        return nextData;
      } catch (error) {
        return failRefresh(getErrorMessage(error, "Voice operations are temporarily unavailable."), {
          fallbackData: EMPTY_SURFACE,
          unavailable: true,
        });
      }
    },
    [beginRefresh, failRefresh, setDetail, succeedRefresh]
  );

  const openCall = useCallback(
    async (callId) => {
      const nextId = String(callId || "").trim();
      if (!nextId) return;
      setSelectedId(nextId);
      beginDetailRefresh();
      try {
        const [callRes, events, sessions] = await Promise.all([
          getVoiceCall(nextId),
          listVoiceCallEvents(nextId, { limit: 100 }),
          listVoiceCallSessions(nextId, { limit: 50 }),
        ]);
        succeedDetailRefresh({
          selectedCall: callRes?.call && typeof callRes.call === "object" ? callRes.call : callRes || null,
          events: Array.isArray(events) ? events : [],
          sessions: Array.isArray(sessions) ? sessions : [],
        });
      } catch (error) {
        failDetailRefresh(getErrorMessage(error, "Voice call detail is temporarily unavailable."), {
          fallbackData: EMPTY_DETAIL,
          unavailable: false,
        });
      }
    },
    [beginDetailRefresh, failDetailRefresh, succeedDetailRefresh]
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    openCall(selectedId);
  }, [openCall, selectedId]);

  const calls = data?.calls || [];
  const overview = data?.overview || null;
  const overviewData = useMemo(() => pickOverviewData(overview), [overview]);
  const selectedCall = detail?.selectedCall || null;
  const events = detail?.events || [];
  const sessions = detail?.sessions || [];
  const selectedStatus = useMemo(() => pickStatus(selectedCall), [selectedCall]);
  const selectedLive = useMemo(() => isLiveStatus(selectedStatus), [selectedStatus]);

  const liveCount = useMemo(() => calls.filter((item) => isLiveStatus(pickStatus(item))).length, [calls]);
  const totalCount = useMemo(() => calls.length, [calls]);
  const totalMinutes = useMemo(() => Math.floor(calls.reduce((sum, item) => sum + pickDuration(item), 0) / 60), [calls]);

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
      await openCall(selectedId);
      await refresh(selectedId);
      return succeedSave({ message: "Operator join requested." });
    } catch (error) {
      return failSave(getErrorMessage(error, "Unable to join the selected call."));
    }
  }, [actionState, beginSave, failSave, openCall, refresh, selectedId, sessions, succeedSave]);

  return {
    overviewData,
    calls,
    liveCount,
    totalCount,
    totalMinutes,
    selectedId,
    setSelectedId,
    openCall,
    selectedCall,
    selectedStatus,
    selectedLive,
    events,
    sessions,
    surface: {
      ...surface,
      refresh: () => refresh(selectedId),
      clearSaveState,
    },
    detailSurface: {
      ...detailSurface,
      refresh: selectedId ? () => openCall(selectedId) : null,
    },
    actionState,
    joinSelectedCall,
  };
}
