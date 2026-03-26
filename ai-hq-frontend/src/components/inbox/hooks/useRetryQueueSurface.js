import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getOutboundSummary,
  listFailedOutboundAttempts,
  markOutboundAttemptDead,
  resendOutboundAttempt,
} from "../../../api/inbox.js";
import { useSurfaceActionState } from "../../settings/hooks/useSurfaceActionState.js";
import { useSettingsSurfaceState } from "../../../pages/Settings/hooks/useSettingsSurfaceState.js";

const EMPTY_DATA = {
  summary: null,
  attempts: [],
};

function s(v) {
  return String(v ?? "").trim();
}

function getErrorMessage(error, fallback) {
  return s(error?.message || error || fallback) || fallback;
}

export function useRetryQueueSurface({ tenantKey = "neox", actor = "operator" } = {}) {
  const [statusFilter, setStatusFilter] = useState("");
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
    initialData: EMPTY_DATA,
  });

  const load = useCallback(async () => {
    beginRefresh();
    try {
      const [sumRes, failedRes] = await Promise.all([
        getOutboundSummary({ tenantKey }),
        listFailedOutboundAttempts({
          tenantKey,
          limit: 50,
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);

      return succeedRefresh({
        summary: sumRes?.summary || null,
        attempts: Array.isArray(failedRes?.attempts) ? failedRes.attempts : [],
      });
    } catch (error) {
      return failRefresh(getErrorMessage(error, "Retry queue is temporarily unavailable."), {
        fallbackData: EMPTY_DATA,
        unavailable: true,
      });
    }
  }, [beginRefresh, failRefresh, statusFilter, succeedRefresh, tenantKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      load();
    };

    window.addEventListener("inbox:retry-queue-refresh", onRefresh);
    return () => {
      window.removeEventListener("inbox:retry-queue-refresh", onRefresh);
    };
  }, [load]);

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
        return succeedSave({ message: "Retry queued." });
      } catch (error) {
        return failSave(getErrorMessage(error, "Unable to retry this outbound attempt."));
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
        return succeedSave({ message: "Attempt marked dead." });
      } catch (error) {
        return failSave(getErrorMessage(error, "Unable to mark this outbound attempt as dead."));
      }
    },
    [actionState, actor, beginSave, failSave, load, setData, succeedSave]
  );

  const cards = useMemo(
    () => [
      ["Queued", Number(data?.summary?.queued || 0)],
      ["Sending", Number(data?.summary?.sending || 0)],
      ["Failed", Number(data?.summary?.failed || 0)],
      ["Retrying", Number(data?.summary?.retrying || 0)],
      ["Dead", Number(data?.summary?.dead || 0)],
      ["Sent", Number(data?.summary?.sent || 0)],
    ],
    [data?.summary]
  );

  return {
    summary: data?.summary || null,
    attempts: Array.isArray(data?.attempts) ? data.attempts : [],
    cards,
    statusFilter,
    setStatusFilter,
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
