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
    totalRemainingQuestions: arr(obj(assistant.interviewPlan).activeQuestions).length,
  });
}

export function buildAssistantCompatFollowupQueue(assistant = {}) {
  const nextKey = s(obj(assistant.nextQuestion).key).toLowerCase();

  return arr(obj(assistant.interviewPlan).activeQuestions)
    .filter((item) => s(item.key).toLowerCase() && s(item.key).toLowerCase() !== nextKey)
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

function pickContactRouteValue(routes = [], matcher = () => false) {
  return s(arr(routes).find((item) => matcher(s(item).toLowerCase())) || "");
}

export function buildAssistantCompatBusinessFacts(assistant = {}) {
  const draft = obj(assistant.draft);
  const contactRoutes = uniqueStrings(arr(draft.contactRoutes), 24);
  const pricingPosture = s(draft.pricingPosture);

  return compactDraftObject({
    companyName: s(draft.businessName),
    summaryShort: s(draft.whatThisBusinessIs),
    summaryLong: s(draft.whatThisBusinessIs),
    services: uniqueStrings(arr(draft.coreServices), 24),
    pricingPolicy: pricingPosture,
    pricingHints: pricingPosture ? [pricingPosture] : [],
    primaryPhone: pickContactRouteValue(contactRoutes, (value) => /(\+|[0-9])/.test(value)),
    primaryEmail: pickContactRouteValue(contactRoutes, (value) => value.includes("@")),
    primaryAddress: "",
    hours: uniqueStrings(arr(draft.hours), 24),
    languages: uniqueStrings(arr(draft.languages), 12),
    faqQuestions: [],
    reasoningSummary: uniqueStrings(arr(obj(assistant.recommendation).notes), 12).join(" "),
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