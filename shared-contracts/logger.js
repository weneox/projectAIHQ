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

const SENSITIVE_LOG_KEY_RE =
  /(^|[_-])(password|passcode|token|secret|authorization|cookie|credential|api[_-]?key)($|[_-])/i;

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveLogKey(key = "") {
  const normalized = String(key || "").trim();
  if (!normalized) return false;
  if (SENSITIVE_LOG_KEY_RE.test(`_${normalized}_`)) return true;
  const compactKey = normalized.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(password|passcode|token|secret|authorization|cookie|credential|apikey)/.test(
    compactKey
  );
}

function isSafeSensitiveMetadataKey(key = "") {
  const compactKey = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (
    compactKey.endsWith("fingerprint") ||
    compactKey === "secretsource" ||
    compactKey.endsWith("secretsource")
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

function serializeError(error) {
  if (!error) return null;
  if (typeof error === "string") return { message: sanitizeLogString(error) };

  return compact({
    name: s(error?.name || "Error"),
    message: sanitizeLogString(error?.message || String(error)),
    code: sanitizeLogString(error?.code),
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
    const safeBaseContext = sanitizeForLog(compact(baseContext));
    const safeData = sanitizeForLog(compact(data));
    const entry = compact({
      ts: new Date().toISOString(),
      level: s(level || "info").toLowerCase(),
      event: s(event || "log"),
      ...safeBaseContext,
      ...safeData,
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
