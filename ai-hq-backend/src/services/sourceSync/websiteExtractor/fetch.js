import { cfg, n, obj, s, safeFetchText } from "./shared.js";
import { isLikelyHtmlDocument } from "./text.js";
import { buildInitialFetchCandidates } from "./url.js";

const FETCH_DEFAULTS = Object.freeze({
  entryTotalTimeoutMs: 18000,
  entryAttemptTimeoutMs: 14000,
  pageTimeoutMs: 12000,
  maxBytes: 1500000,
});

function safeByteLength(value = "") {
  try {
    return Buffer.byteLength(s(value), "utf8");
  } catch {
    return s(value).length;
  }
}

function buildFetchHeaders(url = "", customHeaders = {}) {
  const headers = obj(customHeaders);
  let rootReferer = url;

  try {
    const parsed = new URL(s(url));
    rootReferer = `${parsed.protocol}//${parsed.host}/`;
  } catch {
    rootReferer = url;
  }

  return {
    "user-agent": s(
      headers["user-agent"] ||
        cfg.sourceSync?.websiteUserAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    accept: s(
      headers.accept ||
        "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5"
    ),
    "accept-language": s(
      headers["accept-language"] || "en-US,en;q=0.9,az;q=0.8,tr;q=0.7,ru;q=0.6"
    ),
    "cache-control": s(headers["cache-control"] || "no-cache"),
    pragma: s(headers.pragma || "no-cache"),
    referer: s(headers.referer || rootReferer),
    ...headers,
  };
}

function normalizeFetchError(fetchResult = {}, fallback = "fetch_failed") {
  const explicitError = s(fetchResult?.error);
  if (explicitError) return explicitError;

  const status = Number(fetchResult?.status || 0);
  if (status >= 100) return `http_${status}`;

  return fallback;
}

function remainingBudget(deadlineAt = 0, fallbackMs = 0) {
  const left = Number(deadlineAt || 0) - Date.now();
  if (!Number.isFinite(left) || left <= 0) return 0;

  const cap = Number(fallbackMs || 0) || left;
  const next = Math.min(left, cap);

  return next >= 500 ? next : 0;
}

function resolveEntryFetchBudget(opts = {}) {
  const entryTotalTimeoutMs = Math.max(
    6000,
    n(
      opts.totalTimeoutMs,
      n(cfg.sourceSync?.websiteEntryTimeoutMs, FETCH_DEFAULTS.entryTotalTimeoutMs)
    )
  );

  const entryAttemptTimeoutMs = Math.max(
    2000,
    n(
      opts.attemptTimeoutMs,
      n(
        cfg.sourceSync?.websiteEntryAttemptTimeoutMs,
        FETCH_DEFAULTS.entryAttemptTimeoutMs
      )
    )
  );

  const retryCount = Math.max(
    0,
    n(opts.retryCount, n(cfg.sourceSync?.websiteEntryRetryCount, 4))
  );

  const totalTimeoutBudgetMs = Math.max(
    entryAttemptTimeoutMs,
    entryTotalTimeoutMs
  );

  return {
    entryTotalTimeoutMs,
    entryAttemptTimeoutMs,
    retryCount,
    totalTimeoutBudgetMs,
    perCandidateTotalTimeoutMs: Math.max(
      entryAttemptTimeoutMs,
      Math.min(totalTimeoutBudgetMs, entryAttemptTimeoutMs + 6000)
    ),
  };
}

function classifyHtmlDocument(fetched = {}, fallbackUrl = "") {
  if (!fetched?.ok) {
    return {
      ok: false,
      url: s(fetched?.url || fallbackUrl),
      error: normalizeFetchError(fetched, "fetch_failed"),
      status: Number(fetched?.status || 0),
      html: "",
      bytes: Number(fetched?.bytes || 0),
    };
  }

  const text = s(fetched?.text);
  if (!text) {
    return {
      ok: false,
      url: s(fetched?.url || fallbackUrl),
      error: "empty_response",
      status: Number(fetched?.status || 0),
      html: "",
      bytes: Number(fetched?.bytes || 0),
    };
  }

  if (!isLikelyHtmlDocument(text)) {
    return {
      ok: false,
      url: s(fetched?.url || fallbackUrl),
      error: "non_html_response",
      status: Number(fetched?.status || 0),
      html: "",
      bytes: Number(fetched?.bytes || 0),
    };
  }

  return {
    ok: true,
    url: s(fetched?.url || fallbackUrl),
    status: Number(fetched?.status || 200),
    html: text,
    bytes: Number(fetched?.bytes || safeByteLength(text)),
  };
}

function resolveTimeoutMs(opts = {}) {
  const explicit = Number(opts.timeoutMs);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(500, explicit);
  }

  return Math.max(
    4000,
    n(cfg.sourceSync?.websiteFetchTimeoutMs, FETCH_DEFAULTS.pageTimeoutMs)
  );
}

export async function fetchTextDocument(url = "", opts = {}) {
  const headers = obj(opts.headers);

  const timeoutMs = resolveTimeoutMs(opts);

  const maxBytes = Math.max(
    250000,
    n(
      opts.maxBytes,
      n(cfg.sourceSync?.websiteMaxHtmlBytes, FETCH_DEFAULTS.maxBytes)
    )
  );

  const fetchResult = await safeFetchText(url, {
    timeoutMs,
    maxBytes,
    headers: buildFetchHeaders(url, headers),
  });

  if (!fetchResult?.ok) {
    return {
      ok: false,
      url: s(fetchResult?.url || url),
      error: normalizeFetchError(fetchResult, "fetch_failed"),
      reasonCode: s(fetchResult?.reasonCode || fetchResult?.error || ""),
      denied: fetchResult?.denied === true,
      errorDetail: obj(fetchResult?.errorDetail),
      status: Number(fetchResult?.status || 0),
      text: "",
      bytes: 0,
    };
  }

  const text = s(fetchResult?.text);

  return {
    ok: true,
    url: s(fetchResult?.url || url),
    status: Number(fetchResult?.status || 200),
    text,
    bytes: safeByteLength(text),
  };
}

export async function fetchWebsitePage(url = "") {
  const fetched = await fetchTextDocument(url, {
    timeoutMs: Math.max(
      4000,
      n(
        cfg.sourceSync?.websitePageTimeoutMs,
        n(cfg.sourceSync?.websiteFetchTimeoutMs, FETCH_DEFAULTS.pageTimeoutMs)
      )
    ),
    maxBytes: n(cfg.sourceSync?.websiteMaxHtmlBytes, FETCH_DEFAULTS.maxBytes),
    headers: {
      "user-agent": cfg.sourceSync?.websiteUserAgent,
      accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
    },
  });

  return classifyHtmlDocument(fetched, url);
}

export async function fetchWebsiteEntry(sourceUrl = "", opts = {}) {
  const attempts = [];
  const candidates = buildInitialFetchCandidates(sourceUrl);
  const {
    retryCount,
    totalTimeoutBudgetMs,
    perCandidateTotalTimeoutMs,
    entryAttemptTimeoutMs,
  } = resolveEntryFetchBudget(opts);

  const perCandidateAttemptTimeoutMs = Math.max(
    2500,
    Math.min(entryAttemptTimeoutMs, perCandidateTotalTimeoutMs)
  );

  const maxBytes = Math.max(
    250000,
    n(cfg.sourceSync?.websiteMaxHtmlBytes, FETCH_DEFAULTS.maxBytes)
  );

  const deadlineAt = Date.now() + totalTimeoutBudgetMs;

  for (const candidate of candidates) {
    const remainingMs = remainingBudget(deadlineAt, perCandidateTotalTimeoutMs);

    if (remainingMs <= 0) {
      attempts.push({
        url: candidate,
        ok: false,
        status: 0,
        error: "entry_timeout_budget_exhausted",
      });
      break;
    }

    const candidateTotalTimeoutMs = Math.max(
      2500,
      Math.min(remainingMs, perCandidateTotalTimeoutMs)
    );
    const candidateAttemptTimeoutMs = Math.max(
      2000,
      Math.min(candidateTotalTimeoutMs, perCandidateAttemptTimeoutMs)
    );

    const fetched = await fetchTextDocument(candidate, {
      timeoutMs: candidateAttemptTimeoutMs,
      totalTimeoutMs: candidateTotalTimeoutMs,
      retryCount,
      maxBytes,
      headers: {
        "user-agent": cfg.sourceSync?.websiteUserAgent,
        accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
    });

    const htmlDoc = classifyHtmlDocument(fetched, candidate);

    attempts.push({
      url: candidate,
      ok: !!htmlDoc?.ok,
      status: Number(htmlDoc?.status || 0),
      error: s(htmlDoc?.error),
      bytes: Number(htmlDoc?.bytes || 0),
      timeoutMs: candidateTotalTimeoutMs,
      attemptTimeoutMs: candidateAttemptTimeoutMs,
    });

    if (s(htmlDoc?.error).startsWith("unsafe_")) {
      return {
        ok: false,
        error: s(htmlDoc.error),
        attempts,
      };
    }

    if (htmlDoc.ok) {
      return {
        ok: true,
        page: {
          ok: true,
          url: s(htmlDoc.url || candidate),
          status: Number(htmlDoc.status || 200),
          html: s(htmlDoc.html),
          bytes: Number(htmlDoc.bytes || 0),
        },
        attempts,
      };
    }
  }

  const last = attempts[attempts.length - 1] || {};

  return {
    ok: false,
    error: s(last.error || "website_fetch_failed"),
    attempts,
  };
}

export const __test__ = {
  buildFetchHeaders,
  resolveEntryFetchBudget,
};
