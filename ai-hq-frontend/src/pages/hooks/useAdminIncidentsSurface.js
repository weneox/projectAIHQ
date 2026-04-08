import { useCallback, useEffect, useMemo, useState } from "react";

import { listRuntimeIncidents } from "../../api/incidents.js";
import { useAsyncSurfaceState } from "../../hooks/useAsyncSurfaceState.js";

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

function buildEmptyData(filters = DEFAULT_FILTERS) {
  return {
    incidents: [],
    summary: null,
    retentionPolicy: null,
    filters,
  };
}

export function useAdminIncidentsSurface() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const {
    data,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
  } = useAsyncSurfaceState({
    initialData: () => buildEmptyData(DEFAULT_FILTERS),
    initialLoading: true,
  });

  const refreshIncidents = useCallback(
    async (nextFilters = DEFAULT_FILTERS) => {
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
          summary: response?.summary || null,
          retentionPolicy: response?.retentionPolicy || null,
          filters: response?.filters || nextFilters,
        });
      } catch (error) {
        return failRefresh(error, {
          fallbackData: buildEmptyData(nextFilters),
        });
      }
    },
    [beginRefresh, failRefresh, succeedRefresh]
  );

  useEffect(() => {
    void refreshIncidents(DEFAULT_FILTERS);
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
    summary: data?.summary || null,
    retentionPolicy: data?.retentionPolicy || null,
    surface: {
      ...surface,
      refresh: applyFilters,
    },
  };
}