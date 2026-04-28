import { useEffect, useState } from "react";

import {
  getDesignTenantKey,
  isAppDesignModeEnabled,
} from "../lib/designMode.js";
import {
  getAppSessionContext,
  peekAppSessionContext,
} from "../lib/appSession.js";

function normalizeTenantKey(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

export function getCachedWorkspaceTenantKey() {
  if (isAppDesignModeEnabled()) {
    return getDesignTenantKey();
  }

  return normalizeTenantKey(peekAppSessionContext()?.tenantKey);
}

export function buildWorkspaceScopedQueryKey(baseKey, tenantKey) {
  const root = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...root, "workspace", normalizeTenantKey(tenantKey)];
}

export function useWorkspaceTenantKey({ enabled = true } = {}) {
  const designTenantKey = normalizeTenantKey(
    isAppDesignModeEnabled() ? getDesignTenantKey() : ""
  );

  const cachedTenantKey = normalizeTenantKey(getCachedWorkspaceTenantKey());
  const immediateTenantKey = normalizeTenantKey(
    designTenantKey || cachedTenantKey
  );

  const [sessionState, setSessionState] = useState(() => ({
    fetched: Boolean(immediateTenantKey),
    tenantKey: immediateTenantKey,
  }));

  const tenantKey = enabled
    ? normalizeTenantKey(immediateTenantKey || sessionState.tenantKey)
    : "";

  const loading = enabled && !tenantKey && !sessionState.fetched;

  useEffect(() => {
    if (!enabled || immediateTenantKey) return undefined;

    let alive = true;

    getAppSessionContext()
      .then((session) => {
        if (!alive) return;

        setSessionState({
          fetched: true,
          tenantKey: normalizeTenantKey(session?.tenantKey),
        });
      })
      .catch(() => {
        if (!alive) return;

        setSessionState({
          fetched: true,
          tenantKey: "",
        });
      });

    return () => {
      alive = false;
    };
  }, [enabled, immediateTenantKey]);

  return {
    tenantKey,
    loading,
    ready: !loading && Boolean(tenantKey),
  };
}

export default useWorkspaceTenantKey;