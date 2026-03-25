// src/services/sourceSync/websiteHelpers.js
// FINAL v6.0 — stronger website synthesis + safer multilingual draft shaping
// focus:
// - strict address/testimonial/promo separation
// - safer service extraction and dedupe
// - concise pricing extraction
// - source-language-aware generated strings
// - cleaner setup review draft inputs

import {
  arr,
  cleanInlineText,
  cleanSummaryText,
  compactText,
  dedupeSentences,
  dedupeTextList,
  mergeLines,
  normalizeCompareText,
  normalizeListItem,
  normalizeSummaryPart,
  obj,
  shouldKeepTextCandidate,
  uniq,
  uniqBy,
  isNearDuplicateText,
} from "./shared.js";

const WEBSITE_CRAWL_VERSION = "website_raw_v6_0";
const SOURCE_SYNC_VERSION = "source_sync_v8_0";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function clamp(nv, a, b) {
  const x = Number(nv);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "proton.me",
  "protonmail.com",
]);

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "org.nz",
  "com.br",
  "com.tr",
  "co.jp",
]);

const GENERIC_MAPS_TEXT_RE =
  /\b(find local businesses|view maps|get driving directions|google maps)\b/i;

const TESTIMONIAL_RE =
  /\b(məsləhət gör(ürəm|erem)?|meslehet gor(urem|erem)?|razi qald(ıq|im)?|razı qald(ıq|ım)?|razi sald[iı]m|razı sald[ıi]m|gözlədiyim|gozlediyim|komandası|komandasi|təqdim etdi|teqdim etdi|maraq göstərdilər|maraq gosterdiler|recommend|recommended|testimonial|review|satisfied|very satisfied|great job|thank you|professional team)\b/i;

const ADDRESS_LABEL_RE =
  /\b(address|office|location|ünvan|unvan|filial|branch|street|st\.?|avenue|ave|road|rd\.?|floor|building|blok|bina|suite|apt|apartment|küçə|kuce|kucesi|küçəsi|prospekt|pr\.?|district|rayon)\b/i;

const ADDRESS_STRONG_RE =
  /\b(street|st\.?|avenue|ave|road|rd\.?|floor|building|blok|bina|suite|apt|apartment|küçə|kuce|kucesi|küçəsi|prospekt|pr\.?|rayon|district|office)\b/i;

const ADDRESS_CITY_RE =
  /\b(baku|bakı|azerbaijan|azərbaycan|sumqayıt|sumqayit|ganja|gəncə|goygol|mingəçevir|mingecevir|nakhchivan|naxçıvan|naxcivan)\b/i;

const GENERIC_SERVICE_KEYS = new Set([
  "service",
  "services",
  "service network",
  "xidmet",
  "xidmetler",
  "xidmet sebekesi",
  "xidmət",
  "xidmətlər",
  "xidmət şəbəkəsi",
  "uslugi",
  "услуги",
  "offerings",
  "solutions",
]);

const NAV_NOISE_RE =
  /\b(home|about|contact|contacts|faq|pricing|price|blog|portfolio|projects|team|careers|login|sign in|register|read more|discover|learn more|get started|book now|view more|see all|request quote|menu|skip to content|anasəhifə|ana səhifə|haqqımızda|elaqe|əlaqə|qiymət|qiymet|xidmetler|xidmətlər|blog|layihələr|layiheler)\b/i;

const PROMO_NOISE_RE =
  /\b(custom quote|request quote|timeline|days|gün|gun|project complexity|complexity|requirements|meta tags|structured data|performance optimization|most common questions|answers to the most common questions)\b/i;

const SOCIAL_HOST_RE =
  /\b(instagram\.com|facebook\.com|fb\.com|linkedin\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com|pinterest\.com)\b/i;

function deriveRegistrableDomain(host = "") {
  const clean = lower(s(host).replace(/^www\./i, ""));
  const parts = clean.split(".").filter(Boolean);

  if (parts.length <= 2) return clean;

  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");

  if (COMMON_SECOND_LEVEL_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return lastThree;
  }

  return lastTwo;
}

function parseUrlInfo(url = "") {
  try {
    const u = new URL(s(url));
    const host = lower(s(u.host).replace(/^www\./i, ""));

    return {
      host,
      registrableDomain: deriveRegistrableDomain(host),
      pathname: s(u.pathname || "/"),
      url: u.toString(),
    };
  } catch {
    return {
      host: "",
      registrableDomain: "",
      pathname: "",
      url: s(url),
    };
  }
}

function tokenizeMeaningfulText(text = "") {
  return uniq(
    lower(cleanInlineText(text))
      .replace(/[^0-9a-zA-ZƏəĞğİıÖöŞşÜüÇç-]+/g, " ")
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(
        (x) =>
          x &&
          x.length >= 3 &&
          ![
            "the",
            "and",
            "for",
            "with",
            "from",
            "your",
            "our",
            "you",
            "biz",
            "ve",
            "ilə",
            "ile",
            "haqqında",
            "haqqinda",
            "services",
            "service",
            "about",
            "contact",
            "home",
            "page",
            "official",
            "website",
            "group",
            "company",
          ].includes(x)
      )
  );
}

function domainTokens(host = "") {
  return uniq(
    lower(s(host))
      .replace(/^www\./i, "")
      .split(".")
      .map((x) => x.trim())
      .filter(
        (x) =>
          x &&
          x.length >= 2 &&
          ![
            "www",
            "com",
            "net",
            "org",
            "co",
            "io",
            "app",
            "az",
            "biz",
            "site",
            "online",
            "store",
            "shop",
            "info",
            "gov",
            "edu",
            "ac",
          ].includes(x)
      )
  );
}

function getEmailDomain(email = "") {
  const x = lower(s(email));
  const idx = x.lastIndexOf("@");
  if (idx < 0) return "";
  return x.slice(idx + 1);
}

function isFirstPartyEmail(email = "", host = "", registrableDomain = "") {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) return false;
  if (host && emailDomain === host) return true;
  if (registrableDomain && emailDomain.endsWith(registrableDomain)) return true;
  return false;
}

function isGenericMailbox(email = "") {
  return GENERIC_EMAIL_DOMAINS.has(getEmailDomain(email));
}

function isGenericMapsText(text = "") {
  return GENERIC_MAPS_TEXT_RE.test(s(text));
}

function stripLeadingLabel(text = "", labels = []) {
  let value = cleanInlineText(text);

  for (const label of arr(labels)) {
    const escaped = s(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value
      .replace(new RegExp(`^${escaped}\\s*[:|—–-]+\\s*`, "i"), "")
      .replace(new RegExp(`^${escaped}\\s+`, "i"), "")
      .trim();
  }

  return value;
}

function splitStructuredParts(text = "", { allowComma = false } = {}) {
  const value = cleanInlineText(text)
    .replace(/\s*[•·]+\s*/g, " | ")
    .replace(/\s*;\s*/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!value) return [];

  let parts = value
    .split(/\s*\|\s*/)
    .map((x) => cleanInlineText(x))
    .filter(Boolean);

  if (allowComma) {
    parts = parts.flatMap((item) => {
      const safe = cleanInlineText(item);
      const commaCount = (safe.match(/,/g) || []).length;

      if (
        commaCount >= 1 &&
        commaCount <= 6 &&
        safe.length <= 220 &&
        !/[.!?]/.test(safe)
      ) {
        return safe
          .split(/\s*,\s*/)
          .map((x) => cleanInlineText(x))
          .filter(Boolean);
      }

      return [safe];
    });
  }

  return parts.filter(Boolean);
}

function splitIntoSentences(text = "", maxLen = 220) {
  const value = cleanInlineText(text)
    .replace(/\s+/g, " ")
    .replace(/\s*([!?])\s*/g, "$1 ")
    .replace(/\s*([.])\s*/g, "$1 ")
    .trim();

  if (!value) return [];

  const parts = value
    .split(/(?<=[.!?])\s+/)
    .map((x) => compactText(x, maxLen))
    .filter(Boolean);

  if (parts.length) return parts;

  return [compactText(value, maxLen)].filter(Boolean);
}

function detectServiceLine(text = "") {
  return /\b(service|services|solution|solutions|automation|marketing|design|development|consulting|chatbot|crm|seo|branding|website|web site|e-commerce|software|xidmət|xidmet|veb|sayt|reklam|rəqəmsal|digital|smm|landing page|ui\/ux)\b/i.test(
    text
  );
}

function detectProductLine(text = "") {
  return /\b(product|products|platform|tool|tools|package|packages|plan|plans|suite)\b/i.test(
    text
  );
}

function detectPricingLine(text = "") {
  return /(\$|€|£|₼|\bazn\b|\busd\b|\beur\b|\bfrom\b|\bstarting\b|\bstart(?:s|ing)?\b|\bprice\b|\bpricing\b|\bpackage\b|\bplan\b|\bpaket\b|\bqiymət\b|\bqiymet\b|\bquote\b|\bquotation\b)/i.test(
    text
  );
}

function detectPolicyLine(text = "") {
  return /\b(policy|privacy|terms|conditions|refund|return|shipping|cancellation|booking policy|service terms)\b/i.test(
    text
  );
}

function inferPrimaryLanguage(samples = []) {
  const text = lower(arr(samples).filter(Boolean).join(" \n "));
  if (!text) return "en";

  let ru = 0;
  let az = 0;
  let tr = 0;
  let en = 0;

  for (const ch of text) {
    if (/[а-яё]/i.test(ch)) ru += 2;
    if (/[əğıöşüç]/i.test(ch)) az += 2;
  }

  const azWords = [
    "və",
    "üçün",
    "ilə",
    "haqqında",
    "xidmət",
    "xidmətlər",
    "qiymət",
    "ünvan",
    "əlaqə",
    "biz",
    "sayt",
    "hazırlanması",
    "peşəkar",
  ];
  const trWords = [
    "ve",
    "için",
    "hizmet",
    "hizmetler",
    "fiyat",
    "iletişim",
    "tasarım",
    "web sitesi",
    "kurumsal",
  ];
  const enWords = [
    "and",
    "for",
    "services",
    "pricing",
    "contact",
    "about",
    "website",
    "company",
    "digital",
    "development",
  ];

  for (const w of azWords) {
    if (text.includes(w)) az += 3;
  }
  for (const w of trWords) {
    if (text.includes(w)) tr += 3;
  }
  for (const w of enWords) {
    if (text.includes(w)) en += 2;
  }

  const scores = [
    ["az", az],
    ["tr", tr],
    ["ru", ru],
    ["en", en],
  ].sort((a, b) => b[1] - a[1]);

  return scores[0]?.[1] > 0 ? scores[0][0] : "en";
}

function getLocalePack(lang = "en") {
  const normalized = ["az", "tr", "ru", "en"].includes(lang) ? lang : "en";

  const packs = {
    az: {
      pricingCustomQuote: "Custom quote tələb edən xidmətlər mövcuddur.",
      pricingStarting: "Başlanğıc qiymətlər göstərilir, yekun qiymət scope-a görə dəyişə bilər.",
      pricingSignals: "Saytda qiymətləndirmə ilə bağlı siqnallar mövcuddur.",
      pricingBooking: "Yekun qiymət üçün əlaqə və ya booking axını təşviq olunur.",
      supportWhatsapp: "WhatsApp vasitəsilə əlaqə mümkündür.",
      supportBooking: "Booking və ya konsultasiya axını mövcuddur.",
      supportDirect: "Telefon və ya email ilə birbaşa əlaqə mümkündür.",
      summaryServices: "Əsas xidmətlər",
      summaryPricing: "Qiymətlə bağlı siqnallar mövcuddur.",
      summaryContact: "Telefon və ya email ilə əlaqə mümkündür.",
    },
    tr: {
      pricingCustomQuote: "Özel teklif gerektiren hizmetler mevcut.",
      pricingStarting: "Başlangıç fiyatları gösteriliyor, nihai fiyat kapsama göre değişebilir.",
      pricingSignals: "Sitede fiyatlandırma ile ilgili sinyaller bulundu.",
      pricingBooking: "Nihai fiyat için iletişim veya rezervasyon akışı teşvik ediliyor.",
      supportWhatsapp: "WhatsApp üzerinden iletişim mümkün.",
      supportBooking: "Rezervasyon veya danışmanlık akışı mevcut.",
      supportDirect: "Telefon veya e-posta ile doğrudan iletişim mümkün.",
      summaryServices: "Ana hizmetler",
      summaryPricing: "Fiyatlandırma ile ilgili sinyaller mevcut.",
      summaryContact: "Telefon veya e-posta ile iletişim mümkün.",
    },
    ru: {
      pricingCustomQuote: "Есть услуги, для которых требуется индивидуальный расчет.",
      pricingStarting: "Указаны стартовые цены, итоговая стоимость может зависеть от объема работ.",
      pricingSignals: "На сайте есть сигналы о ценообразовании.",
      pricingBooking: "Для итоговой стоимости предлагается связаться или пройти booking flow.",
      supportWhatsapp: "Связь через WhatsApp доступна.",
      supportBooking: "Доступен booking или консультационный flow.",
      supportDirect: "Связаться можно по телефону или email.",
      summaryServices: "Основные услуги",
      summaryPricing: "Есть сигналы, связанные с ценами.",
      summaryContact: "Связаться можно по телефону или email.",
    },
    en: {
      pricingCustomQuote: "Some services require a custom quote.",
      pricingStarting: "Starting prices are shown, but final pricing may vary by scope.",
      pricingSignals: "The website includes pricing-related signals.",
      pricingBooking: "Users are encouraged to contact the business or use a booking flow for final pricing.",
      supportWhatsapp: "Customers can contact the business via WhatsApp.",
      supportBooking: "A booking or consultation flow is available.",
      supportDirect: "Customers can contact the business directly by phone or email.",
      summaryServices: "Core services",
      summaryPricing: "Pricing-related signals are present.",
      summaryContact: "Customers can reach the business by phone or email.",
    },
  };

  return packs[normalized] || packs.en;
}

function normalizeServiceCandidate(text = "") {
  let value = stripLeadingLabel(text, [
    "service",
    "services",
    "xidmət",
    "xidmətlər",
    "xidmet",
    "xidmetler",
    "услуги",
    "offerings",
    "solutions",
  ]);

  value = normalizeListItem(value)
    .replace(/^[:|—–-]+\s*/, "")
    .replace(/\s*[|,:;]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return compactText(value, 160);
}

function isMostlyMetaNoise(text = "") {
  const value = cleanInlineText(text);
  if (!value) return true;
  if (NAV_NOISE_RE.test(value) && !detectServiceLine(value)) return true;
  if (TESTIMONIAL_RE.test(value)) return true;
  if (isGenericMapsText(value)) return true;
  return false;
}

function isServiceNoise(text = "") {
  const value = cleanInlineText(text);
  const key = normalizeCompareText(value);

  if (!value) return true;
  if (!shouldKeepTextCandidate(value, 4)) return true;
  if (GENERIC_SERVICE_KEYS.has(key)) return true;
  if (isMostlyMetaNoise(value)) return true;
  if (/^(contact|about|home|faq|pricing|blog|portfolio|case studies)$/i.test(value)) {
    return true;
  }
  if (
    /\b(network|şəbəkəsi|sebekesi|category|categories|read more|discover|learn more)\b/i.test(
      value
    ) &&
    !detectServiceLine(value)
  ) {
    return true;
  }
  if (/[.!?]/.test(value) && value.split(" ").length > 8) return true;
  if (detectPricingLine(value) && !detectServiceLine(value)) return true;
  if (value.length < 4 || value.length > 90) return true;
  if (PROMO_NOISE_RE.test(value) && value.split(" ").length > 5) return true;

  return false;
}

function expandServiceCandidates(raw = "") {
  const cleaned = stripLeadingLabel(raw, [
    "services",
    "service",
    "xidmətlər",
    "xidmət",
    "xidmetler",
    "xidmet",
    "услуги",
  ]);

  const firstPass = splitStructuredParts(cleaned, { allowComma: true });

  return firstPass
    .flatMap((item) => {
      const safe = cleanInlineText(item);
      const match = safe.match(
        /^(services?|xidmətlər?|xidmetler?|услуги)\s*[—–-]\s*(.+)$/i
      );
      return match?.[2]
        ? splitStructuredParts(match[2], { allowComma: true })
        : [safe];
    })
    .flatMap((item) => {
      const safe = cleanInlineText(item);
      if (safe.length <= 120) return [safe];
      return splitIntoSentences(safe, 120);
    })
    .map(normalizeServiceCandidate)
    .filter(Boolean);
}

function canonicalizeServiceList(items = [], maxItems = 12) {
  const out = [];

  for (const raw of arr(items)) {
    const expanded = expandServiceCandidates(raw);

    for (const candidate of expanded) {
      if (!detectServiceLine(candidate)) continue;
      if (isServiceNoise(candidate)) continue;

      const duplicate = out.some((x) => isNearDuplicateText(x, candidate));
      if (duplicate) continue;

      out.push(candidate);
      if (out.length >= maxItems) return out;
    }
  }

  return out;
}

function canonicalizeProductList(items = [], maxItems = 12) {
  const out = [];

  for (const raw of arr(items)) {
    const expanded = splitStructuredParts(raw, { allowComma: true })
      .map((x) =>
        stripLeadingLabel(x, ["product", "products", "package", "packages", "plans"])
      )
      .map(normalizeListItem)
      .filter(Boolean);

    for (const candidate of expanded) {
      if (!shouldKeepTextCandidate(candidate, 4)) continue;
      if (isMostlyMetaNoise(candidate)) continue;
      if (detectPricingLine(candidate) && !detectProductLine(candidate)) continue;
      if (candidate.length > 90) continue;

      const duplicate = out.some((x) => isNearDuplicateText(x, candidate));
      if (duplicate) continue;

      out.push(compactText(candidate, 140));
      if (out.length >= maxItems) return out;
    }
  }

  return out;
}

function extractPricingFragments(raw = "") {
  const safe = cleanInlineText(raw);
  if (!safe) return [];

  const parts = splitIntoSentences(safe, 180).flatMap((item) =>
    splitStructuredParts(item, { allowComma: false })
  );

  return parts
    .map((x) => compactText(x, 180))
    .filter(Boolean)
    .filter((x) => detectPricingLine(x))
    .filter((x) => !TESTIMONIAL_RE.test(x))
    .filter((x) => !isGenericMapsText(x))
    .filter((x) => !/\b(find local businesses|view maps|get driving directions)\b/i.test(x))
    .filter((x) => !/^answers to the most common questions/i.test(x));
}

function cleanPricingHintsList(items = [], maxItems = 6) {
  const out = [];

  for (const raw of arr(items)) {
    const fragments = extractPricingFragments(raw);

    for (const safe of fragments) {
      if (!safe) continue;
      if (safe.length < 12 || safe.length > 180) continue;
      if (
        /\b(days|gün|gun|timeline|project complexity|requirements)\b/i.test(safe) &&
        !/\b(price|pricing|quote|qiymət|qiymet|paket|package|from|starting)\b/i.test(safe)
      ) {
        continue;
      }

      const duplicate = out.some((x) => isNearDuplicateText(x, safe));
      if (duplicate) continue;

      out.push(safe);
      if (out.length >= maxItems) return out;
    }
  }

  return out;
}

function cleanPolicyHighlights(items = [], maxItems = 8) {
  const out = [];

  for (const raw of arr(items)) {
    const safe = compactText(cleanInlineText(raw), 220);
    if (!safe) continue;
    if (!detectPolicyLine(safe)) continue;
    if (isMostlyMetaNoise(safe)) continue;

    const duplicate = out.some((x) => isNearDuplicateText(x, safe));
    if (duplicate) continue;

    out.push(safe);
    if (out.length >= maxItems) break;
  }

  return out;
}

function looksLikeAddress(raw = "", { relaxed = false } = {}) {
  const original = cleanInlineText(raw);
  const value = compactText(original, 220);

  if (!value) return false;
  if (value.length < 10 || value.length > 220) return false;
  if (TESTIMONIAL_RE.test(value)) return false;
  if (isGenericMapsText(value)) return false;
  if (PROMO_NOISE_RE.test(value)) return false;
  if (
    /\b(recommend|məsləhət|meslehet|satisfied|project|layihə|layihe|seo|design|website|vebsayt|hazırlanması|hazirlanmasi|corporate websites|landing pages)\b/i.test(
      value
    )
  ) {
    return false;
  }

  const hasLabel = ADDRESS_LABEL_RE.test(original);
  const hasStrongAddressSignal = ADDRESS_STRONG_RE.test(value);
  const hasStreetNumberCombo =
    /\b\d{1,4}[a-z]?\b/i.test(value) &&
    /\b(street|st\.?|ave|avenue|road|rd\.?|building|blok|bina|suite|apt|apartment|küçə|kuce|kucesi|küçəsi|prospekt|pr\.?)\b/i.test(
      value
    );
  const hasCityOnly =
    ADDRESS_CITY_RE.test(value) &&
    !/[.!?]/.test(value) &&
    value.split(/\s+/).length <= 7;

  if (!(hasLabel || hasStrongAddressSignal || hasStreetNumberCombo || hasCityOnly)) {
    return false;
  }

  if (!relaxed && /[.!?].*[.!?]/.test(value)) return false;
  if (value.split(/\s+/).length > 18) return false;

  return true;
}

function cleanAddressList(items = [], maxItems = 4) {
  const out = [];

  for (const raw of arr(items)) {
    const original = cleanInlineText(raw);
    let value = stripLeadingLabel(original, [
      "address",
      "ünvan",
      "unvan",
      "location",
      "office",
      "branch",
      "filial",
    ]);

    value = compactText(cleanInlineText(value), 220);
    if (!looksLikeAddress(original, { relaxed: false })) continue;

    const duplicate = out.some((x) => isNearDuplicateText(x, value));
    if (duplicate) continue;

    out.push(value);
    if (out.length >= maxItems) break;
  }

  return out;
}

function cleanFaqItems(items = [], maxItems = 12) {
  const out = [];

  for (const raw of arr(items)) {
    const question = compactText(cleanInlineText(raw?.question), 180);
    const answer = compactText(cleanInlineText(raw?.answer), 520);

    if (!question || question.length < 6) continue;
    if (isMostlyMetaNoise(question)) continue;
    if (/^(question|faq)$/i.test(question)) continue;

    const duplicate = out.some(
      (x) =>
        normalizeCompareText(x.question) === normalizeCompareText(question) ||
        isNearDuplicateText(x.question, question)
    );
    if (duplicate) continue;

    out.push({
      question,
      answer,
    });

    if (out.length >= maxItems) break;
  }

  return out;
}

function cleanSocialLinks(items = [], maxItems = 12) {
  return uniqBy(
    arr(items)
      .map((item) => ({
        platform: lower(item?.platform),
        url: compactText(cleanInlineText(item?.url), 240),
      }))
      .filter((item) => item.platform && item.url)
      .filter((item) => /^https?:\/\//i.test(item.url))
      .filter((item) => SOCIAL_HOST_RE.test(item.url))
      .filter((item) => !/\bshare|intent|sharer|dialog\b/i.test(item.url)),
    (item) => `${item.platform}|${lower(item.url)}`
  ).slice(0, maxItems);
}

function cleanUrlList(list = [], maxItems = 12) {
  const out = [];

  for (const raw of arr(list)) {
    const value = compactText(cleanInlineText(raw), 260);
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) continue;

    const duplicate = out.some((x) => lower(x) === lower(value));
    if (duplicate) continue;

    out.push(value);
    if (out.length >= maxItems) break;
  }

  return out;
}

function isSummaryNoise(text = "") {
  const value = cleanInlineText(text);
  if (!value) return true;
  if (isMostlyMetaNoise(value)) return true;
  if (/^(home|about|services|contact|faq|pricing)$/i.test(value)) return true;
  if (/\b(phone|email|address|website)\b/i.test(value) && value.split(" ").length <= 5) {
    return true;
  }
  if (value.length < 30) return true;
  if (/[|]/.test(value) && splitStructuredParts(value, { allowComma: true }).length >= 3) {
    return true;
  }
  if (detectPricingLine(value) && value.length > 90) return true;
  if (PROMO_NOISE_RE.test(value)) return true;
  if (
    /\b(simple landing pages|corporate websites|e-commerce projects|timeline may vary)\b/i.test(
      value
    )
  ) {
    return true;
  }
  return false;
}

function scoreSummaryLine(text = "") {
  const x = cleanInlineText(text);
  if (!x || isSummaryNoise(x)) return 0;

  let score = 0;
  if (x.length >= 50) score += 1;
  if (x.length >= 90) score += 1;
  if (/[.!?]/.test(x)) score += 1;
  if (
    /\b(we|our|company|team|mission|vision|brand|agency|studio|business|platform|service|solution|client|customer|biz|sayt|vebsayt|rəqəmsal|digital|about|haqqımızda|haqqimizda)\b/i.test(
      x
    )
  ) {
    score += 2;
  }
  if (detectServiceLine(x)) score += 1;
  if (detectPricingLine(x)) score -= 3;
  if (PROMO_NOISE_RE.test(x)) score -= 4;
  if (x.length > 240) score -= 1;

  return score;
}

function pickBestSummaryLines(lines = [], limit = 4) {
  const scored = arr(lines)
    .map((text) => {
      const cleaned = compactText(cleanSummaryText(text), 500);
      return {
        text: cleaned,
        score: scoreSummaryLine(cleaned),
      };
    })
    .filter((x) => x.text && x.score >= 2)
    .sort((a, b) => b.score - a.score || a.text.length - b.text.length)
    .map((x) => x.text);

  return dedupeTextList(scored, { maxItems: limit, maxText: 500 });
}

function inferPricingPolicy(pricingHints = [], bookingLinks = [], lang = "en") {
  const locale = getLocalePack(lang);
  const joined = pricingHints.join(" | ").toLowerCase();
  if (!joined && !bookingLinks.length) return "";

  if (/\b(custom|quote|request quote|consultation|tailored)\b/i.test(joined)) {
    return locale.pricingCustomQuote;
  }
  if (/\b(from|starting at|starting|paket|package)\b/i.test(joined)) {
    return locale.pricingStarting;
  }
  if (pricingHints.length) {
    return locale.pricingSignals;
  }
  if (bookingLinks.length) {
    return locale.pricingBooking;
  }
  return "";
}

function classifySupportMode({
  phones = [],
  emails = [],
  whatsappLinks = [],
  bookingLinks = [],
  language = "en",
}) {
  const locale = getLocalePack(language);

  if (whatsappLinks.length) return locale.supportWhatsapp;
  if (bookingLinks.length) return locale.supportBooking;
  if (phones.length || emails.length) return locale.supportDirect;
  return "";
}

function pageTypePages(pages = [], type = "") {
  return arr(pages).filter((x) => s(x?.pageType) === type);
}

function normalizeTitleCandidate(text = "") {
  const x = compactText(cleanInlineText(text), 160);
  if (!x) return "";

  if (isGenericMapsText(x)) return "";

  const parts = x
    .split(/\s*[|•·—–-]\s*/)
    .map((item) => compactText(cleanInlineText(item), 100))
    .filter(Boolean)
    .filter((item) => !/^(home|welcome|services|contact|about|pricing|faq)$/i.test(item));

  if (parts.length <= 1) return x;

  const ranked = parts
    .map((item) => ({
      item,
      score:
        (item.length >= 3 && item.length <= 60 ? 2 : 0) +
        (!/\b(home|welcome|services|contact|about|pricing|faq)\b/i.test(item) ? 2 : 0) +
        (/\b(agency|studio|company|clinic|center|group|labs|solutions|digital|academy|shop|store)\b/i.test(
          item
        )
          ? 1
          : 0),
    }))
    .sort((a, b) => b.score - a.score || a.item.length - b.item.length);

  return ranked[0]?.item || x;
}

function buildUniqueSummaryParts(parts = [], { brandHint = "", maxItems = 5 } = {}) {
  const out = [];

  for (const raw of arr(parts)) {
    const text = normalizeSummaryPart(raw, brandHint);
    if (!text) continue;
    if (isSummaryNoise(text)) continue;

    const duplicate = out.some((x) => {
      if (x === text || normalizeCompareText(x) === normalizeCompareText(text)) {
        return true;
      }

      const ax = normalizeCompareText(x);
      const bx = normalizeCompareText(text);

      if (!ax || !bx) return false;

      if (ax.includes(bx) || bx.includes(ax)) {
        const shorter = Math.min(ax.length, bx.length);
        const longer = Math.max(ax.length, bx.length);
        if (shorter >= 24 && shorter / longer >= 0.7) return true;
      }

      return false;
    });

    if (duplicate) continue;

    out.push(text);
    if (out.length >= maxItems) break;
  }

  return out;
}

function buildWebsiteSignals(extracted = {}) {
  const pages = arr(extracted.pages);
  const mainPage = pages[0] || null;

  const siteIdentity = obj(extracted.site?.identitySignals);

  const aboutPages = pageTypePages(pages, "about");
  const servicePages = pageTypePages(pages, "services");
  const pricingPages = pageTypePages(pages, "pricing");
  const faqPages = pageTypePages(pages, "faq");
  const policyPages = pageTypePages(pages, "policy");
  const contactPages = pageTypePages(pages, "contact");
  const bookingPages = pageTypePages(pages, "booking");
  const locationPages = pageTypePages(pages, "locations");
  const supportPages = uniqBy(
    [...faqPages, ...contactPages, ...bookingPages],
    (page) => s(page?.canonicalUrl || page?.url)
  );

  const allHeadings = dedupeTextList(mergeLines(...pages.map((x) => x.headings)), {
    maxItems: 24,
    maxText: 180,
  });

  const allParagraphs = dedupeTextList(mergeLines(...pages.map((x) => x.paragraphs)), {
    maxItems: 28,
    maxText: 700,
  });

  const allListItems = dedupeTextList(mergeLines(...pages.map((x) => x.listItems)), {
    maxItems: 40,
    maxText: 180,
  });

  const structuredNames = dedupeTextList(
    [
      ...pages.flatMap((x) => arr(x?.structured?.names)),
      ...arr(siteIdentity.nameCandidates),
    ].filter((x) => !isGenericMapsText(x)),
    { maxItems: 10, maxText: 140 }
  );

  const structuredDescriptions = dedupeTextList(
    [
      ...pages.flatMap((x) => arr(x?.structured?.descriptions)),
      ...arr(siteIdentity.descriptionCandidates),
    ].filter((x) => !isGenericMapsText(x)),
    { maxItems: 10, maxText: 420 }
  );

  const allEmails = uniq([
    ...pages.flatMap((x) => arr(x.emails)),
    ...pages.flatMap((x) => arr(x?.structured?.emails)),
    ...arr(siteIdentity.contactEmails),
  ]).slice(0, 20);

  const allPhones = uniq([
    ...pages.flatMap((x) => arr(x.phones)),
    ...pages.flatMap((x) => arr(x?.structured?.phones)),
    ...arr(siteIdentity.contactPhones),
  ]).slice(0, 20);

  const addressCandidates = [
    ...locationPages.flatMap((x) => [
      ...arr(x.addresses),
      ...arr(x.listItems),
      ...arr(x.paragraphs),
      s(x.sections?.contact),
    ]),
    ...contactPages.flatMap((x) => [
      ...arr(x.addresses),
      ...arr(x.listItems),
      ...arr(x.paragraphs),
      s(x.sections?.contact),
    ]),
    ...pages.flatMap((x) => arr(x.addresses)),
    ...arr(siteIdentity.addresses),
  ];

  const allAddresses = cleanAddressList(addressCandidates, 4);

  const allHours = dedupeTextList(
    uniq([
      ...pages.flatMap((x) => arr(x.hours)),
      ...pages.flatMap((x) => arr(x?.structured?.hours)),
      ...arr(siteIdentity.hours),
      ...supportPages.flatMap((x) =>
        [...arr(x.listItems), ...arr(x.paragraphs)].filter((item) =>
          looksLikeOperationalHoursLine(item)
        )
      ),
    ]),
    { maxItems: 10, maxText: 180 }
  );

  const allFaqItems = cleanFaqItems(
    uniqBy(
      [
        ...pages.flatMap((x) => arr(x.faqItems)),
        ...arr(siteIdentity.faqPreview),
        ...supportPages.flatMap((page) =>
          arr(page?.headings)
            .filter((heading) => /\?$/.test(s(heading)) && s(heading).split(/\s+/).length >= 3)
            .map((question) => ({
              question,
              answer: compactText(
                arr(page?.paragraphs).find((item) => !/\?$/.test(s(item)) && s(item).length >= 20) ||
                  "",
                700
              ),
            }))
        ),
      ],
      (x) => String(x?.question || "").trim().toLowerCase()
    ),
    12
  );

  const serviceSourceText = [
    ...servicePages.flatMap((x) => arr(x.serviceHints)),
    ...servicePages.flatMap((x) => arr(x.listItems)),
    ...servicePages.flatMap((x) => arr(x.paragraphs).filter((item) => item.length <= 220)),
    ...servicePages.flatMap((x) => arr(x.headings)),
    ...aboutPages.flatMap((x) => arr(x.paragraphs).filter((item) => item.length <= 220)),
    ...aboutPages.flatMap((x) => arr(x.listItems)),
    ...bookingPages.flatMap((x) => arr(x.listItems)),
    ...bookingPages.flatMap((x) => arr(x.paragraphs).filter((item) => item.length <= 220)),
    ...pages.flatMap((x) => arr(x?.structured?.serviceNames)),
    ...arr(siteIdentity.serviceHints),
    ...allListItems,
    ...allHeadings,
    ...allParagraphs.filter((item) => item.length <= 220),
  ];

  const services = canonicalizeServiceList(
    serviceSourceText.filter((x) => detectServiceLine(x)),
    12
  );

  const products = canonicalizeProductList(
    [...allListItems, ...allHeadings].filter((x) => detectProductLine(x)),
    12
  );

  const pricingHints = cleanPricingHintsList(
    [
      ...pricingPages.flatMap((x) => arr(x.pricingHints)),
      ...pricingPages.flatMap((x) => arr(x.listItems)),
      ...pricingPages.flatMap((x) => arr(x.paragraphs)),
      ...bookingPages.flatMap((x) => arr(x.listItems)),
      ...bookingPages.flatMap((x) => arr(x.paragraphs)),
      ...servicePages.flatMap((x) => arr(x.paragraphs).filter((item) => item.length <= 220)),
      ...arr(siteIdentity.pricingHints),
      ...pages
        .map((x) => x.sections?.pricing || "")
        .filter(Boolean)
        .map((x) => compactText(x, 400)),
      ...allListItems.filter((x) => detectPricingLine(x)),
      ...allParagraphs.filter((x) => x.length <= 320 && detectPricingLine(x)),
    ],
    6
  );

  const policyHighlights = cleanPolicyHighlights(
    [
      ...policyPages.flatMap((x) => arr(x.listItems)),
      ...policyPages.flatMap((x) => arr(x.paragraphs)),
      ...policyPages.map((x) => x.sections?.policy || ""),
    ],
    8
  );

  const summarySourceLines = [
    aboutPages[0]?.sections?.about || "",
    aboutPages[0]?.paragraphs?.[0] || "",
    aboutPages[0]?.paragraphs?.[1] || "",
    mainPage?.sections?.hero || "",
    mainPage?.sections?.about || "",
    mainPage?.metaDescription || "",
    ...aboutPages.slice(0, 2).map((x) => x.metaDescription || ""),
    ...servicePages
      .slice(0, 1)
      .flatMap((x) => [x.sections?.about || "", ...arr(x.paragraphs).slice(0, 2)]),
    ...contactPages
      .slice(0, 1)
      .flatMap((x) => [x.sections?.contact || "", ...arr(x.paragraphs).slice(0, 1)]),
    ...structuredDescriptions.slice(0, 2),
    ...allParagraphs.slice(0, 4),
  ].filter(Boolean);

  const summaryLines = pickBestSummaryLines(summarySourceLines, 4);

  const aboutSectionRaw =
    aboutPages.find((x) => String(x?.sections?.about || "").trim())?.sections?.about ||
    mainPage?.sections?.about ||
    structuredDescriptions[0] ||
    "";

  const aboutSection = cleanSummaryText(aboutSectionRaw, mainPage?.title || "");

  const companyTitle =
    structuredNames[0] ||
    normalizeTitleCandidate(mainPage?.title || "") ||
    normalizeTitleCandidate(mainPage?.headings?.[0] || "") ||
    "";

  const sourceLanguage =
    lower(s(siteIdentity.primaryLanguage)) ||
    inferPrimaryLanguage([
      companyTitle,
      mainPage?.title || "",
      mainPage?.metaDescription || "",
      aboutSection,
      ...summaryLines,
      ...allHeadings.slice(0, 8),
      ...allParagraphs.slice(0, 6),
    ]);

  return {
    company: {
      title: companyTitle,
      rawTitle: mainPage?.title || "",
      structuredNames,
      metaDescription: mainPage?.metaDescription || "",
      headings: allHeadings.slice(0, 24),
      aboutSection,
      summaryLines,
      language: sourceLanguage,
    },
    offerings: {
      services,
      products,
    },
    pricing: {
      hints: pricingHints,
    },
    contact: {
      emails: allEmails,
      phones: allPhones,
      addresses: allAddresses,
      hours: allHours,
      socialLinks: cleanSocialLinks(arr(extracted.site?.socialLinks), 12),
      whatsappLinks: cleanUrlList(arr(extracted.site?.whatsappLinks), 8),
      bookingLinks: cleanUrlList(arr(extracted.site?.bookingLinks), 10),
    },
    faq: {
      items: allFaqItems,
    },
    policy: {
      highlights: policyHighlights,
    },
    crawl: {
      pagesScanned: extracted.site?.pagesScanned || pages.length || 1,
      linksScanned: extracted.site?.linksScanned || 0,
      scannedPages: arr(extracted.site?.scannedPages),
      pageTypeCounts: obj(extracted.site?.pageTypeCounts),
      quality: obj(extracted.site?.quality),
      warnings: arr(extracted.crawl?.warnings),
    },
  };
}

function synthesizeBusinessProfile(signals = {}) {
  const company = obj(signals.company);
  const offerings = obj(signals.offerings);
  const pricing = obj(signals.pricing);
  const contact = obj(signals.contact);
  const faq = obj(signals.faq);
  const policy = obj(signals.policy);
  const crawl = obj(signals.crawl);

  const brandHint = company.title || company.rawTitle || "";
  const language = lower(s(company.language || "en"));
  const locale = getLocalePack(language);

  const shortParts = buildUniqueSummaryParts(
    [
      company.aboutSection || "",
      company.summaryLines?.[0] || "",
      company.metaDescription || "",
    ],
    { brandHint, maxItems: 2 }
  );

  let companySummaryShort = cleanSummaryText(shortParts.join(" — "), brandHint);
  companySummaryShort = compactText(companySummaryShort, 320);

  const synthesizedTail = buildUniqueSummaryParts(
    [
      offerings.services?.length
        ? `${locale.summaryServices}: ${offerings.services.slice(0, 4).join(", ")}`
        : "",
      pricing.hints?.length ? locale.summaryPricing : "",
      (contact.phones?.length || contact.emails?.length) ? locale.summaryContact : "",
    ],
    { brandHint, maxItems: 3 }
  );

  const longParts = buildUniqueSummaryParts(
    [
      company.aboutSection,
      ...(company.summaryLines || []).slice(0, 2),
      ...synthesizedTail,
    ],
    { brandHint, maxItems: 5 }
  );

  let companySummaryLong = cleanSummaryText(longParts.join(" — "), brandHint);
  companySummaryLong = dedupeSentences(companySummaryLong, 900);
  companySummaryLong = normalizeSummaryPart(companySummaryLong, brandHint);

  if (
    companySummaryLong &&
    companySummaryShort &&
    (
      normalizeCompareText(companySummaryLong) === normalizeCompareText(companySummaryShort) ||
      normalizeCompareText(companySummaryLong).includes(
        normalizeCompareText(companySummaryShort)
      ) ||
      normalizeCompareText(companySummaryShort).includes(
        normalizeCompareText(companySummaryLong)
      )
    )
  ) {
    companySummaryLong = "";
  }

  const pricingPolicy = inferPricingPolicy(
    pricing.hints || [],
    contact.bookingLinks || [],
    language
  );

  const supportMode = classifySupportMode({
    phones: contact.phones || [],
    emails: contact.emails || [],
    whatsappLinks: contact.whatsappLinks || [],
    bookingLinks: contact.bookingLinks || [],
    language,
  });

  return {
    sourceLanguage: language,
    companyTitle: company.title || "",
    companySummaryShort: compactText(companySummaryShort, 320),
    companySummaryLong: compactText(companySummaryLong, 900),
    aboutSection: compactText(company.aboutSection || "", 900),
    headings: arr(company.headings).slice(0, 24),
    services: arr(offerings.services).slice(0, 12),
    products: arr(offerings.products).slice(0, 12),
    pricingHints: arr(pricing.hints).slice(0, 6),
    pricingPolicy,
    faqItems: arr(faq.items).slice(0, 12),
    emails: arr(contact.emails).slice(0, 20),
    phones: arr(contact.phones).slice(0, 20),
    addresses: arr(contact.addresses).slice(0, 4),
    hours: arr(contact.hours).slice(0, 10),
    socialLinks: arr(contact.socialLinks).slice(0, 12),
    whatsappLinks: arr(contact.whatsappLinks).slice(0, 8),
    bookingLinks: arr(contact.bookingLinks).slice(0, 10),
    policyHighlights: arr(policy.highlights).slice(0, 8),
    pageCoverage: obj(crawl.pageTypeCounts),
    supportMode,
  };
}

function buildWebsiteTrustSummary({ extracted = {}, signals = {}, profile = {} } = {}) {
  const sourceUrl = s(extracted.sourceUrl || extracted.site?.sourceUrl || "");
  const finalUrl = s(extracted.finalUrl || extracted.site?.finalUrl || sourceUrl);

  const sourceInfo = parseUrlInfo(sourceUrl);
  const finalInfo = parseUrlInfo(finalUrl);

  const pageTypeCounts = obj(extracted.site?.pageTypeCounts);
  const siteQuality = obj(extracted.site?.quality);
  const crawlWarnings = uniq([
    ...arr(extracted.crawl?.warnings),
    ...arr(siteQuality.warnings),
  ]);

  const brandCandidates = uniq([
    s(profile.companyTitle),
    s(signals.company?.title),
    s(signals.company?.rawTitle),
    ...arr(signals.company?.structuredNames),
    ...arr(signals.company?.headings).slice(0, 6),
  ]).filter(Boolean);

  const brandTokens = uniq(
    brandCandidates.flatMap((x) => tokenizeMeaningfulText(x))
  );

  const hostTokens = uniq([
    ...domainTokens(sourceInfo.host),
    ...domainTokens(finalInfo.host),
    ...domainTokens(sourceInfo.registrableDomain),
    ...domainTokens(finalInfo.registrableDomain),
  ]);

  const brandDomainMatches = uniq(
    brandTokens.filter((token) =>
      hostTokens.some(
        (hostToken) =>
          hostToken === token ||
          hostToken.includes(token) ||
          token.includes(hostToken)
      )
    )
  );

  const firstPartyEmails = uniq(
    arr(profile.emails).filter((email) =>
      isFirstPartyEmail(email, finalInfo.host, finalInfo.registrableDomain)
    )
  );

  const genericMailboxEmails = uniq(
    arr(profile.emails).filter((email) => isGenericMailbox(email))
  );

  const hasIdentity = !!(profile.companyTitle || profile.aboutSection);
  const hasOfferings =
    arr(profile.services).length > 0 || arr(profile.products).length > 0;
  const hasDirectContact =
    arr(profile.emails).length > 0 ||
    arr(profile.phones).length > 0 ||
    arr(profile.bookingLinks).length > 0 ||
    arr(profile.whatsappLinks).length > 0;
  const hasAddressOrHours =
    arr(profile.addresses).length > 0 || arr(profile.hours).length > 0;

  const pagesScanned = Number(extracted.site?.pagesScanned || 0);

  const sourceMatchesFinalSite =
    !!sourceInfo.registrableDomain &&
    !!finalInfo.registrableDomain &&
    sourceInfo.registrableDomain === finalInfo.registrableDomain;

  const redirectCrossSite =
    !!sourceInfo.registrableDomain &&
    !!finalInfo.registrableDomain &&
    sourceInfo.registrableDomain !== finalInfo.registrableDomain;

  const hasAboutPage = Number(pageTypeCounts.about || 0) > 0;
  const hasServicePage = Number(pageTypeCounts.services || 0) > 0;
  const hasContactPage = Number(pageTypeCounts.contact || 0) > 0;

  const criticalWarnings = uniq(
    crawlWarnings.filter((x) =>
      [
        "parked_or_placeholder_site_detected",
        "bot_or_access_protection_detected",
        "error_or_placeholder_content_detected",
        "robots_disallow_all_detected",
      ].includes(s(x))
    )
  );

  let score = 0;

  score += clamp(Number(siteQuality.score || 0), 0, 100) * 0.4;
  if (pagesScanned >= 2) score += 10;
  if (pagesScanned >= 4) score += 4;
  if (hasIdentity) score += 12;
  if (hasOfferings) score += 12;
  if (hasDirectContact) score += 10;
  if (firstPartyEmails.length) score += 10;
  else if (arr(profile.emails).length) score += 4;
  if (hasAddressOrHours) score += 6;
  if (hasAboutPage) score += 6;
  if (hasServicePage) score += 6;
  if (hasContactPage) score += 6;
  if (brandDomainMatches.length) score += Math.min(14, 6 + brandDomainMatches.length * 3);
  if (sourceMatchesFinalSite) score += 8;

  if (pagesScanned <= 1) score -= 8;
  if (!hasIdentity) score -= 10;
  if (!hasOfferings) score -= 10;
  if (!hasDirectContact) score -= 8;
  if (!firstPartyEmails.length && genericMailboxEmails.length) score -= 3;
  if (redirectCrossSite) score -= 16;
  if (crawlWarnings.includes("thin_visible_content")) score -= 6;
  if (crawlWarnings.includes("very_thin_visible_content")) score -= 10;
  if (crawlWarnings.includes("sitemap_not_found_or_unreadable")) score -= 2;
  if (crawlWarnings.includes("entry_fetch_required_fallback")) score -= 1;
  if (criticalWarnings.includes("bot_or_access_protection_detected")) score -= 22;
  if (criticalWarnings.includes("parked_or_placeholder_site_detected")) score -= 35;
  if (criticalWarnings.includes("error_or_placeholder_content_detected")) score -= 18;
  if (criticalWarnings.includes("robots_disallow_all_detected")) score -= 10;

  score = clamp(Math.round(score), 0, 100);

  const band =
    score >= 70 ? "strong" : score >= 50 ? "medium" : score >= 35 ? "low" : "weak";

  const warnings = [];

  if (redirectCrossSite) warnings.push("cross_site_redirect_detected");
  if (!firstPartyEmails.length && !hasContactPage) {
    warnings.push("no_first_party_contact_signal");
  }
  if (!brandDomainMatches.length && !firstPartyEmails.length) {
    warnings.push("low_brand_domain_match");
  }
  if (pagesScanned <= 1) warnings.push("low_page_coverage");
  if (!hasIdentity) warnings.push("weak_identity_signals");
  if (!hasOfferings) warnings.push("weak_offering_signals");
  if (!hasDirectContact) warnings.push("weak_direct_contact_signals");
  warnings.push(...criticalWarnings);

  const shouldAllowCandidateCreation =
    band !== "weak" &&
    !criticalWarnings.includes("parked_or_placeholder_site_detected") &&
    !criticalWarnings.includes("bot_or_access_protection_detected") &&
    !criticalWarnings.includes("error_or_placeholder_content_detected") &&
    (hasIdentity || hasOfferings) &&
    (sourceMatchesFinalSite || firstPartyEmails.length > 0 || brandDomainMatches.length > 0) &&
    (pagesScanned >= 2 || hasDirectContact);

  return {
    score,
    band,
    sourceUrl,
    finalUrl,
    sourceHost: sourceInfo.host,
    finalHost: finalInfo.host,
    registrableDomain: finalInfo.registrableDomain,
    sourceMatchesFinalSite,
    redirectCrossSite,
    hasIdentity,
    hasOfferings,
    hasDirectContact,
    hasAddressOrHours,
    hasAboutPage,
    hasServicePage,
    hasContactPage,
    firstPartyEmailCount: firstPartyEmails.length,
    firstPartyEmails: firstPartyEmails.slice(0, 10),
    genericMailboxEmailCount: genericMailboxEmails.length,
    brandDomainMatches: brandDomainMatches.slice(0, 10),
    crawlWarnings,
    criticalWarnings,
    warnings: uniq(warnings),
    shouldAllowCandidateCreation,
    requiresOwnershipVerification: true,
    reviewMode: shouldAllowCandidateCreation
      ? "candidate_generation_allowed_but_manual_review_required"
      : criticalWarnings.length
        ? "block_candidate_generation_until_source_review"
        : "review_only_no_candidate_generation",
  };
}

function buildWebsiteSyncQualitySummary({
  extracted = {},
  signals = {},
  profile = {},
  trust = null,
  candidateCount = 0,
  observationCount = 0,
}) {
  const pageTypeCounts = obj(extracted.site?.pageTypeCounts);

  return {
    crawlVersion: WEBSITE_CRAWL_VERSION,
    pipelineVersion: SOURCE_SYNC_VERSION,
    sourceType: "website",
    pagesScanned: extracted.site?.pagesScanned || 1,
    linksScanned: extracted.site?.linksScanned || 0,

    sourceLanguage: s(profile.sourceLanguage || signals.company?.language || ""),

    emailsFound: arr(profile.emails).length,
    phonesFound: arr(profile.phones).length,
    socialLinksFound: arr(profile.socialLinks).length,
    whatsappLinksFound: arr(profile.whatsappLinks).length,
    bookingLinksFound: arr(profile.bookingLinks).length,

    servicesFound: arr(profile.services).length,
    productsFound: arr(profile.products).length,
    faqFound: arr(profile.faqItems).length,
    locationsFound: arr(profile.addresses).length,
    hoursFound: arr(profile.hours).length,
    pricingHintsFound: arr(profile.pricingHints).length,
    policyHighlightsFound: arr(profile.policyHighlights).length,

    hasAboutSection: !!profile.aboutSection,
    hasSummaryShort: !!profile.companySummaryShort,
    hasSummaryLong: !!profile.companySummaryLong,

    hasAboutPage: Number(pageTypeCounts.about || 0) > 0,
    hasServicePage: Number(pageTypeCounts.services || 0) > 0,
    hasPricingPage: Number(pageTypeCounts.pricing || 0) > 0,
    hasContactPage: Number(pageTypeCounts.contact || 0) > 0,
    hasFaqPage: Number(pageTypeCounts.faq || 0) > 0,
    hasPolicyPage: Number(pageTypeCounts.policy || 0) > 0,
    hasBookingPage: Number(pageTypeCounts.booking || 0) > 0,

    observationCount: Number(observationCount || 0),
    candidateCount: Number(candidateCount || 0),

    scannedPages: extracted.site?.scannedPages || [],
    pageTypeCounts,
    companyTitle: profile.companyTitle || "",
    supportMode: profile.supportMode || "",
    pricingPolicy: profile.pricingPolicy || "",
    siteQuality: obj(extracted.site?.quality),
    crawlWarnings: arr(extracted.crawl?.warnings),
    trust: trust
      ? {
          score: trust.score,
          band: trust.band,
          sourceHost: trust.sourceHost,
          finalHost: trust.finalHost,
          sourceMatchesFinalSite: trust.sourceMatchesFinalSite,
          firstPartyEmailCount: trust.firstPartyEmailCount,
          shouldAllowCandidateCreation: trust.shouldAllowCandidateCreation,
          reviewMode: trust.reviewMode,
          warnings: arr(trust.warnings),
          criticalWarnings: arr(trust.criticalWarnings),
        }
      : null,
    signalBuckets: {
      headings: arr(signals.company?.headings).length,
      summaryLines: arr(signals.company?.summaryLines).length,
      services: arr(signals.offerings?.services).length,
      products: arr(signals.offerings?.products).length,
      pricingHints: arr(signals.pricing?.hints).length,
      faq: arr(signals.faq?.items).length,
      policyHighlights: arr(signals.policy?.highlights).length,
    },
  };
}

function buildWebsiteExtractionWarnings({
  extracted = {},
  signals = {},
  profile = {},
  trust = null,
} = {}) {
  const warnings = [];
  const pageTypeCounts = obj(extracted.site?.pageTypeCounts);
  const pagesScanned = Number(extracted.site?.pagesScanned || 0);

  warnings.push(...arr(extracted.crawl?.warnings));
  warnings.push(...arr(extracted.site?.quality?.warnings));
  warnings.push(...arr(trust?.warnings));

  if (pagesScanned <= 1) {
    warnings.push("website crawl only collected the homepage");
  }
  if (!profile.companyTitle && !profile.aboutSection) {
    warnings.push("website identity extraction is weak");
  }
  if (!arr(profile.services).length) {
    warnings.push("no strong service signals were extracted from the website");
  }
  if (
    !arr(profile.emails).length &&
    !arr(profile.phones).length &&
    !arr(profile.bookingLinks).length &&
    !arr(profile.whatsappLinks).length
  ) {
    warnings.push("no strong direct contact signals were extracted from the website");
  }
  if (!pageTypeCounts.about) {
    warnings.push("about page was not detected during website crawl");
  }
  if (!pageTypeCounts.contact) {
    warnings.push("contact page was not detected during website crawl");
  }
  if (!pageTypeCounts.services && !arr(profile.services).length) {
    warnings.push("services page was not detected during website crawl");
  }
  if (!arr(signals.faq?.items).length && !pageTypeCounts.faq) {
    warnings.push("faq/help content was not detected during website crawl");
  }

  return uniq(warnings).slice(0, 20);
}

function isWeakWebsiteExtraction({ extracted = {}, profile = {}, trust = null } = {}) {
  const pagesScanned = Number(extracted.site?.pagesScanned || 0);
  const crawlWarnings = uniq([
    ...arr(extracted.crawl?.warnings),
    ...arr(extracted.site?.quality?.warnings),
  ]);

  let strongSignals = 0;
  if (profile.companyTitle) strongSignals += 1;
  if (profile.aboutSection) strongSignals += 1;
  if (arr(profile.services).length) strongSignals += 1;
  if (
    arr(profile.emails).length ||
    arr(profile.phones).length ||
    arr(profile.bookingLinks).length ||
    arr(profile.whatsappLinks).length
  ) {
    strongSignals += 1;
  }
  if (arr(profile.pricingHints).length) strongSignals += 1;
  if (arr(profile.faqItems).length) strongSignals += 1;
  if (arr(profile.addresses).length || arr(profile.hours).length) strongSignals += 1;

  if (
    crawlWarnings.includes("parked_or_placeholder_site_detected") ||
    crawlWarnings.includes("bot_or_access_protection_detected") ||
    crawlWarnings.includes("error_or_placeholder_content_detected")
  ) {
    return true;
  }

  if (trust && trust.band === "weak") return true;
  if (pagesScanned <= 1 && strongSignals <= 2) return true;
  if (!profile.companyTitle && !profile.aboutSection && !arr(profile.services).length) {
    return true;
  }

  return false;
}

export {
  buildWebsiteSignals,
  buildWebsiteSyncQualitySummary,
  buildWebsiteExtractionWarnings,
  buildWebsiteTrustSummary,
  classifySupportMode,
  detectPricingLine,
  detectProductLine,
  detectServiceLine,
  inferPricingPolicy,
  isWeakWebsiteExtraction,
  pickBestSummaryLines,
  synthesizeBusinessProfile,
};
