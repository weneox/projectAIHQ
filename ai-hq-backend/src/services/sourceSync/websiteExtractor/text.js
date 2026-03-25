import { compactText, lower, s, uniq } from "./shared.js";

const NAV_CLUSTER_WORDS = new Set([
  "home",
  "about",
  "about us",
  "services",
  "service",
  "portfolio",
  "team",
  "reviews",
  "review",
  "blog",
  "contact",
  "menu",
  "main menu",
  "skip",
  "skip to main content",
  "skip to content",
  "read more",
  "learn more",
  "details",
  "more",
  "search",
  "close",
  "open",
  "login",
  "sign in",
  "register",
  "haqqımızda",
  "haqqimizda",
  "xidmət",
  "xidmətlər",
  "xidmet",
  "xidmetler",
  "komanda",
  "rəylər",
  "reyler",
  "bloq",
  "əlaqə",
  "elaqe",
  "menyu",
  "главная",
  "услуги",
  "контакты",
  "команда",
  "отзывы",
  "блог",
  "меню",
]);

export function decodeHtmlEntities(text = "") {
  return s(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, `"`)
    .replace(/&#39;/gi, `'`)
    .replace(/&apos;/gi, `'`)
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, code) => {
      const x = Number(code);
      return Number.isFinite(x) ? String.fromCharCode(x) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const x = Number.parseInt(hex, 16);
      return Number.isFinite(x) ? String.fromCharCode(x) : _;
    });
}

export function cleanInlineText(text = "") {
  return decodeHtmlEntities(s(text))
    .replace(/\s+/g, " ")
    .replace(/[•·▪▫●◦]/g, " ")
    .trim();
}

export function stripHtmlToText(html = "") {
  return decodeHtmlEntities(
    s(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ")
      .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(
        /<\/(p|div|section|article|header|footer|main|aside|li|ul|ol|h1|h2|h3|h4|h5|h6|br|tr|table)>/gi,
        "\n"
      )
      .replace(/<(td|th)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

export function isLikelyHtmlDocument(html = "") {
  const x = lower(html.slice(0, 3000));
  return (
    x.includes("<html") ||
    x.includes("<body") ||
    x.includes("<head") ||
    x.includes("<title") ||
    x.includes("<main") ||
    x.includes("<meta") ||
    x.includes("<!doctype html")
  );
}

export function normalizeListItem(x = "") {
  return compactText(
    cleanInlineText(x)
      .replace(/^[-–—•*]+\s*/, "")
      .replace(/^[\d]+[.)-]?\s*/, ""),
    220
  );
}

export function isWeakListItem(x = "") {
  const t = lower(x);
  if (!t) return true;
  if (t.length < 3) return true;

  if (
    /^(home|about|services|contact|blog|pricing|faq|read more|learn more|more|details|view more|menu|back)$/i.test(
      t
    )
  ) {
    return true;
  }

  return false;
}

export function normalizeComparableText(text = "", max = 320) {
  return lower(
    compactText(cleanInlineText(text), max)
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function navWordHits(text = "") {
  const value = normalizeComparableText(text, 420);
  if (!value) return 0;

  let hits = 0;
  for (const token of NAV_CLUSTER_WORDS) {
    if (token && value.includes(lower(token))) hits += 1;
  }

  return hits;
}

export function looksLikeNavCluster(text = "") {
  const value = normalizeComparableText(text, 420);
  if (!value) return false;

  const hits = navWordHits(value);
  const words = value.split(" ").filter(Boolean).length;

  if (hits >= 5) return true;
  if (hits >= 4 && words <= 16) return true;
  if (
    /^(home|about|services|portfolio|team|reviews|blog|contact|menu|главная|услуги|контакты|меню|haqqımızda|haqqimizda|xidmətlər|xidmetler|komanda|rəylər|reyler|bloq|əlaqə|elaqe|menyu)\b/i.test(
      value
    ) &&
    hits >= 3
  ) {
    return true;
  }

  return false;
}

export function stripBoilerplatePrefixes(text = "") {
  let value = cleanInlineText(text);

  value = value.replace(/^skip to main content[:\s-]*/i, "");
  value = value.replace(/^skip to content[:\s-]*/i, "");
  value = value.replace(/^main content[:\s-]*/i, "");

  value = value.replace(
    /^[🎉✨🔥⭐\s]*(announcement|объявление|special offer|special discount|promo|акция|campaign|kampaniya|endirim)[^—–-]{0,240}(?:—|–|-)\s*/iu,
    ""
  );

  value = value.replace(
    /^(cookies?|cookie settings|cookie preferences|accept all|reject all|manage preferences)[^—–-]{0,240}(?:—|–|-)\s*/iu,
    ""
  );

  return cleanInlineText(value);
}

export function isUiNoiseLine(text = "") {
  const raw = cleanInlineText(text);
  const value = stripBoilerplatePrefixes(raw);
  const normalized = normalizeComparableText(value, 360);
  const words = normalized.split(" ").filter(Boolean).length;

  if (!normalized) return true;
  if (looksLikeNavCluster(normalized)) return true;

  if (/^skip to main content\b/i.test(raw)) return true;

  if (
    /^(menu|open menu|close menu|toggle navigation|search|search here|search this site)$/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /^(read more|learn more|details|подробнее|more|view more|discover more)$/i.test(value)
  ) {
    return true;
  }

  if (
    /^(facebook|instagram|linkedin|youtube|tiktok|telegram|whatsapp|x|az|en|ru|tr)$/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /(cookie|cookies|privacy preferences|manage preferences|accept all|reject all)/i.test(value) &&
    words <= 18
  ) {
    return true;
  }

  if (
    /(announcement|объявление|special offer|special discount|promo|акция|campaign|kampaniya|endirim)/i.test(
      value
    ) &&
    /(details|подробнее|learn more|read more|ətraflı|etrafli)/i.test(value)
  ) {
    return true;
  }

  if (words <= 2 && /(home|about|services|contact|blog|pricing|faq|menu)/i.test(value)) {
    return true;
  }

  return false;
}

export function sanitizeNarrativeText(text = "", { max = 900, min = 0 } = {}) {
  let value = stripBoilerplatePrefixes(cleanInlineText(text));
  if (!value) return "";
  if (isUiNoiseLine(value)) return "";
  if (looksLikeNavCluster(value)) return "";

  if (
    /^(book now|call now|get started|start now|contact us|request quote|подробнее|learn more|read more)$/i.test(
      value
    )
  ) {
    return "";
  }

  value = value.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  if (!value) return "";

  value = compactText(value, max);
  if (min > 0 && value.length < min) return "";

  return value;
}

export function meaningfulLines(text = "", maxItems = 180) {
  const out = [];
  const seen = new Set();

  for (const raw of s(text).split(/\n+/)) {
    const value = sanitizeNarrativeText(raw, { max: 320, min: 2 });
    if (!value) continue;

    const key = normalizeComparableText(value, 320);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= maxItems) break;
  }

  return out;
}

export function extractTextWindowByKeywords(
  text = "",
  keywords = [],
  { linesAfter = 4, max = 1600 } = {}
) {
  const list = meaningfulLines(text, 220);
  const terms = keywords.map((x) => lower(s(x))).filter(Boolean);

  if (!list.length || !terms.length) return "";

  for (let i = 0; i < list.length; i += 1) {
    const current = lower(list[i]);
    if (!terms.some((term) => current.includes(term))) continue;

    const window = [list[i]];
    for (let j = i + 1; j < list.length && window.length < linesAfter + 1; j += 1) {
      const next = list[j];
      if (!next || isUiNoiseLine(next) || looksLikeNavCluster(next)) continue;
      window.push(next);
    }

    const merged = compactText(window.join(" "), max);
    if (merged && merged.length >= 30) return merged;
  }

  return "";
}

export function paragraphScore(text = "") {
  const value = s(text);
  if (!value) return -999;

  let score = 0;
  if (value.length >= 70) score += 4;
  if (value.length >= 120) score += 3;

  if (
    /\b(we|our|company|agency|team|service|services|solution|solutions|customer|client|business|website|seo|design|development|consulting|azerbaijan|baku|azərbaycan|baki)\b/i.test(
      value
    )
  ) {
    score += 4;
  }

  if (/[?]/.test(value)) score -= 4;
  if (/(price|pricing|qiymət|qiymet|faq|policy|cookie)/i.test(value)) score -= 2;
  if (looksLikeNavCluster(value) || isUiNoiseLine(value)) score -= 10;

  return score;
}

export function pickStrongParagraphs(paragraphs = [], maxItems = 2) {
  return paragraphs
    .map((text) => ({ text, score: paragraphScore(text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, maxItems)
    .map((item) => item.text);
}

export function sanitizeServiceHint(text = "") {
  const value = sanitizeNarrativeText(normalizeListItem(text), { max: 180, min: 3 });
  if (!value) return "";
  if (/[?]/.test(value)) return "";
  if (isWeakListItem(value)) return "";
  return value;
}

export function sanitizePricingHint(text = "") {
  const value = sanitizeNarrativeText(text, { max: 220, min: 6 });
  if (!value) return "";

  if (
    !/(\$|€|£|₼|\bazn\b|\busd\b|\beur\b|\bfrom\b|\bstarting\b|\bprice\b|\bpricing\b|\bpackage\b|\bplan\b|\bpaket\b|\bqiymət\b|\bqiymet\b)/i.test(
      value
    )
  ) {
    return "";
  }

  if (
    /(privacy|policy|cookie|cookies|terms|conditions|working hours|iş saat|business hours)/i.test(
      value
    )
  ) {
    return "";
  }

  return value;
}

export function normalizeComparableSnippet(text = "", max = 220) {
  return lower(
    compactText(cleanInlineText(text), max)
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function parseTitleNameCandidates(title = "") {
  const raw = sanitizeNarrativeText(cleanInlineText(title), { max: 180, min: 0 });
  if (!raw) return [];

  const parts = raw
    .split(/\s+[|–—-]\s+/)
    .map((x) => compactText(x, 120))
    .filter(Boolean)
    .filter((x) => !isUiNoiseLine(x))
    .filter(
      (x) =>
        !/^(home|welcome|contact|about|services|pricing|faq|blog|privacy policy|terms)$/i.test(
          x
        )
    );

  return uniq(parts).slice(0, 4);
}