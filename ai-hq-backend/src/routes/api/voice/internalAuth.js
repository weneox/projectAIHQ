import {
  createInternalTokenGuard,
  getInternalTokenAuthResult,
  internalTokenExpected,
} from "../../../utils/auth.js";
import { s } from "./shared.js";

export function readInternalToken(req) {
  const auth = s(req.headers.authorization);
  return (
    s(req.headers["x-internal-token"]) ||
    s(req.headers["x-webhook-token"]) ||
    auth.replace(/^Bearer\s+/i, "")
  );
}

export function getExpectedInternalToken() {
  return internalTokenExpected();
}

export function createVoiceInternalTokenGuard(options = {}) {
  return createInternalTokenGuard(options);
}

export const requireInternalToken = createInternalTokenGuard();

export function requireVoiceInternalToken(req, res, next, options = {}) {
  const result = getInternalTokenAuthResult(req, options);
  if (!result.ok) {
    return res.status(
      result.code === "internal_token_not_configured"
        ? 500
        : result.code === "invalid_internal_service" ||
            result.code === "invalid_internal_audience"
          ? 403
          : 401
    ).json({
      ok: false,
      error:
        result.code === "internal_token_not_configured"
          ? "internal_token_not_configured"
          : result.code === "invalid_internal_service" ||
              result.code === "invalid_internal_audience"
            ? "forbidden_internal"
            : "unauthorized_internal",
    });
  }

  return next();
}
