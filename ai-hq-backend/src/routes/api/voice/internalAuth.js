import { getInternalTokenAuthResult, internalTokenExpected } from "../../../utils/auth.js";
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

export function requireInternalToken(req, res, next) {
  const result = getInternalTokenAuthResult(req);
  if (!result.ok) {
    return res.status(
      result.code === "internal_token_not_configured" ? 500 : 401
    ).json({
      ok: false,
      error:
        result.code === "internal_token_not_configured"
          ? "internal_token_not_configured"
          : "unauthorized_internal",
    });
  }

  return next();
}
