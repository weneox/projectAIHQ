import { s, uniq } from "./shared.js";
import {
  cleanInlineText,
  sanitizeNarrativeText,
  sanitizeServiceHint,
  sanitizePricingHint,
  stripHtmlToText,
  isWeakListItem,
} from "./text.js";
import { escapeRegExp, sanitizeUrlForCrawl } from "./url.js";

export function extractTitle(html = "") {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return sanitizeNarrativeText(stripHtmlToText(m?.[1] || ""), { max: 180, min: 0 });
}

export function extractMetaContent(html = "", name = "") {
  const safeName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${safeName}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${safeName}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${safeName}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${safeName}["'][^>]*>`, "i"),
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      return sanitizeNarrativeText(stripHtmlToText(m[1]), { max: 400, min: 0 });
    }
  }

  return "";
}

export function extractCanonicalUrl(html = "", pageUrl = "") {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const href = s(m?.[1]);
  if (!href) return "";

  try {
    return sanitizeUrlForCrawl(new URL(href, pageUrl).toString());
  } catch {
    return "";
  }
}

export function extractHeadings(html = "") {
  const matches = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  return uniq(
    matches
      .map((m) => sanitizeNarrativeText(stripHtmlToText(m[2]), { max: 180, min: 2 }))
      .filter(Boolean)
  ).slice(0, 36);
}

export function extractParagraphs(html = "", limit = 28) {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  return uniq(
    matches
      .map((m) => sanitizeNarrativeText(stripHtmlToText(m[1]), { max: 900, min: 40 }))
      .filter(Boolean)
  ).slice(0, limit);
}

export function extractLists(html = "", itemLimit = 48) {
  const items = [];

  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const item = sanitizeServiceHint(stripHtmlToText(m[1]));
    if (!isWeakListItem(item)) items.push(item);
  }

  return uniq(items).slice(0, itemLimit);
}

export function extractLinks(html = "", baseUrl = "") {
  const out = [];

  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = s(m[1]);
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (/^javascript:/i.test(href)) continue;

    try {
      const abs = /^(mailto|tel):/i.test(href)
        ? href
        : sanitizeUrlForCrawl(new URL(href, baseUrl).toString());

      if (/^(https?:|mailto:|tel:)/i.test(abs)) out.push(abs);
    } catch {
      continue;
    }
  }

  return uniq(out);
}

export function extractAnchorRecords(html = "", baseUrl = "") {
  const out = [];

  for (const m of html.matchAll(/<a\b([^>]*)href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const attrs = s(m[1]);
    const hrefRaw = s(m[2]);
    const textRaw = sanitizeNarrativeText(stripHtmlToText(m[3]), { max: 180, min: 0 });
    const titleAttr = sanitizeNarrativeText(
      cleanInlineText(attrs.match(/\btitle=["']([^"']+)["']/i)?.[1] || ""),
      { max: 180, min: 0 }
    );
    const relAttr = String(attrs.match(/\brel=["']([^"']+)["']/i)?.[1] || "").toLowerCase().trim();

    if (!hrefRaw) continue;
    if (hrefRaw.startsWith("#")) continue;
    if (/^javascript:/i.test(hrefRaw)) continue;

    let url = hrefRaw;
    try {
      url = /^(mailto|tel):/i.test(hrefRaw)
        ? hrefRaw
        : sanitizeUrlForCrawl(new URL(hrefRaw, baseUrl).toString());
    } catch {
      url = hrefRaw;
    }

    out.push({
      url,
      text: textRaw,
      title: titleAttr,
      rel: relAttr,
    });
  }

  return out;
}