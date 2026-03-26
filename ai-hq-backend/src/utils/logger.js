import crypto from "crypto";

function s(value = "") {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function compactObject(input = {}) {
  const out = {};

  for (const [key, raw] of Object.entries(input || {})) {
    if (raw === undefined) continue;
    if (raw === null) {
      out[key] = null;
      continue;
    }
    if (typeof raw === "string") {
      out[key] = s(raw);
      continue;
    }
    out[key] = raw;
  }

  return out;
}

function serializeError(error) {
  if (!error) return null;
  if (typeof error === "string") return { message: error };

  return compactObject({
    name: s(error.name || "Error"),
    message: s(error.message || String(error)),
    code: s(error.code),
    stage: s(error.stage),
    stack: s(error.stack),
  });
}

export function generateCorrelationId() {
  return crypto.randomUUID();
}

export function buildRequestLogContext(req = {}) {
  const requestId =
    s(req.requestId) ||
    s(req.headers?.["x-request-id"]) ||
    s(req.headers?.["x-correlation-id"]) ||
    generateCorrelationId();
  const correlationId =
    s(req.correlationId) ||
    s(req.headers?.["x-correlation-id"]) ||
    s(req.headers?.["x-request-id"]) ||
    requestId;

  return compactObject({
    requestId,
    correlationId,
    method: s(req.method),
    path: s(req.originalUrl || req.url),
    remoteIp:
      s(req.headers?.["x-forwarded-for"]).split(",")[0]?.trim?.() ||
      s(req.ip || req.socket?.remoteAddress),
    tenantId: s(req.auth?.tenantId || req.user?.tenantId || req.tenantId),
    tenantKey: s(req.auth?.tenantKey || req.user?.tenantKey || req.tenantKey),
    userId: s(req.auth?.user?.id || req.user?.id),
  });
}

export function createStructuredLogEntry({
  level = "info",
  event = "log",
  context = {},
  data = {},
  error = null,
} = {}) {
  return compactObject({
    ts: new Date().toISOString(),
    level: s(level || "info").toLowerCase(),
    event: s(event || "log"),
    ...compactObject(context),
    ...compactObject(data),
    error: serializeError(error),
  });
}

export function createLogger(baseContext = {}, sink = null) {
  const emitter =
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
    const entry = createStructuredLogEntry({
      level,
      event,
      context: baseContext,
      data,
      error,
    });
    emitter(entry);
    return entry;
  }

  return {
    child(extra = {}) {
      return createLogger(
        {
          ...baseContext,
          ...compactObject(extra),
        },
        emitter
      );
    },
    debug(event, data = {}) {
      return write("debug", event, data);
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

export function requestContextMiddleware({ logger = createLogger({ service: "ai-hq-backend" }) } = {}) {
  return function requestContext(req, res, next) {
    const context = buildRequestLogContext(req);
    req.requestId = context.requestId;
    req.correlationId = context.correlationId;
    req.log = logger.child(context);
    res.setHeader("x-request-id", context.requestId);
    res.setHeader("x-correlation-id", context.correlationId);

    const startedAt = Date.now();
    req.log.info("http.request.started");

    res.on("finish", () => {
      req.log.info("http.request.completed", {
        statusCode: res.statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    });

    next();
  };
}

export const __test__ = {
  buildRequestLogContext,
  createStructuredLogEntry,
};
