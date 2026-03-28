import crypto from "crypto";
import { cfg } from "../config.js";
import { can, normalizeRole } from "./roles.js";

function cleanString(v, fallback = "") {
  if (v === null || v === undefined) return String(fallback ?? "").trim();
  const s = String(v).trim();
  if (!s) return String(fallback ?? "").trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return String(fallback ?? "").trim();
  }
  return s;
}

function cleanLower(v, fallback = "") {
  return cleanString(v, fallback).toLowerCase();
}

function stripBearer(v) {
  return cleanString(v).replace(/^Bearer\s+/i, "").trim();
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;

  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function readHeader(req, name) {
  return cleanString(req?.headers?.[name]);
}

function isTestEnv() {
  return cleanLower(cfg?.app?.env || "") === "test";
}

function readProvidedDebugToken(req) {
  return cleanString(
    readHeader(req, "x-debug-token") ||
      req?.query?.token ||
      req?.body?.token ||
      ""
  );
}

export function requireDebugToken(req) {
  return getDebugTokenAuthResult(req).ok;
}

export function callbackTokenExpected() {
  return cleanString(cfg?.n8n?.callbackToken || cfg?.n8n?.webhookToken || "");
}

function readProvidedCallbackToken(req) {
  return cleanString(
    readHeader(req, "x-webhook-token") ||
      readHeader(req, "x-callback-token") ||
      req?.body?.token ||
      ""
  );
}

export function requireCallbackToken(req) {
  return getCallbackTokenAuthResult(req).ok;
}

export function getDebugTokenAuthResult(req) {
  const expected = cleanString(cfg?.security?.debugApiToken);
  if (!expected) {
    if (isTestEnv()) {
      return {
        ok: true,
        mode: "test_bypass",
      };
    }

    return {
      ok: false,
      code: "debug_token_not_configured",
      reason: "debug auth token is not configured",
    };
  }

  const got = readProvidedDebugToken(req);
  if (!got || !safeEq(got, expected)) {
    return {
      ok: false,
      code: "invalid_debug_token",
      reason: "invalid debug token",
    };
  }

  return {
    ok: true,
    mode: "token",
  };
}

export function getCallbackTokenAuthResult(req) {
  const expected = callbackTokenExpected();
  if (!expected) {
    if (isTestEnv()) {
      return {
        ok: true,
        mode: "test_bypass",
      };
    }

    return {
      ok: false,
      code: "callback_token_not_configured",
      reason: "callback auth token is not configured",
    };
  }

  const got = readProvidedCallbackToken(req);
  if (!got || !safeEq(got, expected)) {
    return {
      ok: false,
      code: "invalid_callback_token",
      reason: "invalid callback token",
    };
  }

  return {
    ok: true,
    mode: "token",
  };
}

export function internalTokenExpected() {
  return cleanString(cfg?.security?.aihqInternalToken || "");
}

export function internalServiceTokenExpected(service = "") {
  const key = cleanLower(service);
  if (key === "meta-bot-backend") {
    return cleanString(cfg?.security?.aihqInternalMetaBotToken || "");
  }
  if (key === "twilio-voice-backend") {
    return cleanString(cfg?.security?.aihqInternalTwilioVoiceToken || "");
  }
  return "";
}

function readProvidedInternalToken(req) {
  return stripBearer(
    readHeader(req, "x-internal-token") ||
      readHeader(req, "authorization") ||
      req?.body?.internalToken ||
      ""
  );
}

export function readProvidedInternalService(req) {
  return cleanLower(
    readHeader(req, "x-internal-service") ||
      req?.body?.internalService ||
      req?.body?.internal_service ||
      req?.query?.internalService ||
      req?.query?.internal_service ||
      ""
  );
}

export function readProvidedInternalAudience(req) {
  return cleanLower(
    readHeader(req, "x-internal-audience") ||
      req?.body?.internalAudience ||
      req?.body?.internal_audience ||
      req?.query?.internalAudience ||
      req?.query?.internal_audience ||
      ""
  );
}

function normalizeAllowedInternalValues(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => cleanLower(value))
        .filter(Boolean)
    ),
  ];
}

function listExpectedInternalTokens(service = "") {
  const expected = [];
  const serviceToken = internalServiceTokenExpected(service);
  const globalToken = internalTokenExpected();

  if (serviceToken) {
    expected.push({
      token: serviceToken,
      mode: "service_token",
      service: cleanLower(service),
    });
  }

  if (globalToken) {
    expected.push({
      token: globalToken,
      mode: "token",
      service: "",
    });
  }

  return expected;
}

function hasConfiguredInternalAuth() {
  return Boolean(
    internalTokenExpected() ||
      internalServiceTokenExpected("meta-bot-backend") ||
      internalServiceTokenExpected("twilio-voice-backend")
  );
}

export function getInternalTokenAuthResult(req, options = {}) {
  const allowedServices = normalizeAllowedInternalValues(options.allowedServices);
  const allowedAudiences = normalizeAllowedInternalValues(
    options.allowedAudiences || options.audiences || []
  );

  if (!hasConfiguredInternalAuth()) {
    if (isTestEnv()) {
      return {
        ok: true,
        mode: "test_bypass",
      };
    }

    return {
      ok: false,
      code: "internal_token_not_configured",
      reason: "internal auth token is not configured",
    };
  }

  const providedService = readProvidedInternalService(req);
  const providedAudience = readProvidedInternalAudience(req);
  const got = readProvidedInternalToken(req);
  const expectedTokens = listExpectedInternalTokens(providedService);
  const matched = got
    ? expectedTokens.find((item) => safeEq(got, item.token))
    : null;

  if (!matched) {
    return {
      ok: false,
      code: "invalid_internal_token",
      reason: "invalid internal token",
    };
  }

  if (allowedServices.length > 0 && !allowedServices.includes(providedService)) {
    return {
      ok: false,
      code: "invalid_internal_service",
      reason: "invalid internal service",
    };
  }

  if (
    allowedAudiences.length > 0 &&
    !allowedAudiences.includes(providedAudience)
  ) {
    return {
      ok: false,
      code: "invalid_internal_audience",
      reason: "invalid internal audience",
    };
  }

  return {
    ok: true,
    mode: matched.mode,
    service: providedService,
    audience: providedAudience,
    tokenScope: matched.mode === "service_token" ? "scoped" : "global",
  };
}

export function createInternalTokenGuard(options = {}) {
  return function guardInternalToken(req, res, next) {
    return requireInternalToken(req, res, next, options);
  };
}

export function requireInternalToken(req, res, next, options = {}) {
  const result = getInternalTokenAuthResult(req, options);

  if (typeof next === "function") {
    if (result.ok) {
      req.internalAuth = {
        mode: result.mode,
        service: cleanLower(result.service),
        audience: cleanLower(result.audience),
        tokenScope: cleanLower(result.tokenScope),
      };
      return next();
    }

    const status = result.code === "internal_token_not_configured"
      ? 500
      : result.code === "invalid_internal_service" ||
          result.code === "invalid_internal_audience"
        ? 403
        : 401;

    return res.status(status).json({
      ok: false,
      error:
        result.code === "internal_token_not_configured"
          ? "InternalAuthMisconfigured"
          : status === 403
            ? "Forbidden"
            : "Unauthorized",
      reason: result.reason || "invalid internal token",
    });
  }

  return result.ok;
}

export function getAuthTenantKey(req) {
  return cleanLower(
    req?.auth?.tenantKey ||
      req?.auth?.tenant_key ||
      req?.user?.tenantKey ||
      req?.user?.tenant_key ||
      req?.tenant?.tenant_key ||
      req?.tenant?.key ||
      ""
  );
}

export function getAuthTenantId(req) {
  return cleanString(
    req?.auth?.tenantId ||
      req?.auth?.tenant_id ||
      req?.user?.tenantId ||
      req?.user?.tenant_id ||
      req?.tenant?.id ||
      ""
  );
}

export function getRequestedTenantKey(req) {
  return cleanLower(
    req?.params?.tenantKey ||
      req?.params?.tenant_key ||
      req?.tenantKey ||
      readHeader(req, "x-tenant-key") ||
      req?.body?.tenantKey ||
      req?.body?.tenant_key ||
      req?.query?.tenantKey ||
      req?.query?.tenant_key ||
      ""
  );
}

export function getRequestedTenantId(req) {
  return cleanString(
    req?.params?.tenantId ||
      req?.params?.tenant_id ||
      req?.tenantId ||
      readHeader(req, "x-tenant-id") ||
      req?.body?.tenantId ||
      req?.body?.tenant_id ||
      req?.query?.tenantId ||
      req?.query?.tenant_id ||
      ""
  );
}

export function getAuthRole(req) {
  return cleanLower(
    req?.auth?.role ||
      req?.user?.role ||
      req?.membership?.role ||
      req?.tenantRole ||
      "member"
  );
}

export function getNormalizedAuthRole(req) {
  return normalizeRole(getAuthRole(req));
}

function hasAuthenticatedTenantActor(req) {
  return Boolean(
    cleanString(req?.auth?.userId) ||
      cleanString(req?.auth?.email) ||
      cleanString(req?.user?.id) ||
      cleanString(req?.user?.email)
  );
}

export function getTenantPermissionResult(
  req,
  {
    resource = "",
    action = "read",
    allowedRoles = [],
    reason = "",
  } = {}
) {
  if (!hasAuthenticatedTenantActor(req)) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      reason: "authenticated tenant user is required",
    };
  }

  const role = getNormalizedAuthRole(req);
  const explicitRoles = Array.isArray(allowedRoles)
    ? allowedRoles.map((item) => normalizeRole(item)).filter(Boolean)
    : [];

  const allowed = explicitRoles.length
    ? explicitRoles.includes(role)
    : can(role, cleanString(resource), cleanString(action, "read"));

  if (allowed) {
    return {
      ok: true,
      role,
    };
  }

  return {
    ok: false,
    status: 403,
    code: "forbidden",
    reason:
      cleanString(reason) ||
      (explicitRoles.length > 0
        ? "insufficient tenant role"
        : `tenant role cannot ${cleanString(action, "read")} ${cleanString(resource)}`),
    role,
  };
}

export function requireTenantPermission(req, res, next, options = {}) {
  const result = getTenantPermissionResult(req, options);

  if (typeof next === "function") {
    if (result.ok) return next();

    return res.status(result.status || 403).json({
      ok: false,
      error: result.status === 401 ? "Unauthorized" : "Forbidden",
      reason: result.reason || result.code || "forbidden",
    });
  }

  return result.ok;
}

export const OPERATOR_SURFACE_ROLES = ["owner", "admin", "operator"];

export function requireOperatorSurfaceAccess(req, res, next, options = {}) {
  return requireTenantPermission(req, res, next, {
    allowedRoles: OPERATOR_SURFACE_ROLES,
    reason: "operator surface access required",
    ...options,
  });
}

export function getAuthActor(req) {
  return (
    cleanString(req?.auth?.email) ||
    cleanString(req?.user?.email) ||
    cleanString(req?.auth?.userId) ||
    cleanString(req?.user?.id) ||
    "system"
  );
}

export function getAuthContext(req) {
  return {
    tenantKey: getAuthTenantKey(req),
    tenantId: getAuthTenantId(req),
    role: getAuthRole(req),
    actor: getAuthActor(req),
  };
}
 
