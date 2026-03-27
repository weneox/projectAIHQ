import { useCallback, useMemo, useState } from "react";

import { getSettingsTrustView } from "../../../api/trust.js";
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

function createEmptyTrustView() {
  return {
    summary: {},
    recentRuns: [],
    audit: [],
    viewerRole: "member",
    capabilities: {},
    permissions: {},
  };
}

function getTrustErrorMessage(error) {
  const message = String(error?.message || error || "").trim();
  return message || "Trust maintenance signals are temporarily unavailable.";
}

export const __test__ = {
  createEmptyTrustView,
  getTrustErrorMessage,
};

export function useTrustSurface({ tenantKey }) {
  const {
    data: trustView,
    setData: setTrustView,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
  } = useSettingsSurfaceState({
    initialData: createEmptyTrustView,
    initialLoading: false,
  });
  const [trustStatus, setTrustStatus] = useState("idle");

  const refreshTrust = useCallback(async (overrideTenantKey = tenantKey) => {
    const nextTenantKey = String(overrideTenantKey || "").trim();
    if (!nextTenantKey) {
      const empty = createEmptyTrustView();
      setTrustView(empty);
      setTrustStatus("idle");
      return empty;
    }

    beginRefresh();

    try {
      const nextTrustView = await getSettingsTrustView({
        tenantKey: nextTenantKey,
        limit: 8,
      });
      setTrustStatus("ready");
      return succeedRefresh(nextTrustView);
    } catch (error) {
      const message = getTrustErrorMessage(error);
      setTrustStatus("unavailable");
      failRefresh(message, {
        fallbackData: createEmptyTrustView(),
      });
      return null;
    }
  }, [beginRefresh, failRefresh, setTrustView, succeedRefresh, tenantKey]);

  const trust = useMemo(
    () => ({
      view: trustView,
      status: trustStatus,
      loading: surface.loading,
      error: surface.error,
      unavailable: trustStatus === "unavailable",
      ready: surface.ready,
      lastUpdated: surface.lastUpdated,
      surface: {
        ...surface,
        unavailable: trustStatus === "unavailable",
        ready: surface.ready && trustStatus === "ready",
        refresh: refreshTrust,
      },
    }),
    [refreshTrust, surface, trustStatus, trustView]
  );

  return {
    trust,
    surface: {
      ...surface,
      unavailable: trustStatus === "unavailable",
      ready: surface.ready && trustStatus === "ready",
      refresh: refreshTrust,
    },
    refreshTrust,
  };
}
