import {
  clean,
  packType,
  statusLc,
} from "./utils.js";

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

export function buildAnalyzeTenant({ tenantKey, tenantId, contentPack }) {
  const language =
    clean(contentPack?.language) ||
    clean(contentPack?.outputLanguage) ||
    "az";

  return {
    tenantKey: tenantKey || "default",
    tenantId: tenantId || tenantKey || "default",
    companyName: tenantKey || "This company",
    brand: {
      name: tenantKey || "This company",
      defaultLanguage: language,
      outputLanguage: language,
      industryKey: clean(contentPack?.industryKey) || "generic_business",
      visualTheme: clean(contentPack?.visualTheme) || "premium_modern",
      tone: Array.isArray(contentPack?.tone) ? contentPack.tone : [],
      services: Array.isArray(contentPack?.services) ? contentPack.services : [],
      audiences: Array.isArray(contentPack?.audiences) ? contentPack.audiences : [],
      requiredHashtags: Array.isArray(contentPack?.hashtags) ? contentPack.hashtags : [],
    },
  };
}

export function buildAnalyzeExtra({ row, proposal, contentPack, assetUrls }) {
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
    cta: clean(contentPack?.cta) || "",
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