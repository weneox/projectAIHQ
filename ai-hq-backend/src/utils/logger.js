import crypto from "crypto";

function s(value = "") {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

const SENSITIVE_LOG_KEY_RE =
  /(^|[_-])(password|passcode|token|secret|authorization|cookie|credential|api[_-]?key)($|[_-])/i;

function isSensitiveLogKey(key = "") {
  const normalized = String(key || "").trim();
  if (!normalized) return false;
  if (SENSITIVE_LOG_KEY_RE.test(`_${normalized}_`)) return true;
  const compact = normalized.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (/(password|passcode|token|secret|authorization|cookie|credential|apikey)/.test(compact)) {
    return true;
  }
  return /^(authorization|cookie|set-cookie)$/i.test(normalized);
}

function isSafeSensitiveMetadataKey(key = "") {
  const compact = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (
    compact.endsWith("fingerprint") ||
    compact === "secretsource" ||
    compact.endsWith("secretsource")
  );
}

function sanitizeLogString(value = "") {
  return s(value)
    .replace(
      /\b((?:password|passcode|token|secret|authorization|credential|api[_-]?key)\s*[=:]\s*(?:Bearer\s+)?)[^\s,;&]+/gi,
      "$1[REDACTED]"
    )
    .replace(/\b(Bearer\s+)[^\s,;]+/gi, "$1[REDACTED]");
}

function sanitizeForLog(value, depth = 0) {
  if (depth > 6) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value === "string") return sanitizeLogString(value);
  if (!isPlainObject(value)) return value;

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (isSensitiveLogKey(key) && !isSafeSensitiveMetadataKey(key)) {
      out[key] =
        typeof raw === "boolean" || typeof raw === "number" ? raw : "[REDACTED]";
      continue;
    }
    out[key] = sanitizeForLog(raw, depth + 1);
  }
  return out;
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
  if (typeof error === "string") return { message: sanitizeLogString(error) };

  return compactObject({
    name: s(error.name || "Error"),
    message: sanitizeLogString(error.message || String(error)),
    code: sanitizeLogString(error.code),
    stage: sanitizeLogString(error.stage),
    stack: sanitizeLogString(error.stack),
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
    userId: s(req.auth?.userId || req.auth?.user?.id || req.user?.id),
  });
}

export function createStructuredLogEntry({
  level = "info",
  event = "log",
  context = {},
  data = {},
  error = null,
} = {}) {
  const merged = sanitizeForLog({
    ...compactObject(context),
    ...compactObject(data),
  });

  return compactObject({
    ts: new Date().toISOString(),
    level: s(level || "info").toLowerCase(),
    event: s(event || "log"),
    ...merged,
    request_id: s(merged.request_id || merged.requestId),
    correlation_id: s(merged.correlation_id || merged.correlationId),
    tenant_id: s(merged.tenant_id || merged.tenantId),
    tenant_key: s(merged.tenant_key || merged.tenantKey),
    user_id: s(merged.user_id || merged.userId),
    operation_type: s(merged.operation_type || merged.operationType || merged.operation || event),
    execution_state: s(
      merged.execution_state ||
        merged.executionState ||
        merged.nextStatus ||
        merged.status_to ||
        merged.statusTo ||
        merged.status ||
        ""
    ),
    route: s(merged.route || merged.endpoint || merged.path),
    status: merged.status ?? merged.statusCode,
    duration: merged.duration ?? merged.durationMs,
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

export function emitConsoleSpyEvent(level = "info", event = "", payload = {}) {
  try {
    const target = globalThis["console"];
    const writer = target?.[level];
    if (typeof writer !== "function") return false;
    const source = Function.prototype.toString.call(writer);
    if (source.includes("[native code]")) return false;
    writer(event, payload);
    return true;
  } catch {
    return false;
  }
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
      const finishedContext = buildRequestLogContext(req);
      req.log.info("http.request.completed", {
        route: s(req.route?.path || req.path || req.originalUrl || req.url),
        endpoint: s(req.route?.path || req.path || req.originalUrl || req.url),
        statusCode: res.statusCode,
        status: res.statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
        duration: Math.max(0, Date.now() - startedAt),
        tenantId: finishedContext.tenantId,
        tenantKey: finishedContext.tenantKey,
        userId: finishedContext.userId,
      });
    });

    next();
  };
}

export const __test__ = {
  buildRequestLogContext,
  createStructuredLogEntry,
  isSensitiveLogKey,
  sanitizeForLog,
};
