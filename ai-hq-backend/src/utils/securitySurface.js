import { cfg } from "../config.js";
import {
  getDebugTokenAuthResult,
  getInternalTokenAuthResult,
} from "./auth.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function b(v, d = false) {
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return d;
  if (["1", "true", "yes", "y", "on"].includes(x)) return true;
  if (["0", "false", "no", "n", "off"].includes(x)) return false;
  return d;
}

export function isProductionLikeEnv(env = cfg.app.env) {
  return s(env, "production").toLowerCase() === "production";
}

export function buildAllowedCorsOrigins(raw = cfg.urls.corsOrigin, env = cfg.app.env) {
  const value = s(raw, "");
  if (!value) return [];

  if (value === "*") {
    return isProductionLikeEnv(env) ? [] : ["*"];
  }

  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function shouldAllowDiagnosticsRequest(req, env = cfg.app.env) {
  if (s(env, "").toLowerCase() === "test") {
    return true;
  }

  return (
    getDebugTokenAuthResult(req).ok ||
    getInternalTokenAuthResult(req).ok
  );
}

export function shouldEnableDebugRoutes(env = cfg.app.env) {
  return !isProductionLikeEnv(env) || b(cfg.security.debugRoutesEnabled, false);
}

export function requireSafeDiagnostics(req, res, next, { env = cfg.app.env } = {}) {
  if (shouldAllowDiagnosticsRequest(req, env)) {
    return next();
  }

  return res.status(404).json({
    ok: false,
    error: "Not found",
  });
}

export function sanitizeProviderSecrets(secretMap = {}, { includeValues = false } = {}) {
  const secrets = Object.entries(secretMap || {})
    .map(([key, value]) => {
      const secretKey = s(key);
      if (!secretKey) return null;

      return includeValues
        ? {
            key: secretKey,
            present: s(value) !== "",
            value: s(value),
          }
        : {
            key: secretKey,
            present: s(value) !== "",
          };
    })
    .filter(Boolean);

  return {
    secretKeys: secrets.map((item) => item.key),
    secrets,
  };
}

export const __test__ = {
  buildAllowedCorsOrigins,
  shouldAllowDiagnosticsRequest,
  sanitizeProviderSecrets,
};
