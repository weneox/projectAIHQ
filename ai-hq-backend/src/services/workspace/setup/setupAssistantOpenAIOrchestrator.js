import OpenAI from "openai";

import { cfg } from "../../../config.js";
import { arr, compactDraftObject, obj, s } from "./draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
} from "./setupAssistantParser.js";
import {
  INTENT_ONLY_RESPONSES,
  buildAssistantQuestion,
  getNextQuestion,
  getSetupCopy,
  hasSetupSignalForInterview,
  normalizeQuestionKey,
  normalizeSetupLocale,
} from "./setupAssistantApp/questions.js";
import {
  buildApprovalBlockers,
  isDraftReadyForApproval,
  validateStepAnswer,
} from "./setupAssistantApp/relevance.js";
import {
  buildRecognizedSourceCandidate,
  inferContactType,
  normalizeWebsiteUrl,
} from "./setupAssistantApp/shared.js";

let cachedClient = null;

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 6000) ||
    6000;
  const maxOutputTokens =
    Number(cfg.ai?.openaiSetupMaxOutputTokens || 350) || 350;

  const hasKey = Boolean(s(cfg.ai?.openaiApiKey));

  return {
    enabled: cfg.ai?.openaiSetupAssistantEnabled === true || hasKey,
    forceFallback: cfg.ai?.openaiSetupForceFallback === true,
    model,
    timeoutMs,
    maxOutputTokens,
  };
}

function getOpenAIClient() {
  if (cachedClient) return cachedClient;

  const apiKey = s(cfg.ai?.openaiApiKey);
  if (!apiKey) return null;

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function hasOpenAISetupAssistant() {
  const runtime = getSetupAssistantRuntimeConfig();
  if (runtime.enabled !== true) return false;
  return Boolean(getOpenAIClient());
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

function uniqueStrings(items = [], max = 24) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))].slice(
    0,
    max
  );
}

function compactText(value = "", max = 420) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function normalizeMessage(value = "") {
  return s(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function isIntentOnlyMessage(value = "") {
  return Boolean(INTENT_ONLY_RESPONSES[normalizeMessage(value)]);
}

function splitList(value = "", limit = 24) {
  return String(value || "")
    .split(/\n|,|;|\u2022/g)
    .map((item) => s(item))
    .filter(Boolean)
    .slice(0, limit);
}

function listToNatural(locale = "az-AZ", values = []) {
  const copy = getSetupCopy(locale);
  const items = uniqueStrings(values, 6);

  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${copy.and} ${items[1]}`;

  return `${items.slice(0, -1).join(", ")} ${copy.and} ${items.at(-1)}`;
}

function buildCurrentPreview(draft = {}, review = null) {
  const safeDraft = obj(draft);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  const businessProfile = {
    ...obj(reviewDraft.businessProfile),
    ...obj(safeDraft.businessProfile),
  };

  const services = [...arr(reviewDraft.services), ...arr(safeDraft.services)]
    .map((item) => s(item?.title || item?.name || item?.label))
    .filter(Boolean);

  const contacts = [...arr(reviewDraft.contacts), ...arr(safeDraft.contacts)]
    .map((item) => s(item?.value || item?.label || item?.channel || item?.type))
    .filter(Boolean);

  const hours = arr(safeDraft.hours)
    .map((item) => {
      const row = obj(item);
      const day = s(row.day);

      if (row.allDay === true) return [day, "24/7"].filter(Boolean).join(" ");
      if (row.appointmentOnly === true) {
        return [day, "appointment only"].filter(Boolean).join(" ");
      }
      if (row.closed === true) {
        return [day, "closed"].filter(Boolean).join(" ");
      }
      if (s(row.openTime) && s(row.closeTime)) {
        return [day, `${s(row.openTime)}-${s(row.closeTime)}`]
          .filter(Boolean)
          .join(" ");
      }

      return s(row.notes);
    })
    .filter(Boolean);

  const pricingPosture = s(
    obj(safeDraft.pricingPosture).publicSummary ||
      obj(reviewDraft.pricingPosture).publicSummary ||
      businessProfile.pricingPolicy
  );

  const humanHandoff = s(
    obj(safeDraft.handoffRules).summary ||
      arr(obj(safeDraft.handoffRules).triggers).join(", ")
  );

  return compactDraftObject({
    businessName: s(businessProfile.companyName),
    whatThisBusinessIs: s(businessProfile.description),
    websiteUrl: normalizeWebsiteUrl(s(businessProfile.websiteUrl)),
    coreServices: uniqueStrings(services, 24),
    contactRoutes: uniqueStrings(contacts, 24),
    hours: uniqueStrings(hours, 24),
    pricingPosture,
    humanHandoff,
    languages: uniqueStrings(arr(safeDraft.languages), 8),
    tone: s(safeDraft.tone),
    greetingStyle: s(safeDraft.greetingStyle),
    afterHoursBehavior: s(safeDraft.afterHoursBehavior),
  });
}

function detectLocaleFromText(value = "") {
  const text = s(value);

  if (!text) return "";

  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";

  if (/[əğıöşüƏĞIİÖŞÜ]/.test(text)) return "az-AZ";
  if (/[çğıİöşüÇĞİÖŞÜ]/.test(text)) return "tr";
  if (/[ñáéíóú¿¡]/i.test(text)) return "es";
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr";
  if (/[äöüß]/i.test(text)) return "de";
  if (/[ãõáâàçêéíóôõú]/i.test(text)) return "pt";

  const lower = normalizeMessage(text);

  if (
    /\b(hə|bəli|yox|şirkət|iş|xidmət|əlaqə|saat|qiymət|insana)\b/.test(lower)
  ) {
    return "az-AZ";
  }
  if (
    /\b(ev(et)?|hayir|işletme|hizmet|iletisim|fiyat|insan)\b/.test(lower)
  ) {
    return "tr";
  }
  if (
    /\b(what|business|service|contact|hours|price|human)\b/.test(lower)
  ) {
    return "en";
  }
  if (
    /\b(negocio|servicio|contacto|horario|precio|persona)\b/.test(lower)
  ) {
    return "es";
  }
  if (
    /\b(entreprise|service|contact|horaires|prix|humain)\b/.test(lower)
  ) {
    return "fr";
  }
  if (
    /\b(geschaft|kontakt|offnungszeiten|preis|mensch)\b/.test(lower)
  ) {
    return "de";
  }
  if (
    /\b(negocio|contato|horario|preco|pessoa)\b/.test(lower)
  ) {
    return "pt";
  }

  return "";
}

function resolveReplyLocale({ draft = {}, latestMessage = "" } = {}) {
  const safeDraft = obj(draft);

  const explicitLanguage = s(arr(safeDraft.languages)[0]);
  if (explicitLanguage) {
    return normalizeSetupLocale(explicitLanguage);
  }

  const fromText = detectLocaleFromText(latestMessage);
  if (fromText) {
    return normalizeSetupLocale(fromText);
  }

  return "az-AZ";
}

function extractJsonText(response = {}) {
  const outputText = s(response?.output_text);
  if (outputText) return outputText;

  for (const item of arr(response?.output)) {
    for (const content of arr(item?.content)) {
      const text =
        s(content?.text) ||
        s(content?.value) ||
        s(content?.json) ||
        s(content?.parsed);
      if (text) return text;
    }
  }

  return "";
}

function buildQuestion(step = "", locale = "az-AZ") {
  return buildAssistantQuestion(step || "company", {}, { locale });
}

function buildInterviewPlan(currentStep = "", nextQuestion = null) {
  const safeQuestion = obj(nextQuestion);
  const activeKey =
    s(safeQuestion.key || safeQuestion.step || currentStep).toLowerCase();

  if (!activeKey) {
    return {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    };
  }

  return {
    activeQuestionKeys: [activeKey],
    activeQuestions: [
      {
        key: activeKey,
        step: s(safeQuestion.step || activeKey).toLowerCase(),
        title: s(safeQuestion.title || safeQuestion.label),
        group: s(safeQuestion.group || "business_truth"),
        groupLabel: s(safeQuestion.groupLabel || "Business truth"),
        priority: Number(safeQuestion.priority || 1) || 1,
      },
    ],
    remainingQuestionKeys: [activeKey],
    nextGroup: s(safeQuestion.group || "business_truth"),
    nextGroupLabel: s(safeQuestion.groupLabel || "Business truth"),
  };
}

function buildSourceSignals(preview = {}, sources = []) {
  const safePreview = obj(preview);
  const sourceRows = arr(sources);

  const sourceTypes = uniqueStrings(
    [
      ...sourceRows.map((item) => s(item?.type || item?.sourceType)),
      safePreview.websiteUrl ? "website" : "",
    ],
    8
  );

  const strongestEvidence = uniqueStrings(
    [
      safePreview.businessName ? `Business name: ${safePreview.businessName}` : "",
      safePreview.whatThisBusinessIs
        ? `Description: ${safePreview.whatThisBusinessIs}`
        : "",
      arr(safePreview.coreServices).length
        ? `Services: ${arr(safePreview.coreServices).slice(0, 4).join(", ")}`
        : "",
      arr(safePreview.contactRoutes).length
        ? `Contacts: ${arr(safePreview.contactRoutes).slice(0, 3).join(", ")}`
        : "",
      arr(safePreview.hours).length
        ? `Hours: ${arr(safePreview.hours).slice(0, 2).join(", ")}`
        : "",
    ],
    12
  );

  return {
    primarySourceType: safePreview.websiteUrl ? "website" : s(sourceTypes[0]),
    primarySourceLabel: safePreview.websiteUrl ? "Website" : s(sourceTypes[0]),
    primarySourceUrl: s(safePreview.websiteUrl),
    primarySourceAuthorityClass: safePreview.websiteUrl ? "official" : "",
    pageCount: 0,
    sourceTypes,
    strongestEvidence,
    discoveredPublicClaims: strongestEvidence,
    companyNameCandidates: uniqueStrings([safePreview.businessName], 8),
    descriptionCandidates: uniqueStrings([safePreview.whatThisBusinessIs], 8),
    serviceCandidates: uniqueStrings(arr(safePreview.coreServices), 12),
    contactCandidates: uniqueStrings(arr(safePreview.contactRoutes), 12),
    hoursCandidates: uniqueStrings(arr(safePreview.hours), 12),
    pricingCandidates: uniqueStrings([safePreview.pricingPosture], 12),
    audienceCandidates: [],
    languagesCandidates: uniqueStrings(arr(safePreview.languages), 8),
  };
}

function buildEmptyAcceptedPatch() {
  return {
    identity: {},
    services: [],
    contacts: [],
    hours: [],
    pricingPosture: "",
    humanHandoff: "",
    aiBehavior: {},
  };
}

function mergeAcceptedPatches(base = {}, extra = {}) {
  const left = obj(base);
  const right = obj(extra);

  return compactDraftObject({
    identity: compactDraftObject({
      ...obj(left.identity),
      ...obj(right.identity),
    }),
    services: uniqueStrings(
      [...arr(left.services), ...arr(right.services)].map((item) => s(item)),
      24
    ),
    contacts: uniqueStrings(
      [...arr(left.contacts), ...arr(right.contacts)].map((item) => s(item)),
      24
    ),
    hours: uniqueStrings(
      [...arr(left.hours), ...arr(right.hours)].map((item) => s(item)),
      12
    ),
    pricingPosture: s(right.pricingPosture || left.pricingPosture),
    humanHandoff: s(right.humanHandoff || left.humanHandoff),
    aiBehavior: compactDraftObject({
      ...obj(left.aiBehavior),
      ...obj(right.aiBehavior),
    }),
  });
}

function hasAcceptedPatchSignal(value = {}) {
  const patch = obj(value);

  return Boolean(
    Object.keys(obj(patch.identity)).length ||
      arr(patch.services).length ||
      arr(patch.contacts).length ||
      arr(patch.hours).length ||
      s(patch.pricingPosture) ||
      s(patch.humanHandoff) ||
      Object.keys(obj(patch.aiBehavior)).length
  );
}

function patchTouchesCurrentStep(currentStep = "", acceptedPatch = {}) {
  const step = normalizeQuestionKey(currentStep);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  if (step === "company") {
    return Boolean(s(identity.businessName) || s(identity.websiteUrl));
  }
  if (step === "description") {
    return Boolean(s(identity.description));
  }
  if (step === "services") {
    return arr(patch.services).length > 0;
  }
  if (step === "contacts") {
    return arr(patch.contacts).length > 0;
  }
  if (step === "hours") {
    return arr(patch.hours).length > 0;
  }
  if (step === "pricing") {
    return Boolean(s(patch.pricingPosture));
  }
  if (step === "handoff") {
    return Boolean(s(patch.humanHandoff));
  }

  return false;
}

function buildDraftWithAcceptedPatch(draft = {}, acceptedPatch = {}) {
  const safeDraft = obj(draft);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  const mergedServices = uniqueStrings(
    [
      ...arr(safeDraft.services).map((item) => s(item?.title || item?.name || item?.label)),
      ...arr(patch.services),
    ],
    24
  ).map((item) => ({ title: item }));

  const mergedContacts = uniqueStrings(
    [
      ...arr(safeDraft.contacts).map((item) => s(item?.value || item?.label || item?.type)),
      ...arr(patch.contacts),
    ],
    24
  ).map((item) => ({
    type: inferContactType(item),
    value: item,
    label: item,
  }));

  const mergedHours = arr(patch.hours).length
    ? parseHoursNote(arr(patch.hours).join("; "), safeDraft.hours)
    : arr(safeDraft.hours);

  const mergedPricing = s(patch.pricingPosture)
    ? parsePricingNote(s(patch.pricingPosture), safeDraft.pricingPosture, safeDraft.services)
    : obj(safeDraft.pricingPosture);

  const mergedHandoff = s(patch.humanHandoff)
    ? {
        enabled: true,
        summary: s(patch.humanHandoff),
        triggers: splitList(s(patch.humanHandoff), 16),
      }
    : obj(safeDraft.handoffRules);

  return compactDraftObject({
    ...safeDraft,
    businessProfile: compactDraftObject({
      ...obj(safeDraft.businessProfile),
      companyName: s(identity.businessName || obj(safeDraft.businessProfile).companyName),
      description: s(identity.description || obj(safeDraft.businessProfile).description),
      websiteUrl: normalizeWebsiteUrl(
        s(identity.websiteUrl || obj(safeDraft.businessProfile).websiteUrl)
      ),
    }),
    services: mergedServices,
    contacts: mergedContacts,
    hours: mergedHours,
    pricingPosture: mergedPricing,
    handoffRules: mergedHandoff,
    languages: uniqueStrings(
      [...arr(safeDraft.languages), ...arr(obj(patch.aiBehavior).languages)],
      8
    ),
    tone: s(obj(patch.aiBehavior).tone || safeDraft.tone),
    greetingStyle: s(obj(patch.aiBehavior).greetingStyle || safeDraft.greetingStyle),
    afterHoursBehavior: s(
      obj(patch.aiBehavior).afterHoursBehavior || safeDraft.afterHoursBehavior
    ),
  });
}

function stripRecognizedSourceFromText(text = "") {
  const value = s(text);
  const candidate = buildRecognizedSourceCandidate(value);
  if (!candidate?.raw) return value;

  return s(value.replace(candidate.raw, " ").replace(/\s{2,}/g, " "));
}

function extractContactCandidates(text = "") {
  const out = [];

  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  out.push(...emails.map((item) => s(item)));

  const phones =
    text.match(/(?:\+?\d[\d()\-\s]{6,}\d)/g)?.map((item) => s(item)) || [];
  out.push(...phones);

  const source = buildRecognizedSourceCandidate(text);
  if (source?.type && source.type !== "website") {
    out.push(source.value);
  }

  const listItems = splitList(text, 16);
  for (const item of listItems) {
    const type = inferContactType(item);
    if (
      type === "phone" ||
      type === "email" ||
      type === "link" ||
      /whatsapp|wp|telegram|instagram|facebook|wa\.me/i.test(item)
    ) {
      out.push(item);
    }
  }

  return uniqueStrings(out, 16);
}

function extractCompanyValue(text = "") {
  const source = buildRecognizedSourceCandidate(text);
  const stripped = stripRecognizedSourceFromText(text);

  if (!stripped) {
    return {
      businessName: "",
      websiteUrl: source?.type === "website" ? source.value : "",
    };
  }

  const lines = stripped
    .split(/\n+/)
    .map((item) => s(item))
    .filter(Boolean);

  const companyName = s(lines[0]);

  return {
    businessName: companyName,
    websiteUrl: source?.type === "website" ? source.value : "",
  };
}

function extractDescriptionValue(text = "") {
  const stripped = stripRecognizedSourceFromText(text);
  return compactText(stripped, 220);
}

function extractServiceValues(text = "") {
  const services = parseServicesNote(text, []);
  const titles = services
    .map((item) => s(item?.title || item?.name || item?.label))
    .filter(Boolean);

  if (titles.length) return uniqueStrings(titles, 16);

  return uniqueStrings(splitList(text, 16), 16);
}

function extractHoursValues(text = "") {
  const parsed = parseHoursNote(text, []);
  const hasStructured = arr(parsed).some((row) => {
    const item = obj(row);
    return Boolean(
      item.allDay === true ||
        item.appointmentOnly === true ||
        item.closed === true ||
        s(item.openTime) ||
        s(item.closeTime) ||
        s(item.notes)
    );
  });

  return hasStructured ? [compactText(text, 220)] : [];
}

function extractPricingValue(text = "", currentServices = []) {
  const parsed = parsePricingNote(text, {}, currentServices);
  const hasMeaningful = Boolean(
    s(parsed.publicSummary) ||
      s(parsed.pricingMode) ||
      s(parsed.pricingNotes) ||
      Number.isFinite(Number(parsed.startingAt)) ||
      Number.isFinite(Number(parsed.minPrice))
  );

  return hasMeaningful ? compactText(text, 220) : "";
}

function extractHandoffValue(text = "") {
  const trimmed = compactText(text, 220);
  return trimmed || "";
}

function extractValidationValueFromAcceptedPatch(step = "", acceptedPatch = {}) {
  const normalizedStep = normalizeQuestionKey(step);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  if (normalizedStep === "company") {
    return [s(identity.businessName), s(identity.websiteUrl)]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedStep === "description") {
    return s(identity.description);
  }

  if (normalizedStep === "services") {
    return arr(patch.services).join(", ");
  }

  if (normalizedStep === "contacts") {
    return arr(patch.contacts).join(", ");
  }

  if (normalizedStep === "hours") {
    return arr(patch.hours).join("; ");
  }

  if (normalizedStep === "pricing") {
    return s(patch.pricingPosture);
  }

  if (normalizedStep === "handoff") {
    return s(patch.humanHandoff);
  }

  return "";
}

function buildLocalAcceptedPatch(currentStep = "", latestMessage = "", draft = {}) {
  const step = normalizeQuestionKey(currentStep);
  const text = s(latestMessage);
  const validation = validateStepAnswer(step, text, draft);
  const source = buildRecognizedSourceCandidate(text);

  const patch = buildEmptyAcceptedPatch();

  if (!text) {
    return {
      acceptedPatch: patch,
      validation,
    };
  }

  if (!validation.accepted) {
    return {
      acceptedPatch: patch,
      validation,
    };
  }

  if (source?.type === "website") {
    patch.identity = compactDraftObject({
      websiteUrl: source.value,
    });
  }

  if (step === "company") {
    const company = extractCompanyValue(text);
    patch.identity = compactDraftObject({
      ...obj(patch.identity),
      businessName: s(company.businessName),
      websiteUrl: s(company.websiteUrl || obj(patch.identity).websiteUrl),
    });
  } else if (step === "description") {
    const description = extractDescriptionValue(text);
    if (description) {
      patch.identity = compactDraftObject({
        ...obj(patch.identity),
        description,
      });
    }
  } else if (step === "services") {
    patch.services = uniqueStrings(validation.extractedValues || extractServiceValues(text), 16);
  } else if (step === "contacts") {
    patch.contacts = uniqueStrings(validation.extractedValues || extractContactCandidates(text), 16);
  } else if (step === "hours") {
    patch.hours = extractHoursValues(text);
  } else if (step === "pricing") {
    patch.pricingPosture = extractPricingValue(text, arr(draft.services));
  } else if (step === "handoff") {
    patch.humanHandoff = extractHandoffValue(text);
  }

  return {
    acceptedPatch: compactDraftObject(patch),
    validation,
  };
}

const OPENAI_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "isRelevantToCurrentStep",
    "confidence",
    "companyName",
    "description",
    "services",
    "contacts",
    "hours",
    "pricingPosture",
    "humanHandoff",
    "websiteUrl",
    "reason",
  ],
  properties: {
    isRelevantToCurrentStep: { type: "boolean" },
    confidence: { type: "number" },
    companyName: { type: "string" },
    description: { type: "string" },
    services: { type: "array", items: { type: "string" } },
    contacts: { type: "array", items: { type: "string" } },
    hours: { type: "array", items: { type: "string" } },
    pricingPosture: { type: "string" },
    humanHandoff: { type: "string" },
    websiteUrl: { type: "string" },
    reason: { type: "string" },
  },
};

function buildSystemPrompt(locale = "az-AZ") {
  return [
    "You are a setup extraction helper for a business onboarding assistant.",
    `Reply locale is ${locale}.`,
    "You do not own the system state.",
    "Only extract grounded business facts from the latest user message.",
    "Prefer short precise extraction.",
    "Never invent services, pricing, contacts, hours, handoff rules, or company names.",
    "If the latest message does not answer the current step, mark it not relevant.",
    "Return strict JSON only.",
  ].join(" ");
}

function buildUserPrompt({
  locale = "az-AZ",
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
}) {
  return [
    "Current setup context:",
    JSON.stringify(
      {
        locale,
        currentStep,
        currentQuestion: obj(question),
        draftPreview: obj(preview),
        latestUserMessage: s(latestMessage),
      },
      null,
      2
    ),
    "",
    "Extract only grounded values for the current step and any obviously useful companion field such as website URL.",
  ].join("\n");
}

async function callOpenAISetupAssistant({
  locale = "az-AZ",
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
  model = "",
  timeoutMs = 6000,
  maxOutputTokens = 350,
} = {}) {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("openai_setup_assistant_not_configured");
  }

  const responsePromise = client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: buildSystemPrompt(locale),
      },
      {
        role: "user",
        content: buildUserPrompt({
          locale,
          currentStep,
          question,
          preview,
          latestMessage,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "setup_assistant_semantic_extraction",
        strict: true,
        schema: OPENAI_TURN_SCHEMA,
      },
    },
    max_output_tokens: maxOutputTokens,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("openai_setup_assistant_timeout")), timeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  const payload =
    obj(response?.output_parsed) && Object.keys(obj(response.output_parsed)).length
      ? response.output_parsed
      : safeJsonParse(extractJsonText(response), {});

  if (!Object.keys(obj(payload)).length) {
    throw new Error("openai_setup_assistant_empty_output");
  }

  return obj(payload);
}

function buildAcceptedPatchFromOpenAI(payload = {}) {
  const source = obj(payload);

  return compactDraftObject({
    identity: compactDraftObject({
      businessName: s(source.companyName),
      description: s(source.description),
      websiteUrl: normalizeWebsiteUrl(s(source.websiteUrl)),
    }),
    services: uniqueStrings(source.services, 16),
    contacts: uniqueStrings(source.contacts, 16),
    hours: uniqueStrings(source.hours, 12),
    pricingPosture: compactText(s(source.pricingPosture), 220),
    humanHandoff: compactText(s(source.humanHandoff), 220),
    aiBehavior: {},
  });
}

function buildAckMessage(locale = "az-AZ", currentStep = "", acceptedPatch = {}) {
  const copy = getSetupCopy(locale);
  const phrases = obj(copy.phrases);
  const step = normalizeQuestionKey(currentStep);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  if (step === "company" && s(identity.businessName)) {
    return s(phrases.companyCaptured).replace("{value}", s(identity.businessName));
  }

  if (step === "description" && s(identity.description)) {
    return s(phrases.descriptionCaptured).replace("{value}", s(identity.description));
  }

  if (step === "services" && arr(patch.services).length) {
    return s(phrases.servicesCaptured).replace(
      "{value}",
      listToNatural(locale, arr(patch.services))
    );
  }

  if (step === "contacts" && arr(patch.contacts).length) {
    return s(phrases.contactsCaptured || phrases.genericCaptured);
  }

  if (step === "hours" && arr(patch.hours).length) {
    return s(phrases.hoursCaptured || phrases.genericCaptured);
  }

  if (step === "pricing" && s(patch.pricingPosture)) {
    return s(phrases.pricingCaptured || phrases.genericCaptured);
  }

  if (step === "handoff" && s(patch.humanHandoff)) {
    return s(phrases.handoffCaptured || phrases.genericCaptured);
  }

  if (s(identity.websiteUrl)) {
    return s(phrases.genericCaptured);
  }

  return s(phrases.genericCaptured);
}

function resolveNextQuestionForDraft({
  locale = "az-AZ",
  draft = {},
  currentStep = "",
} = {}) {
  const blockers = buildApprovalBlockers(draft);

  if (blockers.length > 0) {
    return {
      readyForApproval: false,
      blockers,
      nextQuestion: buildQuestion(s(blockers[0].step || currentStep || "company"), locale),
    };
  }

  const nextQuestion = getNextQuestion(
    {},
    draft,
    {
      currentQuestionKey: currentStep,
      lastAnsweredStep: currentStep,
    },
    { locale }
  );

  return {
    readyForApproval: isDraftReadyForApproval(draft) && !nextQuestion,
    blockers: [],
    nextQuestion: nextQuestion ? obj(nextQuestion) : null,
  };
}

function buildRejectedTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  provider = "local_validation",
  model = "",
  usedFallback = false,
  error = "",
  invalidReason = "",
} = {}) {
  const preview = buildCurrentPreview(draft, review);
  const resolution = resolveNextQuestionForDraft({
    locale,
    draft,
    currentStep,
  });
  const nextQuestion =
    obj(resolution.nextQuestion).key
      ? obj(resolution.nextQuestion)
      : buildQuestion(currentStep || "company", locale);

  const copy = getSetupCopy(locale);
  const assistantMessage = [
    s(obj(copy.phrases).redirectPrefix),
    s(obj(nextQuestion).prompt),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    provider,
    model: s(model),
    usedFallback: usedFallback === true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: normalizeQuestionKey(currentStep),
      text: latestMessage,
    }),
    phase: hasSetupSignalForInterview(draft) ? "interview" : "source_capture",
    assistantMessage,
    message: assistantMessage,
    nextQuestion,
    draft: preview,
    acceptedPatch: buildEmptyAcceptedPatch(),
    rejectedInputs: [
      {
        input: s(latestMessage),
        reason: s(invalidReason || "The answer did not match the current setup step."),
        suggestedField: normalizeQuestionKey(currentStep),
      },
    ],
    confidence: {
      strong: [],
      unclear: normalizeQuestionKey(currentStep) ? [normalizeQuestionKey(currentStep)] : [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: buildSourceSignals(preview, sources),
    interviewPlan: buildInterviewPlan(currentStep, nextQuestion),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings(arr(draft.languages), 8),
      tone: s(draft.tone),
      greetingStyle: s(draft.greetingStyle),
      afterHoursBehavior: s(draft.afterHoursBehavior),
    }),
    readyForApproval: false,
  };
}

function buildAcceptedTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  acceptedPatch = {},
  provider = "local_deterministic",
  model = "",
  usedFallback = false,
  error = "",
} = {}) {
  const mergedDraft = buildDraftWithAcceptedPatch(draft, acceptedPatch);
  const preview = buildCurrentPreview(mergedDraft, review);
  const resolution = resolveNextQuestionForDraft({
    locale,
    draft: mergedDraft,
    currentStep,
  });
  const nextQuestion = resolution.readyForApproval ? null : obj(resolution.nextQuestion);
  const readyForApproval = resolution.readyForApproval === true;
  const copy = getSetupCopy(locale);
  const ack = hasAcceptedPatchSignal(acceptedPatch)
    ? buildAckMessage(locale, currentStep, acceptedPatch)
    : "";

  let assistantMessage = "";

  if (readyForApproval) {
    assistantMessage = s(obj(copy.phrases).readyForApproval);
  } else if (ack && s(obj(nextQuestion).prompt)) {
    assistantMessage = `${ack} ${s(obj(nextQuestion).prompt)}`.trim();
  } else if (ack) {
    assistantMessage = ack;
  } else {
    assistantMessage = s(obj(nextQuestion).prompt);
  }

  return {
    ok: true,
    provider,
    model: s(model),
    usedFallback: usedFallback === true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: normalizeQuestionKey(currentStep),
      text: latestMessage,
    }),
    phase: readyForApproval
      ? "ready"
      : hasSetupSignalForInterview(mergedDraft)
        ? "interview"
        : "source_capture",
    assistantMessage,
    message: assistantMessage,
    nextQuestion,
    draft: preview,
    acceptedPatch: compactDraftObject(acceptedPatch),
    rejectedInputs: [],
    confidence: {
      strong: normalizeQuestionKey(currentStep) ? [normalizeQuestionKey(currentStep)] : [],
      unclear: [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: buildSourceSignals(preview, sources),
    interviewPlan: buildInterviewPlan(currentStep, nextQuestion),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings(
        [...arr(draft.languages), locale],
        8
      ),
      tone: s(draft.tone),
      greetingStyle: s(draft.greetingStyle),
      afterHoursBehavior: s(draft.afterHoursBehavior),
    }),
    readyForApproval,
  };
}

export async function runSetupAssistantOpenAIOrchestrator({
  session = {},
  draft = {},
  sources = [],
  review = null,
  latestStep = "",
  latestMessage = "",
  forceFallback = false,
} = {}) {
  const runtime = getSetupAssistantRuntimeConfig();
  const currentStep =
    normalizeQuestionKey(latestStep) ||
    normalizeQuestionKey(obj(draft.progress).currentQuestionKey) ||
    normalizeQuestionKey(obj(draft.progress).lastAnsweredStep) ||
    normalizeQuestionKey(obj(session).currentStep) ||
    "company";

  const locale = resolveReplyLocale({
    draft,
    latestMessage,
  });

  const preview = buildCurrentPreview(draft, review);
  const currentQuestion = buildQuestion(currentStep, locale);
  const safeMessage = s(latestMessage);

  if (!safeMessage) {
    const resolution = resolveNextQuestionForDraft({
      locale,
      draft,
      currentStep,
    });

    const nextQuestion =
      resolution.readyForApproval === true
        ? null
        : obj(resolution.nextQuestion).key
          ? obj(resolution.nextQuestion)
          : buildQuestion(currentStep, locale);

    const copy = getSetupCopy(locale);
    const assistantMessage =
      resolution.readyForApproval === true
        ? s(obj(copy.phrases).readyForApproval)
        : s(obj(nextQuestion).prompt);

    return {
      ok: true,
      provider: "local_deterministic",
      model: runtime.model,
      usedFallback: false,
      error: "",
      latestUserInput: compactDraftObject({
        step: normalizeQuestionKey(currentStep),
        text: "",
      }),
      phase:
        resolution.readyForApproval === true
          ? "ready"
          : hasSetupSignalForInterview(draft)
            ? "interview"
            : "source_capture",
      assistantMessage,
      message: assistantMessage,
      nextQuestion,
      draft: preview,
      acceptedPatch: buildEmptyAcceptedPatch(),
      rejectedInputs: [],
      confidence: {
        strong: [],
        unclear: nextQuestion?.key ? [s(nextQuestion.key)] : [],
        contradictions: [],
      },
      recommendation: {
        notes: [],
      },
      sourceSignals: buildSourceSignals(preview, sources),
      interviewPlan: buildInterviewPlan(currentStep, nextQuestion),
      aiBehavior: compactDraftObject({
        languages: uniqueStrings(arr(draft.languages), 8),
        tone: s(draft.tone),
        greetingStyle: s(draft.greetingStyle),
        afterHoursBehavior: s(draft.afterHoursBehavior),
      }),
      readyForApproval: resolution.readyForApproval === true,
    };
  }

  if (isIntentOnlyMessage(safeMessage)) {
    const resolution = resolveNextQuestionForDraft({
      locale,
      draft,
      currentStep,
    });

    const nextQuestion =
      resolution.readyForApproval === true
        ? null
        : obj(resolution.nextQuestion).key
          ? obj(resolution.nextQuestion)
          : buildQuestion(currentStep, locale);

    const copy = getSetupCopy(locale);
    const assistantMessage =
      resolution.readyForApproval === true
        ? s(obj(copy.phrases).readyForApproval)
        : s(obj(nextQuestion).prompt);

    return {
      ok: true,
      provider: "local_deterministic",
      model: runtime.model,
      usedFallback: false,
      error: "",
      latestUserInput: compactDraftObject({
        step: normalizeQuestionKey(currentStep),
        text: safeMessage,
      }),
      phase:
        resolution.readyForApproval === true
          ? "ready"
          : hasSetupSignalForInterview(draft)
            ? "interview"
            : "source_capture",
      assistantMessage,
      message: assistantMessage,
      nextQuestion,
      draft: preview,
      acceptedPatch: buildEmptyAcceptedPatch(),
      rejectedInputs: [],
      confidence: {
        strong: [],
        unclear: nextQuestion?.key ? [s(nextQuestion.key)] : [],
        contradictions: [],
      },
      recommendation: {
        notes: [],
      },
      sourceSignals: buildSourceSignals(preview, sources),
      interviewPlan: buildInterviewPlan(currentStep, nextQuestion),
      aiBehavior: compactDraftObject({
        languages: uniqueStrings(arr(draft.languages), 8),
        tone: s(draft.tone),
        greetingStyle: s(draft.greetingStyle),
        afterHoursBehavior: s(draft.afterHoursBehavior),
      }),
      readyForApproval: resolution.readyForApproval === true,
    };
  }

  const localResult = buildLocalAcceptedPatch(currentStep, safeMessage, draft);
  const localAcceptedPatch = obj(localResult.acceptedPatch);
  const localValidation = obj(localResult.validation);

  if (localValidation.accepted === true && hasAcceptedPatchSignal(localAcceptedPatch)) {
    return buildAcceptedTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      acceptedPatch: localAcceptedPatch,
      provider: "local_deterministic",
      model: runtime.model,
      usedFallback: false,
      error: "",
    });
  }

  if (runtime.forceFallback === true || forceFallback === true) {
    return buildRejectedTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      provider: "local_validation",
      model: runtime.model,
      usedFallback: true,
      error: "openai_setup_assistant_forced_fallback",
      invalidReason: s(localValidation.reason),
    });
  }

  if (!hasOpenAISetupAssistant()) {
    return buildRejectedTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      provider: "local_validation",
      model: runtime.model,
      usedFallback: true,
      error: "openai_setup_assistant_unavailable",
      invalidReason: s(localValidation.reason),
    });
  }

  try {
    const openaiPayload = await callOpenAISetupAssistant({
      locale,
      currentStep,
      question: currentQuestion,
      preview,
      latestMessage: safeMessage,
      model: runtime.model,
      timeoutMs: runtime.timeoutMs,
      maxOutputTokens: runtime.maxOutputTokens,
    });

    const openAIAcceptedPatch = buildAcceptedPatchFromOpenAI(openaiPayload);
    const mergedAcceptedPatch = mergeAcceptedPatches(localAcceptedPatch, openAIAcceptedPatch);

    const validationValue = extractValidationValueFromAcceptedPatch(
      currentStep,
      mergedAcceptedPatch
    );

    const openAIValidation = validateStepAnswer(currentStep, validationValue, draft);
    const mergedDraft = buildDraftWithAcceptedPatch(draft, mergedAcceptedPatch);
    const touchesCurrentStep = patchTouchesCurrentStep(currentStep, mergedAcceptedPatch);

    const accepted =
      openAIValidation.accepted === true &&
      (touchesCurrentStep || isDraftReadyForApproval(mergedDraft) === true);

    if (!accepted) {
      return buildRejectedTurn({
        locale,
        currentStep,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        provider: "openai",
        model: runtime.model,
        usedFallback: false,
        error: "",
        invalidReason: s(openAIValidation.reason || openaiPayload.reason || localValidation.reason),
      });
    }

    return buildAcceptedTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      acceptedPatch: mergedAcceptedPatch,
      provider: "openai",
      model: runtime.model,
      usedFallback: false,
      error: "",
    });
  } catch (error) {
    return buildRejectedTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      provider: "local_validation",
      model: runtime.model,
      usedFallback: true,
      error: s(error?.message, "openai_setup_assistant_failed"),
      invalidReason: s(localValidation.reason),
    });
  }
}

export const __test__ = {
  buildCurrentPreview,
  resolveReplyLocale,
  buildLocalAcceptedPatch,
  buildDraftWithAcceptedPatch,
  patchTouchesCurrentStep,
  hasAcceptedPatchSignal,
  buildSourceSignals,
  isIntentOnlyMessage,
  mergeAcceptedPatches,
  buildAckMessage,
  extractValidationValueFromAcceptedPatch,
  resolveNextQuestionForDraft,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};