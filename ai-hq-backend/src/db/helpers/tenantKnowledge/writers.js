import {
  s,
  b,
  obj,
  arr,
  normalizeCategory,
  normalizeCandidateStatus,
  normalizeConfidence,
  normalizeConfidenceLabel,
  normalizeExtractionMethod,
  normalizeApprovalAction,
  normalizeApprovalDecision,
  normalizeReviewerType,
  normalizeReplyStyle,
  normalizeReplyLength,
  normalizeEmojiLevel,
  normalizeCtaStyle,
  normalizePricingMode,
  normalizeBookingMode,
  normalizeSalesMode,
} from "./shared.js";
import {
  rowToCandidate,
  rowToKnowledgeItem,
  rowToApproval,
  rowToBusinessProfile,
  rowToBusinessCapabilities,
} from "./mappers.js";
import {
  q,
  resolveTenantIdentity,
  getCandidateByIdInternal,
  getKnowledgeItemByCanonicalKeyInternal,
  getBusinessProfileInternal,
  getBusinessCapabilitiesInternal,
} from "./core.js";
import {
  normalizeKnowledgePayload,
  mergeKnowledgeItem,
  normalizeProfilePayload,
  mergeBusinessProfile,
  normalizeCapabilitiesPayload,
  mergeBusinessCapabilities,
  resolveWriteIntent,
} from "./merge.js";

export async function insertCandidateInternal(db, tenant, input = {}) {
  const r = await q(
    db,
    `
    insert into tenant_knowledge_candidates (
      tenant_id,
      tenant_key,
      source_id,
      source_run_id,
      candidate_group,
      category,
      item_key,
      title,
      value_text,
      value_json,
      normalized_text,
      normalized_json,
      confidence,
      confidence_label,
      status,
      review_reason,
      conflict_hash,
      source_evidence_json,
      extraction_method,
      extraction_model,
      first_seen_at,
      last_seen_at,
      approved_item_id,
      superseded_by_candidate_id,
      reviewed_by,
      reviewed_at
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
      $11,$12::jsonb,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,
      $21,$22,$23,$24,$25,$26
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      s(input.sourceId) || null,
      s(input.sourceRunId) || null,
      s(input.candidateGroup || "general"),
      normalizeCategory(input.category),
      s(input.itemKey),
      s(input.title),
      s(input.valueText),
      JSON.stringify(obj(input.valueJson, {})),
      s(input.normalizedText),
      JSON.stringify(obj(input.normalizedJson, {})),
      normalizeConfidence(input.confidence, 0),
      normalizeConfidenceLabel(input.confidenceLabel),
      normalizeCandidateStatus(input.status || "pending"),
      s(input.reviewReason),
      s(input.conflictHash),
      JSON.stringify(arr(input.sourceEvidenceJson, [])),
      normalizeExtractionMethod(input.extractionMethod),
      s(input.extractionModel),
      input.firstSeenAt || new Date().toISOString(),
      input.lastSeenAt || new Date().toISOString(),
      s(input.approvedItemId) || null,
      s(input.supersededByCandidateId) || null,
      s(input.reviewedBy),
      input.reviewedAt || null,
    ]
  );

  return rowToCandidate(r.rows[0]);
}

export async function updateCandidateInternal(db, candidateId, patch = {}) {
  const current = await getCandidateByIdInternal(db, candidateId);
  if (!current) return null;

  const r = await q(
    db,
    `
    update tenant_knowledge_candidates
    set
      candidate_group = $2,
      category = $3,
      item_key = $4,
      title = $5,
      value_text = $6,
      value_json = $7::jsonb,
      normalized_text = $8,
      normalized_json = $9::jsonb,
      confidence = $10,
      confidence_label = $11,
      status = $12,
      review_reason = $13,
      conflict_hash = $14,
      source_evidence_json = $15::jsonb,
      extraction_method = $16,
      extraction_model = $17,
      first_seen_at = $18,
      last_seen_at = $19,
      approved_item_id = $20,
      superseded_by_candidate_id = $21,
      reviewed_by = $22,
      reviewed_at = $23,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      s(candidateId),
      s(patch.candidateGroup, current.candidate_group),
      normalizeCategory(patch.category ?? current.category),
      s(patch.itemKey, current.item_key),
      s(patch.title, current.title),
      s(patch.valueText, current.value_text),
      JSON.stringify(patch.valueJson !== undefined ? obj(patch.valueJson, {}) : current.value_json),
      s(patch.normalizedText, current.normalized_text),
      JSON.stringify(
        patch.normalizedJson !== undefined ? obj(patch.normalizedJson, {}) : current.normalized_json
      ),
      normalizeConfidence(patch.confidence, current.confidence),
      normalizeConfidenceLabel(patch.confidenceLabel ?? current.confidence_label),
      normalizeCandidateStatus(patch.status ?? current.status),
      s(patch.reviewReason, current.review_reason),
      s(patch.conflictHash, current.conflict_hash),
      JSON.stringify(
        patch.sourceEvidenceJson !== undefined
          ? arr(patch.sourceEvidenceJson, [])
          : current.source_evidence_json
      ),
      normalizeExtractionMethod(patch.extractionMethod ?? current.extraction_method),
      s(patch.extractionModel, current.extraction_model),
      patch.firstSeenAt ?? current.first_seen_at,
      patch.lastSeenAt ?? current.last_seen_at,
      s(patch.approvedItemId || current.approved_item_id) || null,
      s(patch.supersededByCandidateId || current.superseded_by_candidate_id) || null,
      s(patch.reviewedBy, current.reviewed_by),
      patch.reviewedAt ?? current.reviewed_at,
    ]
  );

  return rowToCandidate(r.rows[0]);
}

export async function insertKnowledgeItemInternal(db, tenant, payload = {}) {
  const p = normalizeKnowledgePayload(payload);

  const r = await q(
    db,
    `
    insert into tenant_knowledge_items (
      tenant_id,
      tenant_key,
      canonical_key,
      category,
      item_key,
      title,
      value_text,
      value_json,
      normalized_text,
      normalized_json,
      status,
      priority,
      confidence,
      source_count,
      primary_source_id,
      source_evidence_json,
      approval_mode,
      approved_from_candidate_id,
      effective_from,
      effective_to,
      tags_json,
      metadata_json,
      created_by,
      approved_by,
      updated_by,
      approved_at
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,
      $11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,
      $21::jsonb,$22::jsonb,$23,$24,$25,$26
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      p.canonical_key,
      p.category,
      p.item_key,
      p.title,
      p.value_text,
      JSON.stringify(p.value_json),
      p.normalized_text,
      JSON.stringify(p.normalized_json),
      p.status,
      p.priority,
      p.confidence,
      p.source_count,
      p.primary_source_id,
      JSON.stringify(arr(p.source_evidence_json, [])),
      p.approval_mode,
      p.approved_from_candidate_id,
      p.effective_from,
      p.effective_to,
      JSON.stringify(arr(p.tags_json, [])),
      JSON.stringify(obj(p.metadata_json, {})),
      p.created_by,
      p.approved_by,
      p.updated_by,
      p.approved_at,
    ]
  );

  return rowToKnowledgeItem(r.rows[0]);
}

export async function updateKnowledgeItemInternal(db, id, payload = {}) {
  const p = normalizeKnowledgePayload(payload);

  const r = await q(
    db,
    `
    update tenant_knowledge_items
    set
      canonical_key = $2,
      category = $3,
      item_key = $4,
      title = $5,
      value_text = $6,
      value_json = $7::jsonb,
      normalized_text = $8,
      normalized_json = $9::jsonb,
      status = $10,
      priority = $11,
      confidence = $12,
      source_count = $13,
      primary_source_id = $14,
      source_evidence_json = $15::jsonb,
      approval_mode = $16,
      approved_from_candidate_id = $17,
      effective_from = $18,
      effective_to = $19,
      tags_json = $20::jsonb,
      metadata_json = $21::jsonb,
      created_by = $22,
      approved_by = $23,
      updated_by = $24,
      approved_at = $25,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      s(id),
      p.canonical_key,
      p.category,
      p.item_key,
      p.title,
      p.value_text,
      JSON.stringify(p.value_json),
      p.normalized_text,
      JSON.stringify(p.normalized_json),
      p.status,
      p.priority,
      p.confidence,
      p.source_count,
      p.primary_source_id,
      JSON.stringify(arr(p.source_evidence_json, [])),
      p.approval_mode,
      p.approved_from_candidate_id,
      p.effective_from,
      p.effective_to,
      JSON.stringify(arr(p.tags_json, [])),
      JSON.stringify(obj(p.metadata_json, {})),
      p.created_by,
      p.approved_by,
      p.updated_by,
      p.approved_at,
    ]
  );

  return rowToKnowledgeItem(r.rows[0]);
}

export async function upsertKnowledgeItemInternal(db, input = {}) {
  const tenant = await resolveTenantIdentity(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) throw new Error("tenantKnowledge.upsertKnowledgeItem: tenant not found");

  const payload = normalizeKnowledgePayload(input);
  const current = await getKnowledgeItemByCanonicalKeyInternal(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    canonicalKey: payload.canonical_key,
  });

  if (!current) {
    return insertKnowledgeItemInternal(db, tenant, payload);
  }

  const merged = mergeKnowledgeItem(current, payload, {
    intent: resolveWriteIntent(input, payload.approved_by ? "approved_projection" : "manual"),
  });

  return updateKnowledgeItemInternal(db, current.id, merged);
}

export async function insertBusinessProfileInternal(db, tenant, payload = {}) {
  const p = normalizeProfilePayload(payload);

  const r = await q(
    db,
    `
    insert into tenant_business_profile (
      tenant_id,
      tenant_key,
      profile_status,
      company_name,
      display_name,
      legal_name,
      industry_key,
      subindustry_key,
      summary_short,
      summary_long,
      value_proposition,
      target_audience,
      tone_profile,
      main_language,
      supported_languages,
      website_url,
      primary_phone,
      primary_email,
      primary_address,
      profile_json,
      source_summary_json,
      metadata_json,
      confidence,
      confidence_label,
      generated_by,
      approved_by,
      generated_at,
      approved_at
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,
      $20::jsonb,$21::jsonb,$22::jsonb,$23,$24,$25,$26,$27,$28
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      p.profile_status,
      p.company_name,
      p.display_name,
      p.legal_name,
      p.industry_key,
      p.subindustry_key,
      p.summary_short,
      p.summary_long,
      p.value_proposition,
      p.target_audience,
      p.tone_profile,
      p.main_language || "az",
      JSON.stringify(arr(p.supported_languages, [])),
      p.website_url,
      p.primary_phone,
      p.primary_email,
      p.primary_address,
      JSON.stringify(obj(p.profile_json, {})),
      JSON.stringify(obj(p.source_summary_json, {})),
      JSON.stringify(obj(p.metadata_json, {})),
      normalizeConfidence(p.confidence, 0),
      p.confidence_label,
      p.generated_by,
      p.approved_by,
      p.generated_at,
      p.approved_at,
    ]
  );

  return rowToBusinessProfile(r.rows[0]);
}

export async function updateBusinessProfileInternal(db, id, payload = {}) {
  const p = normalizeProfilePayload(payload);

  const r = await q(
    db,
    `
    update tenant_business_profile
    set
      profile_status = $2,
      company_name = $3,
      display_name = $4,
      legal_name = $5,
      industry_key = $6,
      subindustry_key = $7,
      summary_short = $8,
      summary_long = $9,
      value_proposition = $10,
      target_audience = $11,
      tone_profile = $12,
      main_language = $13,
      supported_languages = $14::jsonb,
      website_url = $15,
      primary_phone = $16,
      primary_email = $17,
      primary_address = $18,
      profile_json = $19::jsonb,
      source_summary_json = $20::jsonb,
      metadata_json = $21::jsonb,
      confidence = $22,
      confidence_label = $23,
      generated_by = $24,
      approved_by = $25,
      generated_at = $26,
      approved_at = $27,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      s(id),
      p.profile_status,
      p.company_name,
      p.display_name,
      p.legal_name,
      p.industry_key,
      p.subindustry_key,
      p.summary_short,
      p.summary_long,
      p.value_proposition,
      p.target_audience,
      p.tone_profile,
      p.main_language || "az",
      JSON.stringify(arr(p.supported_languages, [])),
      p.website_url,
      p.primary_phone,
      p.primary_email,
      p.primary_address,
      JSON.stringify(obj(p.profile_json, {})),
      JSON.stringify(obj(p.source_summary_json, {})),
      JSON.stringify(obj(p.metadata_json, {})),
      normalizeConfidence(p.confidence, 0),
      p.confidence_label,
      p.generated_by,
      p.approved_by,
      p.generated_at,
      p.approved_at,
    ]
  );

  return rowToBusinessProfile(r.rows[0]);
}

export async function upsertBusinessProfileInternal(db, input = {}) {
  const tenant = await resolveTenantIdentity(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) throw new Error("tenantKnowledge.upsertBusinessProfile: tenant not found");

  const current = await getBusinessProfileInternal(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });

  const merged = mergeBusinessProfile(current, input, {
    intent: resolveWriteIntent(input, "manual"),
  });

  if (!current) {
    return insertBusinessProfileInternal(db, tenant, merged);
  }

  return updateBusinessProfileInternal(db, current.id, merged);
}

export async function insertBusinessCapabilitiesInternal(db, tenant, payload = {}) {
  const p = normalizeCapabilitiesPayload(payload);

  const r = await q(
    db,
    `
    insert into tenant_business_capabilities (
      tenant_id,
      tenant_key,
      can_share_prices,
      can_share_starting_prices,
      requires_human_for_custom_quote,
      can_capture_leads,
      can_capture_phone,
      can_capture_email,
      can_offer_booking,
      can_offer_consultation,
      can_offer_callback,
      supports_instagram_dm,
      supports_facebook_messenger,
      supports_whatsapp,
      supports_comments,
      supports_voice,
      supports_email,
      supports_multilanguage,
      primary_language,
      supported_languages,
      handoff_enabled,
      auto_handoff_on_human_request,
      auto_handoff_on_low_confidence,
      should_avoid_competitor_comparisons,
      should_avoid_legal_claims,
      should_avoid_unverified_promises,
      reply_style,
      reply_length,
      emoji_level,
      cta_style,
      pricing_mode,
      booking_mode,
      sales_mode,
      capabilities_json,
      metadata_json,
      derived_from_profile,
      approved_by
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,
      $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
      $31,$32,$33,$34::jsonb,$35::jsonb,$36,$37
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      b(p.can_share_prices, false),
      b(p.can_share_starting_prices, false),
      b(p.requires_human_for_custom_quote, true),
      b(p.can_capture_leads, true),
      b(p.can_capture_phone, true),
      b(p.can_capture_email, true),
      b(p.can_offer_booking, false),
      b(p.can_offer_consultation, false),
      b(p.can_offer_callback, true),
      b(p.supports_instagram_dm, false),
      b(p.supports_facebook_messenger, false),
      b(p.supports_whatsapp, false),
      b(p.supports_comments, false),
      b(p.supports_voice, false),
      b(p.supports_email, false),
      b(p.supports_multilanguage, false),
      s(p.primary_language || "az"),
      JSON.stringify(arr(p.supported_languages, [])),
      b(p.handoff_enabled, true),
      b(p.auto_handoff_on_human_request, true),
      b(p.auto_handoff_on_low_confidence, true),
      b(p.should_avoid_competitor_comparisons, true),
      b(p.should_avoid_legal_claims, true),
      b(p.should_avoid_unverified_promises, true),
      normalizeReplyStyle(p.reply_style),
      normalizeReplyLength(p.reply_length),
      normalizeEmojiLevel(p.emoji_level),
      normalizeCtaStyle(p.cta_style),
      normalizePricingMode(p.pricing_mode),
      normalizeBookingMode(p.booking_mode),
      normalizeSalesMode(p.sales_mode),
      JSON.stringify(obj(p.capabilities_json, {})),
      JSON.stringify(obj(p.metadata_json, {})),
      b(p.derived_from_profile, false),
      s(p.approved_by),
    ]
  );

  return rowToBusinessCapabilities(r.rows[0]);
}

export async function updateBusinessCapabilitiesInternal(db, id, payload = {}) {
  const p = normalizeCapabilitiesPayload(payload);

  const r = await q(
    db,
    `
    update tenant_business_capabilities
    set
      can_share_prices = $2,
      can_share_starting_prices = $3,
      requires_human_for_custom_quote = $4,
      can_capture_leads = $5,
      can_capture_phone = $6,
      can_capture_email = $7,
      can_offer_booking = $8,
      can_offer_consultation = $9,
      can_offer_callback = $10,
      supports_instagram_dm = $11,
      supports_facebook_messenger = $12,
      supports_whatsapp = $13,
      supports_comments = $14,
      supports_voice = $15,
      supports_email = $16,
      supports_multilanguage = $17,
      primary_language = $18,
      supported_languages = $19::jsonb,
      handoff_enabled = $20,
      auto_handoff_on_human_request = $21,
      auto_handoff_on_low_confidence = $22,
      should_avoid_competitor_comparisons = $23,
      should_avoid_legal_claims = $24,
      should_avoid_unverified_promises = $25,
      reply_style = $26,
      reply_length = $27,
      emoji_level = $28,
      cta_style = $29,
      pricing_mode = $30,
      booking_mode = $31,
      sales_mode = $32,
      capabilities_json = $33::jsonb,
      metadata_json = $34::jsonb,
      derived_from_profile = $35,
      approved_by = $36,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      s(id),
      b(p.can_share_prices, false),
      b(p.can_share_starting_prices, false),
      b(p.requires_human_for_custom_quote, true),
      b(p.can_capture_leads, true),
      b(p.can_capture_phone, true),
      b(p.can_capture_email, true),
      b(p.can_offer_booking, false),
      b(p.can_offer_consultation, false),
      b(p.can_offer_callback, true),
      b(p.supports_instagram_dm, false),
      b(p.supports_facebook_messenger, false),
      b(p.supports_whatsapp, false),
      b(p.supports_comments, false),
      b(p.supports_voice, false),
      b(p.supports_email, false),
      b(p.supports_multilanguage, false),
      s(p.primary_language || "az"),
      JSON.stringify(arr(p.supported_languages, [])),
      b(p.handoff_enabled, true),
      b(p.auto_handoff_on_human_request, true),
      b(p.auto_handoff_on_low_confidence, true),
      b(p.should_avoid_competitor_comparisons, true),
      b(p.should_avoid_legal_claims, true),
      b(p.should_avoid_unverified_promises, true),
      normalizeReplyStyle(p.reply_style),
      normalizeReplyLength(p.reply_length),
      normalizeEmojiLevel(p.emoji_level),
      normalizeCtaStyle(p.cta_style),
      normalizePricingMode(p.pricing_mode),
      normalizeBookingMode(p.booking_mode),
      normalizeSalesMode(p.sales_mode),
      JSON.stringify(obj(p.capabilities_json, {})),
      JSON.stringify(obj(p.metadata_json, {})),
      b(p.derived_from_profile, false),
      s(p.approved_by),
    ]
  );

  return rowToBusinessCapabilities(r.rows[0]);
}

export async function upsertBusinessCapabilitiesInternal(db, input = {}) {
  const tenant = await resolveTenantIdentity(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) throw new Error("tenantKnowledge.upsertBusinessCapabilities: tenant not found");

  const current = await getBusinessCapabilitiesInternal(db, {
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });

  const merged = mergeBusinessCapabilities(current, input, {
    intent: resolveWriteIntent(input, "manual"),
  });

  if (!current) {
    return insertBusinessCapabilitiesInternal(db, tenant, merged);
  }

  return updateBusinessCapabilitiesInternal(db, current.id, merged);
}

export async function createApprovalInternal(db, input = {}) {
  const tenant = await resolveTenantIdentity(db, {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
  if (!tenant) throw new Error("tenantKnowledge.createApproval: tenant not found");

  const r = await q(
    db,
    `
    insert into tenant_knowledge_approvals (
      tenant_id,
      tenant_key,
      candidate_id,
      knowledge_item_id,
      source_id,
      action,
      decision,
      reviewer_type,
      reviewer_id,
      reviewer_name,
      reason,
      before_json,
      after_json,
      metadata_json
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb
    )
    returning *
    `,
    [
      tenant.tenant_id,
      tenant.tenant_key,
      s(input.candidateId) || null,
      s(input.knowledgeItemId) || null,
      s(input.sourceId) || null,
      normalizeApprovalAction(input.action),
      normalizeApprovalDecision(input.decision),
      normalizeReviewerType(input.reviewerType),
      s(input.reviewerId),
      s(input.reviewerName),
      s(input.reason),
      JSON.stringify(obj(input.beforeJson, {})),
      JSON.stringify(obj(input.afterJson, {})),
      JSON.stringify(obj(input.metadataJson, {})),
    ]
  );

  return rowToApproval(r.rows[0]);
}