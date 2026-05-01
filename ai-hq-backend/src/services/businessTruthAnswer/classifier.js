import OpenAI from "openai";
import { cfg } from "../../config.js";
import { arr, lower, normalizeIsoLanguage, s, uniqStrings } from "./normalize.js";
import {
  buildRecentLanguageSample,
  resolveConversationLanguageHint,
} from "./languageContext.js";

let openaiSingleton = null;

const APPROVED_TRUTH_INTENTS = [
  "unknown",
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
  "sales_interest",
  "handoff.request",
  "support.request",

  "contact.general",
  "contact.phone",
  "contact.email",
  "contact.website",
  "contact.address",

  "identity.name",
  "business.summary",
  "business.services",
  "business.products",
  "business.pricing",
  "business.booking",
  "business.social",
  "business.language",

  "behavior.policy"
];

const FACTUAL_INTENTS = new Set([
  "contact.general",
  "contact.phone",
  "contact.email",
  "contact.website",
  "contact.address",
  "identity.name",
  "business.summary",
  "business.services",
  "business.products",
  "business.pricing",
  "business.booking",
  "business.social",
  "business.language",
  "behavior.policy",
]);

const SAFE_DIRECT_INTENTS = new Set([
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
]);

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function pickClassifierModel() {
  return (
    s(cfg?.ai?.openaiTruthIntentModel) ||
    s(cfg?.ai?.openaiStructuredFallbackModel) ||
    s(cfg?.ai?.openaiFallbackModel) ||
    "gpt-4.1-mini"
  );
}

function buildIntentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      primaryIntent: {
        type: "string",
        enum: APPROVED_TRUTH_INTENTS,
      },
      intents: {
        type: "array",
        items: {
          type: "string",
          enum: APPROVED_TRUTH_INTENTS,
        },
      },
      language: {
        type: "string",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      needsApprovedTruth: {
        type: "boolean",
      },
      userMeaning: {
        type: "string",
      },
    },
    required: [
      "primaryIntent",
      "intents",
      "language",
      "confidence",
      "needsApprovedTruth",
      "userMeaning",
    ],
  };
}

function extractOutputText(response = {}) {
  const direct = s(response?.output_text);
  if (direct) return direct;

  for (const outputItem of arr(response?.output)) {
    for (const contentItem of arr(outputItem?.content)) {
      const text = s(
        contentItem?.text ||
          contentItem?.output_text ||
          contentItem?.value ||
          ""
      );
      if (text) return text;
    }
  }

  return "";
}

function parseJson(raw = "") {
  if (!s(raw)) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const match = s(raw).match(/\{[\s\S]*\}/u);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeIntentList(value = [], primaryIntent = "unknown") {
  const items = uniqStrings([
    ...arr(value),
    primaryIntent,
  ])
    .map((item) => s(item))
    .filter((item) => APPROVED_TRUTH_INTENTS.includes(item))
    .filter((item) => item !== "unknown");

  return items.length ? items : ["unknown"];
}

function normalizeClassifierResult(result = {}, fallbackLanguage = "az") {
  const primaryIntent = APPROVED_TRUTH_INTENTS.includes(s(result?.primaryIntent))
    ? s(result.primaryIntent)
    : APPROVED_TRUTH_INTENTS.includes(s(result?.intent))
      ? s(result.intent)
      : "unknown";

  const intents = normalizeIntentList(result?.intents, primaryIntent);
  const language = normalizeIsoLanguage(result?.language, fallbackLanguage);
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence) || 0));

  const hasFactualIntent = intents.some((intent) => FACTUAL_INTENTS.has(intent));
  const hasSafeDirectIntent = intents.some((intent) =>
    SAFE_DIRECT_INTENTS.has(intent)
  );

  const needsApprovedTruth =
    result?.needsApprovedTruth === true || hasFactualIntent;

  return {
    primaryIntent: intents[0] || primaryIntent,
    intents,
    language,
    confidence,
    needsApprovedTruth,
    userMeaning: s(result?.userMeaning),
    shouldHandle:
      confidence >= 0.45 && (hasFactualIntent || hasSafeDirectIntent),
  };
}

export async function classifyApprovedTruthIntentWithModel({
  text = "",
  fallbackLanguage = "az",
  recentMessages = [],
  profile = {},
  conversationContext = {},
  threadState = null,
} = {}) {
  const latestText = s(text);
  const languageHint = resolveConversationLanguageHint({
    text: latestText,
    recentMessages,
    profile,
    fallbackLanguage,
  });
  const recentConversationSample = buildRecentLanguageSample(recentMessages, 8);
  const openai = ensureOpenAI();

  if (!latestText || !openai) {
    return normalizeClassifierResult(
      {
        primaryIntent: "unknown",
        intents: ["unknown"],
        language: fallbackLanguage,
        confidence: 0,
        needsApprovedTruth: false,
        userMeaning: "",
      },
      fallbackLanguage
    );
  }

  const model = pickClassifierModel();

  const systemPrompt = [
    "You are ONLY an intent classifier for a governed business AI system.",
    "Do not answer the customer.",
    "Do not provide business facts.",
    "Do not infer phone numbers, emails, prices, services, names, addresses, or policies.",
    "The backend will answer using approved business truth only.",
    "Return one or more intents when the customer asks multiple things in the same message.",
    "Intent ordering rule:",
    "The intents array must follow the same order as the customer's request.",
    "The primaryIntent must be the first concrete intent in that ordered intents array.",
    "",
    "Critical principle:",
    "The model may understand intent, but approved truth owns factual answers.",
    "",
    "Intent guide:",
    "- smalltalk.greeting: greeting only.",
    "- smalltalk.gratitude: thanks/closing only.",
    "- clarify.unclear: unclear short message like 'please', 'por favor', 'ok?', or incomplete request.",
    "- contact.general: wants contact information generally.",
    "- contact.phone: asks phone/call/WhatsApp number.",
    "- contact.email: asks email.",
    "- contact.website: asks website/link.",
    "- contact.address: asks address/location.",
    "- identity.name: asks business/company name.",
    "- business.summary: asks what the business does or asks generally about the business.",
    "- business.services: asks services/offers.",
    "- business.products: asks products.",
    "- business.pricing: asks price/cost/budget/quote.",
    "- business.booking: asks appointment/booking/reservation.",
    "- business.social: asks social channels.",
    "- business.language: asks supported languages.",
    "- behavior.policy: asks tone, handoff, operator, CTA, or AI behavior policy.",
    "- sales_interest: interested in buying/starting, but not asking an exact approved fact.",
    "- handoff.request: asks for human/operator.",
    "- support.request: reports a support problem.",
    "- unknown: unclear and not safely classifiable.",
    "",
    "Language rule:",
    "Classify the language of the customer reply.",
    "If the latest customer message is short, ambiguous, borrowed, or only one word, prefer conversationLanguageHint and recentConversationSample.",
    "Examples of ambiguous short messages include: 'Mail?', 'Phone?', 'Contact?', 'Qiymət?', 'Sayt?', 'Number?'.",
    "Do not default to English just because a borrowed word such as 'mail' appears in a non-English conversation.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    latestCustomerMessage: latestText,
    conversationLanguageHint: languageHint,
    recentConversationSample,
    conversationContext,
    threadState,
    task: "Classify intent and response language only. Never answer the customer.",
  });

  try {
    const response = await openai.responses.create({
      model,
      max_output_tokens: 450,
      text: {
        format: {
          type: "json_schema",
          name: "approved_truth_intent_classification",
          strict: true,
          schema: buildIntentSchema(),
        },
      },
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    return normalizeClassifierResult(
      parseJson(extractOutputText(response)) || {},
      fallbackLanguage
    );
  } catch (err) {
    try {
      console.warn("[ai-hq] approved truth intent classifier failed", {
        model,
        message: err?.message || String(err),
      });
    } catch {}

    return normalizeClassifierResult(
      {
        primaryIntent: "unknown",
        intents: ["unknown"],
        language: fallbackLanguage,
        confidence: 0,
        needsApprovedTruth: false,
        userMeaning: "",
      },
      fallbackLanguage
    );
  }
}