function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function createTtlCache({ ttlMs = 30_000, maxEntries = 500 } = {}) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  }

  function set(key, value, customTtlMs = null) {
    if (store.size >= Math.max(1, n(maxEntries, 500))) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }

    store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(100, n(customTtlMs, ttlMs)),
    });
    return value;
  }

  function del(key) {
    return store.delete(key);
  }

  function clear() {
    store.clear();
  }

  return {
    get,
    set,
    del,
    clear,
    size() {
      return store.size;
    },
  };
}
