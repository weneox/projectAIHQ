// src/services/sourceFusion/policies.js
// FINAL v3.0 — source authority and claim selection policies

import { arr, lower, normalizeConfidence, s } from "./shared.js";

const SOURCE_PROFILES = {
  manual: {
    rank: 100,
    weight: 1.0,
    trustClass: "manual",
    weak: false,
  },
  website: {
    rank: 92,
    weight: 0.96,
    trustClass: "authoritative_public",
    weak: false,
  },
  google_business_profile: {
    rank: 88,
    weight: 0.93,
    trustClass: "structured_public",
    weak: false,
  },
  google_places: {
    rank: 88,
    weight: 0.93,
    trustClass: "structured_public",
    weak: false,
  },
  whatsapp_business: {
    rank: 86,
    weight: 0.9,
    trustClass: "official_connected",
    weak: false,
  },
  instagram: {
    rank: 82,
    weight: 0.86,
    trustClass: "official_connected",
    weak: false,
  },
  facebook: {
    rank: 81,
    weight: 0.85,
    trustClass: "official_connected",
    weak: false,
  },
  facebook_page: {
    rank: 81,
    weight: 0.85,
    trustClass: "official_connected",
    weak: false,
  },
  messenger: {
    rank: 81,
    weight: 0.85,
    trustClass: "official_connected",
    weak: false,
  },
  google_maps: {
    rank: 58,
    weight: 0.62,
    trustClass: "weak_public",
    weak: true,
  },
  default: {
    rank: 70,
    weight: 0.74,
    trustClass: "unknown",
    weak: false,
  },
};

const CLAIM_POLICIES = {
  company_name: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "instagram",
      "facebook",
      "whatsapp_business",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.12,
  },
  website_url: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "whatsapp_business",
      "instagram",
      "facebook",
      "google_maps",
    ],
    minClusterScore: 0.52,
    weakOnlyPenalty: 0.2,
  },
  summary_short: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "google_business_profile",
      "google_places",
      "google_maps",
    ],
    minClusterScore: 0.45,
    weakOnlyPenalty: 0.16,
  },
  summary_long: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "google_business_profile",
      "google_places",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.16,
  },
  primary_phone: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "whatsapp_business",
      "instagram",
      "google_maps",
    ],
    minClusterScore: 0.5,
    weakOnlyPenalty: 0.08,
  },
  primary_email: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "whatsapp_business",
      "instagram",
      "google_maps",
    ],
    minClusterScore: 0.55,
    weakOnlyPenalty: 0.08,
  },
  primary_address: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "instagram",
      "google_maps",
    ],
    minClusterScore: 0.46,
    weakOnlyPenalty: 0.1,
  },
  pricing_policy: {
    sourcePriority: [
      "manual",
      "website",
      "whatsapp_business",
      "instagram",
      "facebook",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.16,
  },
  support_mode: {
    sourcePriority: [
      "manual",
      "website",
      "whatsapp_business",
      "instagram",
      "facebook",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.12,
  },
  working_hours: {
    sourcePriority: [
      "manual",
      "website",
      "google_business_profile",
      "google_places",
      "whatsapp_business",
      "google_maps",
    ],
    minClusterScore: 0.48,
    weakOnlyPenalty: 0.08,
  },
  service: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "google_business_profile",
      "google_places",
      "google_maps",
    ],
    minClusterScore: 0.44,
    weakOnlyPenalty: 0.12,
  },
  product: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "google_business_profile",
      "google_places",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.12,
  },
  pricing_hint: {
    sourcePriority: ["manual", "website", "instagram", "facebook", "google_maps"],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.14,
  },
  social_link: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "whatsapp_business",
      "google_maps",
    ],
    minClusterScore: 0.48,
    weakOnlyPenalty: 0.08,
  },
  booking_link: {
    sourcePriority: [
      "manual",
      "website",
      "whatsapp_business",
      "instagram",
      "facebook",
      "google_maps",
    ],
    minClusterScore: 0.48,
    weakOnlyPenalty: 0.1,
  },
  whatsapp_link: {
    sourcePriority: [
      "manual",
      "website",
      "whatsapp_business",
      "instagram",
      "facebook",
      "google_maps",
    ],
    minClusterScore: 0.5,
    weakOnlyPenalty: 0.08,
  },
  faq: {
    sourcePriority: ["manual", "website", "instagram", "facebook", "google_maps"],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.12,
  },
  default: {
    sourcePriority: [
      "manual",
      "website",
      "instagram",
      "facebook",
      "whatsapp_business",
      "google_maps",
    ],
    minClusterScore: 0.42,
    weakOnlyPenalty: 0.12,
  },
};

function getSourceProfile(sourceType = "") {
  const key = lower(sourceType);
  return SOURCE_PROFILES[key] || SOURCE_PROFILES.default;
}

function sourceWeight(sourceType = "") {
  return normalizeConfidence(getSourceProfile(sourceType).weight, 0.74);
}

function sourceRank(sourceType = "") {
  return Number(getSourceProfile(sourceType).rank || 0);
}

function isWeakSourceType(sourceType = "") {
  return !!getSourceProfile(sourceType).weak;
}

function claimPolicy(claimType = "") {
  return CLAIM_POLICIES[lower(claimType)] || CLAIM_POLICIES.default;
}

function sourcePriorityIndex(claimType = "", sourceType = "") {
  const policy = claimPolicy(claimType);
  const key = lower(sourceType);
  const idx = arr(policy.sourcePriority).findIndex((x) => lower(x) === key);
  return idx >= 0 ? idx : arr(policy.sourcePriority).length + 10;
}

function sourcePriorityScore(claimType = "", sourceType = "") {
  const policy = claimPolicy(claimType);
  const size = Math.max(1, arr(policy.sourcePriority).length);
  const idx = sourcePriorityIndex(claimType, sourceType);
  return Math.max(0, (size - Math.min(idx, size)) / size);
}

function isProtectedScalarClaim(claimType = "") {
  return new Set([
    "company_name",
    "website_url",
    "summary_short",
    "summary_long",
    "primary_phone",
    "primary_email",
    "primary_address",
    "pricing_policy",
    "support_mode",
  ]).has(lower(claimType));
}

function isListClaim(claimType = "") {
  return new Set([
    "service",
    "product",
    "pricing_hint",
    "working_hours",
    "social_link",
    "booking_link",
    "whatsapp_link",
    "faq",
  ]).has(lower(claimType));
}

export {
  CLAIM_POLICIES,
  SOURCE_PROFILES,
  claimPolicy,
  getSourceProfile,
  isListClaim,
  isProtectedScalarClaim,
  isWeakSourceType,
  sourcePriorityIndex,
  sourcePriorityScore,
  sourceRank,
  sourceWeight,
};
