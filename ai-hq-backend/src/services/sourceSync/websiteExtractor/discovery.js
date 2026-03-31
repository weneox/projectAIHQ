import { arr, compactText, n, s, uniq, uniqBy } from "./shared.js";
import { decodeHtmlEntities, isLikelyHtmlDocument } from "./text.js";
import {
  canonicalPageKey,
  isBlockedCrawlPath,
  sameSiteUrl,
  sanitizeUrlForCrawl,
  shouldFetchPage,
  normalizePathname,
} from "./url.js";
import { fetchTextDocument } from "./fetch.js";

export function scoreAnchorIntent(url = "", text = "", title = "", sourceUrl = "", depth = 1) {
  if (!shouldFetchPage(url, sourceUrl)) return -999;

  let score = 0;
  const joined = `${String(url || "").toLowerCase()} | ${String(text || "").toLowerCase()} | ${String(title || "").toLowerCase()}`;

  if (String(sanitizeUrlForCrawl(url)).toLowerCase() === String(sanitizeUrlForCrawl(sourceUrl)).toLowerCase()) {
    score += 120;
  }

  if (/(about|haqqimizda|haqqımızda|about-us|company|our-story)/i.test(joined)) score += 48;
  if (/(services|xidmet|xidmət|service|solutions|offers)/i.test(joined)) score += 46;
  if (/(contact|əlaqə|elaqe|contacts|reach-us|get-in-touch)/i.test(joined)) score += 44;
  if (/(pricing|price|tarif|qiymet|qiymət|packages|plans)/i.test(joined)) score += 38;
  if (/(faq|questions|help|support)/i.test(joined)) score += 32;
  if (/(book|booking|schedule|appointment|reserve|demo|consultation)/i.test(joined)) score += 28;
  if (/(location|branch|office|find-us|visit-us)/i.test(joined)) score += 24;
  if (/(team|founder|leadership)/i.test(joined)) score += 20;
  if (/(testimonials|reviews|case-studies|portfolio|work|projects)/i.test(joined)) score += 16;
  if (/(products|product|menu|treatments|solutions|industries|expertise|book-online)/i.test(joined)) {
    score += 18;
  }
  if (/(policy|privacy|refund|return|terms|conditions)/i.test(joined)) score += 8;

  if (/(blog|news|article|post|author|tag|category|press|events)/i.test(joined)) score -= 20;
  if (/(career|careers|jobs|vacancies)/i.test(joined)) score -= 18;
  if (/(login|signin|sign-in|signup|register|account|cart|checkout)/i.test(joined)) score -= 30;
  if (/(privacy|cookie|legal|terms|refund|return|shipping|track-order)/i.test(joined)) score -= 16;
  if (isBlockedCrawlPath(url)) score -= 50;

  try {
    const pathname = normalizePathname(new URL(url).pathname);
    const depthScore = pathname.split("/").filter(Boolean).length;
    if (depthScore <= 1) score += 12;
    if (depthScore === 2) score += 4;
    if (depthScore >= 4) score -= 10;
  } catch {
    // noop
  }

  if (!s(text) && !s(title)) score -= 4;
  score -= Math.max(0, depth - 1) * 7;

  return score;
}

export function collectNextPageCandidates(anchorRecords = [], sourceUrl = "", depth = 1) {
  const ranked = arr(anchorRecords)
    .map((item) => ({
      url: s(item?.url),
      text: s(item?.text),
      title: s(item?.title),
      score: scoreAnchorIntent(item?.url, item?.text, item?.title, sourceUrl, depth),
      depth,
      source: "anchors",
    }))
    .filter((x) => x.url && x.score >= 8);

  return uniqBy(
    ranked.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)),
    (x) => canonicalPageKey(x.url)
  ).slice(0, 36);
}

export function buildPriorityPathSeeds(baseUrl = "") {
  try {
    const u = new URL(baseUrl);
    const root = `${u.protocol}//${u.host}`;
    const seeds = [
      "/about",
      "/about-us",
      "/company",
      "/services",
      "/service",
      "/products",
      "/product",
      "/menu",
      "/solutions",
      "/offers",
      "/pricing-and-packages",
      "/contact",
      "/contact-us",
      "/reach-us",
      "/pricing",
      "/plans",
      "/packages",
      "/faq",
      "/help",
      "/locations",
      "/branches",
      "/find-us",
      "/book",
      "/booking",
      "/schedule",
      "/appointment",
      "/consultation",
      "/team",
      "/our-team",
    ];

    return seeds.map((path) => ({
      url: sanitizeUrlForCrawl(`${root}${path}`),
      text: path.replace(/^\//, ""),
      title: path.replace(/^\//, ""),
      score: scoreAnchorIntent(`${root}${path}`, path, path, baseUrl, 2) + 6,
      depth: 2,
      source: "path_seed",
    }));
  } catch {
    return [];
  }
}

function parseRobotsTxt(text = "") {
  const sitemapUrls = [];
  const allow = [];
  const disallow = [];

  let inStarBlock = false;

  for (const rawLine of s(text).split(/\r?\n/)) {
    const line = s(rawLine).replace(/\s+#.*$/, "");
    if (!line) continue;

    const sitemapMatch = line.match(/^sitemap:\s*(.+)$/i);
    if (sitemapMatch?.[1]) {
      sitemapUrls.push(sanitizeUrlForCrawl(sitemapMatch[1]));
      continue;
    }

    const uaMatch = line.match(/^user-agent:\s*(.+)$/i);
    if (uaMatch?.[1]) {
      inStarBlock = String(uaMatch[1] || "").toLowerCase().trim() === "*";
      continue;
    }

    if (!inStarBlock) continue;

    const allowMatch = line.match(/^allow:\s*(.*)$/i);
    if (allowMatch) {
      const value = s(allowMatch[1]);
      if (value) allow.push(value.startsWith("/") ? value : `/${value}`);
      continue;
    }

    const disallowMatch = line.match(/^disallow:\s*(.*)$/i);
    if (disallowMatch) {
      const value = s(disallowMatch[1]);
      if (value) disallow.push(value.startsWith("/") ? value : `/${value}`);
      continue;
    }
  }

  const disallowAll = disallow.includes("/") && !allow.includes("/");

  return {
    allow: uniq(allow),
    disallow: uniq(disallow),
    sitemaps: uniq(sitemapUrls),
    disallowAll,
  };
}

function robotsMatchLength(path = "", rules = []) {
  let longest = -1;

  for (const rule of arr(rules)) {
    const r = s(rule);
    if (!r) continue;

    if (r === "/" && path.startsWith("/")) {
      longest = Math.max(longest, 1);
      continue;
    }

    const cleanRule = r.replace(/\*+$/g, "");
    if (!cleanRule) continue;

    if (path.startsWith(cleanRule)) {
      longest = Math.max(longest, cleanRule.length);
    }
  }

  return longest;
}

export function isRobotsAllowed(url = "", robots = null) {
  if (!robots) return true;

  try {
    const u = new URL(url);
    const path = `${u.pathname || "/"}${u.search || ""}`;

    const allowLen = robotsMatchLength(path, robots.allow);
    const disallowLen = robotsMatchLength(path, robots.disallow);

    if (allowLen < 0 && disallowLen < 0) return true;
    if (allowLen >= disallowLen) return true;
    return false;
  } catch {
    return true;
  }
}

export async function fetchRobotsFile(baseUrl = "") {
  try {
    const u = new URL(baseUrl);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;

    const fetched = await fetchTextDocument(robotsUrl, {
      timeoutMs: Math.min(n(undefined, 15000), 12000),
      maxBytes: 250000,
      headers: {
        accept: "text/plain,text/*;q=0.9,*/*;q=0.5",
      },
    });

    if (!fetched.ok || !fetched.text) {
      return {
        found: false,
        url: robotsUrl,
        text: "",
        parsed: null,
        error: s(fetched?.error || ""),
      };
    }

    return {
      found: true,
      url: robotsUrl,
      text: fetched.text,
      parsed: parseRobotsTxt(fetched.text),
      error: "",
    };
  } catch {
    return {
      found: false,
      url: "",
      text: "",
      parsed: null,
      error: "robots_fetch_failed",
    };
  }
}

function parseSitemapXml(xml = "") {
  const urls = [];

  for (const m of s(xml).matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
    const raw = compactText(decodeHtmlEntities(m[1]), 2000);
    if (!raw) continue;
    urls.push(sanitizeUrlForCrawl(raw));
  }

  return uniq(urls);
}

function isLikelySitemapIndex(xml = "") {
  return /<sitemapindex\b/i.test(s(xml));
}

function rankSitemapCandidates(urls = [], sourceUrl = "") {
  return uniqBy(
    arr(urls)
      .map((url) => {
        const cleanUrl = sanitizeUrlForCrawl(url);
        let score = scoreAnchorIntent(cleanUrl, "", "", sourceUrl, 2);

        const joined = String(cleanUrl || "").toLowerCase();
        if (/(about|company|haqqimizda|haqqımızda)/i.test(joined)) score += 12;
        if (/(services|service|xidmet|xidmət)/i.test(joined)) score += 12;
        if (/(contact|elaqe|əlaqə)/i.test(joined)) score += 12;
        if (/(pricing|price|qiymet|qiymət|tarif)/i.test(joined)) score += 10;
        if (/(faq|questions|help)/i.test(joined)) score += 8;
        if (/(policy|privacy|terms|refund|return)/i.test(joined)) score += 5;
        if (/(blog|news|article|post|tag|category)/i.test(joined)) score -= 10;

        return {
          url: cleanUrl,
          text: "",
          title: "",
          score,
          depth: 2,
          source: "sitemap",
        };
      })
      .filter((x) => x.url && x.score >= 8 && shouldFetchPage(x.url, sourceUrl))
      .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)),
    (x) => canonicalPageKey(x.url)
  );
}

export async function fetchSitemapCandidates(baseUrl = "", robots = null) {
  const maxSitemapFiles = Math.max(2, Math.min(10, n(undefined, 6)));
  const maxSitemapUrls = Math.max(50, Math.min(800, n(undefined, 250)));

  try {
    const u = new URL(baseUrl);
    const defaults = [
      `${u.protocol}//${u.host}/sitemap.xml`,
      `${u.protocol}//${u.host}/sitemap_index.xml`,
    ];

    const initialQueue = uniq([...arr(robots?.sitemaps).filter(Boolean), ...defaults]).slice(
      0,
      maxSitemapFiles
    );

    const queue = [...initialQueue];
    const seenSitemaps = new Set();
    const sitemapSummaries = [];
    const allUrls = [];

    while (
      queue.length > 0 &&
      seenSitemaps.size < maxSitemapFiles &&
      allUrls.length < maxSitemapUrls
    ) {
      const sitemapUrl = s(queue.shift());
      if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
      seenSitemaps.add(sitemapUrl);

      const fetched = await fetchTextDocument(sitemapUrl, {
        timeoutMs: 12000,
        maxBytes: 750000,
        headers: {
          accept: "application/xml,text/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        },
      });

      if (!fetched.ok || !fetched.text) {
        sitemapSummaries.push({
          url: sitemapUrl,
          ok: false,
          status: fetched?.status || 0,
          discoveredUrlCount: 0,
          kind: "unknown",
          error: s(fetched?.error || "sitemap_fetch_failed"),
        });
        continue;
      }

      if (!isLikelyHtmlDocument(fetched.text) || /<urlset\b|<sitemapindex\b/i.test(fetched.text)) {
        const parsedUrls = parseSitemapXml(fetched.text);
        const kind = isLikelySitemapIndex(fetched.text) ? "index" : "urlset";

        if (kind === "index") {
          for (const childUrl of parsedUrls) {
            if (queue.length + seenSitemaps.size >= maxSitemapFiles) break;
            if (!sameSiteUrl(childUrl, baseUrl)) continue;
            queue.push(childUrl);
          }
        } else {
          allUrls.push(...parsedUrls.filter((x) => sameSiteUrl(x, baseUrl)));
        }

        sitemapSummaries.push({
          url: sitemapUrl,
          ok: true,
          status: fetched.status || 200,
          discoveredUrlCount: parsedUrls.length,
          kind,
          error: "",
        });
      }
    }

    return {
      found: sitemapSummaries.some((x) => x.ok),
      sitemaps: sitemapSummaries,
      candidates: rankSitemapCandidates(uniq(allUrls).slice(0, maxSitemapUrls), baseUrl),
      error: s(sitemapSummaries.find((item) => s(item?.error).startsWith("unsafe_"))?.error),
    };
  } catch {
    return {
      found: false,
      sitemaps: [],
      candidates: [],
      error: "sitemap_fetch_failed",
    };
  }
}
