import { cleanText, lower, pickFirstBoolean } from "./shared.js";
import { buildAgentReplayTrace } from "../agentReplayTrace.js";
import {
  getCommentChannelBehavior,
  findDisabledServiceMatch,
  getCommentPolicy,
  getTenantConversionGoal,
  getTenantDisallowedClaims,
  getTenantHandoffTriggers,
  getResolvedTenantKey,
  getRuntimeServiceKeywords,
  getTenantBrandName,
} from "./runtime.js";
import {
  makeBehaviorSafePublicReply,
  makePrivateReply,
  makePublicReply,
  makeUnsupportedServicePublicReply,
} from "./replies.js";

function getBehaviorKeywords(trigger) {
  switch (lower(trigger)) {
    case "human_request":
      return ["human", "person", "operator", "manager", "agent", "someone"];
    case "pricing_complexity":
      return ["custom", "package", "quote", "pricing", "price", "cost"];
    case "medical_risk":
      return ["safe", "risk", "side effect", "complication"];
    default:
      return [safelyHumanize(trigger)];
  }
}

function getDisallowedClaimKeywords(claim) {
  switch (lower(claim)) {
    case "instant_result_guarantees":
      return ["guarantee", "guaranteed", "instant", "100%", "definitely"];
    case "unverified_outcome_promises":
      return ["promise", "promised", "guarantee", "results", "certain result"];
    case "medical_claims":
      return ["cure", "heal", "treat", "medical result"];
    default:
      return [safelyHumanize(claim)];
  }
}

function safelyHumanize(value) {
  return lower(value).replace(/_/g, " ").trim();
}

function includesAny(text, patterns = []) {
  return patterns.some((pattern) => pattern && text.includes(lower(pattern)));
}

export function fallbackClassification(text, { tenantKey, runtime } = {}) {
  const incoming = lower(text);
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const brandName = getTenantBrandName(runtime, resolvedTenantKey);
  const commentPolicy = getCommentPolicy(runtime);
  const commentsBehavior = getCommentChannelBehavior(runtime);
  const handoffTriggers = getTenantHandoffTriggers(runtime);
  const disallowedClaims = getTenantDisallowedClaims(runtime);
  const conversionGoal = lower(getTenantConversionGoal(runtime));

  const autoReplyEnabled =
    pickFirstBoolean(runtime?.autoReplyEnabled) ?? true;

  const createLeadEnabled =
    pickFirstBoolean(runtime?.createLeadEnabled) ?? true;

  const escalateToxic =
    commentPolicy?.escalateToxic !== false;

  const runtimeServiceKeywords = getRuntimeServiceKeywords(runtime);
  const disabledMatch = findDisabledServiceMatch(incoming, runtime);
  const matchedHandoffTrigger = handoffTriggers.find((trigger) =>
    includesAny(incoming, getBehaviorKeywords(trigger))
  );
  const matchedDisallowedClaim = disallowedClaims.find((claim) =>
    includesAny(incoming, getDisallowedClaimKeywords(claim))
  );
  const handoffBias = lower(commentsBehavior?.handoffBias);
  const shouldBiasToHandoff =
    handoffBias === "conditional" || handoffBias === "manual";
  const shouldBiasToDm =
    lower(commentsBehavior?.primaryAction).includes("move_to_dm") ||
    lower(commentsBehavior?.primaryAction).includes("dm");
  const guidedQualification =
    lower(commentsBehavior?.qualificationDepth) === "guided";

  let category = "normal";
  let priority = "low";
  let sentiment = "neutral";
  let requiresHuman = false;
  let shouldCreateLead = false;
  let shouldReply = false;
  let replySuggestion = "";
  let shouldPrivateReply = false;
  let privateReplySuggestion = "";
  let shouldHandoff = false;
  let reason = "generic_comment";

  const salesPatterns = [
    ...runtimeServiceKeywords,
    "qiymət",
    "qiymet",
    "price",
    "cost",
    "neçəyə",
    "neceye",
    "paket",
    "tarif",
    "cəmi neçəyə",
    "nece olur",
    "how much",
    "quote",
    "offer",
    "proposal",
    "xidmət",
    "xidmet",
    "service",
    "website",
    "web site",
    "sayt",
    "chatbot",
    "bot",
    "automation",
    "avtomat",
    "crm",
    "smm",
    "əlaqə",
    "elaqe",
    "contact",
    "number",
    "nomre",
    "nömrə",
    "zəng",
    "zeng",
    "write me",
    "dm me",
    "maraqlıdır",
    "maraqlidir",
    "isteyirem",
    "istəyirəm",
    "bizə də lazımdır",
    "bize de lazimdir",
    "want this",
    "ətraflı",
    "etraflı",
    "details",
    "info",
    "melumat",
    "məlumat",
    "demo",
    "meeting",
    "consultation",
  ];

  const supportPatterns = [
    "kömək",
    "komek",
    "problem",
    "işləmir",
    "islemir",
    "support",
    "help",
    "bug",
    "xəta",
    "xeta",
    "error",
    "issue",
    "alınmır",
    "alinmir",
    "açılmır",
    "acilmir",
    "girilmir",
    "login olmur",
    "niyə işləmir",
    "niye islemir",
    "işləmir?",
  ];

  const spamPatterns = [
    "spam",
    "crypto",
    "bitcoin",
    "forex",
    "casino",
    "bet",
    "1xbet",
    "loan",
    "earn money fast",
    "make money fast",
    "promo page",
    "follow for follow",
    "f4f",
  ];

  const toxicPatterns = [
    "axmaq",
    "stupid",
    "idiot",
    "fuck",
    "sik",
    "dumb",
    "moron",
    "aptal",
    "gerizekalı",
    "gerizekali",
    "loser",
  ];

  const positivePatterns = [
    "əla",
    "ela",
    "super",
    "əhsən",
    "ehsen",
    "great",
    "nice",
    "cool",
    "gözəl",
    "gozel",
    "mükəmməl",
    "mukemmel",
    "perfect",
    "bravo",
  ];

  const negativePatterns = [
    "pis",
    "bad",
    "terrible",
    "awful",
    "problem",
    "işləmir",
    "islemir",
    "xəta",
    "xeta",
    "narazı",
    "narazi",
  ];

  const hasAny = (patterns) => patterns.some((p) => p && incoming.includes(lower(p)));

  if (matchedDisallowedClaim) {
    category = "unknown";
    priority = "high";
    sentiment = "neutral";
    requiresHuman = shouldBiasToHandoff;
    shouldCreateLead = false;
    shouldReply = autoReplyEnabled;
    shouldPrivateReply = false;
    replySuggestion = shouldReply
      ? makeBehaviorSafePublicReply({
          runtime,
          matchedDisallowedClaim,
        })
      : "";
    privateReplySuggestion = "";
    shouldHandoff = shouldBiasToHandoff;
    reason = "disallowed_claim_request";
  } else if (hasAny(spamPatterns)) {
    category = "spam";
    priority = "low";
    sentiment = "negative";
    reason = "spam_like";
  } else if (hasAny(toxicPatterns)) {
    category = "toxic";
    priority = "medium";
    sentiment = "negative";
    requiresHuman = true;
    shouldHandoff = Boolean(escalateToxic);
    reason = "toxic_language";
  } else if (hasAny(supportPatterns)) {
    category = "support";
    priority = "medium";
    sentiment = "negative";
    requiresHuman = true;
    shouldHandoff = true;
    shouldReply = autoReplyEnabled;
    shouldPrivateReply = autoReplyEnabled && shouldBiasToDm;
    replySuggestion = shouldReply ? makePublicReply({ kind: "support", runtime }) : "";
    privateReplySuggestion = shouldPrivateReply
      ? makePrivateReply({ kind: "support", runtime })
      : "";
    reason = "support_request";
  } else if (matchedHandoffTrigger) {
    category = conversionGoal.includes("book") ? "sales" : "support";
    priority = "high";
    sentiment = "neutral";
    requiresHuman = true;
    shouldCreateLead = category === "sales" && Boolean(createLeadEnabled);
    shouldReply = autoReplyEnabled;
    shouldPrivateReply = autoReplyEnabled && shouldBiasToDm;
    replySuggestion = shouldReply
      ? makeBehaviorSafePublicReply({
          runtime,
          matchedHandoffTrigger,
        })
      : "";
    privateReplySuggestion = shouldPrivateReply
      ? makePrivateReply({ kind: category === "sales" ? "sales" : "support", runtime })
      : "";
    shouldHandoff = true;
    reason = "behavior_handoff_trigger";
  } else if (disabledMatch) {
    category = "unknown";
    priority = "low";
    sentiment = "neutral";
    shouldCreateLead = false;
    shouldReply = autoReplyEnabled;
    shouldPrivateReply = false;
    replySuggestion = shouldReply
      ? makeUnsupportedServicePublicReply({ runtime, service: disabledMatch })
      : "";
    privateReplySuggestion = "";
    shouldHandoff = false;
    reason = "disabled_service_interest";
  } else if (hasAny(salesPatterns)) {
    category = "sales";
    priority =
      incoming.includes("qiymət") ||
      incoming.includes("qiymet") ||
      incoming.includes("price") ||
      incoming.includes("how much") ||
      incoming.includes("contact") ||
      incoming.includes("əlaqə") ||
      incoming.includes("elaqe")
        ? "high"
        : "medium";
    shouldCreateLead = Boolean(createLeadEnabled);
    shouldReply = autoReplyEnabled;
    shouldPrivateReply = autoReplyEnabled && shouldBiasToDm;
    replySuggestion = shouldReply ? makePublicReply({ kind: "sales", runtime }) : "";
    privateReplySuggestion = shouldPrivateReply
      ? makePrivateReply({ kind: "sales", runtime })
      : "";
    shouldHandoff = shouldBiasToHandoff && guidedQualification;
    reason =
      priority === "high" ? "pricing_or_contact_interest" : "service_interest";
  } else if (hasAny(positivePatterns)) {
    category = "normal";
    priority = "low";
    sentiment = "positive";
    shouldReply = false;
    shouldPrivateReply = false;
    reason = "positive_reaction";
  }

  if (hasAny(negativePatterns) && sentiment === "neutral") {
    sentiment = "negative";
  }

  return {
    category,
    priority,
    sentiment,
    requiresHuman,
    shouldCreateLead,
    shouldReply,
    replySuggestion: cleanText(replySuggestion, 500),
    shouldPrivateReply,
    privateReplySuggestion: cleanText(privateReplySuggestion, 500),
    shouldHandoff,
    reason,
    engine: "fallback",
    meta: {
      tenantKey: resolvedTenantKey,
      brandName,
      conversionGoal: getTenantConversionGoal(runtime),
      channelBehaviorComments: commentsBehavior,
      matchedHandoffTrigger: matchedHandoffTrigger || "",
      matchedDisallowedClaim: matchedDisallowedClaim || "",
      replayTrace: buildAgentReplayTrace({
        runtime,
        channel: "comments",
        usecase: "meta.comment_reply",
        decisions: {
          cta: {
            reason: "approved_runtime_behavior",
          },
          qualification: {
            mode: commentsBehavior?.qualificationDepth,
          },
          handoff: {
            trigger: matchedHandoffTrigger || "",
            reason: matchedHandoffTrigger ? "behavior_handoff_trigger" : "",
          },
          claimBlock: {
            blocked: Boolean(matchedDisallowedClaim),
            claim: matchedDisallowedClaim || "",
            reason: matchedDisallowedClaim ? "disallowed_claim_request" : "",
          },
        },
        evaluation: {
          outcome: shouldHandoff
            ? "handoff_recommended"
            : shouldPrivateReply
              ? "private_reply_recommended"
              : shouldReply
                ? "public_reply_recommended"
                : "no_reply_recommended",
          ctaDirection: shouldPrivateReply
            ? "private_reply"
            : shouldReply
              ? "public_reply"
              : "none",
          qualification: {
            status: guidedQualification ? "guided" : "none",
          },
          handoff: {
            status: shouldHandoff ? "recommended" : "clear",
            trigger: matchedHandoffTrigger || "",
            reason: matchedHandoffTrigger ? "behavior_handoff_trigger" : "",
          },
          claimBlock: {
            status: matchedDisallowedClaim ? "blocked" : "clear",
            blocked: Boolean(matchedDisallowedClaim),
            claim: matchedDisallowedClaim || "",
            reason: matchedDisallowedClaim ? "disallowed_claim_request" : "",
          },
        },
      }),
    },
  };
}
