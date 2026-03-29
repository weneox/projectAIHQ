import {
  clean,
  packType,
  statusLc,
} from "./utils.js";
import { buildAgentReplayTrace } from "../../../services/agentReplayTrace.js";
import { buildContentBehaviorProfile } from "../../../services/contentBehaviorRuntime.js";

export function canAnalyzeRow(row) {
  const st = statusLc(row?.status);
  return (
    st === "approved" ||
    st === "published" ||
    st === "publish.requested" ||
    st === "asset.ready" ||
    st === "assets.ready" ||
    st === "publish.ready" ||
    st === "draft.approved" ||
    st === "content.approved"
  );
}

export function buildAnalyzeTenant({
  tenantKey,
  tenantId,
  contentPack,
  runtimeBehavior,
}) {
  const language =
    clean(contentPack?.language) ||
    clean(contentPack?.outputLanguage) ||
    "az";
  const behavior = buildContentBehaviorProfile(runtimeBehavior);
  const tone = Array.isArray(contentPack?.tone) && contentPack.tone.length
    ? contentPack.tone
    : behavior.toneProfile
      ? [behavior.toneProfile]
      : [];

  return {
    tenantKey: tenantKey || "default",
    tenantId: tenantId || tenantKey || "default",
    companyName: tenantKey || "This company",
    brand: {
      name: tenantKey || "This company",
      defaultLanguage: language,
      outputLanguage: language,
      industryKey:
        clean(contentPack?.industryKey) ||
        clean(behavior.niche) ||
        "generic_business",
      visualTheme: clean(contentPack?.visualTheme) || "premium_modern",
      tone,
      ctaStyle: clean(contentPack?.cta) || clean(behavior.primaryCta) || "",
      services: Array.isArray(contentPack?.services) ? contentPack.services : [],
      audiences: Array.isArray(contentPack?.audiences) ? contentPack.audiences : [],
      requiredHashtags: Array.isArray(contentPack?.hashtags) ? contentPack.hashtags : [],
    },
    behavior,
  };
}

export function buildAnalyzeExtra({
  row,
  proposal,
  contentPack,
  assetUrls,
  runtime = null,
  runtimeBehavior,
}) {
  const behavior = buildContentBehaviorProfile(runtimeBehavior);

  return {
    approvedDraft: contentPack,
    contentPack,
    assetUrls,
    proposal: proposal || null,
    contentId: row?.id || null,
    proposalId: row?.proposal_id || null,
    caption:
      clean(contentPack?.caption) ||
      clean(contentPack?.copy?.caption) ||
      "",
    cta: clean(contentPack?.cta) || clean(behavior.primaryCta) || "",
    hook: clean(contentPack?.hook) || "",
    slides: Array.isArray(contentPack?.slides) ? contentPack.slides : [],
    visualPlan:
      contentPack?.visualPlan && typeof contentPack?.visualPlan === "object"
        ? contentPack.visualPlan
        : {},
    voiceoverText:
      clean(contentPack?.voiceoverText) ||
      clean(contentPack?.assetBrief?.voiceoverText) ||
      "",
    format: packType(contentPack),
    behavior: {
      niche: behavior.niche,
      conversionGoal: behavior.conversionGoal,
      primaryCta: behavior.primaryCta,
      toneProfile: behavior.toneProfile,
      disallowedClaims: behavior.disallowedClaims,
      handoffTriggers: behavior.handoffTriggers,
      contentAngle: behavior.contentAngle,
      reviewBias: behavior.reviewBias,
    },
    contentBehavior: behavior.contentBehavior,
    mediaBehavior: behavior.mediaBehavior,
    guardrails: {
      disallowedClaims: behavior.disallowedClaims,
      handoffTriggers: behavior.handoffTriggers,
    },
    reviewBias: behavior.reviewBias,
    replayTrace: buildAgentReplayTrace({
      runtime: runtime || runtimeBehavior,
      behavior,
      channel: "content",
      usecase: "content.analyze",
      decisions: {
        cta: {
          selected: clean(contentPack?.cta) || clean(behavior.primaryCta) || "",
          reason: clean(contentPack?.cta) ? "content_pack" : "approved_runtime_behavior",
        },
        qualification: {
          reason: "not_applicable",
        },
      },
    }),
  };
}

export function buildAnalyzeBody(analysis = {}) {
  const score = typeof analysis?.score === "number" ? analysis.score : null;
  const verdict = clean(analysis?.verdict);
  const publishReady = analysis?.publishReady === true;

  if (publishReady && score !== null) {
    return `Analyze tamamlandı. Score: ${score}/10. Verdict: ${verdict || "publish_ready"}.`;
  }

  if (score !== null) {
    return `Analyze tamamlandı. Score: ${score}/10. Revision tövsiyə olunur.`;
  }

  return "Analyze tamamlandı.";
}

export function buildAnalyzeTitle(analysis = {}) {
  const verdict = clean(analysis?.verdict);

  if (verdict === "publish_ready") return "Analyze: publish ready";
  if (verdict === "strong_with_minor_improvements") return "Analyze: strong";
  if (verdict === "needs_targeted_fixes") return "Analyze: fixes needed";
  if (verdict === "needs_major_revision") return "Analyze: major revision";
  return "Analyze completed";
}
