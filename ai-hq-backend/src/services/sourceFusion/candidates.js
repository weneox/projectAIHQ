// src/services/sourceFusion/candidates.js
// FINAL v5.0 - candidate projection from fused synthesis with governance hardening

import {
  arr,
  confidenceLabel,
  lower,
  normalizeConfidence,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
  obj,
  s,
  safeKeyPart,
} from "./shared.js";
import { buildCandidateImpact } from "./governance.js";
import { classifyApprovalPolicy } from "./approvalPolicy.js";

function makeCandidate({
  tenantId,
  tenantKey,
  sourceId,
  sourceRunId,
  category,
  itemKey,
  title,
  valueText,
  valueJson,
  normalizedText,
  normalizedJson,
  confidence = 0.7,
  reviewReason = "",
  sourceEvidenceJson = [],
  metadataJson = {},
}) {
  return {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    candidateGroup: "source_fusion_v5",
    category,
    itemKey,
    title,
    valueText,
    valueJson,
    normalizedText,
    normalizedJson,
    confidence: normalizeConfidence(confidence, 0.7),
    confidenceLabel: confidenceLabel(confidence),
    status: "pending",
    reviewReason,
    sourceEvidenceJson,
    metadataJson: obj(metadataJson),
    extractionMethod: "system",
    extractionModel: "source_fusion_v5",
  };
}

function firstClaim(selectedClaims = {}, claimType = "") {
  return arr(obj(selectedClaims)[claimType])[0] || null;
}

function firstEvidence(selectedClaims = {}, claimType = "") {
  return firstClaim(selectedClaims, claimType)?.evidence || [];
}

function firstClaimScore(selectedClaims = {}, claimType = "", fallback = 0.7) {
  return normalizeConfidence(firstClaim(selectedClaims, claimType)?.score, fallback);
}

function matchedListClaim(selectedClaims = {}, claimType = "", value = "") {
  const key = normalizeObservedText(value);

  return (
    arr(obj(selectedClaims)[claimType]).find((item) => {
      const candidateText = normalizeObservedText(
        s(
          item.valueText ||
            item.value_text ||
            item.value_json?.question ||
            item.value_json?.url ||
            ""
        )
      );
      return candidateText === key;
    }) || null
  );
}

function matchedListClaimScore(selectedClaims = {}, claimType = "", value = "", fallback = 0.7) {
  return normalizeConfidence(matchedListClaim(selectedClaims, claimType, value)?.score, fallback);
}

function matchedListEvidence(selectedClaims = {}, claimType = "", value = "") {
  return matchedListClaim(selectedClaims, claimType, value)?.evidence || [];
}

function dedupeCandidateRows(rows = []) {
  const seen = new Set();

  return arr(rows).filter((item) => {
    const key = [
      lower(item.category),
      lower(item.itemKey),
      lower(item.normalizedText || item.valueText),
    ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushCandidate(out = [], candidate = null) {
  if (!candidate) return;
  if (!s(candidate.title) || !s(candidate.itemKey) || !s(candidate.category)) return;
  out.push(candidate);
}

function shouldPromoteClaim(claim = null) {
  return obj(claim?.governance).quarantine !== true;
}

function buildCandidateMetadata(claim = null, { category = "", itemKey = "" } = {}) {
  const safeClaim = obj(claim);

  return {
    governance: obj(safeClaim.governance),
    impact: Object.keys(obj(safeClaim.impact)).length
      ? obj(safeClaim.impact)
      : buildCandidateImpact({ category, itemKey }),
    approvalPolicy: Object.keys(obj(safeClaim.approvalPolicy || safeClaim.approval_policy)).length
      ? obj(safeClaim.approvalPolicy || safeClaim.approval_policy)
      : classifyApprovalPolicy({
          title: s(safeClaim.valueText || safeClaim.value_text || itemKey || category),
          category,
          itemKey,
          impact: Object.keys(obj(safeClaim.impact)).length
            ? obj(safeClaim.impact)
            : buildCandidateImpact({ category, itemKey }),
          governance: obj(safeClaim.governance),
        }),
    selectedClaimStatus: s(safeClaim.status),
    sourceTypes: arr(safeClaim.sourceTypes || safeClaim.source_types),
    bestSourceType: s(safeClaim.bestSourceType || safeClaim.best_source_type),
  };
}

function addScalarCandidate(candidates = [], config = {}) {
  const {
    selectedClaims,
    claimType,
    fallbackScore,
    synthesisConfidence = 0.7,
    category,
    itemKey,
    title,
    valueText,
    valueJson,
    normalizedText,
    normalizedJson,
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    reviewReason,
  } = config;

  if (!s(valueText)) return;

  const claim = firstClaim(selectedClaims, claimType);
  if (!shouldPromoteClaim(claim)) return;

  const score = Math.max(
    firstClaimScore(selectedClaims, claimType, synthesisConfidence || fallbackScore),
    fallbackScore
  );

  pushCandidate(
    candidates,
    makeCandidate({
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      category,
      itemKey,
      title,
      valueText,
      valueJson,
      normalizedText,
      normalizedJson,
      confidence: score,
      reviewReason,
      sourceEvidenceJson: firstEvidence(selectedClaims, claimType),
      metadataJson: buildCandidateMetadata(claim, { category, itemKey }),
    })
  );
}

function addListCandidate(candidates = [], config = {}) {
  const {
    selectedClaims,
    claimType,
    fallbackScore,
    category,
    itemKey,
    title,
    valueText,
    valueJson,
    normalizedText,
    normalizedJson,
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    reviewReason,
  } = config;

  if (!s(valueText)) return;

  const claim = matchedListClaim(selectedClaims, claimType, valueText);
  if (!shouldPromoteClaim(claim)) return;

  const score = Math.max(
    matchedListClaimScore(selectedClaims, claimType, valueText, fallbackScore),
    fallbackScore
  );

  pushCandidate(
    candidates,
    makeCandidate({
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      category,
      itemKey,
      title,
      valueText,
      valueJson,
      normalizedText,
      normalizedJson,
      confidence: score,
      reviewReason,
      sourceEvidenceJson: matchedListEvidence(selectedClaims, claimType, valueText),
      metadataJson: buildCandidateMetadata(claim, { category, itemKey }),
    })
  );
}

function buildCandidatesFromSynthesis({
  tenantId,
  tenantKey,
  sourceId,
  sourceRunId,
  synthesis,
}) {
  const profile = obj(synthesis?.profile);
  const selectedClaims = obj(synthesis?.selectedClaims);
  const candidates = [];

  const companyName =
    s(profile.companyName) ||
    s(profile.companyTitle) ||
    s(profile.displayName) ||
    s(arr(profile.businessNames)[0]);

  const websiteUrl = normalizeObservedUrl(s(profile.websiteUrl));
  const summaryShort = s(profile.summaryShort || profile.companySummaryShort);
  const summaryLong = s(profile.summaryLong || profile.companySummaryLong);
  const primaryEmail = normalizeObservedEmail(
    s(profile.primaryEmail || arr(profile.emails)[0])
  );
  const primaryPhone = normalizeObservedPhone(
    s(profile.primaryPhone || arr(profile.phones)[0])
  );
  const primaryAddress = s(profile.primaryAddress || arr(profile.addresses)[0]);
  const pricingPolicy = s(profile.pricingPolicy);
  const supportMode = s(profile.supportMode);

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "company_name",
    fallbackScore: 0.5,
    synthesisConfidence: synthesis?.confidence || 0.78,
    category: "company",
    itemKey: "canonical_company_name",
    title: "Business name",
    valueText: companyName,
    valueJson: { company_name: companyName },
    normalizedText: normalizeObservedText(companyName),
    normalizedJson: { company_name: companyName },
    reviewReason: "Business name selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "website_url",
    fallbackScore: 0.5,
    synthesisConfidence: synthesis?.confidence || 0.78,
    category: "company",
    itemKey: "canonical_website_url",
    title: "Website URL",
    valueText: websiteUrl,
    valueJson: { url: websiteUrl },
    normalizedText: normalizeObservedUrl(websiteUrl),
    normalizedJson: { url: normalizeObservedUrl(websiteUrl) },
    reviewReason: "Primary website URL selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "summary_short",
    fallbackScore: 0.46,
    synthesisConfidence: 0.66,
    category: "summary",
    itemKey: "company_summary_short",
    title: "Business summary",
    valueText: summaryShort,
    valueJson: { summary: summaryShort },
    normalizedText: normalizeObservedText(summaryShort),
    normalizedJson: { summary: summaryShort },
    reviewReason: "Short business summary selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "summary_long",
    fallbackScore: 0.42,
    synthesisConfidence: 0.62,
    category: "summary",
    itemKey: "company_summary_long",
    title: "Business overview",
    valueText: summaryLong,
    valueJson: { summary: summaryLong },
    normalizedText: normalizeObservedText(summaryLong),
    normalizedJson: { summary: summaryLong },
    reviewReason: "Long business overview selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "primary_email",
    fallbackScore: 0.5,
    synthesisConfidence: 0.7,
    category: "contact",
    itemKey: `email_${safeKeyPart(primaryEmail, "email")}`,
    title: "Primary email",
    valueText: primaryEmail,
    valueJson: { email: primaryEmail },
    normalizedText: normalizeObservedEmail(primaryEmail),
    normalizedJson: { email: normalizeObservedEmail(primaryEmail) },
    reviewReason: "Primary email selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "primary_phone",
    fallbackScore: 0.5,
    synthesisConfidence: 0.7,
    category: "contact",
    itemKey: `phone_${safeKeyPart(primaryPhone, "phone")}`,
    title: "Primary phone",
    valueText: primaryPhone,
    valueJson: { phone: primaryPhone },
    normalizedText: normalizeObservedPhone(primaryPhone),
    normalizedJson: { phone: normalizeObservedPhone(primaryPhone) },
    reviewReason: "Primary phone selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "primary_address",
    fallbackScore: 0.46,
    synthesisConfidence: 0.64,
    category: "location",
    itemKey: "primary_address",
    title: "Primary address",
    valueText: primaryAddress,
    valueJson: { address: primaryAddress },
    normalizedText: normalizeObservedText(primaryAddress),
    normalizedJson: { address: normalizeObservedText(primaryAddress) },
    reviewReason: "Primary address selected from synthesized source evidence",
  });

  for (const item of arr(profile.services)) {
    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "service",
      fallbackScore: 0.42,
      category: "service",
      itemKey: safeKeyPart(item, "service"),
      title: "Service",
      valueText: item,
      valueJson: { service: item },
      normalizedText: normalizeObservedText(item),
      normalizedJson: { service: item },
      reviewReason: "Service selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.products)) {
    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "product",
      fallbackScore: 0.4,
      category: "product",
      itemKey: safeKeyPart(item, "product"),
      title: "Product or package",
      valueText: item,
      valueJson: { product: item },
      normalizedText: normalizeObservedText(item),
      normalizedJson: { product: item },
      reviewReason: "Product or package selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.pricingHints)) {
    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "pricing_hint",
      fallbackScore: 0.4,
      category: "pricing",
      itemKey: safeKeyPart(item, "pricing"),
      title: "Pricing hint",
      valueText: item,
      valueJson: { text: item },
      normalizedText: normalizeObservedText(item),
      normalizedJson: { text: item },
      reviewReason: "Pricing hint selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.policyHighlights)) {
    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "policy_highlight",
      fallbackScore: 0.4,
      category: "policy",
      itemKey: safeKeyPart(item, "policy"),
      title: "Policy highlight",
      valueText: item,
      valueJson: { policy: item },
      normalizedText: normalizeObservedText(item),
      normalizedJson: { policy: item },
      reviewReason: "Policy highlight selected from synthesized source evidence",
    });
  }

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "pricing_policy",
    fallbackScore: 0.4,
    synthesisConfidence: 0.56,
    category: "pricing_policy",
    itemKey: "pricing_policy",
    title: "Pricing policy",
    valueText: pricingPolicy,
    valueJson: { policy: pricingPolicy },
    normalizedText: normalizeObservedText(pricingPolicy),
    normalizedJson: { policy: pricingPolicy },
    reviewReason: "Pricing policy selected from synthesized source evidence",
  });

  addScalarCandidate(candidates, {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    selectedClaims,
    claimType: "support_mode",
    fallbackScore: 0.4,
    synthesisConfidence: 0.56,
    category: "support",
    itemKey: "support_mode",
    title: "Support mode",
    valueText: supportMode,
    valueJson: { support_mode: supportMode },
    normalizedText: normalizeObservedText(supportMode),
    normalizedJson: { support_mode: supportMode },
    reviewReason: "Support mode selected from synthesized source evidence",
  });

  for (const item of arr(profile.hours)) {
    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "working_hours",
      fallbackScore: 0.46,
      category: "hours",
      itemKey: safeKeyPart(item, "hours"),
      title: "Working hours",
      valueText: item,
      valueJson: { hours: item },
      normalizedText: normalizeObservedText(item),
      normalizedJson: { hours: item },
      reviewReason: "Working hours selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.socialLinks)) {
    const url = normalizeObservedUrl(s(item?.url));
    const platform = s(item?.platform);
    if (!url || !platform) continue;

    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "social_link",
      fallbackScore: 0.46,
      category: "social_link",
      itemKey: safeKeyPart(`${platform}_${url}`, "social"),
      title: `${platform} link`,
      valueText: url,
      valueJson: { platform, url },
      normalizedText: normalizeObservedUrl(url),
      normalizedJson: { platform: lower(platform), url: normalizeObservedUrl(url) },
      reviewReason: "Social link selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.bookingLinks)) {
    const url = normalizeObservedUrl(item);
    if (!url) continue;

    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "booking_link",
      fallbackScore: 0.46,
      category: "booking",
      itemKey: safeKeyPart(url, "booking"),
      title: "Booking link",
      valueText: url,
      valueJson: { url },
      normalizedText: normalizeObservedUrl(url),
      normalizedJson: { url: normalizeObservedUrl(url) },
      reviewReason: "Booking link selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.whatsappLinks)) {
    const url = normalizeObservedUrl(item);
    if (!url) continue;

    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "whatsapp_link",
      fallbackScore: 0.5,
      category: "booking",
      itemKey: safeKeyPart(url, "whatsapp"),
      title: "WhatsApp link",
      valueText: url,
      valueJson: { type: "whatsapp", url },
      normalizedText: normalizeObservedUrl(url),
      normalizedJson: { type: "whatsapp", url: normalizeObservedUrl(url) },
      reviewReason: "WhatsApp link selected from synthesized source evidence",
    });
  }

  for (const item of arr(profile.faqItems)) {
    const question = s(item?.question);
    const answer = s(item?.answer);
    if (!question) continue;

    addListCandidate(candidates, {
      tenantId,
      tenantKey,
      sourceId,
      sourceRunId,
      selectedClaims,
      claimType: "faq",
      fallbackScore: 0.42,
      category: "faq",
      itemKey: safeKeyPart(question, "faq"),
      title: question,
      valueText: answer ? `${question} - ${answer}` : question,
      valueJson: { question, answer },
      normalizedText: normalizeObservedText(question),
      normalizedJson: { question, answer },
      reviewReason: "FAQ selected from synthesized source evidence",
    });
  }

  return dedupeCandidateRows(candidates);
}

export {
  buildCandidatesFromSynthesis,
  firstClaim,
  firstClaimScore,
  firstEvidence,
  makeCandidate,
  matchedListClaim,
  matchedListClaimScore,
  matchedListEvidence,
};
