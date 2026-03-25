import { deepFix, fixText } from "../../../utils/textFix.js";
import { obj } from "./utils.js";

export function buildTenantRuntimeFromRequest(req, { tenantId, tenantKey }) {
  const bodyTenant = obj(req.body?.tenant);
  const brand = obj(bodyTenant.brand);
  const meta = obj(bodyTenant.meta);

  return deepFix({
    tenantId,
    tenantKey,
    companyName:
      fixText(
        bodyTenant.companyName ||
          bodyTenant.name ||
          brand.companyName ||
          brand.name ||
          meta.companyName ||
          tenantId
      ) || tenantId,
    industryKey:
      fixText(
        bodyTenant.industryKey ||
          bodyTenant.industry ||
          brand.industryKey ||
          brand.industry ||
          meta.industryKey ||
          "generic_business"
      ) || "generic_business",
    defaultLanguage:
      fixText(
        bodyTenant.defaultLanguage ||
          bodyTenant.language ||
          brand.defaultLanguage ||
          brand.language ||
          "az"
      ) || "az",
    outputLanguage:
      fixText(
        bodyTenant.outputLanguage ||
          brand.outputLanguage ||
          bodyTenant.language ||
          brand.language ||
          ""
      ) || "",
    ctaStyle:
      fixText(bodyTenant.ctaStyle || brand.ctaStyle || meta.ctaStyle || "contact") || "contact",
    visualTheme:
      fixText(bodyTenant.visualTheme || brand.visualTheme || "premium_modern") || "premium_modern",
    brand: {
      name: fixText(brand.name),
      companyName: fixText(brand.companyName),
      industryKey: fixText(brand.industryKey),
      defaultLanguage: fixText(brand.defaultLanguage || brand.language),
      outputLanguage: fixText(brand.outputLanguage),
      ctaStyle: fixText(brand.ctaStyle),
      visualTheme: fixText(brand.visualTheme),
      tone: Array.isArray(brand.tone) ? brand.tone : [],
      services: Array.isArray(brand.services) ? brand.services : [],
      audiences: Array.isArray(brand.audiences) ? brand.audiences : [],
      requiredHashtags: Array.isArray(brand.requiredHashtags) ? brand.requiredHashtags : [],
      preferredPresets: Array.isArray(brand.preferredPresets) ? brand.preferredPresets : [],
      visualStyle: obj(brand.visualStyle),
    },
    tone: Array.isArray(bodyTenant.tone) ? bodyTenant.tone : [],
    services: Array.isArray(bodyTenant.services) ? bodyTenant.services : [],
    audiences: Array.isArray(bodyTenant.audiences) ? bodyTenant.audiences : [],
    requiredHashtags: Array.isArray(bodyTenant.requiredHashtags) ? bodyTenant.requiredHashtags : [],
    preferredPresets: Array.isArray(bodyTenant.preferredPresets) ? bodyTenant.preferredPresets : [],
    meta,
  });
}

export function buildDebateExtra(req, { tenantId, formatHint, mode }) {
  const body = req.body || {};
  const extra = obj(body.extra);

  return deepFix({
    ...extra,
    tenantId,
    language: fixText(body.language || extra.language || ""),
    format: fixText(formatHint || body.format || extra.format || ""),
    topicHint: fixText(body.topicHint || extra.topicHint || ""),
    goalHint: fixText(body.goalHint || extra.goalHint || ""),
    feedback: fixText(body.feedback || extra.feedback || ""),
    previousDraft: body.previousDraft || extra.previousDraft || body.draft || extra.draft || null,
    approvedDraft:
      body.approvedDraft ||
      extra.approvedDraft ||
      body.content ||
      extra.content ||
      body.contentPack ||
      extra.contentPack ||
      null,
    assetUrls:
      body.assetUrls ||
      extra.assetUrls ||
      body.generatedAssetUrls ||
      extra.generatedAssetUrls ||
      [],
    platform: fixText(body.platform || extra.platform || "instagram").toLowerCase() || "instagram",
    commentText: fixText(body.commentText || extra.commentText || body.comment || extra.comment || ""),
    authorName: fixText(body.authorName || extra.authorName || body.username || extra.username || ""),
    postTopic: fixText(body.postTopic || extra.postTopic || body.topic || extra.topic || ""),
    market: fixText(body.market || extra.market || ""),
    region: fixText(body.region || extra.region || ""),
    audienceFocus: fixText(body.audienceFocus || extra.audienceFocus || ""),
    categoryFocus: fixText(body.categoryFocus || extra.categoryFocus || ""),
    competitors: Array.isArray(body.competitors)
      ? body.competitors
      : Array.isArray(extra.competitors)
      ? extra.competitors
      : [],
    sourceNotes: fixText(body.sourceNotes || extra.sourceNotes || ""),
    timeWindow: fixText(body.timeWindow || extra.timeWindow || ""),
    goals: Array.isArray(body.goals) ? body.goals : Array.isArray(extra.goals) ? extra.goals : [],
    mode,
  });
}
