// src/services/sourceFusion/synthesisRoot.js
// FINAL v6.0 — final synthesis entry
// stronger deterministic business draft synthesis + profile-level review metadata

import { arr, compactText, confidenceLabel, normalizeConfidence } from "./shared.js";
import {
  buildSelectedClaims,
  detectConflicts,
  groupObservationsByClaimType,
} from "./clustering.js";
import { summarizeSources, synthesizeProfile } from "./profile.js";
import { synthesizeCapabilities } from "./capabilities.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function getLocalePack(lang = "en") {
  const normalized = ["az", "tr", "ru", "en"].includes(lower(lang))
    ? lower(lang)
    : "en";

  const packs = {
    az: {
      services: "Xidmətlər",
      products: "Məhsullar",
      email: "Email",
      phone: "Telefon",
      weakAddress: "ünvan_zəifdir",
      weakSummary: "təsvir_zəifdir",
      weakServices: "xidmətlər_zəifdir",
      weakPricing: "qiymət_zəifdir",
      weakSocial: "sosial_zəifdir",
      conflicts: "məlumat_ziddiyyəti",
      reviewRequired: "manual_yoxlama_tələb_olunur",
    },
    tr: {
      services: "Hizmetler",
      products: "Ürünler",
      email: "E-posta",
      phone: "Telefon",
      weakAddress: "adres_zayıf",
      weakSummary: "özet_zayıf",
      weakServices: "hizmetler_zayıf",
      weakPricing: "fiyatlama_zayıf",
      weakSocial: "sosyal_zayıf",
      conflicts: "veri_çakışması",
      reviewRequired: "manuel_inceleme_gerekli",
    },
    ru: {
      services: "Услуги",
      products: "Продукты",
      email: "Email",
      phone: "Телефон",
      weakAddress: "слабый_адрес",
      weakSummary: "слабое_описание",
      weakServices: "слабые_услуги",
      weakPricing: "слабое_ценообразование",
      weakSocial: "слабые_соцсети",
      conflicts: "конфликт_данных",
      reviewRequired: "нужна_ручная_проверка",
    },
    en: {
      services: "Services",
      products: "Products",
      email: "Email",
      phone: "Phone",
      weakAddress: "weak_address",
      weakSummary: "weak_summary",
      weakServices: "weak_services",
      weakPricing: "weak_pricing",
      weakSocial: "weak_social",
      conflicts: "data_conflict",
      reviewRequired: "manual_review_required",
    },
  };

  return packs[normalized] || packs.en;
}

function buildSynthesisMetrics({
  profile = {},
  selectedClaims = {},
  conflicts = [],
  sourceSummary = {},
} = {}) {
  return {
    sourceCount: Number(sourceSummary?.sourceCount || 0),
    runCount: Number(sourceSummary?.runCount || 0),
    serviceCount: arr(profile?.services).length,
    productCount: arr(profile?.products).length,
    faqCount: arr(profile?.faqItems).length,
    socialCount: arr(profile?.socialLinks).length,
    bookingCount: arr(profile?.bookingLinks).length,
    whatsappCount: arr(profile?.whatsappLinks).length,
    pricingHintCount: arr(profile?.pricingHints).length,
    hoursCount: arr(profile?.hours).length,
    addressCount: arr(profile?.addresses).length,
    emailCount: arr(profile?.emails).length,
    phoneCount: arr(profile?.phones).length,
    selectedClaimTypeCount: Object.keys(selectedClaims || {}).length,
    conflictCount: arr(conflicts).length,
    mainLanguage: s(profile?.mainLanguage || "en"),
  };
}

function buildReviewFlags({ profile = {}, conflicts = [], confidence = 0 }) {
  const language = lower(profile?.mainLanguage || "en");
  const t = getLocalePack(language);
  const flags = [];

  const summaryShort = s(profile?.summaryShort || profile?.companySummaryShort || "");
  const summaryLong = s(profile?.summaryLong || profile?.companySummaryLong || "");
  const primaryAddress = s(profile?.primaryAddress || "");
  const services = arr(profile?.services);
  const pricingHints = arr(profile?.pricingHints);
  const socialLinks = arr(profile?.socialLinks);

  if (!primaryAddress) flags.push(t.weakAddress);
  if (!summaryShort && !summaryLong) flags.push(t.weakSummary);
  if (!services.length) flags.push(t.weakServices);
  if (!pricingHints.length) flags.push(t.weakPricing);
  if (!socialLinks.length) flags.push(t.weakSocial);
  if (arr(conflicts).length) flags.push(t.conflicts);
  if (Number(confidence || 0) < 0.72) flags.push(t.reviewRequired);

  return [...new Set(flags)];
}

function buildSummaryText(profile = {}) {
  const language = lower(profile?.mainLanguage || "en");
  const t = getLocalePack(language);

  return compactText(
    [
      profile.companyName || profile.companyTitle || profile.displayName,
      profile.summaryShort || profile.companySummaryShort,
      arr(profile.services).length
        ? `${t.services}: ${profile.services.slice(0, 6).join(", ")}`
        : "",
      arr(profile.products).length
        ? `${t.products}: ${profile.products.slice(0, 4).join(", ")}`
        : "",
      profile.primaryEmail ? `${t.email}: ${profile.primaryEmail}` : "",
      profile.primaryPhone ? `${t.phone}: ${profile.primaryPhone}` : "",
    ]
      .filter(Boolean)
      .join(" — "),
    1500
  );
}

function buildFieldConfidenceMap({ profile = {}, confidence = 0, conflicts = [] } = {}) {
  const base = Number(confidence || 0);
  const hasConflicts = arr(conflicts).length > 0;

  function score(delta = 0, present = true) {
    const raw = present ? base + delta : base - 0.18;
    const adjusted = hasConflicts ? raw - 0.06 : raw;
    const normalized = normalizeConfidence(adjusted, 0.56);
    return {
      score: normalized,
      label: confidenceLabel(normalized),
    };
  }

  return {
    companyName: score(0.08, !!s(profile.companyName || profile.companyTitle)),
    websiteUrl: score(0.06, !!s(profile.websiteUrl)),
    summaryShort: score(0.02, !!s(profile.summaryShort || profile.companySummaryShort)),
    summaryLong: score(0.01, !!s(profile.summaryLong || profile.companySummaryLong)),
    primaryEmail: score(0.04, !!s(profile.primaryEmail)),
    primaryPhone: score(0.04, !!s(profile.primaryPhone)),
    primaryAddress: score(-0.02, !!s(profile.primaryAddress)),
    services: score(0.02, arr(profile.services).length > 0),
    pricingHints: score(-0.03, arr(profile.pricingHints).length > 0),
    socialLinks: score(-0.03, arr(profile.socialLinks).length > 0),
    faqItems: score(-0.01, arr(profile.faqItems).length > 0),
  };
}

function synthesizeTenantBusinessFromObservations({
  observations = [],
}) {
  const clusterMap = groupObservationsByClaimType(observations);
  const sourceSummary = summarizeSources(observations);
  const conflicts = detectConflicts(clusterMap);
  const baseProfile = synthesizeProfile({ clusterMap, sourceSummary });
  const capabilities = synthesizeCapabilities(baseProfile, sourceSummary);
  const selectedClaims = buildSelectedClaims(clusterMap);

  const confidence = normalizeConfidence(baseProfile.confidence, 0.56);
  const summaryText = buildSummaryText(baseProfile);
  const metrics = buildSynthesisMetrics({
    profile: baseProfile,
    selectedClaims,
    conflicts,
    sourceSummary,
  });

  const reviewFlags = buildReviewFlags({
    profile: baseProfile,
    conflicts,
    confidence,
  });

  const fieldConfidence = buildFieldConfidenceMap({
    profile: baseProfile,
    confidence,
    conflicts,
  });

  const reviewRequired =
    reviewFlags.length > 0 || confidence < 0.72 || arr(conflicts).length > 0;

  const profile = {
    ...baseProfile,
    reviewFlags,
    fieldConfidence,
    reviewRequired,
  };

  return {
    profile,
    capabilities,
    conflicts,
    sourceSummary,
    selectedClaims,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    summaryText,
    metrics,
    reviewFlags,
    fieldConfidence,
    reviewRequired,
  };
}

export { synthesizeTenantBusinessFromObservations };