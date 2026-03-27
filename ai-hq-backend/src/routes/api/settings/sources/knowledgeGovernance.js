import { dbUpsertTenantBusinessFact } from "../../../../db/helpers/tenantBusinessBrain.js";
import { auditSafe } from "../utils.js";
import {
  bad,
  lower,
  n,
  normalizeApprovePayload,
  obj,
  ok,
  pickUserId,
  pickUserName,
  s,
  hasDb,
} from "./shared.js";

function pickApprovedCategory(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return lower(knowledge.category || candidate.category);
}

function pickApprovedItemKey(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return lower(knowledge.item_key || candidate.item_key);
}

function pickApprovedTitle(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  return (
    s(knowledge.title) ||
    s(candidate.title) ||
    s(knowledge.item_key) ||
    s(candidate.item_key) ||
    "Knowledge Fact"
  );
}

function pickApprovedValueText(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};

  return (
    s(knowledge.value_text) ||
    s(candidate.value_text) ||
    s(knowledge.normalized_text) ||
    s(candidate.normalized_text) ||
    s(knowledge.title) ||
    s(candidate.title)
  );
}

function pickApprovedValueJson(result = {}) {
  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};

  if (knowledge.value_json && typeof knowledge.value_json === "object") {
    return knowledge.value_json;
  }
  if (candidate.value_json && typeof candidate.value_json === "object") {
    return candidate.value_json;
  }
  if (knowledge.normalized_json && typeof knowledge.normalized_json === "object") {
    return knowledge.normalized_json;
  }
  if (candidate.normalized_json && typeof candidate.normalized_json === "object") {
    return candidate.normalized_json;
  }
  return {};
}

function normalizeFactGroupFromCategory(category = "") {
  const c = lower(category);

  if (["summary", "company", "brand", "audience", "support", "cta", "claim", "tone"].includes(c)) {
    return "general";
  }
  if (["pricing", "pricing_policy", "offer"].includes(c)) {
    return "pricing";
  }
  if (["policy", "legal"].includes(c)) {
    return "policy";
  }
  if (["contact", "social_link", "channel", "booking", "handoff"].includes(c)) {
    return "contact";
  }
  if (["location", "hours"].includes(c)) {
    return "location";
  }
  if (["service", "product", "faq", "objection", "capability"].includes(c)) {
    return "services";
  }

  return "general";
}

function compactText(x = "", max = 300) {
  const v = s(x).replace(/\s+/g, " ").trim();
  if (!v) return "";
  if (v.length <= max) return v;
  return `${v.slice(0, max - 3).trim()}...`;
}

function safeKeyPart(x = "", fallback = "item", max = 80) {
  const v = lower(x)
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);

  return v || fallback;
}

function normalizeFactKeyFromKnowledge(result = {}) {
  const category = pickApprovedCategory(result) || "general";
  const itemKey = safeKeyPart(pickApprovedItemKey(result) || "item", "item", 80);
  return `${category}_${itemKey}`.slice(0, 120);
}

function shouldPromoteKnowledgeToBusinessFact(result = {}) {
  const category = pickApprovedCategory(result);

  return [
    "company",
    "summary",
    "service",
    "product",
    "pricing",
    "pricing_policy",
    "faq",
    "contact",
    "location",
    "hours",
    "tone",
    "brand",
    "policy",
    "cta",
    "social_link",
    "support",
    "booking",
    "handoff",
    "website_title",
    "website_summary",
  ].includes(category);
}

function normalizePromotionCategory(result = {}) {
  const raw = pickApprovedCategory(result);
  if (raw === "website_title") return "company";
  if (raw === "website_summary") return "summary";
  return raw || "summary";
}

function escapeRegex(text = "") {
  return s(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCompareText(text = "") {
  return lower(text)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSet(text = "") {
  return new Set(
    normalizeCompareText(text)
      .split(" ")
      .map((x) => x.trim())
      .filter((x) => x.length >= 3)
  );
}

function jaccardSimilarity(a = "", b = "") {
  const sa = tokenizeSet(a);
  const sb = tokenizeSet(b);

  if (!sa.size || !sb.size) return 0;

  let intersection = 0;
  for (const w of sa) {
    if (sb.has(w)) intersection += 1;
  }

  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 0;
}

function isNearDuplicateText(a = "", b = "") {
  const aa = compactText(a, 1800);
  const bb = compactText(b, 1800);
  if (!aa || !bb) return false;

  const na = normalizeCompareText(aa);
  const nb = normalizeCompareText(bb);
  if (!na || !nb) return false;
  if (na === nb) return true;

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    if (shorter >= 24 && shorter / longer >= 0.72) return true;
  }

  return jaccardSimilarity(aa, bb) >= 0.86;
}

function sentenceSplit(text = "") {
  return s(text)
    .split(/(?<=[.!?])\s+/)
    .map((x) => compactText(x, 800))
    .filter(Boolean);
}

function dedupeSentences(text = "", max = 1600) {
  const out = [];
  const seen = new Set();

  for (const part of sentenceSplit(text)) {
    const key = normalizeCompareText(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }

  return compactText(out.join(" "), max);
}

function pickPossibleBrandFromText(text = "") {
  const x = compactText(text, 300);
  const m1 = x.match(/^([A-Z][A-Z0-9 .&_-]{1,40})\s+is\b/);
  if (m1?.[1]) return s(m1[1]);
  const m2 = x.match(/\s+-\s+([A-Z][A-Z0-9 .&_-]{1,40})$/);
  if (m2?.[1]) return s(m2[1]);
  return "";
}

function getBrandHint(result = {}) {
  const valueJson = pickApprovedValueJson(result);
  return (
    s(valueJson.brand) ||
    s(valueJson.company) ||
    s(valueJson.company_name) ||
    s(valueJson.name) ||
    s(valueJson.title) ||
    s(pickApprovedTitle(result))
  );
}

function cleanRepeatedBranding(text = "", brandHint = "") {
  let x = compactText(text, 2400);
  if (!x) return "";

  x = x.replace(/\s*[-:]\s*/g, " - ").replace(/\s{2,}/g, " ").trim();
  const brand = s(brandHint);
  if (brand) {
    const escaped = escapeRegex(brand);
    x = x
      .replace(new RegExp(`^${escaped}\\s*[-:]\\s*`, "i"), "")
      .replace(new RegExp(`\\s*[-:]\\s*${escaped}$`, "i"), "")
      .trim();
  }

  return x
    .replace(/^([A-Za-z0-9& ._]{2,40})\s+-\s+\1\s+-\s+/i, "$1 - ")
    .replace(/\b([A-Za-z0-9&._]{2,40})\s+-\s+\1\b/gi, "$1")
    .trim();
}

function stripTrailingBrandTail(text = "", brandHint = "") {
  let x = compactText(text, 2000);
  if (!x) return "";

  if (brandHint) {
    const escaped = escapeRegex(brandHint);
    x = x
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "i"), "")
      .replace(new RegExp(`\\s+-\\s+${escaped}$`, "i"), "")
      .trim();
  }

  return x
    .replace(/\s+-\s+[A-Z][A-Z0-9 .&_-]{1,40}$/, "")
    .replace(/\s+-\s+[A-Z][A-Z0-9 .&_-]{1,40}$/, "")
    .trim();
}

function cleanSummaryText(text = "", result = {}) {
  const fallbackBrand = pickPossibleBrandFromText(text);
  const brandHint = getBrandHint(result) || fallbackBrand;

  let x = cleanRepeatedBranding(text, brandHint);
  x = x
    .replace(/\b(home|about|services|contact)\b\s*-?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\bAI\s+-\s+powered\b/gi, "AI-powered")
    .replace(/\bAI\s*-\s*powered\b/gi, "AI-powered")
    .replace(/\b([A-Za-z]+)\s+-\s+powered\b/g, "$1-powered")
    .trim();

  return compactText(dedupeSentences(stripTrailingBrandTail(x, brandHint), 1400), 1400);
}

function normalizeSummaryPromotionText(text = "", result = {}) {
  let x = cleanSummaryText(text, result)
    .replace(/^[-:,;\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  x = dedupeSentences(x, 1400);
  const parts = x
    .split(/\s+-\s+/)
    .map((p) => compactText(p, 800))
    .filter(Boolean);

  const dedupedParts = [];
  for (const part of parts) {
    if (!dedupedParts.some((p) => isNearDuplicateText(p, part))) {
      dedupedParts.push(part);
    }
  }

  return compactText(dedupeSentences(dedupedParts.join(" - "), 1400), 1400);
}

function isVeryWeakText(text = "") {
  const x = compactText(text, 240);
  if (!x || x.length < 3) return true;
  return [
    "home",
    "about",
    "services",
    "service",
    "contact",
    "read more",
    "learn more",
    "more",
    "details",
    "website title",
    "knowledge fact",
  ].includes(lower(x));
}

function isLikelyOnlyBrandName(text = "", result = {}) {
  const x = compactText(text, 120);
  const brandHint = compactText(getBrandHint(result), 120);
  if (!x || !brandHint) return false;
  return normalizeCompareText(x) === normalizeCompareText(brandHint);
}

function isWeakCompanyFact(result = {}) {
  const category = normalizePromotionCategory(result);
  const text = compactText(pickApprovedValueText(result), 200);
  const title = compactText(pickApprovedTitle(result), 120);
  if (category !== "company") return false;
  if (isVeryWeakText(text) && isVeryWeakText(title)) return true;
  if (isLikelyOnlyBrandName(text || title, result)) {
    return ["website_title", "about_page"].includes(pickApprovedItemKey(result));
  }
  return false;
}

function deriveBetterFactTitle(result = {}) {
  const category = normalizePromotionCategory(result);
  const cleanedTitle = cleanRepeatedBranding(compactText(pickApprovedTitle(result), 180), getBrandHint(result));
  const itemKey = safeKeyPart(pickApprovedItemKey(result) || "item", "item", 60);

  if (category === "summary") {
    const key = pickApprovedItemKey(result);
    if (key.includes("short")) return "Company Summary";
    if (key.includes("long")) return "Company Overview";
    return "Company Summary";
  }

  if (category === "company" && isLikelyOnlyBrandName(cleanedTitle, result)) {
    return "Company Name";
  }

  if (cleanedTitle && !isVeryWeakText(cleanedTitle)) return cleanedTitle;

  const labelMap = {
    company: "Company",
    summary: "Summary",
    service: "Service",
    product: "Product",
    pricing: "Pricing",
    pricing_policy: "Pricing Policy",
    faq: "FAQ",
    contact: "Contact",
    location: "Location",
    hours: "Working Hours",
    tone: "Tone",
    brand: "Brand",
    policy: "Policy",
    cta: "CTA",
    social_link: "Social Link",
    support: "Support",
    booking: "Booking",
    handoff: "Handoff",
  };

  return `${labelMap[category] || "Knowledge"} ${itemKey}`;
}

function deriveBetterValueText(result = {}) {
  const category = normalizePromotionCategory(result);
  const valueJson = pickApprovedValueJson(result);
  const rawText = compactText(pickApprovedValueText(result), 1600);

  if (category === "summary") {
    return normalizeSummaryPromotionText(rawText || valueJson.summary || valueJson.text || valueJson.promoted_text || "", result);
  }
  if (category === "company") {
    const companyName = compactText(valueJson.company_name || valueJson.name || valueJson.title || "", 180) || compactText(rawText, 180);
    if (isLikelyOnlyBrandName(companyName, result)) return companyName;
    return cleanSummaryText(rawText || valueJson.text || valueJson.summary || valueJson.company_name || valueJson.name || "", result);
  }
  if (category === "faq") {
    const q = compactText(valueJson.question || "", 240);
    const a = compactText(valueJson.answer || "", 700);
    if (q && a) return `${q} - ${a}`;
    if (q) return q;
    return cleanSummaryText(rawText, result);
  }
  if (category === "pricing_policy") return cleanSummaryText(valueJson.policy || valueJson.text || rawText || "", result);
  if (category === "pricing") return cleanSummaryText(valueJson.text || valueJson.price || valueJson.label || valueJson.summary || rawText || "", result);
  if (category === "service") return compactText(valueJson.service || valueJson.name || valueJson.text || rawText || "", 320);
  if (category === "product") return compactText(valueJson.product || valueJson.name || valueJson.text || rawText || "", 320);
  if (category === "contact") return compactText(valueJson.email || valueJson.phone || valueJson.url || valueJson.contact || rawText || "", 500);
  if (category === "location") return compactText(valueJson.address || valueJson.location || valueJson.text || rawText || "", 700);
  if (category === "hours") return compactText(valueJson.hours || valueJson.text || rawText || "", 400);
  if (category === "cta") return compactText(valueJson.label || valueJson.text || valueJson.url || rawText || "", 500);
  if (category === "booking") return compactText(valueJson.url || valueJson.text || rawText || "", 500);
  if (category === "social_link") return compactText(valueJson.url || rawText || "", 500);
  if (category === "support") return compactText(valueJson.support_mode || valueJson.text || rawText || "", 600);
  if (category === "brand" || category === "tone") {
    return cleanSummaryText(valueJson.summary || valueJson.text || valueJson.title || valueJson.name || rawText || "", result);
  }

  return cleanSummaryText(rawText, result);
}

function deriveBetterValueJson(result = {}) {
  const category = normalizePromotionCategory(result);
  const source = pickApprovedValueJson(result);
  const text = deriveBetterValueText(result);
  const title = deriveBetterFactTitle(result);

  if (source && Object.keys(source).length) {
    return {
      ...source,
      promoted_category: category,
      promoted_title: title,
      promoted_text: text,
    };
  }

  return {
    promoted_category: category,
    promoted_title: title,
    promoted_text: text,
  };
}

function isMeaningfulPromotionPayload({ title = "", valueText = "", valueJson = {} } = {}) {
  const t = compactText(title, 180);
  const v = compactText(valueText, 1400);
  const keys = Object.keys(obj(valueJson, {}));
  return v.length >= 5 || t.length >= 5 || keys.length > 0;
}

function shouldBlockPromotion(result = {}) {
  const category = normalizePromotionCategory(result);
  const text = deriveBetterValueText(result);
  const title = deriveBetterFactTitle(result);
  const itemKey = pickApprovedItemKey(result);

  if (isVeryWeakText(text) && isVeryWeakText(title)) return true;
  if (category === "company" && isWeakCompanyFact(result)) return true;
  if (category === "summary" && compactText(text, 1400).length < 24) return true;
  if (pickApprovedCategory(result) === "website_title") return true;

  if (category === "summary" && itemKey.includes("long")) {
    const valueJson = pickApprovedValueJson(result);
    const rawSummary = compactText(
      valueJson.summary || valueJson.text || valueJson.promoted_text || pickApprovedValueText(result),
      1600
    );
    const cleaned = normalizeSummaryPromotionText(rawSummary, result);
    if (!cleaned || cleaned.length < 40) return true;
  }

  return false;
}

async function maybePromoteApprovedKnowledgeToBusinessFact(db, tenant, result = {}) {
  if (!hasDb(db)) return null;
  if (!tenant?.tenant_id) return null;
  if (!shouldPromoteKnowledgeToBusinessFact(result)) return null;
  if (shouldBlockPromotion(result)) return null;

  const knowledge = result?.knowledge || {};
  const candidate = result?.candidate || {};
  const normalizedCategory = normalizePromotionCategory(result);
  const title = deriveBetterFactTitle(result);
  const valueText = deriveBetterValueText(result);
  const valueJson = deriveBetterValueJson(result);
  const itemKey = pickApprovedItemKey(result);

  if (!isMeaningfulPromotionPayload({ title, valueText, valueJson })) {
    return null;
  }

  if (normalizedCategory === "summary" && itemKey.includes("long")) {
    const shortFactKey = `${normalizedCategory}_company_summary_short`;
    let existingShort = null;

    try {
      const q = await db.query(
        `
        select value_text
        from tenant_business_facts
        where tenant_id = $1
          and fact_key = $2
        limit 1
        `,
        [tenant.tenant_id, shortFactKey]
      );
      existingShort = s(q?.rows?.[0]?.value_text);
    } catch {
      existingShort = "";
    }

    if (existingShort && isNearDuplicateText(existingShort, valueText)) {
      return null;
    }
  }

  return dbUpsertTenantBusinessFact(db, tenant.tenant_id, {
    fact_key: normalizeFactKeyFromKnowledge({
      ...result,
      knowledge: { ...knowledge, category: normalizedCategory },
      candidate: { ...candidate, category: normalizedCategory },
    }),
    fact_group: normalizeFactGroupFromCategory(normalizedCategory),
    category: normalizedCategory,
    title,
    value_text: valueText,
    value_json: valueJson,
    language: s(knowledge.language || candidate.language || "az") || "az",
    priority: Number.isFinite(Number(knowledge.priority))
      ? Number(knowledge.priority)
      : Number.isFinite(Number(candidate.priority))
        ? Number(candidate.priority)
        : 100,
    enabled: true,
    source_type: "manual",
    source_ref:
      s(knowledge.id) ||
      s(candidate.id) ||
      s(knowledge.canonical_key) ||
      s(candidate.canonical_key),
    meta: {
      knowledgeItemId: s(knowledge.id),
      candidateId: s(candidate.id),
      knowledgeCategory: normalizedCategory,
      knowledgeItemKey: s(knowledge.item_key || candidate.item_key),
      canonicalKey: s(knowledge.canonical_key || candidate.canonical_key),
      promotedFrom: "settings.sources.approve",
      originalCategory: pickApprovedCategory(result),
    },
  });
}

export function registerSettingsSourceKnowledgeRoutes(router, context) {
  const {
    db,
    getKnowledge,
    requireSettingsWriteRole,
    resolveTenantOr400,
  } = context;

  router.get("/knowledge/review-queue", async (req, res) => {
    try {
      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const items = await knowledge.listReviewQueue({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        category: s(req.query?.category),
        limit: n(req.query?.limit, 100),
        offset: n(req.query?.offset, 0),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        items,
        count: items.length,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to load review queue");
    }
  });

  router.post("/knowledge/:candidateId/approve", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const candidateId = s(req.params.candidateId);
      if (!candidateId) return bad(res, 400, "candidate id is required");

      const candidate = await knowledge.getCandidateById(candidateId);
      if (!candidate || candidate.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "candidate not found");
      }

      const by = pickUserId(req);
      const reviewerName = pickUserName(req);
      const payload = normalizeApprovePayload(req.body);

      const result = await knowledge.approveCandidate(candidateId, {
        ...payload,
        reviewerType: "human",
        reviewerId: by,
        reviewerName,
        createdBy: by,
        approvedBy: by,
        updatedBy: by,
      });

      const promotedBusinessFact = await maybePromoteApprovedKnowledgeToBusinessFact(
        db,
        tenant,
        result
      );

      await knowledge.refreshChannelCapabilitiesFromSources({
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        approvedBy: by,
      });

      await auditSafe(db, req, tenant, "settings.knowledge.approved", "tenant_knowledge_candidate", candidateId, {
        category: s(result?.knowledge?.category || result?.candidate?.category),
        itemKey: s(result?.knowledge?.item_key || result?.candidate?.item_key),
        knowledgeItemId: s(result?.knowledge?.id),
        approvalId: s(result?.approval?.id),
        promotedBusinessFactId: s(promotedBusinessFact?.id),
        reviewerName,
      });

      return ok(res, {
        ...result,
        promoted: Boolean(promotedBusinessFact),
        promotedBusinessFact: promotedBusinessFact || null,
      });
    } catch (err) {
      return bad(res, 500, err.message || "failed to approve candidate");
    }
  });

  router.post("/knowledge/:candidateId/reject", async (req, res) => {
    try {
      const role = requireSettingsWriteRole(req, res);
      if (!role) return;

      const tenant = await resolveTenantOr400(req, res);
      if (!tenant) return;

      const knowledge = getKnowledge();
      if (!knowledge) return bad(res, 503, "db disabled", { dbDisabled: true });

      const candidateId = s(req.params.candidateId);
      if (!candidateId) return bad(res, 400, "candidate id is required");

      const candidate = await knowledge.getCandidateById(candidateId);
      if (!candidate || candidate.tenant_id !== tenant.tenant_id) {
        return bad(res, 404, "candidate not found");
      }

      const by = pickUserId(req);
      const reviewerName = pickUserName(req);

      const result = await knowledge.rejectCandidate(candidateId, {
        reviewerType: "human",
        reviewerId: by,
        reviewerName,
        reason: s(req.body?.reason),
        metadataJson: obj(req.body?.metadataJson || req.body?.metadata || {}, {}),
      });

      await auditSafe(db, req, tenant, "settings.knowledge.rejected", "tenant_knowledge_candidate", candidateId, {
        category: s(candidate?.category),
        itemKey: s(candidate?.item_key),
        approvalId: s(result?.approval?.id),
        reviewerName,
        reason: s(req.body?.reason),
      });

      return ok(res, result);
    } catch (err) {
      return bad(res, 500, err.message || "failed to reject candidate");
    }
  });
}
