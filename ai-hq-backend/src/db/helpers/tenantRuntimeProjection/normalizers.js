import {
  s,
  arr,
  bool,
  num,
  parseArray,
  parseObject,
} from "./shared.js";

export function normalizeProfile(tenant, profile) {
  const supportedLanguages = parseArray(profile?.supported_languages);
  const profileJson = parseObject(profile?.profile_json);
  const sourceSummaryJson = parseObject(profile?.source_summary_json);
  const metadataJson = parseObject(profile?.metadata_json);
  const fallbackSupportedLanguages =
    supportedLanguages.length > 0
      ? supportedLanguages
      : parseArray(profile?.supportedLanguages);

  return {
    tenantId: s(tenant?.id),
    tenantKey: s(profile?.tenant_key || tenant?.tenant_key),
    companyName: s(
      profile?.company_name || profile?.companyName || tenant?.company_name
    ),
    displayName: s(
      profile?.display_name ||
        profile?.displayName ||
        profile?.company_name ||
        profile?.companyName ||
        tenant?.company_name
    ),
    legalName: s(profile?.legal_name || profile?.legalName),
    industryKey: s(profile?.industry_key || profile?.industryKey),
    subindustryKey: s(profile?.subindustry_key || profile?.subindustryKey),
    summaryShort: s(profile?.summary_short || profile?.summaryShort),
    summaryLong: s(profile?.summary_long || profile?.summaryLong),
    valueProposition: s(
      profile?.value_proposition || profile?.valueProposition
    ),
    targetAudience: s(profile?.target_audience || profile?.targetAudience),
    toneProfile: s(profile?.tone_profile || profile?.toneProfile || profile?.tone),
    mainLanguage: s(
      profile?.main_language || profile?.mainLanguage || tenant?.default_language || "az"
    ),
    supportedLanguages: fallbackSupportedLanguages,
    websiteUrl: s(profile?.website_url || profile?.websiteUrl),
    primaryPhone: s(profile?.primary_phone || profile?.primaryPhone),
    primaryEmail: s(profile?.primary_email || profile?.primaryEmail),
    primaryAddress: s(profile?.primary_address || profile?.primaryAddress),
    profileStatus: s(profile?.profile_status || profile?.profileStatus || "draft"),
    confidence: num(profile?.confidence, 0),
    confidenceLabel: s(profile?.confidence_label || profile?.confidenceLabel || "low"),
    profileJson,
    sourceSummaryJson,
    metadataJson,
  };
}

export function normalizeCapabilities(capabilities, profile) {
  const supportedLanguages =
    parseArray(capabilities?.supported_languages).length > 0
      ? parseArray(capabilities?.supported_languages)
      : parseArray(capabilities?.supportedLanguages).length > 0
      ? parseArray(capabilities?.supportedLanguages)
      : parseArray(profile?.supported_languages);

  return {
    canSharePrices: bool(capabilities?.can_share_prices ?? capabilities?.canSharePrices, false),
    canShareStartingPrices: bool(
      capabilities?.can_share_starting_prices ?? capabilities?.canShareStartingPrices,
      false
    ),
    requiresHumanForCustomQuote: bool(
      capabilities?.requires_human_for_custom_quote ??
        capabilities?.requiresHumanForCustomQuote,
      true
    ),

    canCaptureLeads: bool(capabilities?.can_capture_leads ?? capabilities?.canCaptureLeads, true),
    canCapturePhone: bool(capabilities?.can_capture_phone ?? capabilities?.canCapturePhone, true),
    canCaptureEmail: bool(capabilities?.can_capture_email ?? capabilities?.canCaptureEmail, true),

    canOfferBooking: bool(capabilities?.can_offer_booking ?? capabilities?.canOfferBooking, false),
    canOfferConsultation: bool(
      capabilities?.can_offer_consultation ?? capabilities?.canOfferConsultation,
      false
    ),
    canOfferCallback: bool(capabilities?.can_offer_callback ?? capabilities?.canOfferCallback, true),

    supportsInstagramDm: bool(
      capabilities?.supports_instagram_dm ?? capabilities?.supportsInstagramDm,
      false
    ),
    supportsFacebookMessenger: bool(
      capabilities?.supports_facebook_messenger ??
        capabilities?.supportsFacebookMessenger,
      false
    ),
    supportsWhatsapp: bool(capabilities?.supports_whatsapp ?? capabilities?.supportsWhatsapp, false),
    supportsComments: bool(capabilities?.supports_comments ?? capabilities?.supportsComments, false),
    supportsVoice: bool(capabilities?.supports_voice ?? capabilities?.supportsVoice, false),
    supportsEmail: bool(capabilities?.supports_email ?? capabilities?.supportsEmail, false),

    supportsMultilanguage: bool(
      capabilities?.supports_multilanguage ?? capabilities?.supportsMultilanguage,
      supportedLanguages.length > 1
    ),
    primaryLanguage: s(
      capabilities?.primary_language ||
        capabilities?.primaryLanguage ||
        profile?.main_language ||
        profile?.mainLanguage ||
        "az"
    ),
    supportedLanguages,

    handoffEnabled: bool(capabilities?.handoff_enabled ?? capabilities?.handoffEnabled, true),
    autoHandoffOnHumanRequest: bool(
      capabilities?.auto_handoff_on_human_request ??
        capabilities?.autoHandoffOnHumanRequest,
      true
    ),
    autoHandoffOnLowConfidence: bool(
      capabilities?.auto_handoff_on_low_confidence ??
        capabilities?.autoHandoffOnLowConfidence,
      true
    ),

    shouldAvoidCompetitorComparisons: bool(
      capabilities?.should_avoid_competitor_comparisons ??
        capabilities?.shouldAvoidCompetitorComparisons,
      true
    ),
    shouldAvoidLegalClaims: bool(
      capabilities?.should_avoid_legal_claims ?? capabilities?.shouldAvoidLegalClaims,
      true
    ),
    shouldAvoidUnverifiedPromises: bool(
      capabilities?.should_avoid_unverified_promises ??
        capabilities?.shouldAvoidUnverifiedPromises,
      true
    ),

    replyStyle: s(capabilities?.reply_style || capabilities?.replyStyle || "professional"),
    replyLength: s(capabilities?.reply_length || capabilities?.replyLength || "medium"),
    emojiLevel: s(capabilities?.emoji_level || capabilities?.emojiLevel || "low"),
    ctaStyle: s(capabilities?.cta_style || capabilities?.ctaStyle || "soft"),

    pricingMode: s(capabilities?.pricing_mode || capabilities?.pricingMode || "custom_quote"),
    bookingMode: s(capabilities?.booking_mode || capabilities?.bookingMode || "manual"),
    salesMode: s(capabilities?.sales_mode || capabilities?.salesMode || "consultative"),

    capabilitiesJson: parseObject(capabilities?.capabilities_json),
    metadataJson: parseObject(capabilities?.metadata_json),
  };
}

export function normalizeContacts(rows = []) {
  return rows.map((r) => ({
    id: s(r.id || r.contactId || r.contact_id),
    contactKey: s(r.contact_key || r.contactKey || r.key),
    channel: s(r.channel),
    label: s(r.label),
    value: s(r.value),
    isPrimary: bool(r.is_primary ?? r.isPrimary, false),
    enabled: bool(r.enabled, true),
    visiblePublic: bool(r.visible_public ?? r.visiblePublic, true),
    visibleInAi: bool(r.visible_in_ai ?? r.visibleInAi, true),
    sortOrder: num(r.sort_order ?? r.sortOrder, 0),
    meta: parseObject(r.meta),
  }));
}

export function normalizeLocations(rows = []) {
  return rows.map((r) => ({
    id: s(r.id || r.locationId || r.location_id),
    locationKey: s(r.location_key || r.locationKey || r.key),
    title: s(r.title),
    countryCode: s(r.country_code || r.countryCode),
    city: s(r.city),
    addressLine: s(r.address_line || r.addressLine),
    mapUrl: s(r.map_url || r.mapUrl),
    phone: s(r.phone),
    email: s(r.email),
    workingHours: parseObject(r.working_hours ?? r.workingHours),
    deliveryAreas: parseArray(r.delivery_areas ?? r.deliveryAreas),
    isPrimary: bool(r.is_primary ?? r.isPrimary, false),
    enabled: bool(r.enabled, true),
    sortOrder: num(r.sort_order ?? r.sortOrder, 0),
    meta: parseObject(r.meta),
  }));
}

export function normalizeHours(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    locationId: s(r.location_id),
    hoursKey: s(r.hours_key),
    scopeType: s(r.scope_type),
    dayOfWeek: num(r.day_of_week, 0),
    label: s(r.label),
    openTime: s(r.open_time),
    closeTime: s(r.close_time),
    isClosed: bool(r.is_closed, false),
    is24h: bool(r.is_24h, false),
    sortOrder: num(r.sort_order, 0),
    isActive: bool(r.is_active, true),
    notesText: s(r.notes_text),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeServices(rows = []) {
  return rows.map((r) => ({
    id: s(r.id || r.serviceId || r.service_id),
    serviceKey: s(r.service_key || r.serviceKey || r.key),
    title: s(r.title || r.name),
    description: s(r.description || r.summary),
    category: s(r.category),
    priceFrom:
      r.price_from == null && r.priceFrom == null ? null : Number(r.price_from ?? r.priceFrom),
    currency: s(r.currency || "AZN"),
    pricingModel: s(r.pricing_model || r.pricingModel || "custom_quote"),
    durationMinutes:
      r.duration_minutes == null && r.durationMinutes == null
        ? null
        : num(r.duration_minutes ?? r.durationMinutes, 0),
    isActive: bool(r.is_active ?? r.isActive, true),
    sortOrder: num(r.sort_order ?? r.sortOrder, 0),
    highlights: parseArray(r.highlights_json ?? r.highlights),
    metadata: parseObject(r.metadata_json ?? r.metadata),
  }));
}

export function normalizeProducts(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    productKey: s(r.product_key),
    title: s(r.title),
    description: s(r.description),
    category: s(r.category),
    sku: s(r.sku),
    priceAmount: r.price_amount == null ? null : Number(r.price_amount),
    currency: s(r.currency || "AZN"),
    pricingModel: s(r.pricing_model || "custom_quote"),
    isActive: bool(r.is_active, true),
    sortOrder: num(r.sort_order, 0),
    highlights: parseArray(r.highlights_json),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeFaq(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    faqKey: s(r.faq_key),
    question: s(r.question),
    answer: s(r.answer),
    category: s(r.category),
    isActive: bool(r.is_active, true),
    sortOrder: num(r.sort_order, 0),
    tags: parseArray(r.tags_json),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizePolicies(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    policyKey: s(r.policy_key),
    policyType: s(r.policy_type),
    title: s(r.title),
    summaryText: s(r.summary_text),
    policyText: s(r.policy_text),
    policyJson: parseObject(r.policy_json),
    isActive: bool(r.is_active, true),
    priority: num(r.priority, 100),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeSocialAccounts(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    sourceId: s(r.source_id),
    accountKey: s(r.account_key),
    platform: s(r.platform),
    handle: s(r.handle),
    displayName: s(r.display_name),
    profileUrl: s(r.profile_url),
    externalAccountId: s(r.external_account_id),
    bioText: s(r.bio_text),
    isPrimary: bool(r.is_primary, false),
    isVerified: bool(r.is_verified, false),
    isActive: bool(r.is_active, true),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeChannels(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    sourceId: s(r.source_id),
    socialAccountId: s(r.social_account_id),
    channelKey: s(r.channel_key),
    channelType: s(r.channel_type),
    label: s(r.label),
    endpoint: s(r.endpoint),
    externalChannelId: s(r.external_channel_id),
    isPrimary: bool(r.is_primary, false),
    isConnected: bool(r.is_connected, false),
    isActive: bool(r.is_active, true),
    supportsInbound: bool(r.supports_inbound, true),
    supportsOutbound: bool(r.supports_outbound, false),
    supportsComments: bool(r.supports_comments, false),
    supportsCalls: bool(r.supports_calls, false),
    supportsHandoff: bool(r.supports_handoff, true),
    status: s(r.status || "draft"),
    config: parseObject(r.config_json),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeMediaAssets(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    sourceId: s(r.source_id),
    sourceRunId: s(r.source_run_id),
    assetKey: s(r.asset_key),
    assetType: s(r.asset_type),
    title: s(r.title),
    url: s(r.url),
    storageUrl: s(r.storage_url),
    mimeType: s(r.mime_type),
    altText: s(r.alt_text),
    width: r.width == null ? null : num(r.width, 0),
    height: r.height == null ? null : num(r.height, 0),
    durationMs: r.duration_ms == null ? null : num(r.duration_ms, 0),
    visibility: s(r.visibility),
    isPrimary: bool(r.is_primary, false),
    isActive: bool(r.is_active, true),
    tags: parseArray(r.tags_json),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeKnowledge(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    canonicalKey: s(r.canonical_key),
    category: s(r.category),
    itemKey: s(r.item_key),
    title: s(r.title),
    valueText: s(r.value_text),
    valueJson: parseObject(r.value_json),
    normalizedText: s(r.normalized_text),
    normalizedJson: parseObject(r.normalized_json),
    priority: num(r.priority, 100),
    confidence: num(r.confidence, 1),
    sourceCount: num(r.source_count, 0),
    primarySourceId: s(r.primary_source_id),
    sourceEvidence: parseArray(r.source_evidence_json),
    tags: parseArray(r.tags_json),
    metadata: parseObject(r.metadata_json),
  }));
}

export function normalizeFacts(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    factKey: s(r.fact_key),
    factGroup: s(r.fact_group),
    title: s(r.title),
    valueText: s(r.value_text),
    valueJson: parseObject(r.value_json),
    language: s(r.language || "en"),
    channelScope: parseArray(r.channel_scope),
    usecaseScope: parseArray(r.usecase_scope),
    priority: num(r.priority, 100),
    enabled: bool(r.enabled, true),
    sourceType: s(r.source_type || "manual"),
    sourceRef: s(r.source_ref),
    meta: parseObject(r.meta),
  }));
}

export function normalizeChannelPolicies(rows = []) {
  return rows.map((r) => ({
    id: s(r.id),
    channel: s(r.channel),
    subchannel: s(r.subchannel || "default"),
    enabled: bool(r.enabled, true),
    autoReplyEnabled: bool(r.auto_reply_enabled, true),
    aiReplyEnabled: bool(r.ai_reply_enabled, true),
    humanHandoffEnabled: bool(r.human_handoff_enabled, true),
    pricingVisibility: s(r.pricing_visibility || "inherit"),
    publicReplyMode: s(r.public_reply_mode || "inherit"),
    contactCaptureMode: s(r.contact_capture_mode || "inherit"),
    escalationMode: s(r.escalation_mode || "inherit"),
    replyStyle: s(r.reply_style),
    maxReplySentences: num(r.max_reply_sentences, 2),
    rules: parseObject(r.rules),
    meta: parseObject(r.meta),
  }));
}
