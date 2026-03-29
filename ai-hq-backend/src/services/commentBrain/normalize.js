import {
  cleanReason,
  cleanText,
  normalizeCategory,
  normalizePriority,
  normalizeSentiment,
  pickFirstBoolean,
} from "./shared.js";
import {
  getCommentChannelBehavior,
  getCommentPolicy,
  getTenantConversionGoal,
  getTenantDisallowedClaims,
  getResolvedTenantKey,
  getTenantBrandName,
  getTenantHandoffTriggers,
  getTenantPrimaryCta,
  getTenantToneProfile,
} from "./runtime.js";
import {
  applyBannedPhraseGuard,
  makeBehaviorSafePublicReply,
  makePrivateReply,
  makePublicReply,
  makeUnsupportedServicePublicReply,
} from "./replies.js";

export function normalizeOutput(parsed, { tenantKey, runtime } = {}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const brandName = getTenantBrandName(runtime, resolvedTenantKey);

  let category = normalizeCategory(parsed?.category);
  let priority = normalizePriority(parsed?.priority);
  let sentiment = normalizeSentiment(parsed?.sentiment);
  let requiresHuman = Boolean(parsed?.requiresHuman);
  let shouldCreateLead = Boolean(parsed?.shouldCreateLead);
  let shouldReply = Boolean(parsed?.shouldReply);
  let replySuggestion = cleanText(parsed?.replySuggestion || "", 500);
  let shouldPrivateReply = Boolean(parsed?.shouldPrivateReply);
  let privateReplySuggestion = cleanText(parsed?.privateReplySuggestion || "", 500);
  let shouldHandoff = Boolean(parsed?.shouldHandoff);
  let reason = cleanReason(parsed?.reason || "ai_classified");

  const autoReplyEnabled =
    pickFirstBoolean(runtime?.autoReplyEnabled) ?? true;

  const createLeadEnabled =
    pickFirstBoolean(runtime?.createLeadEnabled) ?? true;

  const commentPolicy = getCommentPolicy(runtime);
  const commentsBehavior = getCommentChannelBehavior(runtime);
  const escalateToxic =
    commentPolicy?.escalateToxic !== false;
  const prefersDm =
    String(commentsBehavior?.primaryAction || "").toLowerCase().includes("dm");
  const behaviorHandoffBias = String(commentsBehavior?.handoffBias || "").toLowerCase();

  const disabledServiceReason = reason.startsWith("disabled_service");
  const disallowedClaimReason =
    reason.includes("disallowed_claim") || reason.includes("restricted_claim");
  const handoffTriggerReason = reason.includes("handoff_trigger");

  if ((category === "sales" || category === "support") && autoReplyEnabled && !shouldReply) {
    shouldReply = true;
  }

  if (
    (category === "sales" || category === "support") &&
    autoReplyEnabled &&
    prefersDm &&
    !shouldPrivateReply
  ) {
    shouldPrivateReply = true;
  }

  if (category === "sales" && createLeadEnabled && !disabledServiceReason) {
    shouldCreateLead = true;
  }

  if (category === "sales" && !replySuggestion && !disabledServiceReason) {
    replySuggestion = makePublicReply({ kind: "sales", runtime });
  }

  if (category === "sales" && !privateReplySuggestion && !disabledServiceReason) {
    privateReplySuggestion = makePrivateReply({ kind: "sales", runtime });
  }

  if (category === "support" && !replySuggestion) {
    replySuggestion = makePublicReply({ kind: "support", runtime });
  }

  if (category === "support" && !privateReplySuggestion) {
    privateReplySuggestion = makePrivateReply({ kind: "support", runtime });
  }

  if (category === "support") {
    requiresHuman = true;
    shouldHandoff = true;
  }

  if (disabledServiceReason) {
    category = "unknown";
    shouldCreateLead = false;
    shouldPrivateReply = false;
    privateReplySuggestion = "";
    shouldHandoff = false;
    shouldReply = autoReplyEnabled;
    if (!replySuggestion) {
      replySuggestion = makeUnsupportedServicePublicReply({ runtime });
    }
  }

  if (disallowedClaimReason) {
    category = "unknown";
    shouldCreateLead = false;
    shouldPrivateReply = false;
    privateReplySuggestion = "";
    shouldHandoff =
      shouldHandoff ||
      behaviorHandoffBias === "conditional" ||
      behaviorHandoffBias === "manual";
    shouldReply = autoReplyEnabled;
    if (!replySuggestion) {
      replySuggestion = makeBehaviorSafePublicReply({
        runtime,
        matchedDisallowedClaim: "policy_guardrail",
      });
    }
  }

  if (handoffTriggerReason) {
    requiresHuman = true;
    shouldHandoff = true;
    if (!replySuggestion) {
      replySuggestion = makeBehaviorSafePublicReply({
        runtime,
        matchedHandoffTrigger: "policy_trigger",
      });
    }
  }

  if (category === "toxic") {
    requiresHuman = true;
    shouldReply = false;
    shouldPrivateReply = false;
    replySuggestion = "";
    privateReplySuggestion = "";
    shouldHandoff = Boolean(escalateToxic);
  }

  if (category === "spam") {
    shouldReply = false;
    shouldPrivateReply = false;
    replySuggestion = "";
    privateReplySuggestion = "";
    shouldCreateLead = false;
    shouldHandoff = false;
  }

  replySuggestion = applyBannedPhraseGuard(replySuggestion, runtime);
  privateReplySuggestion = applyBannedPhraseGuard(privateReplySuggestion, runtime);

  return {
    category,
    priority,
    sentiment,
    requiresHuman,
    shouldCreateLead,
    shouldReply: autoReplyEnabled ? shouldReply : false,
    replySuggestion: autoReplyEnabled ? replySuggestion : "",
    shouldPrivateReply: autoReplyEnabled ? shouldPrivateReply : false,
    privateReplySuggestion: autoReplyEnabled ? privateReplySuggestion : "",
    shouldHandoff,
    reason,
    engine: "ai",
    meta: {
      tenantKey: resolvedTenantKey,
      brandName,
      conversionGoal: getTenantConversionGoal(runtime),
      primaryCta: getTenantPrimaryCta(runtime),
      toneProfile: getTenantToneProfile(runtime),
      handoffTriggers: getTenantHandoffTriggers(runtime),
      disallowedClaims: getTenantDisallowedClaims(runtime),
      channelBehaviorComments: commentsBehavior,
    },
  };
}
