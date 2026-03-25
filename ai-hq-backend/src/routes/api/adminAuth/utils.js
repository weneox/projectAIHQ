import { cfg } from "../../../config.js";
import {
  parseCookies,
  loadAdminSessionFromRequest,
  loadUserSessionFromRequest,
  getUserCookieName,
} from "../../../utils/adminAuth.js";

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

function authDbTimeoutMs() {
  return 2500;
}

export function isDbTimeoutError(err) {
  const code = s(err?.code).toUpperCase();
  return (
    code === "AUTH_DB_TIMEOUT" ||
    code === "QUERY_TIMEOUT" ||
    /timeout|timed out/i.test(s(err?.message))
  );
}

export async function queryDbWithTimeout(db, queryText, params = [], { timeoutMs, label } = {}) {
  if (!db) {
    const err = new Error("Database is not available");
    err.code = "AUTH_DB_UNAVAILABLE";
    throw err;
  }

  const queryTimeoutMs = Math.max(250, Number(timeoutMs || authDbTimeoutMs()));
  const queryLabel = s(label || "auth.db");

  try {
    if (typeof queryText === "string") {
      return await db.query({
        text: queryText,
        values: params,
        query_timeout: queryTimeoutMs,
      });
    }

    return await db.query({
      ...queryText,
      query_timeout: queryTimeoutMs,
    });
  } catch (err) {
    if (
      s(err?.code).toUpperCase() === "AUTH_DB_TIMEOUT" ||
      s(err?.code).toUpperCase() === "QUERY_TIMEOUT" ||
      /timeout|timed out/i.test(s(err?.message))
    ) {
      console.error(`[${queryLabel}] timed out after ${queryTimeoutMs}ms`);
      err.code = "AUTH_DB_TIMEOUT";
      throw err;
    }

    throw err;
  }
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
