import { cfg, n, normalizeUrl, s, uniq, uniqBy } from "./shared.js";
import { canonicalPageKey } from "./url.js";
import { fetchWebsiteEntry, fetchWebsitePage } from "./fetch.js";
import {
  buildPriorityPathSeeds,
  collectNextPageCandidates,
  fetchRobotsFile,
  fetchSitemapCandidates,
  isRobotsAllowed,
} from "./discovery.js";
import { analyzePage } from "./pageModel.js";
import { finalizePageAdmissions } from "./admission.js";
import { buildSiteRollup } from "./rollup.js";

const DEFAULT_CRAWL_LIMITS = Object.freeze({
  maxPagesAllowed: 6,
  maxCandidatesQueued: 40,
  maxFetchPages: 10,
  totalCrawlMs: 32000,
  entryFetchMs: 18000,
  robotsFetchMs: 2200,
  sitemapFetchMs: 4500,
  pageFetchMs: 7000,
  finalizeReserveMs: 4000,
  minStepBudgetMs: 400,
});

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function safeScore(v) {
  return safeNum(v?.score, 0);
}

function safeByteLength(text = "") {
  try {
    return Buffer.byteLength(String(text || ""), "utf8");
  } catch {
    return String(text || "").length;
  }
}

function clampCount(value, fallback, min, max) {
  const x = safeNum(value, fallback);
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function clampMs(value, fallback, min = 500, max = 120000) {
  const x = safeNum(value, fallback);
  return Math.max(min, Math.min(max, x));
}

function resolveCrawlLimits() {
  const totalCrawlMs = clampMs(
    cfg?.sourceSync?.websiteExtractTimeoutMs,
    DEFAULT_CRAWL_LIMITS.totalCrawlMs,
    12000,
    180000
  );

  const finalizeReserveMs = clampMs(
    cfg?.sourceSync?.websiteFinalizeReserveMs,
    DEFAULT_CRAWL_LIMITS.finalizeReserveMs,
    1500,
    Math.max(2500, Math.floor(totalCrawlMs * 0.35))
  );

  const entryFetchMs = clampMs(
    cfg?.sourceSync?.websiteEntryTimeoutMs,
    n(cfg?.sourceSync?.websiteFetchTimeoutMs, DEFAULT_CRAWL_LIMITS.entryFetchMs),
    2500,
    totalCrawlMs
  );

  const robotsFetchMs = clampMs(
    cfg?.sourceSync?.websiteRobotsTimeoutMs,
    DEFAULT_CRAWL_LIMITS.robotsFetchMs,
    800,
    totalCrawlMs
  );

  const sitemapFetchMs = clampMs(
    cfg?.sourceSync?.websiteSitemapTimeoutMs,
    DEFAULT_CRAWL_LIMITS.sitemapFetchMs,
    800,
    totalCrawlMs
  );

  const pageFetchMs = clampMs(
    cfg?.sourceSync?.websitePageTimeoutMs,
    n(cfg?.sourceSync?.websiteFetchTimeoutMs, DEFAULT_CRAWL_LIMITS.pageFetchMs),
    1800,
    totalCrawlMs
  );

  const minStepBudgetMs = clampMs(
    cfg?.sourceSync?.websiteMinStepBudgetMs,
    DEFAULT_CRAWL_LIMITS.minStepBudgetMs,
    250,
    5000
  );

  return {
    maxPagesAllowed: clampCount(
      cfg?.sourceSync?.websiteMaxPagesAllowed,
      DEFAULT_CRAWL_LIMITS.maxPagesAllowed,
      1,
      50
    ),
    maxCandidatesQueued: clampCount(
      cfg?.sourceSync?.websiteMaxCandidatesQueued,
      DEFAULT_CRAWL_LIMITS.maxCandidatesQueued,
      5,
      300
    ),
    maxFetchPages: clampCount(
      cfg?.sourceSync?.websiteMaxFetchPages,
      DEFAULT_CRAWL_LIMITS.maxFetchPages,
      1,
      100
    ),
    totalCrawlMs,
    entryFetchMs,
    robotsFetchMs,
    sitemapFetchMs,
    pageFetchMs,
    finalizeReserveMs,
    minStepBudgetMs,
  };
}

function buildTimeoutError(step, timeoutMs) {
  const safeStep = s(step || "step")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();

  const err = new Error(`website ${safeStep} timed out after ${timeoutMs}ms`);
  err.code = `WEBSITE_${safeStep}_TIMEOUT`.toUpperCase();
  err.step = safeStep;
  err.timeoutMs = timeoutMs;
  err.isTimeout = true;
  err.label = `website_${safeStep}_timeout_${timeoutMs}ms`;
  return err;
}

async function withTimeout(task, timeoutMs, step) {
  const budget = safeNum(timeoutMs, 0);
  if (budget <= 0) {
    throw buildTimeoutError(step, budget);
  }

  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve().then(() => task()),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(buildTimeoutError(step, budget));
        }, budget);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function remainingBudget(deadlineAt, fallbackMs, minBudgetMs = 400) {
  const left = safeNum(deadlineAt, 0) - Date.now();
  if (!Number.isFinite(left) || left <= 0) return 0;

  const cap = safeNum(fallbackMs, 0) || left;
  const next = Math.min(left, cap);

  return next >= minBudgetMs ? next : 0;
}

function trimQueuedCandidates(items = [], seen = new Set(), limit = 24) {
  return uniqBy(
    safeArray(items)
      .map((item) => ({
        ...item,
        url: s(item?.url),
        source: s(item?.source || "unknown"),
        depth: safeNum(item?.depth, 0),
        score: safeScore(item),
      }))
      .filter((item) => item.url)
      .filter((item) => !seen.has(canonicalPageKey(item.url))),
    (item) => canonicalPageKey(item.url)
  ).slice(0, limit);
}

function candidatePriorityBoost(item = {}) {
  const url = s(item?.url).toLowerCase();
  const source = s(item?.source).toLowerCase();
  let boost = 0;

  if (source.includes("priority")) boost += 25;
  if (source.includes("sitemap")) boost += 8;
  if (source.includes("anchor")) boost += 4;

  if (
    /(about|haqqimizda|haqqımızda|company|contact|elaqe|əlaqə|services|xidmet|xidmət|pricing|price|tarif|faq|support|location|locations|branch|branches|office|offices)/i.test(
      url
    )
  ) {
    boost += 18;
  }

  if (/(privacy|policy|terms|cookie|blog|news|career|vacancy|login|register)/i.test(url)) {
    boost -= 12;
  }

  const depth = safeNum(item?.depth, 0);
  if (depth <= 2) boost += 5;
  if (depth >= 4) boost -= 4;

  return boost;
}

function sortPendingCandidates(items = []) {
  return safeArray(items).sort((a, b) => {
    const scoreA = safeScore(a) + candidatePriorityBoost(a);
    const scoreB = safeScore(b) + candidatePriorityBoost(b);
    return scoreB - scoreA || s(a?.url).localeCompare(s(b?.url));
  });
}

function isBusinessCriticalPageType(pageType = "") {
  return [
    "about",
    "contact",
    "services",
    "pricing",
    "faq",
    "booking",
    "locations",
    "team",
  ].includes(s(pageType));
}

function pageLooksUseful(page = {}) {
  return (
    isBusinessCriticalPageType(page?.pageType) ||
    safeArray(page?.emails).length > 0 ||
    safeArray(page?.phones).length > 0 ||
    safeArray(page?.addresses).length > 0 ||
    safeArray(page?.hours).length > 0 ||
    safeArray(page?.serviceHints).length > 0 ||
    safeArray(page?.faqItems).length > 0
  );
}

function countUsefulPages(pages = []) {
  return safeArray(pages).filter((x) => pageLooksUseful(x)).length;
}

function buildHostnameLabel(url = "") {
  try {
    const u = new URL(url);
    const host = s(u.hostname).replace(/^www\./i, "");
    const label = host.split(".")[0] || host || "Website";
    return label
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return "Website";
  }
}

function buildBlockedSyntheticPage(url = "", warning = "entry_fetch_blocked") {
  const finalUrl = normalizeUrl(url);
  const title = buildHostnameLabel(finalUrl);

  return {
    url: finalUrl,
    canonicalUrl: finalUrl,
    pageType: "generic",
    title,
    metaDescription: "",
    text: "",
    visibleExcerpt: "",
    headings: [title],
    paragraphs: [],
    listItems: [],
    links: [],
    anchorRecords: [],
    emails: [],
    phones: [],
    addresses: [],
    hours: [],
    socialLinks: [],
    whatsappLinks: [],
    bookingLinks: [],
    faqItems: [],
    serviceHints: [],
    pricingHints: [],
    structured: {
      names: [title],
      descriptions: [],
      emails: [],
      phones: [],
      addresses: [],
      hours: [],
      sameAs: [],
    },
    primaryCta: null,
    sections: {
      hero: "",
      about: "",
      contact: "",
      pricing: "",
      faq: "",
      policy: "",
    },
    metrics: {
      htmlBytes: 0,
      textLength: 0,
      headingCount: 1,
      paragraphCount: 0,
      listItemCount: 0,
      linkCount: 0,
      emailCount: 0,
      phoneCount: 0,
      faqCount: 0,
      addressCount: 0,
      hoursCount: 0,
      socialLinkCount: 0,
      whatsappLinkCount: 0,
      bookingLinkCount: 0,
    },
    qualityWarnings: [warning],
    quality: {
      score: 0,
      band: "weak",
    },
    analysis: {
      signalCount: 0,
      evidenceCount: 0,
      minimalShell: true,
      shellSignature: "",
    },
  };
}

function buildBlockedExtractionResult({
  sourceUrl,
  entry,
  startedAtMs,
  totalCrawlMs,
  finalizeReserveMs,
  warning,
}) {
  const blockedPage = buildBlockedSyntheticPage(
    entry?.page?.url || entry?.url || sourceUrl,
    warning
  );

  const site = buildSiteRollup(blockedPage, [blockedPage], [
    warning,
    "blocked_entry_fetch",
    "limited_page_coverage",
  ]);

  return {
    kind: "website_raw_v7_6_modular",
    sourceUrl,
    finalUrl: blockedPage.url,
    crawl: {
      fetchedAt: new Date().toISOString(),
      startedAt: new Date(startedAtMs).toISOString(),
      deadlineMs: totalCrawlMs,
      crawlBudgetMs: Math.max(0, totalCrawlMs - finalizeReserveMs),
      finalizeReserveMs,
      elapsedMs: Date.now() - startedAtMs,
      entryAttempts: safeArray(entry?.attempts),
      pagesRequested: 1,
      pagesSucceeded: 0,
      pagesKept: 1,
      pagesRejected: 0,
      pagesFailed: 1,
      pagesSkipped: 0,
      pagesPendingLeft: 0,
      maxPagesAllowed: 1,
      maxCandidatesQueued: 0,
      maxFetchPages: 1,
      mainHtmlBytes: 0,
      failures: [
        {
          url: s(entry?.page?.url || entry?.url || sourceUrl),
          error: warning,
          status: safeNum(entry?.status, 0),
          source: "entry",
        },
      ],
      skipped: [],
      rejected: [],
      warnings: uniq([warning, "blocked_entry_fetch"]),
    },
    discovery: {
      robots: {
        found: false,
        url: "",
        disallowAll: false,
        allowCount: 0,
        disallowCount: 0,
        sitemapsDeclared: [],
      },
      sitemap: {
        found: false,
        files: [],
        candidateCount: 0,
      },
    },
    site,
    pages: [blockedPage],
    pageAdmissions: [
      {
        url: blockedPage.url,
        canonicalUrl: blockedPage.canonicalUrl,
        keep: true,
        reason: "entry_blocked_placeholder",
        pageType: blockedPage.pageType,
      },
    ],
    siteText: "",
  };
}

function isEntryHardBlocked(entry = {}) {
  const status = safeNum(entry?.status, 0);
  const error = s(entry?.error);
  return (
    [401, 403, 406, 410, 429, 451].includes(status) ||
    error.startsWith("unsafe_")
  );
}

async function crawlPendingQueue({
  pending,
  fetchedPageRecords,
  failed,
  skipped,
  seen,
  mainPageUrl,
  robots,
  crawlDeadlineAt,
  pageFetchMs,
  minStepBudgetMs,
  maxFetchPages,
  maxCandidatesQueued,
  stopAtTotalPages = 0,
}) {
  let queue = trimQueuedCandidates(pending, seen, maxCandidatesQueued);

  while (fetchedPageRecords.length < maxFetchPages && queue.length > 0) {
    if (stopAtTotalPages > 0 && fetchedPageRecords.length >= stopAtTotalPages) {
      break;
    }

    const pageBudget = remainingBudget(
      crawlDeadlineAt,
      pageFetchMs,
      minStepBudgetMs
    );

    if (pageBudget <= 0) {
      break;
    }

    queue = sortPendingCandidates(queue);
    const next = queue.shift();
    const nextUrl = s(next?.url);

    if (!nextUrl) continue;

    const nextKey = canonicalPageKey(nextUrl);
    if (seen.has(nextKey)) continue;

    if (robots && !isRobotsAllowed(nextUrl, robots)) {
      skipped.push({
        url: nextUrl,
        reason: "blocked_by_robots",
        source: s(next?.source || "unknown"),
      });
      seen.add(nextKey);
      continue;
    }

    seen.add(nextKey);

    let fetched = null;
    try {
      fetched = await withTimeout(
        () => fetchWebsitePage(nextUrl),
        pageBudget,
        "page_fetch"
      );
    } catch (err) {
      failed.push({
        url: nextUrl,
        error: s(err?.label || err?.message || err?.code || "fetch_failed"),
        status: 0,
        source: s(next?.source || "unknown"),
      });
      continue;
    }

    if (!fetched?.ok || !fetched?.html) {
      failed.push({
        url: nextUrl,
        error: s(fetched?.error || "fetch_failed"),
        status: safeNum(fetched?.status, 0),
        source: s(next?.source || "unknown"),
      });
      continue;
    }

    let page = null;
    try {
      page = analyzePage({
        html: fetched.html,
        pageUrl: fetched.url,
      });
    } catch (err) {
      failed.push({
        url: s(fetched?.url || nextUrl),
        error: `page_analyze_failed: ${s(err?.message || "unknown error")}`,
        status: safeNum(fetched?.status, 0),
        source: s(next?.source || "unknown"),
      });
      continue;
    }

    const pageKey = canonicalPageKey(page.canonicalUrl || page.url);
    if (
      fetchedPageRecords.some(
        (x) => canonicalPageKey(x.page?.canonicalUrl || x.page?.url) === pageKey
      )
    ) {
      continue;
    }

    fetchedPageRecords.push({
      page,
      source: s(next?.source || "unknown"),
      depth: safeNum(next?.depth, 0),
    });

    let discovered = [];
    try {
      discovered = collectNextPageCandidates(
        page.anchorRecords,
        mainPageUrl,
        Math.max(2, safeNum(next?.depth, 1) + 1)
      );
    } catch {
      discovered = [];
    }

    queue = trimQueuedCandidates(
      [...queue, ...discovered],
      seen,
      maxCandidatesQueued
    );
  }

  return queue;
}

export async function extractWebsiteSource(source) {
  const sourceUrl = normalizeUrl(source?.source_url || source?.url);
  if (!sourceUrl) {
    throw new Error("website source_url is required");
  }

  const {
    maxPagesAllowed,
    maxCandidatesQueued,
    maxFetchPages,
    totalCrawlMs,
    entryFetchMs,
    robotsFetchMs,
    sitemapFetchMs,
    pageFetchMs,
    finalizeReserveMs,
    minStepBudgetMs,
  } = resolveCrawlLimits();

  const startedAtMs = Date.now();
  const hardDeadlineAt = startedAtMs + totalCrawlMs;
  const crawlDeadlineAt = hardDeadlineAt - finalizeReserveMs;
  const crawlStartedAt = new Date(startedAtMs).toISOString();

  const discoveryWarnings = [];

  const entryBudget = remainingBudget(
    crawlDeadlineAt,
    entryFetchMs,
    minStepBudgetMs
  );

  if (entryBudget <= 0) {
    throw buildTimeoutError("entry_fetch", entryFetchMs);
  }

  const entry = await fetchWebsiteEntry(sourceUrl, {
    totalTimeoutMs: entryBudget,
    attemptTimeoutMs: Math.max(
      3000,
      Math.min(
        entryBudget,
        n(
          cfg?.sourceSync?.websiteEntryAttemptTimeoutMs,
          Math.max(12000, Math.round(entryBudget * 0.8))
        )
      )
    ),
  });

  if (isEntryHardBlocked(entry)) {
    return buildBlockedExtractionResult({
      sourceUrl,
      entry,
      startedAtMs,
      totalCrawlMs,
      finalizeReserveMs,
      warning: s(entry?.error || `http_${safeNum(entry?.status, 403)}`),
    });
  }

  if (!entry?.ok || !entry?.page?.html) {
    throw new Error(entry?.error || "website fetch failed");
  }

  const mainFetch = entry.page;

  let mainPage = null;
  try {
    mainPage = analyzePage({
      html: mainFetch.html,
      pageUrl: mainFetch.url,
    });
  } catch (err) {
    throw new Error(`main_page_analyze_failed: ${err?.message || "unknown error"}`);
  }

  let robotsFile = null;
  let robots = null;

  const robotsBudget = remainingBudget(
    crawlDeadlineAt,
    robotsFetchMs,
    minStepBudgetMs
  );

  if (robotsBudget > 0) {
    try {
      robotsFile = await withTimeout(
        () => fetchRobotsFile(mainFetch.url),
        robotsBudget,
        "robots_fetch"
      );
      robots = robotsFile?.parsed || null;
      if (s(robotsFile?.error).startsWith("unsafe_")) {
        discoveryWarnings.push(`robots_${s(robotsFile.error)}`);
      }
    } catch (err) {
      discoveryWarnings.push(
        err?.isTimeout ? "robots_fetch_timeout" : "robots_fetch_failed"
      );
    }
  }

  const fetchedPageRecords = [
    {
      page: mainPage,
      source: "entry",
      depth: 1,
    },
  ];

  const failed = [];
  const skipped = [];
  const seen = new Set([canonicalPageKey(mainPage.canonicalUrl || mainPage.url)]);

  let pending = trimQueuedCandidates(
    [
      ...buildPriorityPathSeeds(mainPage.url),
      ...collectNextPageCandidates(mainPage.anchorRecords, mainPage.url, 1),
    ],
    seen,
    maxCandidatesQueued
  );

  const preSitemapTargetTotalPages = Math.min(
    maxFetchPages,
    Math.max(3, Math.min(maxPagesAllowed, 4))
  );

  pending = await crawlPendingQueue({
    pending,
    fetchedPageRecords,
    failed,
    skipped,
    seen,
    mainPageUrl: mainPage.url,
    robots,
    crawlDeadlineAt,
    pageFetchMs,
    minStepBudgetMs,
    maxFetchPages,
    maxCandidatesQueued,
    stopAtTotalPages: preSitemapTargetTotalPages,
  });

  let sitemap = null;
  const shouldTrySitemap =
    fetchedPageRecords.length < maxPagesAllowed &&
    remainingBudget(crawlDeadlineAt, sitemapFetchMs, minStepBudgetMs) > 0;

  if (shouldTrySitemap) {
    const sitemapBudget = remainingBudget(
      crawlDeadlineAt,
      sitemapFetchMs,
      minStepBudgetMs
    );

    try {
      sitemap = await withTimeout(
        () => fetchSitemapCandidates(mainFetch.url, robots),
        sitemapBudget,
        "sitemap_fetch"
      );
      if (s(sitemap?.error).startsWith("unsafe_")) {
        discoveryWarnings.push(`sitemap_${s(sitemap.error)}`);
      }
    } catch (err) {
      discoveryWarnings.push(
        err?.isTimeout ? "sitemap_fetch_timeout" : "sitemap_fetch_failed"
      );
    }
  }

  if (sitemap?.found) {
    pending = trimQueuedCandidates(
      [...pending, ...safeArray(sitemap?.candidates)],
      seen,
      maxCandidatesQueued
    );
  }

  pending = await crawlPendingQueue({
    pending,
    fetchedPageRecords,
    failed,
    skipped,
    seen,
    mainPageUrl: mainPage.url,
    robots,
    crawlDeadlineAt,
    pageFetchMs,
    minStepBudgetMs,
    maxFetchPages,
    maxCandidatesQueued,
    stopAtTotalPages: 0,
  });

  const admissions = finalizePageAdmissions({
    fetchedPageRecords,
    maxPagesAllowed,
  });

  const allPages = uniqBy(
    safeArray(admissions?.keptPages),
    (x) => canonicalPageKey(x.canonicalUrl || x.url)
  );

  const rollup = buildSiteRollup(
    mainPage,
    allPages,
    safeArray(admissions?.admissionWarnings)
  );

  const usefulCoverage =
    allPages.length >= 2 ||
    countUsefulPages(allPages) >= 2 ||
    safeArray(allPages).some((x) => isBusinessCriticalPageType(x?.pageType));

  const crawlWarnings = uniq([
    ...discoveryWarnings.filter((warning) => {
      if (warning === "sitemap_fetch_timeout" && usefulCoverage) return false;
      if (warning === "sitemap_fetch_failed" && usefulCoverage) return false;
      return true;
    }),
    ...(robots?.disallowAll ? ["robots_disallow_all_detected"] : []),
    ...(safeArray(entry?.attempts).length > 1 ? ["entry_fetch_required_fallback"] : []),
    ...(!sitemap?.found && !usefulCoverage ? ["sitemap_not_found_or_unreadable"] : []),
    ...(allPages.length < 2 ? ["partial_website_extraction"] : []),
    ...(safeArray(admissions?.rejectedPages).length
      ? ["some_pages_rejected_as_weak_or_placeholder"]
      : []),
  ]);

  return {
    kind: "website_raw_v7_6_modular",
    sourceUrl,
    finalUrl: mainPage.url,
    crawl: {
      fetchedAt: new Date().toISOString(),
      startedAt: crawlStartedAt,
      deadlineMs: totalCrawlMs,
      crawlBudgetMs: Math.max(0, totalCrawlMs - finalizeReserveMs),
      finalizeReserveMs,
      elapsedMs: Date.now() - startedAtMs,
      entryAttempts: safeArray(entry?.attempts),
      pagesRequested: fetchedPageRecords.length + failed.length + skipped.length + pending.length,
      pagesSucceeded: fetchedPageRecords.length,
      pagesKept: allPages.length,
      pagesRejected: safeArray(admissions?.rejectedPages).length,
      pagesFailed: failed.length,
      pagesSkipped: skipped.length,
      pagesPendingLeft: pending.length,
      maxPagesAllowed,
      maxCandidatesQueued,
      maxFetchPages,
      mainHtmlBytes: safeByteLength(mainFetch.html),
      failures: failed.slice(0, 20),
      skipped: skipped.slice(0, 20),
      rejected: safeArray(admissions?.rejectedPages).slice(0, 30),
      warnings: crawlWarnings,
    },
    discovery: {
      robots: {
        found: !!robotsFile?.found,
        url: s(robotsFile?.url),
        disallowAll: !!robots?.disallowAll,
        allowCount: safeArray(robots?.allow).length,
        disallowCount: safeArray(robots?.disallow).length,
        sitemapsDeclared: safeArray(robots?.sitemaps).slice(0, 10),
      },
      sitemap: {
        found: !!sitemap?.found,
        files: safeArray(sitemap?.sitemaps).slice(0, 10),
        candidateCount: safeArray(sitemap?.candidates).length,
      },
    },
    site: rollup,
    pages: allPages,
    pageAdmissions: safeArray(admissions?.pageAdmissions),
    siteText: allPages
      .map((x) => s(x?.text))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 18000),
  };
}

export function buildWebsiteKnowledgeCandidates() {
  throw new Error(
    "buildWebsiteKnowledgeCandidates was moved out of websiteExtractor.js. Use sourceSync/orchestrator.js synthesis layer."
  );
}
