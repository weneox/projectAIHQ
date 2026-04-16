import { arr, compactDraftObject, obj, s } from "../draftShared.js";

export function buildAssistantCompatQuestion(assistant = {}) {
  const nextQuestion = obj(assistant.nextQuestion);
  if (!s(nextQuestion.key)) return null;

  return compactDraftObject({
    key: s(nextQuestion.key),
    questionKey: s(nextQuestion.key),
    question: s(nextQuestion.prompt || nextQuestion.title),
    title: s(nextQuestion.title),
    prompt: s(nextQuestion.prompt),
    category: s(nextQuestion.group),
    group: s(nextQuestion.group),
    groupLabel: s(nextQuestion.groupLabel),
    priority: Number(nextQuestion.priority || 0),
    totalRemainingQuestions: arr(obj(assistant.interviewPlan).activeQuestions).length,
  });
}

export function buildAssistantCompatFollowupQueue(assistant = {}) {
  const nextKey = s(obj(assistant.nextQuestion).key);

  return arr(obj(assistant.interviewPlan).activeQuestions)
    .filter((item) => s(item.key) && s(item.key) !== nextKey)
    .map((item) =>
      compactDraftObject({
        key: s(item.key),
        question: s(item.title),
        title: s(item.title),
        category: s(item.group),
        group: s(item.group),
        groupLabel: s(item.groupLabel),
        priority: Number(item.priority || 0),
      })
    );
}

function pickContactRouteValue(routes = [], matcher = () => false) {
  return s(arr(routes).find((item) => matcher(s(item).toLowerCase())) || "");
}

export function buildAssistantCompatBusinessFacts(assistant = {}) {
  const draft = obj(assistant.draft);
  const contactRoutes = arr(draft.contactRoutes);
  const pricingPosture = s(draft.pricingPosture);

  return compactDraftObject({
    companyName: s(draft.businessName),
    summaryShort: s(draft.whatThisBusinessIs),
    summaryLong: s(draft.whatThisBusinessIs),
    services: arr(draft.coreServices),
    pricingPolicy: pricingPosture,
    pricingHints: pricingPosture ? [pricingPosture] : [],
    primaryPhone: pickContactRouteValue(contactRoutes, (value) => /(\+|[0-9])/.test(value)),
    primaryEmail: pickContactRouteValue(contactRoutes, (value) => value.includes("@")),
    primaryAddress: "",
    hours: arr(draft.hours),
    languages: arr(draft.languages),
    faqQuestions: [],
    reasoningSummary: arr(obj(assistant.recommendation).notes).join(" "),
  });
}

export function buildAssistantCompatConversationStatus(assistant = {}) {
  const confidence = obj(assistant.confidence);
  const interviewPlan = obj(assistant.interviewPlan);

  return compactDraftObject({
    phase: s(assistant.phase || "interview"),
    unresolvedCount: arr(confidence.unclear).length,
    followupCount: arr(interviewPlan.activeQuestions).length,
    hasReasoningSummary: arr(obj(assistant.recommendation).notes).length > 0,
    readyForApproval: assistant.readyForApproval === true,
  });
}
