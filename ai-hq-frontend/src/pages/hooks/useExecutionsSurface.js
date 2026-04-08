import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getDurableExecution,
  getDurableExecutionSummary,
  listDurableExecutions,
  retryDurableExecution,
} from "../../api/executions.js";
import { useActionState } from "../../hooks/useActionState.js";
import { useAsyncSurfaceState } from "../../hooks/useAsyncSurfaceState.js";

const EMPTY_SURFACE = {
  items: [],
  summary: null,
};

const EMPTY_DETAIL = {
  execution: null,
  attempts: [],
  auditTrail: [],
};

function getErrorMessage(error, fallback) {
  const message = String(error?.message || error || "").trim();
  return message || fallback;
}

export function useExecutionsSurface() {
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const actionState = useActionState();

  const {
    data,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useAsyncSurfaceState({
    initialData: EMPTY_SURFACE,
  });

  const {
    data: detail,
    surface: detailSurface,
    beginRefresh: beginDetailRefresh,
    succeedRefresh: succeedDetailRefresh,
    failRefresh: failDetailRefresh,
  } = useAsyncSurfaceState({
    initialData: EMPTY_DETAIL,
    initialLoading: false,
  });

  const refresh = useCallback(async () => {
    beginRefresh();

    try {
      const [summaryResult, listResult] = await Promise.all([
        getDurableExecutionSummary(),
        listDurableExecutions({ status: "", limit: 160 }),
      ]);

      return succeedRefresh({
        summary: summaryResult,
        items: Array.isArray(listResult) ? listResult : [],
      });
    } catch (error) {
      return failRefresh(
        getErrorMessage(
          error,
          "Durable execution data is temporarily unavailable."
        ),
        {
          fallbackData: EMPTY_SURFACE,
          unavailable: true,
        }
      );
    }
  }, [beginRefresh, failRefresh, succeedRefresh]);

  const openExecution = useCallback(
    async (id) => {
      const nextId = String(id || "").trim();
      if (!nextId) return;

      setSelectedId(nextId);
      beginDetailRefresh();

      try {
        const payload = await getDurableExecution(nextId);

        succeedDetailRefresh({
          execution: payload?.execution || null,
          attempts: Array.isArray(payload?.attempts) ? payload.attempts : [],
          auditTrail: Array.isArray(payload?.auditTrail) ? payload.auditTrail : [],
        });
      } catch (error) {
        failDetailRefresh(
          getErrorMessage(
            error,
            "Execution detail is temporarily unavailable."
          ),
          {
            fallbackData: EMPTY_DETAIL,
            unavailable: false,
          }
        );
      }
    },
    [beginDetailRefresh, failDetailRefresh, succeedDetailRefresh]
  );

  const retrySelectedExecution = useCallback(async () => {
    if (!selectedId) return null;

    beginSave();

    try {
      await actionState.runAction("retry", () =>
        retryDurableExecution(selectedId)
      );
      await refresh();
      await openExecution(selectedId);
      return succeedSave({ message: "Manual retry requested." });
    } catch (error) {
      return failSave(
        getErrorMessage(error, "Unable to retry this execution.")
      );
    }
  }, [
    actionState,
    beginSave,
    failSave,
    openExecution,
    refresh,
    selectedId,
    succeedSave,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(
    () => (Array.isArray(data?.items) ? data.items : EMPTY_SURFACE.items),
    [data]
  );

  const summary = data?.summary || null;

  const providers = useMemo(
    () =>
      [...new Set(items.map((item) => String(item.provider || "")).filter(Boolean))].sort(),
    [items]
  );

  const channels = useMemo(
    () =>
      [...new Set(items.map((item) => String(item.channel || "")).filter(Boolean))].sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const tenantValue = `${item.tenant_key || ""} ${item.tenant_id || ""}`.toLowerCase();

      if (statusFilter && String(item.status || "").toLowerCase() !== statusFilter) {
        return false;
      }

      if (
        providerFilter &&
        String(item.provider || "").toLowerCase() !== providerFilter
      ) {
        return false;
      }

      if (
        channelFilter &&
        String(item.channel || "").toLowerCase() !== channelFilter
      ) {
        return false;
      }

      if (tenantFilter && !tenantValue.includes(tenantFilter.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [channelFilter, items, providerFilter, statusFilter, tenantFilter]);

  return {
    summary,
    items,
    providers,
    channels,
    filteredItems,
    selectedId,
    setSelectedId,
    openExecution,
    detail,
    detailSurface: {
      ...detailSurface,
      refresh: selectedId ? () => openExecution(selectedId) : null,
    },
    statusFilter,
    setStatusFilter,
    providerFilter,
    setProviderFilter,
    channelFilter,
    setChannelFilter,
    tenantFilter,
    setTenantFilter,
    surface: {
      ...surface,
      refresh,
      clearSaveState,
    },
    actionState,
    retrySelectedExecution,
  };
}