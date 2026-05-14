import { createLogger } from "../utils/logger.js";

const log = createLogger({
  service: "ai-hq-backend",
  component: "db-query-timeout",
});

function s(v, d = "") {
  return String(v ?? d).trim();
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
    if (isDbTimeoutError(err)) {
      log.error("auth.db.timeout", {
        queryLabel,
        timeoutMs: queryTimeoutMs,
      });
      err.code = "AUTH_DB_TIMEOUT";
      throw err;
    }

    throw err;
  }
}
