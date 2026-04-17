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
  hasSetupSignalForInterview,
  normalizeQuestionKey,
  normalizeSetupLocale,
} from "./setupAssistantApp/questions.js";
import {
  buildApprovalBlockers,
  isDraftReadyForApproval,
  validateStepAnswer,
} from "./setupAssistantApp/relevance.js";
import { patchFromAnswer } from "./setupAssistantApp/patching.js";
import {
  buildRecognizedSourceCandidate,
  inferContactType,
  normalizeWebsiteUrl,
} from "./setupAssistantApp/shared.js";
import { mergeAssistantBehaviorDraft } from "./setupAssistantApp/sanitize.js";

let cachedClient = null;

const STEP_ORDER = [
  "company",
  "description",
  "services",
  "contacts",
  "hours",
  "pricing",
  "handoff",
  "pricing_behavior",
  "location_behavior",
  "booking_behavior",
  "contact_behavior",
  "handoff_behavior",
];

const SOCIAL_PATTERNS = [
  /\bhow are you\b/i,
  /\bhow r you\b/i,
  /\bwhat('?s| is) up\b/i,
  /\bnec[eə]s[eə]n\b/i,
  /\bnecesen\b/i,
  /\bsalam\b/i,
  /\bhello\b/i,
  /\bhey\b/i,
  /\bhi\b/i,
  /\bok\b/i,
  /\bokay\b/i,
];

const CONFUSION_PATTERNS = [
  /\bi don't understand\b/i,
  /\bi dont understand\b/i,
  /\banlamad[iı]m\b/i,
  /\bbaşa düşmədim\b/i,
  /\bbasa dusmedim\b/i,
  /\bqar[iı]şd[iı]m\b/i,
  /\bconfused\b/i,
  /\bwhich one\b/i,
  /\bwhat do you mean\b/i,
];

const CORRECTION_PATTERNS = [
  /\byox\b/i,
  /\bdeyil\b/i,
  /\bd[uü]z[eə]li[şs]\b/i,
  /\bduzelis\b/i,
  /\bwrong\b/i,
  /\bnot\b/i,
  /\bactually\b/i,
  /\binstead\b/i,
  /\bcorrection\b/i,
];

const STEP_KEYWORDS = {
  company: [
    "company",
    "business",
    "name",
    "ad",
    "adı",
    "sirket",
    "şirkət",
    "brand",
    "website",
    "sayt",
  ],
  description: [
    "description",
    "summary",
    "nə iş",
    "ne ish",
    "what do",
    "about",
    "təsvir",
    "tesvir",
  ],
  services: [
    "service",
    "services",
    "xidmət",
    "xidmet",
    "offer",
    "təklif",
  ],
  contacts: [
    "contact",
    "phone",
    "number",
    "whatsapp",
    "wp",
    "email",
    "instagram",
    "facebook",
    "telegram",
    "əlaqə",
    "elaqe",
    "nömrə",
    "nomre",
  ],
  hours: [
    "hours",
    "working",
    "open",
    "close",
    "schedule",
    "saat",
    "iş saat",
    "is saat",
    "24/7",
  ],
  pricing: [
    "price",
    "pricing",
    "cost",
    "quote",
    "qiymət",
    "qiymet",
    "azn",
    "usd",
    "eur",
    "from",
    "starting",
    "xidmətə görə",
    "xidmete gore",
    "dəyişir",
    "deyisir",
  ],
  handoff: [
    "handoff",
    "human",
    "operator",
    "manager",
    "doctor",
    "admin",
    "insan",
    "yönləndir",
    "yonlendir",
    "şikayət",
    "sikayet",
    "urgent",
    "təcili",
    "tecli",
  ],
  pricing_behavior: [
    "pricing behavior",
    "pricing policy",
    "price behavior",
    "qiymət davranış",
    "qiymet davranis",
    "pricing page",
    "price page",
    "ask service first",
    "link first",
    "answer then link",
  ],
  location_behavior: [
    "location behavior",
    "location policy",
    "map",
    "xəritə",
    "xerite",
    "address behavior",
    "ünvan",
    "unvan",
  ],
  booking_behavior: [
    "booking behavior",
    "booking policy",
    "booking route",
    "reservation",
    "rezervasiya",
    "appointment",
    "instagram dm",
  ],
  contact_behavior: [
    "contact behavior",
    "contact policy",
    "contact preference",
    "əlaqə üstünlüyü",
    "elaqe ustunluyu",
    "whatsapp first",
    "phone first",
    "email first",
  ],
  handoff_behavior: [
    "handoff behavior",
    "handoff policy",
    "ask reason first",
    "contextual handoff",
    "direct handoff",
    "insana keçid",
    "insana kecid",
  ],
};

const STEP_EXAMPLES = {
  "az-AZ": {
    company: ["Neox Clinic", "Neox Clinic neox.az"],
    description: [
      "Dəri baxımı və kosmetoloji xidmətlər göstəririk.",
      "Veb sayt və çatbot həlləri hazırlayırıq.",
    ],
    services: [
      "botoks, dolğu, lazer epilyasiya",
      "veb sayt, çatbot, avtomatizasiya",
    ],
    contacts: [
      "+994 50 111 22 33 WhatsApp",
      "hello@brand.az",
      "@brandname",
    ],
    hours: [
      "bazar ertəsi-cümə 09:00-18:00, şənbə 10:00-14:00",
      "hər gün 10:00-20:00",
      "24/7",
    ],
    pricing: [
      "Qiymət xidmətə görə dəyişir.",
      "Qiymətlər 20 AZN-dən başlayır.",
      "Əvvəlcə sorğu alırıq.",
    ],
    handoff: [
      "Operator istəyi, şikayət və təcili hal olanda insana yönləndir.",
      "Ödəniş problemi olanda insana keç.",
    ],
    pricing_behavior: [
      "qısa cavab + pricing page",
      "əvvəlcə xidmət soruş",
      "birbaşa pricing page-ə yönləndir",
    ],
    location_behavior: [
      "ünvan + xəritə",
      "birbaşa xəritə",
      "yalnız qısa ünvan",
    ],
    booking_behavior: [
      "WhatsApp-a yönləndir",
      "Instagram DM-ə yönləndir",
      "əvvəlcə məlumat topla",
    ],
    contact_behavior: [
      "WhatsApp first",
      "zəng first",
      "email first",
    ],
    handoff_behavior: [
      "kontekstə görə keç",
      "əvvəlcə səbəb soruş",
      "birbaşa keç",
    ],
  },
  en: {
    company: ["North Clinic", "North Clinic northclinic.com"],
    description: [
      "We provide skincare and cosmetic services.",
      "We build websites and chatbot systems.",
    ],
    services: [
      "botox, filler, laser epilation",
      "website development, chatbot setup, automation",
    ],
    contacts: [
      "+994 50 111 22 33 WhatsApp",
      "hello@brand.az",
      "@northclinic",
    ],
    hours: [
      "Monday-Friday 09:00-18:00, Saturday 10:00-14:00",
      "every day 10:00-20:00",
      "24/7",
    ],
    pricing: [
      "Pricing depends on the service.",
      "Prices start from 20 AZN.",
      "We ask for details first.",
    ],
    handoff: [
      "Hand off for complaints, urgent issues, or operator requests.",
      "Hand off for payment problems.",
    ],
    pricing_behavior: [
      "short answer + pricing page",
      "ask service first",
      "link first",
    ],
    location_behavior: [
      "address + map",
      "map first",
      "text only",
    ],
    booking_behavior: [
      "route to WhatsApp",
      "Instagram DM",
      "collect details first",
    ],
    contact_behavior: [
      "WhatsApp first",
      "phone first",
      "email first",
    ],
    handoff_behavior: [
      "contextual handoff",
      "ask reason first",
      "direct handoff",
    ],
  },
};

const REASONER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "action",
    "targetStep",
    "reason",
    "companyName",
    "description",
    "services",
    "contacts",
    "hours",
    "pricingPosture",
    "humanHandoff",
    "websiteUrl",
    "pricingBehavior",
    "locationBehavior",
    "bookingBehavior",
    "contactBehavior",
    "handoffBehavior",
  ],
  properties: {
    action: {
      type: "string",
      enum: ["direct_answer", "correction", "off_topic", "unclear"],
    },
    targetStep: { type: "string" },
    reason: { type: "string" },
    companyName: { type: "string" },
    description: { type: "string" },
    services: { type: "array", items: { type: "string" } },
    contacts: { type: "array", items: { type: "string" } },
    hours: { type: "array", items: { type: "string" } },
    pricingPosture: { type: "string" },
    humanHandoff: { type: "string" },
    websiteUrl: { type: "string" },
    pricingBehavior: { type: "string" },
    locationBehavior: { type: "string" },
    bookingBehavior: { type: "string" },
    contactBehavior: { type: "string" },
    handoffBehavior: { type: "string" },
  },
};

const POLISHER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessName",
    "whatThisBusinessIs",
    "websiteUrl",
    "coreServices",
    "contactRoutes",
    "hours",
    "pricingPosture",
    "humanHandoff",
    "pricingBehavior",
    "locationBehavior",
    "bookingBehavior",
    "contactBehavior",
    "handoffBehavior",
    "languages",
    "tone",
    "greetingStyle",
    "afterHoursBehavior",
  ],
  properties: {
    businessName: { type: "string" },
    whatThisBusinessIs: { type: "string" },
    websiteUrl: { type: "string" },
    coreServices: { type: "array", items: { type: "string" } },
    contactRoutes: { type: "array", items: { type: "string" } },
    hours: { type: "array", items: { type: "string" } },
    pricingPosture: { type: "string" },
    humanHandoff: { type: "string" },
    pricingBehavior: { type: "string" },
    locationBehavior: { type: "string" },
    bookingBehavior: { type: "string" },
    contactBehavior: { type: "string" },
    handoffBehavior: { type: "string" },
    languages: { type: "array", items: { type: "string" } },
    tone: { type: "string" },
    greetingStyle: { type: "string" },
    afterHoursBehavior: { type: "string" },
  },
};

function isBehaviorStep(step = "") {
  return /_behavior$/.test(normalizeQuestionKey(step));
}

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 7000) ||
    7000;
  const maxOutputTokens =
    Number(cfg.ai?.openaiSetupMaxOutputTokens || 650) || 650;
  const maxPolisherOutputTokens =
    Number(cfg.ai?.openaiSetupPolisherMaxOutputTokens || 650) || 650;

  const hasKey = Boolean(s(cfg.ai?.openaiApiKey));

  return {
    enabled: cfg.ai?.openaiSetupAssistantEnabled === true || hasKey,
    forceFallback: cfg.ai?.openaiSetupForceFallback === true,
    model,
    timeoutMs,
    maxOutputTokens,
    maxPolisherOutputTokens,
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

function getTimelineTurns(review = {}) {
  const direct = arr(review.timeline)
    .map((item) => obj(item))
    .filter((item) => s(item.text || item.message));

  if (direct.length) return direct;

  return arr(review.events)
    .map((event) => ({
      role: s(event.role),
      text: s(event.text || event.message),
      questionKey: s(obj(event.payload).questionKey),
      phase: s(obj(event.payload).phase),
      provider: s(obj(event.payload).provider),
      error: s(obj(event.payload).error),
      createdAt: event.createdAt,
    }))
    .filter((item) => item.text);
}

function countAssistantAsksForStep(review = {}, step = "") {
  const normalizedStep = normalizeQuestionKey(step);
  if (!normalizedStep) return 0;

  const turns = getTimelineTurns(review).slice(-12);

  return turns.filter(
    (turn) =>
      s(turn.role).toLowerCase() === "assistant" &&
      normalizeQuestionKey(turn.questionKey) === normalizedStep
  ).length;
}

function buildHoursLines(hours = []) {
  return arr(hours)
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
    .filter(Boolean)
    .slice(0, 16);
}

function summarizeBehaviorPolicy(policyKey = "", policy = {}) {
  const safePolicy = obj(policy);

  if (policyKey === "pricing") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredTargetUrl),
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "location") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredTargetUrl),
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "booking") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredTargetUrl),
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "contact") {
    return [
      s(safePolicy.mode),
      s(safePolicy.preferredChannel),
      s(safePolicy.preferredTargetUrl),
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (policyKey === "handoff") {
    return [
      s(safePolicy.mode),
      safePolicy.requiresReason === true ? "requires reason" : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  return "";
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

  const pricingPosture = s(
    obj(safeDraft.pricingPosture).publicSummary ||
      obj(reviewDraft.pricingPosture).publicSummary ||
      businessProfile.pricingPolicy
  );

  const handoff = s(
    obj(safeDraft.handoffRules).summary ||
      arr(obj(safeDraft.handoffRules).triggers).join(", ")
  );

  const behaviorDraft = mergeAssistantBehaviorDraft(
    obj(reviewDraft.assistantBehaviorDraft),
    obj(safeDraft.assistantBehaviorDraft)
  );

  return compactDraftObject({
    businessName: s(businessProfile.companyName),
    whatThisBusinessIs: s(businessProfile.description),
    websiteUrl: normalizeWebsiteUrl(s(businessProfile.websiteUrl)),
    coreServices: uniqueStrings(services, 24),
    contactRoutes: uniqueStrings(contacts, 24),
    hours: uniqueStrings(buildHoursLines(safeDraft.hours), 16),
    pricingPosture,
    humanHandoff: handoff,
    languages: uniqueStrings(arr(safeDraft.languages), 8),
    tone: s(safeDraft.tone),
    greetingStyle: s(safeDraft.greetingStyle),
    afterHoursBehavior: s(safeDraft.afterHoursBehavior),
    pricingBehavior: summarizeBehaviorPolicy(
      "pricing",
      behaviorDraft.pricingPolicy
    ),
    locationBehavior: summarizeBehaviorPolicy(
      "location",
      behaviorDraft.locationPolicy
    ),
    bookingBehavior: summarizeBehaviorPolicy(
      "booking",
      behaviorDraft.bookingPolicy
    ),
    contactBehavior: summarizeBehaviorPolicy(
      "contact",
      behaviorDraft.contactPolicy
    ),
    handoffBehavior: summarizeBehaviorPolicy(
      "handoff",
      behaviorDraft.handoffPolicy
    ),
  });
}

function buildSourceSignals(preview = {}, sources = [], draft = {}) {
  const safePreview = obj(preview);
  const sourceRows = arr(sources);

  const sourceTypes = uniqueStrings(
    [
      ...sourceRows.map((item) => s(item?.type || item?.sourceType)),
      s(obj(draft.sourceMetadata).primarySourceType),
      safePreview.websiteUrl ? "website" : "",
    ],
    8
  );

  return {
    primarySourceType:
      s(obj(draft.sourceMetadata).primarySourceType) ||
      (safePreview.websiteUrl ? "website" : s(sourceTypes[0])),
    primarySourceLabel:
      s(arr(obj(draft.sourceMetadata).sourceLabels)[0]) ||
      (safePreview.websiteUrl ? "Website" : s(sourceTypes[0])),
    primarySourceUrl:
      s(obj(draft.sourceMetadata).primarySourceUrl) || s(safePreview.websiteUrl),
    primarySourceAuthorityClass: safePreview.websiteUrl ? "official" : "",
    pageCount: 0,
    sourceTypes,
    strongestEvidence: uniqueStrings(
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
          ? `Hours: ${arr(safePreview.hours).slice(0, 2).join(" • ")}`
          : "",
        s(safePreview.pricingPosture)
          ? `Pricing: ${safePreview.pricingPosture}`
          : "",
      ],
      12
    ),
    discoveredPublicClaims: [],
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

function buildEmptyAcceptedPatch() {
  return {
    identity: {},
    services: [],
    contacts: [],
    hours: [],
    pricingPosture: "",
    humanHandoff: "",
    aiBehavior: {},
    assistantBehaviorDraft: {},
  };
}

function hasAcceptedBehaviorPatchSignal(value = {}) {
  const behavior = obj(value);

  return [
    "pricingPolicy",
    "locationPolicy",
    "bookingPolicy",
    "contactPolicy",
    "handoffPolicy",
  ].some((key) => Object.keys(obj(behavior[key])).length > 0);
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
      Object.keys(obj(patch.aiBehavior)).length ||
      hasAcceptedBehaviorPatchSignal(obj(patch.assistantBehaviorDraft))
  );
}

function mergeAcceptedPatches(base = {}, extra = {}) {
  const left = obj(base);
  const right = obj(extra);
  const leftBehavior = obj(left.assistantBehaviorDraft);
  const rightBehavior = obj(right.assistantBehaviorDraft);

  const mergeBehaviorPolicyPatch = (a = {}, b = {}) =>
    compactDraftObject({
      ...obj(a),
      ...obj(b),
    });

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
      16
    ),
    pricingPosture: s(right.pricingPosture || left.pricingPosture),
    humanHandoff: s(right.humanHandoff || left.humanHandoff),
    aiBehavior: compactDraftObject({
      ...obj(left.aiBehavior),
      ...obj(right.aiBehavior),
    }),
    assistantBehaviorDraft: compactDraftObject({
      pricingPolicy: mergeBehaviorPolicyPatch(
        leftBehavior.pricingPolicy,
        rightBehavior.pricingPolicy
      ),
      locationPolicy: mergeBehaviorPolicyPatch(
        leftBehavior.locationPolicy,
        rightBehavior.locationPolicy
      ),
      bookingPolicy: mergeBehaviorPolicyPatch(
        leftBehavior.bookingPolicy,
        rightBehavior.bookingPolicy
      ),
      contactPolicy: mergeBehaviorPolicyPatch(
        leftBehavior.contactPolicy,
        rightBehavior.contactPolicy
      ),
      handoffPolicy: mergeBehaviorPolicyPatch(
        leftBehavior.handoffPolicy,
        rightBehavior.handoffPolicy
      ),
    }),
  });
}

function buildDraftWithAcceptedPatch(draft = {}, acceptedPatch = {}) {
  const safeDraft = obj(draft);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  const mergedServices = uniqueStrings(
    [
      ...arr(safeDraft.services).map((item) =>
        s(item?.title || item?.name || item?.label)
      ),
      ...arr(patch.services),
    ],
    24
  ).map((item) => ({ title: item }));

  const mergedContacts = uniqueStrings(
    [
      ...arr(safeDraft.contacts).map((item) =>
        s(item?.value || item?.label || item?.type)
      ),
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
    ? parsePricingNote(
        s(patch.pricingPosture),
        safeDraft.pricingPosture,
        safeDraft.services
      )
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
      companyName: s(
        identity.businessName || obj(safeDraft.businessProfile).companyName
      ),
      description: s(
        identity.description || obj(safeDraft.businessProfile).description
      ),
      websiteUrl: normalizeWebsiteUrl(
        s(identity.websiteUrl || obj(safeDraft.businessProfile).websiteUrl)
      ),
    }),
    services: mergedServices,
    contacts: mergedContacts,
    hours: mergedHours,
    pricingPosture: mergedPricing,
    handoffRules: mergedHandoff,
    assistantBehaviorDraft: mergeAssistantBehaviorDraft(
      obj(safeDraft.assistantBehaviorDraft),
      obj(patch.assistantBehaviorDraft)
    ),
    languages: uniqueStrings(
      [...arr(safeDraft.languages), ...arr(obj(patch.aiBehavior).languages)],
      8
    ),
    tone: s(obj(patch.aiBehavior).tone || safeDraft.tone),
    greetingStyle: s(
      obj(patch.aiBehavior).greetingStyle || safeDraft.greetingStyle
    ),
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

  return {
    businessName: s(lines[0]),
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
  return compactText(text, 220) || "";
}

function buildPatchForStep(step = "", text = "", draft = {}) {
  const normalizedStep = normalizeQuestionKey(step);
  const validation = validateStepAnswer(normalizedStep, text, draft);
  const patch = buildEmptyAcceptedPatch();

  if (validation.accepted !== true) {
    return {
      patch,
      validation,
    };
  }

  if (normalizedStep === "company") {
    const company = extractCompanyValue(text);
    patch.identity = compactDraftObject({
      businessName: s(company.businessName),
      websiteUrl: s(company.websiteUrl),
    });
  } else if (normalizedStep === "description") {
    patch.identity = compactDraftObject({
      description: extractDescriptionValue(text),
    });
  } else if (normalizedStep === "services") {
    patch.services = uniqueStrings(
      validation.extractedValues || extractServiceValues(text),
      16
    );
  } else if (normalizedStep === "contacts") {
    patch.contacts = uniqueStrings(
      validation.extractedValues || extractContactCandidates(text),
      16
    );
  } else if (normalizedStep === "hours") {
    patch.hours = extractHoursValues(text);
  } else if (normalizedStep === "pricing") {
    patch.pricingPosture = extractPricingValue(text, arr(draft.services));
  } else if (normalizedStep === "handoff") {
    patch.humanHandoff = extractHandoffValue(text);
  } else if (isBehaviorStep(normalizedStep)) {
    patch.assistantBehaviorDraft = obj(
      patchFromAnswer(normalizedStep, text, draft).assistantBehaviorDraft
    );
  }

  return {
    patch: compactDraftObject(patch),
    validation,
  };
}

function hasQuestionMark(text = "") {
  return /\?/.test(String(text || ""));
}

function isSocialTurn(text = "") {
  return SOCIAL_PATTERNS.some((pattern) => pattern.test(String(text || "")));
}

function isConfusionTurn(text = "") {
  return CONFUSION_PATTERNS.some((pattern) => pattern.test(String(text || "")));
}

function detectCorrectionTargetStep(text = "", currentStep = "") {
  const value = normalizeMessage(text);
  if (!CORRECTION_PATTERNS.some((pattern) => pattern.test(value))) {
    return "";
  }

  for (const step of STEP_ORDER) {
    const keywords = STEP_KEYWORDS[step] || [];
    if (keywords.some((keyword) => value.includes(normalizeMessage(keyword)))) {
      return step;
    }
  }

  return normalizeQuestionKey(currentStep);
}

function stripCorrectionPrefix(text = "") {
  return s(text)
    .replace(
      /\b(yox|deyil|düzəliş|duzelis|wrong|not|actually|instead|correction)\b[:\s-]*/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isExplicitCrossStepMention(text = "", step = "") {
  const value = normalizeMessage(text);
  const keywords = STEP_KEYWORDS[step] || [];
  return keywords.some((keyword) => value.includes(normalizeMessage(keyword)));
}

function extractCrossStepSignals(text = "", currentStep = "", draft = {}) {
  const current = normalizeQuestionKey(currentStep);

  if (!current || !isBehaviorStep(current)) {
    return {
      patch: buildEmptyAcceptedPatch(),
      steps: [],
    };
  }

  const patches = [];

  for (const step of STEP_ORDER) {
    if (step === current) continue;
    if (!isBehaviorStep(step)) continue;
    if (!isExplicitCrossStepMention(text, step)) continue;

    const result = buildPatchForStep(step, text, draft);
    if (hasAcceptedPatchSignal(result.patch)) {
      patches.push({
        step,
        patch: result.patch,
      });
    }
  }

  if (!patches.length) {
    return {
      patch: buildEmptyAcceptedPatch(),
      steps: [],
    };
  }

  let merged = buildEmptyAcceptedPatch();
  for (const item of patches) {
    merged = mergeAcceptedPatches(merged, item.patch);
  }

  return {
    patch: merged,
    steps: patches.map((item) => item.step),
  };
}

function getExamplesForStep(step = "", locale = "az-AZ") {
  const normalizedLocale = normalizeSetupLocale(locale);
  const examples =
    obj(STEP_EXAMPLES[normalizedLocale])[step] ||
    obj(STEP_EXAMPLES["az-AZ"])[step] ||
    [];
  return arr(examples).map((item) => s(item)).filter(Boolean).slice(0, 3);
}

function buildWarmRedirect(locale = "az-AZ", text = "") {
  const normalizedLocale = normalizeSetupLocale(locale);

  if (isSocialTurn(text)) {
    return normalizedLocale === "az-AZ" ? "Oldu." : "Okay.";
  }

  if (isConfusionTurn(text) || hasQuestionMark(text)) {
    return normalizedLocale === "az-AZ"
      ? "Sadə yaza bilərsən."
      : "You can answer more simply.";
  }

  return normalizedLocale === "az-AZ" ? "Bu hissə aydın olmadı." : "That part was not clear.";
}

function buildClarifyMessage({
  locale = "az-AZ",
  step = "",
  retryCount = 0,
  text = "",
} = {}) {
  const question = buildQuestion(step, locale);
  const examples = getExamplesForStep(step, locale);

  if (retryCount <= 1) {
    if (examples.length) {
      return [
        buildWarmRedirect(locale, text),
        s(question.prompt),
        normalizeSetupLocale(locale) === "az-AZ"
          ? `Məsələn: ${examples.join(" / ")}.`
          : `For example: ${examples.join(" / ")}.`,
      ]
        .filter(Boolean)
        .join(" ");
    }

    return [buildWarmRedirect(locale, text), s(question.prompt)]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizeSetupLocale(locale) === "az-AZ") {
    return [
      buildWarmRedirect(locale, text),
      "Bir qısa cümlə ilə yaza bilərsən.",
      examples.length ? `Nümunə: ${examples.join(" / ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    buildWarmRedirect(locale, text),
    "You can answer in one short sentence.",
    examples.length ? `Example: ${examples.join(" / ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function resolveConversationPlan({
  locale = "az-AZ",
  draft = {},
  currentStep = "",
  review = null,
  allowPark = true,
  preferredStep = "",
} = {}) {
  const blockers = buildApprovalBlockers(draft);

  if (!blockers.length && isDraftReadyForApproval(draft)) {
    return {
      readyForApproval: true,
      blockers: [],
      nextQuestion: null,
      parkedCurrent: false,
    };
  }

  const normalizedPreferred = normalizeQuestionKey(preferredStep);
  if (normalizedPreferred) {
    const preferredBlocker = blockers.find(
      (item) => normalizeQuestionKey(item.step) === normalizedPreferred
    );
    if (preferredBlocker) {
      return {
        readyForApproval: false,
        blockers,
        nextQuestion: buildQuestion(normalizedPreferred, locale),
        parkedCurrent: false,
      };
    }
  }

  const normalizedCurrent = normalizeQuestionKey(currentStep);
  const currentBlocker = blockers.find(
    (item) => normalizeQuestionKey(item.step) === normalizedCurrent
  );

  const retryCount = countAssistantAsksForStep(review, normalizedCurrent);

  if (allowPark === true && currentBlocker && retryCount >= 2) {
    const alternateBlocker = blockers.find(
      (item) => normalizeQuestionKey(item.step) !== normalizedCurrent
    );
    if (alternateBlocker) {
      return {
        readyForApproval: false,
        blockers,
        nextQuestion: buildQuestion(alternateBlocker.step, locale),
        parkedCurrent: true,
      };
    }
  }

  if (currentBlocker) {
    return {
      readyForApproval: false,
      blockers,
      nextQuestion: buildQuestion(normalizedCurrent, locale),
      parkedCurrent: false,
    };
  }

  const nextQuestion = getNextQuestion(
    {},
    draft,
    {
      currentQuestionKey: normalizedCurrent,
      lastAnsweredStep: normalizedCurrent,
    },
    { locale }
  );

  if (nextQuestion) {
    return {
      readyForApproval: false,
      blockers,
      nextQuestion: obj(nextQuestion),
      parkedCurrent: false,
    };
  }

  if (blockers.length) {
    return {
      readyForApproval: false,
      blockers,
      nextQuestion: buildQuestion(blockers[0].step, locale),
      parkedCurrent: false,
    };
  }

  return {
    readyForApproval: false,
    blockers: [],
    nextQuestion: buildQuestion(normalizedCurrent || "company", locale),
    parkedCurrent: false,
  };
}

function buildAck(locale = "az-AZ", kind = "noted") {
  const isAz = normalizeSetupLocale(locale) === "az-AZ";

  if (kind === "corrected") return isAz ? "Düzəltdim." : "Updated.";
  if (kind === "ready") return isAz ? "Oldu. Draft hazırdır." : "Okay. The draft is ready.";
  return isAz ? "Oldu." : "Okay.";
}

function buildTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  acceptedPatch = {},
  provider = "local_reasoning",
  model = "",
  usedFallback = false,
  error = "",
  assistantMessage = "",
  nextQuestion = null,
  rejectedInputs = [],
  recommendationNotes = [],
  forceReadyForApproval = null,
  polishedDraftOverride = null,
} = {}) {
  const mergedDraft = hasAcceptedPatchSignal(acceptedPatch)
    ? buildDraftWithAcceptedPatch(draft, acceptedPatch)
    : draft;

  const preview =
    Object.keys(obj(polishedDraftOverride)).length > 0
      ? obj(polishedDraftOverride)
      : buildCurrentPreview(mergedDraft, review);

  const plan =
    forceReadyForApproval === true && !nextQuestion
      ? {
          readyForApproval: true,
          blockers: [],
          nextQuestion: null,
          parkedCurrent: false,
        }
      : resolveConversationPlan({
          locale,
          draft: mergedDraft,
          currentStep,
          review,
        });

  const readyForApproval =
    typeof forceReadyForApproval === "boolean"
      ? forceReadyForApproval
      : plan.readyForApproval === true;

  const resolvedNextQuestion =
    readyForApproval === true
      ? null
      : obj(nextQuestion).key
        ? obj(nextQuestion)
        : obj(plan.nextQuestion);

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
    assistantMessage: s(assistantMessage),
    message: s(assistantMessage),
    nextQuestion: resolvedNextQuestion,
    draft: preview,
    acceptedPatch: compactDraftObject(acceptedPatch),
    rejectedInputs: arr(rejectedInputs),
    confidence: {
      strong: hasAcceptedPatchSignal(acceptedPatch)
        ? [normalizeQuestionKey(currentStep)].filter(Boolean)
        : [],
      unclear:
        hasAcceptedPatchSignal(acceptedPatch) || !normalizeQuestionKey(currentStep)
          ? []
          : [normalizeQuestionKey(currentStep)],
      contradictions: [],
    },
    recommendation: {
      notes: uniqueStrings(recommendationNotes, 8),
    },
    sourceSignals: buildSourceSignals(preview, sources, mergedDraft),
    interviewPlan: buildInterviewPlan(currentStep, resolvedNextQuestion),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings([...arr(mergedDraft.languages), locale], 8),
      tone: s(mergedDraft.tone),
      greetingStyle: s(mergedDraft.greetingStyle),
      afterHoursBehavior: s(mergedDraft.afterHoursBehavior),
    }),
    readyForApproval,
  };
}

function buildPassiveTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  model = "",
} = {}) {
  const plan = resolveConversationPlan({
    locale,
    draft,
    currentStep,
    review,
  });

  const assistantMessage =
    plan.readyForApproval === true
      ? buildAck(locale, "ready")
      : s(obj(plan.nextQuestion).prompt);

  return buildTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage: "",
    acceptedPatch: buildEmptyAcceptedPatch(),
    provider: "local_reasoning",
    model,
    assistantMessage,
    nextQuestion: plan.nextQuestion,
    rejectedInputs: [],
    recommendationNotes: [],
    forceReadyForApproval: plan.readyForApproval === true,
  });
}

function buildDirectAnswerTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  acceptedPatch = {},
  model = "",
  provider = "local_reasoning",
  polishedDraftOverride = null,
} = {}) {
  const mergedDraft = buildDraftWithAcceptedPatch(draft, acceptedPatch);
  const plan = resolveConversationPlan({
    locale,
    draft: mergedDraft,
    currentStep,
    review,
  });

  const assistantMessage =
    plan.readyForApproval === true
      ? buildAck(locale, "ready")
      : [buildAck(locale, "noted"), s(obj(plan.nextQuestion).prompt)]
          .filter(Boolean)
          .join(" ");

  return buildTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage,
    acceptedPatch,
    provider,
    model,
    assistantMessage,
    nextQuestion: plan.nextQuestion,
    rejectedInputs: [],
    recommendationNotes: [],
    forceReadyForApproval: plan.readyForApproval === true,
    polishedDraftOverride,
  });
}

function buildCorrectionTurn({
  locale = "az-AZ",
  currentStep = "",
  targetStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  correctionPatch = {},
  model = "",
  provider = "local_reasoning",
  polishedDraftOverride = null,
} = {}) {
  const normalizedTarget = normalizeQuestionKey(targetStep);
  const mergedDraft = buildDraftWithAcceptedPatch(draft, correctionPatch);
  const plan = resolveConversationPlan({
    locale,
    draft: mergedDraft,
    currentStep,
    review,
    preferredStep: currentStep,
  });

  const assistantMessage =
    plan.readyForApproval === true
      ? buildAck(locale, "ready")
      : [
          buildAck(locale, "corrected"),
          s(obj(plan.nextQuestion).prompt || buildQuestion(normalizedTarget, locale).prompt),
        ]
          .filter(Boolean)
          .join(" ");

  return buildTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage,
    acceptedPatch: correctionPatch,
    provider,
    model,
    assistantMessage,
    nextQuestion: plan.nextQuestion,
    rejectedInputs: [],
    recommendationNotes: [],
    forceReadyForApproval: plan.readyForApproval === true,
    polishedDraftOverride,
  });
}

function buildClarifyTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  model = "",
  provider = "local_reasoning",
  invalidReason = "",
} = {}) {
  const retryCount = countAssistantAsksForStep(review, currentStep);
  const plan = resolveConversationPlan({
    locale,
    draft,
    currentStep,
    review,
    allowPark: true,
  });

  let assistantMessage = "";
  if (plan.parkedCurrent === true && obj(plan.nextQuestion).key) {
    assistantMessage =
      normalizeSetupLocale(locale) === "az-AZ"
        ? `Keçək növbəti hissəyə. ${s(obj(plan.nextQuestion).prompt)}`
        : `Let’s move to the next part. ${s(obj(plan.nextQuestion).prompt)}`;
  } else {
    assistantMessage = buildClarifyMessage({
      locale,
      step: currentStep,
      retryCount,
      text: latestMessage,
    });
  }

  return buildTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage,
    acceptedPatch: buildEmptyAcceptedPatch(),
    provider,
    model,
    assistantMessage,
    nextQuestion: plan.nextQuestion,
    rejectedInputs: [
      {
        input: s(latestMessage),
        reason: s(
          invalidReason || "The message did not clearly answer the current step."
        ),
        suggestedField: normalizeQuestionKey(currentStep),
      },
    ],
    recommendationNotes: [invalidReason],
    forceReadyForApproval: false,
  });
}

function buildPolisherSystemPrompt(locale = "az-AZ") {
  return [
    "You are polishing a hidden internal setup draft for a business onboarding assistant.",
    `Output locale must match ${locale}.`,
    "Do not invent facts.",
    "You may rewrite, normalize, structure, and professionalize wording.",
    "Preserve uncertainty if information is incomplete.",
    "Return strict JSON only.",
  ].join(" ");
}

function buildPolisherUserPrompt({
  locale = "az-AZ",
  preview = {},
  sources = [],
} = {}) {
  return [
    "Professionalize this hidden setup draft:",
    JSON.stringify(
      {
        locale,
        preview: obj(preview),
        sources: arr(sources).slice(0, 8),
      },
      null,
      2
    ),
  ].join("\n");
}

async function callOpenAIPolisher({
  locale = "az-AZ",
  preview = {},
  sources = [],
  model = "",
  timeoutMs = 7000,
  maxOutputTokens = 650,
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
        content: buildPolisherSystemPrompt(locale),
      },
      {
        role: "user",
        content: buildPolisherUserPrompt({
          locale,
          preview,
          sources,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "setup_assistant_polished_draft",
        strict: true,
        schema: POLISHER_SCHEMA,
      },
    },
    max_output_tokens: maxOutputTokens,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("openai_setup_polisher_timeout")), timeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  const payload =
    obj(response?.output_parsed) && Object.keys(obj(response.output_parsed)).length
      ? response.output_parsed
      : safeJsonParse(extractJsonText(response), {});

  if (!Object.keys(obj(payload)).length) {
    throw new Error("openai_setup_polisher_empty_output");
  }

  return compactDraftObject({
    businessName: s(payload.businessName),
    whatThisBusinessIs: s(payload.whatThisBusinessIs),
    websiteUrl: normalizeWebsiteUrl(s(payload.websiteUrl)),
    coreServices: uniqueStrings(payload.coreServices, 24),
    contactRoutes: uniqueStrings(payload.contactRoutes, 24),
    hours: uniqueStrings(payload.hours, 16),
    pricingPosture: s(payload.pricingPosture),
    humanHandoff: s(payload.humanHandoff),
    pricingBehavior: s(payload.pricingBehavior),
    locationBehavior: s(payload.locationBehavior),
    bookingBehavior: s(payload.bookingBehavior),
    contactBehavior: s(payload.contactBehavior),
    handoffBehavior: s(payload.handoffBehavior),
    languages: uniqueStrings(payload.languages, 8),
    tone: s(payload.tone),
    greetingStyle: s(payload.greetingStyle),
    afterHoursBehavior: s(payload.afterHoursBehavior),
  });
}

function buildReasonerSystemPrompt(locale = "az-AZ") {
  return [
    "You are a reasoning layer for a business setup assistant.",
    `Output locale is ${locale}.`,
    "Your job is to understand whether the latest user message answered the current step or corrected another step.",
    "Do not invent facts.",
    "Return strict JSON only.",
  ].join(" ");
}

function buildReasonerUserPrompt({
  locale = "az-AZ",
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
} = {}) {
  return [
    "Current setup state:",
    JSON.stringify(
      {
        locale,
        currentStep,
        currentQuestion: obj(question),
        preview: obj(preview),
        latestUserMessage: s(latestMessage),
      },
      null,
      2
    ),
  ].join("\n");
}

async function callOpenAIReasoner({
  locale = "az-AZ",
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
  model = "",
  timeoutMs = 7000,
  maxOutputTokens = 650,
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
        content: buildReasonerSystemPrompt(locale),
      },
      {
        role: "user",
        content: buildReasonerUserPrompt({
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
        name: "setup_assistant_reasoner",
        strict: true,
        schema: REASONER_SCHEMA,
      },
    },
    max_output_tokens: maxOutputTokens,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("openai_setup_reasoner_timeout")), timeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  const payload =
    obj(response?.output_parsed) && Object.keys(obj(response.output_parsed)).length
      ? response.output_parsed
      : safeJsonParse(extractJsonText(response), {});

  if (!Object.keys(obj(payload)).length) {
    throw new Error("openai_setup_reasoner_empty_output");
  }

  return obj(payload);
}

function buildAcceptedPatchFromReasonerPayload(payload = {}) {
  const source = obj(payload);
  const out = buildEmptyAcceptedPatch();

  out.identity = compactDraftObject({
    businessName: s(source.companyName),
    description: s(source.description),
    websiteUrl: normalizeWebsiteUrl(s(source.websiteUrl)),
  });

  out.services = uniqueStrings(source.services, 16);
  out.contacts = uniqueStrings(source.contacts, 16);
  out.hours = uniqueStrings(source.hours, 16);
  out.pricingPosture = s(source.pricingPosture);
  out.humanHandoff = s(source.humanHandoff);

  if (s(source.pricingBehavior)) {
    out.assistantBehaviorDraft = mergeAcceptedPatches(out, {
      assistantBehaviorDraft: obj(
        patchFromAnswer("pricing_behavior", s(source.pricingBehavior), {})
          .assistantBehaviorDraft
      ),
    }).assistantBehaviorDraft;
  }

  if (s(source.locationBehavior)) {
    out.assistantBehaviorDraft = mergeAcceptedPatches(out, {
      assistantBehaviorDraft: obj(
        patchFromAnswer("location_behavior", s(source.locationBehavior), {})
          .assistantBehaviorDraft
      ),
    }).assistantBehaviorDraft;
  }

  if (s(source.bookingBehavior)) {
    out.assistantBehaviorDraft = mergeAcceptedPatches(out, {
      assistantBehaviorDraft: obj(
        patchFromAnswer("booking_behavior", s(source.bookingBehavior), {})
          .assistantBehaviorDraft
      ),
    }).assistantBehaviorDraft;
  }

  if (s(source.contactBehavior)) {
    out.assistantBehaviorDraft = mergeAcceptedPatches(out, {
      assistantBehaviorDraft: obj(
        patchFromAnswer("contact_behavior", s(source.contactBehavior), {})
          .assistantBehaviorDraft
      ),
    }).assistantBehaviorDraft;
  }

  if (s(source.handoffBehavior)) {
    out.assistantBehaviorDraft = mergeAcceptedPatches(out, {
      assistantBehaviorDraft: obj(
        patchFromAnswer("handoff_behavior", s(source.handoffBehavior), {})
          .assistantBehaviorDraft
      ),
    }).assistantBehaviorDraft;
  }

  return compactDraftObject(out);
}

async function maybeBuildPolishedDraftPreview({
  mergedDraft = {},
  review = null,
  sources = [],
  locale = "az-AZ",
  runtime = {},
} = {}) {
  const deterministicPreview = buildCurrentPreview(mergedDraft, review);

  if (!hasOpenAISetupAssistant() || runtime.forceFallback === true) {
    return deterministicPreview;
  }

  try {
    const polished = await callOpenAIPolisher({
      locale,
      preview: deterministicPreview,
      sources,
      model: runtime.model,
      timeoutMs: runtime.timeoutMs,
      maxOutputTokens: runtime.maxPolisherOutputTokens,
    });

    return Object.keys(obj(polished)).length ? polished : deterministicPreview;
  } catch {
    return deterministicPreview;
  }
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

  const currentQuestion = buildQuestion(currentStep, locale);
  const safeMessage = s(latestMessage);

  if (!safeMessage) {
    return buildPassiveTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      model: runtime.model,
    });
  }

  if (isIntentOnlyMessage(safeMessage)) {
    const plan = resolveConversationPlan({
      locale,
      draft,
      currentStep,
      review,
      allowPark: true,
    });

    const assistantMessage =
      plan.readyForApproval === true
        ? buildAck(locale, "ready")
        : s(obj(plan.nextQuestion).prompt);

    return buildTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      acceptedPatch: buildEmptyAcceptedPatch(),
      provider: "local_reasoning",
      model: runtime.model,
      assistantMessage,
      nextQuestion: plan.nextQuestion,
      rejectedInputs: [],
      recommendationNotes: [],
      forceReadyForApproval: plan.readyForApproval === true,
    });
  }

  const correctionTarget = detectCorrectionTargetStep(safeMessage, currentStep);
  if (correctionTarget && correctionTarget !== currentStep) {
    const correctionText = stripCorrectionPrefix(safeMessage);
    const correctionResult = buildPatchForStep(correctionTarget, correctionText, draft);

    if (
      correctionResult.validation?.accepted === true &&
      hasAcceptedPatchSignal(correctionResult.patch)
    ) {
      const mergedDraft = buildDraftWithAcceptedPatch(draft, correctionResult.patch);
      const polishedDraftOverride = await maybeBuildPolishedDraftPreview({
        mergedDraft,
        review,
        sources,
        locale,
        runtime,
      });

      return buildCorrectionTurn({
        locale,
        currentStep,
        targetStep: correctionTarget,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        correctionPatch: correctionResult.patch,
        model: runtime.model,
        provider: "local_reasoning",
        polishedDraftOverride,
      });
    }
  }

  const directInput =
    correctionTarget && correctionTarget === currentStep
      ? stripCorrectionPrefix(safeMessage)
      : safeMessage;

  const directResult = buildPatchForStep(currentStep, directInput, draft);
  const directPatch = obj(directResult.patch);
  const directValidation = obj(directResult.validation);

  if (directValidation.accepted === true && hasAcceptedPatchSignal(directPatch)) {
    const secondary = extractCrossStepSignals(safeMessage, currentStep, draft);
    const mergedPatch = mergeAcceptedPatches(directPatch, secondary.patch);
    const mergedDraft = buildDraftWithAcceptedPatch(draft, mergedPatch);
    const polishedDraftOverride = await maybeBuildPolishedDraftPreview({
      mergedDraft,
      review,
      sources,
      locale,
      runtime,
    });

    return buildDirectAnswerTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      acceptedPatch: mergedPatch,
      model: runtime.model,
      provider: "local_reasoning",
      polishedDraftOverride,
    });
  }

  if (
    runtime.forceFallback !== true &&
    forceFallback !== true &&
    hasOpenAISetupAssistant()
  ) {
    try {
      const preview = buildCurrentPreview(draft, review);
      const reasoned = await callOpenAIReasoner({
        locale,
        currentStep,
        question: currentQuestion,
        preview,
        latestMessage: safeMessage,
        model: runtime.model,
        timeoutMs: runtime.timeoutMs,
        maxOutputTokens: runtime.maxOutputTokens,
      });

      const action = s(reasoned.action).toLowerCase();
      const targetStep = normalizeQuestionKey(
        s(reasoned.targetStep || currentStep)
      );
      const reasonedPatch = buildAcceptedPatchFromReasonerPayload(reasoned);

      if (
        (action === "direct_answer" || action === "correction") &&
        hasAcceptedPatchSignal(reasonedPatch)
      ) {
        const mergedDraft = buildDraftWithAcceptedPatch(draft, reasonedPatch);
        const polishedDraftOverride = await maybeBuildPolishedDraftPreview({
          mergedDraft,
          review,
          sources,
          locale,
          runtime,
        });

        if (action === "correction" && targetStep) {
          return buildCorrectionTurn({
            locale,
            currentStep,
            targetStep,
            draft,
            review,
            sources,
            latestMessage: safeMessage,
            correctionPatch: reasonedPatch,
            model: runtime.model,
            provider: "openai_reasoning",
            polishedDraftOverride,
          });
        }

        return buildDirectAnswerTurn({
          locale,
          currentStep,
          draft,
          review,
          sources,
          latestMessage: safeMessage,
          acceptedPatch: reasonedPatch,
          model: runtime.model,
          provider: "openai_reasoning",
          polishedDraftOverride,
        });
      }

      return buildClarifyTurn({
        locale,
        currentStep,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        model: runtime.model,
        provider: "openai_reasoning",
        invalidReason: s(reasoned.reason || directValidation.reason),
      });
    } catch (error) {
      return buildClarifyTurn({
        locale,
        currentStep,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        model: runtime.model,
        provider: "local_reasoning",
        invalidReason: s(error?.message || directValidation.reason),
      });
    }
  }

  return buildClarifyTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage: safeMessage,
    model: runtime.model,
    provider: "local_reasoning",
    invalidReason: s(directValidation.reason),
  });
}

export const __test__ = {
  buildCurrentPreview,
  buildSourceSignals,
  resolveReplyLocale,
  buildPatchForStep,
  buildDraftWithAcceptedPatch,
  hasAcceptedPatchSignal,
  mergeAcceptedPatches,
  detectCorrectionTargetStep,
  stripCorrectionPrefix,
  extractCrossStepSignals,
  resolveConversationPlan,
  countAssistantAsksForStep,
  isSocialTurn,
  isConfusionTurn,
  buildAcceptedPatchFromReasonerPayload,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};