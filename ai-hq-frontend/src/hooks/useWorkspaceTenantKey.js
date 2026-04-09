import { useEffect, useState } from "react";

import {
  getAppSessionContext,
  peekAppSessionContext,
} from "../lib/appSession.js";

function normalizeTenantKey(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

export function getCachedWorkspaceTenantKey() {
  return normalizeTenantKey(peekAppSessionContext()?.tenantKey);
}

export function buildWorkspaceScopedQueryKey(baseKey, tenantKey) {
  const root = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...root, "workspace", normalizeTenantKey(tenantKey)];
}

export function useWorkspaceTenantKey({ enabled = true } = {}) {
  const [sessionState, setSessionState] = useState(() => ({
    fetched: false,
    tenantKey: "",
  }));

  const cachedTenantKey = getCachedWorkspaceTenantKey();
  const tenantKey = enabled
    ? normalizeTenantKey(cachedTenantKey || sessionState.tenantKey)
    : "";
  const loading = enabled && !cachedTenantKey && !sessionState.fetched;

  useEffect(() => {
    if (!enabled || cachedTenantKey) return undefined;

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
  }, [enabled, cachedTenantKey]);

  return {
    tenantKey,
    loading,
    ready: !loading && Boolean(tenantKey),
  };
}

export default useWorkspaceTenantKey;