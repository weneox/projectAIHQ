import { useCallback, useEffect } from "react";

import {
  listThreadOutboundAttempts,
  markOutboundAttemptDead,
  resendOutboundAttempt,
} from "../../../api/inbox.js";
import { useSurfaceActionState } from "../../settings/hooks/useSurfaceActionState.js";
import { useSettingsSurfaceState } from "../../../pages/Settings/hooks/useSettingsSurfaceState.js";

const EMPTY_ATTEMPTS = [];

function s(v) {
  return String(v ?? "").trim();
}

function getErrorMessage(error, fallback) {
  return s(error?.message || error || fallback) || fallback;
}

export function useThreadOutboundAttemptsSurface({ threadId = "", actor = "operator" } = {}) {
  const actionState = useSurfaceActionState();
  const {
    data: attempts,
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
    initialData: EMPTY_ATTEMPTS,
  });

  const load = useCallback(async () => {
    if (!threadId) {
      return succeedRefresh([]);
    }

    beginRefresh();
    try {
      const res = await listThreadOutboundAttempts(threadId, { limit: 30 });
      return succeedRefresh(Array.isArray(res?.attempts) ? res.attempts : []);
    } catch (error) {
      return failRefresh(getErrorMessage(error, "Thread delivery attempts are temporarily unavailable."), {
        fallbackData: [],
        unavailable: true,
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh, threadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (ev) => {
      const evThreadId = s(ev?.detail?.threadId);
      if (!threadId) return;
      if (!evThreadId || evThreadId === threadId) {
        load();
      }
    };

    window.addEventListener("inbox:retry-queue-refresh", onRefresh);
    return () => {
      window.removeEventListener("inbox:retry-queue-refresh", onRefresh);
    };
  }, [load, threadId]);

  const handleResend = useCallback(
    async (attemptId) => {
      if (!attemptId) return;
      beginSave();
      try {
        await actionState.runAction(`retry:${attemptId}`, () =>
          resendOutboundAttempt(attemptId, {
            actor,
            retryDelaySeconds: 0,
          })
        );
        const refreshed = await load();
        if (refreshed) setData(refreshed);
        return succeedSave({ message: "Delivery retry requested." });
      } catch (error) {
        return failSave(getErrorMessage(error, "Unable to retry this delivery attempt."));
      }
    },
    [actionState, actor, beginSave, failSave, load, setData, succeedSave]
  );

  const handleMarkDead = useCallback(
    async (attemptId) => {
      if (!attemptId) return;
      beginSave();
      try {
        await actionState.runAction(`dead:${attemptId}`, () =>
          markOutboundAttemptDead(attemptId, { actor })
        );
        const refreshed = await load();
        if (refreshed) setData(refreshed);
        return succeedSave({ message: "Delivery attempt marked dead." });
      } catch (error) {
        return failSave(getErrorMessage(error, "Unable to mark this delivery attempt as dead."));
      }
    },
    [actionState, actor, beginSave, failSave, load, setData, succeedSave]
  );

  return {
    attempts: Array.isArray(attempts) ? attempts : [],
    surface: {
      ...surface,
      refresh: load,
      clearSaveState,
    },
    actionState,
    handleResend,
    handleMarkDead,
  };
}
