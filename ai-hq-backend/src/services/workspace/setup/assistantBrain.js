import { arr, compactObject, lower, obj, s } from "./utils.js";

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))];
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
  const safe = uniqueStrings(items);
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
  return s(value)
    .replace(/\s+/g, " ")
    .trim();
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
    /(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(
      text
    ) ||
    /\b\d{1,2}[:.]\d{2}\b/.test(text) ||
    /\bclosed\b/.test(text) ||
    /\b24\/7\b/.test(text) ||
    /\bappointment\b/.test(text)
  );
}

function looksLikePricingText(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;
  return (
    /(azn|usd|eur|gbp|\$|€|₼|£)/.test(text) ||
    /\bprice\b/.test(text) ||
    /\bpricing\b/.test(text) ||
    /\bquote\b/.test(text) ||
    /\bfrom\b/.test(text) ||
    /\bstarting\b/.test(text)
  );
}

function looksLikeServiceJunk(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return true;
  if (looksLikeUrlOrDomain(text)) return true;
  if (looksLikeEmail(text)) return true;
  if (looksLikePhone(text)) return true;
  if (looksLikeHoursText(text)) return true;
  if (looksLikePricingText(text)) return true;

  const lowerText = text.toLowerCase();
  if (
    [
      "home",
      "about",
      "contact",
      "services",
      "pricing",
      "menu",
      "blog",
      "faq",
      "map",
      "instagram",
      "facebook",
      "google maps",
    ].includes(lowerText)
  ) {
    return true;
  }

  const wordCount = tokenize(text).length;
  if (!wordCount || wordCount > 8) return true;
  return false;
}

function looksLikeCompanyJunk(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return true;
  if (looksLikeUrlOrDomain(text)) return true;
  if (looksLikeEmail(text)) return true;

  const lowerText = text.toLowerCase();
  if (
    [
      "website",
      "instagram",
      "facebook",
      "google maps",
      "contact",
      "home",
      "about",
      "services",
    ].includes(lowerText)
  ) {
    return true;
  }

  return tokenize(text).length > 8;
}

function looksLikeDescriptionJunk(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return true;
  if (looksLikeUrlOrDomain(text)) return true;
  if (looksLikeEmail(text)) return true;
  if (looksLikePhone(text)) return true;

  const tokenCount = tokenize(text).length;
  return tokenCount < 4;
}

function looksLikeContactText(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return false;
  if (looksLikeEmail(text) || looksLikePhone(text)) return true;
  if (/whatsapp|telegram|wa\.me|contact|call|email/i.test(text)) return true;
  if (/instagram\.com|facebook\.com|m\.me/i.test(text)) return true;
  return false;
}

function sanitizeCompanyCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || looksLikeCompanyJunk(text)) return "";
  return text;
}

function sanitizeDescriptionCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || looksLikeDescriptionJunk(text)) return "";
  return text;
}

function sanitizeServiceCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || looksLikeServiceJunk(text)) return "";
  return text;
}

function sanitizeContactCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || !looksLikeContactText(text)) return "";
  return text;
}

function sanitizeHoursCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || !looksLikeHoursText(text)) return "";
  return text;
}

function sanitizePricingCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text || !looksLikePricingText(text)) return "";
  return text;
}

function sanitizeLanguageCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return "";
  const tokenCount = tokenize(text).length;
  if (!tokenCount || tokenCount > 4) return "";
  return text;
}

function sanitizeToneCandidate(value = "") {
  const text = normalizedCandidate(value);
  if (!text) return "";
  const tokenCount = tokenize(text).length;
  if (!tokenCount || tokenCount > 8) return "";
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
    const current = scores.get(sanitized);
    current.score += Math.max(1, weight);
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

  const greetingCandidates = weightedUniqueStrings(
    [
      { value: draftAssistantState.greeting, weight: 2 },
      { value: draftAssistantState.greetingStyle, weight: 2 },
      { value: draftAssistantState.openingStyle, weight: 2 },
      { value: reviewAssistantState.greeting, weight: 2 },
      { value: reviewAssistantState.greetingStyle, weight: 2 },
      { value: reviewAssistantState.openingStyle, weight: 2 },
    ],
    sanitizeToneCandidate
  );

  const afterHoursCandidates = weightedUniqueStrings(
    [
      { value: draftAssistantState.afterHours, weight: 2 },
      { value: draftAssistantState.afterHoursBehavior, weight: 2 },
      { value: draftAssistantState.afterHoursReply, weight: 2 },
      { value: reviewAssistantState.afterHours, weight: 2 },
      { value: reviewAssistantState.afterHoursBehavior, weight: 2 },
      { value: reviewAssistantState.afterHoursReply, weight: 2 },
    ],
    sanitizeDescriptionCandidate
  );

  return {
    greetingCandidates,
    afterHoursCandidates,
  };
}

function buildSourceSignals({ session = {}, draft = {}, sources = [], review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceSummary = obj(draft.sourceSummary);
  const assistantState = obj(draft.assistantState);
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
      sourceUrl: s(item.sourceUrl || item.url),
      sourceAuthorityClass: s(item.sourceAuthorityClass),
    })
  );

  const primarySource =
    obj(sourceSignalSummary.primarySource).sourceType || obj(sourceSignalSummary.primarySource).sourceUrl
      ? obj(sourceSignalSummary.primarySource)
      : sourceRows.find((item) => lower(item.role) === "primary") || sourceRows[0] || {};

  const websiteUrl =
    s(businessProfile.websiteUrl) ||
    s(reviewDraft.businessProfile?.websiteUrl) ||
    s(sourceSummary.primarySourceUrl) ||
    s(primarySource.sourceUrl);

  const primaryAuthorityWeight = sourceAuthorityWeight(
    primarySource.sourceAuthorityClass
  );

  const companyNameCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.companyName?.observedValue, weight: 7 },
      { value: reviewFieldProvenance.displayName?.observedValue, weight: 7 },
      { value: sourceSummary.businessName, weight: 6 },
      { value: session.businessName, weight: 5 },
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
      { value: reviewFieldProvenance.description?.observedValue, weight: 7 },
      { value: reviewFieldProvenance.companySummaryShort?.observedValue, weight: 7 },
      { value: businessProfile.companySummaryShort, weight: 3 },
      { value: businessProfile.companySummary, weight: 3 },
      { value: reviewDraft.businessProfile?.description, weight: 2 },
    ],
    sanitizeDescriptionCandidate
  );

  const serviceCandidates = weightedUniqueStrings(
    [
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 5,
      })),
      ...arr(reviewFieldProvenance.services?.observedValues).map((value) => ({
        value,
        weight: 6,
      })),
      ...(s(reviewFieldProvenance.services?.observedValue)
        ? [{ value: reviewFieldProvenance.services?.observedValue, weight: 5 }]
        : []),
      ...arr(websiteKnowledge.topPages).map((item) => ({
        value: s(item.title),
        weight: 2,
      })),
      ...sourceRows.map((item) => ({
        value: item.label,
        weight: 1,
      })),
    ],
    sanitizeServiceCandidate
  );

  const contactCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.primaryPhone?.observedValue, weight: 7 },
      { value: reviewFieldProvenance.primaryEmail?.observedValue, weight: 7 },
      { value: reviewFieldProvenance.primaryAddress?.observedValue, weight: 5 },
      ...sourceRows.flatMap((item) => [
        { value: item.label, weight: 1 },
        { value: item.sourceUrl, weight: 1 },
      ]),
    ],
    sanitizeContactCandidate
  );

  const hoursCandidates = weightedUniqueStrings(
    [
      ...(s(reviewFieldProvenance.hours?.observedValue)
        ? [{ value: reviewFieldProvenance.hours?.observedValue, weight: 7 }]
        : []),
      ...(s(reviewFieldProvenance.businessHours?.observedValue)
        ? [{ value: reviewFieldProvenance.businessHours?.observedValue, weight: 7 }]
        : []),
      ...(s(reviewFieldProvenance.openingHours?.observedValue)
        ? [{ value: reviewFieldProvenance.openingHours?.observedValue, weight: 7 }]
        : []),
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizeHoursCandidate
  );

  const pricingCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.pricingHints?.observedValue, weight: 7 },
      { value: reviewFieldProvenance.pricingPolicy?.observedValue, weight: 7 },
      ...(s(reviewFieldProvenance.price?.observedValue)
        ? [{ value: reviewFieldProvenance.price?.observedValue, weight: 6 }]
        : []),
      ...arr(sourceSignalSummary.discoveredPublicClaims).map((value) => ({
        value,
        weight: 1,
      })),
    ],
    sanitizePricingCandidate
  );

  const handoffCandidates = weightedUniqueStrings(
    [
      { value: reviewDraft.handoffRules?.summary, weight: 2 },
      ...arr(reviewDraft.handoffRules?.triggers).map((value) => ({
        value,
        weight: 2,
      })),
    ],
    sanitizeDescriptionCandidate
  );

  const audienceCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.targetAudience?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.audience?.observedValue, weight: 6 },
      { value: reviewDraft.businessProfile?.targetAudience, weight: 2 },
      { value: reviewDraft.businessProfile?.audience, weight: 2 },
    ],
    sanitizeDescriptionCandidate
  );

  const languagesCandidates = weightedUniqueStrings(
    [
      { value: reviewFieldProvenance.language?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.mainLanguage?.observedValue, weight: 6 },
      { value: reviewFieldProvenance.primaryLanguage?.observedValue, weight: 6 },
    ],
    sanitizeLanguageCandidate
  );

  const toneCandidates = weightedUniqueStrings(
    [
      { value: reviewDraft.businessProfile?.brandTone, weight: 2 },
      { value: reviewDraft.businessProfile?.tone, weight: 2 },
    ],
    sanitizeToneCandidate
  );

  const sourceTypes = uniqueStrings(
    sourceSignalSummary.sourceTypes?.length
      ? sourceSignalSummary.sourceTypes
      : sourceRows.map((item) => item.sourceType)
  );

  const strongestEvidence = uniqueStrings([
    primarySource.sourceUrl
      ? `${sourceTypeLabel(primarySource.sourceType)} source: ${primarySource.sourceUrl}`
      : "",
    Number(sourceSignalSummary.website?.pageCount || websiteKnowledge.pageCount || 0) > 0
      ? `Website pages analyzed: ${Number(
          sourceSignalSummary.website?.pageCount || websiteKnowledge.pageCount || 0
        )}`
      : "",
    topCandidate(companyNameCandidates)
      ? `Source suggests business name: ${topCandidate(companyNameCandidates)}`
      : "",
    serviceCandidates.length
      ? `Source service signals: ${listPreview(serviceCandidates, 4)}`
      : "",
    contactCandidates.length
      ? `Source contact signals: ${listPreview(contactCandidates, 3)}`
      : "",
    hoursCandidates.length
      ? `Source hours signals: ${listPreview(hoursCandidates, 2)}`
      : "",
    pricingCandidates.length
      ? `Source pricing signals: ${listPreview(pricingCandidates, 2)}`
      : "",
  ]);

  return {
    sourceRows,
    primarySourceType: s(primarySource.sourceType || session.primarySourceType),
    primarySourceLabel:
      s(primarySource.label) || sourceTypeLabel(primarySource.sourceType),
    primarySourceUrl: s(primarySource.sourceUrl || websiteUrl),
    primarySourceAuthorityClass: s(primarySource.sourceAuthorityClass),
    sourceTypes,
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
    handoffCandidates,
    audienceCandidates,
    languagesCandidates,
    toneCandidates,
    greetingCandidates: behaviorSignals.greetingCandidates,
    afterHoursCandidates: behaviorSignals.afterHoursCandidates,
  };
}

function buildDraftState({ draft = {}, review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const draftAssistantState = obj(draft.assistantState);
  const reviewAssistantState = obj(reviewDraft.assistantState);

  const mergedProfile = {
    ...obj(reviewDraft.businessProfile),
    ...businessProfile,
  };

  const services = uniqueStrings([
    ...arr(reviewDraft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
  ]).filter((value) => !looksLikeServiceJunk(value));

  const contacts = uniqueStrings([
    mergedProfile.primaryPhone,
    mergedProfile.primaryEmail,
    mergedProfile.primaryAddress,
    ...arr(reviewDraft.contacts).map((item) => s(item.label || item.value || item.channel)),
    ...arr(draft.contacts).map((item) => s(item.label || item.value || item.channel)),
  ]).filter((value) => sanitizeContactCandidate(value));

  const hours = uniqueStrings([
    ...arr(mergedProfile.hours),
    ...arr(draft.hours).map((item) => {
      if (item?.allDay) return `${item.day} 24 hours`;
      if (item?.appointmentOnly) return `${item.day} appointment only`;
      if (item?.closed) return `${item.day} closed`;
      if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
      if (s(item?.openTime) || s(item?.closeTime)) {
        return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
      }
      return "";
    }),
  ]).filter((value) => sanitizeHoursCandidate(value));

  const languages = uniqueStrings([
    ...arr(mergedProfile.supportedLanguages),
    ...arr(mergedProfile.languages),
  ]).filter((value) => sanitizeLanguageCandidate(value));

  return {
    businessName: s(mergedProfile.companyName || mergedProfile.displayName),
    description: s(
      mergedProfile.description ||
        mergedProfile.companySummaryShort ||
        mergedProfile.companySummary
    ),
    websiteUrl: s(mergedProfile.websiteUrl),
    services,
    audience: s(
      mergedProfile.targetAudience ||
        mergedProfile.audience ||
        mergedProfile.customerType ||
        mergedProfile.customerTypes
    ),
    pricingPosture: s(
      mergedProfile.pricingPolicy ||
        draft.pricingPosture?.publicSummary ||
        draft.pricingPosture?.note ||
        draft.pricingPosture?.summary
    ),
    contacts,
    hours,
    humanHandoff: s(
      draft.handoffRules?.summary || arr(draft.handoffRules?.triggers).join(", ")
    ),
    languages,
    tone: s(mergedProfile.brandTone || mergedProfile.tone),
    greetingStyle: s(
      draftAssistantState.greeting ||
        draftAssistantState.greetingStyle ||
        draftAssistantState.openingStyle ||
        reviewAssistantState.greeting ||
        reviewAssistantState.greetingStyle ||
        reviewAssistantState.openingStyle
    ),
    afterHoursBehavior: s(
      draftAssistantState.afterHours ||
        draftAssistantState.afterHoursBehavior ||
        draftAssistantState.afterHoursReply ||
        reviewAssistantState.afterHours ||
        reviewAssistantState.afterHoursBehavior ||
        reviewAssistantState.afterHoursReply
    ),
  };
}

function detectContradictions({ draftState, sourceSignals }) {
  const contradictions = [];

  const sourceName = topCandidate(sourceSignals.companyNameCandidates);
  const sourceWebsiteHost = urlHost(sourceSignals.primarySourceUrl);
  const draftWebsiteHost = urlHost(draftState.websiteUrl);

  if (
    draftState.businessName &&
    sourceName &&
    overlapScore(draftState.businessName, sourceName) < 0.4
  ) {
    contradictions.push({
      key: "business_name_conflict",
      severity: "high",
      message: `Source-larda biznes adı "${sourceName}" kimi görünür, amma draft "${draftState.businessName}" deyir.`,
    });
  }

  if (draftWebsiteHost && sourceWebsiteHost && draftWebsiteHost !== sourceWebsiteHost) {
    contradictions.push({
      key: "website_conflict",
      severity: "high",
      message: `Draft website "${draftWebsiteHost}" kimi görünür, əsas source isə "${sourceWebsiteHost}" göstərir.`,
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
          "Draft xidmətləri ilə source-lardan çıxan xidmət siqnalları arasında güclü uyğunluq görünmür.",
      });
    }
  }

  if (draftState.contacts.length && sourceSignals.contactCandidates.length) {
    const contactOverlap = draftState.contacts.some((contact) =>
      sourceSignals.contactCandidates.some(
        (candidate) => overlapScore(contact, candidate) >= 0.45
      )
    );

    if (!contactOverlap) {
      contradictions.push({
        key: "contact_conflict",
        severity: "medium",
        message:
          "Draft contact marşrutu ilə source-lardan görünən əlaqə siqnalları üst-üstə düşmür.",
      });
    }
  }

  if (draftState.hours.length && sourceSignals.hoursCandidates.length) {
    const hoursOverlap = draftState.hours.some((item) =>
      sourceSignals.hoursCandidates.some(
        (candidate) => overlapScore(item, candidate) >= 0.35
      )
    );

    if (!hoursOverlap) {
      contradictions.push({
        key: "hours_conflict",
        severity: "low",
        message:
          "Draft iş saatları ilə source-lardan görünən saat siqnalları tam oturmur.",
      });
    }
  }

  return contradictions;
}

function buildConfidenceBuckets({ draftState, sourceSignals, contradictions }) {
  const strong = [];
  const unclear = [];

  if (draftState.businessName) {
    strong.push(`Biznes adı draftda var: ${draftState.businessName}`);
  } else if (topCandidate(sourceSignals.companyNameCandidates)) {
    unclear.push(
      `Source biznes adı kimi "${topCandidate(
        sourceSignals.companyNameCandidates
      )}" göstərir, amma bu hələ təsdiqlənməyib.`
    );
  } else {
    unclear.push("Biznes adı hələ dəqiq deyil.");
  }

  if (draftState.description) {
    strong.push("Biznesin qısa təqdimatı draftda var.");
  } else if (topCandidate(sourceSignals.descriptionCandidates)) {
    unclear.push("Source-larda təqdimat siqnalı var, amma hələ operator tərəfindən təsdiqlənməyib.");
  } else {
    unclear.push("Biznesin qısa təqdimatı hələ aydın deyil.");
  }

  if (draftState.services.length) {
    strong.push(`Əsas xidmətlər draftda var: ${listPreview(draftState.services, 4)}`);
  } else if (sourceSignals.serviceCandidates.length >= 2) {
    unclear.push(
      `Source xidmət siqnalları verir: ${listPreview(sourceSignals.serviceCandidates, 4)}.`
    );
  } else {
    unclear.push("Əsas xidmətlər hələ təsdiqlənməyib.");
  }

  if (draftState.contacts.length) {
    strong.push("Əsas əlaqə/booking marşrutu draftda var.");
  } else if (sourceSignals.contactCandidates.length) {
    unclear.push(
      `Source əlaqə siqnalları verir: ${listPreview(sourceSignals.contactCandidates, 3)}.`
    );
  } else {
    unclear.push("Müştərinin hara yönləndiriləcəyi hələ aydın deyil.");
  }

  if (draftState.pricingPosture) {
    strong.push("Qiymət təqdimatı draftda müəyyənləşib.");
  } else if (sourceSignals.pricingCandidates.length) {
    unclear.push(
      `Qiymətə aid source siqnalları var: ${listPreview(sourceSignals.pricingCandidates, 2)}.`
    );
  } else {
    unclear.push("Qiymət siyasətinin necə təqdim olunacağı hələ aydın deyil.");
  }

  if (draftState.humanHandoff) {
    strong.push("İnsana ötürmə qaydası draftda formalaşıb.");
  } else {
    unclear.push("AI-nin hansı hallarda insana ötürəcəyi hələ müəyyənləşməyib.");
  }

  if (draftState.hours.length) {
    strong.push("İş/cavab saatları draftda görünür.");
  } else if (sourceSignals.hoursCandidates.length) {
    unclear.push("Source iş saatı siqnalı verir, amma hələ təsdiqlənməyib.");
  } else {
    unclear.push("İş və ya cavab saatları hələ aydın deyil.");
  }

  if (draftState.languages.length) {
    strong.push(`İşləmə dilləri draftda var: ${listPreview(draftState.languages, 3)}`);
  } else if (sourceSignals.languagesCandidates.length) {
    unclear.push(
      `Source dil siqnalı verir: ${listPreview(sourceSignals.languagesCandidates, 3)}.`
    );
  } else {
    unclear.push("AI-nin hansı dillərdə işləyəcəyi hələ dəqiq deyil.");
  }

  if (draftState.tone) {
    strong.push("AI tonu draftda formalaşıb.");
  } else {
    unclear.push("AI tonu hələ dəqiq formalaşmayıb.");
  }

  if (draftState.greetingStyle) {
    strong.push("Açılış davranışı draftda görünür.");
  } else {
    unclear.push("AI-nin söhbətə necə başlayacağı hələ aydın deyil.");
  }

  if (draftState.afterHoursBehavior) {
    strong.push("İş saatından kənar davranış draftda formalaşıb.");
  } else {
    unclear.push("İş saatından kənar cavab qaydası hələ müəyyənləşməyib.");
  }

  if (
    sourceSignals.primarySourceType === "website" &&
    sourceSignals.pageCount >= 3
  ) {
    strong.push(
      `Website source kifayət qədər siqnal verib (${sourceSignals.pageCount} səhifə).`
    );
  }

  if (sourceSignals.strongestEvidence.length) {
    strong.push("Source-lardan konkret dəlillər çıxarılıb.");
  }

  return {
    strong,
    unclear,
    contradictions: contradictions.map((item) => item.message),
  };
}

function buildRecommendation({ draftState, sourceSignals, contradictions }) {
  const notes = [];

  if (sourceSignals.primarySourceType === "website" && sourceSignals.pageCount < 2) {
    notes.push(
      "Website siqnalı zəifdirsə, system həmin source-a həddindən artıq güvənməməlidir."
    );
  }

  if (!draftState.services.length && sourceSignals.serviceCandidates.length >= 2) {
    notes.push(
      "Source xidmət siqnalları var, amma onları birbaşa truth kimi yox, operator təsdiqi kimi götürmək daha doğrudur."
    );
  }

  if (!draftState.pricingPosture) {
    notes.push(
      "Qiymət hissəsi dəqiq deyilsə, AI sərt rəqəm vermək əvəzinə operatora və ya sorğuya yönləndirməlidir."
    );
  }

  if (!draftState.humanHandoff) {
    notes.push(
      "Şikayət, fərdi qiymət, təcili hal və ödəniş mövzuları üçün ayrıca handoff qaydası lazımdır."
    );
  }

  if (!draftState.contacts.length) {
    notes.push(
      "Booking və ya əlaqə marşrutu olmadan AI son addımda zəif görünəcək; bir əsas kontakt yolu mütləq lazımdır."
    );
  }

  if (!draftState.hours.length && sourceSignals.primarySourceType === "google_maps") {
    notes.push(
      "Google Maps source varsa, iş saatlarını ayrıca təsdiqləmək daha təhlükəsizdir."
    );
  }

  if (!draftState.languages.length) {
    notes.push(
      "AI və voice receptionist üçün dil seçimi ayrıca dəqiqləşdirilməlidir."
    );
  }

  if (!draftState.tone) {
    notes.push(
      "Brand tonu göstərilməyibsə, sistem default olaraq qısa, aydın və professional tonla işləməlidir."
    );
  }

  if (!draftState.greetingStyle) {
    notes.push(
      "AI ilk cavabda qısa salam verib birbaşa kömək mövzusuna keçməlidir; greeting ayrıca formalaşdırılmalıdır."
    );
  }

  if (!draftState.afterHoursBehavior) {
    notes.push(
      "İş saatından kənar yazan və ya zəng edən istifadəçi üçün ayrıca after-hours cavab qaydası lazımdır."
    );
  }

  if (contradictions.length) {
    notes.push(
      "Source ilə draft arasında uyğunsuzluq var; təsdiqdən əvvəl bunları bağlamaq daha doğrudur."
    );
  }

  return notes;
}

function buildConfirmQuestion({
  key,
  step,
  title,
  group = "business_truth",
  candidate = "",
  fallbackPrompt = "",
  sourceLabel = "",
}) {
  const prompt = candidate
    ? `${sourceLabel ? `${sourceLabel} ` : "Source "}bu məlumatı göstərir: "${candidate}". Doğrudursa təsdiqlə, deyilsə düz yaz.`
    : fallbackPrompt;

  return {
    key,
    step,
    title,
    group,
    prompt,
  };
}

function buildQuestionCandidates({ draftState, sourceSignals, contradictions }) {
  const candidates = [];
  const primarySourceLabel =
    sourceSignals.primarySourceLabel || sourceTypeLabel(sourceSignals.primarySourceType);

  const companyNameCandidate = topCandidate(sourceSignals.companyNameCandidates);
  const descriptionCandidate = topCandidate(sourceSignals.descriptionCandidates);
  const contactCandidate = topCandidate(sourceSignals.contactCandidates);
  const hoursCandidate = topCandidate(sourceSignals.hoursCandidates);
  const pricingCandidate = topCandidate(sourceSignals.pricingCandidates);

  const businessNameConflict = contradictions.find(
    (item) => item.key === "business_name_conflict"
  );
  if (businessNameConflict) {
    candidates.push({
      key: "business_name_conflict",
      step: "company",
      title: "Business name",
      group: "business_truth",
      prompt: businessNameConflict.message,
      priority: 100,
    });
  }

  const websiteConflict = contradictions.find((item) => item.key === "website_conflict");
  if (websiteConflict) {
    candidates.push({
      key: "website_conflict",
      step: "website",
      title: "Main website",
      group: "business_truth",
      prompt: websiteConflict.message,
      priority: 98,
    });
  }

  const servicesConflict = contradictions.find((item) => item.key === "services_conflict");
  if (servicesConflict) {
    candidates.push({
      key: "services_conflict",
      step: "services",
      title: "Core services",
      group: "business_truth",
      prompt: servicesConflict.message,
      priority: 96,
    });
  }

  const contactConflict = contradictions.find((item) => item.key === "contact_conflict");
  if (contactConflict) {
    candidates.push({
      key: "contact_conflict",
      step: "contacts",
      title: "Contact route",
      group: "business_truth",
      prompt: contactConflict.message,
      priority: 94,
    });
  }

  if (!draftState.businessName) {
    candidates.push({
      key: "business_name",
      step: "company",
      title: "Business name",
      group: "business_truth",
      prompt: companyNameCandidate
        ? buildConfirmQuestion({
            key: "business_name",
            step: "company",
            title: "Business name",
            candidate: companyNameCandidate,
            sourceLabel: primarySourceLabel,
          }).prompt
        : "Biznesin adı necə görünməlidir?",
      priority: 90,
    });
  }

  if (!draftState.description) {
    candidates.push({
      key: "positioning",
      step: "description",
      title: "What the business is",
      group: "business_truth",
      prompt: descriptionCandidate
        ? buildConfirmQuestion({
            key: "positioning",
            step: "description",
            title: "What the business is",
            candidate: descriptionCandidate,
            sourceLabel: primarySourceLabel,
          }).prompt
        : "Bu biznesi bir-iki cümlə ilə necə təqdim etməliyəm?",
      priority: 88,
    });
  }

  if (!draftState.services.length) {
    candidates.push({
      key: "services",
      step: "services",
      title: "Core services",
      group: "business_truth",
      prompt: sourceSignals.serviceCandidates.length >= 2
        ? `Source xidmət siqnalları göstərir: ${listPreview(
            sourceSignals.serviceCandidates,
            5
          )}. Hansıları əsas xidmət kimi saxlamalıyam?`
        : "Əsas xidmətləri yaz.",
      priority: 86,
    });
  }

  if (!draftState.contacts.length) {
    candidates.push({
      key: "contact_route",
      step: "contacts",
      title: "Primary conversion route",
      group: "business_truth",
      prompt: contactCandidate
        ? `Source əlaqə siqnalı göstərir: ${contactCandidate}. Müştəri üçün əsas əlaqə marşrutu budursa təsdiqlə, deyilsə düz yaz.`
        : "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
      priority: 84,
    });
  }

  const hoursNeeded =
    sourceSignals.primarySourceType === "google_maps" ||
    sourceSignals.hoursCandidates.length > 0;

  if (!draftState.hours.length && hoursNeeded) {
    candidates.push({
      key: "availability",
      step: "hours",
      title: "Hours",
      group: "business_truth",
      prompt: hoursCandidate
        ? `Source iş saatı siqnalı göstərir: ${hoursCandidate}. Doğrudursa təsdiqlə, deyilsə düz saatları yaz.`
        : "İş və ya cavab saatları necə göstərilməlidir?",
      priority: 82,
    });
  }

  if (!draftState.pricingPosture) {
    candidates.push({
      key: "pricing_posture",
      step: "pricing",
      title: "Pricing posture",
      group: "business_truth",
      prompt: pricingCandidate
        ? `Source qiymət siqnalı göstərir: ${pricingCandidate}. AI bunu necə təqdim etməlidir?`
        : "Qiymət necə təqdim olunmalıdır? AI birbaşa rəqəm desin, yoxsa sorğuya/operatora yönləndirsin?",
      priority: 80,
    });
  }

  if (!draftState.humanHandoff) {
    candidates.push({
      key: "handoff_rules",
      step: "handoff",
      title: "Human handoff",
      group: "ai_behavior",
      prompt: "AI hansı hallarda mütləq insana ötürməlidir?",
      priority: 78,
    });
  }

  if (!draftState.languages.length) {
    candidates.push({
      key: "languages",
      step: "profile",
      title: "Languages",
      group: "ai_behavior",
      prompt: sourceSignals.languagesCandidates.length
        ? `Source dil siqnalı göstərir: ${listPreview(
            sourceSignals.languagesCandidates,
            3
          )}. AI hansı dillərdə işləsin?`
        : "AI hansı dillərdə danışmalıdır?",
      priority: 76,
    });
  }

  if (!draftState.tone) {
    candidates.push({
      key: "tone",
      step: "profile",
      title: "Tone",
      group: "ai_behavior",
      prompt:
        "AI-nin tonu necə olmalıdır? (premium, mehriban, qısa, satış yönümlü və s.)",
      priority: 74,
    });
  }

  if (!draftState.greetingStyle) {
    candidates.push({
      key: "greeting",
      step: "profile",
      title: "Opening style",
      group: "ai_behavior",
      prompt:
        "AI söhbətə necə başlamalıdır? Qısa qarşılamanı necə hiss etdirmək istəyirsən?",
      priority: 72,
    });
  }

  if (!draftState.afterHoursBehavior) {
    candidates.push({
      key: "after_hours",
      step: "handoff",
      title: "After-hours behavior",
      group: "ai_behavior",
      prompt:
        "İş saatından kənar yazan və ya zəng edən istifadəçiyə AI necə cavab verməlidir?",
      priority: 70,
    });
  }

  if (!draftState.audience) {
    candidates.push({
      key: "audience",
      step: "profile",
      title: "Audience",
      group: "business_truth",
      prompt: "Əsasən kimlərə xidmət göstərirsiniz?",
      priority: 68,
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

function buildAssistantMessage({
  phase,
  nextQuestion,
  draftState,
  confidence,
  recommendations,
  sourceSignals,
}) {
  if (phase === "interview" && nextQuestion) {
    const evidenceLine = sourceSignals.strongestEvidence.length
      ? `\n\nSource evidence:\n- ${sourceSignals.strongestEvidence.slice(0, 3).join("\n- ")}`
      : "";
    return `${nextQuestion.prompt}${evidenceLine}`;
  }

  const draftLines = [
    draftState.businessName ? `Business name: ${draftState.businessName}` : "",
    draftState.description ? `What this business is: ${draftState.description}` : "",
    draftState.services.length
      ? `Core services: ${listPreview(draftState.services, 6)}`
      : "",
    draftState.audience ? `Audience: ${draftState.audience}` : "",
    draftState.pricingPosture ? `Pricing posture: ${draftState.pricingPosture}` : "",
    draftState.contacts.length
      ? `Contact routes: ${listPreview(draftState.contacts, 6)}`
      : "",
    draftState.hours.length
      ? `Availability: ${listPreview(draftState.hours, 4)}`
      : "",
    draftState.humanHandoff ? `Human handoff: ${draftState.humanHandoff}` : "",
    draftState.languages.length
      ? `Languages: ${listPreview(draftState.languages, 4)}`
      : "",
    draftState.tone ? `Tone: ${draftState.tone}` : "",
    draftState.greetingStyle ? `Opening style: ${draftState.greetingStyle}` : "",
    draftState.afterHoursBehavior
      ? `After-hours behavior: ${draftState.afterHoursBehavior}`
      : "",
  ].filter(Boolean);

  const guidance = [
    confidence.strong.length
      ? `What I’m confident about:\n- ${confidence.strong.join("\n- ")}`
      : "",
    confidence.unclear.length
      ? `What still looks unclear:\n- ${confidence.unclear.join("\n- ")}`
      : "",
    confidence.contradictions.length
      ? `What may be inconsistent:\n- ${confidence.contradictions.join("\n- ")}`
      : "",
    recommendations.length
      ? `My recommendation:\n- ${recommendations.join("\n- ")}`
      : "",
  ].filter(Boolean);

  return [draftLines.join("\n"), guidance.join("\n\n")]
    .filter(Boolean)
    .join("\n\n");
}

export function buildSetupAssistantBrainState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSourceSignals({ session, draft, sources, review });
  const draftState = buildDraftState({ draft, review });
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
  const blockingContradictions = contradictions.filter(
    (item) => lower(item.severity) !== "low"
  );

  const readyForApproval =
    !nextQuestion &&
    !blockingContradictions.length &&
    Boolean(
      draftState.businessName &&
        draftState.description &&
        draftState.services.length &&
        draftState.contacts.length &&
        draftState.pricingPosture &&
        draftState.humanHandoff &&
        draftState.languages.length &&
        draftState.tone &&
        draftState.greetingStyle &&
        draftState.afterHoursBehavior
    );

  const phase = readyForApproval ? "ready" : "interview";

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
    assistantMessage: buildAssistantMessage({
      phase,
      nextQuestion,
      draftState,
      confidence,
      recommendations,
      sourceSignals,
    }),
  };
}

export function buildSetupAssistantFirstPrompt() {
  return {
    phase: "source_capture",
    assistantMessage:
      "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)",
    nextQuestion: {
      key: "source_capture",
      step: "source_capture",
      title: "Source",
      prompt:
        "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)",
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