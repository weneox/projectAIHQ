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
    "do",
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
    "how to answer price",
    "price replies",
    "qiymet davranis",
    "qiymət davranış",
    "pricing page",
    "ask service first",
  ],
  location_behavior: [
    "location behavior",
    "location policy",
    "map",
    "xerite",
    "xəritə",
    "address behavior",
    "unvan",
    "ünvan",
  ],
  booking_behavior: [
    "booking behavior",
    "booking policy",
    "booking route",
    "reservation",
    "rezervasiya",
    "appointment",
    "whatsapp",
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
    "insana kecid",
    "insana keçid",
  ],
};

const STEP_EXAMPLES = {
  "az-AZ": {
    company: ["MAND Beauty", "Mand Beauty mand.az"],
    description: [
      "Qadın saç kəsimi, boyama və baxım xidmətləri göstəririk.",
      "Logistika və yükdaşıma xidməti göstəririk.",
    ],
    services: [
      "saç kəsimi, saç boyama, baxım",
      "yükdaşıma, logistika, anbarlama",
    ],
    contacts: [
      "+994 50 555 55 55 WhatsApp",
      "hello@brand.az",
      "@mandbeauty",
    ],
    hours: [
      "həftə içi 09:00-18:00",
      "hər gün 10:00-20:00",
      "24/7",
    ],
    pricing: [
      "Qiymətlər 20 AZN-dən başlayır.",
      "Dəqiq qiymət xidmətə görə dəyişir, əvvəlcə detal alırıq.",
      "Public qiymət vermirik, əvvəlcə sorğu alırıq.",
    ],
    handoff: [
      "Müştəri operator istəyəndə insana yönləndir.",
      "Şikayət, təcili hal və ödəniş problemi olanda insana keç.",
    ],
    pricing_behavior: [
      "qÄ±sa cavab + pricing page",
      "É™vvÉ™lcÉ™ xidmÉ™t soruÅŸ",
      "birbaÅŸa pricing page-É™ yÃ¶nlÉ™ndir",
    ],
    location_behavior: [
      "Ã¼nvan + xÉ™ritÉ™",
      "birbaÅŸa xÉ™ritÉ™",
      "yalnÄ±z qÄ±sa Ã¼nvan",
    ],
    booking_behavior: [
      "WhatsApp-a yÃ¶nlÉ™ndir",
      "Instagram DM-É™ yÃ¶nlÉ™ndir",
      "É™vvÉ™lcÉ™ mÉ™lumat topla sonra yÃ¶nlÉ™ndir",
    ],
    contact_behavior: [
      "WhatsApp first",
      "zÉ™ng first",
      "email first",
    ],
    handoff_behavior: [
      "kontekstÉ™ gÃ¶rÉ™ keÃ§",
      "É™vvÉ™lcÉ™ sÉ™bÉ™b soruÅŸ",
      "birbaÅŸa keÃ§",
    ],
  },
  en: {
    company: ["North Clinic", "North Clinic northclinic.com"],
    description: [
      "We provide dental consultation, whitening, and implant services.",
      "We provide logistics and cargo transport services.",
    ],
    services: [
      "haircut, coloring, treatment",
      "cargo transport, logistics, warehousing",
    ],
    contacts: [
      "+994 50 555 55 55 WhatsApp",
      "hello@brand.az",
      "@northclinic",
    ],
    hours: [
      "weekdays 09:00-18:00",
      "every day 10:00-20:00",
      "24/7",
    ],
    pricing: [
      "Prices start from 20 AZN.",
      "Exact pricing depends on the service, we ask for details first.",
      "We do not share exact prices publicly.",
    ],
    handoff: [
      "Hand off to a human when the customer asks for an operator.",
      "Hand off for complaints, urgent issues, or payment problems.",
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

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 7000) ||
    7000;
  const maxOutputTokens =
    Number(cfg.ai?.openaiSetupMaxOutputTokens || 500) || 500;

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

  const behaviorDraft = mergeAssistantBehaviorDraft(
    obj(reviewDraft.assistantBehaviorDraft),
    obj(safeDraft.assistantBehaviorDraft)
  );

  const summarizeBehavior = (policyKey = "", policy = {}) => {
    const safePolicy = obj(policy);

    if (policyKey === "pricing") {
      return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
        .filter(Boolean)
        .join(" ");
    }
    if (policyKey === "location") {
      return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
        .filter(Boolean)
        .join(" ");
    }
    if (policyKey === "booking") {
      return [s(safePolicy.mode), s(safePolicy.preferredTargetUrl)]
        .filter(Boolean)
        .join(" ");
    }
    if (policyKey === "contact") {
      return [
        s(safePolicy.mode),
        s(safePolicy.preferredChannel),
        s(safePolicy.preferredTargetUrl),
      ]
        .filter(Boolean)
        .join(" ");
    }
    if (policyKey === "handoff") {
      return [
        s(safePolicy.mode),
        safePolicy.requiresReason === true ? "requires reason" : "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return "";
  };

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
    pricingBehavior: summarizeBehavior("pricing", behaviorDraft.pricingPolicy),
    locationBehavior: summarizeBehavior("location", behaviorDraft.locationPolicy),
    bookingBehavior: summarizeBehavior("booking", behaviorDraft.bookingPolicy),
    contactBehavior: summarizeBehavior("contact", behaviorDraft.contactPolicy),
    handoffBehavior: summarizeBehavior("handoff", behaviorDraft.handoffPolicy),
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
    assistantBehaviorDraft: {},
  };
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
      12
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
      hasAcceptedBehaviorPatchSignal(patch.assistantBehaviorDraft)
  );
}

function patchTouchesCurrentStep(currentStep = "", acceptedPatch = {}) {
  const step = normalizeQuestionKey(currentStep);
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);
  const behaviorDraft = obj(patch.assistantBehaviorDraft);

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
  if (step === "pricing_behavior") {
    return Object.keys(obj(behaviorDraft.pricingPolicy)).length > 0;
  }
  if (step === "location_behavior") {
    return Object.keys(obj(behaviorDraft.locationPolicy)).length > 0;
  }
  if (step === "booking_behavior") {
    return Object.keys(obj(behaviorDraft.bookingPolicy)).length > 0;
  }
  if (step === "contact_behavior") {
    return Object.keys(obj(behaviorDraft.contactPolicy)).length > 0;
  }
  if (step === "handoff_behavior") {
    return Object.keys(obj(behaviorDraft.handoffPolicy)).length > 0;
  }

  return false;
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

  const mergedBehaviorDraft = mergeAssistantBehaviorDraft(
    obj(safeDraft.assistantBehaviorDraft),
    obj(patch.assistantBehaviorDraft)
  );

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
    assistantBehaviorDraft: mergedBehaviorDraft,
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
  } else if (
    [
      "pricing_behavior",
      "location_behavior",
      "booking_behavior",
      "contact_behavior",
      "handoff_behavior",
    ].includes(normalizedStep)
  ) {
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

function extractCrossStepSignals(text = "", currentStep = "", draft = {}) {
  const patches = [];
  const normalizedCurrent = normalizeQuestionKey(currentStep);
  const currentIsBehavior = /_behavior$/.test(normalizedCurrent);
  const candidateSteps = STEP_ORDER.filter((step) => {
    if (step === normalizedCurrent) return false;
    if (currentIsBehavior) return /_behavior$/.test(step);
    return /_behavior$/.test(step);
  });

  for (const step of candidateSteps) {
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
    if (normalizedLocale === "az-AZ") return "Mən yaxşıyam 🙂";
    return "I’m good 🙂";
  }
  if (isConfusionTurn(text) || hasQuestionMark(text)) {
    if (normalizedLocale === "az-AZ") {
      return "Aydın oldu — qarışdırmayaq.";
    }
    return "Got it — let’s make this simpler.";
  }
  if (normalizedLocale === "az-AZ") {
    return "Bu cavabdan faydalı setup məlumatı çıxmadı.";
  }
  return "That did not give me a usable setup answer.";
}

function buildClarifyMessage({
  locale = "az-AZ",
  step = "",
  retryCount = 0,
  text = "",
}) {
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
      "Bu hissəni bir cümlə ilə və ya hazır nümunə kimi yaza bilərsiniz.",
      examples.length ? `Nümunə: ${examples.join(" / ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    buildWarmRedirect(locale, text),
    "You can answer this in one short sentence or by following one of these examples.",
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

  if (
    allowPark === true &&
    currentBlocker &&
    retryCount >= 2
  ) {
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
} = {}) {
  const mergedDraft = hasAcceptedPatchSignal(acceptedPatch)
    ? buildDraftWithAcceptedPatch(draft, acceptedPatch)
    : draft;

  const preview = buildCurrentPreview(mergedDraft, review);
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
    readyForApproval === true ? null : obj(nextQuestion).key ? obj(nextQuestion) : obj(plan.nextQuestion);

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
    sourceSignals: buildSourceSignals(preview, sources),
    interviewPlan: buildInterviewPlan(currentStep, resolvedNextQuestion),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings([...arr(draft.languages), locale], 8),
      tone: s(draft.tone),
      greetingStyle: s(draft.greetingStyle),
      afterHoursBehavior: s(draft.afterHoursBehavior),
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
  const copy = getSetupCopy(locale);
  const plan = resolveConversationPlan({
    locale,
    draft,
    currentStep,
    review,
  });

  const assistantMessage =
    plan.readyForApproval === true
      ? s(obj(copy.phrases).readyForApproval)
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
  extraNote = "",
} = {}) {
  const copy = getSetupCopy(locale);
  const mergedDraft = buildDraftWithAcceptedPatch(draft, acceptedPatch);
  const plan = resolveConversationPlan({
    locale,
    draft: mergedDraft,
    currentStep,
    review,
  });

  let ack = "";
  const patch = obj(acceptedPatch);
  const identity = obj(patch.identity);

  if (currentStep === "company" && s(identity.businessName)) {
    ack = s(obj(copy.phrases).companyCaptured).replace(
      "{value}",
      s(identity.businessName)
    );
  } else if (currentStep === "description" && s(identity.description)) {
    ack = s(obj(copy.phrases).descriptionCaptured).replace(
      "{value}",
      s(identity.description)
    );
  } else if (currentStep === "services" && arr(patch.services).length) {
    ack = s(obj(copy.phrases).servicesCaptured).replace(
      "{value}",
      listToNatural(locale, arr(patch.services))
    );
  } else if (currentStep === "contacts" && arr(patch.contacts).length) {
    ack = s(obj(copy.phrases).contactsCaptured);
  } else if (currentStep === "hours" && arr(patch.hours).length) {
    ack = s(obj(copy.phrases).hoursCaptured);
  } else if (currentStep === "pricing" && s(patch.pricingPosture)) {
    ack = s(obj(copy.phrases).pricingCaptured);
  } else if (currentStep === "handoff" && s(patch.humanHandoff)) {
    ack = s(obj(copy.phrases).handoffCaptured);
  } else if (
    currentStep === "pricing_behavior" &&
    Object.keys(obj(obj(patch.assistantBehaviorDraft).pricingPolicy)).length
  ) {
    ack = s(obj(copy.phrases).pricingBehaviorCaptured);
  } else if (
    currentStep === "location_behavior" &&
    Object.keys(obj(obj(patch.assistantBehaviorDraft).locationPolicy)).length
  ) {
    ack = s(obj(copy.phrases).locationBehaviorCaptured);
  } else if (
    currentStep === "booking_behavior" &&
    Object.keys(obj(obj(patch.assistantBehaviorDraft).bookingPolicy)).length
  ) {
    ack = s(obj(copy.phrases).bookingBehaviorCaptured);
  } else if (
    currentStep === "contact_behavior" &&
    Object.keys(obj(obj(patch.assistantBehaviorDraft).contactPolicy)).length
  ) {
    ack = s(obj(copy.phrases).contactBehaviorCaptured);
  } else if (
    currentStep === "handoff_behavior" &&
    Object.keys(obj(obj(patch.assistantBehaviorDraft).handoffPolicy)).length
  ) {
    ack = s(obj(copy.phrases).handoffBehaviorCaptured);
  } else {
    ack = s(obj(copy.phrases).genericCaptured);
  }

  const assistantMessage =
    plan.readyForApproval === true
      ? [ack, s(obj(copy.phrases).readyForApproval), extraNote]
          .filter(Boolean)
          .join(" ")
      : [ack, extraNote, s(obj(plan.nextQuestion).prompt)]
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
    if (normalizeSetupLocale(locale) === "az-AZ") {
      assistantMessage = [
        buildWarmRedirect(locale, latestMessage),
        "Bu hissəni sonra bağlayaq.",
        s(obj(plan.nextQuestion).prompt),
      ]
        .filter(Boolean)
        .join(" ");
    } else {
      assistantMessage = [
        buildWarmRedirect(locale, latestMessage),
        "We can come back to this part.",
        s(obj(plan.nextQuestion).prompt),
      ]
        .filter(Boolean)
        .join(" ");
    }
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

  const targetLabel =
    normalizeSetupLocale(locale) === "az-AZ"
      ? `Düzəltdim: ${normalizedTarget}.`
      : `Updated: ${normalizedTarget}.`;

  let assistantMessage = "";
  if (plan.readyForApproval === true) {
    assistantMessage =
      normalizeSetupLocale(locale) === "az-AZ"
        ? `${targetLabel} Əla. Setup draft kifayət qədər doludur.`
        : `${targetLabel} Great. The setup draft is complete enough.`;
  } else {
    assistantMessage = [targetLabel, s(obj(plan.nextQuestion).prompt)]
      .filter(Boolean)
      .join(" ");
  }

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
  });
}

function buildSupplementalTurn({
  locale = "az-AZ",
  currentStep = "",
  supplementalSteps = [],
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  acceptedPatch = {},
  model = "",
  provider = "local_reasoning",
} = {}) {
  const mergedDraft = buildDraftWithAcceptedPatch(draft, acceptedPatch);
  const plan = resolveConversationPlan({
    locale,
    draft: mergedDraft,
    currentStep,
    review,
    preferredStep: currentStep,
  });

  const capturedLabel =
    normalizeSetupLocale(locale) === "az-AZ"
      ? `Bunu ${listToNatural(locale, supplementalSteps)} hissəsi üçün də qeyd etdim.`
      : `I also captured that for ${listToNatural(locale, supplementalSteps)}.`;

  const assistantMessage = [capturedLabel, s(obj(plan.nextQuestion).prompt)]
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
  });
}

const OPENAI_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "action",
    "targetStep",
    "currentStepAnswered",
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
    action: {
      type: "string",
      enum: [
        "direct_answer",
        "correction",
        "supplemental",
        "off_topic",
        "unclear",
      ],
    },
    targetStep: { type: "string" },
    currentStepAnswered: { type: "boolean" },
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
    "You are the reasoning layer for a business setup assistant.",
    `Reply locale is ${locale}.`,
    "Your job is to interpret the latest user message in context.",
    "Decide whether the user answered the current step, corrected an earlier field, added another useful signal, or went off-topic.",
    "Do not invent facts.",
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
  ].join("\n");
}

async function callOpenAISetupAssistant({
  locale = "az-AZ",
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
  model = "",
  timeoutMs = 7000,
  maxOutputTokens = 500,
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
        name: "setup_assistant_reasoning",
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
    const copy = getSetupCopy(locale);
    const assistantMessage =
      plan.readyForApproval === true
        ? s(obj(copy.phrases).readyForApproval)
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
    const extraNote =
      secondary.steps.length > 0
        ? normalizeSetupLocale(locale) === "az-AZ"
          ? `Əlavə olaraq ${listToNatural(locale, secondary.steps)} üçün də faydalı məlumat gördüm.`
          : `I also picked up useful info for ${listToNatural(locale, secondary.steps)}.`
        : "";

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
      extraNote,
    });
  }

  if (correctionTarget) {
    const correctionText = stripCorrectionPrefix(safeMessage);
    const correctionResult = buildPatchForStep(correctionTarget, correctionText, draft);

    if (
      correctionResult.validation?.accepted === true &&
      hasAcceptedPatchSignal(correctionResult.patch)
    ) {
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
      });
    }
  }

  const secondary = extractCrossStepSignals(safeMessage, currentStep, draft);
  if (hasAcceptedPatchSignal(secondary.patch)) {
    return buildSupplementalTurn({
      locale,
      currentStep,
      supplementalSteps: secondary.steps,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      acceptedPatch: secondary.patch,
      model: runtime.model,
      provider: "local_reasoning",
    });
  }

  if (runtime.forceFallback === true || forceFallback === true) {
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

  if (!hasOpenAISetupAssistant()) {
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

    const action = s(openaiPayload.action).toLowerCase();
    const targetStep = normalizeQuestionKey(
      s(openaiPayload.targetStep || currentStep)
    );
    const modelPatch = buildAcceptedPatchFromOpenAI(openaiPayload);

    if (
      action === "direct_answer" &&
      targetStep === currentStep &&
      hasAcceptedPatchSignal(modelPatch)
    ) {
      return buildDirectAnswerTurn({
        locale,
        currentStep,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        acceptedPatch: modelPatch,
        model: runtime.model,
        provider: "openai_reasoning",
      });
    }

    if (
      action === "correction" &&
      targetStep &&
      hasAcceptedPatchSignal(modelPatch)
    ) {
      return buildCorrectionTurn({
        locale,
        currentStep,
        targetStep,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        correctionPatch: modelPatch,
        model: runtime.model,
        provider: "openai_reasoning",
      });
    }

    if (action === "supplemental" && hasAcceptedPatchSignal(modelPatch)) {
      const supplementalSteps = STEP_ORDER.filter((step) => {
        const value = normalizeMessage(
          step === "company"
            ? `${s(obj(modelPatch.identity).businessName)} ${s(obj(modelPatch.identity).websiteUrl)}`
            : step === "description"
              ? s(obj(modelPatch.identity).description)
              : step === "services"
                ? arr(modelPatch.services).join(", ")
                : step === "contacts"
                  ? arr(modelPatch.contacts).join(", ")
                  : step === "hours"
                    ? arr(modelPatch.hours).join(", ")
                    : step === "pricing"
                      ? s(modelPatch.pricingPosture)
                      : step === "handoff"
                        ? s(modelPatch.humanHandoff)
                        : ""
        );
        return Boolean(value) && step !== currentStep;
      });

      return buildSupplementalTurn({
        locale,
        currentStep,
        supplementalSteps,
        draft,
        review,
        sources,
        latestMessage: safeMessage,
        acceptedPatch: modelPatch,
        model: runtime.model,
        provider: "openai_reasoning",
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
      invalidReason: s(openaiPayload.reason || directValidation.reason),
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

export const __test__ = {
  buildCurrentPreview,
  resolveReplyLocale,
  buildPatchForStep,
  buildDraftWithAcceptedPatch,
  patchTouchesCurrentStep,
  hasAcceptedPatchSignal,
  buildSourceSignals,
  isIntentOnlyMessage,
  mergeAcceptedPatches,
  detectCorrectionTargetStep,
  stripCorrectionPrefix,
  extractCrossStepSignals,
  resolveConversationPlan,
  countAssistantAsksForStep,
  isSocialTurn,
  isConfusionTurn,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};
