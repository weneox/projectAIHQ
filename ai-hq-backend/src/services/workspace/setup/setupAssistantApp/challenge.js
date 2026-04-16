import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import { SECTION_META, buildAssistantQuestion } from "./questions.js";

export function normalizeChallengeField(value = "") {
  const key = s(value).toLowerCase().replace(/[\s_-]+/g, "");

  if (
    [
      "identity",
      "businessname",
      "company",
      "description",
      "website",
      "audience",
      "profile",
    ].includes(key)
  ) {
    return "profile";
  }

  if (["service", "services"].includes(key)) return "services";
  if (["contact", "contacts", "contactroute", "routing"].includes(key)) {
    return "contacts";
  }
  if (["hour", "hours", "availability"].includes(key)) return "hours";
  if (["pricing", "price", "pricingposture"].includes(key)) return "pricing";
  if (["handoff", "escalation", "humanhandoff"].includes(key)) return "handoff";

  const raw = s(value).toLowerCase();
  return SECTION_META[raw] ? raw : "";
}

export function buildRejectedFieldSet(turn = {}) {
  const out = new Set();

  for (const item of arr(obj(turn).rejectedInputs)) {
    const key = normalizeChallengeField(
      s(item?.suggestedField || item?.field || item?.key)
    );
    if (key) out.add(key);
  }

  return out;
}

export function hasRejectedField(rejectedFields = new Set(), keys = []) {
  return arr(keys).some((key) =>
    rejectedFields.has(normalizeChallengeField(key) || s(key).toLowerCase())
  );
}

export function buildChallengeQuestion(turn = {}, currentDraft = {}) {
  const safeTurn = obj(turn);
  const rejectedInputs = arr(safeTurn.rejectedInputs);
  const firstRejected = obj(rejectedInputs[0]);
  const suggestedField = normalizeChallengeField(firstRejected.suggestedField);
  const fallbackKey =
    normalizeChallengeField(obj(safeTurn.nextQuestion).key) ||
    normalizeChallengeField(obj(currentDraft.progress).currentQuestionKey) ||
    "profile";

  const key = suggestedField || fallbackKey || "profile";
  const baseQuestion = buildAssistantQuestion(key, obj(safeTurn.nextQuestion));

  return buildAssistantQuestion(key, {
    ...baseQuestion,
    title: s(baseQuestion.title) || "Letâ€™s clarify this part",
    prompt: s(baseQuestion.prompt) || s(obj(SECTION_META[key]).prompt),
    priority: 100,
  });
}

export function shapeBrainTurnForClient(turn = {}, currentDraft = {}) {
  const safeTurn = obj(turn);
  const rejectedInputs = arr(safeTurn.rejectedInputs)
    .map((item) => ({
      input: s(item?.input),
      reason: s(item?.reason),
      suggestedField: s(item?.suggestedField),
    }))
    .filter((item) => item.input || item.reason);

  const contradictions = arr(obj(safeTurn.confidence).contradictions)
    .map((item) => s(item))
    .filter(Boolean);

  const hasChallenge = rejectedInputs.length > 0 || contradictions.length > 0;
  if (!hasChallenge) return safeTurn;

  const challengeQuestion = buildChallengeQuestion(safeTurn, currentDraft);
  const firstRejected = obj(rejectedInputs[0]);
  const leadLines = [];

  if (s(firstRejected.input) || s(firstRejected.reason)) {
    leadLines.push(
      s(firstRejected.input)
        ? `I did not accept "${s(firstRejected.input)}" as-is. ${s(firstRejected.reason)}`
        : s(firstRejected.reason)
    );
  }

  if (contradictions.length > 0) {
    leadLines.push(`There is also a conflict I need to resolve: ${contradictions[0]}`);
  }

  leadLines.push(`To keep the setup accurate, ${s(challengeQuestion.prompt)}`);

  const existingActiveQuestions = arr(obj(safeTurn.interviewPlan).activeQuestions)
    .map((item) =>
      compactDraftObject({
        key: s(item?.key),
        step: s(item?.step || item?.key),
        title: s(item?.title),
        group: s(item?.group || "business_truth"),
        groupLabel: s(item?.groupLabel || "Business truth"),
        priority: Number(item?.priority || 0) || 0,
      })
    )
    .filter((item) => item.key && item.key !== s(challengeQuestion.key));

  return {
    ...safeTurn,
    phase: "interview",
    assistantMessage: leadLines.filter(Boolean).join(" "),
    nextQuestion: challengeQuestion,
    readyForApproval: false,
    interviewPlan: {
      activeQuestionKeys: [
        s(challengeQuestion.key),
        ...existingActiveQuestions.map((item) => s(item.key)),
      ],
      activeQuestions: [challengeQuestion, ...existingActiveQuestions],
      remainingQuestionKeys: existingActiveQuestions.map((item) => s(item.key)),
      nextGroup: s(challengeQuestion.group || "business_truth"),
      nextGroupLabel: s(challengeQuestion.groupLabel || "Business truth"),
    },
  };
}
