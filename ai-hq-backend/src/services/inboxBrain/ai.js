import OpenAI from "openai";
import { cfg } from "../../config.js";
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import { buildPromptBundle } from "../promptBundle.js";
import { arr, getResolvedTenantKey, obj, s, sanitizeReplyText } from "./shared.js";
import {
  buildHistorySnippet,
  extractText,
  normalizeRecentMessages,
  parseJsonLoose,
} from "./messages.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  resolveInboxRuntime,
} from "./runtime.js";
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";

let openaiSingleton = null;

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function summarizeOpenAIConfig() {
  const apiKey = s(cfg?.ai?.openaiApiKey || "");
  const model = s(cfg?.ai?.openaiModel || "gpt-5") || "gpt-5";
  const maxOutputTokens = Number(cfg?.ai?.openaiMaxOutputTokens || 800);

  return {
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    model,
    maxOutputTokens,
  };
}

function safePreview(value = "", max = 280) {
  const text = s(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function logInboxAi(event = "", payload = {}) {
  try {
    console.info(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function logInboxAiWarn(event = "", payload = {}) {
  try {
    console.warn(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function logInboxAiError(event = "", payload = {}) {
  try {
    console.error(`[ai-hq] inbox ai ${event}`, payload);
  } catch {}
}

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
}

function lower(value = "") {
  return s(value).toLowerCase();
}

function includesAny(text = "", keywords = []) {
  const source = lower(text);
  return arr(keywords).some((keyword) => {
    const normalized = lower(keyword);
    return normalized && source.includes(normalized);
  });
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

function normalizeStage(value = "") {
  const normalized = lower(value);
  const allowed = new Set([
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
  ]);
  return allowed.has(normalized) ? normalized : "general";
}

function normalizeReplyStyle(value = "") {
  const normalized = lower(value);
  const allowed = new Set([
    "consultative",
    "direct",
    "reassuring",
    "concise",
    "sales",
    "supportive",
    "professional",
  ]);
  return allowed.has(normalized) ? normalized : "consultative";
}

function normalizePriority(value = "") {
  const normalized = lower(value);
  return ["low", "normal", "high", "urgent"].includes(normalized)
    ? normalized
    : "normal";
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = lower(value);
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
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

  const same =
    lower(first.replace(/[.?!]+$/g, "")) ===
    lower(second.replace(/[.?!]+$/g, ""));
  if (same) return first;

  return sanitizeReplyText(`${first} ${second}`);
}

function looksWeakGenericReply(replyText = "") {
  const text = lower(replyText);
  if (!text) return true;

  const weakPatterns = [
    "qısa olaraq",
    "qisa olaraq",
    "ehtiyacınızı yazın",
    "ehtiyacinizi yazin",
    "hansı xidmət",
    "hansi xidmet",
    "hansı məhsul",
    "hansi mehsul",
    "məlumat verə bilərik",
    "melumat vere bilerik",
    "sizə kömək edə bilərik",
    "size komek ede bilerik",
    "sizə kömək etməyə hazırıq",
    "size komek etmeye haziriq",
  ];

  return weakPatterns.some((pattern) => text.includes(pattern));
}

function inferOfferMode(profile = {}) {
  const bookingFlowType = lower(profile?.bookingFlowType || "");
  const conversionGoal = lower(profile?.conversionGoal || "");
  const primaryCta = lower(profile?.primaryCta || "");
  const qualificationMode = lower(profile?.leadQualificationMode || "");
  const serviceLine = lower(buildServiceLine(profile));

  if (
    includesAny(
      [bookingFlowType, conversionGoal, primaryCta, qualificationMode, serviceLine].join(" "),
      [
        "booking",
        "appointment",
        "reservation",
        "reserve",
        "book",
        "consultation",
        "consult",
        "callback",
        "call",
        "quote",
        "proposal",
        "lead",
        "capture",
        "estimate",
      ]
    )
  ) {
    if (
      includesAny(
        [bookingFlowType, conversionGoal, primaryCta, qualificationMode].join(" "),
        ["booking", "appointment", "reservation", "reserve", "book"]
      )
    ) {
      return "booking";
    }

    if (
      includesAny(
        [conversionGoal, primaryCta, qualificationMode].join(" "),
        ["quote", "proposal", "estimate", "scope"]
      )
    ) {
      return "quote";
    }

    if (
      includesAny(
        [conversionGoal, primaryCta, qualificationMode].join(" "),
        ["consultation", "callback", "call"]
      )
    ) {
      return "consultation";
    }

    return "lead_capture";
  }

  return "information";
}

function detectCurrentAsk(text = "", recentMessages = []) {
  const incoming = lower(text);
  const corpus = [
    normalizeRecentMessages(recentMessages)
      .filter((item) => item.direction === "inbound")
      .map((item) => s(item.text))
      .join("\n"),
    s(text),
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedCorpus = lower(corpus);

  const asksRecommendation = includesAny(incoming, [
    "tövsiyə",
    "tovsiye",
    "recommend",
    "suggest",
    "səncə",
    "sence",
    "məsləhət",
    "meslehet",
    "what do you think",
  ]);

  const asksPricing = includesAny(incoming, [
    "qiymət",
    "qiymet",
    "price",
    "cost",
    "budget",
    "büdcə",
    "budce",
    "tarif",
    "package",
    "paket",
    "how much",
    "neçəyə",
    "neceye",
  ]);

  const asksTimeline = includesAny(incoming, [
    "müddət",
    "muddet",
    "timeline",
    "deadline",
    "how long",
    "when ready",
    "neçə gün",
    "nece gun",
    "neçə həftə",
    "nece hefte",
    "nə vaxt",
    "ne vaxt",
  ]);

  const asksComparison = includesAny(incoming, [
    "difference",
    "fərq",
    "ferq",
    "better",
    "which is better",
    "versus",
    "vs",
    "fərqli",
    "ferqli",
  ]);

  const asksAvailability = includesAny(incoming, [
    "available",
    "availability",
    "mümkündür",
    "mumkundur",
    "olarmı",
    "olarmi",
    "can you",
    "do you offer",
  ]);

  const asksBooking = includesAny(normalizedCorpus, [
    "booking",
    "appointment",
    "reservation",
    "reserve",
    "book",
    "randevu",
    "rezervasiya",
    "bron",
    "masa bronu",
  ]);

  const asksQuote = includesAny(normalizedCorpus, [
    "quote",
    "proposal",
    "estimate",
    "scope",
    "brief",
    "təklif",
    "teklif",
    "commercial offer",
    "commercial proposal",
  ]);

  const asksSupport = includesAny(incoming, [
    "problem",
    "issue",
    "error",
    "support",
    "dəstək",
    "destek",
    "help",
    "kömək",
    "komek",
  ]);

  if (asksRecommendation) return "recommendation";
  if (asksPricing && asksTimeline) return "pricing_timeline";
  if (asksPricing) return "pricing";
  if (asksTimeline) return "timeline";
  if (asksComparison) return "comparison";
  if (asksSupport) return "support";
  if (asksQuote) return "quote";
  if (asksBooking) return "booking";
  if (asksAvailability) return "availability";
  return "general";
}

function detectMessageSignals(text = "", recentMessages = []) {
  const normalizedMessages = normalizeRecentMessages(recentMessages);
  const inboundTexts = normalizedMessages
    .filter((item) => item.direction === "inbound")
    .map((item) => s(item.text))
    .filter(Boolean);

  const corpus = [inboundTexts.join("\n"), s(text)].filter(Boolean).join("\n");
  const normalized = lower(corpus);

  const budgetHints = uniqStrings(
    String(corpus).match(/\b\d{2,6}\s?(azn|manat|usd|eur|\$|₼)\b/gi) || []
  );

  const timelineHints = uniqStrings(
    String(corpus).match(/\b\d+\s?(gün|gun|həftə|hefte|ay|day|days|week|weeks|month|months)\b/gi) || []
  );

  const multilingual = includesAny(normalized, [
    "multi language",
    "multilingual",
    "çox dilli",
    "cox dilli",
    "az ru en",
    "2 dil",
    "3 dil",
    "english and",
  ]);

  const adminPanel = includesAny(normalized, [
    "admin panel",
    "dashboard",
    "cms",
    "content panel",
    "idarəetmə paneli",
    "idareetme paneli",
  ]);

  const booking = includesAny(normalized, [
    "booking",
    "appointment",
    "reservation",
    "reserve",
    "book",
    "randevu",
    "rezervasiya",
    "bron",
  ]);

  const integrations = uniqStrings(
    [
      includesAny(normalized, ["whatsapp"]) ? "whatsapp" : "",
      includesAny(normalized, ["telegram"]) ? "telegram" : "",
      includesAny(normalized, ["instagram"]) ? "instagram" : "",
      includesAny(normalized, ["messenger", "facebook"]) ? "facebook_messenger" : "",
      includesAny(normalized, ["crm"]) ? "crm" : "",
      includesAny(normalized, ["payment", "stripe", "checkout"]) ? "payment" : "",
    ].filter(Boolean)
  );

  const knownArtifacts = uniqStrings(
    [
      includesAny(normalized, ["landing page", "landing", "single page", "one page", "tək səhifə", "tek sehife"])
        ? "single_page_offer"
        : "",
      includesAny(normalized, ["website", "web site", "veb sayt", "websayt", "site", "sayt"])
        ? "website"
        : "",
      includesAny(normalized, ["app", "mobile app", "application"])
        ? "app"
        : "",
      includesAny(normalized, ["bot", "chatbot", "assistant"])
        ? "assistant"
        : "",
    ].filter(Boolean)
  );

  return {
    normalizedMessages,
    corpus,
    budgetHints,
    timelineHints,
    multilingual,
    adminPanel,
    booking,
    integrations,
    knownArtifacts,
  };
}

function buildConversationFacts({
  text,
  recentMessages = [],
  profile = {},
  customerContext = {},
  formData = {},
  leadContext = {},
  conversationContext = {},
}) {
  const askType = detectCurrentAsk(text, recentMessages);
  const signals = detectMessageSignals(text, recentMessages);
  const offerMode = inferOfferMode(profile);
  const knownFacts = [];

  const serviceNames = uniqStrings(arr(profile?.services));
  const disabledServiceNames = uniqStrings(arr(profile?.disabledServices));
  const qualificationQuestions = uniqStrings(arr(profile?.qualificationQuestions));
  const channelBehaviorInbox = obj(profile?.channelBehavior?.inbox);
  const ctxCompany = s(customerContext?.companyName || customerContext?.businessName);
  const ctxNeed = s(
    leadContext?.need ||
      leadContext?.serviceNeed ||
      conversationContext?.need ||
      formData?.need
  );
  const ctxDeadline = s(
    leadContext?.deadline ||
      conversationContext?.deadline ||
      formData?.deadline
  );
  const ctxBudget = s(
    leadContext?.budget ||
      conversationContext?.budget ||
      formData?.budget
  );
  const ctxLocation = s(
    customerContext?.location ||
      leadContext?.location ||
      formData?.location
  );

  if (s(profile?.industry)) knownFacts.push(`industry:${s(profile.industry)}`);
  if (offerMode) knownFacts.push(`offer_mode:${offerMode}`);
  if (s(profile?.conversionGoal)) {
    knownFacts.push(`conversion_goal:${s(profile.conversionGoal)}`);
  }
  if (s(profile?.primaryCta)) {
    knownFacts.push(`primary_cta:${s(profile.primaryCta)}`);
  }
  if (ctxCompany) knownFacts.push(`customer_company:${ctxCompany}`);
  if (ctxNeed) knownFacts.push(`captured_need:${ctxNeed}`);
  if (ctxDeadline) knownFacts.push(`captured_deadline:${ctxDeadline}`);
  if (ctxBudget) knownFacts.push(`captured_budget:${ctxBudget}`);
  if (ctxLocation) knownFacts.push(`captured_location:${ctxLocation}`);
  if (signals.booking) knownFacts.push("feature:booking_or_reservation");
  if (signals.multilingual) knownFacts.push("feature:multilingual");
  if (signals.adminPanel) knownFacts.push("feature:admin_panel");
  if (signals.budgetHints.length) {
    knownFacts.push(`budget_hints:${signals.budgetHints.join(", ")}`);
  }
  if (signals.timelineHints.length) {
    knownFacts.push(`timeline_hints:${signals.timelineHints.join(", ")}`);
  }
  if (signals.integrations.length) {
    knownFacts.push(`integrations:${signals.integrations.join(", ")}`);
  }
  if (signals.knownArtifacts.length) {
    knownFacts.push(`artifacts:${signals.knownArtifacts.join(", ")}`);
  }
  if (askType) {
    knownFacts.push(`current_ask:${askType}`);
  }

  let suggestedStage = "general";
  if (askType === "recommendation") suggestedStage = "recommendation";
  else if (askType === "pricing") suggestedStage = "pricing";
  else if (askType === "pricing_timeline") suggestedStage = "pricing";
  else if (askType === "timeline") suggestedStage = "timeline";
  else if (askType === "comparison") suggestedStage = "recommendation";
  else if (askType === "booking" || askType === "quote" || askType === "availability") suggestedStage = "qualification";
  else if (askType === "support") suggestedStage = "support";
  else if (signals.normalizedMessages.length <= 1) suggestedStage = "greeting";
  else if (ctxNeed || signals.knownArtifacts.length || signals.booking || signals.integrations.length) {
    suggestedStage = "qualification";
  } else {
    suggestedStage = "discovery";
  }

  const missingFacts = [];

  if (offerMode === "booking" && !signals.booking && askType !== "support") {
    missingFacts.push("booking_or_reservation_flow_preference");
  }

  if (offerMode === "quote" && !ctxNeed && !signals.knownArtifacts.length) {
    missingFacts.push("scope_or_project_need");
  }

  if (
    (askType === "pricing" || askType === "pricing_timeline") &&
    !ctxBudget &&
    !signals.budgetHints.length
  ) {
    missingFacts.push("budget_range_or_scope_size");
  }

  if (
    (askType === "timeline" || askType === "pricing_timeline") &&
    !ctxDeadline &&
    !signals.timelineHints.length
  ) {
    missingFacts.push("desired_deadline");
  }

  if (!ctxNeed && !signals.knownArtifacts.length && serviceNames.length) {
    missingFacts.push("which_service_or_offer_matters_most");
  }

  if (
    suggestedStage === "qualification" &&
    qualificationQuestions.length
  ) {
    const normalizedKnown = lower(knownFacts.join(" "));
    for (const question of qualificationQuestions.slice(0, 3)) {
      const q = s(question);
      if (!q) continue;
      if (normalizedKnown.includes(lower(q))) continue;
      missingFacts.push(q);
      break;
    }
  }

  if (
    !serviceNames.length &&
    !ctxNeed &&
    !signals.knownArtifacts.length &&
    !signals.booking &&
    !signals.integrations.length
  ) {
    missingFacts.push("primary_goal");
  }

  return {
    askType,
    offerMode,
    suggestedStage,
    knownFacts: uniqStrings(knownFacts),
    missingFacts: uniqStrings(missingFacts),
    signals,
    serviceNames,
    disabledServiceNames,
    qualificationQuestions,
    channelBehaviorInbox,
  };
}

function buildConsultativeSystemPrompt() {
  return [
    "You are a high-quality business inbox consultation planner.",
    "You are not a generic lead-capture bot.",
    "You must feel like a smart consultant or sales operator for the tenant's business.",
    "Always answer the user's actual question first.",
    "After answering, ask at most one sharp next question only if it truly helps move the conversation forward.",
    "Never ask the customer to repeat facts already listed in KNOWN_FACTS.",
    "Never ignore what the customer has already said in the thread.",
    "If the customer asks for a recommendation, lead with a recommendation and a short reason.",
    "If the customer asks about pricing or timeline and exact numbers are not grounded, explain what changes scope and ask one narrowing question.",
    "If grounded knowledge exists, use it.",
    "If the customer already provided enough information for this turn, recommendedNextQuestion must be empty.",
    "Avoid robotic filler and intake-bot wording.",
    "Do not say the business offers unavailable services.",
    "Keep the reply natural, premium, concise, and consultative.",
    "Return only valid JSON.",
  ].join(" ");
}

function buildConsultativePrompt({
  promptBundle,
  profile,
  text,
  historySnippet,
  matchedKnowledge,
  matchedPlaybook,
  facts,
  policy,
}) {
  const language = s(profile?.languages?.[0] || "az");
  const serviceCatalog = arr(profile?.serviceCatalog)
    .filter((item) => item?.active && item?.visibleInAi)
    .map((item) => ({
      key: item.key,
      name: item.name,
      description: item.description,
      pricingMode: item.pricingMode,
      responseMode: item.responseMode,
      contactCaptureMode: item.contactCaptureMode,
      handoffMode: item.handoffMode,
      aliases: arr(item.aliases).slice(0, 8),
    }));

  const disabledCatalog = arr(profile?.serviceCatalog)
    .filter((item) => !item?.active && item?.visibleInAi)
    .map((item) => ({
      key: item.key,
      name: item.name,
      aliases: arr(item.aliases).slice(0, 8),
      disabledReplyText: item.disabledReplyText,
    }));

  return `${promptBundle.fullPrompt}

CONSULTATIVE EXECUTION LAYER:
- Latest customer message: ${JSON.stringify(s(text))}
- Preferred output language: ${JSON.stringify(language)}
- Suggested stage: ${JSON.stringify(facts.suggestedStage)}
- Current ask type: ${JSON.stringify(facts.askType)}
- Offer mode: ${JSON.stringify(facts.offerMode)}
- KNOWN_FACTS: ${compactJson(facts.knownFacts)}
- MISSING_FACTS: ${compactJson(facts.missingFacts)}
- SIGNALS: ${compactJson({
    booking: facts.signals.booking,
    multilingual: facts.signals.multilingual,
    adminPanel: facts.signals.adminPanel,
    integrations: facts.signals.integrations,
    artifacts: facts.signals.knownArtifacts,
    budgetHints: facts.signals.budgetHints,
    timelineHints: facts.signals.timelineHints,
  })}
- POLICY: ${compactJson({
    autoReplyEnabled: Boolean(policy?.autoReplyEnabled),
    createLeadEnabled: Boolean(policy?.createLeadEnabled),
    handoffEnabled: Boolean(policy?.handoffEnabled),
  })}
- HISTORY_SNIPPET:
${historySnippet || "(empty)"}

TENANT TRUTH:
- displayName: ${JSON.stringify(s(profile.displayName))}
- industry: ${JSON.stringify(s(profile.industry))}
- businessSummary: ${JSON.stringify(s(profile.businessSummary))}
- conversionGoal: ${JSON.stringify(s(profile.conversionGoal))}
- primaryCta: ${JSON.stringify(s(profile.primaryCta))}
- bookingFlowType: ${JSON.stringify(s(profile.bookingFlowType))}
- leadQualificationMode: ${JSON.stringify(s(profile.leadQualificationMode))}
- toneProfile: ${JSON.stringify(s(profile.toneProfile))}
- qualificationQuestions: ${compactJson(arr(profile.qualificationQuestions))}
- enabledServiceCatalog: ${compactJson(serviceCatalog)}
- disabledServiceCatalog: ${compactJson(disabledCatalog)}
- matchedKnowledge: ${compactJson(
    matchedKnowledge.map((item) => ({
      title: item.title,
      question: item.question,
      answer: item.answer,
      keywords: item.keywords,
    }))
  )}
- matchedPlaybook: ${compactJson(
    matchedPlaybook
      ? {
          name: matchedPlaybook.name,
          triggerKeywords: matchedPlaybook.triggerKeywords,
          replyTemplate: matchedPlaybook.replyTemplate,
          actionType: matchedPlaybook.actionType,
          createLead: matchedPlaybook.createLead,
          handoff: matchedPlaybook.handoff,
          handoffReason: matchedPlaybook.handoffReason,
          handoffPriority: matchedPlaybook.handoffPriority,
        }
      : {}
  )}

STRICT BUSINESS RULES:
- Only represent enabled services from enabledServiceCatalog.
- If the customer asks about a disabled or unavailable offer, do not pretend it exists.
- If pricing is unknown, never invent exact numbers.
- If grounded knowledge exists, use it.
- If a playbook exists and clearly fits, align with it.
- replyText should usually be 1 to 4 sentences.
- answerFirst must contain the actual answer or recommendation.
- recommendedNextQuestion must be empty if no follow-up question is needed.
- knownFacts should contain the facts you actively used.
- missingFacts should only contain the next missing detail(s) that truly matter now.

Return only JSON with this shape:
{
  "intent": string,
  "stage": "greeting"|"discovery"|"recommendation"|"pricing"|"timeline"|"qualification"|"objection"|"handoff"|"support"|"answer"|"closing"|"general",
  "replyStyle": "consultative"|"direct"|"reassuring"|"concise"|"sales"|"supportive"|"professional",
  "answerFirst": string,
  "recommendedNextQuestion": string,
  "replyText": string,
  "knownFacts": string[],
  "missingFacts": string[],
  "leadScore": number,
  "createLead": boolean,
  "handoff": boolean,
  "handoffReason": string,
  "handoffPriority": "low"|"normal"|"high"|"urgent",
  "noReply": boolean
}`;
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
    usecase: "inbox.reply",
    decisions: {
      cta: {
        selected: resolvedRuntime.primaryCta,
        reason: "approved_runtime_behavior",
      },
      qualification: {
        mode: obj(resolvedRuntime.channelBehavior?.inbox).qualificationDepth,
        questionCount: arr(resolvedRuntime.qualificationQuestions).length,
        reason:
          arr(resolvedRuntime.qualificationQuestions).length > 0
            ? "approved_runtime_behavior"
            : "",
      },
      handoff: {
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    evaluation: {
      outcome: Boolean(result.handoff)
        ? "handoff_recommended"
        : Boolean(result.noReply)
          ? "no_reply_recommended"
          : "reply_recommended",
      ctaDirection: Boolean(result.handoff)
        ? "handoff"
        : Boolean(result.noReply)
          ? "none"
          : "reply_with_cta",
      qualification: {
        status: s(result.stage || "general"),
        questionCount: arr(result.missingFacts).length,
      },
      handoff: {
        status: Boolean(result.handoff) ? "recommended" : "clear",
        reason: s(result.handoffReason || ""),
        priority: s(result.handoffPriority || "normal").toLowerCase(),
      },
    },
    decisionPath: {
      status: Boolean(result.handoff)
        ? "escalated_to_operator"
        : Boolean(result.noReply)
          ? "no_reply"
          : "answered",
      reasonCode:
        s(result.handoffReason || "") ||
        (Boolean(result.handoff)
          ? "ai_handoff_recommended"
          : Boolean(result.noReply)
            ? "ai_no_reply_recommended"
            : "ai_reply_generated"),
      detail: s(result.stage || ""),
    },
  });
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

function getFirstQualificationQuestion(facts = {}, profile = {}) {
  const explicit = coerceStringArray(facts?.missingFacts);
  const qualificationQuestions = coerceStringArray(profile?.qualificationQuestions);

  for (const item of explicit) {
    if (!item.includes(":") && item.length > 8) return item;
  }

  return s(qualificationQuestions[0] || "");
}

function inferHeuristicReply({
  text,
  profile,
  matchedKnowledge,
  matchedPlaybook,
  facts,
}) {
  const serviceLine = buildServiceLine(profile);
  const offerMode = facts.offerMode;
  const askType = facts.askType;
  const firstQualificationQuestion = getFirstQualificationQuestion(facts, profile);

  if (matchedPlaybook?.replyTemplate) {
    const replyText = sanitizeReplyText(matchedPlaybook.replyTemplate);
    return {
      intent: "playbook",
      stage: facts.suggestedStage,
      replyStyle: "consultative",
      answerFirst: replyText,
      recommendedNextQuestion: "",
      replyText,
      knownFacts: facts.knownFacts,
      missingFacts: facts.missingFacts,
      leadScore: matchedPlaybook.createLead ? 62 : 34,
      createLead: Boolean(matchedPlaybook.createLead),
      handoff: Boolean(matchedPlaybook.handoff),
      handoffReason: s(matchedPlaybook.handoffReason || ""),
      handoffPriority: normalizePriority(matchedPlaybook.handoffPriority || "normal"),
      noReply: false,
    };
  }

  if (matchedKnowledge.length && askType !== "recommendation") {
    const grounded = sanitizeReplyText(matchedKnowledge[0]?.answer || "");
    if (grounded) {
      return {
        intent: "knowledge_answer",
        stage: "answer",
        replyStyle: "consultative",
        answerFirst: grounded,
        recommendedNextQuestion: "",
        replyText: grounded,
        knownFacts: facts.knownFacts,
        missingFacts: facts.missingFacts,
        leadScore: 36,
        createLead: false,
        handoff: false,
        handoffReason: "",
        handoffPriority: "normal",
        noReply: false,
      };
    }
  }

  let intent = "general";
  let stage = facts.suggestedStage;
  let leadScore = 28;
  let answerFirst = "";
  let recommendedNextQuestion = "";

  if (askType === "recommendation") {
    intent = "service_interest";
    stage = "recommendation";
    leadScore = 56;

    if (offerMode === "booking") {
      answerFirst =
        "Bu ehtiyac üçün ən doğru yanaşma rezervasiya və ya booking axınını sadə və aydın qurmaqdır; istifadəçi mümkün qədər az addımda müraciət və ya bron edə bilməlidir.";
    } else if (offerMode === "quote") {
      answerFirst =
        "Bu tip ehtiyac üçün ən yaxşı yanaşma əvvəlcə scope-u düzgün çərçivələmək, sonra buna uyğun həll və təklif çıxarmaqdır.";
    } else if (offerMode === "consultation") {
      answerFirst =
        "Burada ən düzgün yanaşma əvvəlcə ehtiyacı qısa dəqiqləşdirib sonra uyğun konsultasiya və ya növbəti addımı təklif etməkdir.";
    } else if (serviceLine) {
      answerFirst = `${serviceLine} üzrə bunu məqsədə uyğun və daha səliqəli strukturla qurmaq doğru seçim olar.`;
    } else {
      answerFirst =
        "Burada ən düzgün seçim əvvəlcə əsas məqsədi fokuslamaq, sonra ona uyğun daha səmərəli həll seçməkdir.";
    }

    recommendedNextQuestion =
      firstQualificationQuestion ||
      (offerMode === "booking"
        ? "Əsas məqsəd online booking-dirmi, yoxsa əvvəlcə sadə müraciət axını kifayətdir?"
        : offerMode === "quote"
          ? "Dəqiq yönləndirim üçün əsas scope-u bir cümlə ilə yaza bilərsiniz?"
          : "Dəqiq yönləndirim üçün əsas məqsədinizi bir cümlə ilə yaza bilərsiniz?");
  } else if (askType === "pricing" || askType === "pricing_timeline") {
    intent = "pricing";
    stage = "pricing";
    leadScore = 60;
    answerFirst =
      "Dəqiq qiymət scope-dan asılı olur: həllin həcmi, inteqrasiyalar, kontent sayı, çoxdilli ehtiyac və idarəetmə tələbi qiyməti ciddi dəyişə bilər.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "Daha dəqiq istiqamət vermək üçün əsas scope-u və gözlədiyiniz həll ölçüsünü yaza bilərsiniz?";
  } else if (askType === "timeline") {
    intent = "pricing";
    stage = "timeline";
    leadScore = 58;
    answerFirst =
      "Hazırlanma müddəti əsasən scope, təsdiq sürəti və inteqrasiya tələblərindən asılı olur; sadə həllərlə daha geniş həlllər arasında ciddi zaman fərqi ola bilər.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "İstədiyiniz launch vaxtı və əsas scope-u yaza bilərsiniz?";
  } else if (askType === "comparison") {
    intent = "general";
    stage = "recommendation";
    leadScore = 46;
    answerFirst =
      "Burada düzgün seçim məqsəddən asılıdır; hansı variantın daha yaxşı olması müraciət toplamaq, təqdimat, rezervasiya və ya satış məqsədinə görə dəyişir.";
    recommendedNextQuestion =
      "Müqayisədə əsas məqsədiniz nədir: daha çox müraciət, daha yaxşı təqdimat, yoxsa daha rahat əməliyyat axını?";
  } else if (askType === "booking") {
    intent = "service_interest";
    stage = "qualification";
    leadScore = 54;
    answerFirst =
      "Bunu rezervasiya və ya booking axını ilə qurmaq mümkündür və burada ən vacib hissə istifadəçinin tez qərar verib müraciəti rahat tamamlaya bilməsidir.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "Sizdə booking birbaşa sistem içində tamamlanmalıdır, yoxsa ilkin müraciət və təsdiq axını kifayətdir?";
  } else if (askType === "quote") {
    intent = "service_interest";
    stage = "qualification";
    leadScore = 52;
    answerFirst =
      "Bəli, bunun üçün scope əsaslı yanaşmaq daha düzgündür və dəqiq təklif üçün ehtiyacı bir az daraltmaq lazımdır.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "Təklif çıxarmaq üçün əsas məqsəd, əsas funksiyalar və gözlənən nəticəni qısa yaza bilərsiniz?";
  } else if (askType === "support") {
    intent = "support";
    stage = "support";
    leadScore = 34;
    answerFirst =
      "Kömək edə bilərik, əvvəlcə problemi dəqiq çərçivələmək lazımdır ki düzgün həll istiqaməti verək.";
    recommendedNextQuestion =
      "Hazırda qarşılaşdığınız əsas problem nədir?";
  } else if (offerMode === "booking") {
    intent = "service_interest";
    stage = "qualification";
    leadScore = 48;
    answerFirst =
      "Burada əsas fokus rezervasiya və ya booking axınının aydın və sürətli işləməsidir.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "İstifadəçi birbaşa rezervasiya etməlidir, yoxsa əvvəlcə müraciət göndərib təsdiq gözləməlidir?";
  } else if (offerMode === "quote") {
    intent = "service_interest";
    stage = "qualification";
    leadScore = 46;
    answerFirst =
      "Burada düzgün yanaşma əvvəlcə scope-u dəqiqləşdirib sonra uyğun həlli formalaşdırmaqdır.";
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "Əsas ehtiyacınızı və gözlədiyiniz nəticəni bir cümlə ilə yaza bilərsiniz?";
  } else if (serviceLine) {
    intent = "service_interest";
    stage = "qualification";
    leadScore = 44;
    answerFirst = `${serviceLine} üzrə kömək edə bilərik və bunu ehtiyacınıza uyğun düzgün istiqamətləndirmək olar.`;
    recommendedNextQuestion =
      firstQualificationQuestion ||
      "Sizin üçün hazırda ən vacib nəticə nədir?";
  } else {
    intent = "general";
    stage = facts.suggestedStage || "discovery";
    leadScore = 28;
    answerFirst =
      "Daha düzgün yönləndirmək üçün ehtiyacı qısa şəkildə dəqiqləşdirmək lazımdır.";
    recommendedNextQuestion =
      "Sizin üçün əsas məqsəd nədir?";
  }

  const replyText = joinReplyParts(answerFirst, recommendedNextQuestion);

  return {
    intent,
    stage,
    replyStyle: "consultative",
    answerFirst,
    recommendedNextQuestion,
    replyText,
    knownFacts: facts.knownFacts,
    missingFacts: facts.missingFacts,
    leadScore,
    createLead: leadScore >= 45,
    handoff: false,
    handoffReason: "",
    handoffPriority: "normal",
    noReply: false,
    heuristic: true,
  };
}

function normalizeAiResult({
  parsed,
  fallbackDecision,
  profile,
  matchedKnowledge,
  matchedPlaybook,
  resolvedRuntime,
  promptBundle,
  channel,
  policy,
}) {
  const answerFirst = sanitizeSentence(parsed?.answerFirst || "");
  const recommendedNextQuestion = sanitizeSentence(
    parsed?.recommendedNextQuestion || ""
  );

  let replyText = sanitizeReplyText(parsed?.replyText || "");
  if (!replyText) {
    replyText = joinReplyParts(answerFirst, recommendedNextQuestion);
  }

  const result = {
    intent: s(parsed?.intent || fallbackDecision.intent || "general") || "general",
    stage: normalizeStage(parsed?.stage || fallbackDecision.stage || "general"),
    replyStyle: normalizeReplyStyle(
      parsed?.replyStyle || fallbackDecision.replyStyle || "consultative"
    ),
    answerFirst:
      answerFirst || sanitizeSentence(fallbackDecision.answerFirst || ""),
    recommendedNextQuestion:
      recommendedNextQuestion ||
      sanitizeSentence(fallbackDecision.recommendedNextQuestion || ""),
    replyText:
      replyText ||
      sanitizeReplyText(fallbackDecision.replyText || ""),
    knownFacts:
      coerceStringArray(parsed?.knownFacts).length
        ? coerceStringArray(parsed?.knownFacts)
        : coerceStringArray(fallbackDecision.knownFacts),
    missingFacts:
      coerceStringArray(parsed?.missingFacts).length
        ? coerceStringArray(parsed?.missingFacts)
        : coerceStringArray(fallbackDecision.missingFacts),
    leadScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(
            parsed?.leadScore ??
              fallbackDecision.leadScore ??
              0
          )
        )
      )
    ),
    createLead: coerceBoolean(
      parsed?.createLead,
      Boolean(fallbackDecision.createLead)
    ),
    handoff: coerceBoolean(parsed?.handoff, Boolean(fallbackDecision.handoff)),
    handoffReason: s(parsed?.handoffReason || fallbackDecision.handoffReason || ""),
    handoffPriority: normalizePriority(
      parsed?.handoffPriority || fallbackDecision.handoffPriority || "normal"
    ),
    noReply: coerceBoolean(parsed?.noReply, false),
    raw: "",
    profile,
    matchedKnowledge,
    matchedPlaybook,
    runtime: resolvedRuntime,
    promptBundle,
    trace: {},
    heuristic: Boolean(fallbackDecision?.heuristic),
  };

  if (!result.replyText) {
    result.replyText = joinReplyParts(
      result.answerFirst,
      result.recommendedNextQuestion
    );
  }

  if (looksWeakGenericReply(result.replyText) && fallbackDecision?.replyText) {
    result.answerFirst = sanitizeSentence(fallbackDecision.answerFirst || "");
    result.recommendedNextQuestion = sanitizeSentence(
      fallbackDecision.recommendedNextQuestion || ""
    );
    result.replyText = sanitizeReplyText(fallbackDecision.replyText || "");
    result.knownFacts = coerceStringArray(fallbackDecision.knownFacts);
    result.missingFacts = coerceStringArray(fallbackDecision.missingFacts);
    result.stage = normalizeStage(fallbackDecision.stage || result.stage);
    result.replyStyle = normalizeReplyStyle(
      fallbackDecision.replyStyle || result.replyStyle
    );
    result.heuristic = true;
  }

  result.trace = buildTraceFromDecision({
    resolvedRuntime,
    policy,
    promptBundle,
    channel,
    result,
  });

  return result;
}

export async function aiDecideInbox({
  text,
  channel,
  externalUserId,
  tenantKey,
  thread,
  message,
  tenant = null,
  policy,
  quietHoursApplied,
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
  const openAiConfig = summarizeOpenAIConfig();
  const openai = ensureOpenAI();

  const model = openAiConfig.model;
  const max_output_tokens = openAiConfig.maxOutputTokens;
  const historySnippet = buildHistorySnippet(recentMessages, 8);

  const resolvedRuntime =
    runtime ||
    (await resolveInboxRuntime({
      tenantKey,
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
    }));

  const profile = resolvedRuntime;
  const servicesLine = buildServiceLine(profile);
  const disabledServicesLine = buildDisabledServiceLine(profile);
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const matchedKnowledge = matchKnowledgeEntries(
    text,
    resolvedRuntime.knowledgeEntries,
    5
  );
  const matchedPlaybook = matchPlaybook(text, resolvedRuntime.responsePlaybooks);

  const facts = buildConversationFacts({
    text,
    recentMessages,
    profile,
    customerContext,
    formData,
    leadContext,
    conversationContext,
  });

  const heuristicDecision = inferHeuristicReply({
    text,
    profile,
    matchedKnowledge,
    matchedPlaybook,
    facts,
  });

  const promptBundle = buildPromptBundle("inbox.reply", {
    tenant: {
      ...obj(tenant),
      tenantKey: resolvedTenantKey,
      tenantId: resolvedTenantKey,
      companyName: profile.displayName,
      brandName: profile.displayName,
      industryKey: profile.industry,
      outputLanguage: profile.languages?.[0] || "az",
      toneText: profile.tone,
      services: profile.services,
      servicesText: servicesLine || "general business services",
      businessContext: profile.businessSummary || "",
      ai_policy: {
        ...obj(tenant?.ai_policy),
        ...obj(profile.aiPolicy),
      },
      behavior: {
        niche: s(profile.industry),
        conversionGoal: s(profile.conversionGoal),
        primaryCta: s(profile.primaryCta),
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
      },
    },
    extra: {
      channel: JSON.stringify(s(channel || "instagram")),
      externalUserId: JSON.stringify(s(externalUserId || "")),
      threadId: JSON.stringify(s(thread?.id || "")),
      messageId: JSON.stringify(s(message?.id || "")),
      threadStatus: JSON.stringify(s(thread?.status || "open")),
      quietHoursApplied: quietHoursApplied ? "true" : "false",
      policyAutoReplyEnabled: Boolean(policy?.autoReplyEnabled),
      policyCreateLeadEnabled: Boolean(policy?.createLeadEnabled),
      policyHandoffEnabled: Boolean(policy?.handoffEnabled),
      servicesLine: JSON.stringify(servicesLine),
      disabledServicesLine: JSON.stringify(disabledServicesLine),
      historySnippet: historySnippet || "(empty)",
      incomingMessage: JSON.stringify(String(text || "")),
      maxSentences: profile.maxSentences,
      customerContext: compactJson(customerContext || {}),
      formData: compactJson(formData || {}),
      leadContext: compactJson(leadContext || {}),
      conversationContext: compactJson(conversationContext || {}),
      threadState: compactJson(resolvedRuntime.threadState || threadState || {}),
      reliability: compactJson(reliability || {}),
      matchedKnowledge: compactJson(
        matchedKnowledge.map((item) => ({
          title: item.title,
          question: item.question,
          answer: item.answer,
          keywords: item.keywords,
        }))
      ),
      matchedPlaybook: compactJson(
        matchedPlaybook
          ? {
              name: matchedPlaybook.name,
              triggerKeywords: matchedPlaybook.triggerKeywords,
              replyTemplate: matchedPlaybook.replyTemplate,
              actionType: matchedPlaybook.actionType,
              createLead: matchedPlaybook.createLead,
              handoff: matchedPlaybook.handoff,
              handoffReason: matchedPlaybook.handoffReason,
              handoffPriority: matchedPlaybook.handoffPriority,
            }
          : {}
      ),
      detectedFacts: compactJson({
        askType: facts.askType,
        offerMode: facts.offerMode,
        suggestedStage: facts.suggestedStage,
        knownFacts: facts.knownFacts,
        missingFacts: facts.missingFacts,
        signals: {
          booking: facts.signals.booking,
          multilingual: facts.signals.multilingual,
          adminPanel: facts.signals.adminPanel,
          integrations: facts.signals.integrations,
          knownArtifacts: facts.signals.knownArtifacts,
          budgetHints: facts.signals.budgetHints,
          timelineHints: facts.signals.timelineHints,
        },
      }),
      heuristicDecision: compactJson({
        intent: heuristicDecision.intent,
        stage: heuristicDecision.stage,
        answerFirst: heuristicDecision.answerFirst,
        recommendedNextQuestion: heuristicDecision.recommendedNextQuestion,
        replyText: heuristicDecision.replyText,
      }),
    },
  });

  if (!openai) {
    logInboxAiWarn("unavailable_using_heuristic", {
      tenantKey: s(tenantKey),
      channel: s(channel || "inbox"),
      reason: "openai_api_key_missing",
      model,
      hasApiKey: openAiConfig.hasApiKey,
      apiKeyLength: openAiConfig.apiKeyLength,
      suggestedStage: facts.suggestedStage,
      askType: facts.askType,
      offerMode: facts.offerMode,
    });

    return normalizeAiResult({
      parsed: heuristicDecision,
      fallbackDecision: heuristicDecision,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
    });
  }

  const prompt = buildConsultativePrompt({
    promptBundle,
    profile,
    text,
    historySnippet,
    matchedKnowledge,
    matchedPlaybook,
    facts,
    policy,
  });

  logInboxAi("request_start", {
    tenantKey: resolvedTenantKey,
    channel: s(channel || "inbox"),
    model,
    maxOutputTokens: max_output_tokens,
    quietHoursApplied: Boolean(quietHoursApplied),
    matchedKnowledgeCount: matchedKnowledge.length,
    hasMatchedPlaybook: Boolean(matchedPlaybook),
    threadId: s(thread?.id),
    messageId: s(message?.id),
    suggestedStage: facts.suggestedStage,
    askType: facts.askType,
    offerMode: facts.offerMode,
    knownFactsCount: facts.knownFacts.length,
    missingFactsCount: facts.missingFacts.length,
  });

  try {
    const resp = await openai.responses.create({
      model,
      text: { format: { type: "text" } },
      max_output_tokens,
      input: [
        {
          role: "system",
          content: buildConsultativeSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = extractText(resp);
    const parsed = parseJsonLoose(raw);

    if (!parsed || typeof parsed !== "object") {
      logInboxAiWarn("invalid_json_using_heuristic", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        rawPreview: safePreview(raw),
        suggestedStage: facts.suggestedStage,
        askType: facts.askType,
      });

      const fallbackResult = normalizeAiResult({
        parsed: heuristicDecision,
        fallbackDecision: heuristicDecision,
        profile,
        matchedKnowledge,
        matchedPlaybook,
        resolvedRuntime,
        promptBundle,
        channel,
        policy,
      });

      fallbackResult.raw = raw;

      logInboxAi("decision", {
        tenantKey: resolvedTenantKey,
        channel: s(channel || "inbox"),
        model,
        intent: fallbackResult.intent,
        stage: fallbackResult.stage,
        noReply: fallbackResult.noReply,
        createLead: fallbackResult.createLead,
        handoff: fallbackResult.handoff,
        handoffReason: fallbackResult.handoffReason,
        handoffPriority: fallbackResult.handoffPriority,
        leadScore: fallbackResult.leadScore,
        heuristic: true,
        replyPreview: safePreview(fallbackResult.replyText, 180),
      });

      return fallbackResult;
    }

    const result = normalizeAiResult({
      parsed,
      fallbackDecision: heuristicDecision,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
    });

    result.raw = raw;

    logInboxAi("decision", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      intent: result.intent,
      stage: result.stage,
      replyStyle: result.replyStyle,
      noReply: result.noReply,
      createLead: result.createLead,
      handoff: result.handoff,
      handoffReason: result.handoffReason,
      handoffPriority: result.handoffPriority,
      leadScore: result.leadScore,
      heuristic: Boolean(result.heuristic),
      knownFacts: result.knownFacts,
      missingFacts: result.missingFacts,
      replyPreview: safePreview(result.replyText, 180),
    });

    return result;
  } catch (error) {
    logInboxAiError("failed_using_heuristic", {
      tenantKey: resolvedTenantKey,
      channel: s(channel || "inbox"),
      model,
      errorName: s(error?.name || "Error"),
      errorMessage: s(error?.message || "Unknown OpenAI error"),
      errorCode: s(error?.code),
      errorType: s(error?.type),
      errorStatus:
        Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
      errorParam: s(error?.param),
      errorRawType: s(error?.error?.type),
      errorRawCode: s(error?.error?.code),
      errorRawMessage: s(error?.error?.message),
      suggestedStage: facts.suggestedStage,
      askType: facts.askType,
      offerMode: facts.offerMode,
    });

    return normalizeAiResult({
      parsed: heuristicDecision,
      fallbackDecision: heuristicDecision,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      resolvedRuntime,
      promptBundle,
      channel,
      policy,
    });
  }
}