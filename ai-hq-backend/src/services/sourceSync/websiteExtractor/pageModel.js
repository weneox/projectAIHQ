import { arr, compactText, n, s, uniq, lower } from "./shared.js";
import {
  extractAnchorRecords,
  extractCanonicalUrl,
  extractHeadings,
  extractLinks,
  extractLists,
  extractMetaContent,
  extractParagraphs,
  extractTitle,
} from "./html.js";
import {
  extractAddresses,
  extractBookingLinks,
  extractEmails,
  extractEmailsFromAnchors,
  extractHours,
  extractPhones,
  extractPhonesFromAnchors,
  extractPrimaryCta,
  extractSocialLinks,
  extractWhatsappLinks,
  looksLikeAddressLine,
  looksLikeOperationalHoursLine,
  normalizePhone,
  normalizeVisibleText,
  sanitizePricingCandidate,
  sanitizeServiceCandidate,
} from "./signals.js";
import {
  extractTextWindowByKeywords,
  looksLikeNavCluster,
  meaningfulLines,
  normalizeComparableSnippet,
  pickStrongParagraphs,
  stripHtmlToText,
} from "./text.js";
import {
  extractFaqItems,
  extractJsonLdBlocks,
  extractStructuredBusinessSignals,
} from "./structured.js";

function decodeMeta(value = "", max = 0) {
  const x = normalizeVisibleText(value, max || 0);
  return max > 0 ? compactText(x, max) : x;
}

function cleanCollection(values = [], maxItemLen = 280, limit = 999) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, maxItemLen))
      .filter(Boolean)
  ).slice(0, limit);
}

function looksLikeThinOperationalSnippet(value = "") {
  const x = decodeMeta(value, 320);
  if (!x) return true;
  if (looksLikeOperationalHoursLine(x)) return true;
  if (looksLikeAddressLine(x) && x.split(/\s+/).length <= 14) return true;
  if (/\b(cookie|privacy|policy|terms|conditions|login|sign in|register|newsletter)\b/i.test(x)) {
    return true;
  }
  if (/^(home|about|services|contact|faq|blog|news)$/i.test(x)) return true;
  return false;
}

function looksLikeBadSummary(value = "") {
  const x = decodeMeta(value, 1000);
  if (!x) return true;
  if (x.length < 40) return true;
  if (looksLikeThinOperationalSnippet(x)) return true;
  if (looksLikeNavCluster(x)) return true;
  if (/(cookie|privacy|policy|terms|conditions|all rights reserved)/i.test(x)) return true;
  if (/(sign in|login|register|download app|app store|google play)/i.test(x)) return true;
  if (/(https?:\/\/|www\.)/i.test(x) && x.length < 140) return true;
  if (/\b(instagram|facebook|linkedin|youtube|telegram|tiktok)\b/i.test(x) && x.split(/\s+/).length < 12) {
    return true;
  }

  const digitCount = (x.match(/\d/g) || []).length;
  if (digitCount >= Math.max(8, Math.floor(x.length / 8)) && !/\b(bank|clinic|academy|company|service|business|team|brand|solution)\b/i.test(x)) {
    return true;
  }

  return false;
}

function summaryCandidateScore(value = "") {
  const x = decodeMeta(value, 1200);
  if (!x || looksLikeBadSummary(x)) return -999;

  let score = 0;
  const wordCount = x.split(/\s+/).filter(Boolean).length;

  if (wordCount >= 12 && wordCount <= 80) score += 8;
  if (x.length >= 70 && x.length <= 420) score += 10;
  if (/[.!?։؛…]$/.test(x)) score += 2;
  if (!/\b(\+?\d[\d\s()-]{6,}|@)\b/.test(x)) score += 2;
  if (!looksLikeOperationalHoursLine(x)) score += 4;
  if (!looksLikeAddressLine(x)) score += 3;
  if (!/(cookie|privacy|policy|terms|conditions|login|register)/i.test(x)) score += 3;
  if (/\b(bank|company|business|brand|team|services|solutions|digital|platform|customer|branch|office|academy|clinic|shop|store|agency|studio)\b/i.test(x)) {
    score += 5;
  }
  if (
    /\b(we help|helps|we provide|provides|we offer|offers|speciali[sz]es in|focuses on|serves|supports)\b/i.test(
      x
    )
  ) {
    score += 4;
  }
  if (/[,.;:]/.test(x)) score += 1;
  if ((x.match(/[.!?]/g) || []).length >= 1) score += 2;
  if ((x.match(/[.!?]/g) || []).length > 4) score -= 2;
  if (wordCount > 90) score -= 3;

  return score;
}

function pickBestSummary({
  structuredDescriptions = [],
  metaDescription = "",
  paragraphs = [],
  headings = [],
  text = "",
}) {
  const aboutWindow = extractTextWindowByKeywords(text, [
    "about",
    "about us",
    "company",
    "who we are",
    "haqqımızda",
    "haqqimizda",
    "biz kimik",
    "о компании",
    "about the company",
  ]);

  const serviceWindow = extractTextWindowByKeywords(text, [
    "services",
    "solutions",
    "we help",
    "helps",
    "we provide",
    "provides",
    "we offer",
    "offers",
    "specializes in",
    "focuses on",
  ]);

  const candidatePool = [
    ...arr(structuredDescriptions),
    metaDescription,
    aboutWindow,
    serviceWindow,
    ...arr(paragraphs).slice(0, 10),
    ...arr(headings).slice(0, 4),
  ]
    .map((x) => decodeMeta(x, 1200))
    .filter(Boolean);

  const ranked = candidatePool
    .map((value) => ({ value, score: summaryCandidateScore(value) }))
    .filter((x) => x.score > -100)
    .sort((a, b) => b.score - a.score || a.value.length - b.value.length);

  return ranked[0]?.value || "";
}

function cleanParagraphs(values = []) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, 900))
      .filter(Boolean)
      .filter((x) => x.length >= 20)
      .filter((x) => !looksLikeNavCluster(x))
      .filter((x) => !/^(home|about|services|contact|faq|blog|news|menu)$/i.test(x))
  ).slice(0, 28);
}

function cleanListItems(values = []) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, 280))
      .filter(Boolean)
      .filter((x) => x.length >= 2)
      .filter((x) => !looksLikeNavCluster(x))
      .filter((x) => !looksLikeThinOperationalSnippet(x))
  ).slice(0, 48);
}

function cleanHeadings(values = []) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, 200))
      .filter(Boolean)
      .filter((x) => x.length >= 2)
      .filter((x) => !looksLikeNavCluster(x))
      .filter((x) => !looksLikeThinOperationalSnippet(x))
  ).slice(0, 24);
}

function detectPageType({ url = "", title = "", headings = [], text = "", anchors = [] }) {
  const joined = lower(
    [
      url,
      title,
      ...headings.slice(0, 8),
      ...arr(anchors)
        .slice(0, 10)
        .map((x) => `${s(x.text)} ${s(x.title)}`),
      text.slice(0, 800),
    ].join(" | ")
  );

  if (/(contact|əlaqə|elaqe|get in touch|reach us)/i.test(joined)) return "contact";
  if (/(about|haqqimizda|haqqımızda|who we are|company|our story)/i.test(joined)) return "about";
  if (/(pricing|price|qiymət|qiymet|tarif|packages|plans)/i.test(joined)) return "pricing";
  if (/\b(faq|questions|help|support)\b/i.test(joined)) return "faq";
  if (/(policy|privacy|refund|return|shipping|terms|conditions)/i.test(joined)) return "policy";
  if (/(booking|book|schedule|appointment|reserve|consultation|demo)/i.test(joined)) return "booking";
  if (/(location|branch|office|find us|visit us|map)/i.test(joined)) return "locations";
  if (/(services|xidmət|xidmet|solutions|offers)/i.test(joined)) return "services";
  if (/(team|founder|leadership|staff)/i.test(joined)) return "team";
  if (/(blog|news|insights|article)/i.test(joined)) return "blog";
  return "generic";
}

function detectSoftBlockSignals({ html = "", text = "", title = "", url = "" }) {
  const joined = lower([title, text.slice(0, 4000), html.slice(0, 8000), url].join(" | "));
  const warnings = [];

  if (
    /(just a moment|attention required|verify you are human|captcha|access denied|forbidden|request blocked|bot detection|security check|checking your browser|403 forbidden)/i.test(
      joined
    )
  ) {
    warnings.push("bot_or_access_protection_detected");
  }

  if (
    /(domain for sale|buy this domain|parked free|coming soon|under construction|placeholder|site not configured|default web site page|index of \/)/i.test(
      joined
    )
  ) {
    warnings.push("parked_or_placeholder_site_detected");
  }

  if (
    /(404 not found|page not found|site cannot be reached|temporarily unavailable|maintenance mode|maintenance|oops! page not found)/i.test(
      joined
    )
  ) {
    warnings.push("error_or_placeholder_content_detected");
  }

  if (text.length < 250) {
    warnings.push("very_thin_visible_content");
  } else if (text.length < 700) {
    warnings.push("thin_visible_content");
  }

  return uniq(warnings);
}

export function pageSignalCount(page = {}) {
  return (
    arr(page.emails).length +
    arr(page.phones).length +
    arr(page.addresses).length +
    arr(page.hours).length +
    arr(page.faqItems).length +
    arr(page.serviceHints).length +
    arr(page.pricingHints).length +
    arr(page.socialLinks).length +
    (page.primaryCta ? 1 : 0) +
    arr(page.structured?.names).length +
    arr(page.structured?.descriptions).length
  );
}

export function pageContentEvidenceCount(page = {}) {
  return (
    arr(page.headings).length +
    arr(page.paragraphs).length +
    arr(page.listItems).length +
    pageSignalCount(page)
  );
}

export function hasMeaningfulPageContent(page = {}) {
  const textLength = n(page?.metrics?.textLength, 0);
  const evidenceCount = pageContentEvidenceCount(page);
  return evidenceCount > 0 || textLength >= 120;
}

function buildPageShellSignature(page = {}) {
  const parts = [
    normalizeComparableSnippet(page.title, 120),
    normalizeComparableSnippet(page.metaDescription, 220),
    normalizeComparableSnippet(page.text, 220),
    arr(page.headings)
      .slice(0, 2)
      .map((x) => normalizeComparableSnippet(x, 120))
      .join(" | "),
    arr(page.paragraphs)
      .slice(0, 1)
      .map((x) => normalizeComparableSnippet(x, 160))
      .join(" | "),
  ].filter(Boolean);

  return parts.join(" || ");
}

function isMinimalShellPage(page = {}) {
  const textLength = n(page?.metrics?.textLength, 0);
  const evidenceCount = pageContentEvidenceCount(page);
  const linkCount = n(page?.metrics?.linkCount, 0);
  return textLength <= 80 && evidenceCount === 0 && linkCount === 0;
}

function computePageQuality(page = {}) {
  let score = 0;

  if (s(page.title)) score += 10;
  if (s(page.metaDescription)) score += 6;
  if (arr(page.headings).length >= 2) score += 10;
  if (arr(page.paragraphs).length >= 2) score += 10;
  if (arr(page.emails).length > 0) score += 8;
  if (arr(page.phones).length > 0) score += 8;
  if (arr(page.addresses).length > 0) score += 8;
  if (arr(page.hours).length > 0) score += 6;
  if (arr(page.faqItems).length > 0) score += 6;
  if (arr(page.serviceHints).length > 0) score += 10;
  if (arr(page.pricingHints).length > 0) score += 5;
  if (arr(page.socialLinks).length > 0) score += 4;
  if (arr(page.structured?.names).length > 0) score += 7;
  if (page.metrics?.textLength >= 1200) score += 6;
  if (page.pageType && page.pageType !== "generic") score += 4;

  if (isMinimalShellPage(page)) score -= 12;
  score -= arr(page.qualityWarnings).length * 4;
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    band: score >= 60 ? "strong" : score >= 35 ? "medium" : "weak",
  };
}

export function isBusinessCriticalPageType(pageType = "") {
  return ["about", "services", "contact", "pricing", "faq", "booking", "locations", "team"].includes(
    s(pageType)
  );
}

function looksServiceish(value = "") {
  if (!value) return false;

  if (looksLikeThinOperationalSnippet(value)) return false;
  if (/\b(cookie|privacy|policy|terms|login|sign in|read more|learn more|contact us)\b/i.test(value)) {
    return false;
  }

  if (
    /\b(service|services|solution|solutions|automation|marketing|design|development|consulting|seo|branding|website|ecommerce|software|platform|support|repair|maintenance|training|course|academy|clinic|dental|beauty|spa|tour|travel|real estate|law|accounting|printing|delivery|catering|xidmət|xidmet|kurs|təmir|temir|satış|satis)\b/i.test(
      value
    )
  ) {
    return true;
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 5 && !/\d/.test(value) && !looksLikeNavCluster(value)) {
    return true;
  }

  return false;
}

function normalizeStructuredEmails(values = []) {
  return uniq(
    arr(values)
      .map((x) => s(x).toLowerCase())
      .filter(Boolean)
  ).slice(0, 20);
}

function normalizeStructuredPhones(values = []) {
  return uniq(
    arr(values)
      .map((x) => normalizePhone(x))
      .filter(Boolean)
  ).slice(0, 20);
}

function normalizeStructuredAddresses(values = []) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, 180))
      .filter(Boolean)
      .filter((x) => looksLikeAddressLine(x))
  ).slice(0, 10);
}

function normalizeStructuredDescriptions(values = []) {
  return uniq(
    arr(values)
      .map((x) => decodeMeta(x, 900))
      .filter(Boolean)
      .filter((x) => !looksLikeBadSummary(x))
  ).slice(0, 10);
}

export function analyzePage({ html = "", pageUrl = "" }) {
  const rawText = normalizeVisibleText(stripHtmlToText(html));
  const cleanedLines = meaningfulLines(rawText, 260).map((x) => decodeMeta(x, 260)).filter(Boolean);
  const text = cleanedLines.join("\n");

  const jsonLd = extractJsonLdBlocks(html);
  const structuredRaw = extractStructuredBusinessSignals(jsonLd);
  const structured = {
    ...structuredRaw,
    names: cleanCollection(structuredRaw?.names, 180, 10),
    descriptions: normalizeStructuredDescriptions(structuredRaw?.descriptions),
    emails: normalizeStructuredEmails(structuredRaw?.emails),
    phones: normalizeStructuredPhones(structuredRaw?.phones),
    addresses: normalizeStructuredAddresses(structuredRaw?.addresses),
    serviceNames: cleanCollection(structuredRaw?.serviceNames, 140, 20),
    priceHints: cleanCollection(structuredRaw?.priceHints, 160, 20),
    hours: cleanCollection(structuredRaw?.hours, 180, 20).filter((x) => looksLikeOperationalHoursLine(x)),
  };

  const title = decodeMeta(
    structured.names?.[0] ||
      extractMetaContent(html, "og:site_name") ||
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "application-name") ||
      extractMetaContent(html, "apple-mobile-web-app-title") ||
      extractTitle(html),
    180
  );

  const metaDescription = decodeMeta(
    extractMetaContent(html, "description") || extractMetaContent(html, "og:description"),
    500
  );

  const canonicalUrl = extractCanonicalUrl(html, pageUrl);
  const headings = cleanHeadings(extractHeadings(html));
  const paragraphs = cleanParagraphs(extractParagraphs(html, 28));
  const listItems = cleanListItems(extractLists(html, 48));
  const links = uniq(arr(extractLinks(html, pageUrl)).map((x) => s(x)).filter(Boolean));
  const anchorRecords = arr(extractAnchorRecords(html, pageUrl)).map((x) => ({
    ...x,
    text: decodeMeta(x?.text, 160),
    title: decodeMeta(x?.title, 160),
    url: s(x?.url),
  }));

  const emails = uniq([
    ...extractEmails(text),
    ...structured.emails,
    ...extractEmailsFromAnchors(anchorRecords),
  ]).slice(0, 20);

  const phones = uniq([
    ...extractPhones(text),
    ...structured.phones,
    ...extractPhonesFromAnchors(anchorRecords),
  ]).slice(0, 20);

  const faqItems = extractFaqItems(html, text).map((item) => ({
    question: decodeMeta(item?.question, 220),
    answer: decodeMeta(item?.answer, 500),
  })).filter((item) => item.question);

  const addresses = uniq([
    ...extractAddresses(text),
    ...structured.addresses,
  ]).slice(0, 10);

  const hours = uniq([
    ...extractHours(text),
    ...arr(structured.hours).map((x) => compactText(s(x), 180)).filter(Boolean),
  ]).slice(0, 10);

  const socialLinks = extractSocialLinks(links);
  const whatsappLinks = extractWhatsappLinks(links);
  const bookingLinks = extractBookingLinks(links, anchorRecords);

  const strongParagraphs = paragraphs
    .filter((x) => !looksLikeNavCluster(x))
    .filter((x) => !looksLikeThinOperationalSnippet(x))
    .filter((x) => !/(cookie|privacy|policy|terms|conditions|all rights reserved|newsletter|sign in|register)/i.test(x));

  const serviceParagraphs = strongParagraphs.filter((x) =>
    /\b(service|services|solution|solutions|offer|offering|product|products|treatment|package|automation|design|development|consulting|academy|clinic|spa|course|repair|maintenance|speciali[sz]es in|focuses on|helps|provides|bookkeeping|payroll|accounting|tax|vat|fractional cfo|compliance|advisory|legal)\b/i.test(
      x
    )
  );

  const pricingParagraphs = strongParagraphs.filter((x) =>
    /(\$|€|£|₼|\bazn\b|\busd\b|\beur\b|\bprice\b|\bpricing\b|\bpackage\b|\bplan\b|\bstarting\b|\bfrom\b|\bquote\b)/i.test(
      x
    )
  );

  const heroSection = compactText(
    uniq([headings[0] || "", headings[1] || "", ...pickStrongParagraphs(strongParagraphs, 2)])
      .filter(Boolean)
      .join(" — "),
    1200
  );

  const bestSummary = pickBestSummary({
    structuredDescriptions: structured.descriptions,
    metaDescription,
    paragraphs: strongParagraphs,
    headings,
    text,
  });

  const aboutSection =
    bestSummary ||
    compactText(pickStrongParagraphs(strongParagraphs, 2).join(" "), 1600) ||
    metaDescription ||
    "";

  const contactSection = decodeMeta(
    extractTextWindowByKeywords(text, [
      "contact",
      "get in touch",
      "reach us",
      "əlaqə",
      "elaqe",
      "support",
    ]),
    1200
  );

  const pricingSection = decodeMeta(
    extractTextWindowByKeywords(text, [
      "pricing",
      "price",
      "prices",
      "packages",
      "plans",
      "tarif",
      "qiymət",
      "qiymet",
    ]) ||
      compactText(
        uniq([
          ...strongParagraphs.filter((x) =>
            /(\$|€|£|₼|\bazn\b|\busd\b|\beur\b|\bprice\b|\bpricing\b|\bpackage\b|\bplan\b|\bpaket\b|\bqiymət\b|\bqiymet\b)/i.test(
              x
            )
          ),
          ...listItems.filter((x) =>
            /(\$|€|£|₼|\bazn\b|\busd\b|\beur\b|\bprice\b|\bpricing\b|\bpackage\b|\bplan\b|\bpaket\b|\bqiymət\b|\bqiymet\b)/i.test(
              x
            )
          ),
        ])
          .slice(0, 4)
          .join(" "),
        1200
      ),
    1200
  );

  const faqSection = compactText(
    faqItems
      .slice(0, 4)
      .map((item) => `${item.question}${item.answer ? ` — ${item.answer}` : ""}`)
      .join(" "),
    1200
  );

  const policySection = decodeMeta(
    extractTextWindowByKeywords(text, [
      "privacy",
      "policy",
      "terms",
      "conditions",
      "refund",
      "return",
      "shipping",
    ]),
    1200
  );

  const serviceHints = uniq(
    [
      ...arr(structured.serviceNames).map((x) => sanitizeServiceCandidate(x)).filter(Boolean),
      ...listItems
        .map((x) => sanitizeServiceCandidate(x))
        .filter(Boolean)
        .filter(looksServiceish),
      ...headings
        .map((x) => sanitizeServiceCandidate(x))
        .filter(Boolean)
        .filter(looksServiceish),
      ...serviceParagraphs
        .map((x) => sanitizeServiceCandidate(x))
        .filter(Boolean)
        .filter(looksServiceish),
    ].filter(Boolean)
  ).slice(0, 20);

  const pricingHints = uniq(
    [
      ...arr(structured.priceHints).map((x) => sanitizePricingCandidate(x)).filter(Boolean),
      ...listItems.map((x) => sanitizePricingCandidate(x)).filter(Boolean),
      ...pricingParagraphs.map((x) => sanitizePricingCandidate(x)).filter(Boolean),
    ].filter(Boolean)
  ).slice(0, 14);

  const pageType = detectPageType({
    url: pageUrl,
    title,
    headings,
    text,
    anchors: anchorRecords,
  });

  const qualityWarnings = detectSoftBlockSignals({
    html,
    text,
    title,
    url: pageUrl,
  });

  const page = {
    url: pageUrl,
    canonicalUrl,
    pageType,
    title,
    metaDescription,
    text,
    visibleExcerpt: compactText(text, 2800),
    headings,
    paragraphs,
    listItems,
    links,
    anchorRecords,
    emails,
    phones,
    addresses,
    hours,
    socialLinks,
    whatsappLinks,
    bookingLinks,
    faqItems,
    serviceHints,
    pricingHints,
    structured,
    primaryCta: extractPrimaryCta(anchorRecords),
    sections: {
      hero: heroSection,
      about: aboutSection,
      contact: contactSection,
      pricing: pricingSection,
      faq: faqSection,
      policy: policySection,
    },
    metrics: {
      htmlBytes: Buffer.byteLength(html, "utf8"),
      textLength: text.length,
      headingCount: headings.length,
      paragraphCount: paragraphs.length,
      listItemCount: listItems.length,
      linkCount: links.length,
      emailCount: emails.length,
      phoneCount: phones.length,
      faqCount: faqItems.length,
      addressCount: addresses.length,
      hoursCount: hours.length,
      socialLinkCount: socialLinks.length,
      whatsappLinkCount: whatsappLinks.length,
      bookingLinkCount: bookingLinks.length,
    },
    qualityWarnings,
  };

  page.quality = computePageQuality(page);
  page.analysis = {
    signalCount: pageSignalCount(page),
    evidenceCount: pageContentEvidenceCount(page),
    minimalShell: isMinimalShellPage(page),
    shellSignature: buildPageShellSignature(page),
  };

  return page;
}
