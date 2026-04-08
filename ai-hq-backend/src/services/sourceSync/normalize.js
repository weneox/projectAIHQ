// src/services/sourceSync/normalize.js
// FINAL v5.2 — hardened normalization layer aligned with source_fusion_v3

import {
  arr,
  dedupeTextList,
  isPlainRecord,
  lower,
  n,
  normalizeCompareText,
  obj,
  s,
  uniq,
  uniqBy,
} from "./shared.js";

function clamp(nv, min = 0, max = 1) {
  const x = Number(nv);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeConfidence(value, fallback = 0) {
  const x = Number(value);
  if (!Number.isFinite(x)) return fallback;
  if (x > 1 && x <= 100) return clamp(x / 100, 0, 1);
  return clamp(x, 0, 1);
}

function normalizeIsoDate(value, fallback = "") {
  if (!value) return fallback || new Date().toISOString();

  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  return fallback || new Date().toISOString();
}

function jsonObject(value) {
  return isPlainRecord(value) ? value : {};
}

function jsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeSourceSummaryKinds(items = [], fallbackSourceType = "") {
  const out = [];
  const seen = new Set();

  for (const item of arr(items)) {
    if (typeof item === "string") {
      const type = s(item);
      if (!type) continue;

      const key = lower(type);
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        sourceType: type,
        source_type: type,
      });
      continue;
    }

    if (isPlainRecord(item)) {
      const type = s(item.source_type || item.sourceType || item.type || item.label);
      if (!type) continue;

      const key = lower(type);
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        ...item,
        sourceType: type,
        source_type: type,
        count: Number(item.count || 0),
        trust_class: s(item.trust_class || item.trustClass),
        weak: Boolean(item.weak),
      });
    }
  }

  if (fallbackSourceType) {
    const key = lower(fallbackSourceType);
    if (!seen.has(key)) {
      out.push({
        sourceType: fallbackSourceType,
        source_type: fallbackSourceType,
      });
    }
  }

  return out;
}

function normalizeObservationRecord(item = null) {
  if (!isPlainRecord(item)) return null;

  const category = s(
    item.category || item.observationGroup || item.observation_group || "general"
  );

  const claimType = s(item.claimType || item.claim_type);
  const claimKey = s(item.claimKey || item.claim_key);
  const rawValueText = s(
    item.rawValueText || item.raw_value_text || item.valueText || item.value_text
  );
  const normalizedValueText = s(
    item.normalizedValueText ||
      item.normalized_value_text ||
      item.normalizedText ||
      item.normalized_text ||
      rawValueText
  );

  const rawValueJson = jsonObject(
    item.rawValueJson ?? item.raw_value_json ?? item.valueJson ?? item.value_json
  );

  const normalizedValueJson = jsonObject(
    item.normalizedValueJson ??
      item.normalized_value_json ??
      item.normalizedJson ??
      item.normalized_json
  );

  const evidenceText = s(item.evidenceText || item.evidence_text);

  if (
    !category &&
    !claimType &&
    !claimKey &&
    !rawValueText &&
    !normalizedValueText &&
    !Object.keys(rawValueJson).length &&
    !Object.keys(normalizedValueJson).length
  ) {
    return null;
  }

  return {
    ...item,
    category: category || "general",
    observationGroup: category || "general",
    claimType,
    claimKey,
    rawValueText,
    rawValueJson,
    normalizedValueText,
    normalizedValueJson,
    evidenceText,
    pageUrl: s(item.pageUrl || item.page_url),
    pageTitle: s(item.pageTitle || item.page_title),
    confidence: normalizeConfidence(item.confidence, 0),
    confidenceLabel: s(item.confidenceLabel || item.confidence_label),
    resolutionStatus: s(item.resolutionStatus || item.resolution_status || "pending"),
    extractionMethod: s(item.extractionMethod || item.extraction_method),
    extractionModel: s(item.extractionModel || item.extraction_model),
    metadataJson: jsonObject(item.metadataJson ?? item.metadata_json),
    sourceId: s(item.sourceId || item.source_id),
    sourceRunId: s(item.sourceRunId || item.source_run_id),
    sourceType: s(item.sourceType || item.source_type),
    firstSeenAt: normalizeIsoDate(item.firstSeenAt || item.first_seen_at),
    lastSeenAt: normalizeIsoDate(item.lastSeenAt || item.last_seen_at),
  };
}

function normalizeSelectedClaim(item = null) {
  if (!isPlainRecord(item)) return null;

  const claimType = s(item.claimType || item.claim_type);
  const valueText = s(item.valueText || item.value_text);
  const valueJson = jsonObject(item.valueJson || item.value_json);

  return {
    ...item,
    claimType,
    valueText,
    valueJson,
    score: normalizeConfidence(item.score, 0),
    evidenceCount: Math.max(0, n(item.evidenceCount || item.evidence_count, 0)),
    evidence: arr(item.evidence).filter(Boolean),
    sourceTypes: uniq(
      arr(item.sourceTypes || item.source_types).map((x) => s(x)).filter(Boolean)
    ),
    bestSourceType: s(item.bestSourceType || item.best_source_type),
    status: s(item.status || "promotable"),
    governance: jsonObject(item.governance),
    impact: jsonObject(item.impact),
  };
}

function normalizeSelectedClaimsMap(value = {}) {
  const input = obj(value);
  const out = {};

  for (const [claimType, claims] of Object.entries(input)) {
    const safeType = s(claimType);
    if (!safeType) continue;

    out[safeType] = arr(claims)
      .map((item) =>
        normalizeSelectedClaim({
          ...obj(item),
          claimType: safeType,
        })
      )
      .filter(Boolean);
  }

  return out;
}

function normalizeConflictRecord(item = null) {
  if (!isPlainRecord(item)) return null;

  return {
    ...item,
    category: s(item.category || "general"),
    type: s(item.type || item.conflictType || item.conflict_type),
    claimType: s(item.claimType || item.claim_type),
    key: s(item.key || item.claimKey || item.claim_key),
    message: s(item.message),
    severity: s(item.severity || "low"),
    classification: s(item.classification),
    resolution: s(item.resolution),
    reviewRequired: Boolean(item.reviewRequired ?? item.review_required),
    winner: jsonObject(item.winner),
    runnerUp: jsonObject(item.runnerUp || item.runner_up),
    items: arr(item.items).filter(Boolean),
    values: arr(item.values).filter(Boolean),
    metadataJson: jsonObject(item.metadataJson ?? item.metadata_json),
  };
}

function normalizeSourceEvidenceItem(item = null) {
  if (!item) return null;

  if (typeof item === "string") {
    const text = s(item);
    if (!text) return null;
    return { text };
  }

  if (!isPlainRecord(item)) return null;

  return {
    sourceId: s(item.sourceId || item.source_id),
    sourceRunId: s(item.sourceRunId || item.source_run_id),
    sourceType: s(item.sourceType || item.source_type),
    pageUrl: s(item.pageUrl || item.page_url),
    pageTitle: s(item.pageTitle || item.page_title),
    evidenceText: s(item.evidenceText || item.evidence_text || item.text),
    claimType: s(item.claimType || item.claim_type),
    claimKey: s(item.claimKey || item.claim_key),
    confidence: normalizeConfidence(item.confidence, 0),
    confidenceLabel: s(item.confidenceLabel || item.confidence_label),
    firstSeenAt: normalizeIsoDate(item.firstSeenAt || item.first_seen_at),
    lastSeenAt: normalizeIsoDate(item.lastSeenAt || item.last_seen_at),
    trustTier: s(item.trustTier || item.trust_tier),
    trustScore: normalizeConfidence(item.trustScore || item.trust_score, 0),
    metadataJson: jsonObject(item.metadataJson ?? item.metadata_json),
  };
}

function normalizeSocialLinkItem(item = null) {
  if (!item) return null;

  if (typeof item === "string") {
    const url = s(item);
    if (!url) return null;
    return {
      platform: "",
      url,
    };
  }

  if (!isPlainRecord(item)) return null;

  const platform = s(item.platform || item.type);
  const url = s(item.url || item.href || item.link);

  if (!platform && !url) return null;

  return {
    platform,
    url,
  };
}

function normalizeCandidateRecord(item = null) {
  if (!isPlainRecord(item)) return null;

  const category = s(item.category);
  const itemKey = s(item.itemKey || item.item_key);
  const title = s(item.title);
  const valueText = s(item.valueText || item.value_text);
  const normalizedText = s(item.normalizedText || item.normalized_text || valueText);
  const valueJson = jsonObject(item.valueJson ?? item.value_json);
  const normalizedJson = jsonObject(item.normalizedJson ?? item.normalized_json);

  if (
    !category &&
    !itemKey &&
    !title &&
    !valueText &&
    !normalizedText &&
    !Object.keys(valueJson).length
  ) {
    return null;
  }

    return {
      ...item,
      candidateGroup: s(item.candidateGroup || item.candidate_group || "general"),
    category,
    itemKey,
    title,
    valueText,
    valueJson,
    normalizedText,
    normalizedJson,
    confidence: normalizeConfidence(item.confidence, 0),
    confidenceLabel: s(item.confidenceLabel || item.confidence_label),
    status: s(item.status || "pending"),
      reviewReason: s(item.reviewReason || item.review_reason),
      sourceEvidenceJson: arr(item.sourceEvidenceJson || item.source_evidence_json)
        .map((entry) => normalizeSourceEvidenceItem(entry))
        .filter(Boolean),
      metadataJson: jsonObject(item.metadataJson ?? item.metadata_json),
      extractionMethod: s(item.extractionMethod || item.extraction_method || "ai"),
      extractionModel: s(item.extractionModel || item.extraction_model),
      sourceId: s(item.sourceId || item.source_id),
    sourceRunId: s(item.sourceRunId || item.source_run_id),
    firstSeenAt: normalizeIsoDate(item.firstSeenAt || item.first_seen_at),
    lastSeenAt: normalizeIsoDate(item.lastSeenAt || item.last_seen_at),
  };
}

function normalizeFaqItems(items = []) {
  return arr(items)
    .map((item) => {
      if (!isPlainRecord(item)) return null;

      const question = s(item.question);
      const answer = s(item.answer);

      if (!question && !answer) return null;

      return {
        question,
        answer,
      };
    })
    .filter(Boolean);
}

function looksLikePlaceholderCompanyName(text = "") {
  const value = normalizeCompareText(text);
  if (!value) return false;
  return (
    value === "google maps" ||
    value === "googlemaps" ||
    value === "company" ||
    value === "business" ||
    value === "primary business"
  );
}

function looksLikePlaceholderEmail(text = "") {
  const value = lower(s(text));
  if (!value) return false;
  return (
    value === "info@company.com" ||
    value === "hello@company.com" ||
    value === "contact@company.com" ||
    value.endsWith("@company.com")
  );
}

function looksLikePlaceholderPhone(text = "") {
  const value = s(text).replace(/\s+/g, " ").trim();
  if (!value) return false;
  return (
    /^\+994\s*\.\.\.$/i.test(value) ||
    /^\+\d{1,4}\s*\.\.\.$/i.test(value) ||
    /^(phone|primary phone)$/i.test(value)
  );
}

function looksLikePlaceholderAddress(text = "") {
  const value = normalizeCompareText(text);
  if (!value) return false;
  return (
    value === "primary address" ||
    value === "address" ||
    value === "business address"
  );
}

function sanitizeIdentityField(value = "", type = "") {
  const text = s(value);
  if (!text) return "";

  if (type === "companyName" && looksLikePlaceholderCompanyName(text)) return "";
  if (type === "primaryEmail" && looksLikePlaceholderEmail(text)) return "";
  if (type === "primaryPhone" && looksLikePlaceholderPhone(text)) return "";
  if (type === "primaryAddress" && looksLikePlaceholderAddress(text)) return "";

  return text;
}

function normalizeSynthesisProfile(
  value = {},
  fallbackProfile = {},
  { allowFallbackIdentity = true } = {}
) {
  const x = obj(value);
  const fb = obj(fallbackProfile);

  const supportedLanguages = uniq(
    arr(x.supportedLanguages || x.supported_languages || fb.supportedLanguages || ["az"])
      .map((lang) => lower(lang))
      .filter(Boolean)
  );

  const services = dedupeTextList(arr(x.services || fb.services), {
    maxItems: 20,
    maxText: 180,
  });

  const products = dedupeTextList(arr(x.products || fb.products), {
    maxItems: 14,
    maxText: 180,
  });

  const pricingHints = dedupeTextList(arr(x.pricingHints || fb.pricingHints), {
    maxItems: 14,
    maxText: 260,
  });

  const policyHighlights = dedupeTextList(
    arr(x.policyHighlights || x.policy_highlights || fb.policyHighlights),
    {
      maxItems: 12,
      maxText: 260,
    }
  );

  const hours = dedupeTextList(arr(x.hours || fb.hours), {
    maxItems: 14,
    maxText: 160,
  });

  const addresses = dedupeTextList(arr(x.addresses || fb.addresses), {
    maxItems: 10,
    maxText: 220,
  });

  const socialLinks = uniqBy(
    arr(x.socialLinks || x.social_links || fb.socialLinks)
      .map((item) => normalizeSocialLinkItem(item))
      .filter(Boolean),
    (item) =>
      `${lower(item.platform || "")}|${normalizeCompareText(item.url || "")}`
  );

  return {
    ...fb,
    ...x,
    companyName: sanitizeIdentityField(
      x.companyName ||
        x.company_name ||
        (allowFallbackIdentity ? fb.companyName || fb.companyTitle : ""),
      "companyName"
    ),
    displayName: sanitizeIdentityField(
      x.displayName ||
        x.display_name ||
        x.companyName ||
        x.company_name ||
        (allowFallbackIdentity ? fb.companyName || fb.companyTitle : ""),
      "companyName"
    ),
    companyTitle: sanitizeIdentityField(
      x.companyTitle ||
        x.company_title ||
        x.companyName ||
        x.company_name ||
        (allowFallbackIdentity ? fb.companyTitle || fb.companyName : ""),
      "companyName"
    ),
    summaryShort: s(
      x.summaryShort || x.summary_short || fb.companySummaryShort || fb.summaryShort
    ),
    summaryLong: s(
      x.summaryLong || x.summary_long || fb.companySummaryLong || fb.summaryLong
    ),
    aboutSection: s(x.aboutSection || x.about_section || fb.aboutSection),
    websiteUrl: s(x.websiteUrl || x.website_url || fb.websiteUrl),
    primaryPhone: sanitizeIdentityField(
      x.primaryPhone ||
        x.primary_phone ||
        arr(x.phones)[0] ||
        (allowFallbackIdentity ? arr(fb.phones)[0] : ""),
      "primaryPhone"
    ),
    primaryEmail: sanitizeIdentityField(
      x.primaryEmail ||
        x.primary_email ||
        arr(x.emails)[0] ||
        (allowFallbackIdentity ? arr(fb.emails)[0] : ""),
      "primaryEmail"
    ),
    primaryAddress: sanitizeIdentityField(
      x.primaryAddress ||
        x.primary_address ||
        arr(x.addresses)[0] ||
        (allowFallbackIdentity ? arr(fb.addresses)[0] : ""),
      "primaryAddress"
    ),
    mainLanguage: s(x.mainLanguage || x.main_language || fb.mainLanguage || "az"),
    supportedLanguages: supportedLanguages.length ? supportedLanguages : ["az"],
    services,
    products,
    pricingHints,
    policyHighlights,
    pricingPolicy: s(x.pricingPolicy || x.pricing_policy || fb.pricingPolicy),
    supportMode: s(x.supportMode || x.support_mode || fb.supportMode),
    hours,
    emails: uniq(arr(x.emails || fb.emails).map((v) => s(v)).filter(Boolean)),
    phones: uniq(arr(x.phones || fb.phones).map((v) => s(v)).filter(Boolean)),
    addresses,
    socialLinks,
    bookingLinks: uniq(
      arr(x.bookingLinks || x.booking_links || fb.bookingLinks)
        .map((v) => s(v))
        .filter(Boolean)
    ),
    whatsappLinks: uniq(
      arr(x.whatsappLinks || x.whatsapp_links || fb.whatsappLinks)
        .map((v) => s(v))
        .filter(Boolean)
    ),
    faqItems: normalizeFaqItems(x.faqItems || x.faq_items || fb.faqItems),
    policyHighlights,
  };
}

function buildFallbackCapabilities(profile = {}) {
  const supportedLanguages = uniq(arr(profile.supportedLanguages || ["az"]));
  const pricingJoined = lower(
    [...arr(profile.pricingHints), s(profile.pricingPolicy)].join(" | ")
  );

  const hasPhones = arr(profile.phones).length > 0 || !!s(profile.primaryPhone);
  const hasEmails = arr(profile.emails).length > 0 || !!s(profile.primaryEmail);
  const hasBooking = arr(profile.bookingLinks).length > 0;
  const hasPricing = arr(profile.pricingHints).length > 0 || !!s(profile.pricingPolicy);
  const hasWhatsapp = arr(profile.whatsappLinks).length > 0;

  const pricingMode = hasPricing
    ? /\b(custom|quote|request quote|consultation)\b/i.test(pricingJoined)
      ? "custom_quote"
      : /\b(from|starting|starting at)\b/i.test(pricingJoined)
        ? "starting_price"
        : "hybrid"
    : "custom_quote";

  const bookingMode = hasWhatsapp ? "whatsapp" : hasBooking ? "form" : "manual";

  return {
    canSharePrices: hasPricing,
    canShareStartingPrices: /\b(from|starting|starting at)\b/i.test(pricingJoined),
    requiresHumanForCustomQuote: /\b(custom|quote|request quote|consultation)\b/i.test(
      pricingJoined
    ),
    canCaptureLeads: hasPhones || hasEmails || hasBooking || hasWhatsapp,
    canCapturePhone: hasPhones,
    canCaptureEmail: hasEmails,
    canOfferBooking: hasBooking || hasWhatsapp,
    canOfferConsultation: hasBooking,
    canOfferCallback: hasPhones,
    supportsInstagramDm: false,
    supportsFacebookMessenger: false,
    supportsWhatsapp: hasWhatsapp,
    supportsComments: false,
    supportsVoice: false,
    supportsEmail: hasEmails,
    supportsMultilanguage: supportedLanguages.length > 1,
    primaryLanguage: s(profile.mainLanguage || "az"),
    supportedLanguages: supportedLanguages.length ? supportedLanguages : ["az"],
    handoffEnabled: true,
    autoHandoffOnHumanRequest: true,
    autoHandoffOnLowConfidence: true,
    shouldAvoidCompetitorComparisons: true,
    shouldAvoidLegalClaims: true,
    shouldAvoidUnverifiedPromises: true,
    replyStyle: "professional",
    replyLength: "medium",
    emojiLevel: "low",
    ctaStyle: hasBooking || hasWhatsapp ? "direct" : "soft",
    pricingMode,
    bookingMode,
    salesMode: pricingMode === "custom_quote" ? "consultative" : "soft",
  };
}

function normalizeSynthesisResult(
  value = {},
  {
    fallbackProfile = {},
    sourceType = "",
    sourceUrl = "",
    allowFallbackIdentity = true,
  } = {}
) {
  const x = obj(value);
  const safeProfile = normalizeSynthesisProfile(x.profile, fallbackProfile, {
    allowFallbackIdentity,
  });

  if (!safeProfile.websiteUrl && sourceType === "website" && sourceUrl) {
    safeProfile.websiteUrl = s(sourceUrl);
  }

  const incomingCapabilities = obj(x.capabilities);
  const safeCapabilities = {
    ...buildFallbackCapabilities(safeProfile),
    ...incomingCapabilities,
    primaryLanguage: s(
      incomingCapabilities.primaryLanguage ||
        incomingCapabilities.primary_language ||
        safeProfile.mainLanguage ||
        "az"
    ),
    supportedLanguages: uniq(
      arr(
        incomingCapabilities.supportedLanguages ||
          incomingCapabilities.supported_languages ||
          safeProfile.supportedLanguages ||
          ["az"]
      )
        .map((lang) => lower(lang))
        .filter(Boolean)
    ),
  };

  const sourceSummaryBase = obj(x.sourceSummary || x.source_summary);
  const safeSources = normalizeSourceSummaryKinds(
    sourceSummaryBase.sources,
    sourceType
  );

  return {
    ...x,
    profile: safeProfile,
    capabilities: safeCapabilities,
    sourceSummary: {
      ...sourceSummaryBase,
      sourceType: s(sourceSummaryBase.sourceType || sourceType),
      sourceUrl: s(sourceSummaryBase.sourceUrl || sourceUrl),
      sources: safeSources,
    },
      conflicts: arr(x.conflicts)
        .map((item) => normalizeConflictRecord(item))
        .filter(Boolean),
      selectedClaims: normalizeSelectedClaimsMap(x.selectedClaims || x.selected_claims),
      governance: jsonObject(x.governance),
      confidence: normalizeConfidence(x.confidence, 0),
      confidenceLabel: s(x.confidenceLabel || x.confidence_label || "low"),
      summaryText: s(
      x.summaryText ||
        x.summary_text ||
        safeProfile.summaryShort ||
        safeProfile.summaryLong
    ),
  };
}

function candidateIdentityKey(item = null) {
  const safe = normalizeCandidateRecord(item);
  if (!safe) return "";

  const identityText =
    safe.normalizedText ||
    safe.valueText ||
    stableJsonStringify(safe.normalizedJson || safe.valueJson || {});

  return [
    lower(safe.candidateGroup),
    lower(safe.category),
    lower(safe.itemKey),
    normalizeCompareText(identityText),
  ].join("|");
}

function flattenSelectedClaims(selectedClaims = {}) {
  const safe = normalizeSelectedClaimsMap(selectedClaims);
  return Object.entries(safe).flatMap(([claimType, claims]) =>
      arr(claims).map((claim) => ({
        claimType,
        valueText: s(claim.valueText || claim.value_text),
        valueJson: jsonObject(claim.valueJson || claim.value_json),
        score: normalizeConfidence(claim.score, 0),
      evidenceCount: Math.max(0, n(claim.evidenceCount || claim.evidence_count, 0)),
      evidence: arr(claim.evidence),
        sourceTypes: arr(claim.sourceTypes || claim.source_types)
          .map((x) => s(x))
          .filter(Boolean),
        bestSourceType: s(claim.bestSourceType || claim.best_source_type),
        status: s(claim.status || "promotable"),
        governance: jsonObject(claim.governance),
        impact: jsonObject(claim.impact),
      }))
    );
}

export {
  buildFallbackCapabilities,
  candidateIdentityKey,
  flattenSelectedClaims,
  normalizeCandidateRecord,
  normalizeConflictRecord,
  normalizeObservationRecord,
  normalizeSelectedClaim,
  normalizeSelectedClaimsMap,
  normalizeSourceSummaryKinds,
  normalizeSynthesisProfile,
  normalizeSynthesisResult,
};
