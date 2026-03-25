import { cfg } from "../../config.js";
import {
  arr,
  extractText,
  fixMojibake,
  normalizeLang,
  parseJsonLoose,
  s,
  uniqStrings,
} from "./shared.js";
import { fallbackClassification } from "./fallback.js";
import { normalizeOutput } from "./normalize.js";
import { ensureOpenAI } from "./openai.js";
import {
  getCommentPolicy,
  getResolvedTenantKey,
  getTenantBannedPhrases,
  getTenantBrandName,
  getTenantBusinessContext,
  getTenantPreferredCta,
  getTenantTone,
  resolveCommentRuntime,
} from "./runtime.js";

export async function classifyComment({
  tenantKey,
  tenant = null,
  runtime = null,
  channel,
  externalUserId,
  externalUsername,
  customerName,
  text,
}) {
  const commentText = fixMojibake(s(text || ""));
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);

  const resolvedRuntime = await resolveCommentRuntime({
    tenantKey: resolvedTenantKey,
    tenant,
    runtime,
  });

  const brandName = getTenantBrandName(resolvedRuntime, resolvedTenantKey);
  const businessContext = getTenantBusinessContext(resolvedRuntime);
  const tone = getTenantTone(resolvedRuntime);
  const preferredCta = getTenantPreferredCta(resolvedRuntime);
  const bannedPhrases = getTenantBannedPhrases(resolvedRuntime);
  const commentPolicy = getCommentPolicy(resolvedRuntime);
  const services = uniqStrings(arr(resolvedRuntime?.services));
  const disabledServices = uniqStrings(arr(resolvedRuntime?.disabledServices));
  const serviceCatalog = arr(resolvedRuntime?.serviceCatalog);

  if (!commentText) {
    return {
      category: "unknown",
      priority: "low",
      sentiment: "neutral",
      requiresHuman: false,
      shouldCreateLead: false,
      shouldReply: false,
      replySuggestion: "",
      shouldPrivateReply: false,
      privateReplySuggestion: "",
      shouldHandoff: false,
      reason: "empty_text",
      engine: "rule",
      meta: {
        tenantKey: resolvedTenantKey,
        brandName,
      },
    };
  }

  const openai = ensureOpenAI();
  if (!openai) {
    return fallbackClassification(commentText, {
      tenantKey: resolvedTenantKey,
      runtime: resolvedRuntime,
    });
  }

  const model = s(cfg?.ai?.openaiModel || "gpt-5") || "gpt-5";
  const max_output_tokens = Number(cfg?.ai?.openaiMaxOutputTokens || 700);

  const prompt = `
You are a strict JSON classifier for PUBLIC social media comments for a tenant brand.

Important:
- This is PUBLIC COMMENT classification, not ongoing DM conversation classification.
- Use the runtime business context as the source of truth.
- Only assume services that exist in enabledServices.
- Do not imply unavailable services from disabledServices.
- If the comment is about a disabled or unavailable service, do not create a lead.
- For disabled or unavailable service interest, prefer:
  1) polite short public clarification
  2) no fake promise
  3) no private handoff unless explicitly justified
- Be conservative with lead creation.
- For clear sales or support intent in public comments, prefer:
  1) a short professional PUBLIC reply
  2) a short professional PRIVATE reply for DM handoff
- Never expose sensitive details publicly.
- Never use staff names, operator names, internal teams, or fake urgency.
- Do not over-classify praise, emojis, or generic reactions as leads.
- Public reply must be short.
- Private reply must be natural and useful.
- Spam or toxic should not get public or private replies.

Return ONLY valid JSON with this exact shape:
{
  "category": "normal",
  "priority": "low",
  "sentiment": "neutral",
  "requiresHuman": false,
  "shouldCreateLead": false,
  "shouldReply": false,
  "replySuggestion": "",
  "shouldPrivateReply": false,
  "privateReplySuggestion": "",
  "shouldHandoff": false,
  "reason": ""
}

Allowed category:
["sales","support","spam","toxic","normal","unknown"]

Allowed priority:
["low","medium","high","urgent"]

Allowed sentiment:
["positive","neutral","negative","mixed"]

Classification rules:
- sales => clear commercial intent, asks about service, pricing, package, demo, contact, availability, quote, proposal
- support => issue or help request needing follow-up or human support
- spam => irrelevant promotion, scam, garbage, obvious bot-like promotion
- toxic => abusive, insulting, profane, hostile
- normal => praise, reaction, generic engagement, non-actionable comment
- unknown => not enough signal or disabled or unavailable service interest

Action rules:
- shouldCreateLead=true only when there is reasonably clear commercial intent for an available service
- shouldReply=true mainly for sales or support when a short public reply is appropriate
- shouldPrivateReply=true mainly for sales or support when DM handoff is appropriate
- shouldHandoff=true for support needing human review, or toxic or risky situations
- for disabled or unavailable service => shouldCreateLead=false
- for spam or toxic => shouldReply=false, shouldPrivateReply=false
- reason must be short snake_case
- if disabled service is mentioned, use reason: "disabled_service_interest"

Style rules:
- public reply max about 140 chars
- private reply max about 280 chars
- avoid banned phrases
- keep tone aligned with tenant runtime
- do not repeat the brand name unless it adds value
- avoid robotic language

Runtime context:
brandName=${JSON.stringify(brandName)}
tenantKey=${JSON.stringify(resolvedTenantKey)}
businessContext=${JSON.stringify(businessContext)}
tone=${JSON.stringify(tone)}
preferredCta=${JSON.stringify(preferredCta)}
bannedPhrases=${JSON.stringify(bannedPhrases)}
commentPolicy=${JSON.stringify(commentPolicy)}
language=${JSON.stringify(normalizeLang(resolvedRuntime?.language, "az"))}
enabledServices=${JSON.stringify(services)}
disabledServices=${JSON.stringify(disabledServices)}
serviceCatalog=${JSON.stringify(
  serviceCatalog.map((item) => ({
    name: item.name,
    enabled: item.enabled,
    visibleInAi: item.visibleInAi,
    keywords: item.keywords,
  }))
)}
channel=${JSON.stringify(s(channel || "instagram"))}
externalUserId=${JSON.stringify(s(externalUserId || ""))}
externalUsername=${JSON.stringify(s(externalUsername || ""))}
customerName=${JSON.stringify(s(customerName || ""))}

Comment:
${JSON.stringify(commentText)}
  `.trim();

  try {
    const resp = await openai.responses.create({
      model,
      text: { format: { type: "text" } },
      max_output_tokens,
      input: [
        {
          role: "system",
          content:
            "Return only valid JSON. No markdown. No explanations. No extra text.",
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
      return fallbackClassification(commentText, {
        tenantKey: resolvedTenantKey,
        runtime: resolvedRuntime,
      });
    }

    return normalizeOutput(parsed, {
      tenantKey: resolvedTenantKey,
      runtime: resolvedRuntime,
    });
  } catch {
    return fallbackClassification(commentText, {
      tenantKey: resolvedTenantKey,
      runtime: resolvedRuntime,
    });
  }
}