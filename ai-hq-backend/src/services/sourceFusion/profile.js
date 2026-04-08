// src/services/sourceFusion/profile.js
// FINAL v5.0 — stronger deterministic profile synthesis + multilingual-safe projection
// goals:
// - remove hardcoded language
// - stricter service/address/pricing cleanup
// - cleaner professional summaries
// - safer social/faq shaping
// - better review-draft quality

import {
  arr,
  compactText,
  confidenceLabel,
  isLikelyBusinessWebsiteUrl,
  lower,
  normalizeConfidence,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedUrl,
  s,
  uniqStrings,
} from "./shared.js";
import {
  getClusterJson,
  getClusterText,
  mapFaqClusters,
  mapSocialLinkClusters,
  pickListClusters,
} from "./clustering.js";
import { getSourceProfile } from "./policies.js";

const SOCIAL_HOST_RE =
  /\b(instagram\.com|facebook\.com|fb\.com|linkedin\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|youtube\.com|youtu\.be|x\.com|twitter\.com|tiktok\.com|pinterest\.com)\b/i;

const GENERIC_SERVICE_KEYS = new Set([
  "service",
  "services",
  "xidmet",
  "xidmetler",
  "xidmət",
  "xidmətlər",
  "offerings",
  "solutions",
  "uslugi",
  "услуги",
  "product",
  "products",
]);

function summarizeSources(observations = []) {
  const counts = {};
  const runIds = new Set();
  const sourceIds = new Set();

  for (const item of arr(observations)) {
    const type = lower(item.source_type || item.sourceType || "unknown");
    counts[type] = (counts[type] || 0) + 1;

    if (s(item.source_run_id || item.sourceRunId)) {
      runIds.add(s(item.source_run_id || item.sourceRunId));
    }

    if (s(item.source_id || item.sourceId)) {
      sourceIds.add(s(item.source_id || item.sourceId));
    }
  }

  return {
    sourceCount: sourceIds.size,
    runCount: runIds.size,
    sources: Object.entries(counts)
      .map(([source_type, count]) => ({
        source_type,
        count,
        trust_class: getSourceProfile(source_type).trustClass,
        weak: getSourceProfile(source_type).weak,
      }))
      .sort((a, b) => b.count - a.count || a.source_type.localeCompare(b.source_type)),
  };
}

function normKey(text = "") {
  return lower(s(text))
    .replace(/\s+/g, " ")
    .replace(/[|•·,;:]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();
}

function splitParts(text = "", { allowComma = false } = {}) {
  const base = compactText(s(text), 500)
    .replace(/\s*[•·]+\s*/g, " | ")
    .replace(/\s*;\s*/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!base) return [];

  let parts = base
    .split(/\s*\|\s*/)
    .map((x) => compactText(x, 220))
    .filter(Boolean);

  if (allowComma) {
    parts = parts.flatMap((item) => {
      const commaCount = (item.match(/,/g) || []).length;
      if (commaCount >= 1 && commaCount <= 6 && item.length <= 180 && !/[.!?]/.test(item)) {
        return item
          .split(/\s*,\s*/)
          .map((x) => compactText(x, 140))
          .filter(Boolean);
      }
      return [item];
    });
  }

  return parts;
}

function dedupeObjectsBy(items = [], keyFn = (x) => JSON.stringify(x)) {
  const seen = new Set();
  const out = [];

  for (const item of arr(items)) {
    const key = s(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function dedupeStringsLoose(items = [], maxItems = 20) {
  const seen = new Set();
  const out = [];

  for (const raw of arr(items)) {
    const value = compactText(s(raw), 260);
    const key = normKey(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= maxItems) break;
  }

  return out;
}

function isUiNoise(text = "") {
  const x = lower(text);
  if (!x) return true;

  return (
    /^(home|about|about us|services|service|contact|contact us|pricing|faq|blog|menu|search|support|help|read more|learn more|view more|more|details|get started|start now|book now|book|call now|skip to content|portfolio|projects|team|careers|login|register|sign in)$/i.test(
      x
    ) ||
    /\b(skip to content|cookie|cookies|all rights reserved|copyright|toggle navigation|loading|sign in|login|register|checkout|cart|menu|open menu|close menu)\b/i.test(
      x
    )
  );
}

function isPolicyText(text = "") {
  return /\b(policy|privacy|terms|conditions|refund|return|shipping|cancellation|gdpr)\b/i.test(
    s(text)
  );
}

function isTestimonialText(text = "") {
  return /\b(testimonial|testimonials|review|reviews|what our clients say|what clients say|happy clients|client feedback|highly recommend|recommend|recommended|very satisfied|great job|thank you)\b/i.test(
    s(text)
  );
}

function isPromoText(text = "") {
  return /\b(read more|learn more|view more|get started|start now|book now|call now|contact us|request quote|free consultation|timeline|days|project complexity|requirements|meta tags|structured data|performance optimization|answers to the most common questions)\b/i.test(
    s(text)
  );
}

function isPricingHeavyText(text = "") {
  return /\b(price|pricing|qiymət|qiymet|package|packages|plan|plans|starting|from|quote|custom quote|consultation|₼|\bazn\b|\busd\b|\beur\b|\$|€|£)\b/i.test(
    s(text)
  );
}

function isAddressLike(text = "") {
  const x = s(text);
  return (
    /\b(address|office|location|ünvan|unvan|filial|branch|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd|floor|building|blok|bina|suite|apt|apartment|küçə|kuce|küçəsi|kucesi|prospekt|rayon|district|baku|bakı|azerbaijan|azərbaycan)\b/i.test(
      x
    ) ||
    (/\d/.test(x) &&
      /\b(street|st\.?|avenue|ave\.?|road|rd\.?|floor|building|blok|bina|suite|apt|apartment|küçə|kuce|küçəsi|kucesi|prospekt)\b/i.test(
        x
      ))
  );
}

function isWeakAddress(text = "") {
  const value = compactText(s(text), 220);
  if (!value) return true;
  if (value.split(/\s+/).length > 18) return true;
  if (/[.!?].*[.!?]/.test(value)) return true;
  if (isUiNoise(value) || isPolicyText(value) || isTestimonialText(value) || isPromoText(value)) {
    return true;
  }
  if (
    /\b(project|seo|design|website|vebsayt|landing|corporate websites|e-commerce projects)\b/i.test(
      value
    )
  ) {
    return true;
  }
  return !isAddressLike(value);
}

function isServiceLike(text = "") {
  return /\b(service|services|solution|solutions|automation|marketing|design|development|consulting|chatbot|crm|seo|branding|website|web site|e-commerce|software|xidmət|xidmet|veb|sayt|reklam|rəqəmsal|digital|smm|landing page|ui\/ux)\b/i.test(
    s(text)
  );
}

function isGenericService(text = "") {
  const key = normKey(text);
  return !key || GENERIC_SERVICE_KEYS.has(key);
}

function stripLeadingServiceLabel(text = "") {
  return compactText(
    s(text)
      .replace(
        /^(services?|service|xidmətlər?|xidmetler?|xidmət|xidmet|услуги|offerings|solutions)\s*[:|—–-]*\s*/i,
        ""
      )
      .trim(),
    160
  );
}

function cleanBusinessName(text = "") {
  const raw = compactText(s(text), 180);
  if (!raw) return "";

  const parts = raw
    .split(/\s*[|•·—–]\s*/)
    .map((item) => compactText(item, 100))
    .filter(Boolean);

  const ranked = (parts.length ? parts : [raw])
    .map((item) => {
      let score = 0;
      if (item.length >= 2 && item.length <= 72) score += 3;
      if (!isUiNoise(item)) score += 3;
      if (!isPolicyText(item)) score += 2;
      if (!/^https?:/i.test(item) && !/@/.test(item)) score += 2;
      if (
        /\b(agency|studio|company|clinic|center|centre|group|labs|solutions|digital|academy|shop|store|salon|restaurant|hotel|travel|consulting|design|marketing)\b/i.test(
          item
        )
      ) {
        score += 1;
      }
      if (/\b(home|welcome|google maps|maps|contact|services|pricing|faq)\b/i.test(item)) {
        score -= 5;
      }
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.length - b.item.length);

  const best = ranked[0]?.item || "";
  if (!best || isUiNoise(best)) return "";
  if (best.length < 2 || best.length > 80) return "";
  if (/^https?:/i.test(best) || /@/.test(best)) return "";
  return best;
}

function cleanSummary(text = "", { minLength = 40, maxLength = 1600 } = {}) {
  const raw = compactText(s(text), maxLength);
  if (!raw) return "";
  if (raw.length < minLength) return "";
  if (isUiNoise(raw)) return "";
  if (isPolicyText(raw)) return "";
  if (isTestimonialText(raw)) return "";
  if (isAddressLike(raw)) return "";
  if (isPromoText(raw)) return "";
  if (isPricingHeavyText(raw) && raw.length > 120) return "";
  if (/[|]/.test(raw) && splitParts(raw, { allowComma: true }).length >= 3) return "";
  if (
    /\b(find local businesses|view maps|get driving directions|google maps)\b/i.test(raw)
  ) {
    return "";
  }
  return raw;
}

function cleanListValue(text = "", type = "") {
  let raw = compactText(s(text), type === "pricing" ? 220 : 160);
  if (!raw) return "";
  if (isUiNoise(raw) || isPolicyText(raw) || isTestimonialText(raw)) return "";
  if (/^https?:/i.test(raw) || /@/.test(raw)) return "";

  if (type === "service" || type === "product") {
    raw = stripLeadingServiceLabel(raw);

    const words = raw.split(/\s+/).filter(Boolean).length;
    if (words < 1 || words > 8) return "";
    if (isGenericService(raw)) return "";
    if (
      /\b(home|about|contact|services|products|pricing|faq|policy|blog|portfolio|projects)\b/i.test(
        raw
      )
    ) {
      return "";
    }
    if (/\?|!/.test(raw)) return "";
    if (isAddressLike(raw)) return "";
    if (isPricingHeavyText(raw) && !isServiceLike(raw)) return "";
    if (!isServiceLike(raw) && type === "service") return "";
  }

  if (type === "pricing") {
    if (!isPricingHeavyText(raw)) return "";
    if (
      /\b(read more|learn more|get started|book now|call now|follow us|timeline|project complexity|requirements)\b/i.test(
        raw
      )
    ) {
      return "";
    }
    if (raw.length < 12 || raw.length > 180) return "";
  }

  if (type === "hours") {
    if (!/(\d{1,2}[:.]\d{2}|\d{1,2}\s?(am|pm)|24\/7)/i.test(raw)) return "";
  }

  return raw;
}

function chooseScalarCluster(clusters = [], cleaner = (x) => x) {
  for (const cluster of arr(clusters)) {
    const json = getClusterJson(cluster);
    const raw = s(
      json.url ||
        json.email ||
        json.phone ||
        json.address ||
        json.policy ||
        json.support_mode ||
        json.summary ||
        getClusterText(cluster)
    );
    const cleaned = cleaner(raw, cluster, json);
    if (cleaned) {
      return {
        value: cleaned,
        cluster,
      };
    }
  }

  return { value: "", cluster: null };
}

function chooseBusinessName(clusters = []) {
  return chooseScalarCluster(clusters, (raw) => cleanBusinessName(raw));
}

function chooseWebsiteUrl(clusters = []) {
  return chooseScalarCluster(clusters, (raw, cluster, json) => {
    const url = normalizeObservedUrl(json.url || raw);
    if (!url) return "";
    return isLikelyBusinessWebsiteUrl(url) ? url : "";
  });
}

function chooseSummary(clusters = [], { minLength = 40, maxLength = 1600 } = {}) {
  return chooseScalarCluster(clusters, (raw) =>
    cleanSummary(raw, { minLength, maxLength })
  );
}

function chooseEmail(clusters = []) {
  return chooseScalarCluster(clusters, (raw, cluster, json) => {
    const email = normalizeObservedEmail(json.email || raw);
    return /@/.test(email) ? email : "";
  });
}

function choosePhone(clusters = []) {
  return chooseScalarCluster(clusters, (raw, cluster, json) => {
    const phone = normalizeObservedPhone(json.phone || raw);
    return phone && phone.replace(/[^\d]/g, "").length >= 7 ? phone : "";
  });
}

function chooseAddress(clusters = []) {
  return chooseScalarCluster(clusters, (raw, cluster, json) => {
    const address = compactText(s(json.address || raw), 220);
    if (!address || isWeakAddress(address)) return "";
    return address;
  });
}

function collectScalarValues(clusters = [], cleaner = (x) => x, maxItems = 10) {
  return dedupeStringsLoose(
    arr(clusters)
      .map((cluster) => {
        const json = getClusterJson(cluster);
        const raw = s(
          json.url ||
            json.email ||
            json.phone ||
            json.address ||
            json.policy ||
            json.support_mode ||
            getClusterText(cluster)
        );
        return cleaner(raw, cluster, json);
      })
      .filter(Boolean),
    maxItems
  );
}

function collectListValues(claimType = "", clusters = [], maxItems = 20) {
  const picked = pickListClusters(claimType, clusters, {
    maxItems: Math.max(maxItems * 2, 12),
  });

  return dedupeStringsLoose(
    picked
      .flatMap((cluster) => {
        const json = getClusterJson(cluster);
        const raw =
          claimType === "social_link"
            ? s(json.url || getClusterText(cluster))
            : claimType === "faq"
              ? s(json.question || getClusterText(cluster))
              : claimType === "booking_link" || claimType === "whatsapp_link"
                ? s(json.url || getClusterText(cluster))
                : getClusterText(cluster);

        if (claimType === "service") {
          return splitParts(raw, { allowComma: true }).map((x) => cleanListValue(x, "service"));
        }
        if (claimType === "product") {
          return splitParts(raw, { allowComma: true }).map((x) => cleanListValue(x, "product"));
        }
        if (claimType === "pricing_hint") {
          return splitParts(raw, { allowComma: false }).map((x) => cleanListValue(x, "pricing"));
        }
        if (claimType === "working_hours") {
          return [cleanListValue(raw, "hours")];
        }
        if (claimType === "booking_link" || claimType === "whatsapp_link") {
          return [normalizeObservedUrl(raw)];
        }

        return [compactText(raw, 220)];
      })
      .filter(Boolean),
    maxItems
  );
}

function buildFaqItems(clusters = []) {
  return dedupeObjectsBy(
    mapFaqClusters(pickListClusters("faq", clusters, { maxItems: 20 }))
      .map((item) => ({
        question: compactText(s(item.question), 220),
        answer: compactText(s(item.answer), 900),
      }))
      .filter(
        (item) =>
          item.question &&
          !isUiNoise(item.question) &&
          !isPolicyText(item.question) &&
          !isTestimonialText(item.question) &&
          item.question.split(/\s+/).filter(Boolean).length >= 3
      ),
    (item) => lower(item.question)
  ).slice(0, 12);
}

function buildSocialLinks(clusters = []) {
  return dedupeObjectsBy(
    mapSocialLinkClusters(pickListClusters("social_link", clusters, { maxItems: 24 }))
      .map((item) => ({
        platform: s(item.platform),
        url: normalizeObservedUrl(item.url),
      }))
      .filter((item) => item.platform && item.url)
      .filter((item) => /^https?:\/\//i.test(item.url))
      .filter((item) => SOCIAL_HOST_RE.test(item.url))
      .filter((item) => !/\bshare|intent|sharer|dialog\b/i.test(item.url)),
    (item) => `${lower(item.platform)}|${lower(item.url)}`
  ).slice(0, 12);
}

function inferLanguageFromTexts(texts = []) {
  const text = lower(arr(texts).filter(Boolean).join(" \n "));
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

  const ranked = [
    ["az", az],
    ["tr", tr],
    ["ru", ru],
    ["en", en],
  ].sort((a, b) => b[1] - a[1]);

  return ranked[0]?.[1] > 0 ? ranked[0][0] : "en";
}

function resolvePrimaryLanguage({ sourceSummary = {}, samples = [] } = {}) {
  const hinted = lower(
    s(
      sourceSummary.sourceLanguage ||
        sourceSummary.primaryLanguage ||
        sourceSummary.language ||
        ""
    )
  );

  if (["az", "tr", "ru", "en"].includes(hinted)) return hinted;

  return inferLanguageFromTexts(samples);
}

function getLocalePack(lang = "en") {
  const normalized = ["az", "tr", "ru", "en"].includes(lang) ? lang : "en";

  const packs = {
    az: {
      servicesLabel: "Əsas xidmətlər",
      productsLabel: "Məhsul və ya paketlər",
      directContact: "Telefon və ya email ilə əlaqə mümkündür.",
    },
    tr: {
      servicesLabel: "Ana hizmetler",
      productsLabel: "Ürünler veya paketler",
      directContact: "Telefon veya e-posta ile iletişim mümkündür.",
    },
    ru: {
      servicesLabel: "Основные услуги",
      productsLabel: "Продукты или пакеты",
      directContact: "Связаться можно по телефону или email.",
    },
    en: {
      servicesLabel: "Core services",
      productsLabel: "Products or packages",
      directContact: "Customers can contact the business by phone or email.",
    },
  };

  return packs[normalized] || packs.en;
}

function buildSummaryShort({
  shortClusters = [],
  longClusters = [],
  services = [],
  companyName = "",
  language = "en",
}) {
  const short = chooseSummary(shortClusters, { minLength: 40, maxLength: 420 }).value;
  if (short) return short;

  const long = chooseSummary(longClusters, { minLength: 60, maxLength: 1200 }).value;
  if (long) return compactText(long, 420);

  if (companyName && services.length) {
    const locale = getLocalePack(language);
    return compactText(
      `${companyName}. ${locale.servicesLabel}: ${services.slice(0, 4).join(", ")}.`,
      420
    );
  }

  return "";
}

function buildSummaryLong({
  longClusters = [],
  shortSummary = "",
  services = [],
  products = [],
  companyName = "",
  primaryEmail = "",
  primaryPhone = "",
  language = "en",
}) {
  const long = chooseSummary(longClusters, { minLength: 60, maxLength: 1600 }).value;
  const normalizedShort = lower(shortSummary);

  if (
    long &&
    lower(long) !== normalizedShort &&
    (!normalizedShort || !lower(long).includes(normalizedShort))
  ) {
    return long;
  }

  const locale = getLocalePack(language);
  const parts = [];

  if (shortSummary) parts.push(shortSummary);
  if (services.length) parts.push(`${locale.servicesLabel}: ${services.slice(0, 6).join(", ")}.`);
  if (products.length) {
    parts.push(`${locale.productsLabel}: ${products.slice(0, 4).join(", ")}.`);
  }
  if (primaryEmail || primaryPhone) {
    parts.push(locale.directContact);
  }

  const combined = compactText(parts.join(" "), 1200);
  if (!combined) return "";

  if (companyName && !lower(combined).includes(lower(companyName))) {
    return compactText(`${companyName}. ${combined}`, 1200);
  }

  return combined;
}

function synthesizeProfile({ clusterMap = {}, sourceSummary = {} }) {
  const businessNames = collectScalarValues(
    clusterMap.company_name,
    (raw) => cleanBusinessName(raw),
    8
  );

  const companyPick = chooseBusinessName(clusterMap.company_name);
  const websitePick = chooseWebsiteUrl(clusterMap.website_url);
  const emailPick = chooseEmail(clusterMap.primary_email);
  const phonePick = choosePhone(clusterMap.primary_phone);
  const addressPick = chooseAddress(clusterMap.primary_address);

  const services = collectListValues("service", clusterMap.service, 12);
  const products = collectListValues("product", clusterMap.product, 12);
  const pricingHints = collectListValues("pricing_hint", clusterMap.pricing_hint, 6);
  const policyHighlights = collectListValues(
    "policy_highlight",
    clusterMap.policy_highlight,
    8
  );
  const hours = collectListValues("working_hours", clusterMap.working_hours, 10);

  const socialLinks = buildSocialLinks(clusterMap.social_link);
  const bookingLinks = collectListValues("booking_link", clusterMap.booking_link, 10);
  const whatsappLinks = collectListValues("whatsapp_link", clusterMap.whatsapp_link, 8);
  const faqItems = buildFaqItems(clusterMap.faq);

  const pricingPolicy = chooseScalarCluster(
    clusterMap.pricing_policy,
    (raw) => cleanSummary(raw, { minLength: 10, maxLength: 260 })
  ).value;

  const supportMode = chooseScalarCluster(
    clusterMap.support_mode,
    (raw) => cleanSummary(raw, { minLength: 10, maxLength: 180 })
  ).value;

  const companyName = companyPick.value || businessNames[0] || "";
  const websiteUrl = websitePick.value || "";

  const emails = collectScalarValues(
    clusterMap.primary_email,
    (raw, cluster, json) => {
      const email = normalizeObservedEmail(json.email || raw);
      return /@/.test(email) ? email : "";
    },
    10
  );

  const phones = collectScalarValues(
    clusterMap.primary_phone,
    (raw, cluster, json) => {
      const phone = normalizeObservedPhone(json.phone || raw);
      return phone && phone.replace(/[^\d]/g, "").length >= 7 ? phone : "";
    },
    10
  );

  const addresses = collectScalarValues(
    clusterMap.primary_address,
    (raw, cluster, json) => {
      const address = compactText(s(json.address || raw), 220);
      if (!address || isWeakAddress(address)) return "";
      return address;
    },
    4
  );

  const primaryEmail = emailPick.value || emails[0] || "";
  const primaryPhone = phonePick.value || phones[0] || "";
  const primaryAddress = addressPick.value || addresses[0] || "";

  const mainLanguage = resolvePrimaryLanguage({
    sourceSummary,
    samples: [
      companyName,
      websiteUrl,
      primaryAddress,
      ...services.slice(0, 8),
      ...products.slice(0, 6),
      ...pricingHints.slice(0, 4),
      ...policyHighlights.slice(0, 4),
      ...faqItems.slice(0, 4).flatMap((x) => [x.question, x.answer]),
      supportMode,
      pricingPolicy,
    ],
  });

  const summaryShort = buildSummaryShort({
    shortClusters: clusterMap.summary_short,
    longClusters: clusterMap.summary_long,
    services,
    companyName,
    language: mainLanguage,
  });

  const summaryLong = buildSummaryLong({
    longClusters: clusterMap.summary_long,
    shortSummary: summaryShort,
    services,
    products,
    companyName,
    primaryEmail,
    primaryPhone,
    language: mainLanguage,
  });

  const confidenceInputs = [
    { weight: 0.24, value: companyPick.cluster?.score || 0 },
    { weight: 0.16, value: websitePick.cluster?.score || 0 },
    { weight: 0.16, value: emailPick.cluster?.score || 0 },
    { weight: 0.16, value: phonePick.cluster?.score || 0 },
    { weight: 0.14, value: addressPick.cluster?.score || 0 },
    {
      weight: 0.14,
      value: summaryShort
        ? chooseSummary(clusterMap.summary_short, { minLength: 40, maxLength: 420 }).cluster
            ?.score ||
          chooseSummary(clusterMap.summary_long, { minLength: 60, maxLength: 1200 }).cluster
            ?.score ||
          0
        : 0,
    },
  ].filter((x) => x.value > 0);

  const weightedConfidence = confidenceInputs.length
    ? confidenceInputs.reduce((sum, item) => sum + item.value * item.weight, 0) /
      confidenceInputs.reduce((sum, item) => sum + item.weight, 0)
    : 0.56;

  return {
    companyName,
    displayName: companyName,
    companyTitle: companyName,
    businessNames,
    websiteUrl,

    summaryShort,
    summaryLong,
    companySummaryShort: summaryShort,
    companySummaryLong: summaryLong,

    primaryPhone,
    primaryEmail,
    primaryAddress,
    phones,
    emails,
    addresses,

    services,
    products,
    pricingHints,
    policyHighlights,
    pricingPolicy,
    supportMode,
    hours,
    socialLinks,
    bookingLinks,
    whatsappLinks,
    faqItems,

    mainLanguage,
    supportedLanguages: [mainLanguage],

    sourceSummary,
    confidence: normalizeConfidence(weightedConfidence, 0.56),
    confidenceLabel: confidenceLabel(weightedConfidence),
  };
}

export { summarizeSources, synthesizeProfile };
