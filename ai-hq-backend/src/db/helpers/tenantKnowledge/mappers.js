import {
  s,
  n,
  b,
  iso,
  normalizeJson,
  normalizeCategory,
  normalizeCandidateStatus,
  normalizeConfidence,
  normalizeConfidenceLabel,
  normalizeKnowledgeStatus,
  normalizeApprovalMode,
  normalizeApprovalAction,
  normalizeApprovalDecision,
  normalizeReviewerType,
  normalizeProfileStatus,
  normalizeReplyStyle,
  normalizeReplyLength,
  normalizeEmojiLevel,
  normalizeCtaStyle,
  normalizePricingMode,
  normalizeBookingMode,
  normalizeSalesMode,
  normalizeExtractionMethod,
} from "./shared.js";

export function rowToCandidate(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    source_id: s(row.source_id),
    source_run_id: s(row.source_run_id),

    candidate_group: s(row.candidate_group),
    category: normalizeCategory(row.category),
    item_key: s(row.item_key),

    title: s(row.title),
    value_text: s(row.value_text),
    value_json: normalizeJson(row.value_json, {}),

    normalized_text: s(row.normalized_text),
    normalized_json: normalizeJson(row.normalized_json, {}),

    confidence: normalizeConfidence(row.confidence, 0),
    confidence_label: normalizeConfidenceLabel(row.confidence_label),

    status: normalizeCandidateStatus(row.status),
    review_reason: s(row.review_reason),
    conflict_hash: s(row.conflict_hash),

    source_evidence_json: normalizeJson(row.source_evidence_json, []),
    extraction_method: normalizeExtractionMethod(row.extraction_method),
    extraction_model: s(row.extraction_model),

    first_seen_at: iso(row.first_seen_at),
    last_seen_at: iso(row.last_seen_at),

    approved_item_id: s(row.approved_item_id),
    superseded_by_candidate_id: s(row.superseded_by_candidate_id),

    reviewed_by: s(row.reviewed_by),
    reviewed_at: iso(row.reviewed_at),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function rowToKnowledgeItem(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    canonical_key: s(row.canonical_key),
    category: normalizeCategory(row.category),
    item_key: s(row.item_key),

    title: s(row.title),
    value_text: s(row.value_text),
    value_json: normalizeJson(row.value_json, {}),

    normalized_text: s(row.normalized_text),
    normalized_json: normalizeJson(row.normalized_json, {}),

    status: normalizeKnowledgeStatus(row.status),
    priority: n(row.priority, 100),
    confidence: normalizeConfidence(row.confidence, 1),

    source_count: n(row.source_count, 0),
    primary_source_id: s(row.primary_source_id),
    source_evidence_json: normalizeJson(row.source_evidence_json, []),

    approval_mode: normalizeApprovalMode(row.approval_mode),
    approved_from_candidate_id: s(row.approved_from_candidate_id),

    effective_from: iso(row.effective_from),
    effective_to: iso(row.effective_to),

    tags_json: normalizeJson(row.tags_json, []),
    metadata_json: normalizeJson(row.metadata_json, {}),

    created_by: s(row.created_by),
    approved_by: s(row.approved_by),
    updated_by: s(row.updated_by),

    created_at: iso(row.created_at),
    approved_at: iso(row.approved_at),
    updated_at: iso(row.updated_at),
  };
}

export function rowToApproval(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    candidate_id: s(row.candidate_id),
    knowledge_item_id: s(row.knowledge_item_id),
    source_id: s(row.source_id),

    action: normalizeApprovalAction(row.action),
    decision: normalizeApprovalDecision(row.decision),

    reviewer_type: normalizeReviewerType(row.reviewer_type),
    reviewer_id: s(row.reviewer_id),
    reviewer_name: s(row.reviewer_name),

    reason: s(row.reason),
    before_json: normalizeJson(row.before_json, {}),
    after_json: normalizeJson(row.after_json, {}),
    metadata_json: normalizeJson(row.metadata_json, {}),

    created_at: iso(row.created_at),
  };
}

export function rowToBusinessProfile(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    profile_status: normalizeProfileStatus(row.profile_status),

    company_name: s(row.company_name),
    display_name: s(row.display_name),
    legal_name: s(row.legal_name),
    industry_key: s(row.industry_key),
    subindustry_key: s(row.subindustry_key),

    summary_short: s(row.summary_short),
    summary_long: s(row.summary_long),
    value_proposition: s(row.value_proposition),
    target_audience: s(row.target_audience),
    tone_profile: s(row.tone_profile),

    main_language: s(row.main_language || "az"),
    supported_languages: normalizeJson(row.supported_languages, []),

    website_url: s(row.website_url),
    primary_phone: s(row.primary_phone),
    primary_email: s(row.primary_email),
    primary_address: s(row.primary_address),

    profile_json: normalizeJson(row.profile_json, {}),
    source_summary_json: normalizeJson(row.source_summary_json, {}),
    metadata_json: normalizeJson(row.metadata_json, {}),

    confidence: normalizeConfidence(row.confidence, 0),
    confidence_label: normalizeConfidenceLabel(row.confidence_label),

    generated_by: s(row.generated_by),
    approved_by: s(row.approved_by),

    generated_at: iso(row.generated_at),
    approved_at: iso(row.approved_at),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function rowToBusinessCapabilities(row) {
  if (!row) return null;

  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),

    can_share_prices: b(row.can_share_prices, false),
    can_share_starting_prices: b(row.can_share_starting_prices, false),
    requires_human_for_custom_quote: b(row.requires_human_for_custom_quote, true),

    can_capture_leads: b(row.can_capture_leads, true),
    can_capture_phone: b(row.can_capture_phone, true),
    can_capture_email: b(row.can_capture_email, true),

    can_offer_booking: b(row.can_offer_booking, false),
    can_offer_consultation: b(row.can_offer_consultation, false),
    can_offer_callback: b(row.can_offer_callback, true),

    supports_instagram_dm: b(row.supports_instagram_dm, false),
    supports_facebook_messenger: b(row.supports_facebook_messenger, false),
    supports_whatsapp: b(row.supports_whatsapp, false),
    supports_comments: b(row.supports_comments, false),
    supports_voice: b(row.supports_voice, false),
    supports_email: b(row.supports_email, false),

    supports_multilanguage: b(row.supports_multilanguage, false),
    primary_language: s(row.primary_language || "az"),
    supported_languages: normalizeJson(row.supported_languages, []),

    handoff_enabled: b(row.handoff_enabled, true),
    auto_handoff_on_human_request: b(row.auto_handoff_on_human_request, true),
    auto_handoff_on_low_confidence: b(row.auto_handoff_on_low_confidence, true),

    should_avoid_competitor_comparisons: b(row.should_avoid_competitor_comparisons, true),
    should_avoid_legal_claims: b(row.should_avoid_legal_claims, true),
    should_avoid_unverified_promises: b(row.should_avoid_unverified_promises, true),

    reply_style: normalizeReplyStyle(row.reply_style),
    reply_length: normalizeReplyLength(row.reply_length),
    emoji_level: normalizeEmojiLevel(row.emoji_level),
    cta_style: normalizeCtaStyle(row.cta_style),

    pricing_mode: normalizePricingMode(row.pricing_mode),
    booking_mode: normalizeBookingMode(row.booking_mode),
    sales_mode: normalizeSalesMode(row.sales_mode),

    capabilities_json: normalizeJson(row.capabilities_json, {}),
    metadata_json: normalizeJson(row.metadata_json, {}),

    derived_from_profile: b(row.derived_from_profile, false),
    approved_by: s(row.approved_by),

    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}