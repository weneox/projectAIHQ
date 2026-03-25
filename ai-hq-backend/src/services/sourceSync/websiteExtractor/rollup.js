import { cfg, arr, compactText, lower, s, uniq, uniqBy } from "./shared.js";
import { sanitizeNarrativeText, parseTitleNameCandidates } from "./text.js";
import {
  extractBookingLinks,
  extractSocialLinks,
  extractWhatsappLinks,
  looksLikeAddressLine,
  looksLikeOperationalHoursLine,
  normalizeVisibleText,
  sanitizePricingCandidate,
  sanitizeServiceCandidate,
} from "./signals.js";

function wordCount(text = "") {
  return s(text)
    .split(/\s+/)
    .filter(Boolean).length;
}

function cleanNarrative(value = "", max = 500, min = 0) {
  const normalized = normalizeVisibleText(value, max);
  return sanitizeNarrativeText(normalized, { max, min });
}

function looksLikeSocialLabelList(value = "") {
  const x = lower(value);
  return (
    /\b(instagram|facebook|linkedin|youtube|tiktok|telegram|whatsapp|x|twitter)\b/.test(x) &&
    x.split(",").length >= 2 &&
    wordCount(x) <= 12
  );
}

function looksLikeBadDescription(value = "") {
  const x = cleanNarrative(value, 500, 0);
  if (!x) return true;
  if (x.length < 30) return true;
  if (looksLikeOperationalHoursLine(x)) return true;
  if (looksLikeAddressLine(x)) return true;
  if (looksLikeSocialLabelList(x)) return true;
  if (/(cookie|privacy|policy|terms|conditions|login|register|sign in|all rights reserved)/i.test(x)) {
    return true;
  }
  if (/\b(\+?\d[\d\s()-]{6,}|@)\b/.test(x) && wordCount(x) < 12) return true;
  if ((x.match(/https?:\/\//g) || []).length >= 1) return true;
  return false;
}

function looksLikeWeakName(value = "") {
  const x = cleanNarrative(value, 160, 0);
  if (!x) return true;
  if (x.length < 2 || x.length > 120) return true;
  if (/^(home|homepage|about|contact|services|pricing|faq|support|blog|news)$/i.test(x)) {
    return true;
  }
  if (looksLikeAddressLine(x) || looksLikeOperationalHoursLine(x)) return true;
  if (looksLikeSocialLabelList(x)) return true;
  return false;
}

function pageTypeWeight(pageType = "") {
  const value = s(pageType);
  if (value === "about") return 18;
  if (value === "contact") return 14;
  if (value === "services") return 12;
  if (value === "locations") return 10;
  if (value === "pricing") return 9;
  if (value === "faq") return 8;
  if (value === "team") return 7;
  if (value === "booking") return 6;
  if (value === "generic") return 3;
  return 0;
}

function scoreDescriptionCandidate(value = "", page = {}, source = "") {
  const x = cleanNarrative(value, 500, 0);
  if (looksLikeBadDescription(x)) return -999;

  let score = 0;
  const words = wordCount(x);

  score += pageTypeWeight(page?.pageType);
  if (source === "about") score += 16;
  if (source === "hero") score += 8;
  if (source === "structured") score += 10;
  if (source === "meta") score += 7;

  if (words >= 12 && words <= 70) score += 10;
  if (x.length >= 70 && x.length <= 320) score += 10;
  if (/[.!?]$/.test(x)) score += 2;
  if ((x.match(/[.!?]/g) || []).length >= 1) score += 2;
  if (!/\b(\+?\d[\d\s()-]{6,}|@)\b/.test(x)) score += 2;
  if (!looksLikeAddressLine(x)) score += 3;
  if (!looksLikeOperationalHoursLine(x)) score += 3;

  if (
    /\b(company|business|bank|brand|team|services|solutions|platform|agency|clinic|academy|studio|store|shop|customer|branch)\b/i.test(
      x
    )
  ) {
    score += 4;
  }

  if (words > 85) score -= 4;

  return score;
}

function scoreNameCandidate(value = "", page = {}, source = "") {
  const x = cleanNarrative(value, 160, 0);
  if (looksLikeWeakName(x)) return -999;

  let score = 0;
  score += pageTypeWeight(page?.pageType);
  if (source === "structured") score += 10;
  if (source === "title") score += 8;
  if (source === "heading") score += 5;
  if (x.length >= 3 && x.length <= 50) score += 8;
  if (!/\d/.test(x)) score += 4;
  if (!/\b(home|contact|services|pricing|faq|support)\b/i.test(x)) score += 3;

  return score;
}

function rankedUniqueCandidates(items = [], keyFn, limit = 20) {
  const sorted = arr(items)
    .filter((x) => Number.isFinite(x?.score))
    .sort((a, b) => b.score - a.score || s(a?.value).length - s(b?.value).length);

  return uniqBy(sorted, (x) => keyFn(x)).slice(0, limit);
}

function collectNameCandidates(allPages = [], referencePage = {}) {
  const raw = [];

  for (const page of allPages) {
    for (const value of arr(page?.structured?.names)) {
      raw.push({
        value,
        page,
        source: "structured",
      });
    }

    for (const value of parseTitleNameCandidates(page?.title)) {
      raw.push({
        value,
        page,
        source: "title",
      });
    }

    for (const value of arr(page?.headings).slice(0, 2)) {
      raw.push({
        value,
        page,
        source: "heading",
      });
    }
  }

  if (referencePage?.title) {
    raw.push({
      value: referencePage.title,
      page: referencePage,
      source: "title",
    });
  }

  return rankedUniqueCandidates(
    raw.map((item) => {
      const value = cleanNarrative(item.value, 160, 0);
      return {
        ...item,
        value,
        score: scoreNameCandidate(value, item.page, item.source),
      };
    }),
    (x) => lower(x.value),
    20
  ).map((x) => x.value);
}

function collectDescriptionCandidates(allPages = [], referencePage = {}) {
  const raw = [];

  for (const page of allPages) {
    raw.push({ value: page?.sections?.about, page, source: "about" });
    raw.push({ value: page?.sections?.hero, page, source: "hero" });
    raw.push({ value: page?.metaDescription, page, source: "meta" });

    for (const value of arr(page?.structured?.descriptions)) {
      raw.push({ value, page, source: "structured" });
    }
  }

  if (referencePage?.metaDescription) {
    raw.push({
      value: referencePage.metaDescription,
      page: referencePage,
      source: "meta",
    });
  }

  return rankedUniqueCandidates(
    raw.map((item) => {
      const value = cleanNarrative(item.value, 500, 30);
      return {
        ...item,
        value,
        score: scoreDescriptionCandidate(value, item.page, item.source),
      };
    }),
    (x) => lower(x.value),
    20
  ).map((x) => x.value);
}

function collectPrioritizedValues(allPages = [], selector, preferredTypes = []) {
  const preferred = [];
  const fallback = [];

  for (const page of allPages) {
    const values = arr(selector(page)).filter(Boolean);
    if (preferredTypes.includes(s(page?.pageType))) {
      preferred.push(...values);
    } else {
      fallback.push(...values);
    }
  }

  return uniq([...preferred, ...fallback]);
}

function collectServiceHints(allPages = []) {
  return uniq(
    collectPrioritizedValues(
      allPages,
      (page) => arr(page?.serviceHints).map((item) => sanitizeServiceCandidate(item)),
      ["services", "about", "generic"]
    )
  )
    .filter(Boolean)
    .filter((x) => !looksLikeOperationalHoursLine(x))
    .filter((x) => !looksLikeAddressLine(x))
    .slice(0, 30);
}

function collectPricingHints(allPages = []) {
  return uniq(
    collectPrioritizedValues(
      allPages,
      (page) => arr(page?.pricingHints).map((item) => sanitizePricingCandidate(item)),
      ["pricing", "services", "generic"]
    )
  )
    .filter(Boolean)
    .filter((x) => !looksLikeOperationalHoursLine(x))
    .filter((x) => !looksLikeAddressLine(x))
    .slice(0, 16);
}

function collectAddresses(allPages = []) {
  return uniq(
    collectPrioritizedValues(
      allPages,
      (page) => arr(page?.addresses).map((x) => normalizeVisibleText(x, 180)),
      ["contact", "locations", "about"]
    )
  )
    .filter(Boolean)
    .filter((x) => looksLikeAddressLine(x))
    .slice(0, 12);
}

function collectHours(allPages = []) {
  return uniq(
    collectPrioritizedValues(
      allPages,
      (page) => arr(page?.hours).map((x) => normalizeVisibleText(x, 180)),
      ["contact", "locations", "about"]
    )
  )
    .filter(Boolean)
    .filter((x) => looksLikeOperationalHoursLine(x))
    .slice(0, 12);
}

function collectFaqPreview(allPages = []) {
  return uniqBy(
    collectPrioritizedValues(allPages, (page) => arr(page?.faqItems), ["faq", "support", "generic"]),
    (x) => lower(s(x?.question))
  )
    .filter((x) => s(x?.question))
    .slice(0, 16);
}

export function buildSiteRollup(entryPage, allPages, extraWarnings = []) {
  const pages = arr(allPages).filter(Boolean);
  const referencePage = entryPage || pages[0] || {};

  const allLinks = uniq([
    ...pages.flatMap((x) => arr(x.links)),
    ...pages.flatMap((x) => arr(x.structured?.sameAs)),
  ]);

  const shouldExtractSocial = cfg.sourceSync?.extractSocialLinks !== false;
  const socialLinks = shouldExtractSocial ? extractSocialLinks(allLinks) : [];
  const whatsappLinks = extractWhatsappLinks(allLinks);
  const bookingLinks = extractBookingLinks(
    allLinks,
    pages.flatMap((x) => arr(x.anchorRecords))
  );

  const internalHints = {
    about_pages: uniq(pages.filter((x) => x.pageType === "about").map((x) => x.url)).slice(0, 12),
    services_pages: uniq(pages.filter((x) => x.pageType === "services").map((x) => x.url)).slice(0, 12),
    pricing_pages: uniq(pages.filter((x) => x.pageType === "pricing").map((x) => x.url)).slice(0, 12),
    faq_pages: uniq(pages.filter((x) => x.pageType === "faq").map((x) => x.url)).slice(0, 12),
    contact_pages: uniq(pages.filter((x) => x.pageType === "contact").map((x) => x.url)).slice(0, 12),
    policy_pages: uniq(pages.filter((x) => x.pageType === "policy").map((x) => x.url)).slice(0, 12),
    booking_pages: uniq(pages.filter((x) => x.pageType === "booking").map((x) => x.url)).slice(0, 12),
    location_pages: uniq(pages.filter((x) => x.pageType === "locations").map((x) => x.url)).slice(0, 12),
    team_pages: uniq(pages.filter((x) => x.pageType === "team").map((x) => x.url)).slice(0, 12),
  };

  const pageTypeCounts = pages.reduce((acc, page) => {
    const key = s(page?.pageType || "generic") || "generic";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const nameCandidates = collectNameCandidates(pages, referencePage);
  const descriptionCandidates = collectDescriptionCandidates(pages, referencePage);

  const contactEmails = uniq(
    collectPrioritizedValues(pages, (page) => arr(page?.emails), ["contact", "about", "generic"])
  ).slice(0, 20);

  const contactPhones = uniq(
    collectPrioritizedValues(pages, (page) => arr(page?.phones), ["contact", "about", "generic"])
  ).slice(0, 20);

  const addresses = collectAddresses(pages);
  const hours = collectHours(pages);
  const serviceHints = collectServiceHints(pages);
  const pricingHints = collectPricingHints(pages);
  const faqPreview = collectFaqPreview(pages);

  const primaryCtas = uniqBy(
    pages.map((x) => x.primaryCta).filter(Boolean),
    (x) => `${lower(x.label)}|${lower(x.url)}`
  ).slice(0, 8);

  let qualityScore = 0;

  if (pages.length >= 2) qualityScore += 12;
  if (internalHints.about_pages.length) qualityScore += 10;
  if (internalHints.contact_pages.length) qualityScore += 10;
  if (internalHints.services_pages.length) qualityScore += 12;
  if (contactEmails.length || contactPhones.length) qualityScore += 15;
  if (addresses.length) qualityScore += 8;
  if (hours.length) qualityScore += 5;
  if (serviceHints.length) qualityScore += 12;
  if (pricingHints.length) qualityScore += 6;
  if (nameCandidates.length) qualityScore += 8;
  if (descriptionCandidates.length) qualityScore += 8;
  if (socialLinks.length) qualityScore += 4;
  if (primaryCtas.length) qualityScore += 4;

  if (arr(extraWarnings).includes("fallback_identity_only_extraction")) qualityScore -= 14;
  if (arr(extraWarnings).includes("duplicate_shell_routes_detected")) qualityScore -= 10;
  if (arr(extraWarnings).includes("shell_like_website_detected")) qualityScore -= 12;
  if (arr(extraWarnings).includes("blocked_entry_fetch")) qualityScore -= 25;

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const qualityWarnings = uniq([
    ...pages.flatMap((x) => arr(x.qualityWarnings)),
    ...(contactEmails.length || contactPhones.length ? [] : ["missing_contact_signals"]),
    ...(serviceHints.length ? [] : ["missing_service_signals"]),
    ...(faqPreview.length ? [] : ["faq_help_content_not_detected"]),
    ...(pages.length >= 2 ? [] : ["limited_page_coverage"]),
    ...arr(extraWarnings),
  ]);

  return {
    sourceUrl: s(referencePage.url),
    finalUrl: s(referencePage.url),
    pagesScanned: pages.length,
    linksScanned: allLinks.length,
    socialLinks,
    socialProfileLabels: socialLinks
      .map((item) => s(item?.handle ? `${item.platform}: ${item.handle}` : item?.url))
      .filter(Boolean)
      .slice(0, 12),
    whatsappLinks,
    bookingLinks,
    primaryCtas,
    internalHints,
    pageTypeCounts,
    identitySignals: {
      nameCandidates,
      descriptionCandidates,
      primaryName: s(nameCandidates[0] || ""),
      primaryDescription: s(descriptionCandidates[0] || ""),
      contactEmails,
      contactPhones,
      addresses,
      hours,
      serviceHints,
      pricingHints,
      faqPreview,
    },
    quality: {
      score: qualityScore,
      band: qualityScore >= 60 ? "strong" : qualityScore >= 35 ? "medium" : "weak",
      warnings: qualityWarnings,
    },
    scannedPages: pages.map((x) => ({
      url: x.url,
      canonicalUrl: x.canonicalUrl,
      pageType: x.pageType,
      title: x.title,
      metaDescription: x.metaDescription,
      quality: x.quality,
      qualityWarnings: x.qualityWarnings,
      metrics: x.metrics,
    })),
  };
}