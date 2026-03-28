// src/services/sourceFusion/clustering.js
// FINAL v5.0 — claim clustering, scoring, selection, conflicts
// hardened for cleaner scalar/list selection during business synthesis

import {
  arr,
  compactText,
  isLikelyBusinessWebsiteUrl,
  lower,
  normalizeConfidence,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
  obj,
  s,
  uniqBy,
  uniqStrings,
} from "./shared.js";
import {
  buildCandidateImpact,
  buildClaimGovernance,
  classifyConflictOutcome,
  getSourceTrustProfile,
} from "./governance.js";
import { classifyApprovalPolicy } from "./approvalPolicy.js";
import {
  claimPolicy,
  isListClaim,
  isProtectedScalarClaim,
  isWeakSourceType,
  sourcePriorityIndex,
  sourceRank,
  sourceWeight,
} from "./policies.js";

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "company.com",
  "domain.com",
  "test.com",
  "email.com",
]);

const SERVICE_TERM_RE =
  /\b(service|services|solution|solutions|automation|marketing|design|development|consulting|chatbot|crm|seo|branding|website|web site|e-commerce|software|xidmət|xidmet|veb|sayt|reklam|rəqəmsal|digital|smm|landing page|ui\/ux|loan|loans|credit|credits|kredit|kreditlər|mortgage|ipoteka|deposit|depozit|account|accounts|hesab|hesablar|transfer|transfers|payment|payments|ödəniş|odenis|terminal|pos|insurance|sığorta|sigorta|business banking|corporate banking|internet banking|mobile banking|installment|taksit|leasing|brokerage|investment|cashback|training|academy|course|kurs|repair|təmir|temir|maintenance|delivery|logistics|booking|reservation|travel|tour|clinic|dental|beauty|spa|legal|law|accounting|outsourcing|hosting|cloud|cybersecurity|support|customer support)\b/i;

const PRODUCT_TERM_RE =
  /\b(product|products|package|packages|plan|plans|tariff|tariffs|tarif|tariflər|card|cards|kart|kartlar|debit card|credit card|virtual card|deposit|deposits|depozit|depozitlər|account|accounts|hesab|hesablar|loan|loans|credit|credits|kredit|mortgage|ipoteka|subscription|subscriptions|membership|memberships|bundle|bundles|suite|tool|tools|platform)\b/i;

const PRICING_TERM_RE =
  /\b(price|pricing|qiymət|qiymet|package|packages|plan|plans|tariff|tariffs|tarif|tariflər|starting|from|quote|custom quote|consultation|₼|\bazn\b|\busd\b|\beur\b|\$|€|£)\b/i;

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isUiNoiseText(text = "") {
  const x = lower(text);
  if (!x) return true;

  if (
    /^(home|about|about us|services|service|contact|contact us|pricing|faq|blog|menu|search|support|help|read more|learn more|view more|more|details|get started|start now|book now|book|call now|back|next|prev|previous|skip to content)$/i.test(
      x
    )
  ) {
    return true;
  }

  return (
    /\b(skip to content|cookie|cookies|accept all|all rights reserved|copyright|loading|toggle navigation|open menu|close menu|subscribe|newsletter|sign in|log in|login|register|checkout|cart)\b/i.test(
      x
    ) ||
    /^[/|•·\-\s]+$/.test(x)
  );
}

function isPolicyText(text = "") {
  return /\b(policy|privacy|terms|conditions|refund|return|shipping|cancellation|copyright|gdpr)\b/i.test(
    s(text)
  );
}

function isTestimonialText(text = "") {
  return /\b(testimonial|testimonials|review|reviews|customer review|what our clients say|what clients say|highly recommend|happy clients|client feedback)\b/i.test(
    s(text)
  );
}

function isPromoText(text = "") {
  return /\b(read more|learn more|view more|get started|start now|book now|call now|contact us|request quote|free consultation|timeline|days|project complexity|requirements)\b/i.test(
    s(text)
  );
}

function isAddressLikeText(text = "") {
  const x = s(text);
  if (!x) return false;

  return (
    /\b(address|office|location|ünvan|unvan|filial|branch|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd|floor|building|suite|baku|azerbaijan|azərbaycan|bakı)\b/i.test(
      x
    ) ||
    (/\d/.test(x) &&
      /\b(street|st\.?|avenue|ave\.?|road|rd\.?|floor|building|suite)\b/i.test(x))
  );
}

function isPlaceholderEmail(email = "") {
  const value = lower(normalizeObservedEmail(email));
  if (!value || !/@/.test(value)) return true;

  const domain = value.split("@")[1] || "";
  if (PLACEHOLDER_EMAIL_DOMAINS.has(domain)) return true;

  if (/^(info|hello|contact|sales|support)@(company|example|domain)\.(com|net|org)$/i.test(value)) {
    return true;
  }

  return false;
}

function isPlaceholderPhone(phone = "") {
  const value = s(phone);
  if (!value) return true;
  if (/\.\.\.|x{3,}/i.test(value)) return true;

  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return true;
  if (/^[0]+$/.test(digits)) return true;

  return false;
}

function cleanBusinessNameCandidate(text = "") {
  const raw = compactText(s(text), 180);
  if (!raw) return "";

  const parts = raw
    .split(/\s*[|•·—–]\s*/)
    .map((item) => compactText(item, 100))
    .filter(Boolean);

  const ranked = (parts.length ? parts : [raw])
    .map((item) => {
      const lx = lower(item);

      let score = 0;
      if (item.length >= 2 && item.length <= 72) score += 3;
      if (!isUiNoiseText(item)) score += 3;
      if (!isPolicyText(item)) score += 2;
      if (!/@/.test(item) && !/^https?:/i.test(item)) score += 2;
      if (
        /\b(agency|studio|company|clinic|center|centre|group|labs|solutions|digital|academy|shop|store|salon|restaurant|hotel|travel|consulting|design|marketing|bank)\b/i.test(
          item
        )
      ) {
        score += 1;
      }
      if (
        /\b(home|welcome|google maps|maps|contact|services|pricing|faq)\b/i.test(lx)
      ) {
        score -= 5;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.length - b.item.length);

  const best = ranked[0]?.item || "";
  if (!best) return "";
  if (isUiNoiseText(best)) return "";
  if (best.length < 2 || best.length > 80) return "";
  if (/^https?:/i.test(best) || /@/.test(best)) return "";
  return best;
}

function cleanSummaryCandidate(text = "", { allowShort = false } = {}) {
  const raw = compactText(s(text), 1400);
  if (!raw) return "";

  const words = raw.split(/\s+/).filter(Boolean).length;
  if (!allowShort && (words < 7 || raw.length < 40)) return "";
  if (raw.length > 1500) return "";

  if (isUiNoiseText(raw)) return "";
  if (isPolicyText(raw)) return "";
  if (isTestimonialText(raw)) return "";
  if (isAddressLikeText(raw)) return "";
  if (isPromoText(raw)) return "";
  if (
    /\b(call now|book now|get started|start now|contact us|read more|learn more|view more)\b/i.test(
      raw
    )
  ) {
    return "";
  }

  if (
    /\b(find local businesses|view maps|get driving directions|google maps|branch|filial|atm)\b/i.test(
      raw
    ) &&
    !SERVICE_TERM_RE.test(raw) &&
    !/\b(company|business|brand|team|bank|agency|studio|clinic|academy|platform|shop|store)\b/i.test(
      raw
    )
  ) {
    return "";
  }

  return raw;
}

function cleanAddressCandidate(text = "") {
  const raw = compactText(s(text), 220);
  if (!raw) return "";
  if (!isAddressLikeText(raw)) return "";
  if (isUiNoiseText(raw) || isPolicyText(raw) || isTestimonialText(raw) || isPromoText(raw)) {
    return "";
  }
  if (raw.split(/\s+/).length < 3) return "";
  if (/[.!?].*[.!?]/.test(raw)) return "";
  return raw;
}

function cleanListCandidateForType(type = "", text = "") {
  let cleaned = compactText(s(text), type === "pricing_hint" ? 220 : 180);
  if (!cleaned) return "";

  if (isUiNoiseText(cleaned) || isPolicyText(cleaned) || isTestimonialText(cleaned) || isPromoText(cleaned)) {
    return "";
  }

  if (/^https?:/i.test(cleaned) || /@/.test(cleaned)) return "";

  if (type === "service" || type === "product") {
    cleaned = compactText(
      cleaned.replace(
        /^(services?|service|xidmətlər?|xidmetler?|xidmət|xidmet|услуги|products?|packages?|plans?)\s*[:|—–-]*\s*/i,
        ""
      ),
      180
    );

    const words = cleaned.split(/\s+/).filter(Boolean).length;
    if (words < 1 || words > 10) return "";
    if (isAddressLikeText(cleaned)) return "";
    if (
      /\b(home|about|contact|services|products|pricing|faq|policy|blog|portfolio|projects)\b/i.test(
        cleaned
      )
    ) {
      return "";
    }

    if (type === "service" && !SERVICE_TERM_RE.test(cleaned) && !PRODUCT_TERM_RE.test(cleaned)) {
      return "";
    }

    if (type === "product" && !PRODUCT_TERM_RE.test(cleaned) && !SERVICE_TERM_RE.test(cleaned)) {
      return "";
    }
  }

  if (type === "pricing_hint") {
    if (!PRICING_TERM_RE.test(cleaned)) return "";
    if (
      /\b(read more|learn more|get started|book now|call now|follow us|timeline|project complexity|requirements)\b/i.test(
        cleaned
      )
    ) {
      return "";
    }
    if (cleaned.length < 12 || cleaned.length > 180) return "";
  }

  return cleaned;
}

function cleanClaimTextForType(claimType = "", valueText = "", valueJson = {}) {
  const type = lower(claimType);
  const json = obj(valueJson);
  const raw = s(valueText);

  if (type === "company_name") {
    return cleanBusinessNameCandidate(raw);
  }

  if (type === "website_url") {
    const url = normalizeObservedUrl(json.url || raw);
    if (!url) return "";
    return isLikelyBusinessWebsiteUrl(url) ? url : "";
  }

  if (type === "summary_short" || type === "summary_long") {
    return cleanSummaryCandidate(raw);
  }

  if (type === "primary_email") {
    const email = normalizeObservedEmail(json.email || raw);
    if (!/@/.test(email)) return "";
    return isPlaceholderEmail(email) ? "" : email;
  }

  if (type === "primary_phone") {
    const phone = normalizeObservedPhone(json.phone || raw);
    return isPlaceholderPhone(phone) ? "" : phone;
  }

  if (type === "primary_address") {
    return cleanAddressCandidate(json.address || raw);
  }

  if (type === "pricing_policy" || type === "support_mode") {
    return cleanSummaryCandidate(raw, { allowShort: true });
  }

  if (type === "working_hours") {
    const cleaned = compactText(raw, 180);
    if (!/(\d{1,2}[:.]\d{2}|\d{1,2}\s?(am|pm)|24\/7)/i.test(cleaned)) return "";
    return cleaned;
  }

  if (type === "faq") {
    const question = compactText(s(json.question || raw), 220);
    if (!question || isUiNoiseText(question)) return "";
    if (question.split(/\s+/).length < 3) return "";
    return question;
  }

  if (type === "social_link" || type === "booking_link" || type === "whatsapp_link") {
    return normalizeObservedUrl(json.url || raw);
  }

  if (type === "service" || type === "product" || type === "pricing_hint") {
    return cleanListCandidateForType(type, raw);
  }

  return compactText(raw, 600);
}

function observationScore(item = {}, claimType = "") {
  const base = normalizeConfidence(item.confidence, 0.5);
  const sourceType = s(item.source_type || item.sourceType);
  const weighted = base * sourceWeight(sourceType);

  let multiplier = 1;

  if (
    claimType === "website_url" &&
    !normalizeObservedUrl(
      item.raw_value_text ||
        item.rawValueText ||
        item.normalized_value_text ||
        item.normalizedValueText
    )
  ) {
    multiplier *= 0.35;
  }

  if ((claimType === "summary_short" || claimType === "summary_long") && isWeakSourceType(sourceType)) {
    multiplier *= 0.8;
  }

  return normalizeConfidence(weighted * multiplier, 0);
}

function uniqueSourceObservations(items = []) {
  const bySource = new Map();

  for (const item of arr(items)) {
    const key = [
      s(item.source_type || item.sourceType).toLowerCase(),
      s(item.source_id || item.sourceId),
      s(item.source_run_id || item.sourceRunId),
      s(item.page_url || item.pageUrl),
      s(item.claim_key || item.claimKey),
    ].join("|");

    const current = bySource.get(key);

    if (
      !current ||
      normalizeConfidence(item.confidence, 0) >
        normalizeConfidence(current.confidence, 0)
    ) {
      bySource.set(key, item);
    }
  }

  return [...bySource.values()];
}

function weightedTopAverage(scores = []) {
  const list = [...arr(scores)]
    .map((x) => normalizeConfidence(x, 0))
    .sort((a, b) => b - a)
    .slice(0, 3);

  if (!list.length) return 0;

  const weights = [0.6, 0.28, 0.12];
  let total = 0;
  let totalWeight = 0;

  for (let i = 0; i < list.length; i += 1) {
    const weight = weights[i] || 0.08;
    total += list[i] * weight;
    totalWeight += weight;
  }

  return totalWeight ? total / totalWeight : 0;
}

function clampUnit(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function clusterScore(claimType = "", cluster = {}) {
  const items = arr(cluster.observations);
  if (!items.length) return 0;

  const uniqueItems = uniqueSourceObservations(items);
  const scores = uniqueItems.map((item) => observationScore(item, claimType));
  const base = weightedTopAverage(scores);

  const uniqueSourceTypes = new Set(
    uniqueItems
      .map((item) => s(item.source_type || item.sourceType).toLowerCase())
      .filter(Boolean)
  );

  const corroborationBonus = Math.min(
    0.1,
    Math.max(0, uniqueSourceTypes.size - 1) * 0.04
  );

  const nonWeakCount = uniqueItems.filter(
    (item) => !isWeakSourceType(item.source_type || item.sourceType)
  ).length;

  const trustedBonus = nonWeakCount >= 2 ? 0.04 : nonWeakCount >= 1 ? 0.02 : 0;

  const onlyWeakSources =
    uniqueItems.length > 0 &&
    uniqueItems.every((item) =>
      isWeakSourceType(item.source_type || item.sourceType)
    );

  const weakPenalty = onlyWeakSources
    ? claimPolicy(claimType).weakOnlyPenalty
    : 0;

  return normalizeConfidence(base + corroborationBonus + trustedBonus - weakPenalty, 0);
}

function selectRepresentativeText(items = []) {
  return (
    [...arr(items)]
      .map((item) =>
        compactText(
          item.raw_value_text ||
            item.rawValueText ||
            item.normalized_value_text ||
            item.normalizedValueText,
          1200
        )
      )
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || ""
  );
}

function selectRepresentativeJson(items = []) {
  const best = [...arr(items)].find((item) => {
    const raw = obj(item.raw_value_json || item.rawValueJson);
    const norm = obj(item.normalized_value_json || item.normalizedValueJson);
    return Object.keys(raw).length || Object.keys(norm).length;
  });

  if (!best) return {};

  const raw = obj(best.raw_value_json || best.rawValueJson);
  const norm = obj(best.normalized_value_json || best.normalizedValueJson);

  return Object.keys(norm).length ? norm : raw;
}

function evidencePreview(items = []) {
  return arr(items).map((item) => ({
    source_id: s(item.source_id || item.sourceId),
    source_run_id: s(item.source_run_id || item.sourceRunId),
    source_type: s(item.source_type || item.sourceType),
    raw_value_text: s(item.raw_value_text || item.rawValueText),
    normalized_value_text: s(
      item.normalized_value_text || item.normalizedValueText
    ),
    page_url: s(item.page_url || item.pageUrl),
    page_title: s(item.page_title || item.pageTitle),
    evidence_text: s(item.evidence_text || item.evidenceText),
    confidence: normalizeConfidence(item.confidence, 0),
    confidence_label: s(item.confidence_label || item.confidenceLabel),
    first_seen_at: s(item.first_seen_at || item.firstSeenAt),
    last_seen_at: s(item.last_seen_at || item.lastSeenAt),
    trust_tier: getSourceTrustProfile(item.source_type || item.sourceType).trustTier,
    trust_score: getSourceTrustProfile(item.source_type || item.sourceType).trustScore,
  }));
}

function stableValueKey(item = {}) {
  const claimType = lower(item.claim_type || item.claimType);
  const normalizedText = cleanClaimTextForType(
    claimType,
    s(item.normalized_value_text || item.normalizedValueText || item.raw_value_text || item.rawValueText),
    obj(item.normalized_value_json || item.normalizedValueJson || item.raw_value_json || item.rawValueJson)
  );

  if (claimType === "social_link") {
    const json = obj(item.normalized_value_json || item.normalizedValueJson || item.raw_value_json || item.rawValueJson);
    const platform = lower(json.platform || "social");
    const url = normalizeObservedUrl(json.url || normalizedText);
    if (url) return `${platform}|${url}`;
  }

  if (normalizedText) return normalizedText;

  const jsonValue = obj(item.normalized_value_json || item.normalizedValueJson);
  if (Object.keys(jsonValue).length) return stableJsonStringify(jsonValue);

  return normalizeObservedText(item.raw_value_text || item.rawValueText);
}

function enrichCluster(claimType = "", items = [], normalizedKey = "") {
  const evidence = evidencePreview(items);
  const uniqueTypes = uniqStrings(
    items
      .map((item) => s(item.source_type || item.sourceType))
      .filter(Boolean)
  );

  const bestType =
    [...uniqueTypes].sort((a, b) => sourceRank(b) - sourceRank(a))[0] || "";

  const score = clusterScore(claimType, { observations: items });
  const base = {
    claimType,
    normalizedKey,
    observations: items,
    representativeText: selectRepresentativeText(items),
    representativeJson: selectRepresentativeJson(items),
    score,
    evidence,
    sourceTypes: uniqueTypes,
    bestSourceType: bestType,
    bestSourceRank: sourceRank(bestType),
    onlyWeakSources:
      uniqueTypes.length > 0 && uniqueTypes.every((x) => isWeakSourceType(x)),
    observationCount: items.length,
  };

  return {
    ...base,
    governance: buildClaimGovernance({
      claimType,
      score,
      evidence,
      onlyWeakSources: base.onlyWeakSources,
    }),
  };
}

function groupObservationsByClaimType(observations = []) {
  const byType = new Map();

  for (const observation of arr(observations)) {
    const claimType = s(observation.claim_type || observation.claimType).toLowerCase();
    if (!claimType) continue;

    if (!byType.has(claimType)) {
      byType.set(claimType, new Map());
    }

    const typeMap = byType.get(claimType);
    const key =
      stableValueKey(observation) ||
      `raw:${s(observation.raw_value_text || observation.rawValueText).toLowerCase()}`;

    if (!typeMap.has(key)) {
      typeMap.set(key, []);
    }

    typeMap.get(key).push(observation);
  }

  const out = {};

  for (const [claimType, map] of byType.entries()) {
    out[claimType] = [...map.entries()]
      .map(([normalizedKey, items]) =>
        enrichCluster(claimType, items, normalizedKey)
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.bestSourceRank - a.bestSourceRank ||
          b.observationCount - a.observationCount ||
          b.representativeText.length - a.representativeText.length
      );
  }

  return out;
}

function getClusterText(cluster) {
  return compactText(cluster?.representativeText || "", 1800);
}

function getClusterJson(cluster) {
  return obj(cluster?.representativeJson);
}

function passesScalarClusterGuard(claimType = "", cluster = null) {
  if (!cluster) return false;

  const policy = claimPolicy(claimType);
  if (normalizeConfidence(cluster.score, 0) < policy.minClusterScore) return false;

  const cleaned = cleanClaimTextForType(
    claimType,
    s(cluster.representativeText),
    obj(cluster.representativeJson)
  );

  if (!cleaned) return false;

  if (claimType === "company_name") {
    const text = lower(cleaned);
    if (!text || text === "google maps" || text === "maps") return false;
  }

  if (claimType === "website_url") {
    return isLikelyBusinessWebsiteUrl(cleaned);
  }

  return true;
}

function scalarSelectionScore(claimType = "", cluster = null) {
  if (!cluster) return 0;

  const priorities = arr(cluster.sourceTypes).map((x) =>
    sourcePriorityIndex(claimType, x)
  );

  const bestPriority = priorities.length ? Math.min(...priorities) : 999;
  const priorityCount = claimPolicy(claimType).sourcePriority.length || 1;
  const priorityBonus =
    Math.max(0, (priorityCount - bestPriority) / priorityCount) * 0.22;
  const trustedBonus = cluster.onlyWeakSources ? 0 : 0.04;

  return clampUnit(cluster.score + priorityBonus + trustedBonus);
}

function pickScalarCluster(claimType = "", clusters = []) {
  const viable = arr(clusters).filter((cluster) =>
    passesScalarClusterGuard(claimType, cluster)
  );

  if (!viable.length) return null;

  return (
    [...viable].sort(
      (a, b) =>
        scalarSelectionScore(claimType, b) -
          scalarSelectionScore(claimType, a) ||
        b.score - a.score ||
        b.bestSourceRank - a.bestSourceRank
    )[0] || null
  );
}

function listSelectionScore(claimType = "", cluster = null) {
  if (!cluster) return 0;

  const priorities = arr(cluster.sourceTypes).map((x) =>
    sourcePriorityIndex(claimType, x)
  );

  const bestPriority = priorities.length ? Math.min(...priorities) : 999;
  const priorityCount = claimPolicy(claimType).sourcePriority.length || 1;
  const priorityBonus =
    Math.max(0, (priorityCount - bestPriority) / priorityCount) * 0.18;

  return clampUnit(cluster.score + priorityBonus);
}

function isViableListCluster(claimType = "", cluster = null) {
  if (!cluster) return false;

  const policy = claimPolicy(claimType);
  if (normalizeConfidence(cluster.score, 0) < policy.minClusterScore) return false;

  if (claimType === "faq") {
    const json = getClusterJson(cluster);
    const question = cleanClaimTextForType("faq", s(json.question || cluster.representativeText), json);
    return !!question;
  }

  if (claimType === "social_link") {
    const json = getClusterJson(cluster);
    return !!normalizeObservedUrl(json.url || cluster.representativeText);
  }

  if (claimType === "booking_link" || claimType === "whatsapp_link") {
    const json = getClusterJson(cluster);
    return !!normalizeObservedUrl(json.url || cluster.representativeText);
  }

  const cleaned = cleanClaimTextForType(
    claimType,
    s(cluster.representativeText),
    getClusterJson(cluster)
  );

  return !!cleaned;
}

function pickListClusters(claimType = "", clusters = [], { maxItems = 20 } = {}) {
  return arr(clusters)
    .filter((cluster) => isViableListCluster(claimType, cluster))
    .sort(
      (a, b) =>
        listSelectionScore(claimType, b) - listSelectionScore(claimType, a) ||
        b.score - a.score ||
        b.bestSourceRank - a.bestSourceRank
    )
    .slice(0, maxItems);
}

function detectConflicts(clusterMap = {}) {
  const conflicts = [];

  for (const [claimType, clusters] of Object.entries(obj(clusterMap))) {
    if (!isProtectedScalarClaim(claimType)) continue;

    const viable = arr(clusters).filter((cluster) =>
      passesScalarClusterGuard(claimType, cluster)
    );

    if (viable.length < 2) continue;

    const first = viable[0];
    const second = viable[1];
    if (!first || !second) continue;

    if (second.score >= first.score * 0.8) {
      const outcome = classifyConflictOutcome({
        claimType,
        winner: first,
        runnerUp: second,
      });

      conflicts.push({
        claim_type: claimType,
        category: "claim_conflict",
        type: "source_claim_conflict",
        key: claimType,
        severity: outcome.reviewRequired ? "medium" : "low",
        classification: outcome.classification,
        resolution: outcome.resolution,
        review_required: outcome.reviewRequired,
        message: `${claimType} has competing evidence that requires ${outcome.reviewRequired ? "review" : "winner selection"}`,
        winner: {
          value: cleanClaimTextForType(
            claimType,
            first.representativeText,
            first.representativeJson
          ),
          score: first.score,
          evidence_count: first.evidence.length,
          source_types: first.sourceTypes,
          governance: first.governance,
        },
        runner_up: {
          value: cleanClaimTextForType(
            claimType,
            second.representativeText,
            second.representativeJson
          ),
          score: second.score,
          evidence_count: second.evidence.length,
          source_types: second.sourceTypes,
          governance: second.governance,
        },
        values: [
          cleanClaimTextForType(claimType, first.representativeText, first.representativeJson),
          cleanClaimTextForType(claimType, second.representativeText, second.representativeJson),
        ].filter(Boolean),
        items: [first, second].map((cluster) => ({
          value: cleanClaimTextForType(
            claimType,
            cluster.representativeText,
            cluster.representativeJson
          ),
          score: cluster.score,
          sourceTypes: cluster.sourceTypes,
          governance: cluster.governance,
        })),
        metadataJson: {
          claimType,
          classification: outcome.classification,
          resolution: outcome.resolution,
        },
      });
    }
  }

  return conflicts;
}

function mapSocialLinkClusters(clusters = []) {
  return uniqBy(
    arr(clusters)
      .map((cluster) => {
        const jsonValue = getClusterJson(cluster);
        const url = normalizeObservedUrl(jsonValue.url || cluster.representativeText);
        const platform = s(jsonValue.platform || "social");
        if (!url) return null;

        return {
          platform,
          url,
          score: cluster.score,
          evidence: cluster.evidence,
          sourceTypes: cluster.sourceTypes,
        };
      })
      .filter(Boolean),
    (item) => `${lower(item.platform)}|${normalizeObservedUrl(item.url)}`
  );
}

function mapFaqClusters(clusters = []) {
  return uniqBy(
    arr(clusters)
      .map((cluster) => {
        const jsonValue = getClusterJson(cluster);
        const question = cleanClaimTextForType(
          "faq",
          s(jsonValue.question || cluster.representativeText),
          jsonValue
        );
        const answer = compactText(s(jsonValue.answer), 900);
        if (!question) return null;

        return {
          question,
          answer,
          score: cluster.score,
          evidence: cluster.evidence,
          sourceTypes: cluster.sourceTypes,
        };
      })
      .filter(Boolean),
    (item) => normalizeObservedText(item.question)
  );
}

function buildSelectedClaims(clusterMap = {}) {
  const out = {};
  const conflictMap = new Map(
    detectConflicts(clusterMap).map((conflict) => [s(conflict.claim_type), conflict])
  );

  for (const [claimType, clusters] of Object.entries(obj(clusterMap))) {
    const safeType = s(claimType).toLowerCase();

    if (isProtectedScalarClaim(safeType)) {
      const winner = pickScalarCluster(safeType, clusters);
      const conflict = conflictMap.get(safeType) || null;
      const governance = winner
        ? buildClaimGovernance({
            claimType: safeType,
            score: winner.score,
            evidence: winner.evidence,
            onlyWeakSources: winner.onlyWeakSources,
            conflict: conflict
              ? {
                  classification: s(conflict.classification),
                  resolution: s(conflict.resolution),
                  reviewRequired: !!conflict.review_required,
                }
              : null,
          })
        : null;
      const impact = buildCandidateImpact({
        category:
          safeType === "company_name" || safeType === "website_url"
            ? "company"
            : safeType.startsWith("summary")
              ? "summary"
              : safeType.startsWith("primary_")
                ? safeType === "primary_address"
                  ? "location"
                  : "contact"
                : safeType === "pricing_policy"
                  ? "pricing_policy"
                  : safeType === "support_mode"
                    ? "support"
                    : "knowledge",
        itemKey:
          safeType === "company_name"
            ? "canonical_company_name"
            : safeType === "website_url"
              ? "canonical_website_url"
              : safeType,
      });
      const approvalPolicy = winner
        ? classifyApprovalPolicy({
            title: safeType,
            category:
              safeType === "company_name" || safeType === "website_url"
                ? "company"
                : safeType.startsWith("summary")
                  ? "summary"
                  : safeType.startsWith("primary_")
                    ? safeType === "primary_address"
                      ? "location"
                      : "contact"
                    : safeType === "pricing_policy"
                      ? "pricing_policy"
                      : safeType === "support_mode"
                        ? "support"
                        : "knowledge",
            itemKey:
              safeType === "company_name"
                ? "canonical_company_name"
                : safeType === "website_url"
                  ? "canonical_website_url"
                  : safeType,
            impact,
            governance,
          })
        : null;
      out[safeType] = winner
        ? [
            {
              claimType: safeType,
              valueText: cleanClaimTextForType(
                safeType,
                winner.representativeText,
                winner.representativeJson
              ),
              valueJson: winner.representativeJson,
              score: winner.score,
              evidenceCount: winner.evidence.length,
              evidence: winner.evidence,
              sourceTypes: winner.sourceTypes,
              bestSourceType: winner.bestSourceType,
              governance,
              approvalPolicy,
              status: governance?.quarantine ? "quarantined" : "promotable",
              impact,
            },
          ]
        : [];
      continue;
    }

    if (isListClaim(safeType)) {
      const winners = pickListClusters(safeType, clusters, {
        maxItems:
          safeType === "service"
            ? 24
            : safeType === "product"
              ? 16
              : safeType === "faq"
                ? 16
                : safeType === "social_link"
                  ? 20
                  : 12,
      });

      out[safeType] = winners
        .map((cluster) => {
          const governance = buildClaimGovernance({
            claimType: safeType,
            score: cluster.score,
            evidence: cluster.evidence,
            onlyWeakSources: cluster.onlyWeakSources,
          });
          const category =
            safeType === "service"
              ? "service"
              : safeType === "product"
                ? "product"
                : safeType === "pricing_hint"
                  ? "pricing"
                  : safeType === "working_hours"
                    ? "hours"
                    : safeType === "social_link"
                      ? "social_link"
                      : safeType === "booking_link" || safeType === "whatsapp_link"
                        ? "booking"
                        : "faq";
          const impact = buildCandidateImpact({
            category,
            itemKey: safeType,
          });
          const approvalPolicy = classifyApprovalPolicy({
            title: safeType,
            category,
            itemKey: safeType,
            impact,
            governance,
          });
          const cleaned = cleanClaimTextForType(
            safeType,
            cluster.representativeText,
            cluster.representativeJson
          );

          if (!cleaned && safeType !== "faq" && safeType !== "social_link") return null;

          return {
            claimType: safeType,
            valueText:
              safeType === "faq"
                ? cleanClaimTextForType(
                    "faq",
                    s(cluster.representativeJson?.question || cluster.representativeText),
                    cluster.representativeJson
                  )
                : safeType === "social_link"
                  ? normalizeObservedUrl(
                      cluster.representativeJson?.url || cluster.representativeText
                    )
                  : cleaned,
            valueJson: cluster.representativeJson,
            score: cluster.score,
            evidenceCount: cluster.evidence.length,
            evidence: cluster.evidence,
            sourceTypes: cluster.sourceTypes,
            bestSourceType: cluster.bestSourceType,
            governance,
            approvalPolicy,
            status: governance.quarantine ? "quarantined" : "promotable",
            impact,
          };
        })
        .filter(Boolean);
      continue;
    }

    out[safeType] = [];
  }

  return out;
}

export {
  buildSelectedClaims,
  clusterScore,
  detectConflicts,
  getClusterJson,
  getClusterText,
  groupObservationsByClaimType,
  listSelectionScore,
  mapFaqClusters,
  mapSocialLinkClusters,
  observationScore,
  passesScalarClusterGuard,
  pickListClusters,
  pickScalarCluster,
  scalarSelectionScore,
  stableValueKey,
  uniqueSourceObservations,
  weightedTopAverage,
};
