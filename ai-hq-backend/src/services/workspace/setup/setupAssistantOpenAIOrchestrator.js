import OpenAI from "openai";

import { cfg } from "../../../config.js";
import { arr, compactDraftObject, obj, s } from "./draftShared.js";
import {
  parseHoursNote,
  parsePricingNote,
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
} from "./setupAssistantApp/relevance.js";
import {
  inferContactType,
  normalizeWebsiteUrl,
} from "./setupAssistantApp/shared.js";

let cachedClient = null;

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
  ],
  properties: {
    action: {
      type: "string",
      enum: ["direct_answer", "correction", "business_brief", "off_topic", "unclear"],
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
    "languages",
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
    languages: { type: "array", items: { type: "string" } },
  },
};

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

    // IMPORTANT:
    // normal setup turns should stay fast by default.
    // turn-time polishing is opt-in only.
    enableTurnPolisher: cfg.ai?.openaiSetupEnableTurnPolisher === true,

    // even if turn polisher is enabled later, keep it final-draft only by default.
    turnPolisherReadyOnly:
      cfg.ai?.openaiSetupTurnPolisherReadyOnly !== false,

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
  };
}

function hasAcceptedPatchSignal(value = {}) {
  const patch = obj(value);

  return Boolean(
    Object.keys(obj(patch.identity)).length ||
      arr(patch.services).length ||
      arr(patch.contacts).length ||
      arr(patch.hours).length ||
      s(patch.pricingPosture) ||
      s(patch.humanHandoff)
  );
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
      16
    ),
    pricingPosture: s(right.pricingPosture || left.pricingPosture),
    humanHandoff: s(right.humanHandoff || left.humanHandoff),
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
    languages: uniqueStrings(arr(safeDraft.languages), 8),
  });
}

function buildClarifyMessage({
  locale = "az-AZ",
  step = "",
  text = "",
} = {}) {
  const question = buildQuestion(step, locale);
  const isAz = normalizeSetupLocale(locale) === "az-AZ";

  return [
    isAz
      ? "Bu məlumatı təhlükəsiz çıxara bilmədim."
      : "I could not safely extract that information.",
    s(question.prompt),
    s(text) ? "" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildBrainUnavailableTurn({
  locale = "az-AZ",
  currentStep = "",
  draft = {},
  review = null,
  sources = [],
  latestMessage = "",
  model = "",
  reason = "openai_setup_brain_required",
} = {}) {
  const isAz = normalizeSetupLocale(locale) === "az-AZ";
  const plan = resolveConversationPlan({
    locale,
    draft,
    currentStep,
    review,
    allowPark: true,
  });

  const assistantMessage = isAz
    ? "Ağıllı setup beyni aktiv deyil. Bu axın keyword fallback ilə davam etməyəcək; OpenAI setup brain aktiv olmalıdır."
    : "The intelligent setup brain is not active. This flow will not continue with a keyword fallback; the OpenAI setup brain must be enabled.";

  return buildTurn({
    locale,
    currentStep,
    draft,
    review,
    sources,
    latestMessage,
    acceptedPatch: buildEmptyAcceptedPatch(),
    provider: "setup_brain_unavailable",
    model,
    usedFallback: false,
    error: reason,
    assistantMessage,
    nextQuestion: plan.nextQuestion,
    rejectedInputs: [
      {
        input: s(latestMessage),
        reason: assistantMessage,
        suggestedField: normalizeQuestionKey(currentStep),
      },
    ],
    recommendationNotes: [reason],
    forceReadyForApproval: false,
  });
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
  provider = "setup_navigation",
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
    aiBehavior: {},
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
    provider: "setup_navigation",
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
  provider = "setup_navigation",
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
  provider = "setup_navigation",
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
  provider = "setup_navigation",
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
    languages: uniqueStrings(payload.languages, 8),
  });
}

function buildReasonerSystemPrompt(locale = "az-AZ") {
  return [
    "You are the intelligence layer for an AI business setup assistant.",
    `Output locale is ${locale}.`,
    "Your job is not to match keywords. Your job is to understand the business from the latest user message and current setup state.",
    "The user may write in any language and may describe the whole business in 1-3 sentences.",
    "Extract every explicit business fact you can: identity, description, services, contact routes, hours, pricing posture, handoff/risk rules, and website URL.",
    "If the message is a rich business brief, set action to business_brief.",
    "If it answers the current setup question, set action to direct_answer.",
    "If it corrects an earlier fact, set action to correction and targetStep to the corrected area.",
    "If you are not sure, leave fields empty and set action to unclear.",
    "Never invent facts. Do not infer exact prices, hours, addresses, availability, medical/legal claims, or guarantees unless explicitly stated.",
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
    "Analyze this setup turn as a business brain extractor, not as a keyword parser.",
    JSON.stringify(
      {
        locale,
        currentStep,
        currentQuestion: obj(question),
        currentPreview: obj(preview),
        latestUserMessage: s(latestMessage),
        extractionRules: {
          websiteIsOptional: true,
          googleMapsDisabledForV1: true,
          manualBriefAllowed: true,
          maxCriticalMissingQuestionsLater: 5,
          doNotInventUnknownBusinessFacts: true,
          emptyStringMeansNotProvided: true,
        },
        outputMeaning: {
          companyName: "explicit business or brand name only",
          description: "what the business is or does",
          services: "explicit services/products/offerings",
          contacts: "explicit phone, WhatsApp, email, social, or contact links",
          hours: "explicit working hours only",
          pricingPosture: "explicit pricing logic, not invented exact pricing",
          humanHandoff: "explicit or safety-critical human handoff/risk rules",
          websiteUrl: "explicit website URL only",
        },
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

  return compactDraftObject(out);
}

function shouldUseTurnPolisher({ runtime = {}, mergedDraft = {} } = {}) {
  if (runtime.enableTurnPolisher !== true) return false;
  if (!hasSetupSignalForInterview(mergedDraft)) return false;

  // Default behavior: only allow expensive polishing when the draft is
  // already effectively review-ready.
  if (runtime.turnPolisherReadyOnly !== false) {
    return buildApprovalBlockers(mergedDraft).length === 0;
  }

  return true;
}

async function maybeBuildPolishedDraftPreview({
  mergedDraft = {},
  review = null,
  sources = [],
  locale = "az-AZ",
  runtime = {},
} = {}) {
  const deterministicPreview = buildCurrentPreview(mergedDraft, review);

  // Keep normal interview turns fast.
  // By default we do NOT run the OpenAI polisher inside the request path.
  if (!shouldUseTurnPolisher({ runtime, mergedDraft })) {
    return deterministicPreview;
  }

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
      provider: "setup_navigation",
      model: runtime.model,
      assistantMessage,
      nextQuestion: plan.nextQuestion,
      rejectedInputs: [],
      recommendationNotes: [],
      forceReadyForApproval: plan.readyForApproval === true,
    });
  }

  if (
    runtime.forceFallback === true ||
    forceFallback === true ||
    !hasOpenAISetupAssistant()
  ) {
    return buildBrainUnavailableTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      model: runtime.model,
      reason:
        runtime.forceFallback === true || forceFallback === true
          ? "openai_setup_brain_forced_off"
          : "openai_setup_brain_required",
    });
  }

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
      ["direct_answer", "correction", "business_brief"].includes(action) &&
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
          provider: "openai_business_brain",
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
        provider: "openai_business_brain",
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
      provider: "openai_business_brain",
      invalidReason: s(
        reasoned.reason || "The AI setup brain could not extract safe business facts."
      ),
    });
  } catch (error) {
    return buildBrainUnavailableTurn({
      locale,
      currentStep,
      draft,
      review,
      sources,
      latestMessage: safeMessage,
      model: runtime.model,
      reason: s(error?.message || "openai_setup_brain_failed"),
    });
  }
}

export const __test__ = {
  buildCurrentPreview,
  buildSourceSignals,
  resolveReplyLocale,
  buildDraftWithAcceptedPatch,
  hasAcceptedPatchSignal,
  mergeAcceptedPatches,
  resolveConversationPlan,
  countAssistantAsksForStep,
  buildAcceptedPatchFromReasonerPayload,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};