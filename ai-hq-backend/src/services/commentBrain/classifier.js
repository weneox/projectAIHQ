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
import { buildPromptBundle } from "../promptBundle.js";
import {
  getCommentChannelBehavior,
  getCommentPolicy,
  getTenantConversionGoal,
  getTenantDisallowedClaims,
  getTenantHandoffTriggers,
  getResolvedTenantKey,
  getTenantBannedPhrases,
  getTenantBrandName,
  getTenantBusinessContext,
  getTenantPrimaryCta,
  getTenantPreferredCta,
  getTenantTone,
  getTenantToneProfile,
  resolveCommentRuntime,
} from "./runtime.js";

export function buildCommentClassifierPrompt({
  tenantKey,
  resolvedRuntime,
  channel,
  externalUserId,
  externalUsername,
  customerName,
  commentText,
}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const brandName = getTenantBrandName(resolvedRuntime, resolvedTenantKey);
  const businessContext = getTenantBusinessContext(resolvedRuntime);
  const tone = getTenantTone(resolvedRuntime);
  const toneProfile = getTenantToneProfile(resolvedRuntime);
  const preferredCta = getTenantPreferredCta(resolvedRuntime);
  const primaryCta = getTenantPrimaryCta(resolvedRuntime);
  const conversionGoal = getTenantConversionGoal(resolvedRuntime);
  const bannedPhrases = getTenantBannedPhrases(resolvedRuntime);
  const commentPolicy = getCommentPolicy(resolvedRuntime);
  const commentsBehavior = getCommentChannelBehavior(resolvedRuntime);
  const handoffTriggers = getTenantHandoffTriggers(resolvedRuntime);
  const disallowedClaims = getTenantDisallowedClaims(resolvedRuntime);
  const services = uniqStrings(arr(resolvedRuntime?.services));
  const disabledServices = uniqStrings(arr(resolvedRuntime?.disabledServices));
  const serviceCatalog = arr(resolvedRuntime?.serviceCatalog);

  const promptBundle = buildPromptBundle("comment.classify", {
    tenant: {
      tenantKey: resolvedTenantKey,
      tenantId: resolvedTenantKey,
      companyName: brandName,
      brandName,
      industryKey: s(
        resolvedRuntime?.industry ||
          resolvedRuntime?.profile?.industryKey ||
          "generic_business"
      ),
      outputLanguage: normalizeLang(resolvedRuntime?.language, "az"),
      toneText: tone,
      services,
      servicesText: services.join(", "),
      businessContext,
      behavior: {
        niche: s(
          resolvedRuntime?.industry ||
            resolvedRuntime?.profile?.industryKey ||
            "generic_business"
        ),
        conversionGoal,
        primaryCta,
        toneProfile,
        disallowedClaims,
        handoffTriggers,
        channelBehavior: {
          comments: commentsBehavior,
        },
      },
      ai_policy: {
        commentPolicy,
      },
    },
    extra: {
      channel: "comments",
      surface: "comments",
      policy: {
        humanReviewRequired: commentPolicy?.humanReviewRequired === true,
      },
      outputContract: {
        mode: "json",
        strictJson: true,
        hint: "Return the exact classification JSON shape only.",
      },
    },
  });

  return `${promptBundle.fullPrompt}

COMMENT CLASSIFICATION RULES:
- This is PUBLIC COMMENT classification, not ongoing DM conversation classification.
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
toneProfile=${JSON.stringify(toneProfile)}
preferredCta=${JSON.stringify(preferredCta)}
primaryCta=${JSON.stringify(primaryCta)}
conversionGoal=${JSON.stringify(conversionGoal)}
bannedPhrases=${JSON.stringify(bannedPhrases)}
commentPolicy=${JSON.stringify(commentPolicy)}
commentsBehavior=${JSON.stringify(commentsBehavior)}
handoffTriggers=${JSON.stringify(handoffTriggers)}
disallowedClaims=${JSON.stringify(disallowedClaims)}
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
${JSON.stringify(commentText)}`.trim();
}

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

  const commentsBehavior = getCommentChannelBehavior(resolvedRuntime);
  const handoffTriggers = getTenantHandoffTriggers(resolvedRuntime);
  const disallowedClaims = getTenantDisallowedClaims(resolvedRuntime);
  const brandName = getTenantBrandName(resolvedRuntime, resolvedTenantKey);
  const toneProfile = getTenantToneProfile(resolvedRuntime);
  const primaryCta = getTenantPrimaryCta(resolvedRuntime);
  const conversionGoal = getTenantConversionGoal(resolvedRuntime);

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
        conversionGoal,
        primaryCta,
        toneProfile,
        handoffTriggers,
        disallowedClaims,
        channelBehaviorComments: commentsBehavior,
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

  const prompt = buildCommentClassifierPrompt({
    tenantKey: resolvedTenantKey,
    resolvedRuntime,
    channel,
    externalUserId,
    externalUsername,
    customerName,
    commentText,
  });

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
