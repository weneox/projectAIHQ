import OpenAI from "openai";
import { cfg } from "../../config.js";
import { arr, lower, normalizeIsoLanguage, obj, s } from "./normalize.js";

let openaiSingleton = null;

const APPROVED_TRUTH_INTENTS = [
  "unknown",
  "smalltalk",
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
    s(cfg?.ai?.openaiModel) ||
    "gpt-4.1-mini"
  );
}

function buildIntentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: {
        type: "string",
        enum: APPROVED_TRUTH_INTENTS,
      },
      language: {
        type: "string",
        description: "ISO-like language code of the customer message, for example az, en, es, tr, ru.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      needsApprovedTruth: {
        type: "boolean",
        description: "True only when the user is asking for a factual business truth field.",
      },
      userMeaning: {
        type: "string",
        description: "Short English explanation of what the user wants. Do not answer the user.",
      },
    },
    required: [
      "intent",
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

  const output = arr(response?.output);
  for (const item of output) {
    for (const content of arr(item?.content)) {
      const text = s(content?.text || content?.output_text || content?.value);
      if (text) return text;
    }
  }

  return "";
}

function parseClassifierJson(raw = "") {
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

function normalizeIntentResult(result = {}, fallbackLanguage = "az") {
  const intent = APPROVED_TRUTH_INTENTS.includes(s(result?.intent))
    ? s(result.intent)
    : "unknown";

  const language = normalizeIsoLanguage(result?.language, fallbackLanguage);
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence) || 0));
  const needsApprovedTruth =
    result?.needsApprovedTruth === true || FACTUAL_INTENTS.has(intent);

  return {
    intent,
    language,
    confidence,
    needsApprovedTruth,
    userMeaning: s(result?.userMeaning),
    shouldHandle:
      FACTUAL_INTENTS.has(intent) &&
      needsApprovedTruth &&
      confidence >= 0.45,
  };
}

export async function classifyApprovedTruthIntentWithModel({
  text = "",
  fallbackLanguage = "az",
} = {}) {
  const openai = ensureOpenAI();
  const latestText = s(text);

  if (!openai || !latestText) {
    return normalizeIntentResult(
      {
        intent: "unknown",
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
    "Do not infer phone numbers, emails, prices, services, or policies.",
    "Classify what the customer is asking for into the provided enum.",
    "The backend will answer using approved business truth only.",
    "",
    "Intent guide:",
    "- contact.general: user wants contact information generally.",
    "- contact.phone: user asks for phone/call/WhatsApp number.",
    "- contact.email: user asks for email.",
    "- contact.website: user asks for website or link.",
    "- contact.address: user asks for address/location.",
    "- identity.name: user asks business/company name.",
    "- business.summary: user asks what the business does or asks about the business generally.",
    "- business.services: user asks what services are provided.",
    "- business.products: user asks what products are offered.",
    "- business.pricing: user asks price/cost/budget/quote.",
    "- business.booking: user asks appointment/booking/reservation.",
    "- business.social: user asks social channels.",
    "- business.language: user asks supported languages.",
    "- behavior.policy: user asks how AI/business replies, handoff, tone, CTA, or operator policy.",
    "- sales_interest: user is interested but not asking an exact approved fact.",
    "- handoff.request: user asks for a human/operator.",
    "- support.request: user has a support problem.",
    "- smalltalk: greetings or casual talk.",
    "- unknown: unclear.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    latestCustomerMessage: latestText,
    task: "Classify the customer intent only. Never answer the customer.",
  });

  try {
    const response = await openai.responses.create({
      model,
      max_output_tokens: 350,
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

    const parsed = parseClassifierJson(extractOutputText(response));
    return normalizeIntentResult(parsed || {}, fallbackLanguage);
  } catch (err) {
    try {
      console.warn("[ai-hq] approved truth intent classifier failed", {
        model,
        message: err?.message || String(err),
      });
    } catch {}

    return normalizeIntentResult(
      {
        intent: "unknown",
        language: fallbackLanguage,
        confidence: 0,
        needsApprovedTruth: false,
        userMeaning: "",
      },
      fallbackLanguage
    );
  }
}