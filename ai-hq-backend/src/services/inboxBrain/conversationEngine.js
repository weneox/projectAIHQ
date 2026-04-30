import OpenAI from "openai";
import { cfg } from "../../config.js";
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import { buildPromptBundle } from "../promptBundle.js";
import {
  buildKnowledgeReply,
  buildPlaybookReply,
  buildUnsupportedServiceReply,
} from "./fallback.js";
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  getIndustryHints,
  pickBehaviorLeadPrompt,
  pickLeadPrompt,
  resolveInboxRuntime,
} from "./runtime.js";
import {
  arr,
  getResolvedTenantKey,
  lower,
  normalizeTextForCompare,
  obj,
  s,
  sanitizeReplyText,
  uniqStrings,
} from "./shared.js";
import {
  buildHistorySnippet,
  extractStructuredPayload,
  extractText,
  parseJsonLoose,
  stripLeadingCommand,
} from "./messages.js";
import { composeTenantAwareReply } from "./replyComposer.js";

let openaiSingleton = null;

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function normalizeLanguage(value = "") {
  const x = lower(value);
  if (!x) return "en";
  if (x.startsWith("az")) return "az";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";
  if (x.startsWith("nl")) return "nl";
  if (x.startsWith("pl")) return "pl";
  if (x.startsWith("uk")) return "uk";
  if (x.startsWith("zh")) return "zh";
  if (x.startsWith("ja")) return "ja";
  if (x.startsWith("ko")) return "ko";
  if (x.startsWith("hi")) return "hi";
  return "en";
}

function compactJson(value, max = 7000) {
  try {
    const raw = JSON.stringify(value ?? {});
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}…`;
  } catch {
    return "{}";
  }
}

function safePreview(value = "", max = 280) {
  const text = s(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function safeJsonPreview(value, max = 900) {
  try {
    const raw = JSON.stringify(value ?? {});
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}…`;
  } catch {
    return "";
  }
}

function logConversationEngine(event = "", payload = {}) {
  try {
    console.info(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function logConversationEngineWarn(event = "", payload = {}) {
  try {
    console.warn(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function logConversationEngineError(event = "", payload = {}) {
  try {
    console.error(`[ai-hq] conversation engine ${event}`, payload);
  } catch {}
}

function modelLikelySupportsStructuredOutputs(model = "") {
  const x = lower(model);
  return (
    x.startsWith("gpt-4o") ||
    x.startsWith("gpt-4.1") ||
    x.startsWith("gpt-5") ||
    x.startsWith("o1") ||
    x.startsWith("o3") ||
    x.startsWith("o4")
  );
}

function buildConversationDecisionJsonSchemaObject() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string" },
      understoodIntent: { type: "string" },
      detectedService: { type: "string" },
      customerGoal: { type: "string" },
      answerFirst: { type: "string" },
      nextQuestion: { type: "string" },
      replyText: { type: "string" },
      missingInformation: {
        type: "array",
        items: { type: "string" },
      },
      groundedFactsUsed: {
        type: "array",
        items: { type: "string" },
      },
      shouldAskQuestion: { type: "boolean" },
      shouldCreateLead: { type: "boolean" },
      shouldHandoff: { type: "boolean" },
      handoffReason: { type: "string" },
      handoffPriority: { type: "string" },
      confidence: { type: "number" },
      leadScore: { type: "number" },
      askCategory: { type: "string" },
      stage: { type: "string" },
      replyStyle: { type: "string" },
      noReply: { type: "boolean" },
    },
    required: [
      "language",
      "understoodIntent",
      "detectedService",
      "customerGoal",
      "answerFirst",
      "nextQuestion",
      "replyText",
      "missingInformation",
      "groundedFactsUsed",
      "shouldAskQuestion",
      "shouldCreateLead",
      "shouldHandoff",
      "handoffReason",
      "handoffPriority",
      "confidence",
      "leadScore",
      "askCategory",
      "stage",
      "replyStyle",
      "noReply",
    ],
  };
}

function buildStructuredTextFormat(model = "") {
  if (modelLikelySupportsStructuredOutputs(model)) {
    return {
      type: "json_schema",
      name: "tenant_sales_conversation_decision",
      strict: true,
      schema: buildConversationDecisionJsonSchemaObject(),
    };
  }

  return {
    type: "json_object",
  };
}

function parseStructuredOutput(raw = "", model = "") {
  if (!s(raw)) return null;

  if (modelLikelySupportsStructuredOutputs(model)) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return parseJsonLoose(raw);
}

function extractResponseRefusal(resp = {}) {
  for (const outputItem of arr(resp?.output)) {
    for (const contentItem of arr(outputItem?.content)) {
      if (contentItem?.type === "refusal") {
        return s(contentItem?.refusal || contentItem?.text || "");
      }
    }
  }
  return "";
}

function summarizeResponseShape(response = {}) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const firstOutput = output[0] || null;
  const firstContent = Array.isArray(firstOutput?.content)
    ? firstOutput.content[0] || null
    : null;

  return {
    topLevelKeys: Object.keys(obj(response)).slice(0, 30),
    status: s(response?.status || ""),
    hasOutputText: Boolean(s(response?.output_text || "")),
    hasTopLevelParsed: Boolean(response?.output_parsed || response?.parsed),
    outputLength: output.length,
    outputTypes: output.map((item) => s(item?.type)).filter(Boolean).slice(0, 10),
    contentTypes: output
      .flatMap((item) =>
        Array.isArray(item?.content)
          ? item.content.map((block) => s(block?.type)).filter(Boolean)
          : []
      )
      .slice(0, 20),
    firstOutputType: s(firstOutput?.type || ""),
    firstContentType: s(firstContent?.type || ""),
    firstOutputPreview: safeJsonPreview(firstOutput, 700),
    firstContentPreview: safeJsonPreview(firstContent, 700),
    outputTextPreview: safePreview(s(response?.output_text || ""), 280),
  };
}

function buildResponseCreateArgs({
  model,
  maxOutputTokens,
  systemPrompt,
  userPrompt,
}) {
  const isGpt5 = lower(model).startsWith("gpt-5");

  return {
    model,
    ...(isGpt5 ? { reasoning: { effort: "minimal" } } : {}),
    max_output_tokens: maxOutputTokens,
    text: {
      format: buildStructuredTextFormat(model),
      ...(isGpt5 ? { verbosity: "low" } : {}),
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
  };
}

function isReasoningOnlyEmptyResponse({
  parsed = null,
  raw = "",
  refusal = "",
  response = {},
}) {
  if (refusal) return false;
  if (parsed && typeof parsed === "object") return false;
  if (s(raw)) return false;

  const output = Array.isArray(response?.output) ? response.output : [];
  if (!output.length) return true;

  const onlyReasoning = output.every(
    (item) => s(item?.type) === "reasoning" || !s(item?.type)
  );

  return onlyReasoning;
}

async function requestStructuredDecisionOnce({
  openai,
  model,
  maxOutputTokens,
  systemPrompt,
  userPrompt,
}) {
  const response = await openai.responses.create(
    buildResponseCreateArgs({
      model,
      maxOutputTokens,
      systemPrompt,
      userPrompt,
    })
  );

  const parsed = extractStructuredPayload(response);
  const raw = parsed ? JSON.stringify(parsed) : extractText(response);
  const refusal = extractResponseRefusal(response);

  logConversationEngine("response_shape", {
    model,
    ...summarizeResponseShape(response),
  });

  logConversationEngine("response_extract", {
    model,
    hasParsed: Boolean(parsed),
    parsedKeys:
      parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
    rawPreview: safePreview(raw, 500),
    refusalPreview: safePreview(refusal, 220),
  });

  return {
    response,
    parsed,
    raw,
    refusal,
  };
}

async function runStructuredDecision({
  openai,
  model,
  maxOutputTokens,
  systemPrompt,
  userPrompt,
}) {
  const primary = await requestStructuredDecisionOnce({
    openai,
    model,
    maxOutputTokens,
    systemPrompt,
    userPrompt,
  });

  if (
    !isReasoningOnlyEmptyResponse({
      parsed: primary.parsed,
      raw: primary.raw,
      refusal: primary.refusal,
      response: primary.response,
    })
  ) {
    return {
      raw: primary.raw,
      refusal: primary.refusal,
      parsed: primary.parsed,
      modelUsed: model,
    };
  }

  const fallbackModel = lower(model).startsWith("gpt-5")
    ? s(cfg?.ai?.openaiStructuredFallbackModel || "gpt-4.1-mini") ||
      "gpt-4.1-mini"
    : "";

  if (!fallbackModel || lower(fallbackModel) === lower(model)) {
    return {
      raw: primary.raw,
      refusal: primary.refusal,
      parsed: primary.parsed,
      modelUsed: model,
    };
  }

  logConversationEngineWarn("reasoning_only_empty_response_retrying", {
    primaryModel: model,
    fallbackModel,
    maxOutputTokens,
  });

  const fallback = await requestStructuredDecisionOnce({
    openai,
    model: fallbackModel,
    maxOutputTokens: Math.max(1200, maxOutputTokens),
    systemPrompt,
    userPrompt,
  });

  return {
    raw: fallback.raw,
    refusal: fallback.refusal,
    parsed: fallback.parsed,
    modelUsed: fallbackModel,
  };
}

function normalizeFreeText(value = "") {
  return lower(s(value))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWordLikeTokens(text = "") {
  const normalized = normalizeFreeText(text);
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}

function isSubstantiveCustomerTurn(text = "") {
  const normalized = normalizeFreeText(text);
  if (!normalized) return false;
  if (normalized.length >= 18) return true;
  if (countWordLikeTokens(normalized) >= 4) return true;
  if (/[?؟]/u.test(s(text))) return true;
  return false;
}

function normalizePriority(value = "") {
  const x = lower(value);
  return ["low", "normal", "high", "urgent"].includes(x) ? x : "normal";
}

function normalizeReplyStyle(value = "") {
  const x = lower(value);
  if (
    [
      "consultative",
      "direct",
      "reassuring",
      "concise",
      "sales",
      "supportive",
      "professional",
    ].includes(x)
  ) {
    return x;
  }
  return "sales";
}

function normalizeStage(value = "") {
  const x = lower(value);
  if (
    [
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
      "contact_capture",
    ].includes(x)
  ) {
    return x;
  }
  return "discovery";
}

function normalizeAskCategory(value = "") {
  const x = lower(value);
  if (
    [
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
      "contact",
    ].includes(x)
  ) {
    return x;
  }
  return "service_interest";
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const x = lower(value);
    if (["true", "1", "yes"].includes(x)) return true;
    if (["false", "0", "no"].includes(x)) return false;
  }
  return fallback;
}

function coerceNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceStringArray(value = []) {
  return uniqStrings(
    arr(value)
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return s(item.label || item.name || item.value || item.key);
        }
        return s(item);
      })
      .filter(Boolean)
  );
}

function sanitizeSentence(value = "") {
  return sanitizeReplyText(s(value).replace(/\s+/g, " "));
}

function joinReplyParts(answerFirst = "", nextQuestion = "") {
  const first = sanitizeSentence(answerFirst);
  const second = sanitizeSentence(nextQuestion);

  if (!first && !second) return "";
  if (first && !second) return first;
  if (!first && second) return second;

  const firstBase = lower(first.replace(/[.?!]+$/g, ""));
  const secondBase = lower(second.replace(/[.?!]+$/g, ""));
  if (firstBase && firstBase === secondBase) return first;

  return sanitizeReplyText(`${first} ${second}`);
}

function countQuestions(text = "") {
  return (s(text).match(/[?؟]/g) || []).length;
}

function containsInternalStrategyLeak(text = "") {
  const normalized = s(text);

  if (!normalized) return false;

  return /(?:^|[\s(])(?:qiym[eə]t[_-]?range|price[_-]?range|scope[_-]?clarify[_-]?single|qualify[_-]?single|sales[_-]?stage|lead[_-]?capture|contact[_-]?capture|cta[_-]?next|reply[_-]?style|ask[_-]?category|intent[_-]?key|crm[_-]?capture|discovery[_-]?mode)(?:$|[\s):,.!?])/iu.test(
    normalized
  );
}

function looksLikeWeakAcknowledgeOnly(text = "") {
  const normalized = normalizeTextForCompare(text);
  if (!normalized) return true;

  return [
    "basa dusdum bununla komek ede bilerem",
    "basa dusdum",
    "anladim bununla yardimci olabilirim",
    "understood i can help with that",
    "yes",
    "ok",
  ].includes(normalized);
}

function buildConversationSnapshot({
  text,
  recentMessages = [],
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  threadState = null,
}) {
  const latestMessage = s(text);
  const latestMessageWithoutCommand = stripLeadingCommand(latestMessage);
  const historySnippet = buildHistorySnippet(recentMessages, 8);

  return {
    latestCustomerMessage: latestMessage,
    latestCustomerMessageWithoutCommand:
      latestMessageWithoutCommand || latestMessage,
    historySnippet: historySnippet || "(empty)",
    customerContext: obj(customerContext),
    formData: obj(formData),
    leadContext: obj(leadContext),
    conversationContext: obj(conversationContext),
    threadState: obj(threadState),
  };
}

function normalizeContactType(value = "") {
  const x = lower(value);
  if (!x) return "";

  if (["phone", "mobile", "tel", "call"].includes(x)) return "phone";
  if (["whatsapp", "wa"].includes(x)) return "whatsapp";
  if (["telegram", "tg"].includes(x)) return "telegram";
  if (["email", "mail", "e-mail"].includes(x)) return "email";
  if (["website", "site", "web"].includes(x)) return "website";
  if (["instagram", "ig"].includes(x)) return "instagram";
  if (["facebook", "fb", "messenger"].includes(x)) return "facebook";

  return x;
}

function normalizePhoneComparable(value = "") {
  return s(value).replace(/[^\d+]/g, "");
}

function inferOfferRequest(text = "") {
  const normalized = normalizeFreeText(text);

  return [
    "teklif",
    "offer",
    "proposal",
    "package",
    "paket",
    "xidmet nedir",
    "xidmət nədir",
    "ne edirsiz",
    "nə edirsiniz",
    "what do you offer",
    "what is your offer",
  ].some((item) => normalized.includes(normalizeFreeText(item)));
}

function inferPricingRequest(text = "") {
  const normalized = normalizeFreeText(text);

  return [
    "qiymet",
    "qiymət",
    "price",
    "pricing",
    "cost",
    "budget",
    "fee",
  ].some((item) => normalized.includes(normalizeFreeText(item)));
}

function inferPhoneRequest(text = "") {
  const normalized = normalizeFreeText(text);

  return [
    "nomre",
    "nömrə",
    "telefon",
    "elaqe",
    "əlaqə",
    "phone",
    "number",
    "call",
    "zeng",
    "zəng",
    "whatsapp",
    "vatsap",
  ].some((item) => normalized.includes(normalizeFreeText(item)));
}

function inferEmailRequest(text = "") {
  const normalized = normalizeFreeText(text);

  return [
    "email",
    "mail",
    "e poct",
    "e-poct",
    "e-poçt",
    "poct",
    "poçt",
  ].some((item) => normalized.includes(normalizeFreeText(item)));
}

function inferWebsiteRequest(text = "") {
  const normalized = normalizeFreeText(text);

  return [
    "website",
    "web site",
    "sayt",
    "site",
    "link",
    "website link",
    "site link",
  ].some((item) => normalized.includes(normalizeFreeText(item)));
}

function inferContactRequest(text = "") {
  return (
    inferPhoneRequest(text) ||
    inferEmailRequest(text) ||
    inferWebsiteRequest(text)
  );
}


function buildGroundedContactDecision({ text = "", runtimeGrounding = {} } = {}) {
  const contact = obj(runtimeGrounding?.contactGrounding);

  const wantsPhone = inferPhoneRequest(text);
  const wantsEmail = inferEmailRequest(text);
  const wantsWebsite = inferWebsiteRequest(text);
  const wantsGeneralContact = inferContactRequest(text);

  if (!wantsPhone && !wantsEmail && !wantsWebsite && !wantsGeneralContact) {
    return null;
  }

  const phone = s(contact.primaryPhone || arr(contact.contactPhones)[0]);
  const email = s(contact.primaryEmail || arr(contact.contactEmails)[0]);
  const website = s(contact.websiteUrl || arr(contact.websiteUrls)[0]);

  const parts = [];
  const factsUsed = [];

  if (wantsPhone && phone) {
    parts.push(`Əlaqə nömrəmiz: ${phone}.`);
    factsUsed.push(`Primary phone: ${phone}`);
  }

  if (wantsEmail && email) {
    parts.push(`E-poçt ünvanımız: ${email}.`);
    factsUsed.push(`Primary email: ${email}`);
  }

  if (wantsWebsite && website) {
    parts.push(`Vebsayt: ${website}.`);
    factsUsed.push(`Website: ${website}`);
  }

  if (!parts.length && wantsGeneralContact) {
    if (phone) {
      parts.push(`Əlaqə nömrəmiz: ${phone}.`);
      factsUsed.push(`Primary phone: ${phone}`);
    }

    if (email) {
      parts.push(`E-poçt ünvanımız: ${email}.`);
      factsUsed.push(`Primary email: ${email}`);
    }

    if (website) {
      parts.push(`Vebsayt: ${website}.`);
      factsUsed.push(`Website: ${website}`);
    }
  }

  const replyText = sanitizeReplyText(parts.join(" "));

  if (!replyText) return null;

  return {
    language: normalizeLanguage(arr(runtimeGrounding?.languages)[0] || "az"),
    understoodIntent: "ask_contact_details",
    detectedService: "",
    customerGoal: "approved_contact_details",
    answerFirst: replyText,
    nextQuestion: "",
    replyText,
    missingInformation: [],
    groundedFactsUsed: factsUsed,
    shouldAskQuestion: false,
    shouldCreateLead: false,
    shouldHandoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    confidence: 0.99,
    leadScore: 0,
    askCategory: "contact",
    stage: "answer",
    replyStyle: "direct",
    noReply: false,
  };
}

function firstRuntimeText(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function getApprovedProjectionView(profile = {}) {
  const projection = obj(profile?.raw?.projection);

  return {
    projection,
    identity: obj(projection?.identity_json),
    profileJson: obj(projection?.profile_json),
    capabilitiesJson: obj(projection?.capabilities_json),
    inboxJson: obj(projection?.inbox_json),
    commentsJson: obj(projection?.comments_json),
    contentJson: obj(projection?.content_json),
    behaviorJson: obj(projection?.behavior_json),
    contactsJson: arr(projection?.contacts_json),
    locationsJson: arr(projection?.locations_json),
    servicesJson: arr(projection?.services_json),
  };
}

function normalizeRuntimeContactEntry(item = {}) {
  const x = obj(item);

  return {
    type: normalizeContactType(
      x.type ||
        x.channel ||
        x.contactType ||
        x.contact_type ||
        x.kind ||
        ""
    ),
    label: s(x.label || x.title || x.name),
    value: s(
      x.value ||
        x.contactValue ||
        x.contact_value ||
        x.phone ||
        x.phoneNumber ||
        x.phone_number ||
        x.email ||
        x.website ||
        x.url ||
        x.href ||
        ""
    ),
    primary:
      x.primary === true ||
      x.isPrimary === true ||
      x.is_primary === true,
    public:
      x.public !== false &&
      x.isPublic !== false &&
      x.is_public !== false &&
      x.visiblePublic !== false &&
      x.visible_public !== false &&
      x.visibleInAi !== false &&
      x.visible_in_ai !== false,
  };
}

function normalizeRuntimeLocationEntry(item = {}) {
  const x = obj(item);

  return {
    title: s(x.title || x.label || x.name),
    address: s(x.address || x.addressLine || x.address_line),
    city: s(x.city),
    region: s(x.region),
    country: s(x.country),
    primary:
      x.primary === true ||
      x.isPrimary === true ||
      x.is_primary === true,
  };
}

function pickRuntimeContactValue(contacts = [], types = []) {
  const wanted = new Set(arr(types).map((item) => normalizeContactType(item)));

  const primary = arr(contacts).find(
    (item) =>
      wanted.has(normalizeContactType(item?.type)) &&
      item?.public !== false &&
      item?.primary === true &&
      s(item?.value)
  );

  if (primary?.value) return s(primary.value);

  const firstPublic = arr(contacts).find(
    (item) =>
      wanted.has(normalizeContactType(item?.type)) &&
      item?.public !== false &&
      s(item?.value)
  );

  return s(firstPublic?.value);
}

function listRuntimeContactValues(contacts = [], types = []) {
  const wanted = new Set(arr(types).map((item) => normalizeContactType(item)));

  return uniqStrings(
    arr(contacts)
      .filter((item) => wanted.has(normalizeContactType(item?.type)))
      .filter((item) => item?.public !== false)
      .map((item) => s(item?.value))
      .filter(Boolean)
  );
}

function buildSalesContext(profile = {}) {
  const approved = getApprovedProjectionView(profile);
  const profileJson = approved.profileJson;
  const behavior = approved.behaviorJson;
  const content = approved.contentJson;

  const industryHints = getIndustryHints(
    firstRuntimeText(profileJson.industryKey, approved.identity.industryKey, profile?.industry)
  );

  const primaryCta = s(
    firstRuntimeText(
      profileJson.preferredCta,
      behavior.primaryCta,
      behavior.primary_cta,
      content.ctaStyle,
      profile?.primaryCta,
      profile?.conversationAssets?.primaryCtaRaw,
      pickLeadPrompt(profile),
      pickBehaviorLeadPrompt(profile)
    )
  );

  const catalog = arr(profile?.serviceCatalog).length
    ? arr(profile?.serviceCatalog)
    : approved.servicesJson;

  const keyOffers = catalog
    .filter((item) => item?.active !== false && item?.visibleInAi !== false)
    .map((item) => ({
      key: s(item?.key || item?.serviceKey || item?.service_key),
      name: s(item?.name || item?.title),
      description: s(item?.description),
      pricingMode: s(item?.pricingMode || item?.pricing_model),
      responseMode: s(item?.responseMode || item?.response_mode),
      contactCaptureMode: s(item?.contactCaptureMode || item?.contact_capture_mode),
    }))
    .slice(0, 8);

  return {
    primaryCta,
    qualificationPrompts: uniqStrings([
      ...arr(behavior.qualificationQuestions),
      ...arr(behavior.qualification_questions),
      ...arr(profile?.qualificationQuestions),
      ...arr(profile?.leadPrompts),
    ]).slice(0, 6),
    pricingHint: s(industryHints?.pricingHint || ""),
    offerNames: keyOffers.map((item) => item.name).filter(Boolean),
    keyOffers,
  };
}

function buildContactGrounding(profile = {}) {
  const approved = getApprovedProjectionView(profile);
  const profileJson = approved.profileJson;

  const hasApprovedContacts = approved.contactsJson.length > 0;
  const hasApprovedLocations = approved.locationsJson.length > 0;

  const normalizedContacts = [
    ...approved.contactsJson,
    ...(hasApprovedContacts ? [] : arr(profile?.contacts)),
    ...(hasApprovedContacts ? [] : arr(profile?.meta?.contacts)),
    ...(hasApprovedContacts ? [] : arr(profile?.profile?.extra_context?.contacts)),
  ]
    .map(normalizeRuntimeContactEntry)
    .filter((item) => item.value)
    .slice(0, 30);

  const normalizedLocations = [
    ...approved.locationsJson,
    ...(hasApprovedLocations ? [] : arr(profile?.locations)),
    ...(hasApprovedLocations ? [] : arr(profile?.meta?.locations)),
    ...(hasApprovedLocations ? [] : arr(profile?.profile?.extra_context?.locations)),
  ]
    .map(normalizeRuntimeLocationEntry)
    .filter((item) => item.title || item.address || item.city)
    .slice(0, 12);

  const profilePhone = firstRuntimeText(
    profileJson.primaryPhone,
    profile?.primaryPhone,
    profile?.publicPhone
  );

  const profileEmail = firstRuntimeText(
    profileJson.primaryEmail,
    profile?.primaryEmail,
    profile?.publicEmail
  );

  const profileWebsite = firstRuntimeText(
    profileJson.websiteUrl,
    approved.identity.websiteUrl,
    profile?.websiteUrl
  );

  const profileAddress = firstRuntimeText(
    profileJson.primaryAddress,
    profile?.primaryAddress
  );

  const contactPhone = pickRuntimeContactValue(normalizedContacts, [
    "phone",
    "whatsapp",
  ]);

  const contactEmail = pickRuntimeContactValue(normalizedContacts, ["email"]);
  const contactWebsite = pickRuntimeContactValue(normalizedContacts, ["website"]);

  const locationAddress = firstRuntimeText(
    arr(normalizedLocations).find((item) => item?.primary && s(item?.address))
      ?.address,
    arr(normalizedLocations).find((item) => s(item?.address))?.address
  );

  const primaryPhone = firstRuntimeText(profilePhone, contactPhone);
  const primaryEmail = firstRuntimeText(profileEmail, contactEmail);
  const websiteUrl = firstRuntimeText(profileWebsite, contactWebsite);
  const primaryAddress = firstRuntimeText(profileAddress, locationAddress);

  return {
    primaryPhone,
    primaryEmail,
    websiteUrl,
    primaryAddress,

    contactPhones: uniqStrings([
      primaryPhone,
      ...(profilePhone
        ? []
        : listRuntimeContactValues(normalizedContacts, ["phone", "whatsapp"])),
      ...(profilePhone || hasApprovedContacts
        ? []
        : arr(profile?.contactPhones).map((x) => s(x))),
    ]).slice(0, 8),

    contactEmails: uniqStrings([
      primaryEmail,
      ...(profileEmail
        ? []
        : listRuntimeContactValues(normalizedContacts, ["email"])),
      ...(profileEmail || hasApprovedContacts
        ? []
        : arr(profile?.contactEmails).map((x) => s(x))),
    ]).slice(0, 8),

    websiteUrls: uniqStrings([
      websiteUrl,
      ...(profileWebsite
        ? []
        : listRuntimeContactValues(normalizedContacts, ["website"])),
      ...(profileWebsite || hasApprovedContacts
        ? []
        : arr(profile?.websiteUrls).map((x) => s(x))),
    ]).slice(0, 8),

    contactAddresses: uniqStrings([
      primaryAddress,
      ...(profileAddress
        ? []
        : arr(normalizedLocations).map((item) => s(item?.address))),
      ...(profileAddress || hasApprovedLocations
        ? []
        : arr(profile?.contactAddresses).map((x) => s(x))),
    ]).slice(0, 8),

    contacts: normalizedContacts,
    locations: normalizedLocations,
  };
}

function buildRuntimeGrounding(profile = {}) {
  const approved = getApprovedProjectionView(profile);
  const profileJson = approved.profileJson;
  const identity = approved.identity;
  const capabilities = approved.capabilitiesJson;
  const content = approved.contentJson;
  const behavior = approved.behaviorJson;
  const comments = approved.commentsJson;

  const serviceCatalog = arr(profile?.serviceCatalog).length
    ? arr(profile?.serviceCatalog)
    : approved.servicesJson;

  const salesContext = buildSalesContext({
    ...profile,
    serviceCatalog,
  });

  const contactGrounding = buildContactGrounding(profile);

  const approvedServices = uniqStrings([
    ...approved.servicesJson.map((item) => s(item?.title || item?.name)),
    ...arr(profile?.services).map((item) => s(item)),
  ]).slice(0, 24);

  return {
    displayName: firstRuntimeText(
      identity.displayName,
      profileJson.displayName,
      profileJson.companyName,
      identity.companyName,
      profile?.displayName,
      profile?.companyName
    ),
    industry: firstRuntimeText(profileJson.industryKey, identity.industryKey, profile?.industry),
    businessSummary: firstRuntimeText(
      profileJson.summaryShort,
      profileJson.summaryLong,
      profileJson.valueProposition,
      profile?.businessSummary
    ),
    businessType: firstRuntimeText(behavior.businessType, behavior.business_type, profile?.businessType),
    niche: firstRuntimeText(behavior.niche, profile?.niche),
    subNiche: firstRuntimeText(behavior.subNiche, behavior.sub_niche, profile?.subNiche),
    languages: uniqStrings([
      ...arr(identity.supportedLanguages).map((x) => s(x)),
      ...arr(profileJson.supportedLanguages).map((x) => s(x)),
      capabilities.primaryLanguage,
      profileJson.mainLanguage,
      ...arr(profile?.languages).map((x) => s(x)),
    ]).filter(Boolean).slice(0, 6),
    tone: firstRuntimeText(profileJson.toneProfile, content.toneProfile, capabilities.replyStyle, profile?.tone),
    toneProfile: firstRuntimeText(profileJson.toneProfile, content.toneProfile, profile?.toneProfile),
    replyStyle: firstRuntimeText(capabilities.replyStyle, profile?.replyStyle),
    replyLength: firstRuntimeText(capabilities.replyLength, profile?.replyLength),
    pricingMode: firstRuntimeText(capabilities.pricingMode, profile?.pricingMode),
    bookingMode: firstRuntimeText(capabilities.bookingMode, profile?.bookingMode),
    salesMode: firstRuntimeText(capabilities.salesMode, profile?.salesMode),
    conversionGoal: firstRuntimeText(behavior.conversionGoal, behavior.conversion_goal, profile?.conversionGoal),
    primaryCta: firstRuntimeText(
      behavior.primaryCta,
      behavior.primary_cta,
      profileJson.preferredCta,
      content.ctaStyle,
      profile?.primaryCta
    ),
    leadQualificationMode: firstRuntimeText(
      behavior.leadQualificationMode,
      behavior.lead_qualification_mode,
      profile?.leadQualificationMode
    ),
    bookingFlowType: firstRuntimeText(
      behavior.bookingFlowType,
      behavior.booking_flow_type,
      capabilities.bookingMode,
      profile?.bookingFlowType
    ),
    qualificationQuestions: uniqStrings([
      ...arr(behavior.qualificationQuestions).map((x) => s(x)),
      ...arr(behavior.qualification_questions).map((x) => s(x)),
      ...arr(profile?.qualificationQuestions).map((x) => s(x)),
    ]).slice(0, 6),
    leadPrompts: arr(profile?.leadPrompts).map((x) => s(x)).filter(Boolean).slice(0, 5),
    handoffTriggers: uniqStrings([
      ...arr(behavior.handoffTriggers).map((x) => s(x)),
      ...arr(behavior.handoff_triggers).map((x) => s(x)),
      ...arr(profile?.handoffTriggers).map((x) => s(x)),
    ]).slice(0, 10),
    disallowedClaims: uniqStrings([
      ...arr(behavior.disallowedClaims).map((x) => s(x)),
      ...arr(behavior.disallowed_claims).map((x) => s(x)),
      ...arr(profile?.disallowedClaims).map((x) => s(x)),
    ]).slice(0, 12),
    maxReplySentences: Number(comments.maxReplySentences || profile?.maxSentences || 0) || 2,
    services: serviceCatalog
      .filter((item) => item?.visibleInAi !== false)
      .map((item) => ({
        key: s(item?.key || item?.serviceKey || item?.service_key),
        name: s(item?.name || item?.title),
        description: s(item?.description),
        aliases: arr(item?.aliases).map((x) => s(x)).filter(Boolean).slice(0, 10),
        active: item?.active !== false,
        faqAnswer: s(item?.faqAnswer),
        disabledReplyText: s(item?.disabledReplyText),
        responseMode: s(item?.responseMode),
        pricingMode: s(item?.pricingMode || item?.pricing_model || capabilities.pricingMode),
        contactCaptureMode: s(item?.contactCaptureMode),
        handoffMode: s(item?.handoffMode),
      }))
      .slice(0, 24),
    activeServiceNames: approvedServices,
    disabledServiceNames: arr(profile?.disabledServices).map((x) => s(x)).filter(Boolean).slice(0, 20),
    pricingHints: uniqStrings([
      ...arr(profile?.meta?.pricingHints).map((x) => s(x)),
      ...arr(profile?.pricingHints).map((x) => s(x)),
    ]).slice(0, 8),
    bookingLinks: uniqStrings([
      ...arr(profile?.bookingLinks).map((x) => s(x)),
      ...arr(profile?.meta?.bookingLinks).map((x) => s(x)),
    ]).slice(0, 8),
    socialLinks: uniqStrings([
      ...arr(profile?.socialLinks).map((x) => s(x)),
      ...arr(profile?.meta?.socialLinks).map((x) => s(x)),
    ]).slice(0, 12),
    canCaptureLeads: capabilities.canCaptureLeads ?? profile?.canCaptureLeads ?? true,
    canOfferBooking: capabilities.canOfferBooking ?? profile?.canOfferBooking ?? false,
    canOfferConsultation: capabilities.canOfferConsultation ?? profile?.canOfferConsultation ?? false,
    handoffEnabled: capabilities.handoffEnabled ?? profile?.handoffEnabled ?? true,
    salesContext,
    contactGrounding,
  };
}

function buildConversationSystemPrompt() {
  return [
    "You are the sales-mode conversational operator for inbound business leads.",
    "Your goal is not generic chatting. Your goal is to move the lead toward the next best conversion step.",
    "Always understand the business runtime first, then the customer need, then answer naturally in the customer's language.",
    "When the customer already stated a concrete need, do NOT answer with generic lines like 'how can I help' or 'write what you need'.",
    "Sound like a sharp human sales operator: calm, credible, concise, commercially aware.",
    "You must use the tenant grounding: business summary, active services, sales context, contact grounding, lead prompts, CTA direction, and industry constraints.",
    "If contact details are grounded in the runtime and the customer asks for contact, phone, email, WhatsApp, website, or callback route, you MUST use the grounded details directly.",
    "Never invent phone numbers, emails, WhatsApp numbers, contact placeholders, or fake links.",
    "If a grounded phone number exists, prefer giving that exact number instead of saying 'we have a number' or asking the user for the business number again.",
    "If exact pricing is not grounded, say that pricing depends on scope and move toward one focused qualification question.",
    "If the customer asks for the offer, answer concretely with what the business can provide, then move to one best next question.",
    "Prioritize this order: understand need -> frame fit -> qualify one critical detail -> move toward lead capture.",
    "Ask at most one question.",
    "Prefer 1-2 strong sentences, not long walls of text.",
    "Never output internal strategy labels, routing labels, prompt labels, snake_case tags, or English planning tokens.",
    "Forbidden examples include: price_range, scope_clarify_single, qualify_single, sales_stage, ask_category, reply_style, lead_capture.",
    "Return only valid JSON matching the schema.",
  ].join("\n");
}

function buildConversationUserPrompt({
  runtimeGrounding,
  conversation,
  matchedKnowledge,
  matchedPlaybook,
  policy,
}) {
  const latest =
    conversation.latestCustomerMessageWithoutCommand ||
    conversation.latestCustomerMessage;

  return [
    "Tenant runtime grounding:",
    compactJson(runtimeGrounding, 6000),
    "",
    "Top matched knowledge:",
    compactJson(
      matchedKnowledge.slice(0, 4).map((item) => ({
        title: s(item?.title),
        question: s(item?.question),
        answer: s(item?.answer),
        keywords: arr(item?.keywords).slice(0, 8),
        language: s(item?.language),
        score: Number(item?._score || 0),
      })),
      2500
    ),
    "",
    "Top matched playbook:",
    compactJson(
      matchedPlaybook
        ? {
            name: s(matchedPlaybook?.name),
            triggerKeywords: arr(matchedPlaybook?.triggerKeywords).slice(0, 8),
            replyTemplate: s(matchedPlaybook?.replyTemplate),
            actionType: s(matchedPlaybook?.actionType),
            createLead: matchedPlaybook?.createLead === true,
            handoff: matchedPlaybook?.handoff === true,
            handoffReason: s(matchedPlaybook?.handoffReason),
            handoffPriority: s(matchedPlaybook?.handoffPriority),
          }
        : {},
      1500
    ),
    "",
    "Conversation context:",
    compactJson(
      {
        latestCustomerMessage: conversation.latestCustomerMessage,
        latestCustomerMessageWithoutCommand:
          conversation.latestCustomerMessageWithoutCommand,
        historySnippet: conversation.historySnippet,
        customerContext: conversation.customerContext,
        formData: conversation.formData,
        leadContext: conversation.leadContext,
        conversationContext: conversation.conversationContext,
        threadState: conversation.threadState,
        policy: {
          autoReplyEnabled: Boolean(policy?.autoReplyEnabled),
          createLeadEnabled: Boolean(policy?.createLeadEnabled),
          handoffEnabled: Boolean(policy?.handoffEnabled),
        },
      },
      4500
    ),
    "",
    "Sales behavior instructions:",
    "- Treat this as a lead conversation unless the message is clearly support-only.",
    "- Use tenant runtime grounding as the current approved truth. Do not prefer older thread history over it.",
    "- Use tenant runtime grounding as the current approved truth. Do not prefer older thread history over it.",
    "- If the lead asks for contact details and grounded contact details exist, return the exact grounded details directly.",
    "- If the lead asks for the offer, explain the real offer in business language, not abstract wording.",
    "- If the lead asks for pricing, frame pricing honestly and qualify one scope detail.",
    "- If the lead has already chosen a direction, do not restart discovery from zero.",
    "- Your next question must help conversion.",
    `- Customer message right now: ${JSON.stringify(latest)}`,
  ].join("\n");
}

function buildRepairPrompt({
  runtimeGrounding,
  conversation,
  previousRaw = "",
  validationErrors = [],
}) {
  return [
    "The previous JSON decision was rejected.",
    "Repair it.",
    "",
    "Validation errors:",
    compactJson(validationErrors, 2200),
    "",
    "Original tenant grounding:",
    compactJson(runtimeGrounding, 4500),
    "",
    "Original conversation context:",
    compactJson(
      {
        latestCustomerMessage: conversation.latestCustomerMessage,
        latestCustomerMessageWithoutCommand:
          conversation.latestCustomerMessageWithoutCommand,
        historySnippet: conversation.historySnippet,
      },
      2500
    ),
    "",
    "Previous raw JSON:",
    s(previousRaw || ""),
    "",
    "Return corrected JSON only.",
  ].join("\n");
}

function buildServiceLookup(profile = {}) {
  return arr(profile?.serviceCatalog)
    .filter((item) => item?.visibleInAi)
    .map((item) => ({
      ...item,
      _matchTerms: uniqStrings([
        s(item?.key),
        s(item?.name),
        ...arr(item?.aliases).map((x) => s(x)),
      ]),
    }));
}

function buildDisabledServiceLookup(profile = {}) {
  return arr(profile?.serviceCatalog)
    .filter((item) => item?.visibleInAi && item?.active === false)
    .map((item) => ({
      ...item,
      _matchTerms: uniqStrings([
        s(item?.key),
        s(item?.name),
        ...arr(item?.aliases).map((x) => s(x)),
      ]),
    }));
}

function scoreServiceAgainstText(text = "", service = {}) {
  const source = normalizeTextForCompare(text);
  if (!source) return 0;

  let score = 0;
  for (const term of arr(service?._matchTerms)) {
    const normalizedTerm = normalizeTextForCompare(term);
    if (!normalizedTerm) continue;
    if (source.includes(normalizedTerm)) {
      score = Math.max(score, normalizedTerm.split(" ").length + 1);
    }
  }

  return score;
}

function findMatchedActiveService(text = "", profile = {}) {
  let best = null;

  for (const service of buildServiceLookup(profile)) {
    const score = scoreServiceAgainstText(text, service);
    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { service, score };
    }
  }

  return best?.service || null;
}

function findMatchedDisabledService(text = "", profile = {}) {
  let best = null;

  for (const service of buildDisabledServiceLookup(profile)) {
    const score = scoreServiceAgainstText(text, service);
    if (score <= 0) continue;

    if (!best || score > best.score) {
      best = { service, score };
    }
  }

  return best?.service || null;
}

function pickPrimaryLanguage(profile = {}, fallback = "en") {
  return normalizeLanguage(profile?.languages?.[0] || fallback);
}

function localizedEmergencyCopy(language = "en") {
  const lang = normalizeLanguage(language);

  if (lang === "az") {
    return {
      ack: "Başa düşdüm.",
      serviceLead: (serviceName) => `${serviceName} istiqamətində kömək istəyirsiniz.`,
      generalLead: "Bunun üçün həll qura bilərik.",
      offerLead: "Təklifimizi qısa və konkret deyim.",
      unsupportedLead: "Bu istək hazır aktiv xidmətlər içində görünmür.",
      serviceQuestion:
        "Bir şeyi dəqiqləşdirim: sizin üçün bu işdə əsas nəticə nə olmalıdır?",
      pricingQuestion:
        "Qiyməti düzgün çərçivələmək üçün əsas scope-u bir cümlə ilə yaza bilərsiniz?",
      generalQuestion:
        "Bir şeyi dəqiqləşdirim: sizin üçün əsas məqsəd nədir?",
      contactIntro:
        "Əlaqə məlumatımız budur.",
      contactQuestion:
        "İstəyirsiniz indi yazışaq, yoxsa sizi geri yığaq?",
    };
  }

  if (lang === "tr") {
    return {
      ack: "Anladım.",
      serviceLead: (serviceName) => `${serviceName} tarafında destek istiyorsunuz.`,
      generalLead: "Bunun için bir çözüm kurabiliriz.",
      offerLead: "Teklifimizi kısa ve net söyleyeyim.",
      unsupportedLead: "Bu talep şu anda aktif hizmetler içinde net görünmüyor.",
      serviceQuestion:
        "Bir şeyi netleştireyim: bu işte sizin için ana sonuç ne olmalı?",
      pricingQuestion:
        "Fiyatı doğru çerçevelemek için ana scope'u tek cümleyle yazar mısınız?",
      generalQuestion:
        "Bir şeyi netleştireyim: sizin için ana hedef nedir?",
      contactIntro: "İletişim bilgimiz budur.",
      contactQuestion:
        "İsterseniz buradan yazışalım ya da sizi geri arayalım.",
    };
  }

  if (lang === "ru") {
    return {
      ack: "Понял.",
      serviceLead: (serviceName) => `Вам нужна помощь по направлению ${serviceName}.`,
      generalLead: "Для этого можем предложить решение.",
      offerLead: "Коротко и по делу скажу, что входит в предложение.",
      unsupportedLead:
        "Этот запрос сейчас не выглядит как активная услуга бизнеса.",
      serviceQuestion:
        "Уточню один момент: какой главный результат вам нужен от этого проекта?",
      pricingQuestion:
        "Чтобы корректно сориентировать по стоимости, опишите основной scope одной фразой.",
      generalQuestion:
        "Уточню один момент: какая у вас главная цель?",
      contactIntro: "Вот наши контактные данные.",
      contactQuestion:
        "Если удобно, можем продолжить здесь или созвониться.",
    };
  }

  return {
    ack: "Understood.",
    serviceLead: (serviceName) => `You need help around ${serviceName}.`,
    generalLead: "We can structure a solution for this.",
    offerLead: "Let me state the offer briefly and clearly.",
    unsupportedLead:
      "This request does not clearly match the active services right now.",
    serviceQuestion:
      "Let me clarify one thing: what is the main outcome you want from this?",
    pricingQuestion:
      "To frame pricing correctly, can you state the main scope in one sentence?",
    generalQuestion:
      "Let me clarify one thing: what is your main goal here?",
    contactIntro: "Here are our contact details.",
    contactQuestion:
      "If you want, we can continue here or arrange a callback.",
  };
}

function buildGroundedContactReply(profile = {}, language = "en") {
  const copy = localizedEmergencyCopy(language);

  const parts = [copy.contactIntro];

  if (s(profile?.primaryPhone)) {
    parts.push(`Telefon: ${s(profile.primaryPhone)}.`);
  } else if (arr(profile?.contactPhones).length) {
    parts.push(`Telefon: ${s(profile.contactPhones[0])}.`);
  }

  if (s(profile?.primaryEmail)) {
    parts.push(`E-poçt: ${s(profile.primaryEmail)}.`);
  }

  if (s(profile?.websiteUrl)) {
    parts.push(`Sayt: ${s(profile.websiteUrl)}.`);
  }

  parts.push(copy.contactQuestion);

  return sanitizeReplyText(parts.join(" "));
}

function replyContainsPhone(replyText = "", profile = {}) {
  const replyComparable = normalizePhoneComparable(replyText);
  if (!replyComparable) return false;

  const candidates = uniqStrings([
    s(profile?.primaryPhone),
    ...arr(profile?.contactPhones).map((x) => s(x)),
  ])
    .map((item) => normalizePhoneComparable(item))
    .filter(Boolean);

  return candidates.some((item) => item && replyComparable.includes(item));
}

function replyContainsEmail(replyText = "", profile = {}) {
  const normalizedReply = lower(replyText);
  const candidates = uniqStrings([
    s(profile?.primaryEmail),
    ...arr(profile?.contactEmails).map((x) => s(x)),
  ])
    .map((item) => lower(item))
    .filter(Boolean);

  return candidates.some((item) => item && normalizedReply.includes(item));
}

function replyContainsWebsite(replyText = "", profile = {}) {
  const normalizedReply = lower(replyText);
  const site = lower(s(profile?.websiteUrl));
  return Boolean(site) && normalizedReply.includes(site);
}

function buildRuntimeGroundedEmergencyFallback({
  text,
  profile,
  matchedKnowledge = [],
  matchedPlaybook = null,
}) {
  const language = pickPrimaryLanguage(profile, "en");
  const salesContext = buildSalesContext(profile);

  if (matchedPlaybook) {
    const replyText = sanitizeReplyText(
      buildPlaybookReply(matchedPlaybook, profile)
    );
    return {
      intent: "playbook",
      askCategory: "general",
      stage: "answer",
      replyStyle: "sales",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["matched_playbook", "sales_playbook"],
      shouldAskQuestion: false,
      shouldCreateLead: Boolean(matchedPlaybook.createLead),
      shouldHandoff: Boolean(matchedPlaybook.handoff),
      handoffReason: s(matchedPlaybook.handoffReason || ""),
      handoffPriority: s(matchedPlaybook.handoffPriority || "normal"),
      confidence: 0.7,
      leadScore: matchedPlaybook.createLead ? 68 : 30,
      noReply: false,
      fallbackReason: "matched_playbook",
      language,
      understoodIntent: "playbook",
      detectedService: "",
    };
  }

  if (matchedKnowledge.length) {
    const replyText = sanitizeReplyText(
      buildKnowledgeReply(matchedKnowledge, profile)
    );
    return {
      intent: "knowledge_answer",
      askCategory: "faq",
      stage: "answer",
      replyStyle: "professional",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["matched_knowledge"],
      shouldAskQuestion: false,
      shouldCreateLead: false,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.6,
      leadScore: 18,
      noReply: false,
      fallbackReason: "matched_knowledge",
      language,
      understoodIntent: "knowledge_answer",
      detectedService: "",
    };
  }

  if (
    inferContactRequest(text) &&
    (s(profile?.primaryPhone) ||
      s(profile?.primaryEmail) ||
      s(profile?.websiteUrl) ||
      arr(profile?.contactPhones).length ||
      arr(profile?.contactEmails).length)
  ) {
    const replyText = buildGroundedContactReply(profile, language);
    return {
      intent: "contact",
      askCategory: "contact",
      stage: "contact_capture",
      replyStyle: "sales",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: [
        "grounded_contact_details",
        s(profile?.primaryPhone) ? "primary_phone" : "",
        s(profile?.primaryEmail) ? "primary_email" : "",
        s(profile?.websiteUrl) ? "website_url" : "",
      ].filter(Boolean),
      shouldAskQuestion: false,
      shouldCreateLead: true,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.74,
      leadScore: 72,
      noReply: false,
      fallbackReason: "grounded_contact_details",
      language,
      understoodIntent: "contact_request",
      detectedService: "",
    };
  }

  const copy = localizedEmergencyCopy(language);
  const matchedActiveService = findMatchedActiveService(text, profile);
  const matchedDisabledService = findMatchedDisabledService(text, profile);
  const wantsOffer = inferOfferRequest(text);
  const wantsPricing = inferPricingRequest(text);

  if (matchedDisabledService) {
    const replyText = sanitizeReplyText(buildUnsupportedServiceReply(profile));
    return {
      intent: "unsupported_service",
      askCategory: "general",
      stage: "general",
      replyStyle: "professional",
      customerGoal: s(text),
      answerFirst: replyText,
      nextQuestion: "",
      replyText,
      missingInformation: [],
      groundedFactsUsed: ["disabled_service_match"],
      shouldAskQuestion: false,
      shouldCreateLead: false,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.45,
      leadScore: 8,
      noReply: false,
      fallbackReason: "disabled_service_match",
      language,
      understoodIntent: "unsupported_service",
      detectedService: s(
        matchedDisabledService?.name || matchedDisabledService?.key
      ),
    };
  }

  if (wantsOffer && salesContext.keyOffers.length) {
    const offerNames = salesContext.keyOffers
      .map((item) => item.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");

    const answerFirst = sanitizeReplyText(
      [
        copy.ack,
        copy.offerLead,
        offerNames ? `Bu istiqamətdə əsas həllərimiz: ${offerNames}.` : "",
      ].join(" ")
    );
    const nextQuestion = wantsPricing
      ? copy.pricingQuestion
      : matchedActiveService
        ? copy.serviceQuestion
        : copy.generalQuestion;

    return {
      intent: wantsPricing ? "pricing" : "recommendation",
      askCategory: wantsPricing ? "pricing" : "recommendation",
      stage: wantsPricing ? "pricing" : "recommendation",
      replyStyle: "sales",
      customerGoal: s(text),
      answerFirst,
      nextQuestion,
      replyText: sanitizeReplyText(`${answerFirst} ${nextQuestion}`),
      missingInformation: [wantsPricing ? "scope" : "main_goal"],
      groundedFactsUsed: ["sales_context_offer_names"],
      shouldAskQuestion: true,
      shouldCreateLead: true,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.58,
      leadScore: 58,
      noReply: false,
      fallbackReason: "sales_offer_fallback",
      language,
      understoodIntent: wantsPricing ? "pricing" : "offer_request",
      detectedService: s(matchedActiveService?.name || matchedActiveService?.key),
    };
  }

  if (matchedActiveService) {
    const answerFirst = sanitizeReplyText(
      [
        copy.ack,
        copy.serviceLead(
          s(matchedActiveService?.name || matchedActiveService?.key)
        ),
      ].join(" ")
    );
    const nextQuestion = wantsPricing
      ? copy.pricingQuestion
      : copy.serviceQuestion;

    return {
      intent: wantsPricing ? "pricing" : "service_interest",
      askCategory: wantsPricing ? "pricing" : "service_interest",
      stage: wantsPricing ? "pricing" : "qualification",
      replyStyle: "sales",
      customerGoal: s(text),
      answerFirst,
      nextQuestion,
      replyText: sanitizeReplyText(`${answerFirst} ${nextQuestion}`),
      missingInformation: [wantsPricing ? "scope" : "main_goal"],
      groundedFactsUsed: ["active_service_match"],
      shouldAskQuestion: true,
      shouldCreateLead: true,
      shouldHandoff: false,
      handoffReason: "",
      handoffPriority: "normal",
      confidence: 0.54,
      leadScore: 54,
      noReply: false,
      fallbackReason: "active_service_match",
      language,
      understoodIntent: wantsPricing ? "pricing" : "service_interest",
      detectedService: s(matchedActiveService?.name || matchedActiveService?.key),
    };
  }

  const answerFirst = sanitizeReplyText([copy.ack, copy.generalLead].join(" "));
  const nextQuestion = wantsPricing
    ? copy.pricingQuestion
    : copy.generalQuestion;

  return {
    intent: wantsPricing ? "pricing" : "general",
    askCategory: wantsPricing ? "pricing" : "general",
    stage: "discovery",
    replyStyle: "sales",
    customerGoal: s(text),
    answerFirst,
    nextQuestion,
    replyText: sanitizeReplyText(`${answerFirst} ${nextQuestion}`),
    missingInformation: [wantsPricing ? "scope" : "customer_goal"],
    groundedFactsUsed: ["runtime_grounded_emergency_fallback"],
    shouldAskQuestion: true,
    shouldCreateLead: true,
    shouldHandoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    confidence: 0.42,
    leadScore: 42,
    noReply: false,
    fallbackReason: "runtime_grounded_emergency_fallback",
    language,
    understoodIntent: wantsPricing ? "pricing" : "general",
    detectedService: "",
  };
}

function normalizeConversationDecision(parsed = {}, fallbackLanguage = "en") {
  const answerFirst = sanitizeSentence(parsed?.answerFirst || "");
  const nextQuestion = sanitizeSentence(parsed?.nextQuestion || "");
  let replyText = sanitizeReplyText(parsed?.replyText || "");

  if (!replyText) {
    replyText = joinReplyParts(answerFirst, nextQuestion);
  }

  return {
    language: normalizeLanguage(parsed?.language || fallbackLanguage || "en"),
    understoodIntent:
      s(parsed?.understoodIntent || parsed?.intent || "general") || "general",
    detectedService: s(parsed?.detectedService || ""),
    customerGoal: s(parsed?.customerGoal || ""),
    answerFirst,
    nextQuestion,
    replyText,
    missingInformation: coerceStringArray(parsed?.missingInformation),
    groundedFactsUsed: coerceStringArray(parsed?.groundedFactsUsed),
    shouldAskQuestion: coerceBoolean(parsed?.shouldAskQuestion, false),
    shouldCreateLead: coerceBoolean(parsed?.shouldCreateLead, false),
    shouldHandoff: coerceBoolean(parsed?.shouldHandoff, false),
    handoffReason: s(parsed?.handoffReason || ""),
    handoffPriority: normalizePriority(parsed?.handoffPriority || "normal"),
    confidence: Math.max(
      0,
      Math.min(1, coerceNumber(parsed?.confidence, 0.55))
    ),
    leadScore: Math.max(
      0,
      Math.min(100, Math.round(coerceNumber(parsed?.leadScore, 35)))
    ),
    askCategory: normalizeAskCategory(parsed?.askCategory || "service_interest"),
    stage: normalizeStage(parsed?.stage || "discovery"),
    replyStyle: normalizeReplyStyle(parsed?.replyStyle || "sales"),
    noReply: coerceBoolean(parsed?.noReply, false),
  };
}

function postProcessSalesDecision(
  normalized = {},
  { customerText = "", profile = {} } = {}
) {
  const next = { ...normalized };

  if (!next.customerGoal && isSubstantiveCustomerTurn(customerText)) {
    next.customerGoal = sanitizeSentence(customerText);
  }

  if (next.askCategory === "general" && isSubstantiveCustomerTurn(customerText)) {
    if (inferContactRequest(customerText)) {
      next.askCategory = "contact";
    } else {
      next.askCategory = inferPricingRequest(customerText)
        ? "pricing"
        : "service_interest";
    }
  }

  if (next.stage === "general" && isSubstantiveCustomerTurn(customerText)) {
    if (inferContactRequest(customerText)) {
      next.stage = "contact_capture";
    } else {
      next.stage = inferPricingRequest(customerText) ? "pricing" : "qualification";
    }
  }

  if (inferContactRequest(customerText)) {
    next.leadScore = Math.max(next.leadScore, 68);
    next.shouldCreateLead = true;
  } else if (inferPricingRequest(customerText)) {
    next.leadScore = Math.max(next.leadScore, 55);
    next.shouldCreateLead = true;
  } else if (isSubstantiveCustomerTurn(customerText)) {
    next.leadScore = Math.max(next.leadScore, 45);
  }

  if (findMatchedActiveService(customerText, profile)) {
    next.shouldCreateLead = true;
    next.leadScore = Math.max(next.leadScore, 52);
  }

  if (!next.replyText) {
    next.replyText = joinReplyParts(next.answerFirst, next.nextQuestion);
  }

  return next;
}

function validateConversationDecision({
  parsed = {},
  customerText = "",
  profile = {},
}) {
  const normalized = postProcessSalesDecision(
    normalizeConversationDecision(parsed, profile?.languages?.[0] || "en"),
    { customerText, profile }
  );

  const reasons = [];
  const substantive = isSubstantiveCustomerTurn(customerText);
  const matchedActiveService = findMatchedActiveService(customerText, profile);
  const matchedDisabledService = findMatchedDisabledService(customerText, profile);

  if (!normalized.replyText && normalized.noReply !== true) {
    reasons.push("reply_text_empty");
  }

  if (containsInternalStrategyLeak(normalized.replyText)) {
    reasons.push("internal_strategy_leak");
  }

  if (containsInternalStrategyLeak(normalized.answerFirst)) {
    reasons.push("internal_strategy_leak_answer_first");
  }

  if (containsInternalStrategyLeak(normalized.nextQuestion)) {
    reasons.push("internal_strategy_leak_next_question");
  }

  if (substantive && looksLikeWeakAcknowledgeOnly(normalized.replyText)) {
    reasons.push("weak_acknowledgement_only");
  }

  if (substantive && countQuestions(normalized.replyText) > 1) {
    reasons.push("too_many_questions");
  }

  if (
    substantive &&
    matchedActiveService &&
    !normalized.detectedService &&
    !normalized.customerGoal
  ) {
    reasons.push("matched_service_not_grounded");
  }

  if (
    substantive &&
    inferOfferRequest(customerText) &&
    countWordLikeTokens(normalized.replyText) < 8
  ) {
    reasons.push("offer_request_answer_too_thin");
  }

  if (
    substantive &&
    inferPricingRequest(customerText) &&
    !normalized.shouldAskQuestion &&
    !/qiym|price|cost|budget|scope|paket|package/i.test(normalized.replyText)
  ) {
    reasons.push("pricing_request_not_handled");
  }

  if (
    inferPhoneRequest(customerText) &&
    (s(profile?.primaryPhone) || arr(profile?.contactPhones).length) &&
    !replyContainsPhone(normalized.replyText, profile)
  ) {
    reasons.push("grounded_phone_missing_from_reply");
  }

  if (
    inferEmailRequest(customerText) &&
    (s(profile?.primaryEmail) || arr(profile?.contactEmails).length) &&
    !replyContainsEmail(normalized.replyText, profile)
  ) {
    reasons.push("grounded_email_missing_from_reply");
  }

  if (
    inferWebsiteRequest(customerText) &&
    s(profile?.websiteUrl) &&
    !replyContainsWebsite(normalized.replyText, profile)
  ) {
    reasons.push("grounded_website_missing_from_reply");
  }

  if (
    matchedDisabledService &&
    normalized.detectedService &&
    lower(normalized.detectedService) ===
      lower(matchedDisabledService?.name || matchedDisabledService?.key) &&
    !/unsupported|outside|not available|not active|uygun deyil|aktiv deyil/i.test(
      normalized.replyText
    )
  ) {
    reasons.push("disabled_service_not_handled_safely");
  }

  if (
    normalized.shouldAskQuestion &&
    !normalized.nextQuestion &&
    !/[?؟]/u.test(normalized.replyText)
  ) {
    reasons.push("question_expected_but_missing");
  }

  if (countWordLikeTokens(normalized.replyText) < 4 && substantive) {
    reasons.push("reply_too_short_for_sales_turn");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    normalized,
  };
}

function buildTraceFromDecision({
  resolvedRuntime,
  policy,
  promptBundle,
  channel,
  result,
}) {
  return buildAgentReplayTrace({
    runtime: resolvedRuntime,
    behavior: resolvedRuntime.behavior,
    policy,
    promptBundle,
    channel: channel || "inbox",
    usecase: "inbox.sales_conversation",
    decisions: {
      cta: {
        selected: s(
          resolvedRuntime?.primaryCta ||
            resolvedRuntime?.conversationAssets?.primaryCtaRaw ||
            ""
        ),
        reason: result.shouldAskQuestion ? "qualification_first" : "direct_progression",
      },
      qualification: {
        mode: s(result.askCategory || "service_interest"),
        questionCount: result.shouldAskQuestion ? 1 : 0,
        reason: result.shouldAskQuestion ? "sales_progression" : "",
      },
      handoff: {
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    evaluation: {
      outcome: Boolean(result.shouldHandoff)
        ? "handoff_recommended"
        : Boolean(result.noReply)
          ? "no_reply_recommended"
          : "reply_recommended",
      ctaDirection: Boolean(result.shouldHandoff)
        ? "handoff"
        : Boolean(result.noReply)
          ? "none"
          : "lead_progression",
      qualification: {
        status: s(result.stage || "qualification"),
        questionCount: result.shouldAskQuestion ? 1 : 0,
      },
      handoff: {
        status: Boolean(result.shouldHandoff) ? "recommended" : "clear",
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    decisionPath: {
      status: Boolean(result.shouldHandoff)
        ? "escalated_to_operator"
        : Boolean(result.noReply)
          ? "no_reply"
          : "answered",
      reasonCode:
        s(result.handoffReason || "") ||
        (Boolean(result.shouldHandoff)
          ? "sales_conversation_handoff"
          : Boolean(result.noReply)
            ? "sales_conversation_no_reply"
            : "sales_conversation_reply"),
      detail: s(result.stage || ""),
    },
  });
}

function finalizeConversationResult({
  parsed,
  profile,
  matchedKnowledge,
  matchedPlaybook,
  resolvedRuntime,
  promptBundle,
  channel,
  policy,
  raw = "",
  replyMode = "conversation_engine",
  semanticFailureReason = "",
  fallbackReason = "",
}) {
  const normalized = postProcessSalesDecision(
    normalizeConversationDecision(parsed, profile?.languages?.[0] || "en"),
    {
      customerText: s(parsed?.customerGoal || ""),
      profile,
    }
  );

  const baseResult = {
    language: normalized.language,
    intent: normalized.understoodIntent,
    askCategory: normalized.askCategory,
    stage: normalized.stage,
    replyStyle: normalized.replyStyle,
    customerGoal: normalized.customerGoal,
    answerFirst: normalized.answerFirst,
    recommendedNextQuestion: normalized.nextQuestion,
    replyText: normalized.replyText,
    knownFacts: [],
    missingFacts: normalized.missingInformation,
    groundedFactsUsed: normalized.groundedFactsUsed,
    confidence: normalized.confidence,
    leadScore: normalized.leadScore,
    createLead: normalized.shouldCreateLead,
    handoff: normalized.shouldHandoff,
    handoffReason: normalized.handoffReason,
    handoffPriority: normalized.handoffPriority,
    noReply: normalized.noReply,
    raw,
    replyMode,
    usedFallback: replyMode !== "conversation_engine",
    usedFastLane: false,
    fastLaneReason: "",
    semanticFailureReason: s(semanticFailureReason || ""),
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    fallbackReason: s(fallbackReason || ""),
    detectedService: normalized.detectedService,
    shouldAskQuestion: normalized.shouldAskQuestion,
  };

  const composed = composeTenantAwareReply({
    result: baseResult,
    profile,
    text: "",
    recentMessages: [],
  });

  const finalResult = {
    ...baseResult,
    replyBodyText: composed.replyBodyText,
    replyText: composed.replyText || baseResult.replyText,
    greetingApplied: Boolean(composed.greetingApplied),
    greetingText: s(composed.greetingText),
    greetingMode: s(composed.greetingMode),
    usedCustomGreeting: Boolean(composed.usedCustomGreeting),
    introModeUsed: s(composed.introModeUsed),
    behaviorSource: s(
      composed.behaviorSource || profile?.behavior?.source || ""
    ),
    language: s(
      composed.language ||
        baseResult.language ||
        profile?.languages?.[0] ||
        "en"
    ),
    greetingOnly: Boolean(composed.greetingOnly),
  };

  finalResult.trace = buildTraceFromDecision({
    resolvedRuntime,
    policy,
    promptBundle,
    channel,
    result: {
      ...normalized,
      shouldHandoff: normalized.shouldHandoff,
    },
  });

  return finalResult;
}

export async function runTenantAwareConversationEngine({
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  tenant = null,
  policy = {},
  quietHoursApplied = false,
  recentMessages = [],
  reliability = {},
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
  services = [],
  knowledgeEntries = [],
  responsePlaybooks = [],
  threadState = null,
  runtime = null,
}) {
  const openai = ensureOpenAI();
  const configuredModel = s(cfg?.ai?.openaiModel || "gpt-5") || "gpt-5";
  const configuredMaxTokens = Number(cfg?.ai?.openaiMaxOutputTokens || 2200);
  const maxOutputTokens = Math.max(
    1200,
    Math.min(4000, configuredMaxTokens || 2200)
  );
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const resolvedRuntime =
    runtime ||
    (await resolveInboxRuntime({
      tenantKey: resolvedTenantKey,
      tenant,
      services,
      knowledgeEntries,
      responsePlaybooks,
      threadState,
      channel,
      thread,
      message,
      recentMessages,
      customerContext,
      formData,
      leadContext,
      conversationContext,
      runtime,
    }));

  const profile = resolvedRuntime;
  const runtimeGrounding = buildRuntimeGrounding(profile);

  try {
    console.info("[ai-hq] truth_contact_debug_probe", {
      displayName: runtimeGrounding?.displayName || "",
      groundingPrimaryPhone: runtimeGrounding?.contactGrounding?.primaryPhone || "",
      groundingPhones: runtimeGrounding?.contactGrounding?.contactPhones || [],
      profilePrimaryPhone: profile?.primaryPhone || "",
      profilePublicPhone: profile?.publicPhone || "",
      profileContactPhones: profile?.contactPhones || [],
      projectionProfilePhone:
        profile?.raw?.projection?.profile_json?.primaryPhone ||
        profile?.raw?.projection?.profileJson?.primaryPhone ||
        "",
      projectionContacts:
        profile?.raw?.projection?.contacts_json ||
        profile?.raw?.projection?.contactsJson ||
        [],
      latestText: text,
    });
  } catch {}


  const matchedKnowledge = matchKnowledgeEntries(
    text,
    resolvedRuntime.knowledgeEntries,
    4
  );
  const matchedPlaybook = matchPlaybook(text, resolvedRuntime.responsePlaybooks);

  const conversation = buildConversationSnapshot({
    text,
    recentMessages,
    customerContext,
    formData,
    leadContext,
    conversationContext,
    threadState: resolvedRuntime.threadState || threadState || null,
  });

  const promptBundle = buildPromptBundle("inbox.sales_conversation", {
    tenant: {
      ...obj(tenant),
      tenantKey: resolvedTenantKey,
      tenantId: resolvedTenantKey,
      companyName: profile.displayName,
      brandName: profile.displayName,
      industryKey: profile.industry,
      outputLanguage: profile.languages?.[0] || "en",
      toneText: profile.tone,
      services: profile.services,
      servicesText: buildServiceLine(profile) || "tenant business services",
      disabledServicesText: buildDisabledServiceLine(profile) || "",
      businessContext: profile.businessSummary || "",
      ai_policy: {
        ...obj(tenant?.ai_policy),
        ...obj(profile.aiPolicy),
      },
      behavior: {
        niche: s(profile.niche || profile.industry),
        conversionGoal: s(profile.conversionGoal),
        toneProfile: s(profile.toneProfile),
        disallowedClaims: arr(profile.disallowedClaims),
        handoffTriggers: arr(profile.handoffTriggers),
        channelBehavior: obj(profile.channelBehavior),
      },
      profile: {
        ...obj(tenant?.profile),
        ...obj(profile.profile),
        brand_name: profile.displayName,
        tone_of_voice: profile.tone,
        public_phone: s(profile.primaryPhone),
        public_email: s(profile.primaryEmail),
        website_url: s(profile.websiteUrl),
      },
      meta: {
        contactPhones: arr(profile.contactPhones),
        contactEmails: arr(profile.contactEmails),
      },
    },
    extra: {
      channel: JSON.stringify(s(channel || "inbox")),
      externalUserId: JSON.stringify(s(externalUserId || "")),
      threadId: JSON.stringify(s(thread?.id || "")),
      messageId: JSON.stringify(s(message?.id || "")),
      threadStatus: JSON.stringify(s(thread?.status || "open")),
      quietHoursApplied: quietHoursApplied ? "true" : "false",
      servicesLine: JSON.stringify(buildServiceLine(profile)),
      disabledServicesLine: JSON.stringify(buildDisabledServiceLine(profile)),
      reliability: compactJson(reliability || {}),
      runtimeGrounding: compactJson(runtimeGrounding, 6000),
      historySnippet: conversation.historySnippet,
      primaryPhone: JSON.stringify(s(profile.primaryPhone || "")),
      primaryEmail: JSON.stringify(s(profile.primaryEmail || "")),
      websiteUrl: JSON.stringify(s(profile.websiteUrl || "")),
    },
  });

  if (!openai) {
    const fallback = buildRuntimeGroundedEmergencyFallback({
      text,
      profile,
      matchedKnowledge,
      matchedPlaybook,
    });

    return finalizeConversationResult({
      parsed: fallback,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw: "",
      replyMode: "conversation_engine_emergency_fallback",
      semanticFailureReason: "openai_api_key_missing",
      fallbackReason:
        fallback.fallbackReason || "runtime_grounded_emergency_fallback",
    });
  }

  const systemPrompt = buildConversationSystemPrompt();
  const userPrompt = buildConversationUserPrompt({
    runtimeGrounding,
    conversation,
    matchedKnowledge,
    matchedPlaybook,
    policy,
  });

  logConversationEngine("request_start", {
    tenantKey: resolvedTenantKey,
    channel: s(channel || "inbox"),
    model: configuredModel,
    maxOutputTokens,
    matchedKnowledgeCount: matchedKnowledge.length,
    hasMatchedPlaybook: Boolean(matchedPlaybook),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    latestMessagePreview: safePreview(
      conversation.latestCustomerMessageWithoutCommand ||
        conversation.latestCustomerMessage,
      180
    ),
    groundedPhone: s(profile.primaryPhone),
    groundedEmail: s(profile.primaryEmail),
    groundedWebsite: s(profile.websiteUrl),
  });

  try {
    let raw = "";
    let refusal = "";
    let parsed = null;
    let semanticFailureReason = "";
    let replyMode = "conversation_engine";
    let modelUsed = configuredModel;

    const firstPass = await runStructuredDecision({
      openai,
      model: configuredModel,
      maxOutputTokens,
      systemPrompt,
      userPrompt,
    });

    raw = firstPass.raw;
    refusal = firstPass.refusal;
    modelUsed = firstPass.modelUsed || configuredModel;
    parsed = firstPass.parsed || parseStructuredOutput(raw, modelUsed);

    const firstValidation = validateConversationDecision({
      parsed,
      customerText:
        conversation.latestCustomerMessageWithoutCommand ||
        conversation.latestCustomerMessage,
      profile,
    });

    if (refusal) {
      semanticFailureReason = "model_refusal";

      const fallback = buildRuntimeGroundedEmergencyFallback({
        text,
        profile,
        matchedKnowledge,
        matchedPlaybook,
      });

      return finalizeConversationResult({
        parsed: fallback,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
        raw,
        replyMode: "conversation_engine_emergency_fallback",
        semanticFailureReason,
        fallbackReason:
          fallback.fallbackReason || "runtime_grounded_emergency_fallback",
      });
    }

    if (!firstValidation.ok) {
      logConversationEngineWarn("repair_attempt", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        reasons: firstValidation.reasons,
        rawPreview: safePreview(raw, 400),
        parsedPreview: safeJsonPreview(parsed, 700),
        modelUsed,
      });

      const repairPass = await runStructuredDecision({
        openai,
        model: modelUsed,
        maxOutputTokens,
        systemPrompt,
        userPrompt: buildRepairPrompt({
          runtimeGrounding,
          conversation,
          previousRaw: raw,
          validationErrors: firstValidation.reasons,
        }),
      });

      raw = repairPass.raw;
      refusal = repairPass.refusal;
      modelUsed = repairPass.modelUsed || modelUsed;
      parsed = repairPass.parsed || parseStructuredOutput(raw, modelUsed);

      const repairValidation = validateConversationDecision({
        parsed,
        customerText:
          conversation.latestCustomerMessageWithoutCommand ||
          conversation.latestCustomerMessage,
        profile,
      });

      if (!repairValidation.ok || refusal) {
        semanticFailureReason = refusal
          ? "repair_model_refusal"
          : `validation_failed:${repairValidation.reasons.join(",")}`;

        const fallback = buildRuntimeGroundedEmergencyFallback({
          text,
          profile,
          matchedKnowledge,
          matchedPlaybook,
        });

        logConversationEngineWarn("repair_failed_using_emergency_fallback", {
          tenantKey: resolvedTenantKey,
          channel: s(channel || "inbox"),
          reasons: refusal
            ? ["repair_model_refusal"]
            : repairValidation.reasons,
          fallbackReason: fallback.fallbackReason,
          rawPreview: safePreview(raw, 400),
          parsedPreview: safeJsonPreview(parsed, 700),
          modelUsed,
        });

        return finalizeConversationResult({
          parsed: fallback,
          profile,
          matchedKnowledge,
          matchedPlaybook,
          resolvedRuntime,
          promptBundle,
          channel,
          policy,
          raw,
          replyMode: "conversation_engine_emergency_fallback",
          semanticFailureReason,
          fallbackReason:
            fallback.fallbackReason || "runtime_grounded_emergency_fallback",
        });
      }

      replyMode = "conversation_engine_repaired";
      parsed = repairValidation.normalized;
    } else {
      parsed = firstValidation.normalized;
    }

    const result = finalizeConversationResult({
      parsed,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw,
      replyMode,
      semanticFailureReason,
      fallbackReason: "",
    });

    logConversationEngine("decision", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      configuredModel,
      modelUsed,
      intent: result.intent,
      detectedService: s(result.detectedService),
      askCategory: result.askCategory,
      stage: result.stage,
      replyStyle: result.replyStyle,
      customerGoal: result.customerGoal,
      shouldAskQuestion: Boolean(result.shouldAskQuestion),
      createLead: result.createLead,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      handoffPriority: result.handoffPriority,
      leadScore: result.leadScore,
      confidence: result.confidence,
      replyMode: result.replyMode,
      usedFallback: result.usedFallback,
      semanticFailureReason: result.semanticFailureReason,
      fallbackReason: result.fallbackReason,
      replyPreview: safePreview(result.replyText, 180),
    });

    return result;
  } catch (error) {
    logConversationEngineError("failed_using_emergency_fallback", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model: configuredModel,
      errorName: s(error?.name || "Error"),
      errorMessage: s(error?.message || "Unknown conversation engine error"),
      errorCode: s(error?.code),
      errorType: s(error?.type),
      errorStatus:
        Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      errorParam: s(error?.param),
      errorRawType: s(error?.error?.type),
      errorRawCode: s(error?.error?.code),
      errorRawMessage: s(error?.error?.message),
    });

    const fallback = buildRuntimeGroundedEmergencyFallback({
      text,
      profile,
      matchedKnowledge,
      matchedPlaybook,
    });

    return finalizeConversationResult({
      parsed: fallback,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
      raw: "",
      replyMode: "conversation_engine_emergency_fallback",
      semanticFailureReason: s(error?.message || "conversation_engine_failed"),
      fallbackReason:
        fallback.fallbackReason || "runtime_grounded_emergency_fallback",
    });
  }
}

export const __test__ = {
  normalizeLanguage,
  isSubstantiveCustomerTurn,
  buildRuntimeGrounding,
  findMatchedActiveService,
  findMatchedDisabledService,
  validateConversationDecision,
  normalizeConversationDecision,
  containsInternalStrategyLeak,
  inferPhoneRequest,
  inferEmailRequest,
  inferWebsiteRequest,
  inferContactRequest,
};