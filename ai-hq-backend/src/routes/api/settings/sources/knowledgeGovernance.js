import { dbUpsertTenantBusinessFact } from "../../../../db/helpers/tenantBusinessBrain.js";
import {
  buildCandidateImpact,
  summarizeEvidenceGovernance,
} from "../../../../services/sourceFusion/governance.js";
import { classifyApprovalPolicy } from "../../../../services/sourceFusion/approvalPolicy.js";
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

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function uniqStrings(items = []) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))];
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

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

function canWriteKnowledgeReview(viewerRole = "") {
  return ["owner", "admin"].includes(lower(viewerRole));
}

function canSatisfyRequiredRole(viewerRole = "", requiredRole = "") {
  const role = lower(viewerRole);
  const requirement = lower(requiredRole);

  if (!requirement || requirement === "system") return canWriteKnowledgeReview(role);
  if (requirement === "reviewer") return canWriteKnowledgeReview(role);
  if (requirement === "admin") return role === "admin" || role === "owner";
  if (requirement === "owner") return role === "owner";
  if (requirement === "admin_and_owner") return false;
  return canWriteKnowledgeReview(role);
}

function buildWorkbenchBucket(candidate = {}, approvalPolicy = {}, conflictPeers = []) {
  if (arr(conflictPeers).length > 0 || lower(candidate.status) === "conflict") {
    return "conflicting";
  }
  if (approvalPolicy.autoApprovable === true) {
    return "auto_approvable";
  }
  if (
    approvalPolicy.outcome === "quarantined" ||
    lower(candidate.status) === "needs_review"
  ) {
    return "quarantined";
  }
  if (
    approvalPolicy.blocked === true ||
    approvalPolicy.risk?.operational === true ||
    ["admin_approval_required", "owner_approval_required", "dual_approval_required"].includes(
      lower(approvalPolicy.outcome)
    )
  ) {
    return "blocked_high_risk";
  }
  return "pending";
}

function buildConflictPeerExplanation(selected = {}, peer = {}) {
  const reasons = [];
  const selectedTrust = Number(selected?.governance?.trust?.strongestTrustScore || 0);
  const peerTrust = Number(peer?.governance?.trust?.strongestTrustScore || 0);
  const selectedFreshness = lower(selected?.governance?.freshness?.bucket);
  const peerFreshness = lower(peer?.governance?.freshness?.bucket);
  const selectedConfidence = Number(selected?.confidence || 0);
  const peerConfidence = Number(peer?.confidence || 0);

  if (selectedTrust > peerTrust + 0.03) {
    reasons.push("stronger source trust");
  }
  if (["fresh", "review"].includes(selectedFreshness) && ["aging", "stale", "unknown"].includes(peerFreshness)) {
    reasons.push("fresher evidence");
  }
  if (selectedConfidence > peerConfidence + 0.05) {
    reasons.push("higher candidate confidence");
  }

  return reasons.length ? reasons : ["operator judgment still required"];
}

function buildImpactPreview(impact = {}, currentTruth = null) {
  return {
    canonicalAreas: uniqStrings(impact.canonicalAreas || impact.canonical_areas),
    runtimeAreas: uniqStrings(impact.runtimeAreas || impact.runtime_areas),
    canonicalPaths: uniqStrings(impact.canonicalPaths || impact.canonical_paths),
    runtimePaths: uniqStrings(impact.runtimePaths || impact.runtime_paths),
    affectedSurfaces: uniqStrings(impact.affectedSurfaces || impact.affected_surfaces),
    currentTruth: currentTruth
      ? {
          id: s(currentTruth.id),
          title: s(currentTruth.title),
          valueText: s(currentTruth.value_text),
          approvedAt: s(currentTruth.approved_at),
        }
      : null,
  };
}

const POLICY_OUTCOME_RANK = {
  auto_approvable: 0,
  review_required: 1,
  admin_approval_required: 2,
  owner_approval_required: 3,
  dual_approval_required: 4,
  blocked: 5,
  quarantined: 6,
};

const RISK_LEVEL_RANK = {
  low: 0,
  medium: 1,
  high: 2,
};

function compareRank(left = "", right = "", rankMap = {}) {
  const a = rankMap[lower(left)];
  const b = rankMap[lower(right)];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "unknown";
  if (a > b) return "higher";
  if (a < b) return "lower";
  return "unchanged";
}

function normalizePreviewValue(value = {}) {
  const item = obj(value);
  return {
    title: s(item.title),
    valueText: s(item.valueText || item.value_text),
    approvedAt: s(item.approvedAt || item.approved_at),
  };
}

function resolveCurrentTruthPolicy(currentTruth = null) {
  const metadata = obj(currentTruth?.metadata_json);
  const policy = obj(metadata.approvalPolicy || metadata.approval_policy);
  return {
    outcome: s(policy.outcome),
    requiredRole: s(policy.requiredRole || policy.required_role),
    riskLevel: s(policy.risk?.level || policy.riskLevel || policy.risk_level),
  };
}

function inferAutonomyDelta({ impact = {}, candidatePolicy = {}, currentPolicy = {} } = {}) {
  const runtimeAreas = uniqStrings(impact.runtimeAreas || impact.runtime_areas);
  const affectedSurfaces = uniqStrings(
    impact.affectedSurfaces || impact.affected_surfaces
  );
  const postureDelta = compareRank(
    candidatePolicy.outcome,
    currentPolicy.outcome,
    POLICY_OUTCOME_RANK
  );

  if (!runtimeAreas.length && !affectedSurfaces.length) return "unchanged";
  if (!["behavioral_policy", "channels", "contact_channels"].some((area) => runtimeAreas.includes(area))) {
    if (postureDelta === "unknown") return "unknown";
    return postureDelta === "higher"
      ? "tightens"
      : postureDelta === "lower"
        ? "loosens"
        : "unchanged";
  }

  if (postureDelta === "unknown") return "unknown";
  if (postureDelta === "higher") return "tightens";
  if (postureDelta === "lower") return "loosens";
  return "unchanged";
}

function inferExecutionPostureDelta(candidatePolicy = {}, currentPolicy = {}) {
  const delta = compareRank(
    candidatePolicy.outcome,
    currentPolicy.outcome,
    POLICY_OUTCOME_RANK
  );
  if (delta === "higher") return "stricter";
  if (delta === "lower") return "looser";
  return delta;
}

function inferReadinessDelta({ impact = {}, candidatePolicy = {} } = {}) {
  const runtimeAreas = uniqStrings(impact.runtimeAreas || impact.runtime_areas);
  if (!runtimeAreas.length) return "unknown";
  if (candidatePolicy.blocked === true) return "repair_or_review_gate";
  if (runtimeAreas.length > 0) return "projection_refresh_required";
  return "unknown";
}

function buildPreviewGuidance({
  impact = {},
  candidatePolicy = {},
  currentPolicy = {},
  autonomyDelta = "unknown",
  executionDelta = "unknown",
  readinessDelta = "unknown",
} = {}) {
  const affectedAreas = uniqStrings([
    ...arr(impact.canonicalAreas || impact.canonical_areas),
    ...arr(impact.runtimeAreas || impact.runtime_areas),
    ...arr(impact.affectedSurfaces || impact.affected_surfaces),
  ]);
  const riskDelta = compareRank(
    candidatePolicy.riskLevel,
    currentPolicy.riskLevel,
    RISK_LEVEL_RANK
  );
  const readinessImplications = [];

  if (readinessDelta === "projection_refresh_required") {
    readinessImplications.push(
      "Runtime projection refresh will be required before governed runtime reflects this change."
    );
  }
  if (arr(impact.runtimeAreas || impact.runtime_areas).includes("behavioral_policy")) {
    readinessImplications.push(
      "Behavioral policy surfaces may receive a stricter runtime posture after approval."
    );
  }
  if (candidatePolicy.blocked === true) {
    readinessImplications.push(
      "The proposed truth remains governance-sensitive and may still require stronger review before runtime authority can change."
    );
  }

  return {
    likelyAffectedAreas: affectedAreas,
    likelyRiskDelta: riskDelta === "higher" ? "higher" : riskDelta === "lower" ? "lower" : riskDelta,
    likelyAutonomyDelta: autonomyDelta,
    likelyExecutionPostureDelta: executionDelta,
    likelyReadinessImplications: readinessImplications,
    confidence:
      affectedAreas.length > 0
        ? "deterministic_impact_with_inferred_posture"
        : "partial_preview",
  };
}

function buildPublishPreview({
  candidate = {},
  currentTruth = null,
  impact = {},
  candidatePolicy = {},
} = {}) {
  const currentPolicy = resolveCurrentTruthPolicy(currentTruth);
  const currentValue = normalizePreviewValue({
    title: s(currentTruth?.title),
    valueText: s(currentTruth?.value_text),
    approvedAt: s(currentTruth?.approved_at),
  });
  const proposedValue = normalizePreviewValue({
    title: s(candidate.title),
    valueText: s(candidate.value_text),
  });
  const autonomyDelta = inferAutonomyDelta({
    impact,
    candidatePolicy,
    currentPolicy,
  });
  const executionPostureDelta = inferExecutionPostureDelta(
    candidatePolicy,
    currentPolicy
  );
  const readinessDelta = inferReadinessDelta({
    impact,
    candidatePolicy,
  });
  const guidance = buildPreviewGuidance({
    impact,
    candidatePolicy,
    currentPolicy,
    autonomyDelta,
    executionDelta: executionPostureDelta,
    readinessDelta,
  });
  const riskDelta = compareRank(
    candidatePolicy.riskLevel,
    currentPolicy.riskLevel,
    RISK_LEVEL_RANK
  );

  return {
    values: {
      currentApprovedValue: currentValue,
      proposedValue,
      changed:
        s(currentValue.valueText) !== s(proposedValue.valueText) ||
        s(currentValue.title) !== s(proposedValue.title),
    },
    canonical: {
      areas: uniqStrings(impact.canonicalAreas || impact.canonical_areas),
      paths: uniqStrings(impact.canonicalPaths || impact.canonical_paths),
    },
    runtime: {
      areas: uniqStrings(impact.runtimeAreas || impact.runtime_areas),
      paths: uniqStrings(impact.runtimePaths || impact.runtime_paths),
      readinessDelta,
    },
    channels: {
      affectedSurfaces: uniqStrings(
        impact.affectedSurfaces || impact.affected_surfaces
      ),
    },
    policy: {
      currentOutcome: s(currentPolicy.outcome),
      proposedOutcome: s(candidatePolicy.outcome),
      currentRequiredRole: s(currentPolicy.requiredRole),
      proposedRequiredRole: s(candidatePolicy.requiredRole),
      executionPostureDelta,
      autonomyDelta,
      riskDelta,
    },
    guidance,
    auditSummary: {
      currentValue: s(currentValue.valueText),
      proposedValue: s(proposedValue.valueText),
      canonicalPaths: uniqStrings(impact.canonicalPaths || impact.canonical_paths),
      runtimePaths: uniqStrings(impact.runtimePaths || impact.runtime_paths),
      affectedSurfaces: uniqStrings(
        impact.affectedSurfaces || impact.affected_surfaces
      ),
      proposedOutcome: s(candidatePolicy.outcome),
      autonomyDelta,
      riskDelta,
      readinessDelta,
    },
  };
}

async function buildKnowledgeReviewWorkbench({
  knowledge,
  tenant,
  viewerRole = "",
  category = "",
  status = "",
  limit = 100,
  offset = 0,
} = {}) {
  const queueRows = await knowledge.listReviewQueue({
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
    category,
    status,
    limit,
    offset,
  });

  const queueItems = (
    await Promise.all(
      queueRows.map(async (item) => {
        const full = await knowledge.getCandidateById(item.id);
        return {
          ...obj(full),
          source_type: s(item.source_type || full?.source_type),
          source_display_name: s(item.source_display_name),
        };
      })
    )
  ).filter(Boolean);

  const activeKnowledge = await knowledge.listActiveKnowledge({
    tenantId: tenant.tenant_id,
    tenantKey: tenant.tenant_key,
  });

  const activeTruthMap = new Map(
    activeKnowledge.map((item) => [
      `${lower(item.category)}|${lower(item.item_key)}`,
      item,
    ])
  );

  const conflictGroups = new Map();
  for (const item of queueItems) {
    if (!s(item.conflict_hash)) continue;
    const key = s(item.conflict_hash);
    const existing = conflictGroups.get(key) || [];
    existing.push(item);
    conflictGroups.set(key, existing);
  }

  const items = await Promise.all(
    queueItems.map(async (candidate) => {
      const evidenceGovernance = summarizeEvidenceGovernance(candidate.source_evidence_json);
      const peerCandidates = arr(conflictGroups.get(s(candidate.conflict_hash))).filter(
        (item) => s(item.id) !== s(candidate.id)
      );
      const governance = {
        trust: obj(evidenceGovernance.trust),
        freshness: obj(evidenceGovernance.freshness),
        support: obj(evidenceGovernance.support),
        conflict: peerCandidates.length
          ? {
              classification: "conflicting_but_reviewable",
              reviewRequired: true,
              conflictHash: s(candidate.conflict_hash),
              peerCount: peerCandidates.length + 1,
            }
          : {},
      };
      const impact = buildCandidateImpact({
        category: candidate.category,
        itemKey: candidate.item_key,
      });
      const approvalPolicy = classifyApprovalPolicy({
        title: s(candidate.title || candidate.value_text || candidate.item_key),
        category: candidate.category,
        itemKey: candidate.item_key,
        impact,
        governance,
      });
      const currentTruth = activeTruthMap.get(
        `${lower(candidate.category)}|${lower(candidate.item_key)}`
      );
      const queueBucket = buildWorkbenchBucket(candidate, approvalPolicy, peerCandidates);
      const publishPreview = buildPublishPreview({
        candidate,
        currentTruth,
        impact,
        candidatePolicy: {
          outcome: approvalPolicy.outcome,
          requiredRole: approvalPolicy.requiredRole,
          riskLevel: approvalPolicy.risk?.level,
          blocked: approvalPolicy.blocked === true,
        },
      });
      const latestApproval = arr(
        await knowledge.listApprovals({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          candidateId: candidate.id,
          limit: 1,
          offset: 0,
        })
      )[0];

      return {
        id: s(candidate.id),
        candidateId: s(candidate.id),
        queueBucket,
        category: lower(candidate.category),
        itemKey: s(candidate.item_key),
        title: s(candidate.title || candidate.value_text || candidate.item_key || "Candidate"),
        valueText: s(candidate.value_text),
        valueJson: obj(candidate.value_json),
        normalizedText: s(candidate.normalized_text),
        status: lower(candidate.status),
        source: {
          displayName: s(candidate.source_display_name || "Unknown source"),
          sourceType: lower(candidate.source_type),
          trustTier: s(governance.trust.strongestTier),
          trustLabel: titleize(governance.trust.strongestTier || governance.trust.strongestSourceType || "unknown"),
        },
        confidence: {
          score: Number(candidate.confidence || 0),
          label: s(candidate.confidence_label),
        },
        governance: {
          trust: obj(governance.trust),
          freshness: obj(governance.freshness),
          support: obj(governance.support),
          conflict: obj(governance.conflict),
          quarantine: approvalPolicy.outcome === "quarantined",
          quarantineReasons: uniqStrings(approvalPolicy.reasonCodes),
          reviewExplanation: uniqStrings([
            governance.trust.strongestTier
              ? `Trust tier ${titleize(governance.trust.strongestTier)}`
              : "",
            governance.freshness.bucket
              ? `Freshness ${titleize(governance.freshness.bucket)}`
              : "",
            Number(governance.support.uniqueSourceCount || 0) > 0
              ? `${Number(governance.support.uniqueSourceCount || 0)} supporting source${Number(governance.support.uniqueSourceCount || 0) === 1 ? "" : "s"}`
              : "",
          ]),
        },
        approvalPolicy: {
          outcome: lower(approvalPolicy.outcome),
          requiredRole: s(approvalPolicy.requiredRole),
          reasonCodes: uniqStrings(approvalPolicy.reasonCodes),
          autoApprovalAllowed: approvalPolicy.autoApprovable === true,
          autoApprovalForbidden: approvalPolicy.autoApprovalForbidden === true,
          blocked: approvalPolicy.blocked === true,
          highRiskOperationalTruth: approvalPolicy.risk?.operational === true,
          riskLevel: s(approvalPolicy.risk?.level),
          riskLabel: s(approvalPolicy.risk?.label),
        },
        impactPreview: buildImpactPreview(impact, currentTruth),
        finalizeImpactPreview: buildImpactPreview(impact, currentTruth),
        publishPreview,
        currentTruth: currentTruth
          ? {
              title: s(currentTruth.title),
              valueText: s(currentTruth.value_text),
              approvedAt: s(currentTruth.approved_at),
            }
          : null,
        conflictResolution: peerCandidates.length
          ? {
              conflictHash: s(candidate.conflict_hash),
              classification: "conflicting_but_reviewable",
              reviewRequired: true,
              peerCount: peerCandidates.length + 1,
              peers: peerCandidates.map((peer) => {
                const peerGovernance = summarizeEvidenceGovernance(peer.source_evidence_json);
                return {
                  id: s(peer.id),
                  title: s(peer.title || peer.value_text || peer.item_key || "Candidate"),
                  valueText: s(peer.value_text),
                  sourceDisplayName: s(peer.source_display_name || "Unknown source"),
                  sourceType: lower(peer.source_type),
                  trustTier: s(peerGovernance.trust?.strongestTier),
                  freshnessBucket: s(peerGovernance.freshness?.bucket),
                  confidence: Number(peer.confidence || 0),
                  publishPreview: buildPublishPreview({
                    candidate: peer,
                    currentTruth,
                    impact: buildCandidateImpact({
                      category: peer.category,
                      itemKey: peer.item_key,
                    }),
                    candidatePolicy: (() => {
                      const peerImpact = buildCandidateImpact({
                        category: peer.category,
                        itemKey: peer.item_key,
                      });
                      const peerPolicy = classifyApprovalPolicy({
                        title: s(peer.title || peer.value_text || peer.item_key),
                        category: peer.category,
                        itemKey: peer.item_key,
                        impact: peerImpact,
                        governance: peerGovernance,
                      });
                      return {
                        outcome: peerPolicy.outcome,
                        requiredRole: peerPolicy.requiredRole,
                        riskLevel: peerPolicy.risk?.level,
                        blocked: peerPolicy.blocked === true,
                      };
                    })(),
                  }),
                  whyStrongerOrWeaker: buildConflictPeerExplanation(
                    {
                      confidence: candidate.confidence,
                      governance,
                    },
                    {
                      confidence: peer.confidence,
                      governance: peerGovernance,
                    }
                  ),
                };
              }),
              previewChoices: [
                {
                  candidateId: s(candidate.id),
                  title: s(candidate.title || candidate.value_text || candidate.item_key),
                  valueText: s(candidate.value_text),
                  publishPreview,
                  riskLevel: s(approvalPolicy.risk?.level),
                  outcome: s(approvalPolicy.outcome),
                  affectedSurfaces: uniqStrings(impact.affectedSurfaces || impact.affected_surfaces),
                },
                ...peerCandidates.map((peer) => {
                  const peerGovernance = summarizeEvidenceGovernance(peer.source_evidence_json);
                  const peerImpact = buildCandidateImpact({
                    category: peer.category,
                    itemKey: peer.item_key,
                  });
                  const peerPolicy = classifyApprovalPolicy({
                    title: s(peer.title || peer.value_text || peer.item_key),
                    category: peer.category,
                    itemKey: peer.item_key,
                    impact: peerImpact,
                    governance: peerGovernance,
                  });
                  return {
                    candidateId: s(peer.id),
                    title: s(peer.title || peer.value_text || peer.item_key),
                    valueText: s(peer.value_text),
                    publishPreview: buildPublishPreview({
                      candidate: peer,
                      currentTruth,
                      impact: peerImpact,
                      candidatePolicy: {
                        outcome: peerPolicy.outcome,
                        requiredRole: peerPolicy.requiredRole,
                        riskLevel: peerPolicy.risk?.level,
                        blocked: peerPolicy.blocked === true,
                      },
                    }),
                    riskLevel: s(peerPolicy.risk?.level),
                    outcome: s(peerPolicy.outcome),
                    affectedSurfaces: uniqStrings(
                      peerImpact.affectedSurfaces || peerImpact.affected_surfaces
                    ),
                  };
                }),
              ],
            }
          : null,
        sourceEvidence: arr(candidate.source_evidence_json).slice(0, 6),
        review: {
          reviewReason: s(candidate.review_reason),
          firstSeenAt: s(candidate.first_seen_at),
          updatedAt: s(candidate.updated_at),
          reviewedAt: s(candidate.reviewed_at),
          reviewedBy: s(candidate.reviewed_by),
        },
        auditContext: {
          latestAction: s(latestApproval?.action),
          latestDecision: s(latestApproval?.decision),
          latestBy: s(latestApproval?.reviewer_name || latestApproval?.reviewer_id || candidate.reviewed_by),
          latestAt: s(latestApproval?.created_at || candidate.reviewed_at),
        },
        actions: [
          {
            actionType: "approve",
            label: peerCandidates.length ? "Approve selected value" : "Approve candidate",
            allowed: canSatisfyRequiredRole(viewerRole, approvalPolicy.requiredRole),
            requiredRole: s(approvalPolicy.requiredRole),
            unavailableReason:
              canSatisfyRequiredRole(viewerRole, approvalPolicy.requiredRole)
                ? ""
                : `Requires ${titleize(approvalPolicy.requiredRole || "reviewer")} approval authority.`,
          },
          {
            actionType: "reject",
            label: "Reject",
            allowed: canWriteKnowledgeReview(viewerRole),
            requiredRole: "admin",
            unavailableReason: canWriteKnowledgeReview(viewerRole)
              ? ""
              : "Requires admin or owner write access.",
          },
          {
            actionType: "mark_follow_up",
            label: "Needs review",
            allowed: canWriteKnowledgeReview(viewerRole),
            requiredRole: "admin",
            unavailableReason: canWriteKnowledgeReview(viewerRole)
              ? ""
              : "Requires admin or owner write access.",
          },
          {
            actionType: "keep_quarantined",
            label: "Keep quarantined",
            allowed:
              canWriteKnowledgeReview(viewerRole) &&
              (queueBucket === "quarantined" || approvalPolicy.blocked === true),
            requiredRole: "admin",
            unavailableReason:
              queueBucket === "quarantined" || approvalPolicy.blocked === true
                ? canWriteKnowledgeReview(viewerRole)
                  ? ""
                  : "Requires admin or owner write access."
                : "Candidate is not currently in a quarantined posture.",
          },
        ],
      };
    })
  );

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.queueBucket] = (acc[item.queueBucket] || 0) + 1;
      if (item.approvalPolicy.highRiskOperationalTruth) acc.highRisk += 1;
      if (item.approvalPolicy.autoApprovalAllowed) acc.autoApprovable += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      quarantined: 0,
      conflicting: 0,
      auto_approvable: 0,
      blocked_high_risk: 0,
      highRisk: 0,
      autoApprovable: 0,
    }
  );

  return {
    viewerRole: lower(viewerRole),
    summary,
    items,
  };
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
      const viewerRole = lower(req.auth?.role || "member");
      const category = s(req.query?.category);
      const status = s(req.query?.status);
      const limit = n(req.query?.limit, 100);
      const offset = n(req.query?.offset, 0);
      const workbench = await buildKnowledgeReviewWorkbench({
        knowledge,
        tenant,
        viewerRole,
        category,
        status,
        limit,
        offset,
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        viewerRole,
        summary: workbench.summary,
        items: workbench.items,
        count: workbench.items.length,
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
        metadataJson: {
          ...obj(payload.metadataJson, {}),
          publishPreview: obj(
            payload.metadataJson?.publishPreview ||
              payload.metadataJson?.previewSummary ||
              {},
            {}
          ),
        },
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
        publishPreview: obj(
          payload.metadataJson?.publishPreview ||
            payload.metadataJson?.previewSummary ||
            {},
          {}
        ),
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

  router.post("/knowledge/:candidateId/needs-review", async (req, res) => {
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
      const reason =
        s(req.body?.reason) || "Marked for follow-up review from Truth Review Workbench";
      const result = await knowledge.markCandidateNeedsReview(candidateId, {
        reviewerId: by,
        reviewedAt: new Date().toISOString(),
        reason,
      });

      await auditSafe(
        db,
        req,
        tenant,
        "settings.knowledge.needs_review_marked",
        "tenant_knowledge_candidate",
        candidateId,
        {
          category: s(candidate?.category),
          itemKey: s(candidate?.item_key),
          reviewerName,
          reason,
        }
      );

      return ok(res, result);
    } catch (err) {
      return bad(res, 500, err.message || "failed to mark candidate for review");
    }
  });

  router.post("/knowledge/:candidateId/quarantine", async (req, res) => {
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
      const reason =
        s(req.body?.reason) || "Candidate remains quarantined pending stronger evidence";
      const result = await knowledge.markCandidateNeedsReview(candidateId, {
        reviewerId: by,
        reviewedAt: new Date().toISOString(),
        reason,
      });

      await auditSafe(
        db,
        req,
        tenant,
        "settings.knowledge.quarantine_retained",
        "tenant_knowledge_candidate",
        candidateId,
        {
          category: s(candidate?.category),
          itemKey: s(candidate?.item_key),
          reviewerName,
          reason,
        }
      );

      return ok(res, result);
    } catch (err) {
      return bad(res, 500, err.message || "failed to keep candidate quarantined");
    }
  });
}
