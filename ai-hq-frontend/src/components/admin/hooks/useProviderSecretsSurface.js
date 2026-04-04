import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminSecrets, saveAdminSecret, deleteAdminSecret } from "../../../api/adminSecrets.js";
import { useAsyncSurfaceState } from "../../../hooks/useAsyncSurfaceState.js";

const PROVIDER_PRESETS = {
  meta: ["page_access_token", "page_id", "ig_user_id", "app_secret"],
  cloudinary: ["cloud_name", "api_key", "api_secret", "folder"],
  together: ["api_key", "image_model"],
  openai: ["api_key", "model"],
  twilio: ["account_sid", "auth_token", "api_key", "api_secret", "phone_number"],
};

function clean(x) {
  return String(x || "").trim();
}

function lower(x) {
  return clean(x).toLowerCase();
}

export function useProviderSecretsSurface({ canManage = false, initialProvider = "meta" } = {}) {
  const [provider, setProviderState] = useState(lower(initialProvider) || "meta");
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const {
    data: secrets,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useAsyncSurfaceState({
    initialData: () => [],
    initialLoading: true,
  });

  const presetKeys = useMemo(() => PROVIDER_PRESETS[provider] || [], [provider]);

  const refreshSecrets = useCallback(async (nextProvider = provider) => {
    beginRefresh();
    try {
      const rows = await getAdminSecrets(nextProvider);
      return succeedRefresh(Array.isArray(rows) ? rows : []);
    } catch (error) {
      return failRefresh(error, { fallbackData: [] });
    }
  }, [beginRefresh, failRefresh, provider, succeedRefresh]);

  useEffect(() => {
    refreshSecrets(provider);
  }, [provider, refreshSecrets]);

  const setProvider = useCallback((nextProvider) => {
    setProviderState(lower(nextProvider) || "meta");
    setSecretKey("");
    setSecretValue("");
    clearSaveState();
  }, [clearSaveState]);

  const saveSecret = useCallback(async () => {
    if (!canManage) {
      failSave("Secrets can only be managed by owner/admin users.");
      return null;
    }

    const p = lower(provider);
    const k = lower(secretKey);
    const v = clean(secretValue);

    if (!p) return failSave("Provider is required.");
    if (!k) return failSave("Secret key is required.");
    if (!v) return failSave("Secret value is required.");

    beginSave();

    try {
      await saveAdminSecret(p, k, v);
      setSecretValue("");
      setSecretKey("");
      await refreshSecrets(p);
      succeedSave({ message: `${p}.${k} saved.` });
      return true;
    } catch (error) {
      failSave(error);
      throw error;
    }
  }, [beginSave, canManage, failSave, provider, refreshSecrets, secretKey, secretValue, succeedSave]);

  const removeSecret = useCallback(async (rawKey) => {
    if (!canManage) {
      failSave("Secrets can only be managed by owner/admin users.");
      return null;
    }

    const p = lower(provider);
    const key = lower(rawKey);
    if (!p || !key) return failSave("Secret key is required.");

    beginSave();

    try {
      await deleteAdminSecret(p, key);
      await refreshSecrets(p);
      succeedSave({ message: `${p}.${key} deleted.` });
      return true;
    } catch (error) {
      failSave(error);
      throw error;
    }
  }, [beginSave, canManage, failSave, provider, refreshSecrets, succeedSave]);

  return {
    provider,
    setProvider,
    presetKeys,
    secretKey,
    setSecretKey,
    secretValue,
    setSecretValue,
    secrets,
    surface: {
      ...surface,
      refresh: refreshSecrets,
      clearSaveState,
    },
    refreshSecrets,
    saveSecret,
    removeSecret,
  };
}
