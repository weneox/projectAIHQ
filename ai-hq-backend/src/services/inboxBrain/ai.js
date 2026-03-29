import OpenAI from "openai";
import { cfg } from "../../config.js";
import { buildPromptBundle } from "../promptBundle.js";
import { arr, getResolvedTenantKey, obj, s, sanitizeReplyText } from "./shared.js";
import { buildHistorySnippet, extractText, parseJsonLoose } from "./messages.js";
import {
  buildDisabledServiceLine,
  buildServiceLine,
  resolveInboxRuntime,
} from "./runtime.js";
import { matchKnowledgeEntries, matchPlaybook } from "./matchers.js";

let openaiSingleton = null;

function ensureOpenAI() {
  const key = s(cfg?.ai?.openaiApiKey || "");
  if (!key) return null;

  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: key });
  }

  return openaiSingleton;
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
  const openai = ensureOpenAI();
  if (!openai) return null;

  const model = s(cfg?.ai?.openaiModel || "gpt-5") || "gpt-5";
  const max_output_tokens = Number(cfg?.ai?.openaiMaxOutputTokens || 800);
  const historySnippet = buildHistorySnippet(recentMessages, 6);

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
  const matchedKnowledge = matchKnowledgeEntries(text, resolvedRuntime.knowledgeEntries, 5);
  const matchedPlaybook = matchPlaybook(text, resolvedRuntime.responsePlaybooks);

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
      customerContext: JSON.stringify(customerContext || {}),
      formData: JSON.stringify(formData || {}),
      leadContext: JSON.stringify(leadContext || {}),
      conversationContext: JSON.stringify(conversationContext || {}),
      threadState: JSON.stringify(resolvedRuntime.threadState || threadState || {}),
      reliability: JSON.stringify(reliability || {}),
      matchedKnowledge: JSON.stringify(
        matchedKnowledge.map((x) => ({
          title: x.title,
          question: x.question,
          answer: x.answer,
          keywords: x.keywords,
        }))
      ),
      matchedPlaybook: JSON.stringify(
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
    },
  });

  const prompt = `${promptBundle.fullPrompt}

STRICT BUSINESS RULES:
- Only represent services that are actually enabled and visible_in_ai for this tenant.
- If the customer asks about a disabled or unavailable service, do not pretend it exists.
- Prefer concise answers.
- If pricing is unknown, never invent numbers.
- If matchedKnowledge contains a relevant answer, prefer grounded response from it.
- If matchedPlaybook exists and fits, follow it.
- Return only JSON with keys:
{
  "intent": string,
  "replyText": string,
  "leadScore": number,
  "createLead": boolean,
  "handoff": boolean,
  "handoffReason": string,
  "handoffPriority": "low"|"normal"|"high"|"urgent",
  "noReply": boolean
}`;

  try {
    const resp = await openai.responses.create({
      model,
      text: { format: { type: "text" } },
      max_output_tokens,
      input: [
        {
          role: "system",
          content:
            "You are a strict JSON generator for business inbox decisioning. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = extractText(resp);
    const parsed = parseJsonLoose(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      intent: s(parsed.intent || "general") || "general",
      replyText: sanitizeReplyText(parsed.replyText || ""),
      leadScore: Math.max(0, Math.min(100, Math.round(Number(parsed.leadScore || 0)))),
      createLead: Boolean(parsed.createLead),
      handoff: Boolean(parsed.handoff),
      handoffReason: s(parsed.handoffReason || ""),
      handoffPriority: ["low", "normal", "high", "urgent"].includes(String(parsed.handoffPriority || "normal").toLowerCase())
        ? String(parsed.handoffPriority || "normal").toLowerCase()
        : "normal",
      noReply: Boolean(parsed.noReply),
      raw,
      profile,
      matchedKnowledge,
      matchedPlaybook,
      runtime: resolvedRuntime,
    };
  } catch {
    return null;
  }
}
