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
  const designTenantKey = isAppDesignModeEnabled() ? getDesignTenantKey() : "";

  const [sessionState, setSessionState] = useState(() => ({
    fetched: Boolean(designTenantKey),
    tenantKey: designTenantKey,
  }));

  const cachedTenantKey = getCachedWorkspaceTenantKey();

  const tenantKey = enabled
    ? normalizeTenantKey(cachedTenantKey || sessionState.tenantKey || designTenantKey)
    : "";

  const loading = enabled && !tenantKey && !sessionState.fetched;

  useEffect(() => {
    if (!enabled) return undefined;

    if (designTenantKey) {
      setSessionState((current) => {
        if (current.fetched && current.tenantKey === designTenantKey) {
          return current;
        }

        return {
          fetched: true,
          tenantKey: designTenantKey,
        };
      });

      return undefined;
    }

    if (cachedTenantKey) {
      setSessionState((current) => {
        if (current.fetched && current.tenantKey === cachedTenantKey) {
          return current;
        }

        return {
          fetched: true,
          tenantKey: cachedTenantKey,
        };
      });

      return undefined;
    }

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
  }, [enabled, cachedTenantKey, designTenantKey]);

  return {
    tenantKey,
    loading,
    ready: !loading && Boolean(tenantKey),
  };
}

export default useWorkspaceTenantKey;