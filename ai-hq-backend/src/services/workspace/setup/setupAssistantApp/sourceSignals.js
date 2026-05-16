import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import {
  buildRecognizedSourceCandidate,
  classifySetupSourceValue,
  normalizeSourceType,
  normalizeWebsiteUrl,
  sourceTypeLabel,
  uniqueStrings,
} from "./shared.js";

const ACKNOWLEDGEMENT_PATTERNS = [
  /^ok(?:ay)?$/i,
  /^ok(?:ay)?\s+(?:davam|continue|next)$/i,
  /^davam$/i,
  /^continue$/i,
  /^next$/i,
  /^beli$/i,
  /^he$/i,
  /^h[əe]$/i,
  /^oldu$/i,
  /^ela$/i,
  /^ela devam$/i,
  /^ela continue$/i,
  /^tamam$/i,
  /^good$/i,
  /^lets continue\.?$/i,
];

const GENERIC_SOURCE_WORDS = new Set([
  "website",
  "site",
  "web site",
  "web",
  "instagram",
  "facebook",
  "google maps",
  "maps",
  "source",
  "link",
  "contact",
  "contacts",
  "service",
  "services",
  "menu",
  "business",
]);

const GENERIC_NAV_WORDS = new Set([
  "home",
  "about",
  "contact",
  "contacts",
  "services",
  "pricing",
  "menu",
  "blog",
  "faq",
  "careers",
]);

function normalizedCandidate(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function tokenize(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(a = "", b = "") {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;

  let hits = 0;
  for (const token of ta) {
    if (tb.has(token)) hits += 1;
  }

  return hits / Math.max(ta.size, tb.size);
}

function listPreview(items = [], max = 4) {
  const safe = uniqueStrings(items, 24);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function urlHost(value = "") {
  const raw = normalizeWebsiteUrl(s(value));
  if (!raw) return "";

  try {
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function isAcknowledgementOnly(value = "") {
  const text = normalizedCandidate(value).toLowerCase();
  if (!text) return true;
  return ACKNOWLEDGEMENT_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeUrlOrDomain(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return true;
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return true;
  return false;
}

function looksLikeEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s(value));
}

function looksLikePhone(value = "") {
  return /(?:\+?\d[\d()\-\s]{6,}\d)/.test(s(value));
}

function looksLikeHoursText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;

  return (
    /(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|b\.e|be|cume|cümə|senbe|şənbə|bazar)/.test(
      text
    ) ||
    /\b\d{1,2}[:.]?\d{0,2}\s*(?:-|to|dan|den|dek|qeder)\s*\d{1,2}[:.]?\d{0,2}\b/.test(
      text
    ) ||
    /\b(24\/7|appointment only|closed|bagli|bağlı)\b/.test(text)
  );
}

function looksLikePricingText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;

  return (
    /(azn|usd|eur|gbp|\$|€|₼|£)/.test(text) ||
    /\b(price|pricing|quote|starting|from|discount|promo|qiymet|qiymət|xidmete gore|xidmətə görə)\b/.test(
      text
    )
  );
}

function looksLikeGenericSourceWord(value = "") {
  const text = normalizedCandidate(value).toLowerCase();
  return GENERIC_SOURCE_WORDS.has(text) || GENERIC_NAV_WORDS.has(text);
}

function sanitizeCompanyCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return "";
  if (isAcknowledgementOnly(text)) return "";
  if (looksLikeUrlOrDomain(text) || looksLikeEmail(text) || looksLikePhone(text)) {
    return "";
  }
  if (looksLikeGenericSourceWord(text)) return "";

  const words = tokenize(text);
  if (!words.length || words.length > 6) return "";
  return text;
}

function sanitizeDescriptionCandidate(value = "", { allowShort = false } = {}) {
  const text = normalizedCandidate(value);
  if (!text) return "";
  if (isAcknowledgementOnly(text)) return "";
  if (looksLikeUrlOrDomain(text) || looksLikeEmail(text) || looksLikePhone(text)) {
    return "";
  }
  if (looksLikeGenericSourceWord(text)) return "";

  const words = tokenize(text);
  if (!words.length) return "";
  if (!allowShort && words.length < 4) return "";
  return text;
}

function sanitizeServiceCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return "";
  if (isAcknowledgementOnly(text)) return "";
  if (looksLikeUrlOrDomain(text) || looksLikeEmail(text) || looksLikePhone(text)) {
    return "";
  }
  if (looksLikeHoursText(text) || looksLikePricingText(text)) return "";

  const lowerText = text.toLowerCase();
  if (looksLikeGenericSourceWord(lowerText)) return "";
  if (GENERIC_NAV_WORDS.has(lowerText)) return "";

  const words = tokenize(text);
  if (!words.length || words.length > 8) return "";
  return text;
}

function sanitizeContactCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return "";
  if (looksLikeEmail(text) || looksLikePhone(text)) return text;
  if (
    /whatsapp|telegram|wa\.me|instagram\.com|facebook\.com|m\.me|form|call|phone|email|dm/i.test(
      text
    )
  ) {
    return text;
  }
  return "";
}

function sanitizeHoursCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || !looksLikeHoursText(text)) return "";
  return text;
}

function sanitizePricingCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || isAcknowledgementOnly(text)) return "";
  if (!looksLikePricingText(text)) return "";
  return text;
}

function sanitizeAudienceCandidate(value = "") {
  return sanitizeDescriptionCandidate(value, { allowShort: true });
}

function sanitizeLanguageCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || isAcknowledgementOnly(text)) return "";
  const words = tokenize(text);
  if (!words.length || words.length > 4) return "";
  return text;
}

function sanitizeToneCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || isAcknowledgementOnly(text)) return "";
  const words = tokenize(text);
  if (!words.length || words.length > 8) return "";
  return text;
}

function sanitizeHandoffCandidate(value = "") {
  return sanitizeDescriptionCandidate(value, { allowShort: true });
}

function weightedUniqueStrings(entries = [], sanitizer = (value) => s(value)) {
  const scores = new Map();
  const order = [];
  let index = 0;

  for (const entry of arr(entries)) {
    const rawValue =
      typeof entry === "object" && entry !== null ? entry.value : entry;
    const weight =
      typeof entry === "object" && entry !== null
        ? Number(entry.weight || 0) || 0
        : 1;

    const sanitized = sanitizer(rawValue);
    if (!sanitized) continue;

    if (!scores.has(sanitized)) {
      scores.set(sanitized, { score: 0, firstIndex: index });
      order.push(sanitized);
    }

    scores.get(sanitized).score += Math.max(1, weight);
    index += 1;
  }

  return order.sort((a, b) => {
    const sa = scores.get(a);
    const sb = scores.get(b);
    if (sb.score !== sa.score) return sb.score - sa.score;
    return sa.firstIndex - sb.firstIndex;
  });
}

function topCandidate(values = []) {
  return arr(values)[0] || "";
}

function sourceAuthorityWeight(value = "") {
  const key = s(value).toLowerCase();
  if (key === "high") return 5;
  if (key === "medium") return 3;
  if (key === "low") return 1;
  return 2;
}

function buildSourceRows({ draft = {}, sources = [], review = null } = {}) {
  const safeDraft = obj(draft);
  const sourceMetadata = obj(safeDraft.sourceMetadata);
  const reviewRoot = obj(review);
  const sourceSignalSummary = obj(reviewRoot.sourceSignalSummary);

  const rows = arr(sources).map((item) =>
    compactDraftObject({
      sourceId: s(item.sourceId || item.id),
      sourceType: normalizeSourceType(item.sourceType || item.type),
      role: s(item.role),
      label: s(item.label),
      sourceUrl: s(item.sourceUrl || item.url || item.metadata?.sourceUrl),
      sourceAuthorityClass: s(
        item.sourceAuthorityClass || item.metadata?.sourceAuthorityClass
      ),
    })
  );

  const metadataPrimaryType = normalizeSourceType(sourceMetadata.primarySourceType);
  const metadataPrimaryUrl = s(sourceMetadata.primarySourceUrl);

  if (
    (metadataPrimaryType || metadataPrimaryUrl) &&
    !rows.some(
      (item) =>
        s(item.sourceType) === metadataPrimaryType &&
        s(item.sourceUrl) === metadataPrimaryUrl
    )
  ) {
    rows.unshift(
      compactDraftObject({
        sourceId: "",
        sourceType: metadataPrimaryType,
        role: "primary",
        label: sourceTypeLabel(metadataPrimaryType),
        sourceUrl: metadataPrimaryUrl,
        sourceAuthorityClass: "",
      })
    );
  }

  const signalPrimary = obj(sourceSignalSummary.primarySource);
  if (
    (s(signalPrimary.sourceType) || s(signalPrimary.sourceUrl)) &&
    !rows.some(
      (item) =>
        s(item.sourceType) === s(signalPrimary.sourceType) &&
        s(item.sourceUrl) === s(signalPrimary.sourceUrl)
    )
  ) {
    rows.unshift(
      compactDraftObject({
        sourceId: s(signalPrimary.sourceId),
        sourceType: s(signalPrimary.sourceType),
        role: s(signalPrimary.role || "primary"),
        label: s(signalPrimary.label),
        sourceUrl: s(signalPrimary.sourceUrl),
        sourceAuthorityClass: s(signalPrimary.sourceAuthorityClass),
      })
    );
  }

  return rows;
}

export function buildSetupSourceSignals({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);
  const sourceSummary = obj(draft.sourceSummary);

  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const reviewDebug = obj(reviewRoot.review?.reviewDebug || reviewRoot.reviewDebug);
  const reviewFieldProvenance = obj(
    reviewRoot.fieldProvenance || reviewRoot.review?.fieldProvenance
  );
  const sourceSignalSummary = obj(reviewRoot.sourceSignalSummary);
  const websiteKnowledge = obj(
    sourceSignalSummary.website || reviewDebug.websiteKnowledge
  );
  const sourceRows = buildSourceRows({ draft, sources, review });

  const primarySource =
    obj(sourceSignalSummary.primarySource).sourceType ||
    obj(sourceSignalSummary.primarySource).sourceUrl
      ? obj(sourceSignalSummary.primarySource)
      : sourceRows.find((item) => s(item.role).toLowerCase() === "primary") ||
        sourceRows[0] ||
        compactDraftObject({
          sourceType: s(sourceSummary.primarySourceType || session.primarySourceType),
          sourceUrl:
            s(sourceSummary.primarySourceUrl) ||
            s(reviewDraft.businessProfile?.websiteUrl) ||
            s(businessProfile.websiteUrl),
          label: sourceTypeLabel(
            sourceSummary.primarySourceType || session.primarySourceType
          ),
        });

  const primaryAuthorityWeight = sourceAuthorityWeight(
    primarySource.sourceAuthorityClass
  );

  const companyNameCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.companyName?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.displayName?.observedValue, weight: 8 },
      { value: sourceSummary.businessName, weight: 6 },
      { value: reviewDraft.businessProfile?.companyName, weight: 5 },
      { value: businessProfile.companyName, weight: 5 },
      { value: primarySource.label, weight: primaryAuthorityWeight + 1 },
      ...sourceRows.map((item) => ({
        value: item.label,
        weight: sourceAuthorityWeight(item.sourceAuthorityClass),
      })),
      ...arr(sourceMetadata.sourceLabels).map((label) => ({
        value: label,
        weight: 2,
      })),
    ],
    sanitizeCompanyCandidate
  );

  const descriptionCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.description?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.companySummaryShort?.observedValue, weight: 8 },
      { value: reviewDraft.businessProfile?.description, weight: 4 },
      { value: businessProfile.description, weight: 4 },
      { value: reviewDraft.businessProfile?.companySummaryShort, weight: 3 },
      { value: reviewDraft.businessProfile?.companySummary, weight: 3 },
      { value: businessProfile.companySummaryShort, weight: 3 },
      { value: businessProfile.companySummary, weight: 3 },
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizeDescriptionCandidate
  );

  const serviceCandidates = weightedUniqueStrings(
    [
      ...arr(reviewDraft.services).map((item) => ({
        value: s(item.title || item.name || item.label || item.value_text),
        weight: 5,
      })),
      ...arr(draft.services).map((item) => ({
        value: s(item.title || item.name || item.label),
        weight: 5,
      })),
      ...arr(reviewFieldProvenance.services?.observedValues).map((value) => ({
        value,
        weight: 6,
      })),
      ...(s(reviewFieldProvenance.services?.observedValue)
        ? [{ value: reviewFieldProvenance.services?.observedValue, weight: 5 }]
        : []),
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 3,
      })),
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
      ...arr(websiteKnowledge.topPages).map((item) => ({
        value: s(item.title),
        weight: 1,
      })),
    ],
    sanitizeServiceCandidate
  );

  const contactCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.primaryPhone?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.primaryEmail?.observedValue, weight: 8 },
      { value: reviewDraft.businessProfile?.primaryPhone, weight: 5 },
      { value: reviewDraft.businessProfile?.primaryEmail, weight: 5 },
      { value: businessProfile.primaryPhone, weight: 5 },
      { value: businessProfile.primaryEmail, weight: 5 },
      ...arr(reviewDraft.contacts).map((item) => ({
        value: s(item.value || item.label || item.channel),
        weight: 4,
      })),
      ...arr(draft.contacts).map((item) => ({
        value: s(item.value || item.label || item.channel),
        weight: 4,
      })),
      ...sourceRows.flatMap((item) => [
        {
          value: item.label,
          weight: 1,
        },
        {
          value: item.sourceUrl,
          weight: 1,
        },
      ]),
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizeContactCandidate
  );

  const hoursCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.hours?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.businessHours?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.openingHours?.observedValue, weight: 8 },
      ...arr(reviewDraft.businessProfile?.hours).map((value) => ({
        value,
        weight: 4,
      })),
      ...arr(draft.hours).map((item) => ({
        value:
          item?.day && (item?.openTime || item?.closeTime || item?.notes)
            ? `${s(item.day)} ${s(item.openTime)}-${s(item.closeTime)} ${s(
                item.notes
              )}`
            : "",
        weight: 2,
      })),
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 1,
      })),
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizeHoursCandidate
  );

  const pricingCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.pricingHints?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.pricingPolicy?.observedValue, weight: 8 },
      { value: reviewDraft.businessProfile?.pricingPolicy, weight: 5 },
      { value: businessProfile.pricingPolicy, weight: 5 },
      { value: obj(draft.pricingPosture).publicSummary, weight: 5 },
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 1,
      })),
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizePricingCandidate
  );

  const audienceCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.targetAudience?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.audience?.observedValue, weight: 6 },
      { value: reviewDraft.businessProfile?.targetAudience, weight: 3 },
      { value: businessProfile.targetAudience, weight: 3 },
      ...arr(sourceMetadata.evidenceSummary).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizeAudienceCandidate
  );

  const languagesCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.language?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.mainLanguage?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.primaryLanguage?.observedValue, weight: 6 },
      ...arr(reviewDraft.languages).map((value) => ({
        value,
        weight: 3,
      })),
      ...arr(draft.languages).map((value) => ({
        value,
        weight: 3,
      })),
    ],
    sanitizeLanguageCandidate
  );

  const strongestEvidence = uniqueStrings(
    [
      primarySource.sourceUrl
        ? `${sourceTypeLabel(primarySource.sourceType)} source: ${primarySource.sourceUrl}`
        : "",
      topCandidate(companyNameCandidates)
        ? `Business-name signal: ${topCandidate(companyNameCandidates)}`
        : "",
      topCandidate(descriptionCandidates)
        ? `Description signal: ${topCandidate(descriptionCandidates)}`
        : "",
      serviceCandidates.length
        ? `Service signals: ${listPreview(serviceCandidates, 4)}`
        : "",
      contactCandidates.length
        ? `Contact signals: ${listPreview(contactCandidates, 3)}`
        : "",
      hoursCandidates.length
        ? `Hours signals: ${listPreview(hoursCandidates, 2)}`
        : "",
      pricingCandidates.length
        ? `Pricing signals: ${listPreview(pricingCandidates, 2)}`
        : "",
      Number(sourceSignalSummary.website?.pageCount || websiteKnowledge.pageCount || 0) > 0
        ? `Website pages analyzed: ${Number(
            sourceSignalSummary.website?.pageCount ||
              websiteKnowledge.pageCount ||
              0
          )}`
        : "",
      ...arr(sourceMetadata.evidenceSummary),
    ],
    12
  );

  const out = {
    sourceRows,
    primarySourceType: s(primarySource.sourceType || session.primarySourceType),
    primarySourceLabel:
      s(primarySource.label) || sourceTypeLabel(primarySource.sourceType),
    primarySourceUrl: s(primarySource.sourceUrl),
    primarySourceAuthorityClass: s(primarySource.sourceAuthorityClass),
    sourceTypes: uniqueStrings(
      sourceSignalSummary.sourceTypes?.length
        ? sourceSignalSummary.sourceTypes
        : [primarySource.sourceType, ...sourceRows.map((item) => item.sourceType)]
    ),
    pageCount:
      Number(sourceSignalSummary.website?.pageCount || 0) ||
      Number(websiteKnowledge.pageCount || 0) ||
      Number(sourceMetadata.pageCount || 0) ||
      0,
    strongestEvidence,
    discoveredPublicClaims: uniqueStrings([
      ...arr(sourceSignalSummary.discoveredPublicClaims),
      ...arr(sourceMetadata.evidenceSummary),
    ]),
    companyNameCandidates,
    descriptionCandidates,
    serviceCandidates,
    contactCandidates,
    hoursCandidates,
    pricingCandidates,
    audienceCandidates,
    languagesCandidates,
  };

  return out;
}

export function buildSetupSourceCoverage(sourceSignals = {}) {
  const primarySourceExists = Boolean(
    s(sourceSignals.primarySourceType) || s(sourceSignals.primarySourceUrl)
  );

  const identity =
    Boolean(
      topCandidate(sourceSignals.companyNameCandidates) &&
        topCandidate(sourceSignals.descriptionCandidates)
    ) && primarySourceExists;

  const services =
    arr(sourceSignals.serviceCandidates).length >= 2 ||
    (arr(sourceSignals.serviceCandidates).length >= 1 && primarySourceExists);

  const contacts = arr(sourceSignals.contactCandidates).length >= 1;
  const hours = arr(sourceSignals.hoursCandidates).length >= 1;
  const pricing = arr(sourceSignals.pricingCandidates).length >= 1;
  const audience = arr(sourceSignals.audienceCandidates).length >= 1;
  const languages = arr(sourceSignals.languagesCandidates).length >= 1;

  return {
    primarySourceExists,
    identity,
    services,
    contacts,
    hours,
    pricing,
    audience,
    languages,
  };
}

export function buildSetupDraftStateFromSignals({
  draft = {},
  review = null,
  sourceSignals = {},
} = {}) {
  const businessProfile = obj(draft.businessProfile);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const mergedProfile = {
    ...obj(reviewDraft.businessProfile),
    ...businessProfile,
  };

  const businessName =
    sanitizeCompanyCandidate(
      mergedProfile.companyName || mergedProfile.displayName || mergedProfile.name
    ) || topCandidate(sourceSignals.companyNameCandidates);

  const description =
    sanitizeDescriptionCandidate(
      mergedProfile.description ||
        mergedProfile.companySummaryShort ||
        mergedProfile.companySummary
    ) || topCandidate(sourceSignals.descriptionCandidates);

  const services = uniqueStrings([
    ...arr(reviewDraft.services).map((item) =>
      s(item.title || item.name || item.label || item.value_text)
    ),
    ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(sourceSignals.serviceCandidates),
  ])
    .map((value) => sanitizeServiceCandidate(value))
    .filter(Boolean);

  const contacts = uniqueStrings([
    mergedProfile.primaryPhone,
    mergedProfile.primaryEmail,
    mergedProfile.primaryAddress,
    ...arr(reviewDraft.contacts).map((item) =>
      s(item.label || item.value || item.channel)
    ),
    ...arr(draft.contacts).map((item) => s(item.label || item.value || item.channel)),
    ...arr(sourceSignals.contactCandidates),
  ])
    .map((value) => sanitizeContactCandidate(value))
    .filter(Boolean);

  const hours = uniqueStrings([
    ...arr(mergedProfile.hours),
    ...arr(draft.hours).map((item) => {
      if (!item?.day) return "";
      if (item?.allDay) return `${item.day} 24 hours`;
      if (item?.appointmentOnly) return `${item.day} appointment only`;
      if (item?.closed) return `${item.day} closed`;
      if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
      if (s(item?.openTime) || s(item?.closeTime)) {
        return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
      }
      return "";
    }),
    ...arr(sourceSignals.hoursCandidates),
  ])
    .map((value) => sanitizeHoursCandidate(value))
    .filter(Boolean);

  const pricingPosture =
    sanitizePricingCandidate(
      mergedProfile.pricingPolicy ||
        draft.pricingPosture?.publicSummary ||
        draft.pricingPosture?.note ||
        draft.pricingPosture?.summary
    ) || topCandidate(sourceSignals.pricingCandidates);

  const humanHandoff =
    sanitizeHandoffCandidate(
      draft.handoffRules?.summary || arr(draft.handoffRules?.triggers).join(", ")
    ) || "";

  const languages = uniqueStrings([
    ...arr(mergedProfile.supportedLanguages),
    ...arr(mergedProfile.languages),
    ...arr(draft.languages),
    ...arr(sourceSignals.languagesCandidates),
  ])
    .map((value) => sanitizeLanguageCandidate(value))
    .filter(Boolean);

  const tone =
    sanitizeToneCandidate(
      mergedProfile.brandTone || mergedProfile.tone || draft.tone
    ) || "";

  return {
    businessName,
    description,
    websiteUrl:
      normalizeWebsiteUrl(s(mergedProfile.websiteUrl)) ||
      (s(sourceSignals.primarySourceType).toLowerCase() === "website"
        ? normalizeWebsiteUrl(s(sourceSignals.primarySourceUrl))
        : ""),
    services,
    audience:
      sanitizeAudienceCandidate(
        mergedProfile.targetAudience || mergedProfile.audience
      ) || topCandidate(sourceSignals.audienceCandidates),
    pricingPosture,
    contacts,
    hours,
    humanHandoff,
    languages,
    tone,
  };
}

export function detectSetupSignalContradictions({
  draftState = {},
  sourceSignals = {},
}) {
  const contradictions = [];

  const sourceName = topCandidate(sourceSignals.companyNameCandidates);
  const draftWebsiteHost = urlHost(draftState.websiteUrl);
  const sourceWebsiteHost = urlHost(sourceSignals.primarySourceUrl);

  if (
    draftState.businessName &&
    sourceName &&
    overlapScore(draftState.businessName, sourceName) < 0.4
  ) {
    contradictions.push({
      key: "business_name_conflict",
      severity: "high",
      message: `Source business-name signal looks like "${sourceName}", but the current draft says "${draftState.businessName}".`,
    });
  }

  if (draftWebsiteHost && sourceWebsiteHost && draftWebsiteHost !== sourceWebsiteHost) {
    contradictions.push({
      key: "website_conflict",
      severity: "high",
      message: `The draft website looks like "${draftWebsiteHost}", while the main source looks like "${sourceWebsiteHost}".`,
    });
  }

  if (draftState.services.length && sourceSignals.serviceCandidates.length >= 2) {
    const overlapFound = draftState.services.some((service) =>
      sourceSignals.serviceCandidates.some(
        (candidate) => overlapScore(service, candidate) >= 0.45
      )
    );

    if (!overlapFound) {
      contradictions.push({
        key: "services_conflict",
        severity: "medium",
        message:
          "The current service list does not line up with the strongest service signals coming from the sources.",
      });
    }
  }

  return contradictions;
}

export function buildSetupSourceLead(sourceSignals = {}) {
  const label = s(sourceSignals.primarySourceLabel);
  const url = s(sourceSignals.primarySourceUrl);

  if (label && url) return `${label} source is already attached (${url})`;
  if (label) return `${label} source is already attached`;
  if (url) return `A source URL is already attached (${url})`;
  return "";
}

export function buildSetupKnownState(draftState = {}) {
  const bits = [];

  if (s(draftState.businessName)) bits.push(`name: ${draftState.businessName}`);
  if (s(draftState.description)) bits.push("description present");
  if (arr(draftState.services).length) {
    bits.push(`${arr(draftState.services).length} service signals`);
  }
  if (arr(draftState.contacts).length) bits.push("contact route present");
  if (arr(draftState.hours).length) bits.push("hours present");
  if (s(draftState.pricingPosture)) bits.push("pricing posture present");
  if (s(draftState.humanHandoff)) bits.push("handoff rules present");

  return bits.slice(0, 6);
}