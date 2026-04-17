import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { sanitizeStructuredHours } from "../setupAssistantParser.js";
import {
  BOOKING_BEHAVIOR_MODES,
  CONTACT_BEHAVIOR_MODES,
  HANDOFF_BEHAVIOR_MODES,
  LOCATION_BEHAVIOR_MODES,
  PRICING_BEHAVIOR_MODES,
  SOURCE_PRIORITY,
  buildDefaultAssistantBehaviorDraft,
  hasOwn,
  inferContactType,
  normalizeBehaviorPolicyKey,
  normalizeBookingBehaviorMode,
  normalizeContactBehaviorMode,
  normalizeHandoffBehaviorMode,
  normalizeLocationBehaviorMode,
  normalizePricingBehaviorMode,
  normalizeSourceType,
  normalizeWebsiteUrl,
  slugify,
  sourceTypeLabel,
  uniqueStrings,
} from "./shared.js";

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
      obj(source.pricingPolicy || source.pricing_policy || nested.pricingPolicy || defaults.pricingPolicy)
    ),
    locationPolicy: sanitizeLocationPolicy(
      obj(source.locationPolicy || source.location_policy || nested.locationPolicy || defaults.locationPolicy)
    ),
    bookingPolicy: sanitizeBookingPolicy(
      obj(source.bookingPolicy || source.booking_policy || nested.bookingPolicy || defaults.bookingPolicy)
    ),
    contactPolicy: sanitizeContactPolicy(
      obj(source.contactPolicy || source.contact_policy || nested.contactPolicy || defaults.contactPolicy)
    ),
    handoffPolicy: sanitizeHandoffPolicy(
      obj(source.handoffPolicy || source.handoff_policy || nested.handoffPolicy || defaults.handoffPolicy)
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
