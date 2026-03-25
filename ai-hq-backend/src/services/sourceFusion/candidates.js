// src/services/sourceFusion/candidates.js
// FINAL v4.0 — candidate projection from fused synthesis
// cleaner review candidates from deterministic synthesis

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
}) {
  return {
    tenantId,
    tenantKey,
    sourceId,
    sourceRunId,
    candidateGroup: "source_fusion_v4",
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
    extractionMethod: "system",
    extractionModel: "source_fusion_v4",
  };
}

function firstEvidence(selectedClaims = {}, claimType = "") {
  return arr(obj(selectedClaims)[claimType])[0]?.evidence || [];
}

function firstClaimScore(selectedClaims = {}, claimType = "", fallback = 0.7) {
  return normalizeConfidence(
    arr(obj(selectedClaims)[claimType])[0]?.score,
    fallback
  );
}

function matchedListClaimScore(selectedClaims = {}, claimType = "", value = "", fallback = 0.7) {
  const key = normalizeObservedText(value);

  const match = arr(obj(selectedClaims)[claimType]).find((item) => {
    const candidateText = normalizeObservedText(
      s(item.valueText || item.value_text || item.value_json?.question || item.value_json?.url || "")
    );
    return candidateText === key;
  });

  return normalizeConfidence(match?.score, fallback);
}

function matchedListEvidence(selectedClaims = {}, claimType = "", value = "") {
  const key = normalizeObservedText(value);

  return (
    arr(obj(selectedClaims)[claimType]).find((item) => {
      const candidateText = normalizeObservedText(
        s(item.valueText || item.value_text || item.value_json?.question || item.value_json?.url || "")
      );
      return candidateText === key;
    })?.evidence || []
  );
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
  const primaryEmail = normalizeObservedEmail(s(profile.primaryEmail || arr(profile.emails)[0]));
  const primaryPhone = normalizeObservedPhone(s(profile.primaryPhone || arr(profile.phones)[0]));
  const primaryAddress = s(profile.primaryAddress || arr(profile.addresses)[0]);
  const pricingPolicy = s(profile.pricingPolicy);
  const supportMode = s(profile.supportMode);

  if (companyName) {
    const score = Math.max(
      firstClaimScore(selectedClaims, "company_name", synthesis?.confidence || 0.78),
      0.5
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "company",
        itemKey: "canonical_company_name",
        title: "Business name",
        valueText: companyName,
        valueJson: { company_name: companyName },
        normalizedText: normalizeObservedText(companyName),
        normalizedJson: { company_name: companyName },
        confidence: score,
        reviewReason: "Business name selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "company_name"),
      })
    );
  }

  if (websiteUrl) {
    const score = Math.max(
      firstClaimScore(selectedClaims, "website_url", synthesis?.confidence || 0.78),
      0.5
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "company",
        itemKey: "canonical_website_url",
        title: "Website URL",
        valueText: websiteUrl,
        valueJson: { url: websiteUrl },
        normalizedText: normalizeObservedUrl(websiteUrl),
        normalizedJson: { url: normalizeObservedUrl(websiteUrl) },
        confidence: score,
        reviewReason: "Primary website URL selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "website_url"),
      })
    );
  }

  if (summaryShort) {
    const score = Math.max(firstClaimScore(selectedClaims, "summary_short", 0.66), 0.46);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "summary",
        itemKey: "company_summary_short",
        title: "Business summary",
        valueText: summaryShort,
        valueJson: { summary: summaryShort },
        normalizedText: normalizeObservedText(summaryShort),
        normalizedJson: { summary: summaryShort },
        confidence: score,
        reviewReason: "Short business summary selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "summary_short"),
      })
    );
  }

  if (summaryLong) {
    const score = Math.max(firstClaimScore(selectedClaims, "summary_long", 0.62), 0.42);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "summary",
        itemKey: "company_summary_long",
        title: "Business overview",
        valueText: summaryLong,
        valueJson: { summary: summaryLong },
        normalizedText: normalizeObservedText(summaryLong),
        normalizedJson: { summary: summaryLong },
        confidence: score,
        reviewReason: "Long business overview selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "summary_long"),
      })
    );
  }

  if (primaryEmail) {
    const score = Math.max(firstClaimScore(selectedClaims, "primary_email", 0.7), 0.5);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "contact",
        itemKey: `email_${safeKeyPart(primaryEmail, "email")}`,
        title: "Primary email",
        valueText: primaryEmail,
        valueJson: { email: primaryEmail },
        normalizedText: normalizeObservedEmail(primaryEmail),
        normalizedJson: { email: normalizeObservedEmail(primaryEmail) },
        confidence: score,
        reviewReason: "Primary email selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "primary_email"),
      })
    );
  }

  if (primaryPhone) {
    const score = Math.max(firstClaimScore(selectedClaims, "primary_phone", 0.7), 0.5);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "contact",
        itemKey: `phone_${safeKeyPart(primaryPhone, "phone")}`,
        title: "Primary phone",
        valueText: primaryPhone,
        valueJson: { phone: primaryPhone },
        normalizedText: normalizeObservedPhone(primaryPhone),
        normalizedJson: { phone: normalizeObservedPhone(primaryPhone) },
        confidence: score,
        reviewReason: "Primary phone selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "primary_phone"),
      })
    );
  }

  if (primaryAddress) {
    const score = Math.max(firstClaimScore(selectedClaims, "primary_address", 0.64), 0.46);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "location",
        itemKey: "primary_address",
        title: "Primary address",
        valueText: primaryAddress,
        valueJson: { address: primaryAddress },
        normalizedText: normalizeObservedText(primaryAddress),
        normalizedJson: { address: normalizeObservedText(primaryAddress) },
        confidence: score,
        reviewReason: "Primary address selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "primary_address"),
      })
    );
  }

  for (const item of arr(profile.services)) {
    const score = Math.max(matchedListClaimScore(selectedClaims, "service", item, 0.62), 0.42);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "service",
        itemKey: safeKeyPart(item, "service"),
        title: "Service",
        valueText: item,
        valueJson: { service: item },
        normalizedText: normalizeObservedText(item),
        normalizedJson: { service: item },
        confidence: score,
        reviewReason: "Service selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "service", item),
      })
    );
  }

  for (const item of arr(profile.products)) {
    const score = Math.max(matchedListClaimScore(selectedClaims, "product", item, 0.58), 0.4);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "product",
        itemKey: safeKeyPart(item, "product"),
        title: "Product or package",
        valueText: item,
        valueJson: { product: item },
        normalizedText: normalizeObservedText(item),
        normalizedJson: { product: item },
        confidence: score,
        reviewReason: "Product or package selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "product", item),
      })
    );
  }

  for (const item of arr(profile.pricingHints)) {
    const score = Math.max(
      matchedListClaimScore(selectedClaims, "pricing_hint", item, 0.56),
      0.4
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "pricing",
        itemKey: safeKeyPart(item, "pricing"),
        title: "Pricing hint",
        valueText: item,
        valueJson: { text: item },
        normalizedText: normalizeObservedText(item),
        normalizedJson: { text: item },
        confidence: score,
        reviewReason: "Pricing hint selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "pricing_hint", item),
      })
    );
  }

  if (pricingPolicy) {
    const score = Math.max(firstClaimScore(selectedClaims, "pricing_policy", 0.56), 0.4);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "pricing_policy",
        itemKey: "pricing_policy",
        title: "Pricing policy",
        valueText: pricingPolicy,
        valueJson: { policy: pricingPolicy },
        normalizedText: normalizeObservedText(pricingPolicy),
        normalizedJson: { policy: pricingPolicy },
        confidence: score,
        reviewReason: "Pricing policy selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "pricing_policy"),
      })
    );
  }

  if (supportMode) {
    const score = Math.max(firstClaimScore(selectedClaims, "support_mode", 0.56), 0.4);

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "support",
        itemKey: "support_mode",
        title: "Support mode",
        valueText: supportMode,
        valueJson: { support_mode: supportMode },
        normalizedText: normalizeObservedText(supportMode),
        normalizedJson: { support_mode: supportMode },
        confidence: score,
        reviewReason: "Support mode selected from synthesized source evidence",
        sourceEvidenceJson: firstEvidence(selectedClaims, "support_mode"),
      })
    );
  }

  for (const item of arr(profile.hours)) {
    const score = Math.max(
      matchedListClaimScore(selectedClaims, "working_hours", item, 0.62),
      0.46
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "hours",
        itemKey: safeKeyPart(item, "hours"),
        title: "Working hours",
        valueText: item,
        valueJson: { hours: item },
        normalizedText: normalizeObservedText(item),
        normalizedJson: { hours: item },
        confidence: score,
        reviewReason: "Working hours selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "working_hours", item),
      })
    );
  }

  for (const item of arr(profile.socialLinks)) {
    const url = normalizeObservedUrl(s(item?.url));
    const platform = s(item?.platform);
    if (!url || !platform) continue;

    const score = Math.max(
      matchedListClaimScore(selectedClaims, "social_link", url, 0.62),
      0.46
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "social_link",
        itemKey: safeKeyPart(`${platform}_${url}`, "social"),
        title: `${platform} link`,
        valueText: url,
        valueJson: { platform, url },
        normalizedText: normalizeObservedUrl(url),
        normalizedJson: {
          platform: lower(platform),
          url: normalizeObservedUrl(url),
        },
        confidence: score,
        reviewReason: "Social link selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "social_link", url),
      })
    );
  }

  for (const item of arr(profile.bookingLinks)) {
    const url = normalizeObservedUrl(item);
    if (!url) continue;

    const score = Math.max(
      matchedListClaimScore(selectedClaims, "booking_link", url, 0.62),
      0.46
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "booking",
        itemKey: safeKeyPart(url, "booking"),
        title: "Booking link",
        valueText: url,
        valueJson: { url },
        normalizedText: normalizeObservedUrl(url),
        normalizedJson: { url: normalizeObservedUrl(url) },
        confidence: score,
        reviewReason: "Booking link selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "booking_link", url),
      })
    );
  }

  for (const item of arr(profile.whatsappLinks)) {
    const url = normalizeObservedUrl(item);
    if (!url) continue;

    const score = Math.max(
      matchedListClaimScore(selectedClaims, "whatsapp_link", url, 0.66),
      0.5
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "booking",
        itemKey: safeKeyPart(url, "whatsapp"),
        title: "WhatsApp link",
        valueText: url,
        valueJson: { type: "whatsapp", url },
        normalizedText: normalizeObservedUrl(url),
        normalizedJson: { type: "whatsapp", url: normalizeObservedUrl(url) },
        confidence: score,
        reviewReason: "WhatsApp link selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "whatsapp_link", url),
      })
    );
  }

  for (const item of arr(profile.faqItems)) {
    const question = s(item?.question);
    const answer = s(item?.answer);
    if (!question) continue;

    const combined = answer ? `${question} — ${answer}` : question;
    const score = Math.max(
      matchedListClaimScore(selectedClaims, "faq", question, 0.58),
      0.42
    );

    pushCandidate(
      candidates,
      makeCandidate({
        tenantId,
        tenantKey,
        sourceId,
        sourceRunId,
        category: "faq",
        itemKey: safeKeyPart(question, "faq"),
        title: question,
        valueText: combined,
        valueJson: { question, answer },
        normalizedText: normalizeObservedText(question),
        normalizedJson: { question, answer },
        confidence: score,
        reviewReason: "FAQ selected from synthesized source evidence",
        sourceEvidenceJson: matchedListEvidence(selectedClaims, "faq", question),
      })
    );
  }

  return dedupeCandidateRows(candidates);
}

export {
  buildCandidatesFromSynthesis,
  firstClaimScore,
  firstEvidence,
  makeCandidate,
  matchedListClaimScore,
  matchedListEvidence,
};