import OpenAI from "openai";

import { cfg } from "../../../config.js";
import { arr, compactDraftObject, obj, s } from "./draftShared.js";
import {
  buildSetupAssistantBrainState,
  buildSetupAssistantFirstPrompt,
} from "./assistantBrain.js";

let cachedClient = null;

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 25_000) ||
    25_000;
  const maxOutputTokens =
    Number(
      cfg.ai?.openaiSetupMaxOutputTokens || cfg.ai?.openaiMaxOutputTokens || 2200
    ) || 2200;

  return {
    enabled: cfg.ai?.openaiSetupAssistantEnabled === true,
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

function sanitizeQuestion(value = {}, fallback = {}) {
  const source = obj(value);
  const next = compactDraftObject({
    key: s(source.key || fallback.key),
    step: s(source.step || source.key || fallback.step || fallback.key),
    title: s(source.title || fallback.title),
    prompt: s(source.prompt || fallback.prompt),
    group: s(source.group || fallback.group || "business_truth"),
    groupLabel: s(
      source.groupLabel || fallback.groupLabel || "Business truth"
    ),
  });

  if (!next.key || !next.prompt) {
    return compactDraftObject(fallback);
  }

  return next;
}

function sanitizeConfidence(value = {}, fallback = {}) {
  const source = obj(value);
  const safeFallback = obj(fallback);

  return {
    strong: uniqueStrings(source.strong || safeFallback.strong, 12),
    unclear: uniqueStrings(source.unclear || safeFallback.unclear, 12),
    contradictions: uniqueStrings(
      source.contradictions || safeFallback.contradictions,
      12
    ),
  };
}

function sanitizeRecommendation(value = {}, fallback = {}) {
  const source = obj(value);
  const safeFallback = obj(fallback);

  return {
    notes: uniqueStrings(source.notes || safeFallback.notes, 12),
  };
}

function sanitizeDraft(value = {}, fallback = {}) {
  const source = obj(value);
  const safeFallback = obj(fallback);

  return compactDraftObject({
    businessName: s(source.businessName || safeFallback.businessName),
    whatThisBusinessIs: s(
      source.whatThisBusinessIs || safeFallback.whatThisBusinessIs
    ),
    websiteUrl: s(source.websiteUrl || safeFallback.websiteUrl),
    coreServices: uniqueStrings(
      source.coreServices || safeFallback.coreServices,
      16
    ),
    audience: s(source.audience || safeFallback.audience),
    pricingPosture: s(source.pricingPosture || safeFallback.pricingPosture),
    contactRoutes: uniqueStrings(
      source.contactRoutes || safeFallback.contactRoutes,
      12
    ),
    humanHandoff: s(source.humanHandoff || safeFallback.humanHandoff),
    languages: uniqueStrings(source.languages || safeFallback.languages, 8),
    tone: s(source.tone || safeFallback.tone),
    hours: uniqueStrings(source.hours || safeFallback.hours, 12),
    greetingStyle: s(source.greetingStyle || safeFallback.greetingStyle),
    afterHoursBehavior: s(
      source.afterHoursBehavior || safeFallback.afterHoursBehavior
    ),
  });
}

function sanitizeAcceptedPatch(value = {}, fallbackDraft = {}) {
  const source = obj(value);

  return compactDraftObject({
    identity: compactDraftObject({
      businessName: s(source.identity?.businessName || fallbackDraft.businessName),
      description: s(
        source.identity?.description || fallbackDraft.whatThisBusinessIs
      ),
      websiteUrl: s(source.identity?.websiteUrl || fallbackDraft.websiteUrl),
      audience: s(source.identity?.audience || fallbackDraft.audience),
    }),
    services: uniqueStrings(source.services || fallbackDraft.coreServices, 16),
    contacts: uniqueStrings(source.contacts || fallbackDraft.contactRoutes, 12),
    hours: uniqueStrings(source.hours || fallbackDraft.hours, 12),
    pricingPosture: s(source.pricingPosture || fallbackDraft.pricingPosture),
    humanHandoff: s(source.humanHandoff || fallbackDraft.humanHandoff),
    aiBehavior: compactDraftObject({
      languages: uniqueStrings(
        source.aiBehavior?.languages || fallbackDraft.languages,
        8
      ),
      tone: s(source.aiBehavior?.tone || fallbackDraft.tone),
      greetingStyle: s(
        source.aiBehavior?.greetingStyle || fallbackDraft.greetingStyle
      ),
      afterHoursBehavior: s(
        source.aiBehavior?.afterHoursBehavior ||
          fallbackDraft.afterHoursBehavior
      ),
    }),
  });
}

function sanitizeRejectedInputs(value = []) {
  return arr(value)
    .map((item) =>
      compactDraftObject({
        input: s(item?.input),
        reason: s(item?.reason),
        suggestedField: s(item?.suggestedField),
      })
    )
    .filter((item) => item.input || item.reason)
    .slice(0, 12);
}

function sanitizeSourceSignals(value = {}, fallback = {}) {
  const source = obj(value);
  const safeFallback = obj(fallback);

  return {
    primarySourceType: s(
      source.primarySourceType || safeFallback.primarySourceType
    ),
    primarySourceLabel: s(
      source.primarySourceLabel || safeFallback.primarySourceLabel
    ),
    primarySourceUrl: s(
      source.primarySourceUrl || safeFallback.primarySourceUrl
    ),
    primarySourceAuthorityClass: s(
      source.primarySourceAuthorityClass ||
        safeFallback.primarySourceAuthorityClass
    ),
    pageCount:
      Number(source.pageCount || safeFallback.pageCount || 0) || 0,
    sourceTypes: uniqueStrings(source.sourceTypes || safeFallback.sourceTypes, 8),
    strongestEvidence: uniqueStrings(
      source.strongestEvidence || safeFallback.strongestEvidence,
      12
    ),
    discoveredPublicClaims: uniqueStrings(
      source.discoveredPublicClaims || safeFallback.discoveredPublicClaims,
      12
    ),
    companyNameCandidates: uniqueStrings(
      source.companyNameCandidates || safeFallback.companyNameCandidates,
      8
    ),
    descriptionCandidates: uniqueStrings(
      source.descriptionCandidates || safeFallback.descriptionCandidates,
      8
    ),
    serviceCandidates: uniqueStrings(
      source.serviceCandidates || safeFallback.serviceCandidates,
      12
    ),
    contactCandidates: uniqueStrings(
      source.contactCandidates || safeFallback.contactCandidates,
      12
    ),
    hoursCandidates: uniqueStrings(
      source.hoursCandidates || safeFallback.hoursCandidates,
      12
    ),
    pricingCandidates: uniqueStrings(
      source.pricingCandidates || safeFallback.pricingCandidates,
      12
    ),
    audienceCandidates: uniqueStrings(
      source.audienceCandidates || safeFallback.audienceCandidates,
      8
    ),
    languagesCandidates: uniqueStrings(
      source.languagesCandidates || safeFallback.languagesCandidates,
      8
    ),
  };
}

function sanitizeInterviewPlan(value = {}, fallback = {}) {
  const source = obj(value);
  const safeFallback = obj(fallback);

  const activeQuestions = arr(source.activeQuestions || safeFallback.activeQuestions)
    .map((item) =>
      compactDraftObject({
        key: s(item?.key),
        step: s(item?.step || item?.key),
        title: s(item?.title),
        group: s(item?.group || "business_truth"),
        groupLabel: s(item?.groupLabel || "Business truth"),
        priority: Number(item?.priority || 0) || 0,
      })
    )
    .filter((item) => item.key);

  return compactDraftObject({
    activeQuestionKeys: uniqueStrings(
      source.activeQuestionKeys || activeQuestions.map((item) => item.key),
      12
    ),
    activeQuestions,
    remainingQuestionKeys: uniqueStrings(
      source.remainingQuestionKeys ||
        activeQuestions.map((item) => item.key),
      12
    ),
    nextGroup: s(source.nextGroup || safeFallback.nextGroup),
    nextGroupLabel: s(source.nextGroupLabel || safeFallback.nextGroupLabel),
  });
}

function detectLikelyReplyLanguage(latestMessage = "", recentConversation = []) {
  const combined = [
    s(latestMessage),
    ...arr(recentConversation).map((item) => s(item?.text)),
  ]
    .filter(Boolean)
    .join(" ");

  const lower = combined.toLowerCase();

  if (!lower) return "match_user_language";

  if (/[а-яёіїєґ]/i.test(combined)) return "ru";
  if (/[\u0600-\u06FF]/.test(combined)) return "ar";
  if (/[əğıöüşç]/i.test(combined)) return "az";
  if (/\b(çünkü|şirket|müşteri|fiyat|hangi|merhaba)\b/i.test(lower)) return "tr";
  if (/\b(hello|business|pricing|hours|contact|service)\b/i.test(lower)) return "en";

  return "match_user_language";
}

function normalizeTurnResult(
  payload = {},
  {
    fallbackBrain = {},
    latestMessage = "",
    latestStep = "",
    provider = "fallback",
    model = "",
    usedFallback = false,
    error = "",
  } = {}
) {
  const fallback = obj(fallbackBrain);

  const normalizedDraft = sanitizeDraft(payload.draft, obj(fallback.draft));
  const normalizedQuestion = sanitizeQuestion(
    payload.nextQuestion,
    obj(fallback.nextQuestion)
  );
  const normalizedConfidence = sanitizeConfidence(
    payload.confidence,
    obj(fallback.confidence)
  );
  const normalizedRecommendation = sanitizeRecommendation(
    payload.recommendation,
    obj(fallback.recommendation)
  );
  const normalizedSourceSignals = sanitizeSourceSignals(
    payload.sourceSignals,
    obj(fallback.sourceSignals)
  );
  const normalizedAcceptedPatch = sanitizeAcceptedPatch(
    payload.acceptedPatch,
    normalizedDraft
  );
  const normalizedInterviewPlan = sanitizeInterviewPlan(
    payload.interviewPlan,
    obj(fallback.interviewPlan)
  );

  const readyForApproval =
    payload.readyForApproval === true ||
    (usedFallback ? fallback.readyForApproval === true : false);

  const phase = s(
    payload.phase,
    readyForApproval ? "ready" : s(fallback.phase, "interview")
  );

  const assistantMessage = s(
    payload.assistantMessage,
    s(fallback.assistantMessage, "")
  );

  const allowNullQuestion =
    readyForApproval === true &&
    !s(obj(payload.nextQuestion).key) &&
    !s(obj(payload.nextQuestion).prompt);

  return {
    ok: true,
    provider,
    model: s(model),
    usedFallback: usedFallback === true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: s(latestStep),
      text: s(latestMessage),
    }),
    phase,
    assistantMessage,
    nextQuestion: allowNullQuestion
      ? null
      : normalizedQuestion.key && normalizedQuestion.prompt
        ? normalizedQuestion
        : null,
    draft: normalizedDraft,
    acceptedPatch: normalizedAcceptedPatch,
    rejectedInputs: sanitizeRejectedInputs(payload.rejectedInputs),
    confidence: normalizedConfidence,
    recommendation: normalizedRecommendation,
    sourceSignals: normalizedSourceSignals,
    interviewPlan: normalizedInterviewPlan,
    aiBehavior: compactDraftObject(
      payload.aiBehavior ||
        fallback.aiBehavior ||
        normalizedAcceptedPatch.aiBehavior
    ),
    readyForApproval,
  };
}

function normalizeEventText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

function extractRecentConversation(review = {}, latestStep = "", latestMessage = "") {
  const root = obj(review);
  const candidates = [
    ...arr(root.events),
    ...arr(root.review?.events),
    ...arr(root.timeline),
    ...arr(root.review?.timeline),
  ];

  const normalized = candidates
    .map((item) => {
      const row = obj(item);
      const role = s(
        row.role || row.actorRole || row.type || row.eventType
      ).toLowerCase();

      const text = normalizeEventText(
        row.text ||
          row.message ||
          row.summary ||
          row.note ||
          row.body ||
          row.value
      );

      return compactDraftObject({
        role,
        text,
        createdAt: row.createdAt || row.created_at || null,
      });
    })
    .filter((item) => item.text)
    .slice(-12);

  if (s(latestMessage)) {
    normalized.push({
      role: "user",
      text: normalizeEventText(latestMessage),
      step: s(latestStep),
      createdAt: null,
    });
  }

  return normalized.slice(-14);
}

function buildReadinessRubric() {
  return {
    identity: [
      "Exact public business name",
      "One clean description of what the business does",
      "Website or another reliable public identity source",
    ],
    services: [
      "Real customer-facing services only",
      "Avoid generic labels, vague capabilities, channels, or adjectives",
    ],
    contacts: [
      "At least one primary public customer contact lane",
    ],
    hours: [
      "Public hours, or an explicit appointment-only / 24-7 posture",
    ],
    pricing: [
      "Safe public pricing posture",
      "Whether exact quotes require operator involvement",
    ],
    handoff: [
      "Clear human escalation cases",
    ],
    aiBehavior: [
      "Tone or language only if confidently known",
    ],
  };
}

function buildSetupContext({
  session = {},
  draft = {},
  sources = [],
  review = null,
  latestStep = "",
  latestMessage = "",
  fallbackBrain = {},
}) {
  const safeFallbackBrain = obj(fallbackBrain);
  const safeDraft = obj(draft);
  const safeReview = obj(review);
  const reviewDraft = obj(safeReview.review?.draft || safeReview.draft);
  const recentConversation = extractRecentConversation(
    safeReview,
    latestStep,
    latestMessage
  );

  return {
    mission:
      "Understand the business like a strong operator-grade setup brain, extract as many grounded facts as possible from each message, avoid redundant questioning, and only ask one best next question when truly needed.",
    readinessRubric: buildReadinessRubric(),

    replyRequirements: {
      replyLanguage: detectLikelyReplyLanguage(latestMessage, recentConversation),
      maxQuestionsPerTurn: 1,
      avoidRepeatingCoveredFacts: true,
      avoidWizardTone: true,
      askOnlyIfActuallyNeeded: true,
    },

    session: compactDraftObject({
      id: s(session.id),
      mode: s(session.mode),
      currentStep: s(session.currentStep),
      status: s(session.status),
      draftVersion: Number(session.draftVersion || 0) || 0,
    }),

    latestUserInput: compactDraftObject({
      step: s(latestStep),
      text: s(latestMessage),
    }),

    recentConversation,

    existingDraft: compactDraftObject({
      businessProfile: obj(reviewDraft.businessProfile || safeDraft.businessProfile),
      services: arr(reviewDraft.services || safeDraft.services),
      contacts: arr(reviewDraft.contacts || safeDraft.contacts),
      hours: arr(safeDraft.hours),
      pricingPosture: obj(safeDraft.pricingPosture),
      handoffRules: obj(safeDraft.handoffRules),
      sourceMetadata: obj(
        reviewDraft.sourceMetadata || safeDraft.sourceMetadata
      ),
      assistantState: obj(safeDraft.assistantState),
      progress: obj(safeDraft.progress),
    }),

    sourceSignals: sanitizeSourceSignals(safeFallbackBrain.sourceSignals, {}),
    draftPreview: sanitizeDraft(safeFallbackBrain.draft, {}),

    currentBrainAssessment: {
      phase: s(safeFallbackBrain.phase),
      readyForApproval: safeFallbackBrain.readyForApproval === true,
      nextQuestion: sanitizeQuestion(safeFallbackBrain.nextQuestion, {}),
      confidence: sanitizeConfidence(safeFallbackBrain.confidence, {}),
      recommendation: sanitizeRecommendation(
        safeFallbackBrain.recommendation,
        {}
      ),
    },

    sources: arr(sources)
      .map((item) =>
        compactDraftObject({
          sourceId: s(item.sourceId || item.id),
          sourceType: s(item.sourceType || item.type),
          role: s(item.role),
          label: s(item.label),
          url: s(item.sourceUrl || item.url || item.metadata?.sourceUrl),
          sourceAuthorityClass: s(
            item.sourceAuthorityClass || item.metadata?.sourceAuthorityClass
          ),
        })
      )
      .slice(0, 16),
  };
}

function buildSystemPrompt() {
  return [
    "You are the setup brain for a serious business onboarding system.",
    "You are not a form wizard and not a questionnaire bot.",
    "Your job is to understand the business from public sources, existing draft state, and the operator's latest natural-language reply.",
    "Think like a business analyst, onboarding strategist, and conversation designer.",
    "Extract as many grounded facts as you safely can from one user message.",
    "Do not ask for one field at a time if a single user message already gives multiple facts.",
    "Do not repeat facts already grounded by sources or the current draft.",
    "Ask at most one best next question, and only when it is genuinely needed for chatbot readiness.",
    "If the draft is already strong enough, stop interviewing and mark readyForApproval=true.",
    "If the user writes in Azerbaijani, answer in Azerbaijani. If they write in English, answer in English. In general, match the user's latest language.",
    "Avoid robotic lines like 'I will not re-ask', 'current signal', 'recommended', or wizard-sounding filler.",
    "Avoid templatey onboarding copy.",
    "assistantMessage must feel human, sharp, and contextual.",
    "Services must be real customer-facing offers, not vague categories, channels, or buzzwords.",
    "If the user gives natural-language hours, normalize them into a professional schedule proposal.",
    "If the user gives natural-language pricing, convert it into a safe public pricing posture.",
    "If the user gives natural-language escalation rules, convert them into a real human handoff policy.",
    "Never accept acknowledgement-only messages like ok, continue, next, tamam, oldu, bəli as business facts.",
    "When the latest reply is weak, challenge it briefly and precisely.",
    "When source evidence and user claims conflict, record that in confidence.contradictions or rejectedInputs.",
    "Only output strict JSON that matches the schema.",
  ].join(" ");
}

function buildUserPrompt(context = {}) {
  return [
    "Analyze this setup turn.",
    "",
    "Core behavior rules:",
    "- Treat the user's message as a dense source of facts, not as a single-field answer.",
    "- Pull multiple facts out of one message whenever justified.",
    "- Prefer understanding and normalization over interrogation.",
    "- Only ask a next question when chatbot readiness still has a real blocker.",
    "- When you ask a question, ask only one.",
    "- Match the user's language.",
    "- Keep assistantMessage natural, concise, and contextual.",
    "",
    "Good examples:",
    "- If the user writes one long paragraph containing business name, services, hours, and WhatsApp, accept all of them at once.",
    "- If the user writes something vague like 'automation', do not blindly accept it as a service. Ask what concrete customer-facing service that means.",
    "- If the user says pricing depends on the project, convert that into a safe quote-required posture.",
    "- If enough is known, stop asking and produce a strong ready draft.",
    "",
    "Bad behavior to avoid:",
    "- Repeating setup boilerplate.",
    "- Asking for the same thing again after it is already covered.",
    "- Breaking one rich answer into unnecessary wizard steps.",
    "- Sounding like a template bot.",
    "",
    "Context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

const SETUP_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "phase",
    "assistantMessage",
    "nextQuestion",
    "draft",
    "acceptedPatch",
    "rejectedInputs",
    "confidence",
    "recommendation",
    "sourceSignals",
    "readyForApproval",
  ],
  properties: {
    phase: {
      type: "string",
      enum: ["source_capture", "interview", "ready"],
    },
    assistantMessage: { type: "string" },
    nextQuestion: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["key", "step", "title", "prompt", "group", "groupLabel"],
          properties: {
            key: { type: "string" },
            step: { type: "string" },
            title: { type: "string" },
            prompt: { type: "string" },
            group: { type: "string" },
            groupLabel: { type: "string" },
          },
        },
      ],
    },
    draft: {
      type: "object",
      additionalProperties: false,
      required: [
        "businessName",
        "whatThisBusinessIs",
        "websiteUrl",
        "coreServices",
        "audience",
        "pricingPosture",
        "contactRoutes",
        "humanHandoff",
        "languages",
        "tone",
        "hours",
        "greetingStyle",
        "afterHoursBehavior",
      ],
      properties: {
        businessName: { type: "string" },
        whatThisBusinessIs: { type: "string" },
        websiteUrl: { type: "string" },
        coreServices: { type: "array", items: { type: "string" } },
        audience: { type: "string" },
        pricingPosture: { type: "string" },
        contactRoutes: { type: "array", items: { type: "string" } },
        humanHandoff: { type: "string" },
        languages: { type: "array", items: { type: "string" } },
        tone: { type: "string" },
        hours: { type: "array", items: { type: "string" } },
        greetingStyle: { type: "string" },
        afterHoursBehavior: { type: "string" },
      },
    },
    acceptedPatch: {
      type: "object",
      additionalProperties: false,
      required: [
        "identity",
        "services",
        "contacts",
        "hours",
        "pricingPosture",
        "humanHandoff",
        "aiBehavior",
      ],
      properties: {
        identity: {
          type: "object",
          additionalProperties: false,
          required: ["businessName", "description", "websiteUrl", "audience"],
          properties: {
            businessName: { type: "string" },
            description: { type: "string" },
            websiteUrl: { type: "string" },
            audience: { type: "string" },
          },
        },
        services: { type: "array", items: { type: "string" } },
        contacts: { type: "array", items: { type: "string" } },
        hours: { type: "array", items: { type: "string" } },
        pricingPosture: { type: "string" },
        humanHandoff: { type: "string" },
        aiBehavior: {
          type: "object",
          additionalProperties: false,
          required: ["languages", "tone", "greetingStyle", "afterHoursBehavior"],
          properties: {
            languages: { type: "array", items: { type: "string" } },
            tone: { type: "string" },
            greetingStyle: { type: "string" },
            afterHoursBehavior: { type: "string" },
          },
        },
      },
    },
    rejectedInputs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["input", "reason", "suggestedField"],
        properties: {
          input: { type: "string" },
          reason: { type: "string" },
          suggestedField: { type: "string" },
        },
      },
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["strong", "unclear", "contradictions"],
      properties: {
        strong: { type: "array", items: { type: "string" } },
        unclear: { type: "array", items: { type: "string" } },
        contradictions: { type: "array", items: { type: "string" } },
      },
    },
    recommendation: {
      type: "object",
      additionalProperties: false,
      required: ["notes"],
      properties: {
        notes: { type: "array", items: { type: "string" } },
      },
    },
    sourceSignals: {
      type: "object",
      additionalProperties: false,
      required: [
        "primarySourceType",
        "primarySourceLabel",
        "primarySourceUrl",
        "primarySourceAuthorityClass",
        "pageCount",
        "sourceTypes",
        "strongestEvidence",
        "discoveredPublicClaims",
        "companyNameCandidates",
        "descriptionCandidates",
        "serviceCandidates",
        "contactCandidates",
        "hoursCandidates",
        "pricingCandidates",
        "audienceCandidates",
        "languagesCandidates",
      ],
      properties: {
        primarySourceType: { type: "string" },
        primarySourceLabel: { type: "string" },
        primarySourceUrl: { type: "string" },
        primarySourceAuthorityClass: { type: "string" },
        pageCount: { type: "number" },
        sourceTypes: { type: "array", items: { type: "string" } },
        strongestEvidence: { type: "array", items: { type: "string" } },
        discoveredPublicClaims: { type: "array", items: { type: "string" } },
        companyNameCandidates: { type: "array", items: { type: "string" } },
        descriptionCandidates: { type: "array", items: { type: "string" } },
        serviceCandidates: { type: "array", items: { type: "string" } },
        contactCandidates: { type: "array", items: { type: "string" } },
        hoursCandidates: { type: "array", items: { type: "string" } },
        pricingCandidates: { type: "array", items: { type: "string" } },
        audienceCandidates: { type: "array", items: { type: "string" } },
        languagesCandidates: { type: "array", items: { type: "string" } },
      },
    },
    readyForApproval: { type: "boolean" },
  },
};

async function callOpenAISetupAssistant({
  context = {},
  model,
  timeoutMs,
  maxOutputTokens,
} = {}) {
  const runtime = getSetupAssistantRuntimeConfig();
  const resolvedModel = s(model, runtime.model);
  const resolvedTimeoutMs =
    Number(timeoutMs || runtime.timeoutMs || 25_000) || 25_000;
  const resolvedMaxOutputTokens =
    Number(maxOutputTokens || runtime.maxOutputTokens || 2200) || 2200;

  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI setup assistant is not configured.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolvedTimeoutMs);

  try {
    const response = await client.responses.create({
      model: resolvedModel,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "setup_assistant_turn",
          strict: true,
          schema: SETUP_TURN_SCHEMA,
        },
      },
      max_output_tokens: resolvedMaxOutputTokens,
      signal: controller.signal,
    });

    const outputText = s(response.output_text);
    if (!outputText) {
      throw new Error("OpenAI setup assistant returned an empty response.");
    }

    return {
      model: resolvedModel,
      payload: safeJsonParse(outputText, {}),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHonestFallbackTurn(fallbackBrain = {}, latestMessage = "", latestStep = "") {
  const fallback = obj(fallbackBrain);
  const nextQuestion = obj(fallback.nextQuestion);

  let assistantMessage = s(fallback.assistantMessage);

  if (s(latestMessage)) {
    assistantMessage =
      assistantMessage ||
      (nextQuestion.prompt
        ? nextQuestion.prompt
        : "Continue with the next most important setup detail.");
  }

  return {
    phase: s(fallback.phase, "interview"),
    assistantMessage,
    nextQuestion:
      nextQuestion.key && nextQuestion.prompt
        ? nextQuestion
        : null,
    draft: obj(fallback.draft),
    acceptedPatch: {
      identity: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: "",
      humanHandoff: "",
      aiBehavior: {
        languages: [],
        tone: "",
        greetingStyle: "",
        afterHoursBehavior: "",
      },
    },
    rejectedInputs: [],
    confidence: obj(fallback.confidence),
    recommendation: obj(fallback.recommendation),
    sourceSignals: obj(fallback.sourceSignals),
    readyForApproval: fallback.readyForApproval === true,
    latestUserInput: {
      step: s(latestStep),
      text: s(latestMessage),
    },
    interviewPlan: obj(fallback.interviewPlan),
    aiBehavior: obj(fallback.aiBehavior),
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
  if (!s(latestMessage) && !arr(sources).length) {
    const firstPrompt = buildSetupAssistantFirstPrompt();
    return normalizeTurnResult(firstPrompt, {
      fallbackBrain: firstPrompt,
      latestMessage,
      latestStep,
      provider: "local_seed",
      model: "",
      usedFallback: true,
    });
  }

  const fallbackBrain = buildSetupAssistantBrainState({
    session,
    draft,
    sources,
    review,
  });

  const runtime = getSetupAssistantRuntimeConfig();
  const shouldForceFallback =
    forceFallback === true || runtime.forceFallback === true;

  if (shouldForceFallback || !hasOpenAISetupAssistant()) {
    return normalizeTurnResult(buildHonestFallbackTurn(fallbackBrain, latestMessage, latestStep), {
      fallbackBrain,
      latestMessage,
      latestStep,
      provider: "local_fallback",
      model: shouldForceFallback ? runtime.model : "",
      usedFallback: true,
    });
  }

  const context = buildSetupContext({
    session,
    draft,
    sources,
    review,
    latestStep,
    latestMessage,
    fallbackBrain,
  });

  try {
    const openaiResult = await callOpenAISetupAssistant({
      context,
      model: runtime.model,
      timeoutMs: runtime.timeoutMs,
      maxOutputTokens: runtime.maxOutputTokens,
    });

    return normalizeTurnResult(openaiResult.payload, {
      fallbackBrain,
      latestMessage,
      latestStep,
      provider: "openai",
      model: openaiResult.model,
      usedFallback: false,
    });
  } catch (error) {
    return normalizeTurnResult(buildHonestFallbackTurn(fallbackBrain, latestMessage, latestStep), {
      fallbackBrain,
      latestMessage,
      latestStep,
      provider: "local_fallback",
      model: runtime.model,
      usedFallback: true,
      error: s(error?.message, "openai_setup_assistant_failed"),
    });
  }
}

export const __test__ = {
  buildSetupContext,
  buildSystemPrompt,
  buildUserPrompt,
  buildReadinessRubric,
  extractRecentConversation,
  normalizeTurnResult,
  sanitizeAcceptedPatch,
  sanitizeDraft,
  sanitizeInterviewPlan,
  sanitizeQuestion,
  sanitizeSourceSignals,
  hasOpenAISetupAssistant,
  getSetupAssistantRuntimeConfig,
  callOpenAISetupAssistant,
  detectLikelyReplyLanguage,
  buildHonestFallbackTurn,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};