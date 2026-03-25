// src/services/workspace/import/draft.js
// draft/session shaping helpers extracted from src/services/workspace/import.js
// FINAL v7.0 — multilingual-safe draft shaping + stronger cleanup wall
// fixes:
// - remove hardcoded az language fallback
// - stricter address/summary/service/pricing cleanup
// - carry synthesis review metadata into session draft
// - preserve better frontend aliases for multilingual projection
// - reject weak social/platform-only pollution

import {
  arr,
  obj,
  s,
  lower,
  nowIso,
  compactObject,
  mergeDeep,
  uniqStrings,
  normalizeDraftKey,
  cloneJson,
  isPlainObject,
  sourceTypeLabel,
  sourceAuthorityClass,
} from "./shared.js";

const GENERIC_DRAFT_LABELS = new Set([
  "service",
  "services",
  "product",
  "products",
  "product or package",
  "pricing hint",
  "pricing policy",
  "support mode",
  "working hours",
  "booking link",
  "whatsapp link",
  "social link",
  "business name",
  "business summary",
  "business overview",
]);

const NAV_MENU_TOKENS = new Set([
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
  "ana",
  "ana səhifə",
  "ana sehife",
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
]);

const ADDRESS_SIGNAL_TOKENS = new Set([
  "baku",
  "baku city",
  "bakı",
  "baki",
  "azerbaijan",
  "azərbaycan",
  "azerbaycan",
  "street",
  "st",
  "avenue",
  "ave",
  "road",
  "rd",
  "prospekt",
  "pr",
  "küçə",
  "kuce",
  "bulvar",
  "rayon",
  "rayonu",
  "district",
  "blok",
  "block",
  "building",
  "bina",
  "office",
  "ofis",
  "floor",
  "mərtəbə",
  "mertebe",
  "plaza",
  "center",
  "mərkəz",
  "merkez",
  "metro",
  "suite",
  "apt",
  "apartment",
]);

const GENERIC_ONE_WORD_SERVICES = new Set([
  "saytpro",
  "service",
  "services",
  "xidmət",
  "xidmətlər",
  "xidmet",
  "xidmetler",
  "design",
  "dizayn",
  "websites",
  "website",
  "vebsayt",
  "sayt",
  "products",
  "product",
]);

const GENERIC_SUMMARY_PATTERNS = [
  /find local businesses,\s*view maps and get driving directions in google maps/i,
  /view maps and get driving directions/i,
  /google maps/i,
];

const PLACEHOLDER_POLICY_PATTERNS = [
  /cancellation policy/i,
  /please notify us 24 hours in advance/i,
];

const PROMO_NOISE_RE =
  /\b(read more|learn more|view more|get started|start now|book now|call now|request quote|free consultation|timeline|days|project complexity|requirements|meta tags|structured data|performance optimization|answers to the most common questions)\b/i;

const TESTIMONIAL_RE =
  /\b(testimonial|testimonials|review|reviews|what our clients say|what clients say|happy clients|client feedback|highly recommend|recommend|recommended|very satisfied|great job|thank you)\b/i;

const SOCIAL_HOST_RE =
  /\b(instagram\.com|facebook\.com|fb\.com|linkedin\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com|pinterest\.com)\b/i;

const KNOWN_LANGS = new Set(["az", "tr", "ru", "en"]);
const PLACEHOLDER_EMAIL_RE = /^(info|hello|contact)@company\.com$/i;
const PLACEHOLDER_PHONE_RE = /^\+\d{1,4}\s*\.\.\.$/i;
const FAILURE_WARNING_TOKENS = new Set([
  "website_processing_failed_before_review",
  "website_review_data_partially_available_but_sync_could_not_complete",
]);

function compactText(text = "", max = 320) {
  const value = s(text).replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function cleanDisplayText(text = "", max = 320) {
  return compactText(
    s(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*[|]+\s*/g, " | ")
      .replace(/^[-—–:|,.\s]+/, "")
      .replace(/\s*[|,:;]+$/, "")
      .trim(),
    max
  );
}

function normalizeStableText(text = "") {
  return lower(
    cleanDisplayText(text, 1200)
      .replace(/[^\p{L}\p{N}\s/+-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function keywordHitCount(text = "", dictionary = new Set()) {
  const value = normalizeStableText(text);
  if (!value) return 0;

  let count = 0;
  for (const token of dictionary) {
    if (!token) continue;
    if (value.includes(lower(token))) count += 1;
  }
  return count;
}

function looksLikeGoogleMapsPlaceholder(text = "") {
  const value = s(text);
  if (!value) return false;
  return GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(value));
}

function isPlaceholderCompanyName(text = "") {
  const value = normalizeStableText(text);
  if (!value) return false;
  return (
    value === "google maps" ||
    value === "googlemaps" ||
    value === "company" ||
    value === "business"
  );
}

function isPlaceholderPhone(text = "") {
  const value = cleanDisplayText(text, 80);
  if (!value) return false;
  return PLACEHOLDER_PHONE_RE.test(value) || /^(phone|primary phone)$/i.test(value);
}

function isPlaceholderEmail(text = "") {
  const value = cleanDisplayText(text, 160);
  if (!value) return false;
  return PLACEHOLDER_EMAIL_RE.test(value);
}

function isPlaceholderAddress(text = "") {
  const value = normalizeStableText(text);
  if (!value) return false;
  return value === "primary address" || value === "address" || value === "business address";
}

function looksLikeNavMenuGarbage(text = "") {
  const value = normalizeStableText(text);
  if (!value) return false;

  const hits = keywordHitCount(value, NAV_MENU_TOKENS);
  const words = value.split(" ").filter(Boolean);

  if (hits >= 4 && words.length <= 18) return true;
  if (hits >= 5) return true;
  if (
    /^(home|about|services?|portfolio|team|reviews?|blog|contact|menu|ana|haqqımızda|haqqimizda|xidmətlər|xidmetler|komanda|rəylər|reyler|bloq|əlaqə|elaqe|menyu)\b/i.test(
      value
    ) &&
    hits >= 3
  ) {
    return true;
  }

  return false;
}

function isLikelyTestimonialOrPromo(text = "") {
  const value = cleanDisplayText(text, 800);
  if (!value) return false;
  return TESTIMONIAL_RE.test(value) || PROMO_NOISE_RE.test(value);
}

function takeSentencePrefix(text = "", maxSentences = 2) {
  const value = cleanDisplayText(text, 2200);
  if (!value) return "";

  const sentences = [];
  let rest = value;

  while (rest && sentences.length < maxSentences) {
    const match = rest.match(/^(.+?[.!?])(?:\s+|$)/);
    if (!match) {
      sentences.push(rest.trim());
      break;
    }

    sentences.push(match[1].trim());
    rest = rest.slice(match[0].length).trim();
  }

  return cleanDisplayText(sentences.join(" "), 2200);
}

function stripTrailingInjectedBlocks(text = "") {
  let value = cleanDisplayText(text, 2200);
  if (!value) return "";

  const blockers = [
    /\bservices?\b\s*[:—–-]/i,
    /\bxidmətlər\b\s*[:—–-]/i,
    /\bxidmetler\b\s*[:—–-]/i,
    /\bуслуги\b\s*[:—–-]/i,
    /\bpricing\b\s*[:—–-]/i,
    /\bqiymət\b\s*[:—–-]/i,
    /\bqiymet\b\s*[:—–-]/i,
    /\bцены\b\s*[:—–-]/i,
    /\bsocial\b\s*[:—–-]/i,
    /\bsosial\b\s*[:—–-]/i,
    /\bfaq\b\s*[:—–-]/i,
    /\bemail\b\s*[:—–-]/i,
    /\bphone\b\s*[:—–-]/i,
  ];

  for (const pattern of blockers) {
    const idx = value.search(pattern);
    if (idx > 40) {
      value = value.slice(0, idx).trim();
      break;
    }
  }

  return cleanDisplayText(value, 2200);
}

function sanitizeSummaryText(
  text = "",
  { companyName = "", max = 420, short = true } = {}
) {
  let value = stripTrailingInjectedBlocks(text);
  if (!value) return "";

  if (looksLikeGoogleMapsPlaceholder(value)) return "";
  if (looksLikeNavMenuGarbage(value)) return "";
  if (isLikelyTestimonialOrPromo(value)) return "";
  if (isLikelyAddressText(value)) return "";
  if (
    /\b(price|pricing|qiymət|qiymet|package|packages|plan|plans|starting|from|quote|custom quote|consultation|₼|\bazn\b|\busd\b|\beur\b|\$|€|£)\b/i.test(
      value
    ) &&
    value.length > 100
  ) {
    return "";
  }

  const stable = normalizeStableText(value);
  const stableName = normalizeStableText(companyName);

  if (!stable) return "";
  if (stableName && stable === stableName) return "";

  value = takeSentencePrefix(value, short ? 2 : 5);

  if (short && value.length < 28) return "";
  if (!short && value.length < 40) return "";

  return cleanDisplayText(value, max);
}

function isLikelyAddressText(text = "") {
  const value = cleanDisplayText(text, 240);
  if (!value) return false;

  const stable = normalizeStableText(value);
  const signalHits = keywordHitCount(stable, ADDRESS_SIGNAL_TOKENS);
  const hasDigit = /\d/.test(value);
  const hasComma = /,/.test(value);
  const hasStreetLike =
    /(küçə|kuce|street|st\.?|avenue|ave\.?|prospekt|pr\.?|road|rd\.?|rayonu|rayon|district|blok|block|building|bina|office|ofis|floor|mərtəbə|mertebe|plaza|center|mərkəz|merkez|metro|suite|apt|apartment)/i.test(
      value
    );

  if (looksLikeGoogleMapsPlaceholder(value)) return false;
  if (looksLikeNavMenuGarbage(value)) return false;
  if (isLikelyTestimonialOrPromo(value)) return false;

  if (!(hasDigit || hasComma || hasStreetLike || signalHits >= 2)) return false;
  if (stable.split(" ").length > 18 && signalHits < 2 && !hasDigit) return false;
  if (/[.!?].*[.!?]/.test(value)) return false;

  return true;
}

function sanitizeAddressText(text = "") {
  const value = cleanDisplayText(text, 240);
  if (!value) return "";
  if (isPlaceholderAddress(value)) return "";
  if (!isLikelyAddressText(value)) return "";
  return value;
}

function sanitizePhoneText(text = "") {
  const value = cleanDisplayText(text, 80);
  if (!value) return "";
  if (isPlaceholderPhone(value)) return "";
  return value;
}

function sanitizeEmailText(text = "") {
  const value = cleanDisplayText(text, 160).toLowerCase();
  if (!value) return "";
  if (isPlaceholderEmail(value)) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "";
  return value;
}

function sanitizeCompanyName(text = "") {
  const value = cleanDisplayText(text, 160);
  if (!value) return "";
  if (isPlaceholderCompanyName(value)) return "";
  if (isGenericDraftLabel(value)) return "";
  if (GENERIC_ONE_WORD_SERVICES.has(lower(value))) return "";
  if (looksLikeGoogleMapsPlaceholder(value)) return "";
  if (looksLikeNavMenuGarbage(value)) return "";
  return value;
}

function stripLeadLabels(text = "") {
  return cleanDisplayText(
    s(text)
      .replace(
        /^(service|services|xidmət|xidmətlər|xidmet|xidmetler|услуги|product|products|pricing hint|pricing policy|support mode|working hours|booking link|whatsapp link|social link)\s*[:|—–-]+\s*/i,
        ""
      )
      .trim()
  );
}

function stripServiceLeadLabel(text = "") {
  return cleanDisplayText(
    s(text)
      .replace(
        /^(service|services|our services|xidmət|xidmətlər|xidmet|xidmetler|услуги)\s*[:|—–-]+\s*/i,
        ""
      )
      .trim(),
    220
  );
}

function isGenericDraftLabel(text = "") {
  const key = lower(cleanDisplayText(text));
  return GENERIC_DRAFT_LABELS.has(key);
}

function isContactLikeText(text = "") {
  const value = s(text);
  if (!value) return false;
  return (
    /https?:\/\//i.test(value) ||
    /www\./i.test(value) ||
    /@/.test(value) ||
    /\+\d{6,}/.test(value)
  );
}

function normalizeServiceKey(text = "") {
  return normalizeStableText(text)
    .replace(/\b(website|websites|vebsayt|vebsaytlar|sayt|site|sites)\b/gi, " website ")
    .replace(
      /\b(seo|search engine optimization|axtariş sistemləri optimallaşdırması|axtaris sistemleri optimallasdirilmasi)\b/gi,
      " seo "
    )
    .replace(/\b(design|dizayn|дизайн)\b/gi, " design ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBadServiceToken(text = "", companyName = "") {
  const value = cleanDisplayText(text, 180);
  if (!value) return true;
  if (looksLikeGoogleMapsPlaceholder(value)) return true;
  if (looksLikeNavMenuGarbage(value)) return true;
  if (isContactLikeText(value)) return true;
  if (/[?]/.test(value)) return true;
  if (isLikelyTestimonialOrPromo(value)) return true;
  if (
    /\b(price|pricing|qiymət|qiymet|package|packages|plan|plans|quote|consultation)\b/i.test(
      value
    ) &&
    !/\b(seo|automation|development|design|marketing|chatbot|website|e-commerce|crm|smm|branding)\b/i.test(
      value
    )
  ) {
    return true;
  }

  const stable = normalizeStableText(value);
  const stableName = normalizeStableText(companyName);

  if (!stable) return true;
  if (stableName && stable === stableName) return true;

  const words = stable.split(" ").filter(Boolean);
  if (words.length === 1 && GENERIC_ONE_WORD_SERVICES.has(words[0])) return true;
  if (words.length > 10) return true;

  return false;
}

function splitDelimited(text = "") {
  return s(text)
    .split(/\n+|[|•·▪●]+|;/g)
    .map((x) => cleanDisplayText(x, 220))
    .filter(Boolean);
}

function explodeServiceText(raw = "", companyName = "") {
  let value = stripServiceLeadLabel(raw);
  if (!value) return [];

  if (looksLikeGoogleMapsPlaceholder(value)) return [];
  if (looksLikeNavMenuGarbage(value)) return [];
  if (isLikelyTestimonialOrPromo(value)) return [];

  const firstPass = splitDelimited(value);
  const baseList = firstPass.length ? firstPass : [value];

  const out = [];

  for (const item of baseList) {
    const cleaned = stripServiceLeadLabel(item);
    if (!cleaned) continue;

    const commaParts =
      cleaned.includes(",") &&
      cleaned.split(",").length >= 2 &&
      cleaned.length <= 180 &&
      !/[.!?]/.test(cleaned)
        ? cleaned.split(",").map((x) => cleanDisplayText(x, 160))
        : [cleaned];

    for (const part of commaParts) {
      const next = stripServiceLeadLabel(part);
      if (!next) continue;
      if (isBadServiceToken(next, companyName)) continue;
      out.push(next);
    }
  }

  return out;
}

function normalizeDraftServiceList(list = [], companyName = "") {
  const out = [];
  const seen = new Set();

  for (const raw of arr(list)) {
    const exploded = explodeServiceText(raw, companyName);

    for (const item of exploded) {
      const key = normalizeServiceKey(item);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      out.push(item);

      if (out.length >= 12) return out;
    }
  }

  return out;
}

function normalizeDraftSocialLinks(list = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const platform = lower(s(item?.platform));
    const url = cleanDisplayText(item?.url, 260);

    if (!platform || !url) continue;
    if (!/^(https?:\/\/|www\.)/i.test(url)) continue;
    if (!SOCIAL_HOST_RE.test(url)) continue;
    if (/\bshare|intent|sharer|dialog\b/i.test(url)) continue;

    const key = `${platform}|${lower(url)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ platform, url });
  }

  return out;
}

function isLikelyFaqQuestion(text = "") {
  const value = cleanDisplayText(text, 220);
  if (!value) return false;
  if (looksLikeGoogleMapsPlaceholder(value)) return false;
  if (looksLikeNavMenuGarbage(value)) return false;
  if (isLikelyTestimonialOrPromo(value)) return false;

  if (/[?؟]$/.test(value)) return true;

  return /^(what|how|why|when|where|which|can|do|does|is|are|niyə|niye|necə|nece|nə|ne|harada|hansı|hansi|kim|какой|как|что|почему|где|когда|можно|нужно)\b/i.test(
    value
  );
}

function normalizeDraftFaqItems(list = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(list)) {
    const question = cleanDisplayText(item?.question, 220);
    const answer = cleanDisplayText(item?.answer, 700);

    if (!question || !isLikelyFaqQuestion(question)) continue;
    if (looksLikeGoogleMapsPlaceholder(answer)) continue;
    if (looksLikeNavMenuGarbage(answer)) continue;
    if (isLikelyTestimonialOrPromo(answer)) continue;

    const key = normalizeStableText(question);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push({ question, answer });
  }

  return out;
}

function normalizeProfileArrays(list = [], maxItems = 24, maxText = 240) {
  const out = [];
  const seen = new Set();

  for (const raw of arr(list)) {
    const value = cleanDisplayText(raw, maxText);
    if (!value) continue;
    if (looksLikeGoogleMapsPlaceholder(value)) continue;
    if (looksLikeNavMenuGarbage(value)) continue;
    if (isLikelyTestimonialOrPromo(value)) continue;

    const key = normalizeStableText(value);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= maxItems) break;
  }

  return out;
}

function normalizePricingHints(list = []) {
  const out = [];
  const seen = new Set();

  for (const raw of arr(list)) {
    let value = cleanDisplayText(raw, 220);
    if (!value) continue;
    if (looksLikeGoogleMapsPlaceholder(value)) continue;
    if (looksLikeNavMenuGarbage(value)) continue;
    if (isLikelyTestimonialOrPromo(value)) continue;

    value = stripTrailingInjectedBlocks(value);
    if (!value) continue;

    if (
      !/\b(price|pricing|qiymət|qiymet|package|packages|plan|plans|starting|from|quote|consultation|₼|\bazn\b|\busd\b|\beur\b|\$|€|£)\b/i.test(
        value
      )
    ) {
      continue;
    }

    const key = normalizeStableText(value);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= 6) break;
  }

  return out;
}

function sanitizePolicyText(text = "") {
  const value = cleanDisplayText(text, 320);
  if (!value) return "";
  if (looksLikeGoogleMapsPlaceholder(value)) return "";
  if (looksLikeNavMenuGarbage(value)) return "";
  if (isLikelyTestimonialOrPromo(value)) return "";

  const stable = normalizeStableText(value);
  if (!stable) return "";

  const placeholderHits = PLACEHOLDER_POLICY_PATTERNS.filter((pattern) =>
    pattern.test(value)
  ).length;

  if (placeholderHits >= 2) return "";
  return value;
}

function resolveMainLanguage(profile = {}) {
  const candidates = [
    s(profile.mainLanguage),
    s(profile.primaryLanguage),
    s(profile.language),
    s(profile.sourceLanguage),
  ]
    .map((x) => lower(x))
    .filter(Boolean);

  for (const lang of candidates) {
    if (KNOWN_LANGS.has(lang)) return lang;
  }

  return "en";
}

function readFieldConfidenceScore(fieldConfidence = {}, field = "") {
  const value = Number(obj(fieldConfidence)[field]?.score);
  return Number.isFinite(value) ? value : null;
}

function pickFirstSanitized(candidates = [], sanitizer = (value) => value) {
  for (const candidate of arr(candidates)) {
    const cleaned = sanitizer(candidate);
    if (cleaned) return cleaned;
  }

  return "";
}

function buildCompanyNameCandidates(profile = {}) {
  const x = obj(profile);

  return [
    x.companyName,
    x.displayName,
    x.companyTitle,
    x.name,
    ...arr(x.businessNames),
    ...arr(x.structuredNames),
    ...arr(x.headings).slice(0, 6),
  ];
}

function shouldPreferDeterministicSummary({
  fieldConfidence = {},
  reviewFlags = [],
} = {}) {
  const shortScore = readFieldConfidenceScore(fieldConfidence, "summaryShort");
  const longScore = readFieldConfidenceScore(fieldConfidence, "summaryLong");
  const weakFlag = arr(reviewFlags).some((flag) =>
    lower(flag).includes("weak_summary")
  );

  return weakFlag || shortScore !== null && shortScore < 0.45 || longScore !== null && longScore < 0.45;
}

function buildDeterministicSummaryShort({
  companyName = "",
  services = [],
  aboutSection = "",
  primaryPhone = "",
  primaryEmail = "",
}) {
  const serviceList = arr(services).slice(0, 4);
  const cleanAbout = sanitizeSummaryText(aboutSection, {
    companyName,
    max: 420,
    short: true,
  });

  if (cleanAbout) return cleanAbout;

  const parts = [];

  if (companyName && serviceList.length) {
    parts.push(`${companyName} provides ${serviceList.join(", ")}.`);
  } else if (companyName) {
    parts.push(companyName);
  } else if (serviceList.length) {
    parts.push(`Provides ${serviceList.join(", ")}.`);
  }

  if (primaryPhone || primaryEmail) {
    parts.push(
      serviceList.length
        ? "Customers can contact the business directly."
        : "Direct contact is available."
    );
  }

  return sanitizeSummaryText(parts.join(" "), {
    companyName,
    max: 420,
    short: true,
  });
}

function buildDeterministicSummaryLong({
  companyName = "",
  services = [],
  aboutSection = "",
  primaryPhone = "",
  primaryEmail = "",
  primaryAddress = "",
}) {
  const cleanAbout = sanitizeSummaryText(aboutSection, {
    companyName,
    max: 1200,
    short: false,
  });
  const parts = [];

  if (cleanAbout) parts.push(cleanAbout);
  if (arr(services).length) {
    parts.push(`The business provides ${arr(services).slice(0, 6).join(", ")}.`);
  }
  if (primaryPhone || primaryEmail) {
    parts.push("Customers can contact the business directly.");
  }
  if (primaryAddress) {
    parts.push(`Location: ${primaryAddress}.`);
  }

  return sanitizeSummaryText(parts.join(" "), {
    companyName,
    max: 1200,
    short: false,
  });
}

function mapSynthesisProfileToBusinessProfile(profile = {}, sourceType = "", sourceUrl = "") {
  const x = obj(profile);
  const reviewFlags = normalizeProfileArrays(x.reviewFlags, 20, 80);
  const fieldConfidence = isPlainObject(x.fieldConfidence) ? obj(x.fieldConfidence) : {};

  const companyName = pickFirstSanitized(
    buildCompanyNameCandidates(x),
    sanitizeCompanyName
  );

  const websiteUrl = cleanDisplayText(
    x.websiteUrl || x.website || (sourceType === "website" ? sourceUrl : ""),
    320
  );

  const primaryPhone = pickFirstSanitized(
    [x.primaryPhone, x.phone, ...arr(x.phones)],
    sanitizePhoneText
  );
  const primaryEmail = pickFirstSanitized(
    [x.primaryEmail, x.email, ...arr(x.emails)],
    sanitizeEmailText
  );
  const primaryAddress = pickFirstSanitized(
    [x.primaryAddress, x.address, ...arr(x.addresses)],
    sanitizeAddressText
  );

  const mainLanguage = resolveMainLanguage(x);

  const services = normalizeDraftServiceList(
    [...arr(x.services), ...arr(x.products)],
    companyName
  );
  const products = normalizeProfileArrays(x.products, 12, 180);
  const pricingHints = normalizePricingHints(x.pricingHints);
  const pricingPolicy = sanitizePolicyText(x.pricingPolicy || x.pricingText || "");
  const supportMode = cleanDisplayText(x.supportMode, 220);
  const hours = normalizeProfileArrays(x.hours, 10, 180);
  const socialLinks = normalizeDraftSocialLinks(x.socialLinks);
  const whatsappLinks = normalizeProfileArrays(x.whatsappLinks, 8, 260);
  const bookingLinks = normalizeProfileArrays(x.bookingLinks, 10, 260);
  const faqItems = normalizeDraftFaqItems(x.faqItems);
  const deterministicSummaryOnly = shouldPreferDeterministicSummary({
    fieldConfidence,
    reviewFlags,
  });

  const companySummaryShort =
    pickFirstSanitized(
      deterministicSummaryOnly
        ? [x.aboutSection]
        : [
            x.companySummaryShort,
            x.summaryShort,
            x.shortDescription,
            x.description,
            x.aboutSection,
          ],
      (value) =>
        sanitizeSummaryText(value, {
          companyName,
          max: 420,
          short: true,
        })
    ) ||
    buildDeterministicSummaryShort({
      companyName,
      services,
      aboutSection: x.aboutSection,
      primaryPhone,
      primaryEmail,
    });

  const companySummaryLong =
    pickFirstSanitized(
      deterministicSummaryOnly
        ? [x.aboutSection]
        : [
            x.companySummaryLong,
            x.summaryLong,
            x.description,
            x.aboutSection,
            x.companySummaryShort,
            x.summaryShort,
          ],
      (value) =>
        sanitizeSummaryText(value, {
          companyName,
          max: 1200,
          short: false,
        })
    ) ||
    buildDeterministicSummaryLong({
      companyName,
      services,
      aboutSection: x.aboutSection,
      primaryPhone,
      primaryEmail,
      primaryAddress,
    });

  const supportedLanguages = normalizeProfileArrays(
    arr(x.supportedLanguages).length ? x.supportedLanguages : [mainLanguage],
    8,
    24
  );

  return compactObject({
    companyName,
    displayName: cleanDisplayText(x.displayName || companyName, 160),
    companyTitle: cleanDisplayText(x.companyTitle || companyName, 160),

    websiteUrl,
    primaryPhone,
    primaryEmail,
    primaryAddress,

    companySummaryShort,
    companySummaryLong,
    summaryShort: cleanDisplayText(x.summaryShort || companySummaryShort, 420),
    summaryLong: cleanDisplayText(x.summaryLong || companySummaryLong, 1200),

    services,
    products,
    pricingHints,
    pricingPolicy,
    supportMode,
    hours,

    socialLinks,
    whatsappLinks,
    bookingLinks,
    faqItems,

    mainLanguage,
    primaryLanguage: cleanDisplayText(x.primaryLanguage || mainLanguage, 24),
    supportedLanguages,

    reviewRequired: !!x.reviewRequired,
    reviewFlags,
    fieldConfidence,

    sourceType: cleanDisplayText(sourceType, 24),
    sourceUrl: cleanDisplayText(sourceUrl, 320),
    googleMapsSeedUrl:
      sourceType === "google_maps" ? cleanDisplayText(sourceUrl, 320) : "",

    // frontend-friendly aliases
    name: companyName,
    description: companySummaryLong || companySummaryShort,
    shortDescription: companySummaryShort,
    website: websiteUrl,
    phone: primaryPhone,
    email: primaryEmail,
    address: primaryAddress,
    language: mainLanguage,
    pricingText: pricingPolicy || pricingHints.join(" | "),
    social: socialLinks.map((item) => item.platform),
    socialUrls: socialLinks.map((item) => item.url),
  });
}

function sanitizeFieldSources(fieldSources = {}, businessProfile = {}) {
  const safeSources = {};

  for (const [field, source] of Object.entries(obj(fieldSources))) {
    if (!s(businessProfile[field])) continue;
    safeSources[field] = obj(source);
  }

  return safeSources;
}

export function sanitizeSetupBusinessProfile(businessProfile = {}) {
  const current = obj(businessProfile);
  const safeCompanyName = sanitizeCompanyName(
    current.companyName || current.displayName || current.companyTitle
  );

  const nextBusinessProfile = compactObject({
    ...current,
    companyName: safeCompanyName,
    displayName: sanitizeCompanyName(
      current.displayName || current.companyName || current.companyTitle
    ),
    companyTitle: sanitizeCompanyName(
      current.companyTitle || current.companyName || current.displayName
    ),
    primaryPhone: sanitizePhoneText(current.primaryPhone || current.phone),
    primaryEmail: sanitizeEmailText(current.primaryEmail || current.email),
    primaryAddress: sanitizeAddressText(current.primaryAddress || current.address),
    companySummaryShort: sanitizeSummaryText(
      current.companySummaryShort || current.summaryShort,
      {
        companyName: safeCompanyName,
        max: 420,
        short: true,
      }
    ),
    companySummaryLong: sanitizeSummaryText(
      current.companySummaryLong || current.summaryLong || current.description,
      {
        companyName: safeCompanyName,
        max: 1200,
        short: false,
      }
    ),
  });

  if (Object.keys(obj(current.fieldSources)).length) {
    nextBusinessProfile.fieldSources = sanitizeFieldSources(
      current.fieldSources,
      nextBusinessProfile
    );
  }

  return nextBusinessProfile;
}

export function sanitizeSetupReviewDraft(draft = {}) {
  const current = obj(draft);
  const nextBusinessProfile = sanitizeSetupBusinessProfile(current.businessProfile);
  const nextDraftPayload = mergeDeep(obj(current.draftPayload), {
    profile: sanitizeSetupBusinessProfile(obj(current.draftPayload?.profile)),
  });

  return {
    ...current,
    businessProfile: nextBusinessProfile,
    draftPayload: nextDraftPayload,
  };
}

export function isPollutedFailedReviewDraft(review = {}) {
  const warnings = arr(review?.draft?.warnings).map((item) => lower(item));
  const hasFailureWarning = warnings.some((item) => FAILURE_WARNING_TOKENS.has(item));
  if (!hasFailureWarning) return false;

  const businessProfile = obj(review?.draft?.businessProfile);
  return !!(
    isPlaceholderCompanyName(
      businessProfile.companyName || businessProfile.displayName || businessProfile.companyTitle
    ) ||
    isPlaceholderPhone(businessProfile.primaryPhone || businessProfile.phone) ||
    isPlaceholderEmail(businessProfile.primaryEmail || businessProfile.email) ||
    isPlaceholderAddress(businessProfile.primaryAddress || businessProfile.address) ||
    looksLikeGoogleMapsPlaceholder(
      businessProfile.companySummaryShort ||
        businessProfile.companySummaryLong ||
        businessProfile.summaryShort ||
        businessProfile.summaryLong
    )
  );
}

function stripSourceDerivedDraftItems(list = []) {
  return arr(list).filter((item) => s(item?.origin) !== "setup_review_candidate");
}

export function normalizeCandidateLike(item = {}) {
  const x = obj(item);

  return {
    id: s(x.id),
    sourceId: s(x.sourceId || x.source_id),
    sourceRunId: s(x.sourceRunId || x.source_run_id || x.sourceRunID),
    candidateGroup: s(x.candidateGroup || x.candidate_group || "general"),
    category: s(x.category),
    itemKey: s(x.itemKey || x.item_key),
    title: s(x.title),
    valueText: s(x.valueText || x.value_text),
    valueJson: obj(x.valueJson || x.value_json),
    normalizedText: s(x.normalizedText || x.normalized_text),
    normalizedJson: obj(x.normalizedJson || x.normalized_json),
    confidence:
      typeof x.confidence === "number" ? x.confidence : Number(x.confidence || 0) || 0,
    confidenceLabel: s(x.confidenceLabel || x.confidence_label),
    status: s(x.status || "pending"),
    reviewReason: s(x.reviewReason || x.review_reason),
    sourceEvidenceJson: arr(x.sourceEvidenceJson || x.source_evidence_json),
    extractionMethod: s(x.extractionMethod || x.extraction_method || "ai"),
    extractionModel: s(x.extractionModel || x.extraction_model),
  };
}

export function isServiceLikeCandidate(item = {}) {
  const text = `${lower(item.category)} ${lower(item.candidateGroup)} ${lower(item.title)}`;
  return (
    text.includes("service") ||
    text.includes("product") ||
    text.includes("menu") ||
    text.includes("package") ||
    text.includes("offering") ||
    text.includes("offer")
  );
}

function chooseCandidateTitle(candidate = {}) {
  const jsonQuestion = s(candidate.valueJson?.question || candidate.normalizedJson?.question);
  const jsonPlatform = s(candidate.valueJson?.platform || candidate.normalizedJson?.platform);

  if (jsonQuestion) return cleanDisplayText(jsonQuestion, 220);

  if (jsonPlatform && /social_link/i.test(candidate.category)) {
    return cleanDisplayText(`${jsonPlatform} link`, 120);
  }

  const genericTitle = isGenericDraftLabel(candidate.title);

  const primary = genericTitle
    ? s(candidate.valueText || candidate.normalizedText || candidate.itemKey)
    : s(candidate.title || candidate.valueText || candidate.normalizedText || candidate.itemKey);

  return stripLeadLabels(primary);
}

function normalizeServiceTitle(candidate = {}) {
  const genericTitle = isGenericDraftLabel(candidate.title);
  const titleSource = genericTitle
    ? s(candidate.valueText || candidate.normalizedText || candidate.itemKey)
    : s(candidate.title || candidate.valueText || candidate.normalizedText || candidate.itemKey);

  return stripLeadLabels(titleSource);
}

function shouldRejectKnowledgeCandidate(candidate = {}) {
  const category = lower(candidate.category || candidate.candidateGroup);
  const raw = cleanDisplayText(
    [
      candidate.title,
      candidate.valueText,
      candidate.normalizedText,
      candidate.valueJson?.question,
      candidate.valueJson?.answer,
    ]
      .filter(Boolean)
      .join(" | "),
    1200
  );

  if (!raw) return true;
  if (looksLikeGoogleMapsPlaceholder(raw)) return true;
  if (looksLikeNavMenuGarbage(raw)) return true;
  if (isLikelyTestimonialOrPromo(raw)) return true;

  if (category.includes("policy")) {
    if (!sanitizePolicyText(raw)) return true;
  }

  if (category.includes("faq")) {
    const question = cleanDisplayText(
      candidate.valueJson?.question ||
        candidate.normalizedJson?.question ||
        candidate.title,
      220
    );

    if (!question || !isLikelyFaqQuestion(question)) return true;
  }

  return false;
}

function buildDraftServicesFromCandidate(item = {}, sourceType = "") {
  const candidate = normalizeCandidateLike(item);
  const seedTitle = normalizeServiceTitle(candidate);
  const exploded = explodeServiceText(seedTitle, "");

  const out = [];
  let index = 0;

  for (const title of exploded) {
    const key =
      s(candidate.itemKey)
        ? `${s(candidate.itemKey)}_${index + 1}`
        : normalizeDraftKey(
            `${candidate.category || candidate.candidateGroup || "service"}_${title}`,
            "service"
          );

    out.push({
      key,
      title,
      description: "",
      category: s(candidate.category || candidate.candidateGroup || "service"),
      valueJson: obj(candidate.valueJson),
      normalizedJson: obj(candidate.normalizedJson),
      confidence: Number(candidate.confidence || 0),
      confidenceLabel: s(candidate.confidenceLabel),
      status: s(candidate.status || "pending"),
      reviewReason: s(candidate.reviewReason),
      sourceId: s(candidate.sourceId),
      sourceRunId: s(candidate.sourceRunId),
      sourceType: s(sourceType),
      evidence: arr(candidate.sourceEvidenceJson),
      origin: "setup_review_candidate",
    });

    index += 1;
  }

  return out;
}

export function buildDraftServiceFromCandidate(item = {}, sourceType = "") {
  return buildDraftServicesFromCandidate(item, sourceType)[0] || null;
}

export function buildDraftKnowledgeFromCandidate(item = {}, sourceType = "") {
  const candidate = normalizeCandidateLike(item);
  if (shouldRejectKnowledgeCandidate(candidate)) return null;

  const title = chooseCandidateTitle(candidate);
  if (!title) return null;

  const valueText = cleanDisplayText(
    candidate.valueText || candidate.normalizedText || candidate.valueJson?.answer,
    700
  );

  const key =
    s(candidate.itemKey) ||
    normalizeDraftKey(
      `${candidate.category || candidate.candidateGroup || "knowledge"}_${title}`,
      "knowledge"
    );

  return {
    key,
    category: s(candidate.category || candidate.candidateGroup || "general"),
    title,
    valueText,
    valueJson: obj(candidate.valueJson),
    normalizedText: cleanDisplayText(candidate.normalizedText, 320),
    normalizedJson: obj(candidate.normalizedJson),
    confidence: Number(candidate.confidence || 0),
    confidenceLabel: s(candidate.confidenceLabel),
    status: s(candidate.status || "pending"),
    reviewReason: s(candidate.reviewReason),
    sourceId: s(candidate.sourceId),
    sourceRunId: s(candidate.sourceRunId),
    sourceType: s(sourceType),
    evidence: arr(candidate.sourceEvidenceJson),
    origin: "setup_review_candidate",
  };
}

export function mergeDraftItems(existing = [], incoming = [], keyFields = ["key", "title"]) {
  const map = new Map();

  for (const item of arr(existing)) {
    const x = obj(item);
    const stableKey =
      keyFields.map((field) => lower(x[field])).filter(Boolean).join("|") ||
      lower(JSON.stringify(x));

    if (!stableKey) continue;
    map.set(stableKey, cloneJson(x, {}));
  }

  for (const item of arr(incoming)) {
    const x = obj(item);
    const stableKey =
      keyFields.map((field) => lower(x[field])).filter(Boolean).join("|") ||
      lower(JSON.stringify(x));

    if (!stableKey) continue;

    if (!map.has(stableKey)) {
      map.set(stableKey, cloneJson(x, {}));
      continue;
    }

    map.set(stableKey, mergeDeep(map.get(stableKey), x));
  }

  return [...map.values()];
}

export function createSetupReviewCollector({ reviewSessionId = "", sourceType = "" } = {}) {
  return {
    reviewSessionId: s(reviewSessionId),
    sourceType: s(sourceType),
    profilePatch: {},
    capabilitiesPatch: {},
    candidates: [],
    observations: [],
    snapshot: {},
    lastSnapshotId: null,
    snapshotCount: 0,
    observationCount: 0,
    candidateCount: 0,
  };
}

export function buildDraftPayloadFromResult({
  session = {},
  result = {},
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  intakeContext = {},
  collector = {},
}) {
  const warnings = uniqStrings(arr(result?.warnings).map((x) => cleanDisplayText(x, 220)));
  const snapshot = obj(result?.snapshot);
  const extracted = obj(result?.extracted);
  const signals = obj(result?.signals);
  const profile = mapSynthesisProfileToBusinessProfile(
    obj(result?.profile),
    sourceType,
    sourceUrl
  );

  return compactObject({
    draftMode: "setup_review_session",
    requestId: s(requestId),
    reviewSessionId: s(session.id),
    sourceType: s(sourceType),
    sourceLabel: sourceTypeLabel(sourceType),
    sourceAuthorityClass: sourceAuthorityClass(sourceType),
    sourceUrl: s(sourceUrl),
    latestImport: {
      at: nowIso(),
      mode: s(result?.mode || "success"),
      partial: lower(result?.mode) === "partial",
      stage: s(result?.stage),
      warningCount: warnings.length,
      candidateCount: Number(
        result?.candidateCount ||
          result?.candidatesCreated ||
          collector?.candidateCount ||
          0
      ),
      observationCount: Number(collector?.observationCount || 0),
      snapshotCount: Number(collector?.snapshotCount || 0),
    },
    intakeContext: obj(intakeContext),
    profile,
    signals,
    extracted,
    snapshot,
    reviewRequired: !!profile.reviewRequired,
    reviewFlags: arr(profile.reviewFlags),
    fieldConfidence: obj(profile.fieldConfidence),
  });
}

export function calculateCompleteness({
  businessProfile = {},
  services = [],
  knowledgeItems = [],
  warnings = [],
}) {
  const profile = compactObject(businessProfile);
  const serviceCount = arr(services).length;
  const knowledgeCount = arr(knowledgeItems).length;
  const profileScore = Object.keys(profile).length ? 1 : 0;
  const serviceScore = serviceCount > 0 ? 1 : 0;
  const knowledgeScore = knowledgeCount > 0 ? 1 : 0;
  const totalScore = profileScore + serviceScore + knowledgeScore;

  return {
    hasBusinessProfile: profileScore === 1,
    hasServices: serviceScore === 1,
    hasKnowledge: knowledgeScore === 1,
    serviceCount,
    knowledgeCount,
    warningCount: arr(warnings).length,
    score: totalScore,
    maxScore: 3,
  };
}

export function calculateConfidenceSummary({ services = [], knowledgeItems = [] }) {
  const items = [...arr(services), ...arr(knowledgeItems)];
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const item of items) {
    const conf = Number(item?.confidence || 0);
    if (conf >= 0.8) high += 1;
    else if (conf >= 0.5) medium += 1;
    else low += 1;
  }

  return {
    itemCount: items.length,
    high,
    medium,
    low,
  };
}

export function buildSourceSummary({
  existing = {},
  source = {},
  run = {},
  session = {},
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  intakeContext = {},
  collector = {},
  result = {},
}) {
  const current = obj(existing);
  const imports = arr(current.imports);

  const nextImport = compactObject({
    at: nowIso(),
    requestId: s(requestId),
    sourceType: s(sourceType),
    sourceLabel: sourceTypeLabel(sourceType),
    sourceAuthorityClass: sourceAuthorityClass(sourceType),
    sourceUrl: s(sourceUrl),
    sourceId: source?.id || null,
    runId: run?.id || null,
    mode: s(result?.mode || "success"),
    stage: s(result?.stage),
    warningCount: arr(result?.warnings).length,
    candidateCount: Number(
      result?.candidateCount ||
        result?.candidatesCreated ||
        collector?.candidateCount ||
        0
    ),
    observationCount: Number(collector?.observationCount || 0),
    lastSnapshotId: collector?.lastSnapshotId || null,
  });

  return compactObject({
    primarySourceType: s(session?.primarySourceType || sourceType),
    primarySourceId: session?.primarySourceId || source?.id || null,
    primarySourceUrl: s(sourceUrl),
    totalImportedSources: uniqStrings([
      ...arr(current.sourceTypes),
      ...arr(intakeContext?.sourceTypes),
      s(sourceType),
    ]).length,
    sourceTypes: uniqStrings([
      ...arr(current.sourceTypes),
      ...arr(intakeContext?.sourceTypes),
      s(sourceType),
    ]),
    latestRequestId: s(requestId),
    latestSourceId: source?.id || null,
    latestRunId: run?.id || null,
    latestSnapshotId: collector?.lastSnapshotId || null,
    latestImport: nextImport,
    imports: [...imports.slice(-9), nextImport],
  });
}

export function buildDiffFromCanonical({
  existing = {},
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  result = {},
  collector = {},
}) {
  const profile = obj(result?.profile);

  return mergeDeep(obj(existing), {
    pendingReview: true,
    lastDraftAt: nowIso(),
    latestRequestId: s(requestId),
    latestSourceType: s(sourceType),
    latestSourceUrl: s(sourceUrl),
    latestMode: s(result?.mode || "success"),
    latestStage: s(result?.stage),
    warningCount: arr(result?.warnings).length,
    candidateCount: Number(
      result?.candidateCount ||
        result?.candidatesCreated ||
        collector?.candidateCount ||
        0
    ),
    lastSnapshotId: collector?.lastSnapshotId || null,
    reviewRequired: !!profile.reviewRequired,
    reviewFlags: normalizeProfileArrays(profile.reviewFlags, 20, 80),
    fieldConfidence: isPlainObject(profile.fieldConfidence) ? obj(profile.fieldConfidence) : {},
  });
}

export function deriveDraftPatch({
  currentDraft = {},
  session = {},
  source = {},
  run = {},
  result = {},
  requestId = "",
  sourceType = "",
  sourceUrl = "",
  intakeContext = {},
  collector = {},
}) {
  const current = obj(currentDraft);

  const currentSourceType = s(
    current?.sourceSummary?.latestImport?.sourceType ||
      current?.sourceSummary?.primarySourceType
  );

  const currentSourceUrl = s(
    current?.sourceSummary?.latestImport?.sourceUrl ||
      current?.sourceSummary?.primarySourceUrl
  );

  const sameSourceSession =
    currentSourceType &&
    currentSourceUrl &&
    currentSourceType === s(sourceType) &&
    currentSourceUrl === s(sourceUrl);

  const derivedServices = arr(collector?.candidates)
    .flatMap((item) =>
      isServiceLikeCandidate(item) ? buildDraftServicesFromCandidate(item, sourceType) : []
    )
    .filter(Boolean);

  const derivedKnowledge = arr(collector?.candidates)
    .map((item) =>
      isServiceLikeCandidate(item) ? null : buildDraftKnowledgeFromCandidate(item, sourceType)
    )
    .filter(Boolean);

  const sourceProfilePatch = mapSynthesisProfileToBusinessProfile(
    obj(result?.profile),
    sourceType,
    sourceUrl
  );

  const businessProfile = compactObject(
    mergeDeep(
      {},
      obj(collector?.profilePatch),
      sourceProfilePatch
    )
  );

  const capabilities = compactObject(
    mergeDeep(
      {},
      obj(collector?.capabilitiesPatch),
      obj(result?.signals?.capabilities),
      isPlainObject(result?.signals) ? obj(result?.signals) : {}
    )
  );

  const preservedServices = sameSourceSession
    ? stripSourceDerivedDraftItems(arr(current.services))
    : [];

  const preservedKnowledgeItems = sameSourceSession
    ? stripSourceDerivedDraftItems(arr(current.knowledgeItems))
    : [];

  const services = mergeDraftItems(preservedServices, derivedServices, ["key", "title"]);

  const knowledgeItems = mergeDraftItems(
    preservedKnowledgeItems,
    derivedKnowledge,
    ["key", "title", "category"]
  );

  const warnings = uniqStrings(arr(result?.warnings).map((x) => cleanDisplayText(x, 220)));

  const sourceSummary = buildSourceSummary({
    existing: sameSourceSession ? obj(current.sourceSummary) : {},
    source,
    run,
    session,
    requestId,
    sourceType,
    sourceUrl,
    intakeContext,
    collector,
    result,
  });

  const draftPayload = buildDraftPayloadFromResult({
    session,
    result,
    requestId,
    sourceType,
    sourceUrl,
    intakeContext,
    collector,
  });

  const completeness = calculateCompleteness({
    businessProfile,
    services,
    knowledgeItems,
    warnings,
  });

  const confidenceSummary = calculateConfidenceSummary({
    services,
    knowledgeItems,
  });

  const diffFromCanonical = buildDiffFromCanonical({
    existing: sameSourceSession ? obj(current.diffFromCanonical) : {},
    requestId,
    sourceType,
    sourceUrl,
    result,
    collector,
  });

  return {
    draftPayload,
    businessProfile,
    capabilities,
    services,
    knowledgeItems,
    channels: sameSourceSession ? arr(current.channels) : [],
    sourceSummary,
    warnings,
    completeness,
    confidenceSummary,
    diffFromCanonical,
    lastSnapshotId: collector?.lastSnapshotId || current.lastSnapshotId || null,
  };
}

export const __test__ = {
  buildCompanyNameCandidates,
  buildDeterministicSummaryLong,
  buildDeterministicSummaryShort,
  mapSynthesisProfileToBusinessProfile,
  pickFirstSanitized,
  readFieldConfidenceScore,
  shouldPreferDeterministicSummary,
};
