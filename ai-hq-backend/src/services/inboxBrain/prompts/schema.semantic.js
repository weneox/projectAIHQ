export function getSemanticDecisionJsonSchemaText() {
  return `{
  "language": string,
  "semanticIntent": string,
  "askCategory": "greeting"|"service_interest"|"recommendation"|"pricing"|"timeline"|"comparison"|"availability"|"booking"|"reservation"|"quote"|"support"|"faq"|"handoff_request"|"general",
  "conversationStage": "greeting"|"discovery"|"recommendation"|"pricing"|"timeline"|"qualification"|"objection"|"handoff"|"support"|"answer"|"closing"|"general",
  "replyStyle": "consultative"|"direct"|"reassuring"|"concise"|"sales"|"supportive"|"professional",
  "customerGoal": string,
  "knownFacts": string[],
  "missingFacts": string[],
  "groundedFactsUsed": string[],
  "answerFirst": string,
  "recommendedNextQuestion": string,
  "replyText": string,
  "createLead": boolean,
  "handoff": boolean,
  "handoffReason": string,
  "handoffPriority": "low"|"normal"|"high"|"urgent",
  "noReply": boolean,
  "confidence": number
}`;
}