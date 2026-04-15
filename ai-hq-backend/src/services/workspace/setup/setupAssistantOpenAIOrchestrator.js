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
      cfg.ai?.openaiSetupMaxOutputTokens || cfg.ai?.openaiMaxOutputTokens || 1600
    ) || 1600;

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
    coreServices: uniqueStrings(source.coreServices || safeFallback.coreServices, 16),
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
    pricingPosture: s(
      source.pricingPosture || fallbackDraft.pricingPosture
    ),
    humanHandoff: s(
      source.humanHandoff || fallbackDraft.humanHandoff
    ),
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
    nextQuestion:
      normalizedQuestion.key && normalizedQuestion.prompt
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
    .slice(-10);

  if (s(latestMessage)) {
    normalized.push({
      role: "user",
      text: normalizeEventText(latestMessage),
      step: s(latestStep),
      createdAt: null,
    });
  }

  return normalized.slice(-12);
}

function buildReadinessRubric() {
  return {
    identity: [
      "Exact public business name",
      "One clean description of what the business does",
      "Website or other reliable public source identity",
    ],
    services: [
      "Real customer-facing services only",
      "Avoid generic labels, channels, vague capabilities",
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
      "Tone or language if confidently known",
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

  return {
    mission:
      "Understand the business like a professional setup strategist, decide what is trustworthy, avoid asking for facts already covered by strong source evidence, and only ask the single best next question when needed.",
    readinessRubric: buildReadinessRubric(),

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

    recentConversation: extractRecentConversation(
      safeReview,
      latestStep,
      latestMessage
    ),

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
    "You are the canonical setup brain for a business onboarding system.",
    "Behave like a professional business analyst and onboarding strategist, not like a form wizard.",
    "Your job is to understand the business from public sources, existing draft state, and the latest operator reply.",
    "You must think before writing anything into the draft.",
    "Do not ask for facts that are already strongly supported by sources or the existing draft.",
    "When the latest user reply contains usable information, accept and normalize it instead of asking another shallow question.",
    "When the user gives ambiguous, weak, generic, or invalid information, challenge it politely and explain what is still needed.",
    "Never accept acknowledgement-only inputs like ok, continue, next, tamam, oldu, bəli as business facts.",
    "Never accept generic source words like Website, Instagram, Facebook, Source, Contact, Business as services or business identity.",
    "Services must be real customer-facing offers, not channels, vague capabilities, adjectives, or navigation labels.",
    "If the user gives natural language hours like 'weekdays 9 to 6' or 'həftədə 5 dəfə 9-6', infer a professional normalized schedule proposal.",
    "If the user gives pricing naturally, convert it into a safe public pricing posture.",
    "If the user gives handoff cues naturally, convert them into a human escalation rule.",
    "Prefer strong source evidence over weak operator filler, but let the operator override weak source guesses when they are explicit and credible.",
    "If sources and user claims conflict, call it out in confidence.contradictions or rejectedInputs.",
    "assistantMessage must sound calm, professional, and helpful.",
    "Do not dump multiple unrelated questions.",
    "Ask only the single best next question when needed.",
    "If enough information exists for a strong chatbot draft, set readyForApproval=true and present the draft confidently.",
    "Only output strict JSON matching the schema.",
  ].join(" ");
}

function buildUserPrompt(context = {}) {
  return [
    "Analyze this setup turn and decide what should actually be accepted into the setup draft.",
    "",
    "Reasoning principles:",
    "- Treat this like high-quality onboarding for a real business chatbot.",
    "- The operator can answer loosely. You must normalize their meaning into a professional draft.",
    "- If the source evidence already covers a fact, avoid asking for it again.",
    "- Ask for what is actually missing for chatbot readiness, not what is merely absent from a form.",
    "- When a user gives a vague service like 'automation', refine or challenge it.",
    "- When a user gives natural language hours, turn them into a clean draft proposal.",
    "- acceptedPatch should contain only facts you are willing to write into the draft now.",
    "- rejectedInputs should explain what was not accepted and why.",
    "",
    "Readiness target:",
    "- identity: exact public name + clear business description + reliable public source identity",
    "- services: concrete customer-facing services",
    "- contacts: at least one real routing lane",
    "- hours: public hours or explicit availability posture",
    "- pricing: safe public pricing rule",
    "- handoff: clear escalation cases",
    "",
    "Examples of good behavior:",
    "- If the user says 'həftədə 5 dəfə 9-6', interpret that into a reasonable weekday schedule proposal, mention the assumption, and ask only if a specific gap matters.",
    "- If the user says 'automation', do not blindly accept it as a service. Ask what concrete customer-facing service that means.",
    "- If the website already makes the business identity obvious, do not keep asking for business name again.",
    "- If the user gives enough information, stop interrogating and produce a clean draft.",
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
  const resolvedTimeoutMs = Number(timeoutMs || runtime.timeoutMs || 25_000) || 25_000;
  const resolvedMaxOutputTokens =
    Number(maxOutputTokens || runtime.maxOutputTokens || 1600) || 1600;

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
    return normalizeTurnResult(fallbackBrain, {
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
    return normalizeTurnResult(fallbackBrain, {
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
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};