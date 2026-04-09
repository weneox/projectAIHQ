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
  const [tenantKey, setTenantKey] = useState(() => getCachedWorkspaceTenantKey());
  const [loading, setLoading] = useState(
    () => enabled && !getCachedWorkspaceTenantKey()
  );

  useEffect(() => {
    let alive = true;

    if (!enabled) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    const cachedTenantKey = getCachedWorkspaceTenantKey();

    if (cachedTenantKey) {
      setTenantKey(cachedTenantKey);
      setLoading(false);
    } else {
      setTenantKey("");
      setLoading(true);
    }

    getAppSessionContext()
      .then((session) => {
        if (!alive) return;
        setTenantKey(normalizeTenantKey(session?.tenantKey));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setTenantKey("");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled]);

  return {
    tenantKey,
    loading,
    ready: !loading && Boolean(tenantKey),
  };
}

export default useWorkspaceTenantKey;
