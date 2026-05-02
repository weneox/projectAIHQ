function s(value = "", fallback = "") {
  const out = String(value ?? "").trim();
  return out || String(fallback ?? "").trim();
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function inferFailureStatus(payload = {}) {
  const explicit = Number(payload.statusCode || payload.status || 0);
  if (explicit >= 400 && explicit <= 599) return explicit;

  const code = lower(payload.code || payload.reasonCode || payload.reason || "");
  const error = lower(payload.error || payload.message || "");
  const combined = `${code} ${error}`;

  if (/rate_limited|too many/.test(combined)) return 429;
  if (/unauthorized|invalid_session|session expired|session not found/.test(combined)) {
    return combined.includes("misconfigured") ? 500 : 401;
  }
  if (/forbidden|csrf|origin|mismatch|blocked|not_allowed/.test(combined)) return 403;
  if (/not found|missing .*row|missing .*record/.test(combined)) return 404;
  if (/db unavailable|database unavailable|runtime_authority_unavailable|unavailable|timeout/.test(combined)) {
    return 503;
  }
  if (/required|invalid|bad request|must be|missing/.test(combined)) return 400;

  return 500;
}

function normalizeFailurePayload(payload = {}, requestId = "") {
  const out = {
    ok: false,
    ...payload,
    error: s(payload.error || payload.message || "Request failed"),
    code: s(payload.code || payload.reasonCode || payload.reason || "request_failed"),
    requestId: s(payload.requestId || requestId),
  };

  delete out.status;
  delete out.statusCode;
  delete out.stack;

  return out;
}

export function apiResponseStandardMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function standardizedJson(payload) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (payload.ok === false) {
        if (res.statusCode < 400) {
          res.status(inferFailureStatus(payload));
        }
        return originalJson(normalizeFailurePayload(payload, req.requestId));
      }

      if (payload.ok === true && !payload.requestId && req.requestId) {
        return originalJson({
          ...payload,
          requestId: req.requestId,
        });
      }
    }

    return originalJson(payload);
  };

  return next();
}

export const __test__ = {
  inferFailureStatus,
  normalizeFailurePayload,
};
