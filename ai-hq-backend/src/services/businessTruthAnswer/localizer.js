import OpenAI from "openai";
import { cfg } from "../../config.js";
import { arr, normalizeIsoLanguage, s, uniqStrings } from "./normalize.js";

let openaiSingleton = null;

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function pickLocalizerModel() {
  return (
    s(cfg?.ai?.openaiTruthLocalizationModel) ||
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

function normalizePhoneComparable(value = "") {
  return s(value).replace(/[^\d+]/g, "");
}

function normalizeComparable(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsFact(replyText = "", fact = "") {
  const reply = s(replyText);
  const value = s(fact);

  if (!value) return true;
  if (!reply) return false;

  const phoneFact = normalizePhoneComparable(value);
  if (phoneFact && phoneFact.replace(/[^\d]/g, "").length >= 5) {
    return normalizePhoneComparable(reply).includes(phoneFact);
  }

  return normalizeComparable(reply).includes(normalizeComparable(value));
}

function buildCriticalFacts({ classification = {}, facts = {} } = {}) {
  const intents = uniqStrings([
    ...arr(classification?.intents),
    classification?.primaryIntent,
  ]);

  const out = [];

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.phone")
  ) {
    out.push(facts.phone);
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.email")
  ) {
    out.push(facts.email);
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.website")
  ) {
    out.push(facts.website);
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.address")
  ) {
    out.push(facts.address);
  }

  if (intents.includes("identity.name")) {
    out.push(facts.displayName);
  }

  if (intents.includes("business.pricing")) {
    out.push(facts.pricing);
  }

  if (intents.includes("business.booking")) {
    out.push(facts.booking);
  }

  if (intents.includes("business.services")) {
    out.push(...arr(facts.services));
  }

  if (intents.includes("business.products")) {
    out.push(...arr(facts.products));
  }

  return uniqStrings(out).filter(Boolean).slice(0, 20);
}

function validateLocalizedReply({ replyText = "", criticalFacts = [] } = {}) {
  const missing = arr(criticalFacts).filter(
    (fact) => !containsFact(replyText, fact)
  );

  if (missing.length) {
    return {
      ok: false,
      reason: "localized_reply_changed_or_dropped_fact",
      missing,
    };
  }

  return {
    ok: true,
    reason: "",
    missing: [],
  };
}

function buildLocalizationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      replyText: { type: "string" },
    },
    required: ["replyText"],
  };
}

export async function localizeApprovedTruthAnswer({
  replyText = "",
  targetLanguage = "az",
  customerText = "",
  classification = {},
  facts = {},
} = {}) {
  const baseReply = s(replyText);
  if (!baseReply) {
    return {
      replyText: "",
      localized: false,
      reason: "empty_reply",
      language: normalizeIsoLanguage(targetLanguage, "az"),
    };
  }

  const language = normalizeIsoLanguage(targetLanguage, "az");
  const openai = ensureOpenAI();

  if (!openai) {
    return {
      replyText: baseReply,
      localized: false,
      reason: "openai_unavailable",
      language,
    };
  }

  const criticalFacts = buildCriticalFacts({ classification, facts });
  const model = pickLocalizerModel();

  const systemPrompt = [
    "You are a safe multilingual response localizer for a governed business AI system.",
    "You do not create business facts.",
    "You only rewrite/localize the already approved answer into the customer's language.",
    "Keep the response natural, short, human, and suitable for chat.",
    "Do not mention policies, approved truth, backend, system, AI, or internal rules.",
    "Do not add emojis unless the approved answer already contains emojis.",
    "Do not add prices, services, phone numbers, emails, addresses, websites, names, promises, discounts, or availability.",
    "Critical facts must remain exactly present in the final reply.",
    "If a critical fact is a phone number, email, website, address, or business name, preserve it exactly.",
    "If the target language is unknown, infer the customer's language from the message.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    targetLanguage: language,
    latestCustomerMessage: s(customerText),
    approvedAnswer: baseReply,
    criticalFacts,
    style: {
      tone: "natural_business_chat",
      maxSentences: 2,
      noRobotLabels: true,
      noInternalLanguage: true,
    },
  });

  try {
    const response = await openai.responses.create({
      model,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "localized_approved_truth_reply",
          strict: true,
          schema: buildLocalizationSchema(),
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

    const parsed = parseJson(extractOutputText(response)) || {};
    const localizedReply = s(parsed.replyText);

    if (!localizedReply) {
      return {
        replyText: baseReply,
        localized: false,
        reason: "empty_localized_reply",
        language,
      };
    }

    const validation = validateLocalizedReply({
      replyText: localizedReply,
      criticalFacts,
    });

    if (!validation.ok) {
      try {
        console.warn("[ai-hq] approved truth localization rejected", {
          reason: validation.reason,
          missing: validation.missing,
          language,
          model,
        });
      } catch {}

      return {
        replyText: baseReply,
        localized: false,
        reason: validation.reason,
        language,
      };
    }

    return {
      replyText: localizedReply,
      localized: true,
      reason: "localized",
      language,
    };
  } catch (error) {
    try {
      console.warn("[ai-hq] approved truth localization failed", {
        model,
        language,
        message: error?.message || String(error),
      });
    } catch {}

    return {
      replyText: baseReply,
      localized: false,
      reason: "localizer_failed",
      language,
    };
  }
}

export const __test__ = {
  buildCriticalFacts,
  containsFact,
  validateLocalizedReply,
};
