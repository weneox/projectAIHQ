function s(v, d = "") {
  return String(v ?? d).trim();
}

function compact(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      out[key] = s(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function serializeError(error) {
  if (!error) return null;
  if (typeof error === "string") return { message: error };

  return compact({
    name: s(error?.name || "Error"),
    message: s(error?.message || String(error)),
    code: s(error?.code),
  });
}

export function createStructuredLogger(baseContext = {}, sink = null) {
  const emit =
    typeof sink === "function"
      ? sink
      : (entry) => {
          const line = JSON.stringify(entry);
          if (entry.level === "error") {
            console.error(line);
            return;
          }
          console.log(line);
        };

  function write(level, event, data = {}, error = null) {
    const entry = compact({
      ts: new Date().toISOString(),
      level: s(level || "info").toLowerCase(),
      event: s(event || "log"),
      ...compact(baseContext),
      ...compact(data),
      error: serializeError(error),
    });
    emit(entry);
    return entry;
  }

  return {
    child(extra = {}) {
      return createStructuredLogger(
        {
          ...baseContext,
          ...compact(extra),
        },
        emit
      );
    },
    info(event, data = {}) {
      return write("info", event, data);
    },
    warn(event, data = {}, error = null) {
      return write("warn", event, data, error);
    },
    error(event, error = null, data = {}) {
      return write("error", event, data, error);
    },
  };
}
