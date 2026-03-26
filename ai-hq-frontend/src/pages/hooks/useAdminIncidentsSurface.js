import { useCallback, useEffect, useMemo, useState } from "react";

import { listRuntimeIncidents } from "../../api/incidents.js";
import { useSettingsSurfaceState } from "../Settings/hooks/useSettingsSurfaceState.js";

const DEFAULT_FILTERS = {
  service: "",
  severity: "",
  reasonCode: "",
  sinceHours: "24",
  limit: "50",
};

function s(v, d = "") {
  return String(v ?? d).trim();
}

export function useAdminIncidentsSurface() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const {
    data,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
  } = useSettingsSurfaceState({
    initialData: () => ({
      incidents: [],
      retentionPolicy: null,
      filters: DEFAULT_FILTERS,
    }),
    initialLoading: true,
  });

  const refreshIncidents = useCallback(async (nextFilters = DEFAULT_FILTERS) => {
    beginRefresh();
    try {
      const response = await listRuntimeIncidents({
        service: s(nextFilters.service),
        severity: s(nextFilters.severity),
        reasonCode: s(nextFilters.reasonCode),
        sinceHours: s(nextFilters.sinceHours || "24"),
        limit: s(nextFilters.limit || "50"),
      });

      return succeedRefresh({
        incidents: Array.isArray(response?.incidents) ? response.incidents : [],
        retentionPolicy: response?.retentionPolicy || null,
        filters: response?.filters || nextFilters,
      });
    } catch (error) {
      return failRefresh(error, {
        fallbackData: {
          incidents: [],
          retentionPolicy: null,
          filters: nextFilters,
        },
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh]);

  useEffect(() => {
    refreshIncidents(filters);
  }, [refreshIncidents]);

  const patchFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const applyFilters = useCallback(async () => {
    await refreshIncidents(filters);
  }, [filters, refreshIncidents]);

  const clearFilters = useCallback(async () => {
    setFilters(DEFAULT_FILTERS);
    await refreshIncidents(DEFAULT_FILTERS);
  }, [refreshIncidents]);

  const incidents = useMemo(
    () => (Array.isArray(data?.incidents) ? data.incidents : []),
    [data]
  );

  return {
    incidents,
    filters,
    patchFilter,
    applyFilters,
    clearFilters,
    retentionPolicy: data?.retentionPolicy || null,
    surface: {
      ...surface,
      refresh: applyFilters,
    },
  };
}
