import {
  arr,
  obj,
  s,
  candidateTitle,
  candidateCategory,
  candidateValue,
} from "../lib/setupStudioHelpers.js";
import {
  resolveMainLanguageValue,
  normalizeIncomingSourceType,
} from "./shared.js";
import { extractBehaviorProfile, normalizeBehaviorProfile } from "../logic/behaviorProfile.js";

const GENERIC_BUSINESS_NAME_VALUES = new Set([
  "google maps",
  "maps",
  "website",
  "services",
  "service",
  "products",
  "product",
  "business",
  "company",
  "home",
  "contact",
  "pricing",
  "faq",
  "faqs",
  "policy",
  "policies",
  "instagram",
  "facebook",
  "linkedin",
  "google",
  "source",
]);

const GENERIC_SUMMARY_VALUES = new Set([
  "home",
  "contact",
  "about",
  "services",
  "products",
  "pricing",
  "faq",
  "policy",
  "policies",
  "website",
  "google maps",
  "instagram",
  "facebook",
  "linkedin",
]);

const GENERIC_CONTACT_VALUES = new Set([
  "contact",
  "email",
  "mail",
  "phone",
  "telephone",
  "mobile",
  "address",
  "location",
  "website",
  "google maps",
  "instagram",
  "facebook",
  "linkedin",
]);

function normalizeToken(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|/\\]+/g, " ")
    .trim();
}

function normalizeContactToken(value = "") {
  return normalizeToken(value).replace(/[()]/g, "").trim();
}

function isLikelyUrl(value = "") {
  const text = s(value);
  return /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(text);
}

function isGenericSourceLabel(value = "") {
  const normalized = normalizeToken(value);
  if (!normalized) return true;
  if (GENERIC_BUSINESS_NAME_VALUES.has(normalized)) return true;
  if (
    /^(google|instagram|facebook|linkedin)(\s+(maps|page|profile|account))?$/i.test(
      normalized
    )
  ) {
    return true;
  }
  if (
    /^(website|source|business|company)(\s+(profile|page|details|info))?$/i.test(
      normalized
    )
  ) {
    return true;
  }
  return false;
}

function looksLikeEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(value));
}

function looksLikePhone(value = "") {
  const digits = s(value).replace(/[^\d+]/g, "");
  return digits.length >= 7;
}

export function sanitizeExtractedBusinessName(value = "") {
  const text = s(value);
  const normalized = normalizeToken(text);

  if (!text) return "";
  if (isLikelyUrl(text)) return "";
  if (text.length <= 2) return "";
  if (isGenericSourceLabel(normalized)) return "";
  if (/^(home|contact|about|pricing|faq|policy|policies)$/i.test(normalized)) {
    return "";
  }

  return text;
}

export function sanitizeExtractedBusinessSummary(value = "", companyName = "") {
  const text = s(value);
  const normalized = normalizeToken(text);
  const safeCompanyName = normalizeToken(companyName);

  if (!text) return "";
  if (text.length < 24) return "";
  if (isLikelyUrl(text)) return "";
  if (GENERIC_SUMMARY_VALUES.has(normalized)) return "";
  if (safeCompanyName && normalized === safeCompanyName) return "";
  if (
    /^(services?|products?|pricing|faq|contact|about|policy|policies)$/i.test(
      normalized
    )
  ) {
    return "";
  }

  return text;
}

export function sanitizeExtractedContactValue(value = "", type = "generic") {
  const text = s(value);
  const normalized = normalizeContactToken(text);

  if (!text) return "";
  if (text.length <= 2) return "";
  if (GENERIC_CONTACT_VALUES.has(normalized)) return "";
  if (isGenericSourceLabel(normalized)) return "";
  if (type === "email" && !looksLikeEmail(text)) return "";
  if (type === "phone" && !looksLikePhone(text)) return "";

  return text;
}

export function sanitizeExtractedAddress(value = "") {
  const text = s(value);
  const normalized = normalizeContactToken(text);

  if (!text) return "";
  if (text.length < 6) return "";
  if (GENERIC_CONTACT_VALUES.has(normalized)) return "";
  if (isGenericSourceLabel(normalized)) return "";
  if (/^(home|contact|direction|location|map|maps)$/i.test(normalized)) {
    return "";
  }

  return text;
}

export function deriveSuggestedServicePayload({
  discoveryForm,
  discoveryState,
  knowledgeCandidates,
}) {
  const serviceCandidate = knowledgeCandidates.find((item) => {
    const category = s(candidateCategory(item)).toLowerCase();
    return category === "service" || category === "product";
  });

  const discoveredServices = arr(
    discoveryState?.profile?.services ||
      discoveryState?.signals?.sourceFusion?.profile?.services ||
      discoveryState?.signals?.website?.offerings?.services
  );

  const fallbackTitle =
    s(candidateTitle(serviceCandidate)) ||
    s(discoveredServices[0]) ||
    s(discoveryForm.note.split(".")[0]) ||
    "Discovered service";

  const fallbackDescription =
    s(candidateValue(serviceCandidate)) ||
    s(discoveryForm.note) ||
    s(
      discoveryState?.profile?.summaryShort ||
        discoveryState?.profile?.companySummaryShort ||
        discoveryState?.profile?.description
    ) ||
    `Service discovered from ${s(discoveryState?.lastUrl || "source import")}.`;

  const category = (() => {
    const raw = s(candidateCategory(serviceCandidate)).toLowerCase();
    if (raw === "service" || raw === "product") return raw;
    return "general";
  })();

  return {
    title: fallbackTitle,
    description: fallbackDescription,
    category,
    priceFrom: "",
    currency: "AZN",
    pricingModel: "custom_quote",
    durationMinutes: "",
    sortOrder: 0,
    highlightsText: "",
    isActive: true,
  };
}

export function formFromProfile(profile = {}, prev = {}) {
  const x = obj(profile);
  const behavior = extractBehaviorProfile(x, prev.behavior);
  const rawCompanyName = s(
    x.companyName ||
      x.company_name ||
      x.displayName ||
      x.display_name ||
      x.name
  );
  const safeCompanyName = sanitizeExtractedBusinessName(rawCompanyName);
  const safeDescription = sanitizeExtractedBusinessSummary(
    x.summaryShort ||
      x.summary_short ||
      x.summaryLong ||
      x.summary_long ||
      x.description,
    safeCompanyName
  );
  const resolvedLanguage =
    resolveMainLanguageValue(
      x.mainLanguage,
      x.main_language,
      x.primaryLanguage,
      x.primary_language,
      x.language,
      x.sourceLanguage,
      x.source_language
    ) || s(prev.language || "en");
  const safePhone = sanitizeExtractedContactValue(
    x.primaryPhone || x.primary_phone || x.phone,
    "phone"
  );
  const safeEmail = sanitizeExtractedContactValue(
    x.primaryEmail || x.primary_email || x.email,
    "email"
  );
  const safeAddress = sanitizeExtractedAddress(
    x.primaryAddress || x.primary_address || x.address
  );

  return {
    ...prev,
    companyName: s(
      safeCompanyName || (!rawCompanyName ? prev.companyName : "")
    ),
    description: s(safeDescription || prev.description),
    timezone: s(x.timezone || prev.timezone || "Asia/Baku"),
    language: resolvedLanguage,
    websiteUrl: s(
      x.websiteUrl ||
        x.website_url ||
        x.siteUrl ||
        x.site_url ||
        prev.websiteUrl
    ),
    primaryPhone: s(safePhone || prev.primaryPhone),
    primaryEmail: s(safeEmail || prev.primaryEmail),
    primaryAddress: s(safeAddress || prev.primaryAddress),
    behavior,
  };
}

export function hasExtractedIdentityProfile(profile = {}) {
  const x = obj(profile);
  const extractedName = extractProfileName(x);
  const extractedSummary = extractProfileSummary(x);

  return !!(
    extractedName ||
    extractedSummary ||
    sanitizeExtractedContactValue(
      x.primaryPhone || x.primary_phone || x.phone,
      "phone"
    ) ||
    sanitizeExtractedContactValue(
      x.primaryEmail || x.primary_email || x.email,
      "email"
    ) ||
    sanitizeExtractedAddress(
      x.primaryAddress || x.primary_address || x.address
    ) ||
    arr(x.services).length > 0 ||
    arr(x.socialLinks || x.social_links).length > 0 ||
    arr(x.faqItems || x.faq_items).length > 0 ||
    arr(x.pricingHints || x.pricing_hints).length > 0
  );
}

export function isWebsiteBarrierWarning(value = "") {
  const code = s(value).toLowerCase();
  return (
    /^http_\d{3}$/.test(code) ||
    [
      "fetch_failed",
      "backend_access_blocked_by_remote_site",
      "remote_site_rate_limited_backend_access",
      "remote_site_temporarily_unavailable",
      "backend_could_not_reach_site",
      "non_html_website_response",
      "website_entry_not_found",
      "website_fetch_barrier_detected",
    ].includes(code)
  );
}

export function isBarrierOnlyImportResult(result = {}, sourceType = "") {
  if (normalizeIncomingSourceType(sourceType) !== "website") return false;

  const mode = s(result?.mode).toLowerCase();
  const warnings = arr(result?.warnings).map((x) => s(x));
  const profile = obj(result?.profile);

  const hasBarrierWarning = warnings.some((item) => isWebsiteBarrierWarning(item));
  const hasMeaningfulIdentity = hasExtractedIdentityProfile(profile);
  const hasCandidates = Number(result?.candidateCount || 0) > 0;
  const hasServices = arr(result?.services).length > 0;
  const hasKnowledgeItems =
    arr(result?.knowledgeItems).length > 0 || arr(result?.candidates).length > 0;

  return (
    mode === "partial" &&
    hasBarrierWarning &&
    !hasMeaningfulIdentity &&
    !hasCandidates &&
    !hasServices &&
    !hasKnowledgeItems
  );
}

export function safeDraftKey(value = "", fallback = "item") {
  return (
    s(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || fallback
  );
}

export function extractProfileName(profile = {}) {
  const x = obj(profile);
  const name = s(
    x.companyName ||
      x.company_name ||
      x.displayName ||
      x.display_name ||
      x.name
  );
  return sanitizeExtractedBusinessName(name);
}

export function extractProfileSummary(profile = {}) {
  const x = obj(profile);
  return sanitizeExtractedBusinessSummary(
    x.summaryShort ||
      x.summary_short ||
      x.description ||
      x.summaryLong ||
      x.summary_long,
    extractProfileName(x)
  );
}

export function hasMeaningfulProfile(profile = {}) {
  const x = obj(profile);
  return !!(
    extractProfileName(x) ||
    extractProfileSummary(x) ||
    s(x.websiteUrl || x.website_url) ||
    sanitizeExtractedContactValue(x.primaryPhone || x.primary_phone, "phone") ||
    sanitizeExtractedContactValue(x.primaryEmail || x.primary_email, "email") ||
    sanitizeExtractedAddress(x.primaryAddress || x.primary_address)
  );
}

export function isPlaceholderBusinessName(value = "") {
  return !sanitizeExtractedBusinessName(value);
}

export function shouldPreferCandidateCompanyName(
  currentValue = "",
  nextValue = ""
) {
  const current = s(currentValue);
  const next = s(nextValue);

  if (!next) return false;
  if (!current) return true;
  if (isPlaceholderBusinessName(current) && !isPlaceholderBusinessName(next)) {
    return true;
  }
  return false;
}

export function hydrateBusinessFormFromProfile(
  prev = {},
  profile = {},
  { force = false } = {}
) {
  const candidate = formFromProfile(profile, prev);
  const next = { ...prev };

  const prevCompanyName = s(prev.companyName);
  const nextCompanyName = s(candidate.companyName);

  if (force || shouldPreferCandidateCompanyName(prevCompanyName, nextCompanyName)) {
    next.companyName = nextCompanyName;
  }

  if (force || !s(next.description)) {
    next.description = s(candidate.description || prev.description);
  }

  if (force || !s(next.websiteUrl)) {
    next.websiteUrl = s(candidate.websiteUrl || prev.websiteUrl);
  }

  if (force || !s(next.primaryPhone)) {
    next.primaryPhone = s(candidate.primaryPhone || prev.primaryPhone);
  }

  if (force || !s(next.primaryEmail)) {
    next.primaryEmail = s(candidate.primaryEmail || prev.primaryEmail);
  }

  if (force || !s(next.primaryAddress)) {
    next.primaryAddress = s(candidate.primaryAddress || prev.primaryAddress);
  }

  if (force || !s(next.timezone)) {
    next.timezone = s(candidate.timezone || prev.timezone || "Asia/Baku");
  }

  if (force || !s(next.language)) {
    next.language = s(candidate.language || prev.language || "en");
  }

  next.behavior = normalizeBehaviorProfile(
    extractBehaviorProfile(profile, prev.behavior),
    prev.behavior
  );

  return next;
}

export function chooseBestProfileForForm(...profiles) {
  for (const profile of profiles) {
    if (hasMeaningfulProfile(profile)) return obj(profile);
  }
  return {};
}

export function buildBusinessProfilePatch({
  businessForm = {},
  currentReview = {},
  discoveryState = {},
}) {
  const existing = obj(currentReview?.draft?.businessProfile);
  const existingBehavior = extractBehaviorProfile(existing);
  const nextBehavior = normalizeBehaviorProfile(businessForm.behavior, existingBehavior);

  const resolvedLanguage =
    resolveMainLanguageValue(
      businessForm.language,
      existing.mainLanguage,
      existing.primaryLanguage,
      existing.language,
      discoveryState.mainLanguage,
      discoveryState.primaryLanguage,
      discoveryState.language
    ) || "en";

  const supportedLanguages = arr(existing.supportedLanguages).length
    ? arr(existing.supportedLanguages)
    : [resolvedLanguage];

  return {
    ...existing,
    companyName: s(businessForm.companyName),
    displayName: s(businessForm.companyName),
    name: s(businessForm.companyName || existing.name),
    summaryShort: s(businessForm.description),
    summaryLong: s(businessForm.description || existing.summaryLong),
    description: s(businessForm.description),
    mainLanguage: resolvedLanguage,
    primaryLanguage: resolvedLanguage,
    language: resolvedLanguage,
    supportedLanguages,
    timezone: s(businessForm.timezone || "Asia/Baku"),
    websiteUrl: s(
      businessForm.websiteUrl || existing.websiteUrl || discoveryState?.lastUrl
    ),
    primaryPhone: sanitizeExtractedContactValue(
      businessForm.primaryPhone,
      "phone"
    ),
    primaryEmail: sanitizeExtractedContactValue(
      businessForm.primaryEmail,
      "email"
    ),
    primaryAddress: sanitizeExtractedAddress(businessForm.primaryAddress),
    reviewRequired: !!(
      existing.reviewRequired ?? discoveryState.reviewRequired ?? false
    ),
    reviewFlags: arr(existing.reviewFlags).length
      ? arr(existing.reviewFlags)
      : arr(discoveryState.reviewFlags),
    fieldConfidence: Object.keys(obj(existing.fieldConfidence)).length
      ? obj(existing.fieldConfidence)
      : obj(discoveryState.fieldConfidence),
    nicheBehavior: nextBehavior,
  };
}

export function buildCapabilitiesPatch({
  currentReview = {},
  businessForm = {},
}) {
  const existing = obj(currentReview?.draft?.capabilities);

  const language =
    resolveMainLanguageValue(
      businessForm.language,
      existing.primaryLanguage,
      existing.mainLanguage,
      existing.language
    ) || "en";

  const supportedLanguages = arr(existing.supportedLanguages).length
    ? arr(existing.supportedLanguages)
    : [language];

  return {
    ...existing,
    primaryLanguage: language,
    mainLanguage: language,
    supportedLanguages,
    supportsMultilanguage: supportedLanguages.length > 1,
  };
}

export function buildSafeUiProfile({
  rawProfile = {},
  sourceType = "",
  sourceUrl = "",
  warnings = [],
  mainLanguage = "",
  primaryLanguage = "",
  reviewRequired = false,
  reviewFlags = [],
  fieldConfidence = {},
  barrierOnly = false,
} = {}) {
  const profile = obj(rawProfile);

  const safeWebsiteUrl = s(
    profile.websiteUrl ||
      profile.website ||
      (sourceType === "website" ? sourceUrl : "")
  );
  const safePhone = sanitizeExtractedContactValue(
    profile.primaryPhone || profile.phone,
    "phone"
  );
  const safeEmail = sanitizeExtractedContactValue(
    profile.primaryEmail || profile.email,
    "email"
  );
  const safeAddress = sanitizeExtractedAddress(
    profile.primaryAddress || profile.address
  );

  const safeName = barrierOnly
    ? ""
    : sanitizeExtractedBusinessName(
        profile.companyName ||
          profile.displayName ||
          profile.companyTitle ||
          profile.name
      );

  const safeDisplayName = barrierOnly ? "" : s(profile.displayName || safeName);
  const safeCompanyTitle = barrierOnly ? "" : s(profile.companyTitle || safeName);

  const safeSummaryShort = sanitizeExtractedBusinessSummary(
    profile.companySummaryShort ||
      profile.summaryShort ||
      profile.shortDescription,
    safeName
  );

  const safeSummaryLong = sanitizeExtractedBusinessSummary(
    profile.companySummaryLong ||
      profile.summaryLong ||
      profile.description ||
      safeSummaryShort,
    safeName
  );

  const safeMainLanguage =
    s(
      mainLanguage ||
        profile.mainLanguage ||
        profile.primaryLanguage ||
        profile.language
    ) || "";

  const safePrimaryLanguage =
    s(
      primaryLanguage ||
        profile.primaryLanguage ||
        profile.mainLanguage ||
        profile.language
    ) || safeMainLanguage;

  return {
    ...profile,
    companyName: safeName,
    displayName: safeDisplayName,
    companyTitle: safeCompanyTitle,
    name: safeName,
    companySummaryShort: safeSummaryShort,
    summaryShort: safeSummaryShort,
    companySummaryLong: safeSummaryLong,
    summaryLong: safeSummaryLong,
    description: safeSummaryLong || safeSummaryShort,
    websiteUrl: safeWebsiteUrl,
    website: safeWebsiteUrl,
    primaryPhone: safePhone,
    phone: safePhone,
    primaryEmail: safeEmail,
    email: safeEmail,
    primaryAddress: safeAddress,
    address: safeAddress,
    mainLanguage: safeMainLanguage,
    primaryLanguage: safePrimaryLanguage,
    language: safeMainLanguage || s(profile.language || "en"),
    reviewRequired: !!reviewRequired,
    reviewFlags: arr(reviewFlags),
    fieldConfidence: obj(fieldConfidence),
  };
}
