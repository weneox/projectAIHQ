import { arr, compactDraftObject, obj, s } from "../draftShared.js";

function uniqueStrings(items = [], limit = 24) {
  return Array.from(
    new Set(
      arr(items)
        .map((item) => s(item))
        .filter(Boolean)
        .slice(0, limit)
    )
  ).slice(0, limit);
}

function firstText(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function isEmail(value = "") {
  return /@/.test(s(value));
}

function isUrlLike(value = "") {
  const text = s(value).toLowerCase();
  if (!text) return false;
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("www.")
  );
}

function isPhoneLike(value = "") {
  const text = s(value);
  if (!text) return false;

  const digits = text.replace(/\D/g, "");
  if (digits.length < 7) return false;
  if (isEmail(text)) return false;
  if (isUrlLike(text)) return false;

  return /(?:\+|[0-9])/.test(text);
}

function normalizeUrl(value = "") {
  const text = s(value);
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;

  return text;
}

function pickContactRouteValue(routes = [], matcher = () => false) {
  return s(arr(routes).find((item) => matcher(s(item))) || "");
}

function pickLikelyAddress(items = []) {
  for (const item of arr(items)) {
    const text = s(item);
    if (!text) continue;
    if (isPhoneLike(text)) continue;
    if (isEmail(text)) continue;
    if (isUrlLike(text)) continue;

    if (
      /küçə|kuce|prospekt|pr\.|ave|avenue|street|st\.|road|rd\.|blvd|boulevard|lane|ln\.|address|ünvan|unvan|baku|bakı|azərbaycan|azerbaijan/i.test(
        text
      )
    ) {
      return text;
    }
  }

  return "";
}

) {
  const policy = obj(behavior.greetingPolicy);
  const platformDefaults = obj(behavior.platformDefaults);

  return [
    s(policy.mode || platformDefaults.greetingMode),
    s(policy.openingLine),
    s(policy.followupLeadIn),
  ]
    .filter(Boolean)
    .join(" • ");
}

) {
  const policy = obj(behavior.closingPolicy);
  const platformDefaults = obj(behavior.platformDefaults);

  return [
    s(policy.mode || platformDefaults.closingMode),
    s(policy.closingLine),
    policy.includeNextStepPrompt === false ? "no next-step prompt" : "",
    policy.includeHumanOfferWhenRelevant === false ? "no human-offer hint" : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

) {
  const policy = obj(behavior.tonePolicy);
  const platformDefaults = obj(behavior.platformDefaults);

  return [
    s(policy.mode || platformDefaults.toneMode),
    s(policy.messageLength || platformDefaults.messageLength),
    s(policy.empathyLevel || platformDefaults.empathyLevel),
    policy.shouldSoundPremium === true ? "premium" : "",
    policy.shouldSoundLocalFriendly === true ? "local-friendly" : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

) {
  const safePolicy = obj(policy);

  if (policyKey === "pricing") {
    return [
      s(safePolicy.mode),
      safePolicy.preferredTargetUrl
        ? `target: ${safePolicy.preferredTargetUrl}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "location") {
    return [
      s(safePolicy.mode),
      safePolicy.preferredTargetUrl
        ? `map: ${safePolicy.preferredTargetUrl}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "booking") {
    return [
      s(safePolicy.mode),
      safePolicy.preferredTargetUrl
        ? `target: ${safePolicy.preferredTargetUrl}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "contact") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredChannel),
      safePolicy.preferredTargetUrl
        ? `target: ${safePolicy.preferredTargetUrl}`
        : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "handoff") {
    return [
      s(safePolicy.mode),
      safePolicy.requiresReason === true ? "requires reason" : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return "";
}

function buildCompatDraftView(assistant = {}) {
  const userDraft = obj(assistant.draft);
  const reviewDraft = obj(assistant.reviewDraft);
  const sourceSignals = obj(assistant.sourceSignals);
  const recommendation = obj(assistant.recommendation);
  const confidence = obj(assistant.confidence);
  const contactRoutes = uniqueStrings(
    [
      ...arr(userDraft.contactRoutes),
      ...arr(reviewDraft.contactRoutes),
      ...arr(sourceSignals.contactCandidates),
    ],
    24
  );

  const services = uniqueStrings(
    [
      ...arr(userDraft.coreServices),
      ...arr(reviewDraft.coreServices),
      ...arr(sourceSignals.serviceCandidates),
    ],
    24
  );

  const hours = uniqueStrings(
    [
      ...arr(userDraft.hours),
      ...arr(reviewDraft.workingHoursLines),
      ...arr(sourceSignals.hoursCandidates),
    ],
    24
  );

  const languages = uniqueStrings(
    [
      ...arr(userDraft.languages),
      ...arr(reviewDraft.languages),
      ...arr(aiBehavior.languages),
      ...arr(sourceSignals.languagesCandidates),
    ],
    12
  );

  const websiteUrl = normalizeUrl(
    firstText(
      userDraft.websiteUrl,
      reviewDraft.websiteUrl,
      sourceSignals.primarySourceType === "website"
        ? sourceSignals.primarySourceUrl
        : "",
      isUrlLike(contactRoutes.find((item) => !/@/.test(s(item)))) &&
        !/wa\.me|instagram\.com|facebook\.com|t\.me|telegram\.me/i.test(
          contactRoutes.find((item) => !/@/.test(s(item))) || ""
        )
        ? contactRoutes.find((item) => !/@/.test(s(item)))
        : ""
    )
  );

  const businessName = firstText(
    userDraft.businessName,
    reviewDraft.businessName,
    arr(sourceSignals.companyNameCandidates)[0]
  );

  const businessDescription = firstText(
    userDraft.businessDescription,
    userDraft.whatThisBusinessIs,
    reviewDraft.businessDescription,
    arr(sourceSignals.descriptionCandidates)[0]
  );

  const pricingSummary = firstText(
    userDraft.pricingSummary,
    userDraft.pricingPosture,
    reviewDraft.pricingSummary,
    arr(sourceSignals.pricingCandidates)[0]
  );

  const primaryPhone = pickContactRouteValue(contactRoutes, (value) =>
    isPhoneLike(value)
  );

  const primaryEmail = pickContactRouteValue(contactRoutes, (value) =>
    isEmail(value)
  );

  const primaryAddress = firstText(
    reviewDraft.primaryAddress,
    pickLikelyAddress(contactRoutes)
  );

  const reasoningSummary = uniqueStrings(arr(recommendation.notes), 12).join(" ");



  return {
    businessName,
    businessDescription,
    websiteUrl,
    services,
    contactRoutes,
    hours,
    pricingSummary,
    primaryPhone,
    primaryEmail,
    primaryAddress,
    languages,
    reasoningSummary,
    unclear: arr(confidence.unclear),
  };
}

export function buildAssistantCompatQuestion(assistant = {}) {
  const nextQuestion = obj(assistant.nextQuestion);
  if (!s(nextQuestion.key) || !s(nextQuestion.prompt)) return null;

  return compactDraftObject({
    key: s(nextQuestion.key).toLowerCase(),
    questionKey: s(nextQuestion.key).toLowerCase(),
    question: s(nextQuestion.prompt),
    title: s(nextQuestion.title),
    prompt: s(nextQuestion.prompt),
    category: s(nextQuestion.group || "business_truth"),
    group: s(nextQuestion.group || "business_truth"),
    groupLabel: s(nextQuestion.groupLabel || "Business truth"),
    priority: Number(nextQuestion.priority || 0),
    totalRemainingQuestions: arr(obj(assistant.interviewPlan).activeQuestions)
      .length,
  });
}

export function buildAssistantCompatFollowupQueue(assistant = {}) {
  const nextKey = s(obj(assistant.nextQuestion).key).toLowerCase();

  return arr(obj(assistant.interviewPlan).activeQuestions)
    .filter(
      (item) =>
        s(item.key).toLowerCase() && s(item.key).toLowerCase() !== nextKey
    )
    .map((item) =>
      compactDraftObject({
        key: s(item.key).toLowerCase(),
        question: s(item.title),
        title: s(item.title),
        category: s(item.group || "business_truth"),
        group: s(item.group || "business_truth"),
        groupLabel: s(item.groupLabel || "Business truth"),
        priority: Number(item.priority || 0),
      })
    );
}

export function buildAssistantCompatBusinessFacts(assistant = {}) {
  const view = buildCompatDraftView(assistant);

  return compactDraftObject({
    companyName: s(view.businessName),
    summaryShort: s(view.businessDescription),
    summaryLong: s(view.businessDescription),
    services: uniqueStrings(view.services, 24),
    pricingPolicy: s(view.pricingSummary),
    pricingHints: view.pricingSummary ? [view.pricingSummary] : [],
    primaryPhone: s(view.primaryPhone),
    primaryEmail: s(view.primaryEmail),
    primaryAddress: s(view.primaryAddress),
    websiteUrl: s(view.websiteUrl),
    hours: uniqueStrings(view.hours, 24),
    languages: uniqueStrings(view.languages, 12),

    faqQuestions: [],
    reasoningSummary: s(view.reasoningSummary),
  });
}

export function buildAssistantCompatConversationStatus(assistant = {}) {
  const confidence = obj(assistant.confidence);
  const interviewPlan = obj(assistant.interviewPlan);

  return compactDraftObject({
    phase: s(assistant.phase || "interview"),
    unresolvedCount: arr(confidence.unclear).length,
    contradictionCount: arr(confidence.contradictions).length,
    followupCount: arr(interviewPlan.activeQuestions).length,
    hasReasoningSummary: arr(obj(assistant.recommendation).notes).length > 0,
    readyForApproval: assistant.readyForApproval === true,
    provider: s(assistant.provider),
    model: s(assistant.model),
    usedFallback: assistant.usedFallback === true,
  });
}