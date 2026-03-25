// src/services/sourceFusion/capabilities.js
// FINAL v3.0 — conservative capability inference

import { arr, lower, s } from "./shared.js";

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

export {
  deriveBookingMode,
  derivePricingMode,
  sourceTypesPresent,
  synthesizeCapabilities,
};