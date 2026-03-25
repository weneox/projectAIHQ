import {
  s,
  n,
  b,
  obj,
  arr,
  lower,
  compactText,
  isSameMeaning,
  mergeJsonObjects,
  mergeStringList,
  mergeUrlList,
  mergeSocialLinks,
  mergeFaqItems,
  uniqueJsonList,
  normalizeCategory,
  normalizeProfileStatus,
  normalizeReplyStyle,
  normalizeReplyLength,
  normalizeEmojiLevel,
  normalizeCtaStyle,
  normalizePricingMode,
  normalizeBookingMode,
  normalizeSalesMode,
  normalizeConfidence,
  normalizeConfidenceLabel,
  normalizeKnowledgeStatus,
  normalizeApprovalMode,
  buildCanonicalKey,
  normalizeWriteIntent,
  resolveWriteIntent,
  isLikelyBusinessWebsiteUrl,
} from "./shared.js";

export function chooseScalarValue(currentValue, incomingValue, options = {}) {
  const {
    intent = "manual",
    currentConfidence = 0,
    incomingConfidence = 0,
    currentApproved = false,
    maxLength = 5000,
    validator = null,
  } = options;

  const current = compactText(currentValue, maxLength);
  const incoming = compactText(incomingValue, maxLength);

  if (!incoming) return current;
  if (validator && !validator(incoming)) return current;
  if (!current) return incoming;

  if (isSameMeaning(current, incoming)) {
    return incoming.length > current.length ? incoming : current;
  }

  if (intent === "manual" || intent === "manual_override") {
    return incoming;
  }

  if (intent === "approved_projection") {
    if (currentApproved && incomingConfidence + 0.12 < currentConfidence) {
      return current;
    }

    if (incomingConfidence >= currentConfidence - 0.02) {
      return incoming;
    }

    return current;
  }

  if (currentApproved) return current;
  if (incomingConfidence >= currentConfidence + 0.18) return incoming;

  return current;
}

export function chooseJsonValue(currentValue, incomingValue, options = {}) {
  const { intent = "manual" } = options;
  const current = obj(currentValue);
  const incoming = obj(incomingValue);

  if (!Object.keys(incoming).length) return current;
  if (!Object.keys(current).length) return incoming;

  if (intent === "manual" || intent === "manual_override") {
    return mergeJsonObjects(current, incoming);
  }

  return mergeJsonObjects(current, incoming);
}

export function chooseBooleanValue(currentValue, incomingValue, options = {}) {
  const { intent = "manual" } = options;

  if (incomingValue === undefined || incomingValue === null || incomingValue === "") {
    return b(currentValue, false);
  }

  const current = b(currentValue, false);
  const incoming = b(incomingValue, false);

  if (intent === "manual" || intent === "manual_override") {
    return incoming;
  }

  if (intent === "approved_projection") {
    if (incoming) return true;
    return current;
  }

  if (incoming) return true;
  return current;
}

export function chooseEnumValue(currentValue, incomingValue, options = {}) {
  const { intent = "manual" } = options;
  const current = s(currentValue);
  const incoming = s(incomingValue);

  if (!incoming) return current;
  if (!current) return incoming;

  if (intent === "manual" || intent === "manual_override") {
    return incoming;
  }

  return current || incoming;
}

export function normalizeProfilePayload(input = {}) {
  return {
    profile_status: normalizeProfileStatus(input.profileStatus || input.profile_status || "draft"),
    company_name: s(input.companyName || input.company_name),
    display_name: s(input.displayName || input.display_name),
    legal_name: s(input.legalName || input.legal_name),
    industry_key: s(input.industryKey || input.industry_key),
    subindustry_key: s(input.subindustryKey || input.subindustry_key),

    summary_short: s(input.summaryShort || input.summary_short),
    summary_long: s(input.summaryLong || input.summary_long),
    value_proposition: s(input.valueProposition || input.value_proposition),
    target_audience: s(input.targetAudience || input.target_audience),
    tone_profile: s(input.toneProfile || input.tone_profile),

    main_language: s(input.mainLanguage || input.main_language || "az"),
    supported_languages: arr(input.supportedLanguages || input.supported_languages, []),

    website_url: s(input.websiteUrl || input.website_url),
    primary_phone: s(input.primaryPhone || input.primary_phone),
    primary_email: s(input.primaryEmail || input.primary_email),
    primary_address: s(input.primaryAddress || input.primary_address),

    profile_json: obj(input.profileJson ?? input.profile_json, {}),
    source_summary_json: obj(input.sourceSummaryJson ?? input.source_summary_json, {}),
    metadata_json: obj(input.metadataJson ?? input.metadata_json, {}),

    confidence: normalizeConfidence(input.confidence, 0),
    confidence_label: normalizeConfidenceLabel(input.confidenceLabel || input.confidence_label),

    generated_by: s(input.generatedBy || input.generated_by),
    approved_by: s(input.approvedBy || input.approved_by),

    generated_at: input.generatedAt || input.generated_at || null,
    approved_at: input.approvedAt || input.approved_at || null,
  };
}

export function normalizeCapabilitiesPayload(input = {}) {
  return {
    can_share_prices: input.canSharePrices ?? input.can_share_prices,
    can_share_starting_prices: input.canShareStartingPrices ?? input.can_share_starting_prices,
    requires_human_for_custom_quote:
      input.requiresHumanForCustomQuote ?? input.requires_human_for_custom_quote,

    can_capture_leads: input.canCaptureLeads ?? input.can_capture_leads,
    can_capture_phone: input.canCapturePhone ?? input.can_capture_phone,
    can_capture_email: input.canCaptureEmail ?? input.can_capture_email,

    can_offer_booking: input.canOfferBooking ?? input.can_offer_booking,
    can_offer_consultation: input.canOfferConsultation ?? input.can_offer_consultation,
    can_offer_callback: input.canOfferCallback ?? input.can_offer_callback,

    supports_instagram_dm: input.supportsInstagramDm ?? input.supports_instagram_dm,
    supports_facebook_messenger:
      input.supportsFacebookMessenger ?? input.supports_facebook_messenger,
    supports_whatsapp: input.supportsWhatsapp ?? input.supports_whatsapp,
    supports_comments: input.supportsComments ?? input.supports_comments,
    supports_voice: input.supportsVoice ?? input.supports_voice,
    supports_email: input.supportsEmail ?? input.supports_email,

    supports_multilanguage: input.supportsMultilanguage ?? input.supports_multilanguage,
    primary_language: s(input.primaryLanguage || input.primary_language || "az"),
    supported_languages: arr(input.supportedLanguages || input.supported_languages, []),

    handoff_enabled: input.handoffEnabled ?? input.handoff_enabled,
    auto_handoff_on_human_request:
      input.autoHandoffOnHumanRequest ?? input.auto_handoff_on_human_request,
    auto_handoff_on_low_confidence:
      input.autoHandoffOnLowConfidence ?? input.auto_handoff_on_low_confidence,

    should_avoid_competitor_comparisons:
      input.shouldAvoidCompetitorComparisons ?? input.should_avoid_competitor_comparisons,
    should_avoid_legal_claims: input.shouldAvoidLegalClaims ?? input.should_avoid_legal_claims,
    should_avoid_unverified_promises:
      input.shouldAvoidUnverifiedPromises ?? input.should_avoid_unverified_promises,

    reply_style: normalizeReplyStyle(input.replyStyle || input.reply_style),
    reply_length: normalizeReplyLength(input.replyLength || input.reply_length),
    emoji_level: normalizeEmojiLevel(input.emojiLevel || input.emoji_level),
    cta_style: normalizeCtaStyle(input.ctaStyle || input.cta_style),

    pricing_mode: normalizePricingMode(input.pricingMode || input.pricing_mode),
    booking_mode: normalizeBookingMode(input.bookingMode || input.booking_mode),
    sales_mode: normalizeSalesMode(input.salesMode || input.sales_mode),

    capabilities_json: obj(input.capabilitiesJson ?? input.capabilities_json, {}),
    metadata_json: obj(input.metadataJson ?? input.metadata_json, {}),

    derived_from_profile: input.derivedFromProfile ?? input.derived_from_profile,
    approved_by: s(input.approvedBy || input.approved_by),
  };
}

export function mergeProfileJson(current = {}, patch = {}) {
  const cur = obj(current);
  const inc = obj(patch);

  return {
    ...mergeJsonObjects(cur, inc),
    services: mergeStringList(cur.services, inc.services, 40),
    products: mergeStringList(cur.products, inc.products, 40),
    pricingHints: mergeStringList(cur.pricingHints, inc.pricingHints, 40),
    hours: mergeStringList(cur.hours, inc.hours, 20),
    socialLinks: mergeSocialLinks(cur.socialLinks, inc.socialLinks, 30),
    bookingLinks: mergeUrlList(cur.bookingLinks, inc.bookingLinks, 20),
    whatsappLinks: mergeUrlList(cur.whatsappLinks, inc.whatsappLinks, 20),
    faqItems: mergeFaqItems(cur.faqItems, inc.faqItems, 30),
  };
}

export function mergeBusinessProfile(current = null, payload = {}, options = {}) {
  const intent = normalizeWriteIntent(options.intent, "manual");
  const currentProfile = current || null;
  const incoming = normalizeProfilePayload(payload);

  if (!currentProfile) {
    return {
      profile_status: incoming.profile_status,
      company_name: incoming.company_name,
      display_name: incoming.display_name || incoming.company_name,
      legal_name: incoming.legal_name,
      industry_key: incoming.industry_key,
      subindustry_key: incoming.subindustry_key,
      summary_short: incoming.summary_short,
      summary_long: incoming.summary_long,
      value_proposition: incoming.value_proposition,
      target_audience: incoming.target_audience,
      tone_profile: incoming.tone_profile,
      main_language: incoming.main_language || "az",
      supported_languages: arr(incoming.supported_languages, []),
      website_url: isLikelyBusinessWebsiteUrl(incoming.website_url) ? incoming.website_url : "",
      primary_phone: incoming.primary_phone,
      primary_email: incoming.primary_email,
      primary_address: incoming.primary_address,
      profile_json: mergeProfileJson({}, incoming.profile_json),
      source_summary_json: obj(incoming.source_summary_json),
      metadata_json: obj(incoming.metadata_json),
      confidence: normalizeConfidence(incoming.confidence, 0),
      confidence_label: normalizeConfidenceLabel(incoming.confidence_label),
      generated_by: incoming.generated_by,
      approved_by: incoming.approved_by,
      generated_at: incoming.generated_at,
      approved_at: incoming.approved_at,
    };
  }

  const currentApproved = currentProfile.profile_status === "approved";
  const currentConfidence = normalizeConfidence(currentProfile.confidence, 0);
  const incomingConfidence = normalizeConfidence(incoming.confidence, currentConfidence);

  const nextProfileJson = mergeProfileJson(currentProfile.profile_json, incoming.profile_json);

  return {
    profile_status:
      intent === "manual" || intent === "manual_override"
        ? normalizeProfileStatus(incoming.profile_status || currentProfile.profile_status)
        : currentApproved
          ? "approved"
          : normalizeProfileStatus(incoming.profile_status || currentProfile.profile_status || "review"),

    company_name: chooseScalarValue(currentProfile.company_name, incoming.company_name, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 300,
    }),

    display_name: chooseScalarValue(
      currentProfile.display_name || currentProfile.company_name,
      incoming.display_name || incoming.company_name,
      {
        intent,
        currentConfidence,
        incomingConfidence,
        currentApproved,
        maxLength: 300,
      }
    ),

    legal_name: chooseScalarValue(currentProfile.legal_name, incoming.legal_name, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 300,
    }),

    industry_key: chooseScalarValue(currentProfile.industry_key, incoming.industry_key, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 120,
    }),

    subindustry_key: chooseScalarValue(currentProfile.subindustry_key, incoming.subindustry_key, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 120,
    }),

    summary_short: chooseScalarValue(currentProfile.summary_short, incoming.summary_short, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 500,
    }),

    summary_long: chooseScalarValue(currentProfile.summary_long, incoming.summary_long, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 3000,
    }),

    value_proposition: chooseScalarValue(currentProfile.value_proposition, incoming.value_proposition, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 800,
    }),

    target_audience: chooseScalarValue(currentProfile.target_audience, incoming.target_audience, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 800,
    }),

    tone_profile: chooseScalarValue(currentProfile.tone_profile, incoming.tone_profile, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 400,
    }),

    main_language: chooseScalarValue(currentProfile.main_language, incoming.main_language || "az", {
      intent: intent === "manual_override" ? "manual_override" : "manual",
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 24,
    }),

    supported_languages: mergeStringList(currentProfile.supported_languages, incoming.supported_languages, 20),

    website_url: chooseScalarValue(currentProfile.website_url, incoming.website_url, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 500,
      validator: isLikelyBusinessWebsiteUrl,
    }),

    primary_phone: chooseScalarValue(currentProfile.primary_phone, incoming.primary_phone, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 120,
    }),

    primary_email: chooseScalarValue(currentProfile.primary_email, incoming.primary_email, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 320,
    }),

    primary_address: chooseScalarValue(currentProfile.primary_address, incoming.primary_address, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 1200,
    }),

    profile_json: nextProfileJson,
    source_summary_json: mergeJsonObjects(currentProfile.source_summary_json, incoming.source_summary_json),
    metadata_json: mergeJsonObjects(currentProfile.metadata_json, incoming.metadata_json),

    confidence:
      intent === "manual" || intent === "manual_override"
        ? normalizeConfidence(incoming.confidence, currentConfidence)
        : Math.max(currentConfidence, incomingConfidence),

    confidence_label:
      intent === "manual" || intent === "manual_override"
        ? normalizeConfidenceLabel(incoming.confidence_label)
        : normalizeConfidenceLabel(
            Math.max(currentConfidence, incomingConfidence) >= 0.92
              ? "very_high"
              : Math.max(currentConfidence, incomingConfidence) >= 0.8
                ? "high"
                : Math.max(currentConfidence, incomingConfidence) >= 0.6
                  ? "medium"
                  : "low"
          ),

    generated_by: s(incoming.generated_by || currentProfile.generated_by),
    approved_by:
      intent === "manual" || intent === "manual_override" || intent === "approved_projection"
        ? s(incoming.approved_by || currentProfile.approved_by)
        : s(currentProfile.approved_by),

    generated_at: incoming.generated_at || currentProfile.generated_at,
    approved_at:
      intent === "manual" || intent === "manual_override" || intent === "approved_projection"
        ? incoming.approved_at || currentProfile.approved_at
        : currentProfile.approved_at,
  };
}

export function mergeBusinessCapabilities(current = null, payload = {}, options = {}) {
  const intent = normalizeWriteIntent(options.intent, "manual");
  const inc = normalizeCapabilitiesPayload(payload);
  const cur = current || null;

  if (!cur) {
    return {
      can_share_prices: b(inc.can_share_prices, false),
      can_share_starting_prices: b(inc.can_share_starting_prices, false),
      requires_human_for_custom_quote: b(inc.requires_human_for_custom_quote, true),

      can_capture_leads: b(inc.can_capture_leads, true),
      can_capture_phone: b(inc.can_capture_phone, true),
      can_capture_email: b(inc.can_capture_email, true),

      can_offer_booking: b(inc.can_offer_booking, false),
      can_offer_consultation: b(inc.can_offer_consultation, false),
      can_offer_callback: b(inc.can_offer_callback, true),

      supports_instagram_dm: b(inc.supports_instagram_dm, false),
      supports_facebook_messenger: b(inc.supports_facebook_messenger, false),
      supports_whatsapp: b(inc.supports_whatsapp, false),
      supports_comments: b(inc.supports_comments, false),
      supports_voice: b(inc.supports_voice, false),
      supports_email: b(inc.supports_email, false),

      supports_multilanguage: b(inc.supports_multilanguage, false),
      primary_language: s(inc.primary_language || "az"),
      supported_languages: arr(inc.supported_languages, []),

      handoff_enabled: b(inc.handoff_enabled, true),
      auto_handoff_on_human_request: b(inc.auto_handoff_on_human_request, true),
      auto_handoff_on_low_confidence: b(inc.auto_handoff_on_low_confidence, true),

      should_avoid_competitor_comparisons: b(inc.should_avoid_competitor_comparisons, true),
      should_avoid_legal_claims: b(inc.should_avoid_legal_claims, true),
      should_avoid_unverified_promises: b(inc.should_avoid_unverified_promises, true),

      reply_style: normalizeReplyStyle(inc.reply_style),
      reply_length: normalizeReplyLength(inc.reply_length),
      emoji_level: normalizeEmojiLevel(inc.emoji_level),
      cta_style: normalizeCtaStyle(inc.cta_style),

      pricing_mode: normalizePricingMode(inc.pricing_mode),
      booking_mode: normalizeBookingMode(inc.booking_mode),
      sales_mode: normalizeSalesMode(inc.sales_mode),

      capabilities_json: obj(inc.capabilities_json),
      metadata_json: obj(inc.metadata_json),

      derived_from_profile: b(inc.derived_from_profile, false),
      approved_by: s(inc.approved_by),
    };
  }

  return {
    can_share_prices: chooseBooleanValue(cur.can_share_prices, inc.can_share_prices, { intent }),
    can_share_starting_prices: chooseBooleanValue(
      cur.can_share_starting_prices,
      inc.can_share_starting_prices,
      { intent }
    ),
    requires_human_for_custom_quote: chooseBooleanValue(
      cur.requires_human_for_custom_quote,
      inc.requires_human_for_custom_quote,
      { intent }
    ),

    can_capture_leads: chooseBooleanValue(cur.can_capture_leads, inc.can_capture_leads, { intent }),
    can_capture_phone: chooseBooleanValue(cur.can_capture_phone, inc.can_capture_phone, { intent }),
    can_capture_email: chooseBooleanValue(cur.can_capture_email, inc.can_capture_email, { intent }),

    can_offer_booking: chooseBooleanValue(cur.can_offer_booking, inc.can_offer_booking, { intent }),
    can_offer_consultation: chooseBooleanValue(
      cur.can_offer_consultation,
      inc.can_offer_consultation,
      { intent }
    ),
    can_offer_callback: chooseBooleanValue(cur.can_offer_callback, inc.can_offer_callback, { intent }),

    supports_instagram_dm: chooseBooleanValue(
      cur.supports_instagram_dm,
      inc.supports_instagram_dm,
      { intent }
    ),
    supports_facebook_messenger: chooseBooleanValue(
      cur.supports_facebook_messenger,
      inc.supports_facebook_messenger,
      { intent }
    ),
    supports_whatsapp: chooseBooleanValue(cur.supports_whatsapp, inc.supports_whatsapp, { intent }),
    supports_comments: chooseBooleanValue(cur.supports_comments, inc.supports_comments, { intent }),
    supports_voice: chooseBooleanValue(cur.supports_voice, inc.supports_voice, { intent }),
    supports_email: chooseBooleanValue(cur.supports_email, inc.supports_email, { intent }),

    supports_multilanguage: chooseBooleanValue(
      cur.supports_multilanguage,
      inc.supports_multilanguage,
      { intent }
    ),
    primary_language: chooseScalarValue(cur.primary_language, inc.primary_language, {
      intent: intent === "manual_override" ? "manual_override" : "manual",
      maxLength: 24,
    }),
    supported_languages: mergeStringList(cur.supported_languages, inc.supported_languages, 20),

    handoff_enabled: chooseBooleanValue(cur.handoff_enabled, inc.handoff_enabled, { intent }),
    auto_handoff_on_human_request: chooseBooleanValue(
      cur.auto_handoff_on_human_request,
      inc.auto_handoff_on_human_request,
      { intent }
    ),
    auto_handoff_on_low_confidence: chooseBooleanValue(
      cur.auto_handoff_on_low_confidence,
      inc.auto_handoff_on_low_confidence,
      { intent }
    ),

    should_avoid_competitor_comparisons: chooseBooleanValue(
      cur.should_avoid_competitor_comparisons,
      inc.should_avoid_competitor_comparisons,
      { intent }
    ),
    should_avoid_legal_claims: chooseBooleanValue(
      cur.should_avoid_legal_claims,
      inc.should_avoid_legal_claims,
      { intent }
    ),
    should_avoid_unverified_promises: chooseBooleanValue(
      cur.should_avoid_unverified_promises,
      inc.should_avoid_unverified_promises,
      { intent }
    ),

    reply_style: chooseEnumValue(cur.reply_style, inc.reply_style, { intent }),
    reply_length: chooseEnumValue(cur.reply_length, inc.reply_length, { intent }),
    emoji_level: chooseEnumValue(cur.emoji_level, inc.emoji_level, { intent }),
    cta_style: chooseEnumValue(cur.cta_style, inc.cta_style, { intent }),

    pricing_mode: chooseEnumValue(cur.pricing_mode, inc.pricing_mode, { intent }),
    booking_mode: chooseEnumValue(cur.booking_mode, inc.booking_mode, { intent }),
    sales_mode: chooseEnumValue(cur.sales_mode, inc.sales_mode, { intent }),

    capabilities_json: mergeJsonObjects(cur.capabilities_json, inc.capabilities_json),
    metadata_json: mergeJsonObjects(cur.metadata_json, inc.metadata_json),

    derived_from_profile:
      intent === "manual" || intent === "manual_override"
        ? b(inc.derived_from_profile, cur.derived_from_profile)
        : b(cur.derived_from_profile, false) || b(inc.derived_from_profile, false),

    approved_by:
      intent === "manual" || intent === "manual_override" || intent === "approved_projection"
        ? s(inc.approved_by || cur.approved_by)
        : s(cur.approved_by),
  };
}

export function normalizeKnowledgePayload(input = {}) {
  const category = normalizeCategory(input.category);
  const itemKey = s(input.itemKey || input.item_key);
  const canonicalKey = s(
    input.canonicalKey || input.canonical_key,
    buildCanonicalKey(category, itemKey, input.valueText || input.value_text || input.title || itemKey)
  );

  return {
    canonical_key: canonicalKey,
    category,
    item_key: itemKey,
    title: s(input.title),
    value_text: s(input.valueText || input.value_text),
    value_json: obj(input.valueJson ?? input.value_json, {}),
    normalized_text: s(input.normalizedText || input.normalized_text),
    normalized_json: obj(input.normalizedJson ?? input.normalized_json, {}),
    status: normalizeKnowledgeStatus(input.status || "approved"),
    priority: Math.max(0, n(input.priority, 100)),
    confidence: normalizeConfidence(input.confidence, 1),
    source_count: Math.max(0, n(input.sourceCount ?? input.source_count, 0)),
    primary_source_id: s(input.primarySourceId || input.primary_source_id) || null,
    source_evidence_json: arr(input.sourceEvidenceJson || input.source_evidence_json, []),
    approval_mode: normalizeApprovalMode(input.approvalMode || input.approval_mode || "manual"),
    approved_from_candidate_id: s(input.approvedFromCandidateId || input.approved_from_candidate_id) || null,
    effective_from: input.effectiveFrom || input.effective_from || null,
    effective_to: input.effectiveTo || input.effective_to || null,
    tags_json: arr(input.tagsJson || input.tags_json, []),
    metadata_json: obj(input.metadataJson ?? input.metadata_json, {}),
    created_by: s(input.createdBy || input.created_by),
    approved_by: s(input.approvedBy || input.approved_by),
    updated_by: s(input.updatedBy || input.updated_by || input.approvedBy || input.createdBy),
    approved_at: input.approvedAt || input.approved_at || null,
  };
}

export function mergeKnowledgeItem(current = null, payload = {}, options = {}) {
  const intent = normalizeWriteIntent(options.intent, "manual");
  const inc = normalizeKnowledgePayload(payload);

  if (!current) {
    return { ...inc };
  }

  const currentApproved = ["approved", "active"].includes(current.status);
  const currentConfidence = normalizeConfidence(current.confidence, 0);
  const incomingConfidence = normalizeConfidence(inc.confidence, currentConfidence);

  return {
    canonical_key: s(inc.canonical_key || current.canonical_key),
    category: normalizeCategory(inc.category || current.category),
    item_key: s(inc.item_key || current.item_key),

    title: chooseScalarValue(current.title, inc.title, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 300,
    }),

    value_text: chooseScalarValue(current.value_text, inc.value_text, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 4000,
    }),

    value_json: chooseJsonValue(current.value_json, inc.value_json, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
    }),

    normalized_text: chooseScalarValue(current.normalized_text, inc.normalized_text, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
      maxLength: 4000,
    }),

    normalized_json: chooseJsonValue(current.normalized_json, inc.normalized_json, {
      intent,
      currentConfidence,
      incomingConfidence,
      currentApproved,
    }),

    status:
      intent === "manual" || intent === "manual_override"
        ? normalizeKnowledgeStatus(inc.status)
        : currentApproved
          ? current.status
          : normalizeKnowledgeStatus(inc.status || current.status),

    priority:
      intent === "manual" || intent === "manual_override"
        ? Math.max(0, n(inc.priority, current.priority))
        : Math.min(Math.max(0, n(inc.priority, current.priority)), current.priority || inc.priority || 100),

    confidence:
      intent === "manual" || intent === "manual_override"
        ? normalizeConfidence(inc.confidence, currentConfidence)
        : Math.max(currentConfidence, incomingConfidence),

    source_count: Math.max(n(current.source_count, 0), n(inc.source_count, 0)),
    primary_source_id: s(inc.primary_source_id || current.primary_source_id) || null,

    source_evidence_json: uniqueJsonList([
      ...arr(current.source_evidence_json, []),
      ...arr(inc.source_evidence_json, []),
    ]),

    approval_mode:
      intent === "manual" || intent === "manual_override"
        ? normalizeApprovalMode(inc.approval_mode)
        : normalizeApprovalMode(current.approval_mode || inc.approval_mode),

    approved_from_candidate_id:
      s(inc.approved_from_candidate_id || current.approved_from_candidate_id) || null,

    effective_from: inc.effective_from || current.effective_from,
    effective_to: inc.effective_to || current.effective_to,

    tags_json: mergeStringList(current.tags_json, inc.tags_json, 40),
    metadata_json: mergeJsonObjects(current.metadata_json, inc.metadata_json),

    created_by: s(current.created_by || inc.created_by),
    approved_by:
      intent === "manual" || intent === "manual_override" || intent === "approved_projection"
        ? s(inc.approved_by || current.approved_by)
        : s(current.approved_by),

    updated_by: s(inc.updated_by || current.updated_by || inc.approved_by || inc.created_by),
    approved_at:
      intent === "manual" || intent === "manual_override" || intent === "approved_projection"
        ? inc.approved_at || current.approved_at
        : current.approved_at,
  };
}

export function buildProfileProjectionPatchFromCandidate(candidate = {}) {
  const category = normalizeCategory(candidate.category);
  const itemKey = lower(candidate.item_key);
  const valueText = s(candidate.value_text);
  const valueJson = obj(candidate.value_json);
  const confidence = normalizeConfidence(candidate.confidence, 0);

  const profileJson = {};
  const scalar = {};

  if (category === "company") {
    scalar.companyName = valueJson.company_name || valueText;
    scalar.displayName = valueJson.company_name || valueText;
  }

  if (category === "summary") {
    if (itemKey.includes("long")) {
      scalar.summaryLong = valueJson.summary || valueText;
    } else {
      scalar.summaryShort = valueJson.summary || valueText;
      scalar.valueProposition = valueJson.summary || valueText;
    }
  }

  if (category === "contact") {
    if (itemKey.startsWith("email") || valueJson.email) {
      scalar.primaryEmail = valueJson.email || valueText;
    }
    if (itemKey.startsWith("phone") || valueJson.phone) {
      scalar.primaryPhone = valueJson.phone || valueText;
    }
  }

  if (category === "location") {
    scalar.primaryAddress = valueJson.address || valueText;
  }

  if (category === "pricing_policy") {
    profileJson.pricingPolicy = valueJson.policy || valueText;
  }

  if (category === "pricing") {
    profileJson.pricingHints = [valueJson.text || valueText];
  }

  if (category === "hours") {
    profileJson.hours = [valueJson.hours || valueText];
  }

  if (category === "support") {
    profileJson.supportMode = valueJson.support_mode || valueText;
  }

  if (category === "service") {
    profileJson.services = [valueJson.service || valueText];
  }

  if (category === "product") {
    profileJson.products = [valueJson.product || valueText];
  }

  if (category === "faq") {
    profileJson.faqItems = [
      {
        question: s(valueJson.question || candidate.title),
        answer: s(valueJson.answer),
      },
    ];
  }

  if (category === "social_link") {
    const platform = s(valueJson.platform);
    const url = s(valueJson.url || valueText);
    if (platform && url) {
      profileJson.socialLinks = [{ platform, url }];
      if (lower(platform) === "whatsapp") {
        profileJson.whatsappLinks = [url];
      }
    }
  }

  if (category === "booking") {
    const url = s(valueJson.url || valueText);
    const type = lower(valueJson.type);

    if (url) {
      if (type === "whatsapp" || /wa\.me|whatsapp/i.test(url)) {
        profileJson.whatsappLinks = [url];
      } else {
        profileJson.bookingLinks = [url];
      }
    }
  }

  return {
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
    profileStatus: "approved",
    ...scalar,
    profileJson,
    confidence,
    confidenceLabel: normalizeConfidenceLabel(candidate.confidence_label),
  };
}

export function buildCapabilitiesProjectionPatchFromCandidate(candidate = {}) {
  const category = normalizeCategory(candidate.category);
  const itemKey = lower(candidate.item_key);
  const valueText = lower(candidate.value_text);
  const valueJson = obj(candidate.value_json);

  const patch = {
    tenantId: candidate.tenant_id,
    tenantKey: candidate.tenant_key,
    writeIntent: "approved_projection",
    approvedBy: "",
  };

  if (category === "pricing" || category === "pricing_policy") {
    patch.canSharePrices = true;

    const joined = lower([valueText, s(valueJson.policy), s(valueJson.text)].join(" | "));
    if (/\b(from|starting|starting at)\b/i.test(joined)) {
      patch.canShareStartingPrices = true;
      patch.pricingMode = "starting_price";
    }
    if (/\b(custom|quote|consultation|request quote)\b/i.test(joined)) {
      patch.requiresHumanForCustomQuote = true;
      patch.pricingMode = "custom_quote";
      patch.salesMode = "consultative";
    }
  }

  if (category === "contact") {
    if (itemKey.startsWith("email") || valueJson.email) {
      patch.canCaptureEmail = true;
      patch.supportsEmail = true;
    }
    if (itemKey.startsWith("phone") || valueJson.phone) {
      patch.canCapturePhone = true;
      patch.canOfferCallback = true;
    }
    patch.canCaptureLeads = true;
  }

  if (category === "booking") {
    const url = s(valueJson.url || candidate.value_text);
    const type = lower(valueJson.type);

    patch.canOfferBooking = true;
    patch.canCaptureLeads = true;

    if (type === "whatsapp" || /wa\.me|whatsapp/i.test(url)) {
      patch.bookingMode = "whatsapp";
    } else {
      patch.bookingMode = "form";
    }
  }

  if (category === "company" || category === "summary" || category === "service") {
    patch.replyStyle = "professional";
    patch.replyLength = "medium";
    patch.emojiLevel = "low";
    patch.ctaStyle = "soft";
  }

  return patch;
}

export { resolveWriteIntent };