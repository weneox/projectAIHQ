import crypto from "crypto";
import { cfg } from "../config.js";
import {
  buildAllowedCorsOrigins,
  isAllowedOrigin,
  normalizeOriginValue,
} from "./securitySurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function nowDate() {
  return new Date();
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unbase64url(input) {
  const x = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = x.length % 4 === 0 ? "" : "=".repeat(4 - (x.length % 4));
  return Buffer.from(x + pad, "base64");
}

function safeEqBuffer(a, b) {
  const aa = Buffer.isBuffer(a) ? a : Buffer.from(a || "");
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(b || "");
  if (aa.length !== bb.length) return false;

  try {
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function isProd() {
  return s(cfg.app.env).toLowerCase() === "production";
}

function cookieDomain() {
  if (!isProd()) return undefined;

  const explicit = s(
    cfg.auth.sessionCookieDomain ||
      cfg.auth.cookieDomain ||
      cfg.auth.userCookieDomain ||
      ""
  ).replace(/\/+$/, "");

  return explicit || undefined;
}

function sessionSameSite() {
  const raw = s(cfg.auth.sessionSameSite || "").toLowerCase();

  if (raw === "none" || raw === "lax" || raw === "strict") {
    return raw;
  }

  return "lax";
}

function registrableDomain(host = "") {
  const parts = s(host)
    .toLowerCase()
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function ttlHoursToMs(hours, fallbackHours) {
  return Math.max(1, Number(hours || fallbackHours || 1)) * 60 * 60 * 1000;
}

function addMs(date, ms) {
  const delta = Number(ms || 0);
  return new Date(new Date(date || Date.now()).getTime() + (Number.isFinite(delta) ? delta : 0));
}

function hashSessionToken(token = "") {
  return crypto
    .createHash("sha256")
    .update(String(token || ""), "utf8")
    .digest("hex");
}

function getQueryTimeoutMs(timeoutMs, fallbackMs = 2500) {
  return Math.max(250, Number(timeoutMs || fallbackMs || 2500));
}

async function authQuery(db, queryText, params = [], timeoutMs = 2500) {
  if (!db || typeof db.query !== "function") {
    const err = new Error("Database is not available");
    err.code = "AUTH_DB_UNAVAILABLE";
    throw err;
  }

  return db.query({
    text: queryText,
    values: params,
    query_timeout: getQueryTimeoutMs(timeoutMs),
  });
}

function normalizeRateLimitScope(scope = "") {
  return s(scope).toLowerCase().slice(0, 240);
}

function getClientIp(req) {
  const xfwd = s(req?.headers?.["x-forwarded-for"]);
  if (xfwd) return xfwd.split(",")[0].trim();
  return s(req?.ip) || s(req?.socket?.remoteAddress) || "unknown";
}

function getAdminSessionSecret() {
  return s(cfg.auth.adminSessionSecret);
}

function getUserSessionSecret() {
  return s(cfg.auth.userSessionSecret || cfg.auth.adminSessionSecret);
}

const RESERVED_TENANT_HOST_LABELS = new Set([
  "www",
  "api",
  "hq",
  "mail",
  "docs",
  "status",
  "admin",
  "app",
  "cdn",
  "assets",
  "blog",
  "help",
  "support",
  "auth",
  "m",
  "dev",
  "staging",
  "demo",
]);

function normalizeHostname(value = "") {
  return s(value)
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function isLoopbackHost(host = "") {
  const normalized = normalizeHostname(host);
  return (
    !normalized ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function getTenantBaseHosts(publicBaseUrl = cfg.urls.publicBaseUrl) {
  const hosts = new Set();

  try {
    const host = new URL(s(publicBaseUrl)).hostname;
    if (host) {
      hosts.add(normalizeHostname(host));
    }
  } catch {}

  hosts.add("weneox.com");

  return Array.from(hosts).filter(Boolean).sort((a, b) => b.length - a.length);
}

function getSessionCookieToken(req, cookieName) {
  const values = getSessionCookieTokens(req, cookieName);

  for (const value of values) {
    const token = s(value);
    if (token) return token;
  }

  return "";
}

function normalizeUserSessionPayload(row = {}) {
  if (!row) return null;

  return {
    sessionType: "user",
    sessionId: s(row.session_id || row.id),
    identityId: s(row.identity_id),
    membershipId: s(row.active_membership_id || row.membership_id),
    tenantUserId: s(row.tenant_user_id || row.legacy_user_id),
    userId: s(row.user_id || row.tenant_user_id || row.legacy_user_id || row.identity_id),
    tenantId: s(row.tenant_id),
    tenantKey: s(row.tenant_key).toLowerCase(),
    email: s(row.user_email).toLowerCase(),
    fullName: s(row.full_name),
    role: s(row.role || "member").toLowerCase(),
    companyName: s(row.company_name),
    status: s(row.user_status || row.status),
    sessionVersion: Number(row.session_version || 1),
    exp: row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : null,
    iat: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
    lastSeenAt: row.last_seen_at || null,
  };
}

function normalizeAdminSessionPayload(row = {}) {
  if (!row) return null;

  return {
    sessionType: "admin",
    sessionId: s(row.id),
    exp: row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : null,
    iat: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
    lastSeenAt: row.last_seen_at || null,
  };
}

async function touchUserSession(db, sessionId = "") {
  const id = s(sessionId);
  if (!id || !db) return;
  try {
    await authQuery(
      db,
      `
      update auth_identity_sessions
      set last_seen_at = now()
      where id = $1
      `,
      [id],
      1200
    );
  } catch {}
}

async function touchAdminSession(db, sessionId = "") {
  const id = s(sessionId);
  if (!id || !db) return;
  try {
    await authQuery(
      db,
      `
      update admin_auth_sessions
      set last_seen_at = now()
      where id = $1
      `,
      [id],
      1200
    );
  } catch {}
}

export function getAdminCookieName() {
  return s(cfg.auth.adminSessionCookieName, "aihq_admin");
}

export function getUserCookieName() {
  return s(cfg.auth.userSessionCookieName, "aihq_user");
}

export function resolveTenantKeyFromRequestHost(
  req,
  { publicBaseUrl = cfg.urls.publicBaseUrl } = {}
) {
  const requestHost = normalizeHostname(
    req?.headers?.["x-forwarded-host"] ||
      req?.headers?.host ||
      req?.get?.("host")
  );

  if (isLoopbackHost(requestHost)) return "";

  for (const baseHost of getTenantBaseHosts(publicBaseUrl)) {
    if (!baseHost || requestHost === baseHost) continue;
    if (!requestHost.endsWith(`.${baseHost}`)) continue;

    const tenantLabel = requestHost
      .slice(0, -(`.${baseHost}`).length)
      .trim()
      .toLowerCase();

    if (
      !tenantLabel ||
      tenantLabel.includes(".") ||
      RESERVED_TENANT_HOST_LABELS.has(tenantLabel)
    ) {
      return "";
    }

    return tenantLabel;
  }

  return "";
}

function shouldUseCrossSiteSessionCookie(req) {
  const requestOrigin = normalizeOriginValue(
    req?.headers?.origin || req?.headers?.referer
  );
  if (!requestOrigin) return false;

  const trustedOrigins = buildTrustedBrowserOrigins(req);
  if (!isAllowedOrigin(requestOrigin, trustedOrigins, cfg.app.env)) {
    return false;
  }

  const requestHostOrigin = getRequestHostOrigin(req);
  if (!requestHostOrigin) return false;

  try {
    const originHost = new URL(requestOrigin).hostname;
    const requestHost = new URL(requestHostOrigin).hostname;
    if (!originHost || !requestHost) return false;

    return registrableDomain(originHost) !== registrableDomain(requestHost);
  } catch {
    return false;
  }
}

function resolveSessionSameSite(req) {
  return shouldUseCrossSiteSessionCookie(req) ? "none" : sessionSameSite();
}

export function adminCookieOptions(req = null) {
  const maxAgeMs = ttlHoursToMs(cfg.auth.adminSessionTtlHours, 12);
  const domain = cookieDomain();
  const sameSite = resolveSessionSameSite(req);

  return {
    httpOnly: true,
    secure: isProd(),
    sameSite,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: maxAgeMs,
  };
}

export function userCookieOptions(req = null) {
  const maxAgeMs = ttlHoursToMs(cfg.auth.userSessionTtlHours, 24 * 7);
  const domain = cookieDomain();
  const sameSite = resolveSessionSameSite(req);

  return {
    httpOnly: true,
    secure: isProd(),
    sameSite,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: maxAgeMs,
  };
}

function isUnsafeBrowserMutationMethod(method = "") {
  const normalized = s(method).toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalized);
}

function getRequestHostOrigin(req) {
  const host =
    s(req?.headers?.["x-forwarded-host"]) ||
    s(req?.headers?.host) ||
    s(req?.get?.("host"));
  if (!host) return "";

  const forwardedProto = s(req?.headers?.["x-forwarded-proto"]).split(",")[0].trim();
  const protocol = s(req?.protocol || forwardedProto || "").toLowerCase();
  const safeProtocol = protocol === "https" ? "https" : "http";

  return normalizeOriginValue(`${safeProtocol}://${host}`);
}

export function buildTrustedBrowserOrigins(
  req,
  {
    corsOrigin = cfg.urls.corsOrigin,
    publicBaseUrl = cfg.urls.publicBaseUrl,
    env = cfg.app.env,
  } = {}
) {
  const trusted = new Set();

  for (const origin of buildAllowedCorsOrigins(corsOrigin, env)) {
    const normalized = normalizeOriginValue(origin);
    if (normalized && normalized !== "*") {
      trusted.add(normalized);
    } else if (s(origin).includes("*.")) {
      trusted.add(s(origin));
    }
  }

  for (const candidate of [publicBaseUrl, getRequestHostOrigin(req)]) {
    const normalized = normalizeOriginValue(candidate);
    if (normalized) {
      trusted.add(normalized);
    }
  }

  return Array.from(trusted);
}

export function getBrowserOriginProtectionResult(
  req,
  options = {}
) {
  if (!isUnsafeBrowserMutationMethod(req?.method)) {
    return {
      ok: true,
      skipped: "safe_method",
    };
  }

  const origin = normalizeOriginValue(req?.headers?.origin);
  const refererOrigin = normalizeOriginValue(req?.headers?.referer);
  const requestOrigin = origin || refererOrigin;

  if (!requestOrigin) {
    return {
      ok: false,
      status: 403,
      code: "csrf_origin_required",
      reason: "trusted origin header required for cookie-authenticated write",
    };
  }

  const trustedOrigins = buildTrustedBrowserOrigins(req, options);
  if (!trustedOrigins.length) {
    return {
      ok: false,
      status: 500,
      code: "csrf_origin_misconfigured",
      reason: "trusted browser origins are not configured",
    };
  }

  if (!isAllowedOrigin(requestOrigin, trustedOrigins, options?.env || cfg.app.env)) {
    return {
      ok: false,
      status: 403,
      code: "csrf_origin_mismatch",
      reason: "cross-site cookie write blocked",
    };
  }

  return {
    ok: true,
    source: origin ? "origin" : "referer",
    requestOrigin,
    trustedOrigins,
  };
}

export function requireTrustedBrowserOriginForCookieAuth(req, res, next) {
  const result = getBrowserOriginProtectionResult(req);
  if (result.ok) return next();

  return res.status(result.status || 403).json({
    ok: false,
    error:
      result.code === "csrf_origin_misconfigured"
        ? "CsrfProtectionMisconfigured"
        : "Forbidden",
    reason: result.code || "csrf_origin_blocked",
  });
}

function clearCookieExact(res, name, options = {}) {
  try {
    res.clearCookie(name, {
      httpOnly: true,
      ...options,
    });
  } catch {}
}

function clearCookieEverywhere(res, name, paths = ["/"]) {
  const domain = cookieDomain();
  const sameSites = ["lax", "strict", "none"];
  const pathList = Array.from(new Set(paths.filter(Boolean)));

  for (const path of pathList) {
    for (const sameSite of sameSites) {
      clearCookieExact(res, name, {
        path,
        sameSite,
        secure: true,
        ...(domain ? { domain } : {}),
      });

      clearCookieExact(res, name, {
        path,
        sameSite,
        secure: false,
        ...(domain ? { domain } : {}),
      });

      clearCookieExact(res, name, {
        path,
        sameSite,
        secure: true,
      });

      clearCookieExact(res, name, {
        path,
        sameSite,
        secure: false,
      });
    }
  }
}

export function clearAdminCookie(res) {
  clearCookieEverywhere(res, getAdminCookieName(), ["/", "/api", "/admin"]);
}

export function clearUserCookie(res) {
  clearCookieEverywhere(res, getUserCookieName(), ["/", "/api", "/auth"]);
}

export function parseCookies(req) {
  const raw = req?.headers?.cookie || "";
  const out = {};

  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i <= 0) return;

    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;

    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  });

  return out;
}

function getAllCookieValues(req, cookieName) {
  const raw = req?.headers?.cookie || "";
  const values = [];

  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i <= 0) return;

    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || k !== cookieName) return;

    try {
      values.push(decodeURIComponent(v));
    } catch {
      values.push(v);
    }
  });

  return values.filter(Boolean);
}

export function getSessionCookieTokens(req, cookieName) {
  const values = getAllCookieValues(req, cookieName)
    .map((value) => s(value))
    .filter(Boolean);

  if (values.length) {
    return Array.from(new Set(values));
  }

  const fallback = s(parseCookies(req)?.[cookieName]);
  return fallback ? [fallback] : [];
}

export function isAdminAuthConfigured() {
  return Boolean(
    cfg.auth.adminPanelEnabled &&
      s(cfg.auth.adminPasscodeHash)
  );
}

export function isUserAuthConfigured() {
  return Boolean(s(getUserSessionSecret()));
}

export function createAdminSessionToken(meta = {}) {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyAdminSessionToken(token) {
  try {
    const secret = getAdminSessionSecret();
    if (!secret) return { ok: false, error: "session secret missing" };

    const raw = s(token);
    if (!raw || !raw.includes(".")) {
      return { ok: false, error: "invalid token format" };
    }

    const parts = raw.split(".");
    if (parts.length !== 2) {
      return { ok: false, error: "invalid token parts" };
    }

    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) {
      return { ok: false, error: "invalid token parts" };
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest();

    const gotSig = unbase64url(sigB64);
    if (!safeEqBuffer(expectedSig, gotSig)) {
      return { ok: false, error: "bad signature" };
    }

    const payloadJson = unbase64url(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson || "{}");

    if (payload?.typ !== "admin_session") {
      return { ok: false, error: "invalid token type" };
    }

    const now = nowSec();
    if (!Number.isFinite(payload?.exp) || now >= Number(payload.exp)) {
      return { ok: false, error: "token expired" };
    }

    if (!Number.isFinite(payload?.iat)) {
      return { ok: false, error: "invalid token iat" };
    }

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || "verify failed") };
  }
}

export function createUserSessionToken(user = {}, meta = {}) {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyUserSessionToken(token) {
  try {
    const secret = getUserSessionSecret();
    if (!secret) return { ok: false, error: "session secret missing" };

    const raw = s(token);
    if (!raw || !raw.includes(".")) {
      return { ok: false, error: "invalid token format" };
    }

    const parts = raw.split(".");
    if (parts.length !== 2) {
      return { ok: false, error: "invalid token parts" };
    }

    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) {
      return { ok: false, error: "invalid token parts" };
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest();

    const gotSig = unbase64url(sigB64);
    if (!safeEqBuffer(expectedSig, gotSig)) {
      return { ok: false, error: "bad signature" };
    }

    const payloadJson = unbase64url(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson || "{}");

    if (payload?.typ !== "tenant_user_session") {
      return { ok: false, error: "invalid token type" };
    }

    const now = nowSec();
    if (!Number.isFinite(payload?.exp) || now >= Number(payload.exp)) {
      return { ok: false, error: "token expired" };
    }

    if (
      !payload?.userId ||
      !payload?.tenantId ||
      !payload?.tenantKey ||
      !payload?.email
    ) {
      return { ok: false, error: "invalid session payload" };
    }

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || "verify failed") };
  }
}

export function createUserLoginSelectionToken(account = {}) {
  const secret = getUserSessionSecret();
  if (!secret) {
    throw new Error("login selection secret missing");
  }

  const payload = {
    typ: "identity_membership_login_choice",
    identityId: s(account.identityId || account.identity_id),
    membershipId: s(account.membershipId || account.membership_id || account.id),
    userId: s(account.userId || account.legacyUserId || account.user_id),
    tenantId: s(account.tenantId || account.tenant_id),
    tenantKey: s(account.tenantKey || account.tenant_key).toLowerCase(),
    email: s(account.email || account.user_email).toLowerCase(),
    iat: nowSec(),
    exp: nowSec() + 10 * 60,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sigB64 = base64url(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );

  return `${payloadB64}.${sigB64}`;
}

export function verifyUserLoginSelectionToken(token) {
  try {
    const secret = getUserSessionSecret();
    if (!secret) return { ok: false, error: "selection secret missing" };

    const raw = s(token);
    if (!raw || !raw.includes(".")) {
      return { ok: false, error: "invalid token format" };
    }

    const [payloadB64, sigB64] = raw.split(".");
    if (!payloadB64 || !sigB64) {
      return { ok: false, error: "invalid token parts" };
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest();

    const gotSig = unbase64url(sigB64);
    if (!safeEqBuffer(expectedSig, gotSig)) {
      return { ok: false, error: "bad signature" };
    }

    const payload = JSON.parse(unbase64url(payloadB64).toString("utf8") || "{}");
    if (payload?.typ !== "identity_membership_login_choice") {
      return { ok: false, error: "invalid token type" };
    }

    const now = nowSec();
    if (!Number.isFinite(payload?.exp) || now >= Number(payload.exp)) {
      return { ok: false, error: "token expired" };
    }

    if (
      !s(payload?.identityId) ||
      !s(payload?.membershipId) ||
      !s(payload?.userId) ||
      !s(payload?.tenantId) ||
      !s(payload?.tenantKey) ||
      !s(payload?.email)
    ) {
      return { ok: false, error: "invalid selection payload" };
    }

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || "verify failed") };
  }
}

export function createUserWorkspaceSwitchToken(account = {}) {
  const secret = getUserSessionSecret();
  if (!secret) {
    throw new Error("workspace switch secret missing");
  }

  const payload = {
    typ: "identity_workspace_switch",
    identityId: s(account.identityId || account.identity_id),
    membershipId: s(account.membershipId || account.membership_id || account.id),
    tenantId: s(account.tenantId || account.tenant_id),
    tenantKey: s(account.tenantKey || account.tenant_key).toLowerCase(),
    iat: nowSec(),
    exp: nowSec() + 10 * 60,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sigB64 = base64url(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );

  return `${payloadB64}.${sigB64}`;
}

export function verifyUserWorkspaceSwitchToken(token) {
  try {
    const secret = getUserSessionSecret();
    if (!secret) return { ok: false, error: "workspace switch secret missing" };

    const raw = s(token);
    if (!raw || !raw.includes(".")) {
      return { ok: false, error: "invalid token format" };
    }

    const [payloadB64, sigB64] = raw.split(".");
    if (!payloadB64 || !sigB64) {
      return { ok: false, error: "invalid token parts" };
    }

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest();

    const gotSig = unbase64url(sigB64);
    if (!safeEqBuffer(expectedSig, gotSig)) {
      return { ok: false, error: "bad signature" };
    }

    const payload = JSON.parse(unbase64url(payloadB64).toString("utf8") || "{}");
    if (payload?.typ !== "identity_workspace_switch") {
      return { ok: false, error: "invalid token type" };
    }

    const now = nowSec();
    if (!Number.isFinite(payload?.exp) || now >= Number(payload.exp)) {
      return { ok: false, error: "token expired" };
    }

    if (
      !s(payload?.identityId) ||
      !s(payload?.membershipId) ||
      !s(payload?.tenantId) ||
      !s(payload?.tenantKey)
    ) {
      return { ok: false, error: "invalid workspace switch payload" };
    }

    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || "verify failed") };
  }
}

export function verifyAdminPasscode(passcode) {
  try {
    const stored = s(cfg.auth.adminPasscodeHash);
    const input = s(passcode);

    if (!stored || !input) return false;

    const parts = stored.split(":");
    if (parts.length !== 3 || parts[0] !== "s2") {
      return false;
    }

    const saltHex = parts[1];
    const hashHex = parts[2];

    const derived = crypto.scryptSync(input, Buffer.from(saltHex, "hex"), 64);
    const expected = Buffer.from(hashHex, "hex");

    return safeEqBuffer(derived, expected);
  } catch {
    return false;
  }
}

export function makeAdminPasscodeHash(passcode) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(passcode || ""), salt, 64);
  return `s2:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function hashUserPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password || ""), salt, 64);
  return `s2u:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyUserPassword(password, storedHash) {
  try {
    const input = s(password);
    const stored = s(storedHash);

    if (!input || !stored) return false;

    const parts = stored.split(":");
    if (parts.length !== 3 || parts[0] !== "s2u") {
      return false;
    }

    const saltHex = parts[1];
    const hashHex = parts[2];

    const derived = crypto.scryptSync(input, Buffer.from(saltHex, "hex"), 64);
    const expected = Buffer.from(hashHex, "hex");

    return safeEqBuffer(derived, expected);
  } catch {
    return false;
  }
}

export async function createUserSessionRecord(db, user = {}, meta = {}) {
  const token = createUserSessionToken(user, meta);
  const ttlMs = ttlHoursToMs(cfg.auth.userSessionTtlHours, 24 * 7);
  const expiresAt = addMs(nowDate(), ttlMs).toISOString();

  await authQuery(
    db,
    `
    insert into auth_identity_sessions (
      identity_id,
      active_tenant_id,
      active_membership_id,
      session_token_hash,
      session_version,
      ip,
      user_agent,
      expires_at,
      last_seen_at
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,now())
    `,
    [
      s(user.identity_id || user.identityId),
      s(user.tenant_id || user.tenantId || user.active_tenant_id),
      s(user.membership_id || user.membershipId || user.active_membership_id),
      hashSessionToken(token),
      Number(user.session_version ?? user.sessionVersion ?? 1),
      s(meta.ip),
      s(meta.ua).slice(0, 300),
      expiresAt,
    ],
    2500
  );

  return { token, expiresAt };
}

export async function createAdminSessionRecord(db, meta = {}) {
  const token = createAdminSessionToken(meta);
  const ttlMs = ttlHoursToMs(cfg.auth.adminSessionTtlHours, 12);
  const expiresAt = addMs(nowDate(), ttlMs).toISOString();

  await authQuery(
    db,
    `
    insert into admin_auth_sessions (
      session_token_hash,
      ip,
      user_agent,
      expires_at,
      last_seen_at
    )
    values ($1,$2,$3,$4,now())
    `,
    [hashSessionToken(token), s(meta.ip), s(meta.ua).slice(0, 300), expiresAt],
    2500
  );

  return { token, expiresAt };
}

export async function revokeUserSessionByToken(db, token = "") {
  const raw = s(token);
  if (!raw || !db) return false;

  const result = await authQuery(
    db,
    `
    update auth_identity_sessions
    set revoked_at = now(), last_seen_at = now()
    where session_token_hash = $1
      and revoked_at is null
    `,
    [hashSessionToken(raw)],
    1500
  );

  return Number(result?.rowCount || 0) > 0;
}

export async function switchUserSessionWorkspaceByToken(
  db,
  token = "",
  {
    tenantId = "",
    membershipId = "",
  } = {}
) {
  const raw = s(token);
  if (!raw || !db || !tenantId || !membershipId) return false;

  const result = await authQuery(
    db,
    `
    update auth_identity_sessions
    set
      active_tenant_id = $2,
      active_membership_id = $3,
      last_seen_at = now()
    where session_token_hash = $1
      and revoked_at is null
    `,
    [hashSessionToken(raw), s(tenantId), s(membershipId)],
    1500
  );

  return Number(result?.rowCount || 0) > 0;
}

export async function revokeAdminSessionByToken(db, token = "") {
  const raw = s(token);
  if (!raw || !db) return false;

  const result = await authQuery(
    db,
    `
    update admin_auth_sessions
    set revoked_at = now(), last_seen_at = now()
    where session_token_hash = $1
      and revoked_at is null
    `,
    [hashSessionToken(raw)],
    1500
  );

  return Number(result?.rowCount || 0) > 0;
}

export async function loadUserSessionFromRequest(req, { db, touch = true } = {}) {
  const token = getSessionCookieToken(req, getUserCookieName());
  if (!token) {
    return { ok: false, error: "missing session cookie" };
  }

  if (!db) {
    return { ok: false, error: "auth db unavailable" };
  }

  try {
    const result = await authQuery(
      db,
      `
      select
        s.id as session_id,
        s.identity_id,
        s.active_membership_id,
        s.active_tenant_id as tenant_id,
        s.session_version,
        s.expires_at,
        s.created_at,
        s.last_seen_at,
        i.primary_email as user_email,
        m.id as membership_id,
        m.role,
        m.status,
        t.tenant_key,
        t.company_name,
        tu.id as tenant_user_id,
        tu.id as user_id,
        tu.full_name,
        tu.status as user_status
      from auth_identity_sessions s
      join auth_identities i on i.id = s.identity_id
      join auth_identity_memberships m
        on m.id = s.active_membership_id
       and m.identity_id = s.identity_id
       and m.tenant_id = s.active_tenant_id
      join tenants t on t.id = s.active_tenant_id
      left join lateral (
        select
          tu.id,
          tu.full_name,
          tu.status
        from tenant_users tu
        where tu.tenant_id = s.active_tenant_id
          and lower(tu.user_email) = lower(i.normalized_email)
        order by tu.created_at asc, tu.id asc
        limit 1
      ) tu on true
      where s.session_token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and i.status in ('active', 'invited')
        and m.status = 'active'
      limit 1
      `,
      [hashSessionToken(token)],
      3000
    );

    const row = result?.rows?.[0] || null;
    if (!row) {
      return { ok: false, error: "session not found" };
    }

    if (s(row.user_status) && s(row.user_status) !== "active") {
      return { ok: false, error: "user inactive" };
    }

    const payload = normalizeUserSessionPayload(row);
    if (touch) {
      await touchUserSession(db, payload?.sessionId);
    }

    return { ok: true, payload };
  } catch (err) {
    return {
      ok: false,
      error: s(err?.code) === "AUTH_DB_UNAVAILABLE" ? "auth db unavailable" : "session lookup failed",
      code: s(err?.code),
    };
  }
}

export async function loadAdminSessionFromRequest(req, { db, touch = true } = {}) {
  const token = getSessionCookieToken(req, getAdminCookieName());
  if (!token) {
    return { ok: false, error: "missing session cookie" };
  }

  if (!db) {
    return { ok: false, error: "auth db unavailable" };
  }

  try {
    const result = await authQuery(
      db,
      `
      select id, expires_at, created_at, last_seen_at
      from admin_auth_sessions
      where session_token_hash = $1
        and revoked_at is null
        and expires_at > now()
      limit 1
      `,
      [hashSessionToken(token)],
      2500
    );

    const row = result?.rows?.[0] || null;
    if (!row) {
      return { ok: false, error: "session not found" };
    }

    const payload = normalizeAdminSessionPayload(row);
    if (touch) {
      await touchAdminSession(db, payload?.sessionId);
    }

    return { ok: true, payload };
  } catch (err) {
    return {
      ok: false,
      error: "session lookup failed",
      code: s(err?.code),
    };
  }
}

export async function checkLoginRateLimit(
  db,
  {
    actorType = "user",
    scopeKey = "",
    ip = "",
    windowMs = 15 * 60 * 1000,
    maxAttempts = 5,
  } = {}
) {
  if (!db) {
    return {
      ok: true,
      remaining: Math.max(0, Number(maxAttempts || 0)),
      resetAt: Date.now() + Math.max(1000, Number(windowMs || 0)),
      dbBacked: false,
    };
  }

  const actor = s(actorType).toLowerCase() === "admin" ? "admin" : "user";
  const scope = normalizeRateLimitScope(scopeKey || `${actor}:default`);
  const address = s(ip || "unknown");
  const result = await authQuery(
    db,
    `
    select attempt_count, first_attempt_at, blocked_until
    from auth_login_attempts
    where actor_type = $1
      and scope_key = $2
      and ip = $3
    limit 1
    `,
    [actor, scope, address],
    1500
  );

  const row = result?.rows?.[0] || null;
  if (!row) {
    return {
      ok: true,
      remaining: Math.max(0, Number(maxAttempts || 0)),
      resetAt: Date.now() + Math.max(1000, Number(windowMs || 0)),
      dbBacked: true,
    };
  }

  const blockedUntilMs = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;
  if (blockedUntilMs > Date.now()) {
    return {
      ok: false,
      remaining: 0,
      resetAt: blockedUntilMs,
      dbBacked: true,
    };
  }

  const firstAttemptMs = row.first_attempt_at
    ? new Date(row.first_attempt_at).getTime()
    : 0;
  const expiresAt = firstAttemptMs + Math.max(1000, Number(windowMs || 0));

  if (!firstAttemptMs || expiresAt <= Date.now()) {
    return {
      ok: true,
      remaining: Math.max(0, Number(maxAttempts || 0)),
      resetAt: Date.now() + Math.max(1000, Number(windowMs || 0)),
      dbBacked: true,
    };
  }

  return {
    ok: Number(row.attempt_count || 0) < Number(maxAttempts || 0),
    remaining: Math.max(0, Number(maxAttempts || 0) - Number(row.attempt_count || 0)),
    resetAt: expiresAt,
    dbBacked: true,
  };
}

export async function registerFailedLoginAttempt(
  db,
  {
    actorType = "user",
    scopeKey = "",
    ip = "",
    windowMs = 15 * 60 * 1000,
    maxAttempts = 5,
    blockMs = 15 * 60 * 1000,
  } = {}
) {
  if (!db) return;

  const actor = s(actorType).toLowerCase() === "admin" ? "admin" : "user";
  const scope = normalizeRateLimitScope(scopeKey || `${actor}:default`);
  const address = s(ip || "unknown");
  const staleBefore = addMs(nowDate(), -Math.max(1000, Number(windowMs || 0))).toISOString();

  await authQuery(
    db,
    `
    insert into auth_login_attempts (
      actor_type,
      scope_key,
      ip,
      attempt_count,
      first_attempt_at,
      last_attempt_at,
      blocked_until
    )
    values (
      $1,$2,$3,1,now(),now(),
      case when $4 <= 1 then now() + ($5::text || ' milliseconds')::interval else null end
    )
    on conflict (actor_type, scope_key, ip)
    do update set
      attempt_count = case
        when auth_login_attempts.first_attempt_at < $6::timestamptz then 1
        else auth_login_attempts.attempt_count + 1
      end,
      first_attempt_at = case
        when auth_login_attempts.first_attempt_at < $6::timestamptz then now()
        else auth_login_attempts.first_attempt_at
      end,
      last_attempt_at = now(),
      blocked_until = case
        when auth_login_attempts.first_attempt_at < $6::timestamptz then
          case when $4 <= 1 then now() + ($5::text || ' milliseconds')::interval else null end
        when auth_login_attempts.attempt_count + 1 >= $4 then
          now() + ($5::text || ' milliseconds')::interval
        else auth_login_attempts.blocked_until
      end
    `,
    [
      actor,
      scope,
      address,
      Math.max(1, Number(maxAttempts || 1)),
      Math.max(1000, Number(blockMs || 0)),
      staleBefore,
    ],
    2000
  );
}

export async function clearLoginAttempts(
  db,
  { actorType = "user", scopeKey = "", ip = "" } = {}
) {
  if (!db) return;

  await authQuery(
    db,
    `
    delete from auth_login_attempts
    where actor_type = $1
      and scope_key = $2
      and ip = $3
    `,
    [
      s(actorType).toLowerCase() === "admin" ? "admin" : "user",
      normalizeRateLimitScope(scopeKey),
      s(ip || "unknown"),
    ],
    1500
  );
}

export function checkAdminRateLimit(req) {
  return {
    ok: true,
    remaining: Number(cfg.auth.adminRateLimitMaxAttempts || 5),
    resetAt: Date.now() + Number(cfg.auth.adminRateLimitWindowMs || 15 * 60 * 1000),
    memoryFallback: true,
  };
}

export function registerAdminFailedAttempt(req) {
  return `${getClientIp(req)}:admin`;
}

export function clearAdminFailedAttempts(req) {
  return `${getClientIp(req)}:admin`;
}

export function readAdminSessionFromRequest(req) {
  const cookieName = getAdminCookieName();
  const values = getAllCookieValues(req, cookieName);

  for (const token of values) {
    const checked = verifyAdminSessionToken(token);
    if (checked?.ok) return checked;
  }

  const cookies = parseCookies(req);
  const fallbackToken = cookies[cookieName] || "";
  return verifyAdminSessionToken(fallbackToken);
}

export function readUserSessionFromRequest(req) {
  const cookieName = getUserCookieName();
  const values = getAllCookieValues(req, cookieName);

  for (const token of values) {
    const checked = verifyUserSessionToken(token);
    if (checked?.ok) return checked;
  }

  const cookies = parseCookies(req);
  const fallbackToken = cookies[cookieName] || "";
  return verifyUserSessionToken(fallbackToken);
}

export async function requireAdminSession(req, res, next) {
  if (!cfg.auth.adminPanelEnabled) {
    return res.status(403).json({
      ok: false,
      error: "Admin panel disabled",
    });
  }

  const session = await loadAdminSessionFromRequest(req, {
    db: req.app?.locals?.db || null,
  });

  if (!session?.ok) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: session?.error || "invalid admin session",
    });
  }

  req.adminSession = session.payload;
  return next();
}

export async function requireUserSession(req, res, next) {
  const existingAuth = req?.auth;
  if (
    existingAuth &&
    s(existingAuth.userId) &&
    s(existingAuth.identityId) &&
    s(existingAuth.membershipId) &&
    s(existingAuth.tenantId) &&
    s(existingAuth.tenantKey) &&
    s(existingAuth.email)
  ) {
    if (!req.user) {
      req.user = {
        id: s(existingAuth.userId),
        identityId: s(existingAuth.identityId),
        membershipId: s(existingAuth.membershipId),
        tenantId: s(existingAuth.tenantId),
        tenantKey: s(existingAuth.tenantKey),
        tenant_id: s(existingAuth.tenantId),
        tenant_key: s(existingAuth.tenantKey),
        email: s(existingAuth.email),
        fullName: s(existingAuth.fullName || ""),
        full_name: s(existingAuth.fullName || ""),
        role: s(existingAuth.role || "member").toLowerCase(),
        sessionVersion: Number(existingAuth.sessionVersion || 1),
        session_version: Number(existingAuth.sessionVersion || 1),
      };
    }

    return next();
  }

  const session = await loadUserSessionFromRequest(req, {
    db: req.app?.locals?.db || null,
  });

  if (!session?.ok) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      reason: session?.error || "invalid session",
    });
  }

  req.adminSession = null;
  req.auth = {
    userId: session.payload.userId,
    identityId: session.payload.identityId,
    membershipId: session.payload.membershipId,
    tenantId: session.payload.tenantId,
    tenantKey: session.payload.tenantKey,
    email: session.payload.email,
    fullName: session.payload.fullName || "",
    companyName: session.payload.companyName || "",
    role: session.payload.role || "member",
    sessionVersion: Number(session.payload.sessionVersion || 1),
  };

  req.user = {
    id: session.payload.userId,
    identityId: session.payload.identityId,
    membershipId: session.payload.membershipId,
    tenantId: session.payload.tenantId,
    tenantKey: session.payload.tenantKey,
    tenant_id: session.payload.tenantId,
    tenant_key: session.payload.tenantKey,
    email: session.payload.email,
    fullName: session.payload.fullName || "",
    full_name: session.payload.fullName || "",
    role: session.payload.role || "member",
    sessionVersion: Number(session.payload.sessionVersion || 1),
    session_version: Number(session.payload.sessionVersion || 1),
  };

  return next();
}

export const __test__ = {
  hashSessionToken,
  normalizeUserSessionPayload,
  normalizeAdminSessionPayload,
};
