import OpenAI from "openai";
import { cfg } from "../../config.js";
import { arr, normalizeIsoLanguage, s, uniqStrings } from "./normalize.js";

let openaiSingleton = null;

const DIRECT_FACT_INTENTS = new Set([
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

const NON_DIRECT_CHAT_INTENTS = new Set([
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
  "sales_interest",
  "support.request",
  "handoff.request",
]);

const MACHINE_VALUE_RE =
  /((?:https?:\/\/|www\.)[^\s<>()]+)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(\+?\d[\d\s().-]{6,}\d)|(\[\[AIHQ_FACT_\d+\]\])/giu;

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

function normalizeComparable(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneComparable(value = "") {
  return s(value).replace(/[^\d+]/g, "");
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

  if (intents.includes("contact.general") || intents.includes("contact.phone")) {
    addFact(out, seen, "Primary phone", facts.phone, "phone");
  }

  if (intents.includes("contact.general") || intents.includes("contact.email")) {
    addFact(out, seen, "Primary email", facts.email, "email");
  }

  if (intents.includes("contact.general") || intents.includes("contact.website")) {
    addFact(out, seen, "Website", facts.website, "url");
  }

  if (intents.includes("contact.general") || intents.includes("contact.address")) {
    addFact(out, seen, "Address", facts.address, "address");
  }

  if (intents.includes("identity.name")) {
    addFact(out, seen, "Business name", facts.displayName, "name");
  }

  if (intents.includes("business.summary")) {
    addFact(
      out,
      seen,
      "Business summary",
      s(facts.summary) || s(facts.industry) || s(facts.displayName),
      "summary"
    );
  }

  if (intents.includes("business.pricing")) {
    addFact(out, seen, "Pricing", facts.pricing, "pricing");
  }

  if (intents.includes("business.booking")) {
    addFact(out, seen, "Booking", facts.booking, "booking");
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

  if (intents.includes("business.social")) {
    for (const item of arr(facts.socialLinks)) {
      addFact(out, seen, "Social link", item, "url");
    }
  }

  if (intents.includes("business.language")) {
    for (const item of arr(facts.languages)) {
      addFact(out, seen, "Language", item, "language");
    }
  }

  if (intents.includes("behavior.policy")) {
    addFact(out, seen, "Behavior tone", facts.behavior?.tone, "behavior");
    addFact(out, seen, "Behavior CTA", facts.behavior?.primaryCta, "behavior");
    addFact(out, seen, "Behavior handoff", facts.behavior?.handoffPolicy, "behavior");
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

function protectMachineSpans(text = "") {
  const source = s(text);
  const spans = [];
  let protectedText = "";
  let cursor = 0;

  for (const match of source.matchAll(MACHINE_VALUE_RE)) {
    const index = Number(match.index || 0);
    const raw = s(match[0]);
    if (!raw) continue;

    const token = `__AIHQ_PROTECTED_SPAN_${spans.length}__`;

    protectedText += source.slice(cursor, index);
    protectedText += token;
    spans.push({ token, value: raw });

    cursor = index + raw.length;
  }

  protectedText += source.slice(cursor);

  return {
    text: protectedText,
    spans,
  };
}

function restoreMachineSpans(text = "", spans = []) {
  let out = s(text);

  for (const span of Array.isArray(spans) ? spans : []) {
    if (!span?.token) continue;
    out = out.split(span.token).join(span.value);
  }

  return out;
}

function buildLooseMachineValueRegex(value = "") {
  const safe = s(value);
  if (!safe) return null;

  const escaped = escapeRegExp(safe)
    .replace(/@/g, "\\s*@\\s*")
    .replace(/\\\./g, "\\s*\\.\\s*")
    .replace(/\\\//g, "\\s*\\/\\s*")
    .replace(/:/g, "\\s*:\\s*");

  try {
    return new RegExp(escaped, "giu");
  } catch {
    return null;
  }
}

function repairMachineFactSpacing(text = "", criticalFacts = []) {
  let out = s(text);

  for (const fact of arr(criticalFacts)) {
    const value = s(fact?.value);
    const kind = s(fact?.kind).toLowerCase();

    if (!value || !["email", "url"].includes(kind)) continue;

    const looseRegex = buildLooseMachineValueRegex(value);
    if (!looseRegex) continue;

    out = out.replace(looseRegex, value);
  }

  return out;
}

function normalizeReplyWhitespace(text = "", criticalFacts = []) {
  const repaired = repairMachineFactSpacing(text, criticalFacts);
  const protectedResult = protectMachineSpans(repaired);

  const normalized = s(protectedResult.text)
    .replace(/\s+([,.!?؟;:])/g, "$1")
    .replace(/([!?؟;:])([^\s\])}])/g, "$1 $2")
    .replace(/\.([^\s\])}])/g, ". $1")
    .replace(/\s+/g, " ")
    .trim();

  return restoreMachineSpans(normalized, protectedResult.spans);
}

function isUnsafeAdjacentChar(value = "") {
  return Boolean(s(value)) && /[\p{L}\p{N}\p{M}_-]/u.test(value);
}

function hasCleanTokenBoundary(text = "", token = "") {
  const source = s(text);
  const safeToken = s(token);
  if (!source || !safeToken) return false;

  let index = source.indexOf(safeToken);

  while (index >= 0) {
    const before = index > 0 ? source[index - 1] : "";
    const after = source[index + safeToken.length] || "";

    if (!isUnsafeAdjacentChar(before) && !isUnsafeAdjacentChar(after)) {
      return true;
    }

    index = source.indexOf(safeToken, index + safeToken.length);
  }

  return false;
}

function hasCleanValueBoundary(text = "", fact = {}) {
  const source = s(text);
  const value = s(fact?.value);
  const kind = s(fact?.kind).toLowerCase();

  if (!source || !value) return false;

  let index = source.indexOf(value);

  while (index >= 0) {
    const before = index > 0 ? source[index - 1] : "";
    const after = source[index + value.length] || "";

    if (kind === "phone") {
      if (!/\d/u.test(after)) return true;
    } else if (!isUnsafeAdjacentChar(before) && !isUnsafeAdjacentChar(after)) {
      return true;
    }

    index = source.indexOf(value, index + value.length);
  }

  return false;
}

function containsFact(replyText = "", fact = {}) {
  const reply = s(replyText);
  const value = s(fact?.value);
  const kind = s(fact?.kind).toLowerCase();

  if (!value) return true;
  if (!reply) return false;

  if (kind === "phone") {
    const phoneFact = normalizePhoneComparable(value);
    return Boolean(phoneFact) && normalizePhoneComparable(reply).includes(phoneFact);
  }

  return normalizeComparable(reply).includes(normalizeComparable(value));
}

function validateTokenizedReply({ replyText = "", criticalFacts = [] } = {}) {
  const missing = [];
  const unsafeBoundary = [];

  for (const fact of arr(criticalFacts)) {
    const token = s(fact?.token);
    if (!token) continue;

    if (!s(replyText).includes(token)) {
      missing.push(fact);
      continue;
    }

    if (!hasCleanTokenBoundary(replyText, token)) {
      unsafeBoundary.push(fact);
    }
  }

  if (missing.length || unsafeBoundary.length) {
    return {
      ok: false,
      reason: missing.length
        ? "localized_reply_dropped_fact_token"
        : "localized_reply_attached_text_to_fact_token",
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

function validateRestoredReply({ replyText = "", criticalFacts = [] } = {}) {
  const missing = [];
  const unsafeBoundary = [];

  for (const fact of arr(criticalFacts)) {
    if (!containsFact(replyText, fact)) {
      missing.push(fact);
      continue;
    }

    if (!hasCleanValueBoundary(replyText, fact)) {
      unsafeBoundary.push(fact);
    }
  }

  if (missing.length || unsafeBoundary.length) {
    return {
      ok: false,
      reason: missing.length
        ? "localized_reply_dropped_fact"
        : "localized_reply_attached_text_to_fact",
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

function classificationIntents(classification = {}) {
  return uniqStrings([
    ...arr(classification?.intents),
    classification?.primaryIntent,
  ]);
}

function isDirectFactRequest(classification = {}) {
  const intents = classificationIntents(classification);
  const hasDirectFact = intents.some((intent) => DIRECT_FACT_INTENTS.has(intent));
  if (!hasDirectFact) return false;

  return !intents.some((intent) => NON_DIRECT_CHAT_INTENTS.has(intent));
}

function countSentenceLikeUnits(text = "") {
  const protectedResult = protectMachineSpans(text);
  const cleaned = s(protectedResult.text)
    .replace(/\[\[AIHQ_FACT_\d+\]\]/g, "FACT")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return 0;

  const matches = cleaned.match(/[.!?؟]+(?:\s|$)/gu);
  if (matches?.length) return matches.length;

  return 1;
}

function validateDirectFactShape({
  baseReply = "",
  replyText = "",
  classification = {},
} = {}) {
  if (!isDirectFactRequest(classification)) {
    return {
      ok: true,
      reason: "",
    };
  }

  const baseCount = countSentenceLikeUnits(baseReply);
  const replyCount = countSentenceLikeUnits(replyText);
  const maxCount = Math.max(1, baseCount);

  if (replyCount > maxCount) {
    return {
      ok: false,
      reason: "direct_fact_reply_added_extra_chat_tail",
    };
  }

  return {
    ok: true,
    reason: "",
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
  return normalizeReplyWhitespace(replyText, criticalFacts);
}

export async function localizeApprovedTruthAnswer({
  replyText = "",
  targetLanguage = "az",
  customerText = "",
  classification = {},
  facts = {},
  repeatContext = {},
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
  const protectedAnswer = protectFactsInText(safeFallbackReply, criticalFacts);
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
  const directFactRequest = isDirectFactRequest(classification);
  const repeatedApprovedFactRequest = repeatContext?.isRepeat === true;

  const systemPrompt = [
    "You are a safe multilingual response localizer for a governed business AI system.",
    "You only rewrite the approved answer into the customer's language.",
    "You do not create, infer, remove, translate, or modify business facts.",
    "All fact tokens like [[AIHQ_FACT_1]] are immutable atomic values.",
    "Keep every fact token exactly as provided.",
    "Never attach letters, grammar suffixes, particles, punctuation-as-word, or any other characters directly to a fact token.",
    "Always keep a space or punctuation boundary around fact tokens.",
    "For email, phone, URL, price, name, address, service, and product facts, prefer clean label formatting when needed.",
    "Good: 'Email: [[AIHQ_FACT_1]].'",
    "Good: 'Phone: [[AIHQ_FACT_2]].'",
    "Bad: '[[AIHQ_FACT_1]]dır'.",
    "Bad: '[[AIHQ_FACT_1]]-dır'.",
    "Bad: '[[AIHQ_FACT_1]] is our email' if the target language is not English.",
    "Do not mention approved truth, backend, policy, validator, system, AI, internal rules, or tokens.",
    "Do not add emojis unless the approved answer already contains emojis.",
    "Keep the final message short and natural for customer chat.",
    directFactRequest
      ? "The customer asked for a direct fact. Do not add a generic help question or extra CTA."
      : "If helpful, keep the tone polite, but do not add new factual claims.",
    repeatedApprovedFactRequest
      ? "Repeat handling rule: the customer is asking for a fact that was already answered earlier. Keep the same facts, but do not repeat the exact same wording. You may naturally say the information is unchanged/still the same in the target language."
      : "No repeat handling is needed.",
    "If the customer writes in a language not listed anywhere, infer that language and answer in it.",
  ].join("\n");

  const userPrompt = JSON.stringify({
    targetLanguage: language,
    latestCustomerMessage: s(customerText),
    approvedAnswerWithFactTokens: protectedAnswer,
    directFactRequest,
    criticalFactTokens: criticalFacts.map((fact) => ({
      token: fact.token,
      kind: fact.kind,
      key: fact.key,
    })),
    repeatContext: {
      repeatedApprovedFactRequest,
      previousBusinessReply: repeatedApprovedFactRequest
        ? s(repeatContext?.previousBusinessReply).slice(0, 500)
        : "",
      repeatReason: repeatedApprovedFactRequest
        ? s(repeatContext?.reason)
        : "",
    },
    style: {
      tone: "natural_business_chat",
      maxSentences: directFactRequest
        ? Math.max(1, countSentenceLikeUnits(protectedAnswer))
        : 2,
      cleanMachineValues: true,
      noInternalLanguage: true,
      noGenericHelpTailForDirectFacts: directFactRequest,
      avoidExactPreviousWording: repeatedApprovedFactRequest,
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let localizedReplyWithTokens = s(
      parseJson(extractOutputText(response))?.replyText
    );

    if (!localizedReplyWithTokens) {
      return {
        replyText: safeFallbackReply,
        localized: false,
        reason: "empty_localized_reply",
        language,
      };
    }

    localizedReplyWithTokens = normalizeReplyWhitespace(
      localizedReplyWithTokens,
      criticalFacts
    );

    const tokenValidation = validateTokenizedReply({
      replyText: localizedReplyWithTokens,
      criticalFacts,
    });

    if (!tokenValidation.ok) {
      return {
        replyText: safeFallbackReply,
        localized: false,
        reason: tokenValidation.reason,
        language,
      };
    }

    let restoredReply = restoreFactTokens(localizedReplyWithTokens, criticalFacts);
    restoredReply = normalizeReplyWhitespace(restoredReply, criticalFacts);

    const restoredValidation = validateRestoredReply({
      replyText: restoredReply,
      criticalFacts,
    });

    if (!restoredValidation.ok) {
      return {
        replyText: safeFallbackReply,
        localized: false,
        reason: restoredValidation.reason,
        language,
      };
    }

    const shapeValidation = validateDirectFactShape({
      baseReply: safeFallbackReply,
      replyText: restoredReply,
      classification,
    });

    if (!shapeValidation.ok) {
      return {
        replyText: safeFallbackReply,
        localized: false,
        reason: shapeValidation.reason,
        language,
      };
    }

    return {
      replyText: restoredReply,
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
  hasCleanTokenBoundary,
  hasCleanValueBoundary,
  validateTokenizedReply,
  validateRestoredReply,
  validateDirectFactShape,
  repairMachineFactSpacing,
};
