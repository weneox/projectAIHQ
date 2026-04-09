import { useEffect, useState } from "react";

export const LAUNCH_SLICE_REFRESH_EVENT = "launch-slice:refresh";

function normalizeTenantKey(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

export function emitLaunchSliceRefresh({ tenantKey = "", reason = "" } = {}) {
  const normalizedTenantKey = normalizeTenantKey(tenantKey);

  if (
    !normalizedTenantKey ||
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(LAUNCH_SLICE_REFRESH_EVENT, {
      detail: {
        tenantKey: normalizedTenantKey,
        reason: String(reason ?? "").trim(),
        issuedAt: Date.now(),
      },
    })
  );
}

export function useLaunchSliceRefreshToken(tenantKey = "", enabled = true) {
  const normalizedTenantKey = normalizeTenantKey(tenantKey);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (
      !enabled ||
      !normalizedTenantKey ||
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return undefined;
    }

    function handleRefresh(event) {
      const detail = event?.detail || {};
      if (normalizeTenantKey(detail.tenantKey) !== normalizedTenantKey) return;
      setToken((current) => current + 1);
    }

    window.addEventListener(LAUNCH_SLICE_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(LAUNCH_SLICE_REFRESH_EVENT, handleRefresh);
    };
  }, [enabled, normalizedTenantKey]);

  return token;
}
