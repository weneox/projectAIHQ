import {
  arr,
  lower,
  normalizeConfidence,
  obj,
  s,
  uniqStrings,
} from "./shared.js";
import { claimPolicy, getSourceProfile, sourceRank } from "./policies.js";
import { mapRuntimeAreasToAffectedSurfaces } from "./approvalPolicy.js";

const DEFAULT_FRESHNESS_POLICY = {
  freshDays: 21,
  reviewDays: 60,
  staleDays: 180,
};

const SOURCE_FRESHNESS_POLICY = {
  website: {
    freshDays: 14,
    reviewDays: 45,
    staleDays: 120,
  },
  instagram: {
    freshDays: 10,
    reviewDays: 30,
    staleDays: 90,
  },
  facebook: {
    freshDays: 10,
    reviewDays: 30,
    staleDays: 90,
  },
  facebook_page: {
    freshDays: 10,
    reviewDays: 30,
    staleDays: 90,
  },
  messenger: {
    freshDays: 10,
    reviewDays: 30,
    staleDays: 90,
  },
  whatsapp_business: {
    freshDays: 10,
    reviewDays: 30,
    staleDays: 90,
  },
  google_business_profile: {
    freshDays: 21,
    reviewDays: 60,
    staleDays: 180,
  },
  google_places: {
    freshDays: 21,
    reviewDays: 60,
    staleDays: 180,
  },
  google_maps: {
    freshDays: 7,
    reviewDays: 21,
    staleDays: 60,
  },
};

function toIsoDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    return "";
  }
}

function toTime(value) {
  const iso = toIsoDate(value);
  return iso ? new Date(iso).getTime() : 0;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function getSourceTrustProfile(sourceType = "") {
  const profile = getSourceProfile(sourceType);

  return {
    sourceType: lower(sourceType) || "unknown",
    trustTier: s(profile.trustTier || "unknown"),
    trustLabel: s(profile.trustLabel || profile.trustTier || "unknown"),
    trustScore: round(normalizeConfidence(profile.trustScore ?? profile.weight, 0)),
    authorityRank: sourceRank(sourceType),
    trustClass: s(profile.trustClass),
    weak: !!profile.weak,
  };
}

export function classifyClaimFreshness({
  sourceType = "",
  observedAt = "",
  referenceTime = Date.now(),
} = {}) {
  const policy = SOURCE_FRESHNESS_POLICY[lower(sourceType)] || DEFAULT_FRESHNESS_POLICY;
  const observedIso = toIsoDate(observedAt);

  if (!observedIso) {
    return {
      observedAt: "",
      ageDays: null,
      bucket: "unknown",
      stale: true,
      reviewRequired: true,
      policy,
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor((referenceTime - new Date(observedIso).getTime()) / 86400000)
  );

  let bucket = "fresh";
  if (ageDays > policy.staleDays) {
    bucket = "stale";
  } else if (ageDays > policy.reviewDays) {
    bucket = "aging";
  } else if (ageDays > policy.freshDays) {
    bucket = "review";
  }

  return {
    observedAt: observedIso,
    ageDays,
    bucket,
    stale: bucket === "stale",
    reviewRequired: bucket === "review" || bucket === "aging" || bucket === "stale",
    policy,
  };
}

function evidenceObservedAt(item = {}) {
  return (
    toIsoDate(item.last_seen_at || item.lastSeenAt) ||
    toIsoDate(item.first_seen_at || item.firstSeenAt) ||
    toIsoDate(item.metadata_json?.observedAt || item.metadataJson?.observedAt) ||
    toIsoDate(item.metadata_json?.capturedAt || item.metadataJson?.capturedAt) ||
    ""
  );
}

export function summarizeEvidenceGovernance(evidence = []) {
  const items = arr(evidence).map((item) => {
    const trust = getSourceTrustProfile(item.source_type || item.sourceType);
    const freshness = classifyClaimFreshness({
      sourceType: item.source_type || item.sourceType,
      observedAt: evidenceObservedAt(item),
    });

    return {
      sourceType: trust.sourceType,
      trustTier: trust.trustTier,
      trustLabel: trust.trustLabel,
      trustScore: trust.trustScore,
      authorityRank: trust.authorityRank,
      weak: trust.weak,
      freshness,
      sourceId: s(item.source_id || item.sourceId),
      sourceRunId: s(item.source_run_id || item.sourceRunId),
      observedAt: freshness.observedAt,
    };
  });

  const strongest =
    [...items].sort(
      (a, b) =>
        b.trustScore - a.trustScore ||
        b.authorityRank - a.authorityRank ||
        (b.freshness.ageDays ?? Number.MAX_SAFE_INTEGER) -
          (a.freshness.ageDays ?? Number.MAX_SAFE_INTEGER)
    )[0] || null;

  const observedTimes = items
    .map((item) => toTime(item.observedAt))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const freshest = observedTimes.length ? new Date(observedTimes[observedTimes.length - 1]).toISOString() : "";
  const stalest = observedTimes.length ? new Date(observedTimes[0]).toISOString() : "";

  const buckets = items.reduce((acc, item) => {
    const bucket = s(item.freshness.bucket || "unknown");
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  const uniqueSourceTypes = uniqStrings(items.map((item) => item.sourceType));
  const uniqueSourceIds = uniqStrings(items.map((item) => item.sourceId));
  const strongEvidenceCount = items.filter((item) => !item.weak).length;
  const staleEvidenceCount = items.filter((item) => item.freshness.stale).length;

  return {
    trust: {
      strongestTier: s(strongest?.trustTier),
      strongestSourceType: s(strongest?.sourceType),
      strongestTrustScore: round(strongest?.trustScore || 0),
      strongestAuthorityRank: Number(strongest?.authorityRank || 0),
      weakOnly: items.length > 0 && strongEvidenceCount === 0,
      sourceTypes: uniqueSourceTypes,
    },
    freshness: {
      freshestObservedAt: freshest,
      stalestObservedAt: stalest,
      bucket:
        buckets.fresh > 0
          ? "fresh"
          : buckets.review > 0
            ? "review"
            : buckets.aging > 0
              ? "aging"
              : buckets.stale > 0
                ? "stale"
                : "unknown",
      stale: items.length > 0 && staleEvidenceCount === items.length,
      buckets,
    },
    support: {
      evidenceCount: items.length,
      uniqueSourceCount: uniqueSourceIds.length || uniqueSourceTypes.length,
      strongEvidenceCount,
      staleEvidenceCount,
    },
  };
}

export function classifyConflictOutcome({
  claimType = "",
  winner = null,
  runnerUp = null,
} = {}) {
  if (!winner || !runnerUp) {
    return {
      classification: "insufficient_support",
      resolution: "review_required",
      reviewRequired: true,
    };
  }

  const scoreGap = normalizeConfidence(winner.score, 0) - normalizeConfidence(runnerUp.score, 0);
  const rankGap = Number(winner.bestSourceRank || 0) - Number(runnerUp.bestSourceRank || 0);
  const winnerFreshness = obj(winner.governance?.freshness);
  const runnerFreshness = obj(runnerUp.governance?.freshness);
  const winnerSupport = obj(winner.governance?.support);
  const runnerSupport = obj(runnerUp.governance?.support);
  const minScore = claimPolicy(claimType).minClusterScore;

  if (
    winnerFreshness.stale !== true &&
    runnerFreshness.stale === true &&
    scoreGap >= -0.02
  ) {
    return {
      classification: "stale_source_loses",
      resolution: "winner_selected",
      reviewRequired: false,
    };
  }

  if (
    rankGap >= 8 &&
    (scoreGap >= -0.03 || winnerSupport.strongEvidenceCount > runnerSupport.strongEvidenceCount)
  ) {
    return {
      classification: "stronger_source_wins",
      resolution: "winner_selected",
      reviewRequired: false,
    };
  }

  if (
    Math.max(normalizeConfidence(winner.score, 0), normalizeConfidence(runnerUp.score, 0)) <
      minScore + 0.08 &&
    Math.max(
      Number(winnerSupport.uniqueSourceCount || 0),
      Number(runnerSupport.uniqueSourceCount || 0)
    ) < 2
  ) {
    return {
      classification: "insufficient_support",
      resolution: "review_required",
      reviewRequired: true,
    };
  }

  return {
    classification: "conflicting_but_reviewable",
    resolution: "review_required",
    reviewRequired: true,
  };
}

export function buildClaimGovernance({
  claimType = "",
  score = 0,
  evidence = [],
  onlyWeakSources = false,
  conflict = null,
} = {}) {
  const normalizedScore = normalizeConfidence(score, 0);
  const policy = claimPolicy(claimType);
  const evidenceSummary = summarizeEvidenceGovernance(evidence);
  const reasons = [];

  if (normalizedScore < policy.minClusterScore + 0.06) reasons.push("low_score");
  if (onlyWeakSources) reasons.push("weak_only_sources");
  if (Number(evidenceSummary.support.uniqueSourceCount || 0) < 2) reasons.push("limited_support");
  if (evidenceSummary.freshness.stale) reasons.push("stale_signal");

  const conflictSummary = obj(conflict);
  if (s(conflictSummary.classification) === "insufficient_support") {
    reasons.push("insufficient_support");
  }
  if (s(conflictSummary.classification) === "conflicting_but_reviewable") {
    reasons.push("reviewable_conflict");
  }

  const quarantine =
    normalizedScore < policy.minClusterScore + 0.03 ||
    (onlyWeakSources && Number(evidenceSummary.support.uniqueSourceCount || 0) < 2) ||
    (evidenceSummary.freshness.stale &&
      Number(evidenceSummary.support.strongEvidenceCount || 0) === 0) ||
    ["insufficient_support", "conflicting_but_reviewable"].includes(
      s(conflictSummary.classification)
    );

  return {
    trust: evidenceSummary.trust,
    freshness: evidenceSummary.freshness,
    support: evidenceSummary.support,
    conflict: conflictSummary,
    promotable: !quarantine,
    quarantine,
    disposition: quarantine ? "quarantined" : "promotable",
    quarantineReasons: uniqStrings(reasons),
  };
}

export function buildCandidateImpact({
  category = "",
  itemKey = "",
} = {}) {
  const safeCategory = lower(category);
  const safeItemKey = lower(itemKey);
  const canonicalPaths = [];
  const runtimePaths = [];
  const canonicalAreas = new Set();
  const runtimeAreas = new Set();

  function addImpact({ canonicalArea, canonicalPath, runtimeArea, runtimePath }) {
    if (canonicalArea) canonicalAreas.add(canonicalArea);
    if (runtimeArea) runtimeAreas.add(runtimeArea);
    if (canonicalPath) canonicalPaths.push(canonicalPath);
    if (runtimePath) runtimePaths.push(runtimePath);
  }

  if (safeCategory === "company" && safeItemKey === "canonical_company_name") {
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: "profile.companyName",
      runtimeArea: "tenant_identity",
      runtimePath: "runtime.business.identity.name",
    });
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: "profile.displayName",
      runtimeArea: "tenant_identity",
      runtimePath: "runtime.business.identity.displayName",
    });
  } else if (safeCategory === "company" && safeItemKey === "canonical_website_url") {
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: "profile.websiteUrl",
      runtimeArea: "tenant_profile",
      runtimePath: "runtime.business.profile.websiteUrl",
    });
  } else if (safeCategory === "summary") {
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: safeItemKey.includes("long") ? "profile.summaryLong" : "profile.summaryShort",
      runtimeArea: "tenant_profile",
      runtimePath: safeItemKey.includes("long")
        ? "runtime.business.profile.summaryLong"
        : "runtime.business.profile.summaryShort",
    });
  } else if (safeCategory === "contact") {
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: safeItemKey.startsWith("email_")
        ? "profile.primaryEmail"
        : safeItemKey.startsWith("phone_")
          ? "profile.primaryPhone"
          : "profile.contact",
      runtimeArea: "contact_channels",
      runtimePath: safeItemKey.startsWith("email_")
        ? "runtime.business.contacts.primaryEmail"
        : safeItemKey.startsWith("phone_")
          ? "runtime.business.contacts.primaryPhone"
          : "runtime.business.contacts",
    });
  } else if (safeCategory === "location") {
    addImpact({
      canonicalArea: "business_profile",
      canonicalPath: "profile.primaryAddress",
      runtimeArea: "contact_channels",
      runtimePath: "runtime.business.contacts.primaryAddress",
    });
  } else if (["service", "product", "pricing", "pricing_policy", "support"].includes(safeCategory)) {
    addImpact({
      canonicalArea: "offerings",
      canonicalPath: `knowledge.${safeCategory}.${safeItemKey || "entry"}`,
      runtimeArea: "offerings",
      runtimePath: `runtime.business.offerings.${safeCategory}`,
    });
  } else if (["hours", "social_link", "booking"].includes(safeCategory)) {
    addImpact({
      canonicalArea: "channels",
      canonicalPath: `knowledge.${safeCategory}.${safeItemKey || "entry"}`,
      runtimeArea: "channels",
      runtimePath: `runtime.business.channels.${safeCategory}`,
    });
  } else if (safeCategory === "faq") {
    addImpact({
      canonicalArea: "knowledge",
      canonicalPath: `knowledge.faq.${safeItemKey || "entry"}`,
      runtimeArea: "knowledge",
      runtimePath: "runtime.business.knowledge.faq",
    });
  }

  return {
    canonicalAreas: [...canonicalAreas],
    runtimeAreas: [...runtimeAreas],
    canonicalPaths: uniqStrings(canonicalPaths),
    runtimePaths: uniqStrings(runtimePaths),
    affectedSurfaces: mapRuntimeAreasToAffectedSurfaces([...runtimeAreas]),
  };
}

export function buildFinalizeImpactSummary({
  draft = {},
} = {}) {
  const canonicalAreas = new Set();
  const runtimeAreas = new Set();
  const canonicalPaths = [];
  const runtimePaths = [];

  const businessProfile = obj(draft.businessProfile);
  for (const field of Object.keys(businessProfile)) {
    if (field === "fieldSources") continue;
    canonicalAreas.add("business_profile");
    canonicalPaths.push(`profile.${field}`);
    if (field === "nicheBehavior" || field === "niche_behavior") {
      runtimeAreas.add("behavioral_policy");
      runtimePaths.push("runtime.business.behavior");
      continue;
    }
    runtimeAreas.add("tenant_profile");
    runtimePaths.push(`runtime.business.profile.${field}`);
  }

  const capabilities = obj(draft.capabilities);
  for (const field of Object.keys(capabilities)) {
    canonicalAreas.add("business_capabilities");
    canonicalPaths.push(`capabilities.${field}`);
    runtimeAreas.add("behavioral_policy");
    runtimePaths.push(`runtime.business.capabilities.${field}`);
  }

  if (arr(draft.services).length) {
    canonicalAreas.add("services");
    canonicalPaths.push("services");
    runtimeAreas.add("offerings");
    runtimePaths.push("runtime.business.offerings.services");
  }

  if (arr(draft.knowledgeItems).length) {
    canonicalAreas.add("knowledge");
    canonicalPaths.push("knowledgeItems");
    runtimeAreas.add("knowledge");
    runtimePaths.push("runtime.business.knowledge");
  }

  return {
    canonicalAreas: [...canonicalAreas],
    runtimeAreas: [...runtimeAreas],
    canonicalPaths: uniqStrings(canonicalPaths),
    runtimePaths: uniqStrings(runtimePaths),
    affectedSurfaces: mapRuntimeAreasToAffectedSurfaces([...runtimeAreas]),
    counts: {
      businessProfileFields: Object.keys(businessProfile).filter((key) => key !== "fieldSources").length,
      capabilityFields: Object.keys(capabilities).length,
      services: arr(draft.services).length,
      knowledgeItems: arr(draft.knowledgeItems).length,
    },
  };
}

export const __test__ = {
  classifyClaimFreshness,
  buildCandidateImpact,
  buildClaimGovernance,
  buildFinalizeImpactSummary,
  classifyConflictOutcome,
  getSourceTrustProfile,
  summarizeEvidenceGovernance,
};
