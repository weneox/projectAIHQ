import { useEffect, useState } from "react";

import {
  getAppSessionContext,
  peekAppSessionContext,
} from "../lib/appSession.js";

function normalizeTenantKey(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

function getDesignTenantKey() {
  if (!import.meta.env?.DEV) return "";
  if (String(import.meta.env?.VITE_APP_DESIGN_MODE || "").trim() !== "1") {
    return "";
  }
  return normalizeTenantKey(import.meta.env?.VITE_DESIGN_TENANT_KEY || "local-dev");
}

export function getCachedWorkspaceTenantKey() {
  return normalizeTenantKey(peekAppSessionContext()?.tenantKey) || getDesignTenantKey();
}

export function buildWorkspaceScopedQueryKey(baseKey, tenantKey) {
  const root = Array.isArray(baseKey) ? baseKey : [baseKey];
  return [...root, "workspace", normalizeTenantKey(tenantKey)];
}

export function useWorkspaceTenantKey({ enabled = true } = {}) {
  const cachedTenantKey = normalizeTenantKey(getCachedWorkspaceTenantKey());

  const [sessionState, setSessionState] = useState(() => ({
    fetched: Boolean(cachedTenantKey),
    tenantKey: cachedTenantKey,
  }));

  const tenantKey = enabled
    ? normalizeTenantKey(cachedTenantKey || sessionState.tenantKey)
    : "";

  const loading = enabled && !tenantKey && !sessionState.fetched;

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
