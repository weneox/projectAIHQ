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

function escapeRegExp(value = "") {
  return s(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function inferFactKind(value = "", explicitKind = "") {
  const explicit = s(explicitKind).toLowerCase();
  if (explicit) return explicit;

  const text = s(value);
  if (!text) return "text";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text)) return "email";
  if (/^https?:\/\//iu.test(text) || /^www\./iu.test(text)) return "url";

  const digits = text.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 16) return "phone";

  return "text";
}

function addFact(out, seen, key, value, kind = "") {
  const safeValue = s(value);
  if (!safeValue) return;

  const safeKind = inferFactKind(safeValue, kind);
  const dedupeKey = `${safeKind}:${normalizeComparable(safeValue)}`;
  if (seen.has(dedupeKey)) return;

  seen.add(dedupeKey);
  out.push({
    key: s(key) || safeKind,
    value: safeValue,
    kind: safeKind,
    token: `[[AIHQ_FACT_${out.length + 1}]]`,
  });
}

function buildCriticalFacts({ classification = {}, facts = {} } = {}) {
  const intents = uniqStrings([
    ...arr(classification?.intents),
    classification?.primaryIntent,
  ]);

  const out = [];
  const seen = new Set();

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.phone")
  ) {
    addFact(out, seen, "Primary phone", facts.phone, "phone");
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.email")
  ) {
    addFact(out, seen, "Primary email", facts.email, "email");
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.website")
  ) {
    addFact(out, seen, "Website", facts.website, "url");
  }

  if (
    intents.includes("contact.general") ||
    intents.includes("contact.address")
  ) {
    addFact(out, seen, "Address", facts.address, "text");
  }

  if (intents.includes("identity.name")) {
    addFact(out, seen, "Business name", facts.displayName, "name");
  }

  if (intents.includes("business.pricing")) {
    addFact(out, seen, "Pricing", facts.pricing, "text");
  }

  if (intents.includes("business.booking")) {
    addFact(out, seen, "Booking", facts.booking, "text");
  }

  if (intents.includes("business.services")) {
    for (const item of arr(facts.services)) {
      addFact(out, seen, "Service", item, "service");
    }
  }

  if (intents.includes("business.products")) {
    for (const item of arr(facts.products)) {
      addFact(out, seen, "Product", item, "product");
    }
  }

  return out.slice(0, 30);
}

function protectFactsInText(text = "", criticalFacts = []) {
  let out = s(text);

  const sorted = [...arr(criticalFacts)].sort(
    (a, b) => s(b?.value).length - s(a?.value).length
  );

  for (const fact of sorted) {
    const value = s(fact?.value);
    const token = s(fact?.token);
    if (!value || !token) continue;

    out = out.split(value).join(token);
  }

  return out;
}

const ATTACHED_SUFFIXES = [
  "dır",
  "dir",
  "dur",
  "dür",
  "tır",
  "tir",
  "tur",
  "tür",
  "dı",
  "di",
  "du",
  "dü",
  "dırlar",
  "dirler",
  "durlar",
  "dürler",
];

function stripAttachedSuffixesFromTokens(text = "", criticalFacts = []) {
  let out = s(text);

  for (const fact of arr(criticalFacts)) {
    const token = s(fact?.token);
    if (!token) continue;

    const tokenPattern = escapeRegExp(token);
    const suffixPattern = ATTACHED_SUFFIXES.map(escapeRegExp).join("|");

    out = out.replace(
      new RegExp(`${tokenPattern}(?:[-–—]?(?:${suffixPattern}))(?=$|[\\s.,!?؟;:])`, "giu"),
      token
    );
  }

  return out;
}

function restoreFactTokens(text = "", criticalFacts = []) {
  let out = s(text);

  for (const fact of arr(criticalFacts)) {
    const token = s(fact?.token);
    const value = s(fact?.value);
    if (!token || !value) continue;

    out = out.split(token).join(value);
  }

  return out;
}

function stripAttachedSuffixesFromMachineValues(text = "", criticalFacts = []) {
  let out = s(text);

  for (const fact of arr(criticalFacts)) {
    const value = s(fact?.value);
    const kind = s(fact?.kind).toLowerCase();
    if (!value) continue;

    if (!["email", "url", "phone"].includes(kind)) continue;

    const valuePattern = escapeRegExp(value);
    const suffixPattern = ATTACHED_SUFFIXES.map(escapeRegExp).join("|");

    out = out.replace(
      new RegExp(`${valuePattern}(?:[-–—]?(?:${suffixPattern}))(?=$|[\\s.,!?؟;:])`, "giu"),
      value
    );
  }

  return out;
}

function normalizeReplyWhitespace(text = "") {
  return s(text)
    .replace(/\s+([,.!?؟;:])/g, "$1")
    .replace(/([,.!?؟;:])([^\s\])}])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function factHasSafeBoundary(replyText = "", fact = {}) {
  const reply = s(replyText);
  const value = s(fact?.value);
  const kind = s(fact?.kind).toLowerCase();

  if (!value) return true;
  if (!reply) return false;

  let startIndex = reply.indexOf(value);

  while (startIndex >= 0) {
    const before = startIndex > 0 ? reply[startIndex - 1] : "";
    const after = reply[startIndex + value.length] || "";

    const beforeOk =
      !before ||
      /[\s([{"'“‘:;]/u.test(before);

    const afterOk =
      !after ||
      /[\s.,!?؟;:)\]}"'”’]/u.test(after);

    if (kind === "email" || kind === "url") {
      if (beforeOk && afterOk) return true;
    } else if (kind === "phone") {
      const afterDigit = /\d/u.test(after);
      if (beforeOk && !afterDigit) return true;
    } else {
      return true;
    }

    startIndex = reply.indexOf(value, startIndex + value.length);
  }

  return false;
}

function containsFact(replyText = "", fact = {}) {
  const reply = s(replyText);
  const value = s(fact?.value);

  if (!value) return true;
  if (!reply) return false;

  const kind = s(fact?.kind).toLowerCase();

  if (kind === "phone") {
    const phoneFact = normalizePhoneComparable(value);
    return Boolean(phoneFact) && normalizePhoneComparable(reply).includes(phoneFact);
  }

  return normalizeComparable(reply).includes(normalizeComparable(value));
}

function validateLocalizedReply({ replyText = "", criticalFacts = [] } = {}) {
  const missing = [];
  const unsafeBoundary = [];

  for (const fact of arr(criticalFacts)) {
    if (!containsFact(replyText, fact)) {
      missing.push(fact);
      continue;
    }

    if (!factHasSafeBoundary(replyText, fact)) {
      unsafeBoundary.push(fact);
    }
  }

  if (missing.length || unsafeBoundary.length) {
    return {
      ok: false,
      reason: missing.length
        ? "localized_reply_dropped_fact"
        : "localized_reply_has_unsafe_fact_boundary",
      missing,
      unsafeBoundary,
    };
  }

  return {
    ok: true,
    reason: "",
    missing: [],
    unsafeBoundary: [],
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

function buildSafeFallbackReply(replyText = "", criticalFacts = []) {
  const stripped = stripAttachedSuffixesFromMachineValues(replyText, criticalFacts);
  return normalizeReplyWhitespace(stripped);
}

export async function localizeApprovedTruthAnswer({
  replyText = "",
  targetLanguage = "az",
  customerText = "",
  classification = {},
  facts = {},
} = {}) {
  const baseReply = s(replyText);
  const language = normalizeIsoLanguage(targetLanguage, "az");

  if (!baseReply) {
    return {
      replyText: "",
      localized: false,
      reason: "empty_reply",
      language,
    };
  }

  const criticalFacts = buildCriticalFacts({ classification, facts });
  const safeFallbackReply = buildSafeFallbackReply(baseReply, criticalFacts);
  const openai = ensureOpenAI();

  if (!openai) {
    return {
      replyText: safeFallbackReply,
      localized: false,
      reason: "openai_unavailable",
      language,
    };
  }

  const model = pickLocalizerModel();
  const protectedAnswer = protectFactsInText(safeFallbackReply, criticalFacts);

  const systemPrompt = [
    "You are a safe multilingual response localizer for a governed business AI system.",
    "You only rewrite the approved answer into the customer's language.",
    "You do not create, infer, remove, translate, or modify business facts.",
    "All fact tokens like [[AIHQ_FACT_1]] must remain exactly as tokens.",
    "Never attach grammar suffixes, particles, or letters directly to fact tokens.",
    "Keep emails, phone numbers, URLs, names, prices, services, and addresses as separate clean tokens.",
    "For email, phone, and URL facts, prefer a clear chat format like 'Email: [[AIHQ_FACT_1]]' or 'Phone: [[AIHQ_FACT_2]]'.",
    "Do not mention approved truth, backend, policy, validator, system, AI, internal rules, or tokens.",
    "Do not add emojis unless the approved answer already contains emojis.",
    "Keep the final message short, natural, and suitable for a customer chat.",
    "If the customer writes in a language not listed anywhere, infer that language and answer in it.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    targetLanguage: language,
    latestCustomerMessage: s(customerText),
    approvedAnswerWithFactTokens: protectedAnswer,
    criticalFactTokens: criticalFacts.map((fact) => ({
      token: fact.token,
      kind: fact.kind,
      key: fact.key,
    })),
    style: {
      tone: "natural_business_chat",
      maxSentences: 2,
      cleanMachineValues: true,
      noRobotLabels: false,
      noInternalLanguage: true,
    },
  });

  try {
    const response = await openai.responses.create({
      model,
      max_output_tokens: 550,
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
    let localizedReply = s(parsed.replyText);

    if (!localizedReply) {
      return {
        replyText: safeFallbackReply,
        localized: false,
        reason: "empty_localized_reply",
        language,
      };
    }

    localizedReply = stripAttachedSuffixesFromTokens(localizedReply, criticalFacts);
    localizedReply = restoreFactTokens(localizedReply, criticalFacts);
    localizedReply = stripAttachedSuffixesFromMachineValues(localizedReply, criticalFacts);
    localizedReply = normalizeReplyWhitespace(localizedReply);

    const validation = validateLocalizedReply({
      replyText: localizedReply,
      criticalFacts,
    });

    if (!validation.ok) {
      try {
        console.warn("[ai-hq] approved truth localization rejected", {
          reason: validation.reason,
          missing: validation.missing.map((item) => ({
            key: item.key,
            kind: item.kind,
          })),
          unsafeBoundary: validation.unsafeBoundary.map((item) => ({
            key: item.key,
            kind: item.kind,
          })),
          language,
          model,
        });
      } catch {}

      return {
        replyText: safeFallbackReply,
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
      replyText: safeFallbackReply,
      localized: false,
      reason: "localizer_failed",
      language,
    };
  }
}

export const __test__ = {
  buildCriticalFacts,
  containsFact,
  factHasSafeBoundary,
  validateLocalizedReply,
  stripAttachedSuffixesFromMachineValues,
};
