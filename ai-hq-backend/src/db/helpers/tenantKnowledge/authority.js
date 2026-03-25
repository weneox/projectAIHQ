import {
  s,
  arr,
  obj,
  lower,
  uniq,
  normalizeConfidence,
  normalizeConfidenceLabel,
} from "./shared.js";

const SOURCE_AUTHORITY_PROFILES = {
  manual: {
    rank: 100,
    authorityClass: "manual",
  },
  manual_override: {
    rank: 100,
    authorityClass: "manual",
  },
  approved_projection: {
    rank: 95,
    authorityClass: "manual",
  },

  instagram: {
    rank: 90,
    authorityClass: "official_connected",
  },
  facebook: {
    rank: 90,
    authorityClass: "official_connected",
  },
  facebook_page: {
    rank: 90,
    authorityClass: "official_connected",
  },
  messenger: {
    rank: 90,
    authorityClass: "official_connected",
  },
  whatsapp_business: {
    rank: 90,
    authorityClass: "official_connected",
  },

  website: {
    rank: 85,
    authorityClass: "website",
  },

  google_business_profile: {
    rank: 80,
    authorityClass: "structured_public",
  },
  google_places: {
    rank: 80,
    authorityClass: "structured_public",
  },

  google_maps: {
    rank: 40,
    authorityClass: "weak_public",
  },

  default: {
    rank: 50,
    authorityClass: "unknown",
  },
};

export function normalizeAuthoritySourceType(value = "") {
  const x = lower(value);

  const aliases = {
    ig: "instagram",
    insta: "instagram",
    fb: "facebook",
    facebookpage: "facebook_page",
    facebook_messenger: "messenger",
    whatsapp: "whatsapp_business",
    wa: "whatsapp_business",
    gbp: "google_business_profile",
    google_business: "google_business_profile",
    google_business_listing: "google_business_profile",
    places: "google_places",
  };

  return aliases[x] || x || "default";
}

export function getSourceAuthorityProfile(sourceType = "") {
  const key = normalizeAuthoritySourceType(sourceType);
  return {
    sourceType: key,
    ...(SOURCE_AUTHORITY_PROFILES[key] || SOURCE_AUTHORITY_PROFILES.default),
  };
}

export function getCandidateEvidenceRecords(candidate = {}) {
  return arr(candidate.source_evidence_json)
    .map((item) => ({
      source_type: normalizeAuthoritySourceType(
        item?.source_type || item?.sourceType || item?.source || item?.provider
      ),
      confidence: normalizeConfidence(item?.confidence, 0),
      page_url: s(item?.page_url || item?.pageUrl),
      evidence_text: s(item?.evidence_text || item?.evidenceText),
    }))
    .filter(
      (item) =>
        item.source_type || item.page_url || item.evidence_text || item.confidence > 0
    );
}

export function summarizeCandidateAuthority(candidate = {}) {
  const evidence = getCandidateEvidenceRecords(candidate);
  const sourceTypes = uniq(
    evidence.map((item) => normalizeAuthoritySourceType(item.source_type)).filter(Boolean)
  );

  const profiles = sourceTypes.map((item) => getSourceAuthorityProfile(item));
  const sortedProfiles = [...profiles].sort((a, b) => b.rank - a.rank);

  const strongest = sortedProfiles[0] || getSourceAuthorityProfile("default");

  const onlyWeakSources =
    sourceTypes.length > 0 &&
    sourceTypes.every(
      (item) => getSourceAuthorityProfile(item).authorityClass === "weak_public"
    );

  const hasOfficialConnected = sourceTypes.some(
    (item) => getSourceAuthorityProfile(item).authorityClass === "official_connected"
  );

  const hasWebsiteOrBetter = sourceTypes.some(
    (item) => getSourceAuthorityProfile(item).rank >= SOURCE_AUTHORITY_PROFILES.website.rank
  );

  const hasStructuredOrBetter = sourceTypes.some(
    (item) =>
      getSourceAuthorityProfile(item).rank >=
      SOURCE_AUTHORITY_PROFILES.google_places.rank
  );

  return {
    sourceTypes,
    evidence,
    strongestSourceType: strongest.sourceType,
    strongestAuthorityRank: strongest.rank,
    strongestAuthorityClass: strongest.authorityClass,
    onlyWeakSources,
    hasOfficialConnected,
    hasWebsiteOrBetter,
    hasStructuredOrBetter,
  };
}

export function canProjectWithRequirement(authority = {}, requirement = "structured_or_better") {
  if (authority.onlyWeakSources) return false;

  if (requirement === "website_or_official") {
    return authority.hasOfficialConnected || authority.hasWebsiteOrBetter;
  }

  if (requirement === "structured_or_better") {
    return authority.hasStructuredOrBetter;
  }

  if (requirement === "official_only") {
    return authority.hasOfficialConnected;
  }

  return false;
}

const PROFILE_PROJECTION_RULES = {
  companyName: "structured_or_better",
  displayName: "structured_or_better",
  legalName: "structured_or_better",
  websiteUrl: "structured_or_better",
  primaryPhone: "structured_or_better",
  primaryEmail: "structured_or_better",
  primaryAddress: "structured_or_better",

  summaryShort: "website_or_official",
  summaryLong: "website_or_official",
  valueProposition: "website_or_official",
  targetAudience: "website_or_official",
  toneProfile: "website_or_official",

  "profileJson.hours": "structured_or_better",

  "profileJson.services": "website_or_official",
  "profileJson.products": "website_or_official",
  "profileJson.pricingHints": "website_or_official",
  "profileJson.pricingPolicy": "website_or_official",
  "profileJson.supportMode": "website_or_official",
  "profileJson.socialLinks": "website_or_official",
  "profileJson.bookingLinks": "website_or_official",
  "profileJson.whatsappLinks": "website_or_official",
  "profileJson.faqItems": "website_or_official",
};

const CAPABILITY_PROJECTION_RULES = {
  canSharePrices: "website_or_official",
  canShareStartingPrices: "website_or_official",
  requiresHumanForCustomQuote: "website_or_official",
  pricingMode: "website_or_official",
  salesMode: "website_or_official",

  canCaptureLeads: "structured_or_better",
  canCapturePhone: "structured_or_better",
  canCaptureEmail: "structured_or_better",
  canOfferCallback: "structured_or_better",
  supportsEmail: "structured_or_better",

  canOfferBooking: "website_or_official",
  canOfferConsultation: "website_or_official",
  bookingMode: "website_or_official",

  replyStyle: "website_or_official",
  replyLength: "website_or_official",
  emojiLevel: "website_or_official",
  ctaStyle: "website_or_official",
};

export function sanitizeProjectedProfilePatchFromCandidate(candidate = {}, patch = {}) {
  const authority = summarizeCandidateAuthority(candidate);
  const skippedFields = [];

  const out = {
    tenantId: s(patch.tenantId),
    tenantKey: s(patch.tenantKey),
    profileStatus: s(patch.profileStatus || "approved"),
    confidence: normalizeConfidence(patch.confidence, 0),
    confidenceLabel: normalizeConfidenceLabel(patch.confidenceLabel),
  };

  const scalarFields = [
    "companyName",
    "displayName",
    "legalName",
    "websiteUrl",
    "primaryPhone",
    "primaryEmail",
    "primaryAddress",
    "summaryShort",
    "summaryLong",
    "valueProposition",
    "targetAudience",
    "toneProfile",
  ];

  for (const field of scalarFields) {
    const value = s(patch[field]);
    if (!value) continue;

    const requirement = PROFILE_PROJECTION_RULES[field] || "website_or_official";
    if (canProjectWithRequirement(authority, requirement)) {
      out[field] = value;
    } else {
      skippedFields.push(field);
    }
  }

  const profileJson = obj(patch.profileJson);
  const safeProfileJson = {};

  if (arr(profileJson.hours).length) {
    if (canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.hours"])) {
      safeProfileJson.hours = arr(profileJson.hours);
    } else {
      skippedFields.push("profileJson.hours");
    }
  }

  if (arr(profileJson.services).length) {
    if (canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.services"])) {
      safeProfileJson.services = arr(profileJson.services);
    } else {
      skippedFields.push("profileJson.services");
    }
  }

  if (arr(profileJson.products).length) {
    if (canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.products"])) {
      safeProfileJson.products = arr(profileJson.products);
    } else {
      skippedFields.push("profileJson.products");
    }
  }

  if (arr(profileJson.pricingHints).length) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.pricingHints"])
    ) {
      safeProfileJson.pricingHints = arr(profileJson.pricingHints);
    } else {
      skippedFields.push("profileJson.pricingHints");
    }
  }

  if (s(profileJson.pricingPolicy)) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.pricingPolicy"])
    ) {
      safeProfileJson.pricingPolicy = s(profileJson.pricingPolicy);
    } else {
      skippedFields.push("profileJson.pricingPolicy");
    }
  }

  if (s(profileJson.supportMode)) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.supportMode"])
    ) {
      safeProfileJson.supportMode = s(profileJson.supportMode);
    } else {
      skippedFields.push("profileJson.supportMode");
    }
  }

  if (arr(profileJson.socialLinks).length) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.socialLinks"])
    ) {
      safeProfileJson.socialLinks = arr(profileJson.socialLinks);
    } else {
      skippedFields.push("profileJson.socialLinks");
    }
  }

  if (arr(profileJson.bookingLinks).length) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.bookingLinks"])
    ) {
      safeProfileJson.bookingLinks = arr(profileJson.bookingLinks);
    } else {
      skippedFields.push("profileJson.bookingLinks");
    }
  }

  if (arr(profileJson.whatsappLinks).length) {
    if (
      canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.whatsappLinks"])
    ) {
      safeProfileJson.whatsappLinks = arr(profileJson.whatsappLinks);
    } else {
      skippedFields.push("profileJson.whatsappLinks");
    }
  }

  if (arr(profileJson.faqItems).length) {
    if (canProjectWithRequirement(authority, PROFILE_PROJECTION_RULES["profileJson.faqItems"])) {
      safeProfileJson.faqItems = arr(profileJson.faqItems);
    } else {
      skippedFields.push("profileJson.faqItems");
    }
  }

  if (Object.keys(safeProfileJson).length) {
    out.profileJson = safeProfileJson;
  }

  return {
    authority,
    skippedFields,
    patch: out,
  };
}

export function sanitizeProjectedCapabilitiesPatchFromCandidate(candidate = {}, patch = {}) {
  const authority = summarizeCandidateAuthority(candidate);
  const skippedFields = [];

  const out = {
    tenantId: s(patch.tenantId),
    tenantKey: s(patch.tenantKey),
    writeIntent: "approved_projection",
    approvedBy: s(patch.approvedBy),
  };

  const fields = [
    "canSharePrices",
    "canShareStartingPrices",
    "requiresHumanForCustomQuote",
    "pricingMode",
    "salesMode",

    "canCaptureLeads",
    "canCapturePhone",
    "canCaptureEmail",
    "canOfferCallback",
    "supportsEmail",

    "canOfferBooking",
    "canOfferConsultation",
    "bookingMode",

    "replyStyle",
    "replyLength",
    "emojiLevel",
    "ctaStyle",
  ];

  for (const field of fields) {
    const value = patch[field];

    if (value === undefined || value === null || value === "") continue;

    const requirement = CAPABILITY_PROJECTION_RULES[field] || "website_or_official";
    if (canProjectWithRequirement(authority, requirement)) {
      out[field] = value;
    } else {
      skippedFields.push(field);
    }
  }

  return {
    authority,
    skippedFields,
    patch: out,
  };
}

export function hasMeaningfulProfileProjectionPatch(patch = {}) {
  const profileJson = obj(patch.profileJson);

  return Boolean(
    s(patch.companyName) ||
      s(patch.displayName) ||
      s(patch.legalName) ||
      s(patch.websiteUrl) ||
      s(patch.primaryPhone) ||
      s(patch.primaryEmail) ||
      s(patch.primaryAddress) ||
      s(patch.summaryShort) ||
      s(patch.summaryLong) ||
      s(patch.valueProposition) ||
      s(patch.targetAudience) ||
      s(patch.toneProfile) ||
      arr(profileJson.hours).length ||
      arr(profileJson.services).length ||
      arr(profileJson.products).length ||
      arr(profileJson.pricingHints).length ||
      s(profileJson.pricingPolicy) ||
      s(profileJson.supportMode) ||
      arr(profileJson.socialLinks).length ||
      arr(profileJson.bookingLinks).length ||
      arr(profileJson.whatsappLinks).length ||
      arr(profileJson.faqItems).length
  );
}

export function hasMeaningfulCapabilitiesProjectionPatch(patch = {}) {
  return Object.keys(obj(patch)).some(
    (key) =>
      !["tenantId", "tenantKey", "writeIntent", "approvedBy"].includes(key) &&
      patch[key] !== undefined &&
      patch[key] !== null &&
      patch[key] !== ""
  );
}