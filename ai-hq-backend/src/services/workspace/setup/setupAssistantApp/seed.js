import { arr, obj, s } from "../draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  sanitizeStructuredHours,
} from "../setupAssistantParser.js";
import { normalizeSourceType, slugify, uniqueStrings } from "./shared.js";
import {
  sanitizeAssistantState,
  sanitizeBusinessProfile,
  sanitizeContacts,
  sanitizeHandoffRules,
  sanitizePricingPosture,
  sanitizeProgress,
  sanitizeServices,
  sanitizeSourceMetadata,
} from "./sanitize.js";

export function deriveServicesFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);

  return sanitizeServices([
    ...arr(reviewDraft.services).map((item) => ({
      key: s(item.key || item.serviceKey || item.service_key || item.id),
      title: s(item.title || item.name || item.label || item.value_text),
      summary: s(item.description || item.summary || item.value_text),
      category: s(item.category || "general"),
    })),
    ...arr(payloadProfile.services).map((title) => ({
      key: slugify(title),
      title: s(title),
      category: "general",
    })),
    ...arr(profile.services).map((title) => ({
      key: slugify(title),
      title: s(title),
      category: "general",
    })),
  ]);
}

export function deriveContactsFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);

  return sanitizeContacts([
    s(profile.primaryPhone || payloadProfile.primaryPhone)
      ? {
          type: "phone",
          label: "Phone",
          value: s(profile.primaryPhone || payloadProfile.primaryPhone),
          preferred: true,
          visibility: "public",
        }
      : null,
    s(profile.primaryEmail || payloadProfile.primaryEmail)
      ? {
          type: "email",
          label: "Email",
          value: s(profile.primaryEmail || payloadProfile.primaryEmail),
          visibility: "public",
        }
      : null,
    ...arr(payloadProfile.whatsappLinks).map((item, index) => ({
      type: "whatsapp",
      label: index === 0 ? "WhatsApp" : `WhatsApp ${index + 1}`,
      value: s(item),
      visibility: "public",
    })),
  ]);
}

export function deriveHoursFromReviewDraft(reviewDraft = {}) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const rawHours = uniqueStrings([...arr(profile.hours), ...arr(payloadProfile.hours)]);
  if (!rawHours.length) return sanitizeStructuredHours([]);
  return parseHoursNote(rawHours.join("\n"));
}

export function derivePricingFromReviewDraft(
  reviewDraft = {},
  derivedServices = []
) {
  const profile = obj(reviewDraft.businessProfile);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const note = uniqueStrings([
    s(profile.pricingPolicy),
    s(payloadProfile.pricingPolicy),
    ...arr(profile.pricingHints),
    ...arr(payloadProfile.pricingHints),
  ]).join(". ");

  if (!note) return sanitizePricingPosture({});
  return parsePricingNote(note, {}, derivedServices);
}

export function buildSourceMetadataFromReview(review = {}) {
  const draft = obj(review.draft);
  const summary = obj(draft.sourceSummary);
  const latestImport = obj(summary.latestImport);
  const latestAnalyze = obj(summary.latestAnalyze);
  const sources = arr(review.sources);
  const sourceLabels = uniqueStrings([
    ...sources.map((item) =>
      s(item.label || item.sourceLabel || item.sourceType || item.role)
    ),
    s(latestImport.sourceLabel),
    s(summary.primarySourceType),
  ]);
  const evidenceSummary = uniqueStrings([
    summary.primarySourceUrl ? `Primary source: ${summary.primarySourceUrl}` : "",
    latestImport.sourceUrl ? `Latest import: ${latestImport.sourceUrl}` : "",
    latestAnalyze.sourceType ? `Last analyze: ${latestAnalyze.sourceType}` : "",
    Number(draft.warningCount || arr(draft.warnings).length) > 0
      ? `${Number(draft.warningCount || arr(draft.warnings).length)} warnings need review`
      : "",
  ]);

  return sanitizeSourceMetadata({
    primarySourceType: normalizeSourceType(
      summary.primarySourceType ||
        latestImport.sourceType ||
        latestAnalyze.sourceType
    ),
    primarySourceUrl: summary.primarySourceUrl || latestImport.sourceUrl,
    sourceLabels,
    evidenceSummary,
    warningCount: Number(draft.warningCount || arr(draft.warnings).length || 0),
    sourceCount: sources.length || arr(summary.imports).length,
  });
}

export function buildSetupAssistantSeedFromReview(review = {}) {
  const reviewDraft = obj(review.draft);
  const payloadProfile = obj(obj(reviewDraft.draftPayload).profile);
  const businessProfile = sanitizeBusinessProfile({
    ...payloadProfile,
    ...obj(reviewDraft.businessProfile),
  });
  const services = deriveServicesFromReviewDraft(reviewDraft);

  return {
    businessProfile,
    services,
    contacts: deriveContactsFromReviewDraft(reviewDraft),
    hours: deriveHoursFromReviewDraft(reviewDraft),
    pricingPosture: derivePricingFromReviewDraft(reviewDraft, services),
    handoffRules: sanitizeHandoffRules({}),
    sourceMetadata: buildSourceMetadataFromReview(review),
    assistantState: sanitizeAssistantState({}),
    progress: sanitizeProgress({}),
  };
}
