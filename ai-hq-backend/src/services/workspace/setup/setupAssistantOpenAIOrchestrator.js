import OpenAI from "openai";

import { cfg } from "../../../config.js";
import { arr, compactDraftObject, obj, s } from "./draftShared.js";
import { normalizeWebsiteUrl } from "./setupAssistantApp/shared.js";

const STEP_ORDER = [
  "company",
  "description",
  "services",
  "contacts",
  "hours",
  "pricing",
  "handoff",
];

const STEP_META = {
  company: {
    key: "company",
    step: "company",
    title: "Company name",
    prompt: "O zaman başlayaq. Şirkətinizin adı nədir?",
  },
  description: {
    key: "description",
    step: "description",
    title: "Business description",
    prompt: "Qısa olaraq nə iş gördüyünüzü yazın.",
  },
  services: {
    key: "services",
    step: "services",
    title: "Core services",
    prompt:
      "Əsas xidmətlərinizi yazın. Vergüllə və ya sətir-sətir yaza bilərsiniz.",
  },
  contacts: {
    key: "contacts",
    step: "contacts",
    title: "Contact routes",
    prompt:
      "Müştəri sizinlə necə əlaqə saxlamalıdır? Telefon, email, WhatsApp və ya link yazın.",
  },
  hours: {
    key: "hours",
    step: "hours",
    title: "Working hours",
    prompt:
      "İş saatlarınızı yazın. Məsələn: B.e–C. 09:00–18:00 və ya 24/7.",
  },
  pricing: {
    key: "pricing",
    step: "pricing",
    title: "Pricing posture",
    prompt:
      "AI qiymətlərlə bağlı nə deyə bilər? Dəqiq qiymət desin, başlanğıc qiymət desin, yoxsa quote tələb olunsun?",
  },
  handoff: {
    key: "handoff",
    step: "handoff",
    title: "Human handoff rules",
    prompt:
      "Hansı hallarda AI mütləq operatora və ya insana yönləndirməlidir?",
  },
};

let cachedClient = null;

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 8_000) ||
    8_000;
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

function normalizeStep(value = "") {
  const key = s(value).toLowerCase();
  if (!key) return "";
  if (key === "contact") return "contacts";
  if (key === "price") return "pricing";
  if (key === "pricing_posture") return "pricing";
  if (key === "business_name") return "company";
  if (key === "business_description") return "description";
  return STEP_META[key] ? key : "";
}

function buildQuestion(step = "") {
  const meta = obj(STEP_META[normalizeStep(step)] || STEP_META.company);

  return compactDraftObject({
    key: s(meta.key).toLowerCase(),
    step: s(meta.step).toLowerCase(),
    title: s(meta.title),
    prompt: s(meta.prompt),
    group: "business_truth",
    groupLabel: "Business truth",
  });
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

  const handoffRules = s(
    obj(safeDraft.handoffRules).summary ||
      arr(obj(safeDraft.handoffRules).triggers).join(", ")
  );

  return {
    businessName: s(businessProfile.companyName),
    whatThisBusinessIs: s(businessProfile.description),
    websiteUrl: normalizeWebsiteUrl(s(businessProfile.websiteUrl)),
    coreServices: uniqueStrings(services, 24),
    contactRoutes: uniqueStrings(contacts, 24),
    hours: uniqueStrings(hours, 24),
    pricingPosture,
    humanHandoff: handoffRules,
    languages: uniqueStrings(arr(safeDraft.languages), 8),
    tone: s(safeDraft.tone),
    greetingStyle: s(safeDraft.greetingStyle),
    afterHoursBehavior: s(safeDraft.afterHoursBehavior),
  };
}

function hasPreviewSignals(preview = {}) {
  const safePreview = obj(preview);

  return Boolean(
    s(safePreview.businessName) ||
      s(safePreview.whatThisBusinessIs) ||
      s(safePreview.websiteUrl) ||
      arr(safePreview.coreServices).length ||
      arr(safePreview.contactRoutes).length ||
      arr(safePreview.hours).length ||
      s(safePreview.pricingPosture) ||
      s(safePreview.humanHandoff) ||
      arr(safePreview.languages).length ||
      s(safePreview.tone) ||
      s(safePreview.greetingStyle) ||
      s(safePreview.afterHoursBehavior)
  );
}

function applyAcceptedPatchToPreview(preview = {}, acceptedPatch = {}) {
  const identity = obj(acceptedPatch.identity);
  const aiBehavior = obj(acceptedPatch.aiBehavior);

  return {
    businessName: s(identity.businessName || preview.businessName),
    whatThisBusinessIs: s(identity.description || preview.whatThisBusinessIs),
    websiteUrl: normalizeWebsiteUrl(s(identity.websiteUrl || preview.websiteUrl)),
    coreServices: uniqueStrings(
      [...arr(preview.coreServices), ...arr(acceptedPatch.services)],
      24
    ),
    contactRoutes: uniqueStrings(
      [...arr(preview.contactRoutes), ...arr(acceptedPatch.contacts)],
      24
    ),
    hours: uniqueStrings(
      [...arr(preview.hours), ...arr(acceptedPatch.hours)],
      24
    ),
    pricingPosture: s(acceptedPatch.pricingPosture || preview.pricingPosture),
    humanHandoff: s(acceptedPatch.humanHandoff || preview.humanHandoff),
    languages: uniqueStrings(
      [...arr(preview.languages), ...arr(aiBehavior.languages)],
      8
    ),
    tone: s(aiBehavior.tone || preview.tone),
    greetingStyle: s(aiBehavior.greetingStyle || preview.greetingStyle),
    afterHoursBehavior: s(
      aiBehavior.afterHoursBehavior || preview.afterHoursBehavior
    ),
  };
}

function stepSatisfied(step = "", preview = {}) {
  const safeStep = normalizeStep(step);
  const safePreview = obj(preview);

  if (safeStep === "company") return Boolean(s(safePreview.businessName));
  if (safeStep === "description") {
    return Boolean(s(safePreview.whatThisBusinessIs));
  }
  if (safeStep === "services") return arr(safePreview.coreServices).length > 0;
  if (safeStep === "contacts") return arr(safePreview.contactRoutes).length > 0;
  if (safeStep === "hours") return arr(safePreview.hours).length > 0;
  if (safeStep === "pricing") return Boolean(s(safePreview.pricingPosture));
  if (safeStep === "handoff") return Boolean(s(safePreview.humanHandoff));

  return false;
}

function resolveCurrentStep(session = {}, draft = {}, latestStep = "") {
  return (
    normalizeStep(latestStep) ||
    normalizeStep(obj(draft.progress).currentQuestionKey) ||
    normalizeStep(obj(draft.assistantState).activeSection) ||
    normalizeStep(obj(session).currentStep) ||
    ""
  );
}

function findNextStep(preview = {}) {
  for (const step of STEP_ORDER) {
    if (!stepSatisfied(step, preview)) return step;
  }
  return "";
}

function looksReadyForApproval(preview = {}) {
  return STEP_ORDER.every((step) => stepSatisfied(step, preview));
}

function sanitizeExtracted(value = {}) {
  const source = obj(value);

  return {
    companyName: s(source.companyName),
    description: s(source.description),
    services: uniqueStrings(source.services, 16),
    contacts: uniqueStrings(source.contacts, 16),
    hours: uniqueStrings(source.hours, 12),
    pricingPolicy: s(source.pricingPolicy),
    handoffRules: s(source.handoffRules),
  };
}

function sanitizeTurnPayload(payload = {}, currentStep = "", preview = {}) {
  const source = obj(payload);
  const extracted = sanitizeExtracted(source.extracted);

  const acceptedPatch = compactDraftObject({
    identity: compactDraftObject({
      businessName: s(extracted.companyName),
      description: s(extracted.description),
      websiteUrl: "",
      audience: "",
    }),
    services: arr(extracted.services),
    contacts: arr(extracted.contacts),
    hours: arr(extracted.hours),
    pricingPosture: s(extracted.pricingPolicy),
    humanHandoff: s(extracted.handoffRules),
    aiBehavior: compactDraftObject({
      languages: [],
      tone: s(preview.tone),
      greetingStyle: s(preview.greetingStyle),
      afterHoursBehavior: s(preview.afterHoursBehavior),
    }),
  });

  const mergedPreview = applyAcceptedPatchToPreview(preview, acceptedPatch);
  const safeCurrentStep = normalizeStep(currentStep);

  const validCurrentStep =
    source.isRelevantToCurrentStep === true &&
    (stepSatisfied(safeCurrentStep, mergedPreview) ||
      (safeCurrentStep === "company" && Boolean(s(extracted.companyName))) ||
      (safeCurrentStep === "description" && Boolean(s(extracted.description))) ||
      (safeCurrentStep === "services" && arr(extracted.services).length > 0) ||
      (safeCurrentStep === "contacts" && arr(extracted.contacts).length > 0) ||
      (safeCurrentStep === "hours" && arr(extracted.hours).length > 0) ||
      (safeCurrentStep === "pricing" &&
        Boolean(s(extracted.pricingPolicy))) ||
      (safeCurrentStep === "handoff" &&
        Boolean(s(extracted.handoffRules))));

  const shouldAdvance =
    source.shouldAdvanceStep === true && validCurrentStep === true;

  const nextStep = shouldAdvance ? findNextStep(mergedPreview) : safeCurrentStep;
  const readyForApproval = looksReadyForApproval(mergedPreview);

  return {
    intent: s(source.intent).toLowerCase(),
    replyLanguage: s(source.replyLanguage),
    isRelevantToCurrentStep: validCurrentStep,
    confidence: Math.max(0, Math.min(1, Number(source.confidence || 0) || 0)),
    normalizedAnswer: s(source.normalizedAnswer),
    acceptedPatch,
    mergedPreview,
    assistantReply: s(source.assistantReply),
    invalidReason: s(source.invalidReason),
    nextStep: nextStep || "",
    readyForApproval,
  };
}

function buildSourceSignals(preview = {}) {
  const safePreview = obj(preview);

  return {
    primarySourceType: "",
    primarySourceLabel: "",
    primarySourceUrl: s(safePreview.websiteUrl),
    primarySourceAuthorityClass: "",
    pageCount: 0,
    sourceTypes: safePreview.websiteUrl ? ["website"] : [],
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
      ],
      12
    ),
    discoveredPublicClaims: [],
    companyNameCandidates: safePreview.businessName
      ? [safePreview.businessName]
      : [],
    descriptionCandidates: safePreview.whatThisBusinessIs
      ? [safePreview.whatThisBusinessIs]
      : [],
    serviceCandidates: uniqueStrings(arr(safePreview.coreServices), 12),
    contactCandidates: uniqueStrings(arr(safePreview.contactRoutes), 12),
    hoursCandidates: uniqueStrings(arr(safePreview.hours), 12),
    pricingCandidates: safePreview.pricingPosture
      ? [safePreview.pricingPosture]
      : [],
    audienceCandidates: [],
    languagesCandidates: uniqueStrings(arr(safePreview.languages), 8),
  };
}

function buildInterviewPlan(currentStep = "", nextStep = "") {
  const active = normalizeStep(nextStep || currentStep);
  if (!active) {
    return {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    };
  }

  const question = buildQuestion(active);

  return {
    activeQuestionKeys: question?.key ? [question.key] : [],
    activeQuestions: question?.key
      ? [
          {
            key: question.key,
            step: question.step,
            title: question.title,
            group: question.group,
            groupLabel: question.groupLabel,
            priority: 1,
          },
        ]
      : [],
    remainingQuestionKeys: question?.key ? [question.key] : [],
    nextGroup: "business_truth",
    nextGroupLabel: "Business truth",
  };
}

function buildSystemPrompt() {
  return [
    "You are the semantic setup brain for a business onboarding assistant.",
    "Your job is to understand the user's latest message inside the current setup step.",
    "You are not the owner of the whole system state.",
    "Do not generate a huge business draft.",
    "Only decide the user's intent, relevance to the current step, extract small grounded fields, and write one short assistant reply.",
    "If the message is unrelated to the current step, mark isRelevantToCurrentStep=false and explain briefly.",
    "If the message partially answers the step, extract what is grounded and keep the reply concise.",
    "Always reply in the user's latest language.",
    "Do not use canned robotic setup language.",
    "Do not over-extract.",
    "Never invent pricing, hours, services, contacts, or handoff rules.",
    "Only return strict JSON.",
  ].join(" ");
}

function buildUserPrompt({
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
}) {
  return [
    "Current setup step:",
    JSON.stringify(
      {
        currentStep,
        currentQuestion: obj(question),
        currentDraftPreview: preview,
        latestUserMessage: s(latestMessage),
      },
      null,
      2
    ),
    "",
    "Rules:",
    "- Decide whether the message is relevant to the current step.",
    "- Extract only grounded fields.",
    "- If the user gives extra useful information for another field, you may extract it too.",
    "- assistantReply must be short, natural, and helpful.",
    "- If the answer is invalid or unrelated, keep the same step.",
    "- If the answer is good enough, ask the next setup question naturally.",
  ].join("\n");
}

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "replyLanguage",
    "isRelevantToCurrentStep",
    "confidence",
    "normalizedAnswer",
    "extracted",
    "assistantReply",
    "shouldAdvanceStep",
    "invalidReason",
  ],
  properties: {
    intent: {
      type: "string",
      enum: [
        "greeting",
        "go_to_channels",
        "start_setup",
        "setup_answer",
        "correction",
        "unrelated",
      ],
    },
    replyLanguage: { type: "string" },
    isRelevantToCurrentStep: { type: "boolean" },
    confidence: { type: "number" },
    normalizedAnswer: { type: "string" },
    extracted: {
      type: "object",
      additionalProperties: false,
      required: [
        "companyName",
        "description",
        "services",
        "contacts",
        "hours",
        "pricingPolicy",
        "handoffRules",
      ],
      properties: {
        companyName: { type: "string" },
        description: { type: "string" },
        services: { type: "array", items: { type: "string" } },
        contacts: { type: "array", items: { type: "string" } },
        hours: { type: "array", items: { type: "string" } },
        pricingPolicy: { type: "string" },
        handoffRules: { type: "string" },
      },
    },
    assistantReply: { type: "string" },
    shouldAdvanceStep: { type: "boolean" },
    invalidReason: { type: "string" },
  },
};

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

async function callOpenAISetupAssistant({
  currentStep = "",
  question = null,
  preview = {},
  latestMessage = "",
  model,
  timeoutMs,
  maxOutputTokens,
} = {}) {
  const runtime = getSetupAssistantRuntimeConfig();
  const resolvedModel = s(model, runtime.model);
  const resolvedTimeoutMs =
    Number(timeoutMs || runtime.timeoutMs || 8_000) || 8_000;
  const resolvedMaxOutputTokens =
    Number(maxOutputTokens || runtime.maxOutputTokens || 500) || 500;

  const client = getOpenAIClient();
  if (!client) {
    throw new Error("openai_setup_assistant_not_configured");
  }

  const responsePromise = client.responses.create({
    model: resolvedModel,
    input: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: buildUserPrompt({
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
        name: "setup_semantic_turn",
        strict: true,
        schema: TURN_SCHEMA,
      },
    },
    max_output_tokens: resolvedMaxOutputTokens,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("openai_setup_assistant_timeout"));
    }, resolvedTimeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  const payload =
    obj(response?.output_parsed) &&
    Object.keys(obj(response.output_parsed)).length
      ? response.output_parsed
      : safeJsonParse(extractJsonText(response), {});

  if (!Object.keys(obj(payload)).length) {
    throw new Error("openai_setup_assistant_empty_output");
  }

  return {
    model: resolvedModel,
    payload,
  };
}

function buildFallbackTurn({
  currentStep = "",
  preview = {},
  latestMessage = "",
  error = "",
  model = "",
} = {}) {
  const hasSignals = hasPreviewSignals(preview);
  const hasMessage = Boolean(s(latestMessage));
  const readyForApproval = looksReadyForApproval(preview);
  const nextStep =
    findNextStep(preview) || normalizeStep(currentStep) || "company";
  const sourceCaptureMode = !hasSignals && !hasMessage;
  const nextQuestion =
    sourceCaptureMode || readyForApproval ? null : buildQuestion(nextStep);

  const fallbackAssistantMessage = sourceCaptureMode
    ? ""
    : s(obj(nextQuestion).prompt);

  return {
    ok: true,
    provider: "local_fallback",
    model: s(model),
    usedFallback: true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: normalizeStep(currentStep),
      text: latestMessage,
    }),
    phase: sourceCaptureMode
      ? "source_capture"
      : readyForApproval
        ? "ready"
        : "interview",
    assistantMessage: fallbackAssistantMessage,
    message: fallbackAssistantMessage,
    nextQuestion,
    draft: preview,
    acceptedPatch: {
      identity: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: "",
      humanHandoff: "",
      aiBehavior: {},
    },
    rejectedInputs: [],
    confidence: {
      strong: [],
      unclear: [],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: buildSourceSignals(preview),
    interviewPlan: sourceCaptureMode
      ? buildInterviewPlan("", "")
      : buildInterviewPlan(currentStep, nextStep),
    aiBehavior: compactDraftObject({
      languages: arr(preview.languages),
      tone: s(preview.tone),
      greetingStyle: s(preview.greetingStyle),
      afterHoursBehavior: s(preview.afterHoursBehavior),
    }),
    readyForApproval,
  };
}

function normalizeTurnResult({
  raw = {},
  currentStep = "",
  preview = {},
  latestMessage = "",
  provider = "openai",
  model = "",
  usedFallback = false,
  error = "",
} = {}) {
  const interpreted = sanitizeTurnPayload(raw, currentStep, preview);
  const nextQuestion =
    interpreted.readyForApproval === true
      ? null
      : buildQuestion(interpreted.nextStep || currentStep || "company");

  return {
    ok: true,
    provider,
    model: s(model),
    usedFallback: usedFallback === true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: normalizeStep(currentStep),
      text: latestMessage,
    }),
    phase: interpreted.readyForApproval === true ? "ready" : "interview",
    assistantMessage: s(interpreted.assistantReply),
    message: s(interpreted.assistantReply),
    nextQuestion,
    draft: interpreted.mergedPreview,
    acceptedPatch: interpreted.acceptedPatch,
    rejectedInputs:
      interpreted.isRelevantToCurrentStep === true
        ? []
        : [
            {
              input: s(latestMessage),
              reason:
                s(interpreted.invalidReason) ||
                "The answer did not match the current setup step.",
              suggestedField: normalizeStep(currentStep),
            },
          ],
    confidence: {
      strong: interpreted.isRelevantToCurrentStep === true ? [currentStep] : [],
      unclear: interpreted.isRelevantToCurrentStep === true ? [] : [currentStep],
      contradictions: [],
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: buildSourceSignals(interpreted.mergedPreview),
    interviewPlan: buildInterviewPlan(currentStep, interpreted.nextStep),
    aiBehavior: compactDraftObject({
      languages: arr(preview.languages),
      tone: s(preview.tone),
      greetingStyle: s(preview.greetingStyle),
      afterHoursBehavior: s(preview.afterHoursBehavior),
    }),
    readyForApproval: interpreted.readyForApproval === true,
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
  void sources;

  const runtime = getSetupAssistantRuntimeConfig();
  const preview = buildCurrentPreview(draft, review);
  const currentStep = resolveCurrentStep(session, draft, latestStep);
  const currentQuestion = currentStep ? buildQuestion(currentStep) : null;

  const shouldForceFallback =
    forceFallback === true || runtime.forceFallback === true;

  if (shouldForceFallback || !hasOpenAISetupAssistant()) {
    return buildFallbackTurn({
      currentStep,
      preview,
      latestMessage,
      error: shouldForceFallback
        ? "openai_setup_assistant_forced_fallback"
        : "openai_setup_assistant_unavailable",
      model: runtime.model,
    });
  }

  try {
    const openaiResult = await callOpenAISetupAssistant({
      currentStep: currentStep || "company",
      question: currentQuestion || buildQuestion("company"),
      preview,
      latestMessage,
      model: runtime.model,
      timeoutMs: runtime.timeoutMs,
      maxOutputTokens: runtime.maxOutputTokens,
    });

    return normalizeTurnResult({
      raw: openaiResult.payload,
      currentStep: currentStep || "company",
      preview,
      latestMessage,
      provider: "openai",
      model: openaiResult.model,
      usedFallback: false,
    });
  } catch (error) {
    return buildFallbackTurn({
      currentStep,
      preview,
      latestMessage,
      error: s(error?.message, "openai_setup_assistant_failed"),
      model: runtime.model,
    });
  }
}

export const __test__ = {
  buildCurrentPreview,
  hasPreviewSignals,
  applyAcceptedPatchToPreview,
  stepSatisfied,
  resolveCurrentStep,
  findNextStep,
  looksReadyForApproval,
  sanitizeTurnPayload,
  normalizeTurnResult,
  buildFallbackTurn,
  getSetupAssistantRuntimeConfig,
  hasOpenAISetupAssistant,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};