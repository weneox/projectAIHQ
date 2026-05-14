import { cfg } from "../../../config.js";
import {
  parseCookies,
  loadAdminSessionFromRequest,
  loadUserSessionFromRequest,
  getUserCookieName,
} from "../../../utils/adminAuth.js";
import {
  isDbTimeoutError,
  queryDbWithTimeout,
} from "../../../db/queryWithTimeout.js";

export { isDbTimeoutError, queryDbWithTimeout };

export function s(v, d = "") {
  return String(v ?? d).trim();
}

export function lower(v) {
  return s(v).toLowerCase();
}

export function getIp(req) {
  const xfwd = s(req?.headers?.["x-forwarded-for"]);
  if (xfwd) return xfwd.split(",")[0].trim();
  return s(req?.ip) || s(req?.socket?.remoteAddress) || "unknown";
}

export function setNoStore(res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

export async function checkDb(db) {
  if (!db) return false;
  try {
    const q = await queryDbWithTimeout(db, "select 1 as ok", [], {
      timeoutMs: 800,
      label: "auth.checkDb",
    });
    return q?.rows?.[0]?.ok === 1;
  } catch {
    return false;
  }
}

export function buildRuntimeInfo(db, wsHub, dbOk) {
  return {
    env: cfg.app.env,
    hasDb: !!db,
    dbOk,
    wsEnabled: !!wsHub,
  };
}

export function buildAuthRuntimeInfo(db, dbOk) {
  return {
    env: cfg.app.env,
    hasDb: !!db,
    dbOk,
  };
}

export async function getDebugSessionPayload(req, db = null) {
  const cookies = parseCookies(req);
  const rawToken = cookies[getUserCookieName()] || "";
  const userSession = await loadUserSessionFromRequest(req, {
    db,
    touch: false,
  });

  return {
    cookieNames: Object.keys(cookies || {}),
    hasUserCookie: Boolean(rawToken),
    userCookieName: getUserCookieName(),
    rawTokenLength: rawToken ? rawToken.length : 0,
    verify: userSession?.ok
      ? {
          ok: true,
          error: null,
          payload: userSession.payload || null,
        }
      : {
          ok: false,
          error: userSession?.error || "unknown",
          payload: null,
        },
  };
}

export async function readCurrentSessions(req, db = null) {
  return {
    adminSession: await loadAdminSessionFromRequest(req, {
      db,
      touch: false,
    }),
    userSession: await loadUserSessionFromRequest(req, {
      db,
      touch: false,
    }),
  };
}
