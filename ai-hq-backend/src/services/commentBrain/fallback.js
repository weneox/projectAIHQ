import { cleanText, lower, pickFirstBoolean } from "./shared.js";
import {
  findDisabledServiceMatch,
  getCommentPolicy,
  getResolvedTenantKey,
  getRuntimeServiceKeywords,
  getTenantBrandName,
} from "./runtime.js";
import {
  makePrivateReply,
  makePublicReply,
  makeUnsupportedServicePublicReply,
} from "./replies.js";

export function fallbackClassification(text, { tenantKey, runtime } = {}) {
  const incoming = lower(text);
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const brandName = getTenantBrandName(runtime, resolvedTenantKey);
  const commentPolicy = getCommentPolicy(runtime);

  const autoReplyEnabled =
    pickFirstBoolean(runtime?.autoReplyEnabled) ?? true;

  const createLeadEnabled =
    pickFirstBoolean(runtime?.createLeadEnabled) ?? true;

  const escalateToxic =
    commentPolicy?.escalateToxic !== false;

  const runtimeServiceKeywords = getRuntimeServiceKeywords(runtime);
  const disabledMatch = findDisabledServiceMatch(incoming, runtime);

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

  if (hasAny(spamPatterns)) {
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
    shouldPrivateReply = autoReplyEnabled;
    replySuggestion = shouldReply ? makePublicReply({ kind: "support", runtime }) : "";
    privateReplySuggestion = shouldPrivateReply
      ? makePrivateReply({ kind: "support", runtime })
      : "";
    reason = "support_request";
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
    shouldPrivateReply = autoReplyEnabled;
    replySuggestion = shouldReply ? makePublicReply({ kind: "sales", runtime }) : "";
    privateReplySuggestion = shouldPrivateReply
      ? makePrivateReply({ kind: "sales", runtime })
      : "";
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
    },
  };
}