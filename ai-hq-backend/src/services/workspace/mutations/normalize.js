// src/services/workspace/mutations/normalize.js
// normalization/build helpers extracted from src/services/workspace/mutations.js

import { bool, normalizeStringArray, obj, s } from "../shared.js";
import {
  arr,
  hasAny,
  normalizeApprovalMode,
} from "./shared.js";

export function normalizeBusinessProfileInput(input = {}) {
  const body = obj(input);

  const provided = {
    companyName: hasAny(body, [
      "companyName",
      "company_name",
      "businessName",
      "business_name",
      "name",
    ]),
    description: hasAny(body, [
      "description",
      "about",
      "summary",
      "businessDescription",
      "business_description",
    ]),
    timezone: hasAny(body, ["timezone", "time_zone"]),
    languages: hasAny(body, [
      "languages",
      "supportedLanguages",
      "supported_languages",
      "language",
      "defaultLanguage",
      "default_language",
    ]),
    tone: hasAny(body, ["tone", "brandTone", "brand_tone"]),
  };

  const normalized = {};

  if (provided.companyName) {
    normalized.companyName = s(
      body.companyName ??
        body.company_name ??
        body.businessName ??
        body.business_name ??
        body.name
    );
  }

  if (provided.description) {
    normalized.description = s(
      body.description ??
        body.about ??
        body.summary ??
        body.businessDescription ??
        body.business_description
    );
  }

  if (provided.timezone) {
    normalized.timezone = s(body.timezone ?? body.time_zone);
  }

  if (provided.languages) {
    normalized.languages = normalizeStringArray(
      body.languages ??
        body.supportedLanguages ??
        body.supported_languages ??
        body.language ??
        body.defaultLanguage ??
        body.default_language
    );
  }

  if (provided.tone) {
    normalized.tone = s(body.tone ?? body.brandTone ?? body.brand_tone);
  }

  const providedKeys = Object.entries(provided)
    .filter(([, value]) => value)
    .map(([key]) => key);

  return {
    normalized,
    provided,
    providedKeys,
  };
}

export function normalizeRuntimePreferencesInput(input = {}) {
  const body = obj(input);

  const provided = {
    defaultLanguage: hasAny(body, [
      "defaultLanguage",
      "default_language",
      "language",
    ]),
    languages: hasAny(body, [
      "languages",
      "supportedLanguages",
      "supported_languages",
    ]),
    tone: hasAny(body, ["tone", "brandTone", "brand_tone"]),
    autoReplyEnabled: hasAny(body, [
      "autoReplyEnabled",
      "auto_reply_enabled",
      "autoSendEnabled",
      "auto_send_enabled",
    ]),
    humanApprovalRequired: hasAny(body, [
      "humanApprovalRequired",
      "human_approval_required",
      "humanReviewRequired",
      "human_review_required",
    ]),
    inboxApprovalMode: hasAny(body, ["inboxApprovalMode", "inbox_approval_mode"]),
    commentApprovalMode: hasAny(body, [
      "commentApprovalMode",
      "comment_approval_mode",
    ]),
    replyStyle: hasAny(body, ["replyStyle", "reply_style"]),
    replyLength: hasAny(body, ["replyLength", "reply_length"]),
    emojiLevel: hasAny(body, ["emojiLevel", "emoji_level"]),
    ctaStyle: hasAny(body, ["ctaStyle", "cta_style"]),
    policies: hasAny(body, ["policies", "runtimePolicies", "runtime_policies"]),
  };

  const normalized = {};

  if (provided.defaultLanguage) {
    normalized.defaultLanguage = s(
      body.defaultLanguage ?? body.default_language ?? body.language
    );
  }

  if (provided.languages) {
    normalized.languages = normalizeStringArray(
      body.languages ?? body.supportedLanguages ?? body.supported_languages
    );
  }

  if (provided.tone) {
    normalized.tone = s(body.tone ?? body.brandTone ?? body.brand_tone);
  }

  if (provided.autoReplyEnabled) {
    normalized.autoReplyEnabled = bool(
      body.autoReplyEnabled ??
        body.auto_reply_enabled ??
        body.autoSendEnabled ??
        body.auto_send_enabled
    );
  }

  if (provided.humanApprovalRequired) {
    normalized.humanApprovalRequired = bool(
      body.humanApprovalRequired ??
        body.human_approval_required ??
        body.humanReviewRequired ??
        body.human_review_required
    );
  }

  if (provided.inboxApprovalMode) {
    normalized.inboxApprovalMode = normalizeApprovalMode(
      body.inboxApprovalMode ?? body.inbox_approval_mode
    );
  }

  if (provided.commentApprovalMode) {
    normalized.commentApprovalMode = normalizeApprovalMode(
      body.commentApprovalMode ?? body.comment_approval_mode
    );
  }

  if (provided.replyStyle) {
    normalized.replyStyle = s(body.replyStyle ?? body.reply_style);
  }

  if (provided.replyLength) {
    normalized.replyLength = s(body.replyLength ?? body.reply_length);
  }

  if (provided.emojiLevel) {
    normalized.emojiLevel = s(body.emojiLevel ?? body.emoji_level);
  }

  if (provided.ctaStyle) {
    normalized.ctaStyle = s(body.ctaStyle ?? body.cta_style);
  }

  if (provided.policies) {
    normalized.policies = obj(
      body.policies ?? body.runtimePolicies ?? body.runtime_policies
    );
  }

  const providedKeys = Object.entries(provided)
    .filter(([, value]) => value)
    .map(([key]) => key);

  return {
    normalized,
    provided,
    providedKeys,
  };
}

export function buildSavedBusinessPayload(normalized = {}, tenant = {}) {
  return {
    companyName: normalized.companyName ?? tenant.companyName ?? "",
    description: normalized.description ?? "",
    timezone: normalized.timezone ?? tenant.timezone ?? "Asia/Baku",
    languages: normalized.languages ?? tenant.enabledLanguages ?? [],
    tone: normalized.tone ?? "",
  };
}

export function buildSavedRuntimePayload(normalized = {}, tenant = {}) {
  return {
    defaultLanguage:
      normalized.defaultLanguage ?? tenant.defaultLanguage ?? "az",
    languages: normalized.languages ?? tenant.enabledLanguages ?? [],
    tone: normalized.tone ?? "",
    autoReplyEnabled: normalized.autoReplyEnabled,
    humanApprovalRequired: normalized.humanApprovalRequired,
    inboxApprovalMode: normalized.inboxApprovalMode,
    commentApprovalMode: normalized.commentApprovalMode,
    replyStyle: normalized.replyStyle,
    replyLength: normalized.replyLength,
    emojiLevel: normalized.emojiLevel,
    ctaStyle: normalized.ctaStyle,
    policies: normalized.policies,
  };
}

export function buildCanonicalProfileInput({
  scope,
  currentProfile = null,
  normalized = {},
  provided = {},
  effectiveLanguages = [],
  effectivePrimaryLanguage = "az",
}) {
  const current = obj(currentProfile);

  const nextProfileJson = obj(current.profile_json);
  const nextMetadataJson = obj(current.metadata_json);

  if (provided.timezone) {
    nextProfileJson.timezone = normalized.timezone;
    nextMetadataJson.timezone = normalized.timezone;
  }

  if (provided.tone) {
    nextProfileJson.tone = normalized.tone;
    nextMetadataJson.tone = normalized.tone;
  }

  return {
    tenantId: scope.id,
    tenantKey: scope.tenantKey,
    profileStatus: "review",
    companyName: provided.companyName
      ? normalized.companyName
      : s(current.company_name || scope.companyName),
    displayName: provided.companyName
      ? normalized.companyName
      : s(current.display_name || current.company_name || scope.companyName),
    legalName: s(current.legal_name || scope.legalName),
    industryKey: s(current.industry_key || scope.industryKey || "generic_business"),
    subindustryKey: s(current.subindustry_key),
    summaryShort: provided.description
      ? normalized.description
      : s(current.summary_short),
    summaryLong: provided.description
      ? normalized.description
      : s(current.summary_long),
    valueProposition: s(current.value_proposition),
    targetAudience: s(current.target_audience),
    toneProfile: provided.tone ? normalized.tone : s(current.tone_profile),
    mainLanguage:
      provided.languages
        ? effectivePrimaryLanguage
        : s(current.main_language || scope.defaultLanguage || "az"),
    supportedLanguages:
      provided.languages
        ? effectiveLanguages
        : arr(current.supported_languages).length
          ? arr(current.supported_languages)
          : effectiveLanguages,
    websiteUrl: s(current.website_url),
    primaryPhone: s(current.primary_phone),
    primaryEmail: s(current.primary_email),
    primaryAddress: s(current.primary_address),
    profileJson: nextProfileJson,
    sourceSummaryJson: obj(current.source_summary_json),
    metadataJson: nextMetadataJson,
    confidence: Number(current.confidence || 0.1),
    confidenceLabel: s(current.confidence_label || "low"),
    generatedBy: s(current.generated_by || "workspace_setup"),
    approvedBy: s(current.approved_by),
    generatedAt: current.generated_at || null,
    approvedAt: current.approved_at || null,
  };
}

export function buildCanonicalCapabilitiesInput({
  scope,
  currentCapabilities = null,
  overrides = {},
  approvedBy = "",
}) {
  const current = obj(currentCapabilities);

  return {
    tenantId: scope.id,
    tenantKey: scope.tenantKey,

    canSharePrices: current.can_share_prices ?? false,
    canShareStartingPrices: current.can_share_starting_prices ?? false,
    requiresHumanForCustomQuote: current.requires_human_for_custom_quote ?? true,

    canCaptureLeads: current.can_capture_leads ?? true,
    canCapturePhone: current.can_capture_phone ?? true,
    canCaptureEmail: current.can_capture_email ?? true,

    canOfferBooking: current.can_offer_booking ?? false,
    canOfferConsultation: current.can_offer_consultation ?? false,
    canOfferCallback: current.can_offer_callback ?? true,

    supportsInstagramDm: current.supports_instagram_dm ?? false,
    supportsFacebookMessenger: current.supports_facebook_messenger ?? false,
    supportsWhatsapp: current.supports_whatsapp ?? false,
    supportsComments: current.supports_comments ?? false,
    supportsVoice: current.supports_voice ?? false,
    supportsEmail: current.supports_email ?? false,

    supportsMultilanguage:
      overrides.supportsMultilanguage ??
      current.supports_multilanguage ??
      false,
    primaryLanguage:
      overrides.primaryLanguage ??
      s(current.primary_language || scope.defaultLanguage || "az"),
    supportedLanguages:
      overrides.supportedLanguages ??
      (arr(current.supported_languages).length
        ? arr(current.supported_languages)
        : scope.enabledLanguages),

    handoffEnabled: current.handoff_enabled ?? true,
    autoHandoffOnHumanRequest: current.auto_handoff_on_human_request ?? true,
    autoHandoffOnLowConfidence: current.auto_handoff_on_low_confidence ?? true,

    shouldAvoidCompetitorComparisons:
      current.should_avoid_competitor_comparisons ?? true,
    shouldAvoidLegalClaims: current.should_avoid_legal_claims ?? true,
    shouldAvoidUnverifiedPromises:
      current.should_avoid_unverified_promises ?? true,

    replyStyle: overrides.replyStyle ?? s(current.reply_style || "professional"),
    replyLength: overrides.replyLength ?? s(current.reply_length || "medium"),
    emojiLevel: overrides.emojiLevel ?? s(current.emoji_level || "low"),
    ctaStyle: overrides.ctaStyle ?? s(current.cta_style || "soft"),

    pricingMode: s(current.pricing_mode || "custom_quote"),
    bookingMode: s(current.booking_mode || "manual"),
    salesMode: s(current.sales_mode || "consultative"),

    capabilitiesJson: obj(current.capabilities_json),
    metadataJson: obj(current.metadata_json),

    derivedFromProfile: true,
    approvedBy: approvedBy || s(current.approved_by),
  };
}