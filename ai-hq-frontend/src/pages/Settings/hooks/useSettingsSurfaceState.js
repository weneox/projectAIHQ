import { useCallback, useMemo, useRef, useState } from "react";

function resolveInitialData(initialData) {
  return typeof initialData === "function" ? initialData() : initialData;
}

function nowIso() {
  return new Date().toISOString();
}

export function useSettingsSurfaceState({ initialData, initialLoading = true }) {
  const initialDataRef = useRef();
  if (typeof initialDataRef.current === "undefined") {
    initialDataRef.current = resolveInitialData(initialData);
  }

  const [data, setData] = useState(() => initialDataRef.current);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const beginRefresh = useCallback(() => {
    setLoading(true);
    setError("");
  }, []);

  const clearSaveState = useCallback(() => {
    setSaveError("");
    setSaveSuccess("");
  }, []);

  const succeedRefresh = useCallback((nextData) => {
    setData(nextData);
    setUnavailable(false);
    setError("");
    setLoading(false);
    setLastUpdated(nowIso());
    return nextData;
  }, []);

  const failRefresh = useCallback(
    (nextError, options = {}) => {
      const message = String(nextError?.message || nextError || "").trim();
      const fallbackData =
        Object.prototype.hasOwnProperty.call(options, "fallbackData")
          ? options.fallbackData
          : initialDataRef.current;

      setData(fallbackData);
      setUnavailable(options.unavailable !== false);
      setError(message);
      setLoading(false);
      return fallbackData;
    },
    []
  );

  const beginSave = useCallback(() => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
  }, []);

  const succeedSave = useCallback((options = {}) => {
    if (Object.prototype.hasOwnProperty.call(options, "nextData")) {
      setData(options.nextData);
      setLastUpdated(nowIso());
    }
    setSaving(false);
    setSaveError("");
    setSaveSuccess(String(options.message || "").trim());
    return options.nextData;
  }, []);

  const failSave = useCallback((nextError) => {
    const message = String(nextError?.message || nextError || "").trim();
    setSaving(false);
    setSaveSuccess("");
    setSaveError(message);
    return message;
  }, []);

  const surface = useMemo(
    () => ({
      loading,
      error,
      unavailable,
      ready: !loading && !unavailable,
      lastUpdated,
      saving,
      saveError,
      saveSuccess,
    }),
    [error, lastUpdated, loading, saveError, saveSuccess, saving, unavailable]
  );

  return {
    data,
    setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  };
}
