// src/services/sourceFusion/synthesis.js
// FINAL v3.0 — source-aware synthesis from clustered observations

import {
  arr,
  compactText,
  confidenceLabel,
  lower,
  normalizeConfidence,
  normalizeObservedUrl,
  obj,
  s,
  uniqStrings,
} from "./shared.js";
import {
  claimPolicy,
  getSourceProfile,
} from "./policies.js";
import {
  buildSelectedClaims,
  detectConflicts,
  getClusterJson,
  getClusterText,
  groupObservationsByClaimType,
  mapFaqClusters,
  mapSocialLinkClusters,
  pickListClusters,
  pickScalarCluster,
} from "./clustering.js";

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
      .sort((a, b) => b.count - a.count || b.source_type.localeCompare(a.source_type)),
  };
}

function derivePricingMode({ pricingHints = [], pricingPolicy = "" }) {
  const joined = lower([pricingPolicy, ...pricingHints].join(" | "));

  if (/\b(custom quote|request quote|contact us|consultation)\b/i.test(joined)) {
    return "custom_quote";
  }

  if (/\b(from|starting at|starting)\b/i.test(joined)) {
    return "starting_price";
  }

  if (pricingHints.length) {
    return "hybrid";
  }

  return "custom_quote";
}

function deriveBookingMode({ bookingLinks = [], whatsappLinks = [] }) {
  if (whatsappLinks.length) return "whatsapp";
  if (bookingLinks.some((x) => /calendly|calendar|schedule/i.test(s(x)))) {
    return "calendar";
  }
  if (bookingLinks.length) return "form";
  return "manual";
}

function sourceTypesPresent(sourceSummary = {}) {
  return new Set(
    arr(sourceSummary.sources)
      .map((item) => lower(item.source_type || item.sourceType || item))
      .filter(Boolean)
  );
}

function synthesizeProfile({ clusterMap = {}, sourceSummary = {} }) {
  const companyNameCluster = pickScalarCluster("company_name", clusterMap.company_name);
  const websiteUrlCluster = pickScalarCluster("website_url", clusterMap.website_url);
  const shortSummaryCluster = pickScalarCluster("summary_short", clusterMap.summary_short);
  const longSummaryCluster = pickScalarCluster("summary_long", clusterMap.summary_long);
  const primaryPhoneCluster = pickScalarCluster("primary_phone", clusterMap.primary_phone);
  const primaryEmailCluster = pickScalarCluster("primary_email", clusterMap.primary_email);
  const primaryAddressCluster = pickScalarCluster("primary_address", clusterMap.primary_address);
  const pricingPolicyCluster = pickScalarCluster("pricing_policy", clusterMap.pricing_policy);
  const supportModeCluster = pickScalarCluster("support_mode", clusterMap.support_mode);

  const serviceClusters = pickListClusters("service", clusterMap.service, { maxItems: 24 });
  const productClusters = pickListClusters("product", clusterMap.product, { maxItems: 16 });
  const pricingHintClusters = pickListClusters("pricing_hint", clusterMap.pricing_hint, { maxItems: 16 });
  const hoursClusters = pickListClusters("working_hours", clusterMap.working_hours, { maxItems: 10 });
  const socialClusters = pickListClusters("social_link", clusterMap.social_link, { maxItems: 20 });
  const bookingClusters = pickListClusters("booking_link", clusterMap.booking_link, { maxItems: 12 });
  const whatsappClusters = pickListClusters("whatsapp_link", clusterMap.whatsapp_link, { maxItems: 10 });
  const faqClusters = pickListClusters("faq", clusterMap.faq, { maxItems: 16 });

  const summaryShort =
    getClusterText(shortSummaryCluster) ||
    compactText(getClusterText(longSummaryCluster), 380);

  const summaryLong =
    getClusterText(longSummaryCluster) || compactText(summaryShort, 1200);

  const services = uniqStrings(
    serviceClusters.map((x) => getClusterText(x)).filter(Boolean)
  );

  const products = uniqStrings(
    productClusters.map((x) => getClusterText(x)).filter(Boolean)
  );

  const pricingHints = uniqStrings(
    pricingHintClusters.map((x) => getClusterText(x)).filter(Boolean)
  );

  const hours = uniqStrings(
    hoursClusters.map((x) => getClusterText(x)).filter(Boolean)
  );

  const socialLinks = mapSocialLinkClusters(socialClusters).map((item) => ({
    platform: s(item.platform),
    url: normalizeObservedUrl(item.url),
  }));

  const bookingLinks = uniqStrings(
    bookingClusters
      .map((x) => s(getClusterJson(x).url || getClusterText(x)))
      .filter(Boolean)
      .map(normalizeObservedUrl)
  );

  const whatsappLinks = uniqStrings(
    whatsappClusters
      .map((x) => s(getClusterJson(x).url || getClusterText(x)))
      .filter(Boolean)
      .map(normalizeObservedUrl)
  );

  const faqItems = mapFaqClusters(faqClusters).map((item) => ({
    question: s(item.question),
    answer: s(item.answer),
  }));

  const pricingPolicy = getClusterText(pricingPolicyCluster);
  const supportMode = getClusterText(supportModeCluster);

  const confidenceInputs = [
    { weight: 0.26, value: companyNameCluster?.score || 0 },
    { weight: 0.18, value: shortSummaryCluster?.score || 0 },
    { weight: 0.14, value: websiteUrlCluster?.score || 0 },
    { weight: 0.14, value: primaryPhoneCluster?.score || 0 },
    { weight: 0.14, value: primaryEmailCluster?.score || 0 },
    { weight: 0.14, value: primaryAddressCluster?.score || 0 },
  ].filter((x) => x.value > 0);

  const weightedConfidence = confidenceInputs.length
    ? confidenceInputs.reduce((sum, item) => sum + item.value * item.weight, 0) /
      confidenceInputs.reduce((sum, item) => sum + item.weight, 0)
    : 0.56;

  return {
    companyName: getClusterText(companyNameCluster),
    displayName: getClusterText(companyNameCluster),
    websiteUrl: s(getClusterJson(websiteUrlCluster).url || getClusterText(websiteUrlCluster)),
    summaryShort,
    summaryLong,
    primaryPhone: getClusterText(primaryPhoneCluster),
    primaryEmail: getClusterText(primaryEmailCluster),
    primaryAddress: getClusterText(primaryAddressCluster),

    services,
    products,
    pricingHints,
    pricingPolicy,
    supportMode,
    hours,
    socialLinks,
    bookingLinks,
    whatsappLinks,
    faqItems,

    mainLanguage: "az",
    supportedLanguages: ["az"],

    sourceSummary,
    confidence: normalizeConfidence(weightedConfidence, 0.56),
    confidenceLabel: confidenceLabel(weightedConfidence),
  };
}

function synthesizeCapabilities(profile = {}, sourceSummary = {}) {
  const pricingMode = derivePricingMode({
    pricingHints: profile.pricingHints,
    pricingPolicy: profile.pricingPolicy,
  });

  const bookingMode = deriveBookingMode({
    bookingLinks: profile.bookingLinks,
    whatsappLinks: profile.whatsappLinks,
  });

  const sourceTypes = sourceTypesPresent(sourceSummary);

  const hasInstagramConnector = sourceTypes.has("instagram");
  const hasFacebookConnector =
    sourceTypes.has("facebook") ||
    sourceTypes.has("facebook_page") ||
    sourceTypes.has("messenger");
  const hasWhatsappConnector = sourceTypes.has("whatsapp_business");

  return {
    canSharePrices: profile.pricingHints.length > 0 || !!profile.pricingPolicy,
    canShareStartingPrices: profile.pricingHints.some((x) => /\b(from|starting)\b/i.test(x)),
    requiresHumanForCustomQuote:
      pricingMode === "custom_quote" ||
      /\bcustom quote|consultation|contact us|request quote\b/i.test(profile.pricingPolicy),

    canCaptureLeads:
      !!profile.primaryPhone ||
      !!profile.primaryEmail ||
      profile.bookingLinks.length > 0 ||
      profile.whatsappLinks.length > 0,

    canCapturePhone: !!profile.primaryPhone,
    canCaptureEmail: !!profile.primaryEmail,

    canOfferBooking: profile.bookingLinks.length > 0 || profile.whatsappLinks.length > 0,
    canOfferConsultation:
      profile.bookingLinks.some((x) => /consult/i.test(x)) ||
      /\bconsult/i.test(profile.pricingPolicy),

    canOfferCallback: !!profile.primaryPhone,

    supportsInstagramDm: hasInstagramConnector,
    supportsFacebookMessenger: hasFacebookConnector,
    supportsWhatsapp: hasWhatsappConnector || profile.whatsappLinks.length > 0,
    supportsComments: hasInstagramConnector || hasFacebookConnector,
    supportsVoice: false,
    supportsEmail: !!profile.primaryEmail,

    supportsMultilanguage: arr(profile.supportedLanguages).length > 1,
    primaryLanguage: s(profile.mainLanguage || "az"),
    supportedLanguages: arr(profile.supportedLanguages).length
      ? profile.supportedLanguages
      : ["az"],

    handoffEnabled: true,
    autoHandoffOnHumanRequest: true,
    autoHandoffOnLowConfidence: true,

    shouldAvoidCompetitorComparisons: true,
    shouldAvoidLegalClaims: true,
    shouldAvoidUnverifiedPromises: true,

    replyStyle: "professional",
    replyLength: "medium",
    emojiLevel: "low",
    ctaStyle:
      profile.bookingLinks.length || profile.whatsappLinks.length ? "direct" : "soft",

    pricingMode,
    bookingMode,
    salesMode: pricingMode === "custom_quote" ? "consultative" : "soft",
  };
}

function synthesizeTenantBusinessFromObservations({
  observations = [],
}) {
  const clusterMap = groupObservationsByClaimType(observations);
  const sourceSummary = summarizeSources(observations);
  const conflicts = detectConflicts(clusterMap);
  const profile = synthesizeProfile({ clusterMap, sourceSummary });
  const capabilities = synthesizeCapabilities(profile, sourceSummary);
  const selectedClaims = buildSelectedClaims(clusterMap);

  const confidence = normalizeConfidence(profile.confidence, 0.56);

  const summaryText = compactText(
    [
      profile.companyName,
      profile.summaryShort,
      profile.services.length
        ? `Services: ${profile.services.slice(0, 6).join(", ")}`
        : "",
      profile.products.length
        ? `Products: ${profile.products.slice(0, 4).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" — "),
    1500
  );

  return {
    profile,
    capabilities,
    conflicts,
    sourceSummary,
    selectedClaims,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    summaryText,
  };
}

export {
  deriveBookingMode,
  derivePricingMode,
  sourceTypesPresent,
  summarizeSources,
  synthesizeCapabilities,
  synthesizeProfile,
  synthesizeTenantBusinessFromObservations,
};