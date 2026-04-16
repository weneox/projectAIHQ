import OpenAI from "openai";

import { cfg } from "../../../config.js";
import { arr, compactDraftObject, obj, s } from "./draftShared.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupSourceCoverage,
  buildSetupSourceLead,
  buildSetupSourceSignals,
  detectSetupSignalContradictions,
} from "./setupAssistantApp/sourceSignals.js";

let cachedClient = null;

function getSetupAssistantRuntimeConfig() {
  const model = s(cfg.ai?.openaiSetupModel, cfg.ai?.openaiModel || "gpt-5");
  const timeoutMs =
    Number(cfg.ai?.openaiSetupTimeoutMs || cfg.ai?.openaiTimeoutMs || 25_000) ||
    25_000;
  const maxOutputTokens =
    Number(
      cfg.ai?.openaiSetupMaxOutputTokens || cfg.ai?.openaiMaxOutputTokens || 2600
    ) || 2600;

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

function compactText(value = "", max = 280) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function sanitizeQuestion(value = {}, fallback = {}) {
  const source = obj(value);
  const next = compactDraftObject({
    key: s(source.key || fallback.key).toLowerCase(),
    step: s(source.step || source.key || fallback.step || fallback.key).toLowerCase(),
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
        key: s(item?.key).toLowerCase(),
        step: s(item?.step || item?.key).toLowerCase(),
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
      source.remainingQuestionKeys || [],
      12
    ),
    nextGroup: s(source.nextGroup || safeFallback.nextGroup),
    nextGroupLabel: s(source.nextGroupLabel || safeFallback.nextGroupLabel),
  });
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
    .slice(-14);

  if (s(latestMessage)) {
    normalized.push({
      role: "user",
      text: normalizeEventText(latestMessage),
      step: s(latestStep).toLowerCase(),
      createdAt: null,
    });
  }

  return normalized.slice(-16);
}

function detectLikelyReplyLanguage(latestMessage = "", recentConversation = []) {
  const latest = s(latestMessage);
  const recentUser = arr(recentConversation)
    .filter((item) => s(item.role).toLowerCase() === "user")
    .map((item) => s(item.text))
    .join(" ");

  const combined = `${latest} ${recentUser}`.trim().toLowerCase();

  if (!combined) return "follow_latest_user_language";
  if (/[əğıöşçü]/i.test(combined)) return "az";
  if (/\b(mən|sən|biz|və|üçün|deyil|niyə|harada|necə|edir|edirik|olsun)\b/i.test(combined)) {
    return "az";
  }
  if (/[а-яё]/i.test(combined)) return "ru";
  if (/\b(ben|sen|biz|ve|için|değil|neden|nasıl)\b/i.test(combined)) {
    return "tr";
  }
  if (/\b(the|and|what|why|how|business|setup)\b/i.test(combined)) {
    return "en";
  }

  return "follow_latest_user_language";
}

function buildReadinessScore({
  draftState = {},
  sourceCoverage = {},
  contradictions = [],
}) {
  const identityReady = Boolean(
    s(draftState.businessName) &&
      s(draftState.description) &&
      (s(draftState.websiteUrl) || sourceCoverage.primarySourceExists === true)
  );

  const servicesReady = arr(draftState.services).length > 0;
  const contactsReady = arr(draftState.contacts).length > 0;
  const hoursReady = arr(draftState.hours).length > 0;
  const pricingReady = Boolean(s(draftState.pricingPosture));
  const handoffReady = Boolean(s(draftState.humanHandoff));
  const contradictionCount = arr(contradictions).length;

  const readyCount = [
    identityReady,
    servicesReady,
    contactsReady,
    hoursReady,
    pricingReady,
    handoffReady,
  ].filter(Boolean).length;

  return {
    identityReady,
    servicesReady,
    contactsReady,
    hoursReady,
    pricingReady,
    handoffReady,
    readyCount,
    contradictionCount,
    readyForApproval:
      contradictionCount === 0 &&
      identityReady &&
      servicesReady &&
      contactsReady &&
      hoursReady &&
      pricingReady &&
      handoffReady,
  };
}

function buildLocalShadowState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSetupSourceSignals({
    session,
    draft,
    sources,
    review,
  });

  const sourceCoverage = buildSetupSourceCoverage(sourceSignals);

  const draftState = buildSetupDraftStateFromSignals({
    draft,
    review,
    sourceSignals,
  });

  const contradictions = detectSetupSignalContradictions({
    draftState,
    sourceSignals,
  });

  const readiness = buildReadinessScore({
    draftState,
    sourceCoverage,
    contradictions,
  });

  const phase = !(
    s(draftState.businessName) ||
    s(draftState.description) ||
    s(draftState.websiteUrl) ||
    arr(draftState.services).length ||
    arr(draftState.contacts).length ||
    arr(draftState.hours).length ||
    s(draftState.pricingPosture) ||
    s(draftState.humanHandoff) ||
    s(sourceSignals.primarySourceUrl) ||
    arr(sourceSignals.sourceTypes).length
  )
    ? "source_capture"
    : readiness.readyForApproval
      ? "ready"
      : "interview";

  return {
    phase,
    draft: {
      businessName: s(draftState.businessName),
      whatThisBusinessIs: s(draftState.description),
      websiteUrl: s(draftState.websiteUrl),
      coreServices: uniqueStrings(draftState.services, 16),
      audience: s(draftState.audience),
      pricingPosture: s(draftState.pricingPosture),
      contactRoutes: uniqueStrings(draftState.contacts, 12),
      humanHandoff: s(draftState.humanHandoff),
      languages: uniqueStrings(draftState.languages, 8),
      tone: s(draftState.tone),
      hours: uniqueStrings(draftState.hours, 12),
      greetingStyle: s(draftState.greetingStyle),
      afterHoursBehavior: s(draftState.afterHoursBehavior),
    },
    sourceSignals: sanitizeSourceSignals(sourceSignals, {}),
    sourceCoverage,
    contradictions: arr(contradictions)
      .map((item) =>
        compactDraftObject({
          key: s(item.key),
          severity: s(item.severity),
          message: s(item.message),
        })
      )
      .filter((item) => item.message),
    readiness,
    sourceLead: buildSetupSourceLead(sourceSignals),
  };
}

function buildSetupContext({
  session = {},
  draft = {},
  sources = [],
  review = null,
  latestStep = "",
  latestMessage = "",
}) {
  const safeDraft = obj(draft);
  const safeReview = obj(review);
  const reviewDraft = obj(safeReview.review?.draft || safeReview.draft);
  const recentConversation = extractRecentConversation(
    safeReview,
    latestStep,
    latestMessage
  );
  const replyLanguage = detectLikelyReplyLanguage(latestMessage, recentConversation);
  const shadow = buildLocalShadowState({
    session,
    draft,
    sources,
    review,
  });

  return {
    mission:
      "You are the real setup brain for a serious business AI system. Understand the business deeply, extract multiple grounded facts from one reply when justified, and only ask the next question when it is truly necessary.",
    replyRules: {
      speakIn: replyLanguage,
      hardRule:
        "Always answer in the user's latest language. If the latest user language is Azerbaijani, answer in Azerbaijani. Do not default to English unless the user is speaking English.",
      maxQuestionsPerTurn: 1,
      concise: true,
      conversational: true,
      natural: true,
      nonTemplate: true,
      nonWizard: true,
      avoidBoilerplate: true,
      avoidRepeatingTheSameQuestion: true,
      avoidReAskingKnownFacts: true,
      noGenericSetupPhrases: true,
    },
    readinessDefinition: {
      identity: [
        "exact public business name",
        "one clean description of what the business does",
        "main website only if it truly exists, otherwise do not force it",
      ],
      services: [
        "real customer-facing services only",
        "no vague capabilities, no buzzwords, no channels presented as services",
      ],
      contacts: ["at least one real public customer contact route"],
      hours: ["public hours or explicit appointment-only / always-open posture"],
      pricing: ["safe public pricing answer rule"],
      handoff: ["clear cases where AI must escalate to a human"],
    },
    session: compactDraftObject({
      id: s(session.id),
      mode: s(session.mode),
      currentStep: s(session.currentStep),
      status: s(session.status),
      draftVersion: Number(session.draftVersion || 0) || 0,
    }),
    latestUserInput: compactDraftObject({
      step: s(latestStep).toLowerCase(),
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
      sourceMetadata: obj(reviewDraft.sourceMetadata || safeDraft.sourceMetadata),
      assistantState: obj(safeDraft.assistantState),
      progress: obj(safeDraft.progress),
    }),
    shadow,
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
    "You are the primary setup reasoning brain for a premium business AI platform.",
    "You are not a form wizard, not a scripted onboarding bot, and not a template generator.",
    "You must understand the business deeply and speak naturally.",
    "The biggest failure to avoid is canned setup language.",
    "Never output robotic phrases such as 'current signal', 'next most important gap', 'source already attached', 'continue setup', 'public hours are already present', or other obvious template wording.",
    "Never repeat the same question in slightly different form if the answer is already reasonably present.",
    "If one user reply contains multiple facts, extract multiple facts.",
    "Do not shrink a rich reply into one tiny field.",
    "If the user speaks Azerbaijani, reply in Azerbaijani.",
    "If the user speaks another language, follow that language.",
    "Do not default to English unless the user's latest language is English.",
    "Only ask one next question, and only when there is a real readiness blocker.",
    "If enough is already known, set readyForApproval=true and nextQuestion=null.",
    "Website is optional. Do not push for a website if the business truly does not have one.",
    "Services must be real customer-facing services.",
    "Contacts must be real public routes.",
    "Hours and pricing must be safe and operationally believable.",
    "Only output strict JSON matching the schema.",
  ].join(" ");
}

function buildUserPrompt(context = {}) {
  return [
    "Analyze this setup turn.",
    "",
    "Important behavior:",
    "- Talk like a sharp human strategist, not a scripted setup tool.",
    "- Extract grounded facts aggressively but safely.",
    "- Ask only one question, only if necessary.",
    "- Do not ask something that is already known from the user's reply, prior conversation, or reliable source evidence.",
    "- Keep assistantMessage short, natural, and context-aware.",
    "- Do not use boilerplate wording.",
    "- If the user gave enough detail, move forward instead of interrogating.",
    "- If the user gave weak or vague info, challenge it briefly and precisely.",
    "",
    "Output requirements:",
    "- assistantMessage must be natural and non-template.",
    "- nextQuestion must exist only if something important is still missing.",
    "- acceptedPatch must contain only grounded values you are comfortable applying.",
    "- rejectedInputs should capture only clearly weak / generic / unusable claims.",
    "- readyForApproval should become true only when the setup is genuinely strong enough.",
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
    "interviewPlan",
    "aiBehavior",
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
    interviewPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "activeQuestionKeys",
        "activeQuestions",
        "remainingQuestionKeys",
        "nextGroup",
        "nextGroupLabel",
      ],
      properties: {
        activeQuestionKeys: { type: "array", items: { type: "string" } },
        activeQuestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "step", "title", "group", "groupLabel", "priority"],
            properties: {
              key: { type: "string" },
              step: { type: "string" },
              title: { type: "string" },
              group: { type: "string" },
              groupLabel: { type: "string" },
              priority: { type: "number" },
            },
          },
        },
        remainingQuestionKeys: { type: "array", items: { type: "string" } },
        nextGroup: { type: "string" },
        nextGroupLabel: { type: "string" },
      },
    },
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
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("openai_setup_assistant_timeout"));
    }, resolvedTimeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  const outputText = s(response?.output_text);
  if (!outputText) {
    throw new Error("openai_setup_assistant_empty_output");
  }

  return {
    model: resolvedModel,
    payload: safeJsonParse(outputText, {}),
  };
}

function buildFallbackShadowTurn({
  shadow = {},
  latestMessage = "",
  latestStep = "",
  error = "",
  model = "",
}) {
  const safeShadow = obj(shadow);
  const readiness = obj(safeShadow.readiness);
  const fallbackDraft = sanitizeDraft(obj(safeShadow.draft), {});
  const fallbackSourceSignals = sanitizeSourceSignals(
    obj(safeShadow.sourceSignals),
    {}
  );

  const strong = [];
  const unclear = [];

  if (s(fallbackDraft.businessName)) strong.push("business_name_present");
  else unclear.push("business_name_missing");

  if (s(fallbackDraft.whatThisBusinessIs)) strong.push("business_description_present");
  else unclear.push("business_description_missing");

  if (arr(fallbackDraft.coreServices).length) strong.push("services_present");
  else unclear.push("services_missing");

  if (arr(fallbackDraft.contactRoutes).length) strong.push("contacts_present");
  else unclear.push("contacts_missing");

  if (arr(fallbackDraft.hours).length) strong.push("hours_present");
  else unclear.push("hours_missing");

  if (s(fallbackDraft.pricingPosture)) strong.push("pricing_posture_present");
  else unclear.push("pricing_posture_missing");

  if (s(fallbackDraft.humanHandoff)) strong.push("handoff_present");
  else unclear.push("handoff_missing");

  return {
    phase: s(safeShadow.phase, "interview"),
    assistantMessage: "",
    nextQuestion: null,
    draft: fallbackDraft,
    acceptedPatch: sanitizeAcceptedPatch({}, fallbackDraft),
    rejectedInputs: [],
    confidence: {
      strong,
      unclear,
      contradictions: uniqueStrings(
        arr(safeShadow.contradictions).map((item) => s(item.message)),
        12
      ),
    },
    recommendation: {
      notes: [],
    },
    sourceSignals: fallbackSourceSignals,
    interviewPlan: {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    aiBehavior: {
      languages: uniqueStrings(fallbackDraft.languages, 8),
      tone: s(fallbackDraft.tone),
      greetingStyle: s(fallbackDraft.greetingStyle),
      afterHoursBehavior: s(fallbackDraft.afterHoursBehavior),
    },
    readyForApproval: readiness.readyForApproval === true,
    latestUserInput: compactDraftObject({
      step: s(latestStep).toLowerCase(),
      text: s(latestMessage),
    }),
    provider: "local_shadow",
    model: s(model),
    usedFallback: true,
    error: s(error),
  };
}

function normalizeTurnResult(
  payload = {},
  {
    shadow = {},
    latestMessage = "",
    latestStep = "",
    provider = "openai",
    model = "",
    usedFallback = false,
    error = "",
  } = {}
) {
  const safeShadow = obj(shadow);
  const fallbackDraft = sanitizeDraft(obj(safeShadow.draft), {});
  const fallbackSourceSignals = sanitizeSourceSignals(
    obj(safeShadow.sourceSignals),
    {}
  );

  const normalizedDraft = sanitizeDraft(payload.draft, fallbackDraft);
  const normalizedQuestion = sanitizeQuestion(payload.nextQuestion, {});
  const normalizedConfidence = sanitizeConfidence(payload.confidence, {
    strong: [],
    unclear: [],
    contradictions: uniqueStrings(
      arr(safeShadow.contradictions).map((item) => s(item.message)),
      12
    ),
  });
  const normalizedRecommendation = sanitizeRecommendation(payload.recommendation, {
    notes: [],
  });
  const normalizedSourceSignals = sanitizeSourceSignals(
    payload.sourceSignals,
    fallbackSourceSignals
  );
  const normalizedAcceptedPatch = sanitizeAcceptedPatch(
    payload.acceptedPatch,
    normalizedDraft
  );
  const normalizedInterviewPlan = sanitizeInterviewPlan(payload.interviewPlan, {
    activeQuestionKeys: normalizedQuestion.key ? [normalizedQuestion.key] : [],
    activeQuestions: normalizedQuestion.key
      ? [
          {
            key: normalizedQuestion.key,
            step: normalizedQuestion.step,
            title: normalizedQuestion.title,
            group: normalizedQuestion.group,
            groupLabel: normalizedQuestion.groupLabel,
            priority: 1,
          },
        ]
      : [],
    remainingQuestionKeys: [],
    nextGroup: normalizedQuestion.group || "business_truth",
    nextGroupLabel: normalizedQuestion.groupLabel || "Business truth",
  });

  const readyForApproval =
    payload.readyForApproval === true ||
    obj(safeShadow.readiness).readyForApproval === true;

  const phase = s(
    payload.phase,
    readyForApproval ? "ready" : s(safeShadow.phase, "interview")
  );

  const assistantMessage = compactText(payload.assistantMessage, 420);

  return {
    ok: true,
    provider,
    model: s(model),
    usedFallback: usedFallback === true,
    error: s(error),
    latestUserInput: compactDraftObject({
      step: s(latestStep).toLowerCase(),
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
      payload.aiBehavior || normalizedAcceptedPatch.aiBehavior || {}
    ),
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
  const shadow = buildLocalShadowState({
    session,
    draft,
    sources,
    review,
  });

  const shouldForceFallback =
    forceFallback === true || runtime.forceFallback === true;

  if (shouldForceFallback || !hasOpenAISetupAssistant()) {
    return normalizeTurnResult(
      buildFallbackShadowTurn({
        shadow,
        latestMessage,
        latestStep,
        error: shouldForceFallback
          ? "openai_setup_assistant_forced_fallback"
          : "openai_setup_assistant_unavailable",
        model: runtime.model,
      }),
      {
        shadow,
        latestMessage,
        latestStep,
        provider: "local_shadow",
        model: runtime.model,
        usedFallback: true,
        error: shouldForceFallback
          ? "openai_setup_assistant_forced_fallback"
          : "openai_setup_assistant_unavailable",
      }
    );
  }

  const context = buildSetupContext({
    session,
    draft,
    sources,
    review,
    latestStep,
    latestMessage,
  });

  try {
    const openaiResult = await callOpenAISetupAssistant({
      context,
      model: runtime.model,
      timeoutMs: runtime.timeoutMs,
      maxOutputTokens: runtime.maxOutputTokens,
    });

    return normalizeTurnResult(openaiResult.payload, {
      shadow,
      latestMessage,
      latestStep,
      provider: "openai",
      model: openaiResult.model,
      usedFallback: false,
    });
  } catch (error) {
    return normalizeTurnResult(
      buildFallbackShadowTurn({
        shadow,
        latestMessage,
        latestStep,
        error: s(error?.message, "openai_setup_assistant_failed"),
        model: runtime.model,
      }),
      {
        shadow,
        latestMessage,
        latestStep,
        provider: "local_shadow",
        model: runtime.model,
        usedFallback: true,
        error: s(error?.message, "openai_setup_assistant_failed"),
      }
    );
  }
}

export const __test__ = {
  buildSetupContext,
  buildSystemPrompt,
  buildUserPrompt,
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
  buildFallbackShadowTurn,
  buildLocalShadowState,
  setCachedClient(client = null) {
    cachedClient = client;
  },
  clearCachedClient() {
    cachedClient = null;
  },
};