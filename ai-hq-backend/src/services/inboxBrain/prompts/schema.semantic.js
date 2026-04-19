const ASK_CATEGORY_ENUM = [
  "greeting",
  "service_interest",
  "recommendation",
  "pricing",
  "timeline",
  "comparison",
  "availability",
  "booking",
  "reservation",
  "quote",
  "support",
  "faq",
  "handoff_request",
  "general",
];

const CONVERSATION_STAGE_ENUM = [
  "greeting",
  "discovery",
  "recommendation",
  "pricing",
  "timeline",
  "qualification",
  "objection",
  "handoff",
  "support",
  "answer",
  "closing",
  "general",
];

const REPLY_STYLE_ENUM = [
  "consultative",
  "direct",
  "reassuring",
  "concise",
  "sales",
  "supportive",
  "professional",
];

const HANDOFF_PRIORITY_ENUM = ["low", "normal", "high", "urgent"];

export function getSemanticDecisionJsonSchemaObject() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string" },
      semanticIntent: { type: "string" },
      askCategory: {
        type: "string",
        enum: ASK_CATEGORY_ENUM,
      },
      conversationStage: {
        type: "string",
        enum: CONVERSATION_STAGE_ENUM,
      },
      replyStyle: {
        type: "string",
        enum: REPLY_STYLE_ENUM,
      },
      customerGoal: { type: "string" },
      knownFacts: {
        type: "array",
        items: { type: "string" },
      },
      missingFacts: {
        type: "array",
        items: { type: "string" },
      },
      groundedFactsUsed: {
        type: "array",
        items: { type: "string" },
      },
      answerFirst: { type: "string" },
      recommendedNextQuestion: { type: "string" },
      replyText: { type: "string" },
      createLead: { type: "boolean" },
      handoff: { type: "boolean" },
      handoffReason: { type: "string" },
      handoffPriority: {
        type: "string",
        enum: HANDOFF_PRIORITY_ENUM,
      },
      noReply: { type: "boolean" },
      confidence: { type: "number" },
      leadScore: { type: "number" },
    },
    required: [
      "language",
      "semanticIntent",
      "askCategory",
      "conversationStage",
      "replyStyle",
      "customerGoal",
      "knownFacts",
      "missingFacts",
      "groundedFactsUsed",
      "answerFirst",
      "recommendedNextQuestion",
      "replyText",
      "createLead",
      "handoff",
      "handoffReason",
      "handoffPriority",
      "noReply",
      "confidence",
      "leadScore",
    ],
  };
}

export function getSemanticDecisionJsonSchemaText() {
  return JSON.stringify(getSemanticDecisionJsonSchemaObject(), null, 2);
}