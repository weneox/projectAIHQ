import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { sanitizeStructuredHours } from "../setupAssistantParser.js";
import {
  SOURCE_PRIORITY,
  buildDefaultAssistantBehaviorDraft,
  hasOwn,
  inferContactType,
  normalizeBehaviorPolicyKey,
  normalizeBookingBehaviorMode as importedNormalizeBookingBehaviorMode,
  normalizeContactBehaviorMode as importedNormalizeContactBehaviorMode,
  normalizeHandoffBehaviorMode as importedNormalizeHandoffBehaviorMode,
  normalizeLocationBehaviorMode as importedNormalizeLocationBehaviorMode,
  normalizePricingBehaviorMode as importedNormalizePricingBehaviorMode,
  normalizeSourceType,
  normalizeWebsiteUrl,
  slugify,
  sourceTypeLabel,
  uniqueStrings,
} from "./shared.js";

const normalizePricingBehaviorModeSafe =
  typeof importedNormalizePricingBehaviorMode === "function"
    ? importedNormalizePricingBehaviorMode
    : () => "";

const normalizeLocationBehaviorModeSafe =
  typeof importedNormalizeLocationBehaviorMode === "function"
    ? importedNormalizeLocationBehaviorMode
    : () => "";

const normalizeBookingBehaviorModeSafe =
  typeof importedNormalizeBookingBehaviorMode === "function"
    ? importedNormalizeBookingBehaviorMode
    : () => "";

const normalizeContactBehaviorModeSafe =
  typeof importedNormalizeContactBehaviorMode === "function"
    ? importedNormalizeContactBehaviorMode
    : () => "";

const normalizeHandoffBehaviorModeSafe =
  typeof importedNormalizeHandoffBehaviorMode === "function"
    ? importedNormalizeHandoffBehaviorMode
    : () => "";

const normalizePricingBehaviorMode = normalizePricingBehaviorModeSafe;
const normalizeLocationBehaviorMode = normalizeLocationBehaviorModeSafe;
const normalizeBookingBehaviorMode = normalizeBookingBehaviorModeSafe;
const normalizeContactBehaviorMode = normalizeContactBehaviorModeSafe;
const normalizeHandoffBehaviorMode = normalizeHandoffBehaviorModeSafe;

export function sanitizeBusinessProfile(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    companyName: s(
      source.companyName ||
        source.company_name ||
        source.displayName ||
        source.companyTitle ||
        source.name
    ),
    description: s(
      source.description ||
        source.summary ||
        source.summaryLong ||
        source.companySummaryLong ||
        source.summaryShort ||
        source.companySummaryShort
    ),
    websiteUrl: normalizeWebsiteUrl(
      source.websiteUrl || source.website_url || source.website
    ),
    primaryPhone: s(source.primaryPhone || source.primary_phone),
    primaryEmail: s(source.primaryEmail || source.primary_email),
    primaryAddress: s(source.primaryAddress || source.primary_address),
    targetAudience: s(source.targetAudience || source.target_audience),
    pricingPolicy: s(source.pricingPolicy || source.pricing_policy),
  });
}

export function sanitizeServiceItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.name || source.label);
  if (!title) return null;

  return compactDraftObject({
    key: s(source.key || source.serviceKey || source.service_key) || slugify(title),
    title,
    summary: s(
      source.summary || source.description || source.detail || source.notes
    ),
    category: s(source.category || "general").toLowerCase() || "general",
    priceLabel: s(
      source.priceLabel ||
        source.price_label ||
        source.price ||
        source.priceRange
    ),
    aliases: uniqueStrings(source.aliases, 12),
    availabilityStatus:
      s(source.availabilityStatus || source.availability_status).toLowerCase() ||
      "available",
    operatorNotes: s(source.operatorNotes || source.operator_notes),
  });
}

export function sanitizeServices(value = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(value)) {
    const normalized = sanitizeServiceItem(item);
    if (!normalized) continue;
    const dedupeKey = `${s(normalized.key).toLowerCase()}|${s(
      normalized.title
    ).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(normalized);
  }

  return out.slice(0, 100);
}

export function sanitizeContactItem(value = {}) {
  const source = obj(value);
  const type = s(
    source.type || source.channel || inferContactType(source.value)
  ).toLowerCase();
  const label = s(source.label || source.title);
  const entryValue = s(source.value || source.contact || source.address);
  if (!type && !label && !entryValue) return null;

  return compactDraftObject({
    type,
    label,
    value: entryValue,
    preferred: source.preferred === true,
    visibility: s(source.visibility || source.scope).toLowerCase() || "public",
  });
}

export function sanitizeContacts(value = []) {
  return arr(value)
    .map(sanitizeContactItem)
    .filter(Boolean)
    .slice(0, 100);
}

export function normalizeCurrency(value = "") {
  const upper = s(value).toUpperCase();
  if (!upper) return "";
  if (upper === "$") return "USD";
  if (upper === "â‚¬" || upper === "€") return "EUR";
  if (upper === "â‚¼" || upper === "₼") return "AZN";
  if (upper === "Â£" || upper === "£") return "GBP";
  return upper;
}

export function sanitizePerServicePricingItem(value = {}) {
  const source = obj(value);
  const title = s(source.title || source.serviceTitle);
  const serviceKey = s(source.serviceKey || source.service_key || slugify(title));
  if (!title && !serviceKey) return null;

  return compactDraftObject({
    serviceKey: serviceKey || slugify(title),
    title,
    mode: s(source.mode || "fixed_price").toLowerCase(),
    startingAt:
      source.startingAt ?? source.starting_at ?? source.startingPrice ?? null,
    minPrice: source.minPrice ?? source.min_price ?? null,
    maxPrice: source.maxPrice ?? source.max_price ?? null,
    priceLabel: s(source.priceLabel || source.price_label || source.price),
  });
}

export function sanitizePricingPosture(value = {}) {
  const source = obj(value);
  const legacyMode = s(source.mode || source.posture || source.model).toLowerCase();
  const pricingMode =
    s(source.pricingMode || source.pricing_mode).toLowerCase() ||
    (legacyMode === "quote_based" ? "quote_required" : legacyMode);
  const publicSummary =
    s(source.publicSummary || source.public_summary) ||
    s(source.summary || source.description);

  return compactDraftObject({
    pricingMode,
    currency: normalizeCurrency(source.currency || "AZN") || "AZN",
    publicSummary,
    startingAt:
      source.startingAt ?? source.starting_at ?? source.priceFrom ?? null,
    minPrice: source.minPrice ?? source.min_price ?? null,
    maxPrice: source.maxPrice ?? source.max_price ?? null,
    perServicePricing: arr(source.perServicePricing || source.per_service_pricing)
      .map(sanitizePerServicePricingItem)
      .filter(Boolean)
      .slice(0, 40),
    allowPublicPriceReplies:
      typeof source.allowPublicPriceReplies === "boolean"
        ? source.allowPublicPriceReplies
        : typeof source.allow_public_price_replies === "boolean"
          ? source.allow_public_price_replies
          : pricingMode && !["operator_only", "quote_required"].includes(pricingMode),
    requiresOperatorForExactQuote:
      typeof source.requiresOperatorForExactQuote === "boolean"
        ? source.requiresOperatorForExactQuote
        : typeof source.requires_operator_for_exact_quote === "boolean"
          ? source.requires_operator_for_exact_quote
          : [
              "quote_required",
              "operator_only",
              "variable_by_service",
              "promotional",
            ].includes(pricingMode),
    pricingNotes: s(
      source.pricingNotes || source.pricing_notes || source.notes || source.summary
    ),
    pricingConfidence: s(
      source.pricingConfidence || source.pricing_confidence
    ).toLowerCase(),
    operatorEscalationRules: uniqueStrings(
      source.operatorEscalationRules || source.operator_escalation_rules,
      12
    ),
  });
}

export function sanitizeHandoffRules(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    enabled:
      source.enabled === true ||
      Boolean(
        s(source.summary || source.description || source.notes) ||
          arr(source.triggers).length
      ),
    summary: s(source.summary || source.description || source.notes),
    triggers: uniqueStrings(source.triggers, 24),
    channels: uniqueStrings(source.channels, 12),
    escalationTarget: s(
      source.escalationTarget || source.escalation_target || source.target
    ),
  });
}

function sanitizeBehaviorTargetUrl(value = "") {
  return normalizeWebsiteUrl(s(value));
}

function sanitizeBehaviorNote(value = "") {
  return s(value);
}

export function sanitizePricingPolicy(value = {}) {
  const source = obj(value);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().pricingPolicy);

  const mode =
    normalizePricingBehaviorMode(source.mode || source.defaultBehavior) ||
    defaults.mode;

  const preferredTargetType =
    s(source.preferredTargetType || source.preferred_target_type).toLowerCase() ||
    defaults.preferredTargetType;

  return compactDraftObject({
    mode,
    publicAnswerAllowed:
      typeof source.publicAnswerAllowed === "boolean"
        ? source.publicAnswerAllowed
        : typeof source.public_answer_allowed === "boolean"
          ? source.public_answer_allowed
          : defaults.publicAnswerAllowed,
    redirectEnabled:
      typeof source.redirectEnabled === "boolean"
        ? source.redirectEnabled
        : typeof source.redirect_enabled === "boolean"
          ? source.redirect_enabled
          : defaults.redirectEnabled,
    shouldSummarizeBeforeRedirect:
      typeof source.shouldSummarizeBeforeRedirect === "boolean"
        ? source.shouldSummarizeBeforeRedirect
        : typeof source.should_summarize_before_redirect === "boolean"
          ? source.should_summarize_before_redirect
          : defaults.shouldSummarizeBeforeRedirect,
    askServiceFirst:
      typeof source.askServiceFirst === "boolean"
        ? source.askServiceFirst
        : typeof source.ask_service_first === "boolean"
          ? source.ask_service_first
          : defaults.askServiceFirst,
    preferredTargetType,
    preferredTargetUrl: sanitizeBehaviorTargetUrl(
      source.preferredTargetUrl || source.preferred_target_url
    ),
    fallbackTargetUrl: sanitizeBehaviorTargetUrl(
      source.fallbackTargetUrl || source.fallback_target_url
    ),
    note: sanitizeBehaviorNote(source.note),
  });
}

export function sanitizeLocationPolicy(value = {}) {
  const source = obj(value);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().locationPolicy);

  const mode =
    normalizeLocationBehaviorMode(source.mode || source.defaultBehavior) ||
    defaults.mode;

  return compactDraftObject({
    mode,
    redirectEnabled:
      typeof source.redirectEnabled === "boolean"
        ? source.redirectEnabled
        : typeof source.redirect_enabled === "boolean"
          ? source.redirect_enabled
          : defaults.redirectEnabled,
    shouldSummarizeBeforeRedirect:
      typeof source.shouldSummarizeBeforeRedirect === "boolean"
        ? source.shouldSummarizeBeforeRedirect
        : typeof source.should_summarize_before_redirect === "boolean"
          ? source.should_summarize_before_redirect
          : defaults.shouldSummarizeBeforeRedirect,
    preferredTargetType:
      s(source.preferredTargetType || source.preferred_target_type).toLowerCase() ||
      defaults.preferredTargetType,
    preferredTargetUrl: sanitizeBehaviorTargetUrl(
      source.preferredTargetUrl || source.preferred_target_url
    ),
    fallbackTargetUrl: sanitizeBehaviorTargetUrl(
      source.fallbackTargetUrl || source.fallback_target_url
    ),
    note: sanitizeBehaviorNote(source.note),
  });
}

export function sanitizeBookingPolicy(value = {}) {
  const source = obj(value);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().bookingPolicy);

  const mode =
    normalizeBookingBehaviorMode(source.mode || source.defaultBehavior) ||
    defaults.mode;

  return compactDraftObject({
    mode,
    redirectEnabled:
      typeof source.redirectEnabled === "boolean"
        ? source.redirectEnabled
        : typeof source.redirect_enabled === "boolean"
          ? source.redirect_enabled
          : defaults.redirectEnabled,
    collectLeadFirst:
      typeof source.collectLeadFirst === "boolean"
        ? source.collectLeadFirst
        : typeof source.collect_lead_first === "boolean"
          ? source.collect_lead_first
          : defaults.collectLeadFirst,
    preferredTargetType:
      s(source.preferredTargetType || source.preferred_target_type).toLowerCase() ||
      defaults.preferredTargetType,
    preferredTargetUrl: sanitizeBehaviorTargetUrl(
      source.preferredTargetUrl || source.preferred_target_url
    ),
    fallbackTargetUrl: sanitizeBehaviorTargetUrl(
      source.fallbackTargetUrl || source.fallback_target_url
    ),
    note: sanitizeBehaviorNote(source.note),
  });
}

export function sanitizeContactPolicy(value = {}) {
  const source = obj(value);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().contactPolicy);

  const mode =
    normalizeContactBehaviorMode(source.mode || source.defaultBehavior) ||
    defaults.mode;

  return compactDraftObject({
    mode,
    preferredChannel: s(
      source.preferredChannel || source.preferred_channel
    ).toLowerCase(),
    preferredTargetType:
      s(source.preferredTargetType || source.preferred_target_type).toLowerCase() ||
      defaults.preferredTargetType,
    preferredTargetUrl: sanitizeBehaviorTargetUrl(
      source.preferredTargetUrl || source.preferred_target_url
    ),
    fallbackTargetUrl: sanitizeBehaviorTargetUrl(
      source.fallbackTargetUrl || source.fallback_target_url
    ),
    note: sanitizeBehaviorNote(source.note),
  });
}

export function sanitizeHandoffPolicy(value = {}) {
  const source = obj(value);
  const defaults = obj(buildDefaultAssistantBehaviorDraft().handoffPolicy);

  const mode =
    normalizeHandoffBehaviorMode(source.mode || source.defaultBehavior) ||
    defaults.mode;

  return compactDraftObject({
    mode,
    requiresReason:
      typeof source.requiresReason === "boolean"
        ? source.requiresReason
        : typeof source.requires_reason === "boolean"
          ? source.requires_reason
          : defaults.requiresReason,
    note: sanitizeBehaviorNote(source.note),
  });
}

export function sanitizeAssistantBehaviorDraft(value = {}) {
  const source = obj(value);
  const nested = obj(
    source.assistantBehavior ||
      source.assistant_behavior ||
      source.assistantBehaviorDraft ||
      source.assistant_behavior_draft
  );
  const defaults = buildDefaultAssistantBehaviorDraft();

  return {
    pricingPolicy: sanitizePricingPolicy(
      obj(
        source.pricingPolicy ||
          source.pricing_policy ||
          nested.pricingPolicy ||
          defaults.pricingPolicy
      )
    ),
    locationPolicy: sanitizeLocationPolicy(
      obj(
        source.locationPolicy ||
          source.location_policy ||
          nested.locationPolicy ||
          defaults.locationPolicy
      )
    ),
    bookingPolicy: sanitizeBookingPolicy(
      obj(
        source.bookingPolicy ||
          source.booking_policy ||
          nested.bookingPolicy ||
          defaults.bookingPolicy
      )
    ),
    contactPolicy: sanitizeContactPolicy(
      obj(
        source.contactPolicy ||
          source.contact_policy ||
          nested.contactPolicy ||
          defaults.contactPolicy
      )
    ),
    handoffPolicy: sanitizeHandoffPolicy(
      obj(
        source.handoffPolicy ||
          source.handoff_policy ||
          nested.handoffPolicy ||
          defaults.handoffPolicy
      )
    ),
  };
}

export function sanitizeProgress(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    skippedQuestions: uniqueStrings(source.skippedQuestions, 32),
    lastAnsweredStep: s(source.lastAnsweredStep).toLowerCase(),
    currentQuestionKey: s(source.currentQuestionKey).toLowerCase(),
    updatedAt: source.updatedAt || null,
  });
}

export function sanitizeSourceMetadata(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    primarySourceType: normalizeSourceType(
      source.primarySourceType || source.primary_source_type
    ),
    primarySourceUrl: s(source.primarySourceUrl || source.primary_source_url),
    sourceLabels: uniqueStrings(source.sourceLabels, 12),
    evidenceSummary: uniqueStrings(source.evidenceSummary, 12),
    warningCount: Number(source.warningCount || 0) || 0,
    sourceCount: Number(source.sourceCount || 0) || 0,
  });
}

export function sanitizeAssistantState(value = {}) {
  const source = obj(value);
  return compactDraftObject({
    activeSection: s(source.activeSection || source.active_section).toLowerCase(),
    lastParsedPricingNote: s(
      source.lastParsedPricingNote || source.last_parsed_pricing_note
    ),
    lastParsedHoursNote: s(
      source.lastParsedHoursNote || source.last_parsed_hours_note
    ),
    lastParsedServicesNote: s(
      source.lastParsedServicesNote || source.last_parsed_services_note
    ),
    lastUpdatedSection: s(
      source.lastUpdatedSection || source.last_updated_section
    ).toLowerCase(),
    activeBehaviorPolicy: normalizeBehaviorPolicyKey(
      source.activeBehaviorPolicy || source.active_behavior_policy
    ),
  });
}

function sanitizeRawEvidenceItem(value = {}) {
  const source = obj(value);
  const text = s(source.text || source.rawText || source.message || source.value);
  const step = s(source.step || source.field || source.questionKey).toLowerCase();
  const kind = s(source.kind || source.type || "user_answer").toLowerCase();

  if (!text && !step) return null;

  return compactDraftObject({
    id: s(source.id),
    kind,
    step,
    text,
    normalizedText: s(source.normalizedText || source.normalized_text),
    fieldKey: s(source.fieldKey || source.field_key).toLowerCase(),
    confidence: s(source.confidence).toLowerCase(),
    sourceUrl: sanitizeBehaviorTargetUrl(source.sourceUrl || source.source_url),
    hidden: source.hidden !== false,
    createdAt: source.createdAt || source.created_at || null,
  });
}

function sanitizeRawEvidenceLog(value = []) {
  const out = [];
  const seen = new Set();

  for (const item of arr(value)) {
    const normalized = sanitizeRawEvidenceItem(item);
    if (!normalized) continue;

    const key = [
      s(normalized.kind),
      s(normalized.step),
      s(normalized.fieldKey),
      s(normalized.text),
      s(normalized.createdAt),
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out.slice(-120);
}

function sanitizeStructuredSynthesisDraft(value = {}) {
  const source = obj(value);
  const aiBehavior = obj(source.aiBehavior);

  return {
    businessProfile: sanitizeBusinessProfile(
      obj(source.businessProfile || source.business_profile)
    ),
    services: sanitizeServices(source.services),
    contacts: sanitizeContacts(source.contacts),
    hours: sanitizeStructuredHours(source.hours),
    pricingPosture: sanitizePricingPosture(
      obj(source.pricingPosture || source.pricing_posture || source.pricing)
    ),
    handoffRules: sanitizeHandoffRules(
      obj(source.handoffRules || source.handoff_rules || source.handoff)
    ),
    assistantBehaviorDraft: sanitizeAssistantBehaviorDraft(
      obj(
        source.assistantBehaviorDraft ||
          source.assistant_behavior_draft ||
          source.assistantBehavior ||
          source.assistant_behavior
      )
    ),
    languages: uniqueStrings(source.languages || aiBehavior.languages, 8),
    tone: s(source.tone || aiBehavior.tone),
    greetingStyle: s(source.greetingStyle || aiBehavior.greetingStyle),
    afterHoursBehavior: s(
      source.afterHoursBehavior || aiBehavior.afterHoursBehavior
    ),
  };
}

function sanitizePolishedDraft(value = {}) {
  const source = obj(value);

  return compactDraftObject({
    businessName: s(source.businessName || source.companyName),
    businessDescription: s(
      source.businessDescription ||
        source.description ||
        source.whatThisBusinessIs
    ),
    websiteUrl: sanitizeBehaviorTargetUrl(source.websiteUrl || source.website_url),
    coreServices: uniqueStrings(source.coreServices || source.services, 24),
    contactRoutes: uniqueStrings(source.contactRoutes || source.contacts, 24),
    workingHoursLines: uniqueStrings(
      source.workingHoursLines || source.hours || source.hoursLines,
      16
    ),
    pricingSummary: s(
      source.pricingSummary || source.pricingPosture || source.pricing
    ),
    handoffSummary: s(
      source.handoffSummary || source.humanHandoff || source.handoff
    ),
    pricingBehaviorSummary: s(
      source.pricingBehaviorSummary || source.pricingBehavior
    ),
    locationBehaviorSummary: s(
      source.locationBehaviorSummary || source.locationBehavior
    ),
    bookingBehaviorSummary: s(
      source.bookingBehaviorSummary || source.bookingBehavior
    ),
    contactBehaviorSummary: s(
      source.contactBehaviorSummary || source.contactBehavior
    ),
    handoffBehaviorSummary: s(
      source.handoffBehaviorSummary || source.handoffBehavior
    ),
    languages: uniqueStrings(source.languages, 8),
    tone: s(source.tone),
    greetingStyle: s(source.greetingStyle),
    afterHoursBehavior: s(source.afterHoursBehavior),
    professionalizedAt: source.professionalizedAt || source.professionalized_at || null,
  });
}

export function sanitizeSilentSynthesis(value = {}) {
  const source = obj(value);
  const nested = obj(
    source.silentSynthesis ||
      source.silent_synthesis ||
      source.hiddenSynthesis ||
      source.hidden_synthesis
  );

  return compactDraftObject({
    visibilityMode: s(
      source.visibilityMode ||
        nested.visibilityMode ||
        source.displayMode ||
        nested.displayMode ||
        "hidden_until_review"
    ).toLowerCase(),
    synthesisStatus: s(
      source.synthesisStatus ||
        nested.synthesisStatus ||
        source.status ||
        nested.status ||
        "idle"
    ).toLowerCase(),
    lastSynthesizedAt:
      source.lastSynthesizedAt ||
      nested.lastSynthesizedAt ||
      source.updatedAt ||
      nested.updatedAt ||
      null,
    rawEvidenceLog: sanitizeRawEvidenceLog(
      source.rawEvidenceLog ||
        nested.rawEvidenceLog ||
        source.rawInputs ||
        nested.rawInputs
    ),
    structuredDraft: sanitizeStructuredSynthesisDraft(
      obj(
        source.structuredDraft ||
          nested.structuredDraft ||
          source.workingDraft ||
          nested.workingDraft
      )
    ),
    polishedDraft: sanitizePolishedDraft(
      obj(
        source.polishedDraft ||
          nested.polishedDraft ||
          source.reviewDraft ||
          nested.reviewDraft
      )
    ),
    unresolvedNotes: uniqueStrings(
      source.unresolvedNotes || nested.unresolvedNotes,
      24
    ),
    recommendationNotes: uniqueStrings(
      source.recommendationNotes || nested.recommendationNotes,
      24
    ),
  });
}

export function sanitizeSetupAssistantCore(value = {}) {
  const source = obj(value);
  const aiBehavior = obj(source.aiBehavior);

  return {
    businessProfile: sanitizeBusinessProfile(
      obj(source.businessProfile || source.business_profile)
    ),
    services: sanitizeServices(source.services),
    contacts: sanitizeContacts(source.contacts),
    hours: sanitizeStructuredHours(source.hours),
    pricingPosture: sanitizePricingPosture(
      obj(source.pricingPosture || source.pricing_posture || source.pricing)
    ),
    handoffRules: sanitizeHandoffRules(
      obj(source.handoffRules || source.handoff_rules || source.handoff)
    ),
    sourceMetadata: sanitizeSourceMetadata(
      obj(source.sourceMetadata || source.source_metadata)
    ),
    assistantState: sanitizeAssistantState(
      obj(source.assistantState || source.assistant_state)
    ),
    assistantBehaviorDraft: sanitizeAssistantBehaviorDraft(
      obj(
        source.assistantBehaviorDraft ||
          source.assistant_behavior_draft ||
          source.assistantBehavior ||
          source.assistant_behavior
      )
    ),
    progress: sanitizeProgress(source.progress),
    languages: uniqueStrings(source.languages || aiBehavior.languages, 8),
    tone: s(source.tone || aiBehavior.tone),
    greetingStyle: s(source.greetingStyle || aiBehavior.greetingStyle),
    afterHoursBehavior: s(
      source.afterHoursBehavior || aiBehavior.afterHoursBehavior
    ),
    silentSynthesis: sanitizeSilentSynthesis(
      obj(
        source.silentSynthesis ||
          source.silent_synthesis ||
          source.hiddenSynthesis ||
          source.hidden_synthesis
      )
    ),
  };
}

export function mergeBusinessProfile(left = {}, right = {}) {
  return sanitizeBusinessProfile({
    ...obj(left),
    ...obj(right),
  });
}

export function mergePricingPosture(left = {}, right = {}) {
  return sanitizePricingPosture({
    ...obj(left),
    ...obj(right),
    perServicePricing:
      right.perServicePricing !== undefined
        ? right.perServicePricing
        : left.perServicePricing,
  });
}

export function mergeHandoffRules(left = {}, right = {}) {
  return sanitizeHandoffRules({
    ...obj(left),
    ...obj(right),
  });
}

export function mergeSourceMetadata(left = {}, right = {}) {
  return sanitizeSourceMetadata({
    ...obj(left),
    ...obj(right),
    sourceLabels:
      right.sourceLabels !== undefined ? right.sourceLabels : left.sourceLabels,
    evidenceSummary:
      right.evidenceSummary !== undefined
        ? right.evidenceSummary
        : left.evidenceSummary,
  });
}

export function mergeAssistantState(left = {}, right = {}) {
  return sanitizeAssistantState({
    ...obj(left),
    ...obj(right),
  });
}

export function mergeProgress(left = {}, right = {}) {
  return sanitizeProgress({
    ...obj(left),
    ...obj(right),
    skippedQuestions: uniqueStrings(
      [...arr(left.skippedQuestions), ...arr(right.skippedQuestions)],
      32
    ),
  });
}

function mergePricingPolicy(left = {}, right = {}) {
  return sanitizePricingPolicy({
    ...obj(left),
    ...obj(right),
  });
}

function mergeLocationPolicy(left = {}, right = {}) {
  return sanitizeLocationPolicy({
    ...obj(left),
    ...obj(right),
  });
}

function mergeBookingPolicy(left = {}, right = {}) {
  return sanitizeBookingPolicy({
    ...obj(left),
    ...obj(right),
  });
}

function mergeContactPolicy(left = {}, right = {}) {
  return sanitizeContactPolicy({
    ...obj(left),
    ...obj(right),
  });
}

function mergeHandoffPolicy(left = {}, right = {}) {
  return sanitizeHandoffPolicy({
    ...obj(left),
    ...obj(right),
  });
}

export function mergeAssistantBehaviorDraft(left = {}, right = {}) {
  const a = sanitizeAssistantBehaviorDraft(left);
  const source = obj(right);
  const nested = obj(
    source.assistantBehaviorDraft ||
      source.assistant_behavior_draft ||
      source.assistantBehavior ||
      source.assistant_behavior
  );

  const pricingPatch = obj(
    source.pricingPolicy || source.pricing_policy || nested.pricingPolicy
  );
  const locationPatch = obj(
    source.locationPolicy || source.location_policy || nested.locationPolicy
  );
  const bookingPatch = obj(
    source.bookingPolicy || source.booking_policy || nested.bookingPolicy
  );
  const contactPatch = obj(
    source.contactPolicy || source.contact_policy || nested.contactPolicy
  );
  const handoffPatch = obj(
    source.handoffPolicy || source.handoff_policy || nested.handoffPolicy
  );

  return {
    pricingPolicy: mergePricingPolicy(a.pricingPolicy, pricingPatch),
    locationPolicy: mergeLocationPolicy(a.locationPolicy, locationPatch),
    bookingPolicy: mergeBookingPolicy(a.bookingPolicy, bookingPatch),
    contactPolicy: mergeContactPolicy(a.contactPolicy, contactPatch),
    handoffPolicy: mergeHandoffPolicy(a.handoffPolicy, handoffPatch),
  };
}

function mergeRawEvidenceLog(left = [], right = []) {
  return sanitizeRawEvidenceLog([...arr(left), ...arr(right)]);
}

function mergeStructuredSynthesisDraft(left = {}, right = {}) {
  const a = sanitizeStructuredSynthesisDraft(left);
  const b = sanitizeStructuredSynthesisDraft(right);
  const rightSource = obj(right);
  const rightHasHours = hasOwn(rightSource, "hours");

  return {
    businessProfile: mergeBusinessProfile(a.businessProfile, b.businessProfile),
    services: b.services.length ? sanitizeServices(b.services) : a.services,
    contacts: b.contacts.length ? sanitizeContacts(b.contacts) : a.contacts,
    hours: rightHasHours ? sanitizeStructuredHours(b.hours) : a.hours,
    pricingPosture: mergePricingPosture(a.pricingPosture, b.pricingPosture),
    handoffRules: mergeHandoffRules(a.handoffRules, b.handoffRules),
    assistantBehaviorDraft: mergeAssistantBehaviorDraft(
      a.assistantBehaviorDraft,
      b.assistantBehaviorDraft
    ),
    languages: b.languages.length ? uniqueStrings(b.languages, 8) : a.languages,
    tone: s(b.tone || a.tone),
    greetingStyle: s(b.greetingStyle || a.greetingStyle),
    afterHoursBehavior: s(b.afterHoursBehavior || a.afterHoursBehavior),
  };
}

function mergePolishedDraft(left = {}, right = {}) {
  const a = sanitizePolishedDraft(left);
  const b = sanitizePolishedDraft(right);

  return compactDraftObject({
    businessName: s(b.businessName || a.businessName),
    businessDescription: s(b.businessDescription || a.businessDescription),
    websiteUrl: s(b.websiteUrl || a.websiteUrl),
    coreServices: arr(b.coreServices).length
      ? uniqueStrings(b.coreServices, 24)
      : a.coreServices,
    contactRoutes: arr(b.contactRoutes).length
      ? uniqueStrings(b.contactRoutes, 24)
      : a.contactRoutes,
    workingHoursLines: arr(b.workingHoursLines).length
      ? uniqueStrings(b.workingHoursLines, 16)
      : a.workingHoursLines,
    pricingSummary: s(b.pricingSummary || a.pricingSummary),
    handoffSummary: s(b.handoffSummary || a.handoffSummary),
    pricingBehaviorSummary: s(
      b.pricingBehaviorSummary || a.pricingBehaviorSummary
    ),
    locationBehaviorSummary: s(
      b.locationBehaviorSummary || a.locationBehaviorSummary
    ),
    bookingBehaviorSummary: s(
      b.bookingBehaviorSummary || a.bookingBehaviorSummary
    ),
    contactBehaviorSummary: s(
      b.contactBehaviorSummary || a.contactBehaviorSummary
    ),
    handoffBehaviorSummary: s(
      b.handoffBehaviorSummary || a.handoffBehaviorSummary
    ),
    languages: arr(b.languages).length ? uniqueStrings(b.languages, 8) : a.languages,
    tone: s(b.tone || a.tone),
    greetingStyle: s(b.greetingStyle || a.greetingStyle),
    afterHoursBehavior: s(b.afterHoursBehavior || a.afterHoursBehavior),
    professionalizedAt: b.professionalizedAt || a.professionalizedAt || null,
  });
}

export function mergeSilentSynthesis(left = {}, right = {}) {
  const a = sanitizeSilentSynthesis(left);
  const b = sanitizeSilentSynthesis(right);
  const rightSource = obj(right);
  const rightHasVisibilityMode =
    hasOwn(rightSource, "visibilityMode") || hasOwn(rightSource, "displayMode");
  const rightHasSynthesisStatus =
    hasOwn(rightSource, "synthesisStatus") || hasOwn(rightSource, "status");

  return compactDraftObject({
    visibilityMode: s(
      (rightHasVisibilityMode ? b.visibilityMode : "") ||
        a.visibilityMode ||
        "hidden_until_review"
    ),
    synthesisStatus: s(
      (rightHasSynthesisStatus ? b.synthesisStatus : "") ||
        a.synthesisStatus ||
        "idle"
    ),
    lastSynthesizedAt: b.lastSynthesizedAt || a.lastSynthesizedAt || null,
    rawEvidenceLog: mergeRawEvidenceLog(a.rawEvidenceLog, b.rawEvidenceLog),
    structuredDraft: mergeStructuredSynthesisDraft(
      a.structuredDraft,
      b.structuredDraft
    ),
    polishedDraft: mergePolishedDraft(a.polishedDraft, b.polishedDraft),
    unresolvedNotes: uniqueStrings(
      [...arr(a.unresolvedNotes), ...arr(b.unresolvedNotes)],
      24
    ),
    recommendationNotes: uniqueStrings(
      [...arr(a.recommendationNotes), ...arr(b.recommendationNotes)],
      24
    ),
  });
}

export function mergeSetupAssistantCore(left = {}, right = {}) {
  const a = sanitizeSetupAssistantCore(left);
  const b = sanitizeSetupAssistantCore(right);
  const rightSource = obj(right);
  const rightHasHours = hasOwn(rightSource, "hours");

  return {
    businessProfile: mergeBusinessProfile(a.businessProfile, b.businessProfile),
    services: b.services.length ? sanitizeServices(b.services) : a.services,
    contacts: b.contacts.length ? sanitizeContacts(b.contacts) : a.contacts,
    hours: rightHasHours ? sanitizeStructuredHours(b.hours) : a.hours,
    pricingPosture: mergePricingPosture(a.pricingPosture, b.pricingPosture),
    handoffRules: mergeHandoffRules(a.handoffRules, b.handoffRules),
    sourceMetadata: mergeSourceMetadata(a.sourceMetadata, b.sourceMetadata),
    assistantState: mergeAssistantState(a.assistantState, b.assistantState),
    assistantBehaviorDraft: mergeAssistantBehaviorDraft(
      a.assistantBehaviorDraft,
      obj(
        rightSource.assistantBehaviorDraft ||
          rightSource.assistant_behavior_draft ||
          rightSource.assistantBehavior ||
          rightSource.assistant_behavior
      )
    ),
    progress: mergeProgress(a.progress, b.progress),
    languages: b.languages.length ? uniqueStrings(b.languages, 8) : a.languages,
    tone: s(b.tone || a.tone),
    greetingStyle: s(b.greetingStyle || a.greetingStyle),
    afterHoursBehavior: s(b.afterHoursBehavior || a.afterHoursBehavior),
    silentSynthesis: mergeSilentSynthesis(
      a.silentSynthesis,
      obj(
        rightSource.silentSynthesis ||
          rightSource.silent_synthesis ||
          rightSource.hiddenSynthesis ||
          rightSource.hidden_synthesis
      )
    ),
  };
}

export function buildAssistantSourceMetadataPatch(
  sourceType = "",
  sourceValue = "",
  current = {}
) {
  const nextType = normalizeSourceType(sourceType);
  if (!nextType) return {};

  const currentSource = sanitizeSourceMetadata(obj(current));
  const currentType = normalizeSourceType(currentSource.primarySourceType);
  const nextPriority = SOURCE_PRIORITY[nextType] || 0;
  const currentPriority = SOURCE_PRIORITY[currentType] || 0;
  const promote =
    nextPriority > currentPriority ||
    (!s(currentSource.primarySourceUrl) && nextType !== "manual");
  const label = sourceTypeLabel(nextType);

  return sanitizeSourceMetadata({
    ...currentSource,
    primarySourceType: promote ? nextType : currentType,
    primarySourceUrl:
      promote && nextType !== "manual"
        ? normalizeWebsiteUrl(sourceValue)
        : s(currentSource.primarySourceUrl),
    sourceLabels: uniqueStrings([...arr(currentSource.sourceLabels), label], 12),
    evidenceSummary: uniqueStrings(
      [
        ...arr(currentSource.evidenceSummary),
        nextType === "manual"
          ? "Manual note captured"
          : `${label} supplied by operator`,
      ],
      12
    ),
  });
}