import crypto from "crypto";

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

function readHeader(req, name) {
  return s(req?.headers?.[String(name || "").toLowerCase()]);
}

function readForwardedIp(req) {
  const forwarded = readHeader(req, "x-forwarded-for");
  if (forwarded) {
    return s(forwarded.split(",")[0]);
  }

  return s(req?.ip || req?.socket?.remoteAddress || "");
}

export function generateRequestId() {
  return crypto.randomUUID();
}

export function buildRequestContext(req = {}, extra = {}) {
  const fallbackRequestId = s(extra.requestId) || s(extra.correlationId);
  const incomingRequestId =
    s(req?.requestId) ||
    readHeader(req, "x-request-id") ||
    readHeader(req, "x-correlation-id");
  const requestId = incomingRequestId || fallbackRequestId || generateRequestId();
  const correlationId =
    s(req?.correlationId) ||
    readHeader(req, "x-correlation-id") ||
    readHeader(req, "x-request-id") ||
    s(extra.correlationId) ||
    requestId;

  return compact({
    requestId,
    correlationId,
    method: s(req?.method),
    path: s(req?.originalUrl || req?.url),
    remoteIp: readForwardedIp(req),
    ...compact(extra),
  });
}

export function buildCorrelationHeaders({ requestId = "", correlationId = "", headers = {} } = {}) {
  const out = {
    ...compact(headers),
  };
  const nextRequestId = s(requestId || correlationId);
  const nextCorrelationId = s(correlationId || requestId);

  if (nextRequestId) out["x-request-id"] = nextRequestId;
  if (nextCorrelationId) out["x-correlation-id"] = nextCorrelationId;

  return out;
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

export function requestContextMiddleware({
  logger = createStructuredLogger({ service: "app" }),
  buildExtraContext = null,
} = {}) {
  return function sharedRequestContext(req, res, next) {
    const extra =
      typeof buildExtraContext === "function" ? buildExtraContext(req) || {} : {};
    const context = buildRequestContext(req, extra);
    const requestLogger = logger.child(context);
    const startedAt = Date.now();

    req.requestId = context.requestId;
    req.correlationId = context.correlationId;
    req.log = requestLogger;

    try {
      res.setHeader("x-request-id", context.requestId);
      res.setHeader("x-correlation-id", context.correlationId);
    } catch {}

    requestLogger.info("http.request.started");

    res.on("finish", () => {
      requestLogger.info("http.request.completed", {
        statusCode: Number(res.statusCode || 0),
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    });

    next();
  };
}
