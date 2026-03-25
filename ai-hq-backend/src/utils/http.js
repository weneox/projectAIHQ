// src/utils/http.js
// FINAL v4.3 — tighter bounded fetch layer for website/source sync
// goals:
// - keep exported API shape compatible
// - fail faster on slow/blocked sites
// - preserve informative non-2xx status codes like http_403
// - reduce retry fan-out and total waiting time
// - keep website entry fetch from burning 30s+ on one source

export function okJson(res, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json(payload);
}

export function serviceUnavailableJson(
  res,
  error = "database unavailable",
  extra = {}
) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(503).json({
    ok: false,
    error,
    code: "DB_UNAVAILABLE",
    ...extra,
  });
}

export function clamp(nv, a, b) {
  const x = Number(nv);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

export function serializeError(err) {
  const e = err || {};
  const isAgg = e && (e.name === "AggregateError" || Array.isArray(e.errors));
  const base = {
    name: e.name || "Error",
    message: e.message || String(e),
    stack: e.stack || null,
  };

  if (isAgg) {
    base.errors = (e.errors || []).map((x) => ({
      name: x?.name || "Error",
      message: x?.message || String(x),
      stack: x?.stack || null,
    }));
  }

  if (e.cause) {
    base.cause = {
      name: e.cause?.name || "Error",
      message: e.cause?.message || String(e.cause),
      stack: e.cause?.stack || null,
    };
  }

  if (typeof e.code !== "undefined") base.code = e.code;
  if (typeof e.errno !== "undefined") base.errno = e.errno;
  if (typeof e.type !== "undefined") base.type = e.type;

  return base;
}

export function isUuid(v) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

export function isDigits(v) {
  const s = String(v || "").trim();
  return /^[0-9]{1,12}$/.test(s);
}

export function nowIso() {
  return new Date().toISOString();
}

export function isDbReady(db) {
  return Boolean(db && typeof db.query === "function");
}

export function createDbUnavailableError(message = "database unavailable") {
  const err = new Error(message);
  err.code = "DB_UNAVAILABLE";
  return err;
}

export function assertDbReady(db, message = "database unavailable") {
  if (!isDbReady(db)) {
    throw createDbUnavailableError(message);
  }
}

export function normalizeDecision(d) {
  let decision = String(d || "").trim().toLowerCase();
  if (decision === "approve") decision = "approved";
  if (decision === "reject") decision = "rejected";
  return decision;
}

export function isFinalStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "rejected" || s === "published";
}

export function withTimeout(ms = 10000) {
  const timeoutMs = clamp(ms, 1, 300000);
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort();
    } catch {
      // noop
    }
  }, timeoutMs);

  return {
    controller,
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => clearTimeout(timeout),
  };
}

export function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  return `https://${raw.replace(/^\/+/, "")}`;
}

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function uniq(list = []) {
  return [...new Set((Array.isArray(list) ? list : []).map((x) => s(x)).filter(Boolean))];
}

function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function jitter(base = 0, spread = 80) {
  const b = Math.max(0, Number(base) || 0);
  const sp = Math.max(0, Number(spread) || 0);
  return b + Math.floor(Math.random() * (sp + 1));
}

function isRetryableStatus(status = 0) {
  return [
    403,
    408,
    421,
    425,
    429,
    500,
    502,
    503,
    504,
    520,
    521,
    522,
    523,
    524,
    525,
    526,
  ].includes(Number(status || 0));
}

function isRetryableNetworkError(err) {
  const msg = `${err?.message || ""} ${err?.cause?.message || ""}`.toLowerCase();
  const code = lower(err?.code || err?.cause?.code || err?.errno || err?.cause?.errno || "");

  if (
    [
      "etimedout",
      "econnreset",
      "econnrefused",
      "ehostunreach",
      "enetunreach",
      "enotfound",
      "eai_again",
      "e_pipe",
      "ecanceled",
      "econnaborted",
      "err_socket_connection_timeout",
      "und_err_connect_timeout",
      "und_err_headers_timeout",
      "und_err_body_timeout",
      "und_err_socket",
      "fetch_timeout",
    ].includes(code)
  ) {
    return true;
  }

  return /timeout|timed out|aborted|fetch failed|socket|tls|certificate|handshake|network|reset|refused|unreachable|dns/i.test(
    msg
  );
}

function buildDefaultDesktopChromeUa() {
  return (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36"
  );
}

function buildDesktopFirefoxUa() {
  return (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) " +
    "Gecko/20100101 Firefox/124.0"
  );
}

function buildMobileSafariUa() {
  return (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
    "Version/17.4 Mobile/15E148 Safari/604.1"
  );
}

function cleanHeaderValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(value).trim();
}

function cleanHeaders(headers = {}) {
  const out = {};

  for (const [rawKey, rawValue] of Object.entries(headers || {})) {
    const key = String(rawKey || "").trim();
    const value = cleanHeaderValue(rawValue);
    if (!key || !value) continue;
    out[key.toLowerCase()] = value;
  }

  return out;
}

function mergeHeaders(...sets) {
  const out = {};
  for (const set of sets) {
    const cleaned = cleanHeaders(set);
    for (const [key, value] of Object.entries(cleaned)) {
      out[key] = value;
    }
  }
  return out;
}

function buildUrlContext(url = "") {
  const finalUrl = normalizeUrl(url);

  try {
    const u = new URL(finalUrl);
    return {
      finalUrl,
      origin: `${u.protocol}//${u.host}`,
      rootReferer: `${u.protocol}//${u.host}/`,
      host: u.host,
      hostname: u.hostname,
      protocol: u.protocol,
      pathname: u.pathname || "/",
      search: u.search || "",
    };
  } catch {
    return {
      finalUrl,
      origin: "",
      rootReferer: "",
      host: "",
      hostname: "",
      protocol: "",
      pathname: "/",
      search: "",
    };
  }
}

function isIpHost(hostname = "") {
  const host = s(hostname);
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host);
}

function canToggleWww(hostname = "") {
  const host = s(hostname);
  if (!host) return false;
  if (isIpHost(host)) return false;
  if (host === "localhost") return false;
  if (!host.includes(".")) return false;
  return true;
}

function buildUrlVariants(url = "", method = "GET") {
  const normalized = normalizeUrl(url);
  if (!normalized) return [];

  if (!["GET", "HEAD"].includes(String(method || "GET").toUpperCase())) {
    return [normalized];
  }

  try {
    const u = new URL(normalized);
    const hostname = s(u.hostname);
    const host = s(u.host);
    const pathAndSearch = `${u.pathname || "/"}${u.search || ""}`;

    const variants = [normalized];

    const toggledProtocol = u.protocol === "https:" ? "http:" : "https:";
    variants.push(`${toggledProtocol}//${host}${pathAndSearch}`);

    if (canToggleWww(hostname)) {
      const toggledHost = /^www\./i.test(host)
        ? host.replace(/^www\./i, "")
        : `www.${host}`;
      variants.push(`${u.protocol}//${toggledHost}${pathAndSearch}`);
    }

    return uniq(variants);
  } catch {
    return [normalized];
  }
}

function buildHeaderVariants(inputHeaders = {}, url = "") {
  const ctx = buildUrlContext(url);
  const chromeUa = buildDefaultDesktopChromeUa();
  const firefoxUa = buildDesktopFirefoxUa();
  const mobileSafariUa = buildMobileSafariUa();

  const commonLang = "en-US,en;q=0.9,az;q=0.8,tr;q=0.7,ru;q=0.6";

  const chromeRelaxed = {
    "user-agent": chromeUa,
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
    "accept-language": commonLang,
    "accept-encoding": "gzip, deflate, br",
    "upgrade-insecure-requests": "1",
    ...(ctx.rootReferer ? { referer: ctx.rootReferer } : {}),
  };

  const chromeTopLevel = {
    "user-agent": chromeUa,
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": commonLang,
    "accept-encoding": "gzip, deflate, br",
    "cache-control": "max-age=0",
    pragma: "no-cache",
    dnt: "1",
    "upgrade-insecure-requests": "1",
    "sec-ch-ua": `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-fetch-site": "none",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "sec-fetch-dest": "document",
    ...(ctx.rootReferer ? { referer: ctx.rootReferer } : {}),
  };

  const firefoxTopLevel = {
    "user-agent": firefoxUa,
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "accept-language": commonLang,
    "accept-encoding": "gzip, deflate, br",
    "cache-control": "no-cache",
    pragma: "no-cache",
    dnt: "1",
    "upgrade-insecure-requests": "1",
    ...(ctx.rootReferer ? { referer: ctx.rootReferer } : {}),
  };

  const mobileSafari = {
    "user-agent": mobileSafariUa,
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": commonLang,
    "accept-encoding": "gzip, deflate, br",
    "upgrade-insecure-requests": "1",
    "sec-fetch-site": "none",
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    ...(ctx.rootReferer ? { referer: ctx.rootReferer } : {}),
  };

  return [
    mergeHeaders(chromeRelaxed, inputHeaders),
    mergeHeaders(chromeTopLevel, inputHeaders),
    mergeHeaders(firefoxTopLevel, inputHeaders),
    mergeHeaders(mobileSafari, inputHeaders),
  ].map((x) => cleanHeaders(x));
}

function buildAttemptPlans(url = "", inputHeaders = {}, method = "GET") {
  const urlVariants = buildUrlVariants(url, method);
  const plans = [];
  const seen = new Set();

  for (let urlIndex = 0; urlIndex < urlVariants.length; urlIndex += 1) {
    const candidateUrl = urlVariants[urlIndex];
    const headerVariants = buildHeaderVariants(inputHeaders, candidateUrl);

    const headerLimit =
      urlIndex === 0 ? headerVariants.length : Math.min(2, headerVariants.length);

    for (let headerIndex = 0; headerIndex < headerLimit; headerIndex += 1) {
      const key = `${candidateUrl}||${headerIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);

      plans.push({
        url: candidateUrl,
        headers: headerVariants[headerIndex],
        headerProfileIndex: headerIndex,
        urlVariantIndex: urlIndex,
      });
    }
  }

  return plans;
}

function planPriorityScore(plan = {}) {
  const urlVariantIndex = Number(plan?.urlVariantIndex || 0);
  const headerProfileIndex = Number(plan?.headerProfileIndex || 0);
  let score = 0;

  if (urlVariantIndex === 0) score += 120;
  else if (urlVariantIndex === 1) score += 80;
  else score += Math.max(0, 30 - urlVariantIndex * 4);

  if (headerProfileIndex === 1) score += 16;
  else if (headerProfileIndex === 3) score += 12;
  else if (headerProfileIndex === 2) score += 8;
  else score += 4;

  return score;
}

function prioritizeAttemptPlans(plans = []) {
  return [...plans].sort((a, b) => {
    const scoreDiff = planPriorityScore(b) - planPriorityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return (
      Number(a?.urlVariantIndex || 0) - Number(b?.urlVariantIndex || 0) ||
      Number(a?.headerProfileIndex || 0) - Number(b?.headerProfileIndex || 0)
    );
  });
}

function buildNonOkErrorCode(status = 0) {
  const code = Number(status || 0);
  if (!code) return "fetch_failed";
  return `http_${code}`;
}

function pickCharsetFromContentType(contentType = "") {
  const raw = s(contentType);
  const match = raw.match(/charset\s*=\s*["']?\s*([^;"'\s]+)/i);
  let charset = lower(match?.[1] || "utf-8");

  if (!charset) return "utf-8";
  if (charset === "utf8") return "utf-8";
  if (charset === "latin1") return "windows-1252";
  if (charset === "cp1251") return "windows-1251";
  if (charset === "win-1251") return "windows-1251";
  if (charset === "windows1251") return "windows-1251";
  if (charset === "cp1252") return "windows-1252";
  if (charset === "win-1252") return "windows-1252";
  if (charset === "iso-8859-1") return "windows-1252";

  return charset;
}

function makeDecoder(contentType = "") {
  const charset = pickCharsetFromContentType(contentType);
  try {
    return new TextDecoder(charset, { fatal: false });
  } catch {
    return new TextDecoder("utf-8", { fatal: false });
  }
}

function nonOkResultScore(result = {}) {
  let score = 0;
  const status = Number(result?.status || 0);
  const excerptLen = Buffer.byteLength(String(result?.bodyExcerpt || ""), "utf8");

  if (status > 0) score += 100;
  if (status === 403) score += 30;
  if (status === 429) score += 24;
  if (status === 404) score += 18;
  if (status >= 400 && status < 500) score += 15;
  if (status >= 500) score += 10;
  score += Math.min(20, Math.floor(excerptLen / 40));

  if (result?.urlVariantIndex === 0) score += 4;
  return score;
}

function chooseBetterNonOk(a, b) {
  if (!a) return b;
  if (!b) return a;
  return nonOkResultScore(b) >= nonOkResultScore(a) ? b : a;
}

function remainingBudget(deadlineAt = 0) {
  const left = Number(deadlineAt || 0) - Date.now();
  if (!Number.isFinite(left)) return 0;
  return Math.max(0, left);
}

function shouldRetryNonOk(status = 0) {
  return isRetryableStatus(status);
}

function buildTimeoutLikeError(timeoutMs = 0, cause = null) {
  const err = new Error(`Request timeout after ${timeoutMs}ms`);
  err.code = "FETCH_TIMEOUT";
  if (cause) err.cause = cause;
  return err;
}

export async function readResponseTextLimited(response, maxBytes = 2_000_000) {
  const limit = clamp(maxBytes, 1, 50_000_000);
  const contentType = s(response?.headers?.get?.("content-type") || "");
  const decoder = makeDecoder(contentType);
  const reader = response.body?.getReader?.();

  if (!reader) {
    try {
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.subarray(0, limit).toString("utf8");
    } catch {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") <= limit) return text;
      return Buffer.from(text, "utf8").subarray(0, limit).toString("utf8");
    }
  }

  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const remaining = limit - total;
    if (remaining <= 0) {
      try {
        await reader.cancel?.();
      } catch {
        // noop
      }
      break;
    }

    if (value.byteLength > remaining) {
      text += decoder.decode(value.subarray(0, remaining), { stream: true });
      total += remaining;
      try {
        await reader.cancel?.();
      } catch {
        // noop
      }
      break;
    }

    total += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export async function safeFetchText(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    timeoutMs = 10000,
    totalTimeoutMs,
    maxBytes = 2_000_000,
    body,
    redirect = "follow",
    retryCount,
    retryDelayMs = 180,
  } = options;

  const methodUpper = String(method || "GET").toUpperCase();
  const finalUrl = normalizeUrl(url);
  const canRetry = !body && ["GET", "HEAD"].includes(methodUpper);

  if (!finalUrl) {
    return {
      ok: false,
      status: 0,
      statusText: "FETCH_ERROR",
      url: "",
      headers: {},
      contentType: "",
      text: "",
      error: "fetch_failed",
      errorDetail: {
        name: "Error",
        message: "URL is required",
        stack: null,
      },
      attempt: 0,
      attempts: [],
    };
  }

  const perAttemptTimeoutMs = clamp(timeoutMs, 1000, 300000);

  const defaultOverallTimeoutMs = canRetry
    ? Math.max(perAttemptTimeoutMs + 3500, Math.round(perAttemptTimeoutMs * 1.75))
    : perAttemptTimeoutMs;

  const overallTimeoutMs = clamp(
    totalTimeoutMs ?? defaultOverallTimeoutMs,
    1000,
    120000
  );

  const plans = buildAttemptPlans(finalUrl, headers, methodUpper);

  const defaultMaxAttempts = canRetry ? Math.min(5, plans.length) : 1;
  const maxAttempts =
    typeof retryCount === "number"
      ? clamp(retryCount + 1, 1, Math.min(Math.max(1, plans.length), 6))
      : defaultMaxAttempts;

  const selectedPlans = prioritizeAttemptPlans(plans).slice(0, maxAttempts);
  const attempts = [];
  let lastError = null;
  let bestNonOkResult = null;
  const deadlineAt = Date.now() + overallTimeoutMs;

  for (let i = 0; i < selectedPlans.length; i += 1) {
    const plan = selectedPlans[i];
    const budgetLeftMs = remainingBudget(deadlineAt);

    if (budgetLeftMs <= 0) {
      lastError = buildTimeoutLikeError(overallTimeoutMs);
      break;
    }

    const thisAttemptTimeoutMs = clamp(
      Math.min(perAttemptTimeoutMs, budgetLeftMs),
      1000,
      300000
    );

    const timeoutCtl = withTimeout(thisAttemptTimeoutMs);

    try {
      const response = await fetch(plan.url, {
        method: methodUpper,
        headers: plan.headers,
        body,
        redirect,
        signal: timeoutCtl.signal,
        referrerPolicy: "strict-origin-when-cross-origin",
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const contentType = s(response.headers.get("content-type") || "");
      const text =
        methodUpper === "HEAD"
          ? ""
          : await readResponseTextLimited(response, maxBytes);

      timeoutCtl.cleanup();

      const result = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || plan.url || finalUrl,
        headers: responseHeaders,
        contentType,
        text,
        error: response.ok ? "" : buildNonOkErrorCode(response.status),
        attempt: i,
        requestHeaders: plan.headers,
        attempts,
      };

      attempts.push({
        attempt: i,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || plan.url || finalUrl,
        plannedUrl: plan.url,
        headerProfileIndex: plan.headerProfileIndex,
        urlVariantIndex: plan.urlVariantIndex,
        timeoutMs: thisAttemptTimeoutMs,
        error: response.ok ? "" : buildNonOkErrorCode(response.status),
      });

      if (response.ok) {
        return result;
      }

      bestNonOkResult = chooseBetterNonOk(bestNonOkResult, {
        ...result,
        bodyExcerpt: String(text || "").slice(0, 600),
        headerProfileIndex: plan.headerProfileIndex,
        urlVariantIndex: plan.urlVariantIndex,
      });

      const shouldContinue =
        canRetry &&
        i < selectedPlans.length - 1 &&
        remainingBudget(deadlineAt) > 800 &&
        shouldRetryNonOk(response.status);

      if (shouldContinue) {
        await sleep(
          Math.min(
            jitter(retryDelayMs * (i + 1), 80),
            Math.max(80, remainingBudget(deadlineAt) - 150)
          )
        );
        continue;
      }

      return {
        ...result,
        attempts,
      };
    } catch (rawErr) {
      timeoutCtl.cleanup();

      const err = timeoutCtl.didTimeout()
        ? buildTimeoutLikeError(thisAttemptTimeoutMs, rawErr)
        : rawErr;

      lastError = err;

      attempts.push({
        attempt: i,
        ok: false,
        status: 0,
        statusText: "FETCH_ERROR",
        url: plan.url || finalUrl,
        plannedUrl: plan.url,
        headerProfileIndex: plan.headerProfileIndex,
        urlVariantIndex: plan.urlVariantIndex,
        timeoutMs: thisAttemptTimeoutMs,
        error: err?.message || String(err) || "Fetch failed",
      });

      const shouldContinue =
        canRetry &&
        i < selectedPlans.length - 1 &&
        remainingBudget(deadlineAt) > 800 &&
        isRetryableNetworkError(err);

      if (shouldContinue) {
        await sleep(
          Math.min(
            jitter(retryDelayMs * (i + 1), 100),
            Math.max(80, remainingBudget(deadlineAt) - 150)
          )
        );
        continue;
      }

      if (bestNonOkResult) {
        return {
          ...bestNonOkResult,
          attempts,
        };
      }

      return {
        ok: false,
        status: 0,
        statusText: "FETCH_ERROR",
        url: plan.url || finalUrl,
        headers: {},
        contentType: "",
        text: "",
        error:
          err?.code === "FETCH_TIMEOUT"
            ? "fetch_timeout"
            : err?.message || String(err) || "Fetch failed",
        errorDetail: serializeError(err),
        attempt: i,
        attempts,
      };
    }
  }

  if (bestNonOkResult) {
    return {
      ...bestNonOkResult,
      attempts,
    };
  }

  return {
    ok: false,
    status: 0,
    statusText: "FETCH_ERROR",
    url: finalUrl,
    headers: {},
    contentType: "",
    text: "",
    error:
      lastError?.code === "FETCH_TIMEOUT"
        ? "fetch_timeout"
        : lastError?.message || "Fetch failed",
    errorDetail: serializeError(lastError),
    attempt: Math.max(0, selectedPlans.length - 1),
    attempts,
  };
}

export const __test__ = {
  buildAttemptPlans,
  prioritizeAttemptPlans,
};
