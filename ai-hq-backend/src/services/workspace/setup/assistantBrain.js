import { arr, compactObject, lower, obj, s } from "./utils.js";

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

function uniqueStrings(values = [], max = 24) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))].slice(
    0,
    max
  );
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
  const raw = s(value);
  if (!raw) return "";

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(normalized).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function sourceTypeLabel(type = "") {
  const key = lower(type);
  if (key === "instagram") return "Instagram";
  if (key === "facebook" || key === "facebook_page") return "Facebook";
  if (key === "google_maps") return "Google Maps";
  if (key === "manual") return "Manual note";
  return "Website";
}

function groupLabel(group = "") {
  return group === "ai_behavior" ? "AI behavior" : "Business truth";
}

function normalizedCandidate(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
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
    /(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|b\.e|be|cume|senbe|bazar)/.test(
      text
    ) ||
    /\b\d{1,2}[:.]?\d{0,2}\s*(?:-|to|dan|den|dek|qeder)\s*\d{1,2}[:.]?\d{0,2}\b/.test(
      text
    ) ||
    /\b(24\/7|appointment only|closed|bagli)\b/.test(text)
  );
}

function looksLikePricingText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;

  return (
    /(azn|usd|eur|gbp|\$|€|₼|£)/.test(text) ||
    /\b(price|pricing|quote|starting|from|discount|promo|qiymet|xidmete gore)\b/.test(
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
  if (/whatsapp|telegram|wa\.me|instagram\.com|facebook\.com|m\.me/i.test(text)) {
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

function sanitizeHandoffCandidate(value = "") {
  return sanitizeDescriptionCandidate(value, { allowShort: true });
}

function sanitizeToneCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || isAcknowledgementOnly(text)) return "";
  const words = tokenize(text);
  if (!words.length || words.length > 8) return "";
  return text;
}

function sanitizeLanguageCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || isAcknowledgementOnly(text)) return "";
  const words = tokenize(text);
  if (!words.length || words.length > 4) return "";
  return text;
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
  const key = lower(value);
  if (key === "high") return 5;
  if (key === "medium") return 3;
  if (key === "low") return 1;
  return 2;
}

function extractBehaviorSignals({ draft = {}, review = null } = {}) {
  const safeDraft = obj(draft);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  const draftAssistantState = obj(safeDraft.assistantState);
  const reviewAssistantState = obj(reviewDraft.assistantState);

  return {
    greetingCandidates: weightedUniqueStrings(
      [
        { value: draftAssistantState.greeting, weight: 2 },
        { value: draftAssistantState.greetingStyle, weight: 2 },
        { value: reviewAssistantState.greeting, weight: 2 },
        { value: reviewAssistantState.greetingStyle, weight: 2 },
      ],
      sanitizeToneCandidate
    ),
    afterHoursCandidates: weightedUniqueStrings(
      [
        { value: draftAssistantState.afterHours, weight: 2 },
        { value: draftAssistantState.afterHoursBehavior, weight: 2 },
        { value: reviewAssistantState.afterHours, weight: 2 },
        { value: reviewAssistantState.afterHoursBehavior, weight: 2 },
      ],
      sanitizeDescriptionCandidate
    ),
  };
}

function buildSourceSignals({ session = {}, draft = {}, sources = [], review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
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
  const behaviorSignals = extractBehaviorSignals({ draft, review });

  const sourceRows = arr(sources).map((item) =>
    compactObject({
      sourceId: s(item.sourceId || item.id),
      sourceType: s(item.sourceType || item.type),
      role: s(item.role),
      label: s(item.label),
      sourceUrl: s(item.sourceUrl || item.url || item.metadata?.sourceUrl),
      sourceAuthorityClass: s(
        item.sourceAuthorityClass || item.metadata?.sourceAuthorityClass
      ),
    })
  );

  const primarySource =
    obj(sourceSignalSummary.primarySource).sourceType ||
    obj(sourceSignalSummary.primarySource).sourceUrl
      ? obj(sourceSignalSummary.primarySource)
      : sourceRows.find((item) => lower(item.role) === "primary") ||
        sourceRows[0] ||
        compactObject({
          sourceType: s(sourceSummary.primarySourceType || session.primarySourceType),
          sourceUrl:
            s(sourceSummary.primarySourceUrl) ||
            s(reviewDraft.businessProfile?.websiteUrl) ||
            s(businessProfile.websiteUrl),
          label: sourceTypeLabel(sourceSummary.primarySourceType || session.primarySourceType),
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
    ],
    sanitizeCompanyCandidate
  );

  const descriptionCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.description?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.companySummaryShort?.observedValue, weight: 8 },
      { value: reviewDraft.businessProfile?.description, weight: 4 },
      { value: businessProfile.description, weight: 4 },
      { value: businessProfile.companySummaryShort, weight: 3 },
      { value: businessProfile.companySummary, weight: 3 },
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
      ...sourceRows.flatMap((item) => [
        { value: item.label, weight: 1 },
        { value: item.sourceUrl, weight: 1 },
      ]),
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
    ],
    sanitizeHoursCandidate
  );

  const pricingCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.pricingHints?.observedValue, weight: 8 },
      { value: reviewFieldProvenance.pricingPolicy?.observedValue, weight: 8 },
      { value: reviewDraft.businessProfile?.pricingPolicy, weight: 5 },
      { value: businessProfile.pricingPolicy, weight: 5 },
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
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
    ],
    (value) => sanitizeDescriptionCandidate(value, { allowShort: true })
  );

  const languagesCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.language?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.mainLanguage?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.primaryLanguage?.observedValue, weight: 6 },
    ],
    sanitizeLanguageCandidate
  );

  const strongestEvidence = uniqueStrings([
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
          sourceSignalSummary.website?.pageCount || websiteKnowledge.pageCount || 0
        )}`
      : "",
  ]);

  return {
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
      0,
    strongestEvidence,
    discoveredPublicClaims: uniqueStrings(sourceSignalSummary.discoveredPublicClaims),
    companyNameCandidates,
    descriptionCandidates,
    serviceCandidates,
    contactCandidates,
    hoursCandidates,
    pricingCandidates,
    audienceCandidates,
    languagesCandidates,
    greetingCandidates: behaviorSignals.greetingCandidates,
    afterHoursCandidates: behaviorSignals.afterHoursCandidates,
  };
}

function buildDraftState({ draft = {}, review = null, sourceSignals = {} } = {}) {
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
    ...arr(reviewDraft.contacts).map((item) => s(item.label || item.value || item.channel)),
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
    ...arr(sourceSignals.languagesCandidates),
  ])
    .map((value) => sanitizeLanguageCandidate(value))
    .filter(Boolean);

  const tone = sanitizeToneCandidate(mergedProfile.brandTone || mergedProfile.tone);
  const greetingStyle = topCandidate(sourceSignals.greetingCandidates);
  const afterHoursBehavior = topCandidate(sourceSignals.afterHoursCandidates);

  return {
    businessName,
    description,
    websiteUrl:
      s(mergedProfile.websiteUrl) ||
      (lower(sourceSignals.primarySourceType) === "website"
        ? s(sourceSignals.primarySourceUrl)
        : ""),
    services,
    audience:
      sanitizeDescriptionCandidate(
        mergedProfile.targetAudience || mergedProfile.audience,
        { allowShort: true }
      ) || topCandidate(sourceSignals.audienceCandidates),
    pricingPosture,
    contacts,
    hours,
    humanHandoff,
    languages,
    tone,
    greetingStyle,
    afterHoursBehavior,
  };
}

function detectContradictions({ draftState, sourceSignals }) {
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

function buildConfidenceBuckets({ draftState, sourceSignals, contradictions }) {
  const strong = [];
  const unclear = [];

  if (draftState.businessName) {
    strong.push(`Business name locked: ${draftState.businessName}`);
  } else if (topCandidate(sourceSignals.companyNameCandidates)) {
    unclear.push(
      `Source suggests the business name may be ${topCandidate(
        sourceSignals.companyNameCandidates
      )}.`
    );
  } else {
    unclear.push("Business name is still unclear.");
  }

  if (draftState.description) {
    strong.push("The business description is usable.");
  } else if (topCandidate(sourceSignals.descriptionCandidates)) {
    unclear.push(
      "There is a source-grounded description signal, but it still needs a clean confirmation."
    );
  } else {
    unclear.push("The business description is still missing.");
  }

  if (draftState.services.length) {
    strong.push(`Core services are usable: ${listPreview(draftState.services, 4)}`);
  } else if (sourceSignals.serviceCandidates.length) {
    unclear.push(
      `Source service signals exist: ${listPreview(sourceSignals.serviceCandidates, 4)}.`
    );
  } else {
    unclear.push("Core services are still missing.");
  }

  if (draftState.contacts.length) {
    strong.push("A customer contact route is present.");
  } else {
    unclear.push("A public customer contact route is still missing.");
  }

  if (draftState.hours.length) {
    strong.push("Weekly availability has been recognized.");
  } else {
    unclear.push("Weekly hours still need to be locked in.");
  }

  if (draftState.pricingPosture) {
    strong.push("Pricing posture is present.");
  } else {
    unclear.push("Pricing posture is still too weak or too vague.");
  }

  if (draftState.humanHandoff) {
    strong.push("Escalation behavior is present.");
  } else {
    unclear.push("Escalation rules still need to be defined.");
  }

  if (!draftState.websiteUrl && !sourceSignals.primarySourceUrl) {
    unclear.push("A reliable public source is still missing.");
  }

  return {
    strong,
    unclear,
    contradictions: contradictions.map((item) => item.message),
  };
}

function buildRecommendation({ draftState, sourceSignals, contradictions }) {
  const notes = [];

  if (!draftState.businessName || !draftState.description) {
    notes.push(
      "Lock one exact public business identity before approval: the business name and one clean sentence describing what the business does."
    );
  }

  if (!draftState.services.length && sourceSignals.serviceCandidates.length) {
    notes.push(
      "Pick only real customer-facing services. Ignore channels or generic words unless they are actual services."
    );
  }

  if (!draftState.pricingPosture) {
    notes.push("Set a safe public pricing posture before AI answers price questions.");
  }

  if (!draftState.contacts.length) {
    notes.push("Choose one real public contact lane so AI knows where to route people.");
  }

  if (!draftState.hours.length) {
    notes.push("Lock the public weekly hours so AI does not promise the wrong availability.");
  }

  if (!draftState.humanHandoff) {
    notes.push("Define the exact cases where AI should stop and escalate to a human.");
  }

  if (contradictions.length) {
    notes.push("There is still source-vs-draft drift. Clean that before approval.");
  }

  return notes;
}

function buildQuestionCandidates({ draftState, sourceSignals, contradictions }) {
  const candidates = [];
  const primarySourceLabel =
    sourceSignals.primarySourceLabel || sourceTypeLabel(sourceSignals.primarySourceType);
  const sourceWebsite = s(sourceSignals.primarySourceUrl);

  const businessNameConflict = contradictions.find(
    (item) => item.key === "business_name_conflict"
  );
  if (businessNameConflict) {
    candidates.push({
      key: "profile",
      step: "profile",
      title: "Confirm the business identity",
      group: "business_truth",
      prompt: `${businessNameConflict.message} Send the exact public business name and one clean sentence describing what the business does.`,
      priority: 100,
    });
  }

  const websiteConflict = contradictions.find((item) => item.key === "website_conflict");
  if (websiteConflict) {
    candidates.push({
      key: "website",
      step: "website",
      title: "Confirm the main website",
      group: "business_truth",
      prompt: `${websiteConflict.message} Send the correct main website URL.`,
      priority: 98,
    });
  }

  if (!draftState.businessName || !draftState.description) {
    const parts = [];
    if (sourceWebsite) parts.push(`${primarySourceLabel}: ${sourceWebsite}`);
    if (topCandidate(sourceSignals.companyNameCandidates)) {
      parts.push(`name signal: ${topCandidate(sourceSignals.companyNameCandidates)}`);
    }
    if (topCandidate(sourceSignals.descriptionCandidates)) {
      parts.push(
        `description signal: ${topCandidate(sourceSignals.descriptionCandidates)}`
      );
    }

    candidates.push({
      key: "profile",
      step: "profile",
      title: "Confirm the business identity",
      group: "business_truth",
      prompt:
        parts.length > 0
          ? `I already have source signals (${parts.join(
              " • "
            )}). Now send the exact business name and one clean public sentence describing what the business does.`
          : "Send the exact business name and one clean public sentence describing what the business does.",
      priority: 96,
    });
  }

  if (!draftState.websiteUrl && !sourceWebsite) {
    candidates.push({
      key: "website",
      step: "website",
      title: "Add the main website",
      group: "business_truth",
      prompt: "Send the main website URL if the business has one.",
      priority: 90,
    });
  }

  if (!draftState.services.length) {
    candidates.push({
      key: "services",
      step: "services",
      title: "Curate the service menu",
      group: "business_truth",
      prompt:
        sourceSignals.serviceCandidates.length > 0
          ? `The sources suggest these service signals: ${listPreview(
              sourceSignals.serviceCandidates,
              5
            )}. Send only the real customer-facing services you want AI to talk about.`
          : "List the real core services in plain language. Ignore generic labels or channel names.",
      priority: 88,
    });
  }

  if (!draftState.contacts.length) {
    candidates.push({
      key: "contacts",
      step: "contacts",
      title: "Set the main customer contact lane",
      group: "business_truth",
      prompt:
        sourceSignals.contactCandidates.length > 0
          ? `I found these possible contact routes: ${listPreview(
              sourceSignals.contactCandidates,
              3
            )}. Which public contact route should AI use first?`
          : "Send the main public contact route customers should be sent to first.",
      priority: 86,
    });
  }

  if (!draftState.hours.length) {
    candidates.push({
      key: "hours",
      step: "hours",
      title: "Lock the public hours",
      group: "business_truth",
      prompt:
        sourceSignals.hoursCandidates.length > 0
          ? `I found these hour signals: ${listPreview(
              sourceSignals.hoursCandidates,
              2
            )}. Send the public weekly hours in one line.`
          : "Send the public weekly hours in one line.",
      priority: 84,
    });
  }

  if (!draftState.pricingPosture) {
    candidates.push({
      key: "pricing",
      step: "pricing",
      title: "Define the pricing posture",
      group: "business_truth",
      prompt:
        sourceSignals.pricingCandidates.length > 0
          ? `I found these pricing signals: ${listPreview(
              sourceSignals.pricingCandidates,
              2
            )}. How should AI answer pricing questions publicly?`
          : "How should AI speak publicly about pricing?",
      priority: 82,
    });
  }

  if (!draftState.humanHandoff) {
    candidates.push({
      key: "handoff",
      step: "handoff",
      title: "Define the operator handoff",
      group: "business_truth",
      prompt: "Describe when AI should stop and escalate to a human.",
      priority: 80,
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

function buildAiBehaviorPolicy(draftState = {}) {
  return compactObject({
    languages: arr(draftState.languages),
    tone: s(draftState.tone),
    greetingStyle: s(draftState.greetingStyle),
    afterHoursBehavior: s(draftState.afterHoursBehavior),
    escalationPolicy: s(draftState.humanHandoff),
    pricingDisclosurePolicy: s(draftState.pricingPosture),
    contactRoutingPolicy: arr(draftState.contacts),
  });
}

function buildInterviewPlan(questionCandidates = [], nextQuestion = null) {
  const activeQuestions = arr(questionCandidates).map((item) =>
    compactObject({
      key: item.key,
      step: item.step,
      title: item.title,
      group: item.group,
      groupLabel: groupLabel(item.group),
      priority: item.priority,
    })
  );

  return {
    activeQuestionKeys: activeQuestions.map((item) => item.key),
    activeQuestions,
    remainingQuestionKeys: activeQuestions
      .filter((item) => item.key !== s(nextQuestion?.key))
      .map((item) => item.key),
    nextGroup: s(nextQuestion?.group),
    nextGroupLabel: groupLabel(nextQuestion?.group),
  };
}

function buildSourceLead(sourceSignals = {}) {
  const label = s(sourceSignals.primarySourceLabel);
  const url = s(sourceSignals.primarySourceUrl);

  if (label && url) return `${label} source is already attached (${url})`;
  if (label) return `${label} source is already attached`;
  if (url) return `A source URL is already attached (${url})`;
  return "";
}

function buildKnownState(draftState = {}) {
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

  return bits.slice(0, 4);
}

function buildConversationalAssistantMessage({
  phase,
  nextQuestion,
  draftState,
  confidence,
  recommendations,
  sourceSignals,
  readyForApproval,
}) {
  const sourceLead = buildSourceLead(sourceSignals);
  const knownState = buildKnownState(draftState);

  if (phase === "source_capture") {
    return "Start with the best public source you have — website, Google Maps, Instagram, Facebook, or a short business note. I will first pull out what already looks real, then I will ask only the next thing that truly matters.";
  }

  if (readyForApproval) {
    const leadParts = [];
    if (sourceLead) leadParts.push(sourceLead);
    if (knownState.length) {
      leadParts.push(`current setup looks solid across ${knownState.join(", ")}`);
    }

    return `${leadParts.join(". ")}. The draft is now structured enough to move into review and approval. Read it once more, then finalize if everything looks correct.`;
  }

  const parts = [];
  if (sourceLead) parts.push(sourceLead);

  if (knownState.length) {
    parts.push(`current setup already has ${knownState.join(", ")}`);
  }

  if (nextQuestion?.prompt) {
    parts.push(`next most important gap: ${nextQuestion.prompt}`);
  }

  if (arr(confidence.unclear).length > 0) {
    parts.push(`still unclear: ${arr(confidence.unclear).slice(0, 2).join(" ")}`);
  }

  if (arr(confidence.contradictions).length > 0) {
    parts.push(`conflict detected: ${arr(confidence.contradictions).slice(0, 1).join(" ")}`);
  }

  if (arr(recommendations).length > 0 && !nextQuestion?.prompt) {
    parts.push(`next cleanup: ${arr(recommendations).slice(0, 1).join(" ")}`);
  }

  return parts.join(". ").replace(/\.\./g, ".").trim();
}

export function buildSetupAssistantBrainState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSourceSignals({ session, draft, sources, review });
  const draftState = buildDraftState({ draft, review, sourceSignals });
  const contradictions = detectContradictions({ draftState, sourceSignals });
  const confidence = buildConfidenceBuckets({
    draftState,
    sourceSignals,
    contradictions,
  });
  const recommendations = buildRecommendation({
    draftState,
    sourceSignals,
    contradictions,
  });
  const questionCandidates = buildQuestionCandidates({
    draftState,
    sourceSignals,
    contradictions,
  });
  const nextQuestion = questionCandidates[0] || null;

  const hasAnySignal = Boolean(
    s(draftState.businessName) ||
      s(draftState.description) ||
      s(draftState.websiteUrl) ||
      arr(draftState.services).length ||
      arr(draftState.contacts).length ||
      arr(draftState.hours).length ||
      s(draftState.pricingPosture) ||
      s(draftState.humanHandoff) ||
      s(sourceSignals.primarySourceUrl) ||
      arr(sourceSignals.sourceTypes).length
  );

  const readyForApproval =
    !nextQuestion &&
    !contradictions.some((item) => lower(item.severity) === "high") &&
    Boolean(
      draftState.businessName &&
        draftState.description &&
        (draftState.websiteUrl || sourceSignals.primarySourceUrl) &&
        draftState.services.length &&
        draftState.contacts.length &&
        draftState.hours.length &&
        draftState.pricingPosture &&
        draftState.humanHandoff
    );

  const phase = !hasAnySignal
    ? "source_capture"
    : readyForApproval
      ? "ready"
      : "interview";

  return {
    phase,
    nextQuestion: nextQuestion
      ? compactObject({
          key: nextQuestion.key,
          step: nextQuestion.step,
          title: nextQuestion.title,
          prompt: nextQuestion.prompt,
          priority: nextQuestion.priority,
          group: nextQuestion.group,
          groupLabel: groupLabel(nextQuestion.group),
        })
      : null,
    draft: compactObject({
      businessName: draftState.businessName,
      whatThisBusinessIs: draftState.description,
      websiteUrl: draftState.websiteUrl,
      coreServices: draftState.services,
      audience: draftState.audience,
      pricingPosture: draftState.pricingPosture,
      contactRoutes: draftState.contacts,
      humanHandoff: draftState.humanHandoff,
      languages: draftState.languages,
      tone: draftState.tone,
      hours: draftState.hours,
      greetingStyle: draftState.greetingStyle,
      afterHoursBehavior: draftState.afterHoursBehavior,
    }),
    aiBehavior: buildAiBehaviorPolicy(draftState),
    interviewPlan: buildInterviewPlan(questionCandidates, nextQuestion),
    confidence,
    recommendation: {
      notes: recommendations,
    },
    sourceSignals: {
      primarySourceType: sourceSignals.primarySourceType,
      primarySourceLabel: sourceSignals.primarySourceLabel,
      primarySourceUrl: sourceSignals.primarySourceUrl,
      primarySourceAuthorityClass: sourceSignals.primarySourceAuthorityClass,
      pageCount: sourceSignals.pageCount,
      sourceTypes: sourceSignals.sourceTypes,
      strongestEvidence: sourceSignals.strongestEvidence,
      discoveredPublicClaims: sourceSignals.discoveredPublicClaims,
      companyNameCandidates: sourceSignals.companyNameCandidates,
      descriptionCandidates: sourceSignals.descriptionCandidates,
      serviceCandidates: sourceSignals.serviceCandidates,
      contactCandidates: sourceSignals.contactCandidates,
      hoursCandidates: sourceSignals.hoursCandidates,
      pricingCandidates: sourceSignals.pricingCandidates,
      audienceCandidates: sourceSignals.audienceCandidates,
      languagesCandidates: sourceSignals.languagesCandidates,
    },
    readyForApproval,
    assistantMessage: buildConversationalAssistantMessage({
      phase,
      nextQuestion,
      draftState,
      confidence,
      recommendations,
      sourceSignals,
      readyForApproval,
    }),
  };
}

export function buildSetupAssistantFirstPrompt() {
  return {
    phase: "source_capture",
    assistantMessage:
      "Start with the best public source you have — website, Google Maps, Instagram, Facebook, or a short business note. I will first pull out what already looks real, then I will ask only the next thing that truly matters.",
    nextQuestion: {
      key: "source_capture",
      step: "source_capture",
      title: "Start with the best source",
      prompt:
        "Send the best public source you have first — website, Google Maps, Instagram, Facebook, or a short business note.",
      group: "business_truth",
      groupLabel: "Business truth",
    },
    interviewPlan: {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    aiBehavior: {},
    readyForApproval: false,
  };
}