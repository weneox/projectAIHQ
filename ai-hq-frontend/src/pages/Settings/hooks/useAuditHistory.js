import { useCallback } from "react";

import { getSettingsAuditHistory } from "../../../api/settings.js";
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

function createEmptyAuditHistory() {
  return {
    tenantId: "",
    tenantKey: "",
    viewerRole: "member",
    permissions: {},
    filters: {
      availableAreas: [],
      availableOutcomes: [],
      area: "",
      outcome: "",
      limit: 30,
    },
    summary: {
      total: 0,
      outcomes: {
        succeeded: 0,
        blocked: 0,
        failed: 0,
      },
      areaItems: [],
    },
    items: [],
  };
}

export function useAuditHistory() {
  const {
    data: auditHistory,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
  } = useSettingsSurfaceState({
    initialData: createEmptyAuditHistory,
    initialLoading: false,
  });

  const refreshAuditHistory = useCallback(async (params = {}) => {
    beginRefresh();
    try {
      const payload = await getSettingsAuditHistory({
        limit: 30,
        ...params,
      });
      return succeedRefresh(payload);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: createEmptyAuditHistory(),
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh]);

  return {
    auditHistory,
    surface: {
      ...surface,
      refresh: refreshAuditHistory,
    },
    refreshAuditHistory,
  };
}
