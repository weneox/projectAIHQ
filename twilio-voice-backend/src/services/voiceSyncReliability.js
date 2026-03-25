import { incrementRuntimeMetric } from "./runtimeObservability.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (isObj(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function createTtlCache({ ttlMs = 15000, maxEntries = 2000 } = {}) {
  const store = new Map();

  function sweep() {
    const now = Date.now();
    for (const [key, expiresAt] of store.entries()) {
      if (expiresAt <= now) store.delete(key);
    }

    while (store.size > maxEntries) {
      const firstKey = store.keys().next().value;
      if (!firstKey) break;
      store.delete(firstKey);
    }
  }

  return {
    mark(key) {
      sweep();
      const duplicate = store.has(key);
      store.set(key, Date.now() + ttlMs);
      return duplicate;
    },
    clear() {
      store.clear();
    },
  };
}

const syncCache = createTtlCache({
  ttlMs: 15000,
  maxEntries: 4000,
});

export function buildVoiceSyncKey(path, payload = {}) {
  return `${s(path)}|${stableSerialize(payload)}`;
}

export function shouldSuppressVoiceSync(path, payload = {}) {
  const key = buildVoiceSyncKey(path, payload);
  const duplicate = syncCache.mark(key);
  if (duplicate) {
    incrementRuntimeMetric("voice_sync_duplicate_suppressions_total");
  }
  return {
    key,
    duplicate,
  };
}

export const __test__ = {
  buildVoiceSyncKey,
  syncCache,
};
