import OpenAI from "openai";
import { cfg } from "../../config.js";
import { arr, normalizeIsoLanguage, s } from "./normalize.js";
import {
  buildRecentLanguageSample,
  resolveConversationLanguageHint,
} from "./languageContext.js";

let openaiSingleton = null;

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function pickModel() {
  return (
    s(cfg?.ai?.openaiTruthIntentModel) ||
    s(cfg?.ai?.openaiStructuredFallbackModel) ||
    s(cfg?.ai?.openaiFallbackModel) ||
    "gpt-4.1-mini"
  );
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

function buildRecoverySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      isRecoveryComplaint: { type: "boolean" },
      language: { type: "string" },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      reason: { type: "string" },
    },
    required: [
      "isRecoveryComplaint",
      "language",
      "confidence",
      "reason",
    ],
  };
}

function normalizeDetection(result = {}, fallbackLanguage = "az") {
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence) || 0));
  const isRecoveryComplaint =
    result?.isRecoveryComplaint === true && confidence >= 0.62;

  return {
    isRecoveryComplaint,
    language: normalizeIsoLanguage(result?.language, fallbackLanguage),
    confidence,
    reason: s(result?.reason),
  };
}

export async function detectConversationRecoveryWithModel({
  text = "",
  fallbackLanguage = "az",
  recentMessages = [],
  profile = {},
  conversationContext = {},
  threadState = null,
} = {}) {
  const latestText = s(text);
  const openai = ensureOpenAI();

  if (!latestText || !openai) {
    return normalizeDetection(
      {
        isRecoveryComplaint: false,
        language: fallbackLanguage,
        confidence: 0,
        reason: "empty_or_model_unavailable",
      },
      fallbackLanguage
    );
  }

  const languageHint = resolveConversationLanguageHint({
    text: latestText,
    recentMessages,
    profile,
    fallbackLanguage,
  });

  const recentConversationSample = buildRecentLanguageSample(recentMessages, 6);
  const model = pickModel();

  const systemPrompt = [
    "You are a narrow conversation recovery detector.",
    "Do not answer the customer.",
    "Do not classify ordinary business questions.",
    "Return true only when the latest customer message is about the conversation itself being broken, delayed, ignored, unanswered, invisible, or asking if anyone is there.",
    "Examples of recovery complaints:",
    "- Why are you not replying?",
    "- I cannot see your reply.",
    "- No answer came.",
    "- Are you there?",
    "- Is anyone answering?",
    "- I wrote but nobody replied.",
    "- The message did not arrive.",
    "Return false for contact, phone, email, price, service, booking, address, website, product, greeting, or normal support questions.",
    "If the latest message is short or ambiguous, use conversationLanguageHint and recentConversationSample for language only, not for inventing intent.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    latestCustomerMessage: latestText,
    conversationLanguageHint: languageHint,
    recentConversationSample,
    conversationContext,
    threadState,
    task: "Detect whether this is a conversation recovery complaint only.",
  });

  try {
    const response = await openai.responses.create({
      model,
      max_output_tokens: 260,
      text: {
        format: {
          type: "json_schema",
          name: "conversation_recovery_detection",
          strict: true,
          schema: buildRecoverySchema(),
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

    return normalizeDetection(
      parseJson(extractOutputText(response)) || {},
      languageHint || fallbackLanguage
    );
  } catch (error) {
    try {
      console.warn("[ai-hq] conversation recovery detector failed", {
        model,
        message: error?.message || String(error),
      });
    } catch {}

    return normalizeDetection(
      {
        isRecoveryComplaint: false,
        language: languageHint || fallbackLanguage,
        confidence: 0,
        reason: "detector_failed",
      },
      languageHint || fallbackLanguage
    );
  }
}
