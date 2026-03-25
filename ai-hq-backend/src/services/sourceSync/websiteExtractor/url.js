import { lower, s, uniq, normalizeUrl } from "./shared.js";

export function normalizePathname(pathname = "") {
  const x = s(pathname).trim();
  if (!x) return "/";
  return x.replace(/\/+$/, "") || "/";
}

export function normalizeHost(host = "") {
  return lower(s(host).replace(/^www\./i, ""));
}

export function escapeRegExp(value = "") {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeUrlForCrawl(url = "") {
  try {
    const u = new URL(normalizeUrl(url));
    u.hash = "";

    const dropParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "fbclid",
      "gclid",
      "gbraid",
      "wbraid",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
      "source",
      "share",
      "igshid",
      "mibextid",
      "trk",
      "tracking",
      "_hsenc",
      "_hsmi",
      "yclid",
      "gad_source",
      "srsltid",
    ]);

    for (const key of [...u.searchParams.keys()]) {
      const lk = lower(key);
      if (
        dropParams.has(lk) ||
        lk.startsWith("utm_") ||
        lk.startsWith("ga_") ||
        lk.startsWith("pk_")
      ) {
        u.searchParams.delete(key);
      }
    }

    const qs = u.searchParams.toString();
    u.search = qs ? `?${qs}` : "";
    return u.toString();
  } catch {
    return s(url);
  }
}

export function canonicalPageKey(url = "") {
  try {
    const u = new URL(sanitizeUrlForCrawl(url));
    const host = normalizeHost(u.host);
    const path = normalizePathname(u.pathname);
    const search = s(u.search);
    return `${host}|${path}|${search}`;
  } catch {
    return lower(s(url));
  }
}

export function sameSiteUrl(url = "", sourceUrl = "") {
  try {
    const a = new URL(normalizeUrl(url));
    const b = new URL(normalizeUrl(sourceUrl));
    return normalizeHost(a.host) === normalizeHost(b.host);
  } catch {
    return false;
  }
}

export function isBlockedCrawlPath(url = "") {
  const x = lower(url);
  return (
    /(\/(wp-admin|wp-login|login|signin|sign-in|signup|sign-up|register|account|cart|checkout|feed|preview|cdn-cgi|wp-json|search|tag|author)(\/|$|\?))/i.test(
      x
    ) ||
    /[?&](replytocom|share|output|print|download|sort|filter|utm_|fbclid|gclid|s|q)=/i.test(
      x
    )
  );
}

export function shouldFetchPage(url = "", sourceUrl = "") {
  try {
    const a = new URL(normalizeUrl(url));
    if (!sameSiteUrl(url, sourceUrl)) return false;
    if (!/^https?:$/i.test(a.protocol)) return false;

    if (
      /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|7z|mp4|mp3|avi|mov|webm|doc|docx|xls|xlsx|ppt|pptx|xml|json|txt|rss)$/i.test(
        a.pathname
      )
    ) {
      return false;
    }

    if (isBlockedCrawlPath(url)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildInitialFetchCandidates(inputUrl = "") {
  let normalized = "";
  try {
    normalized = sanitizeUrlForCrawl(normalizeUrl(inputUrl));
  } catch {
    normalized = sanitizeUrlForCrawl(inputUrl);
  }

  if (!normalized) return [];

  try {
    const u = new URL(normalized);
    const host = s(u.host);
    const bareHost = host.replace(/^www\./i, "");
    const wwwHost = /^www\./i.test(host) ? host : `www.${bareHost}`;
    const bare = /^www\./i.test(host) ? bareHost : host;
    const path = s(u.pathname || "/");
    const search = s(u.search || "");
    const rootPath = "/";

    const variants = [
      `${u.protocol}//${host}${path}${search}`,
      `https://${host}${path}${search}`,
      `https://${bare}${path}${search}`,
      `https://${wwwHost}${path}${search}`,
      `http://${host}${path}${search}`,
      `http://${bare}${path}${search}`,
      `http://${wwwHost}${path}${search}`,
    ];

    if (normalizePathname(path) !== "/") {
      variants.push(
        `https://${host}${rootPath}`,
        `https://${bare}${rootPath}`,
        `https://${wwwHost}${rootPath}`,
        `http://${host}${rootPath}`,
        `http://${bare}${rootPath}`,
        `http://${wwwHost}${rootPath}`
      );
    }

    return uniq(variants.map((x) => sanitizeUrlForCrawl(x))).filter(Boolean);
  } catch {
    return uniq([normalized]).filter(Boolean);
  }
}