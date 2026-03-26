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

export function normalizeOriginValue(value = "") {
  const raw = s(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!parsed.protocol || !parsed.host) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function parseWildcardOriginPattern(value = "") {
  const raw = s(value).toLowerCase();
  const match = raw.match(/^(https?):\/\/\*\.([a-z0-9.-]+)$/i);
  if (!match) return null;

  return {
    protocol: `${match[1]}:`,
    hostSuffix: `.${match[2]}`,
  };
}

export function isAllowedOrigin(origin, allowedOrigins = [], env = cfg.app.env) {
  const normalizedOrigin = normalizeOriginValue(origin);
  if (!normalizedOrigin) return false;

  let parsedOrigin = null;
  try {
    parsedOrigin = new URL(normalizedOrigin);
  } catch {
    return false;
  }

  for (const candidate of allowedOrigins || []) {
    const rawCandidate = s(candidate);
    if (!rawCandidate) continue;

    if (rawCandidate === "*" && !isProductionLikeEnv(env)) {
      return true;
    }

    const normalizedCandidate = normalizeOriginValue(rawCandidate);
    if (normalizedCandidate && normalizedCandidate === normalizedOrigin) {
      return true;
    }

    const wildcard = parseWildcardOriginPattern(rawCandidate);
    if (!wildcard) continue;

    const host = String(parsedOrigin.host || "").toLowerCase();
    if (
      parsedOrigin.protocol === wildcard.protocol &&
      host.endsWith(wildcard.hostSuffix) &&
      host.length > wildcard.hostSuffix.length
    ) {
      return true;
    }
  }

  return false;
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
  isAllowedOrigin,
  normalizeOriginValue,
  shouldAllowDiagnosticsRequest,
  sanitizeProviderSecrets,
};
