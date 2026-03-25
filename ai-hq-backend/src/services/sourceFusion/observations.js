// src/services/sourceFusion/observations.js
// FINAL v4.0 — observation builders
// cleaner observation layer for deterministic synthesis

import {
  arr,
  confidenceLabel,
  lower,
  normalizeObservedEmail,
  normalizeObservedPhone,
  normalizeObservedText,
  normalizeObservedUrl,
  obj,
  s,
  safeKeyPart,
} from "./shared.js";

function makeObservationBase({
  source,
  run,
  sourceType = "",
  extracted = {},
  profile = {},
}) {
  return {
    sourceId: s(source?.id),
    sourceRunId: s(run?.id),
    sourceType: s(sourceType || source?.source_type || source?.type || "unknown"),
    pageUrl: s(extracted?.finalUrl || extracted?.sourceUrl || source?.source_url || source?.url),
    pageTitle:
      s(profile?.companyTitle || profile?.companyName || profile?.displayName || ""),
    sourceUrl: s(source?.source_url || source?.url),
    finalUrl: s(extracted?.finalUrl || extracted?.sourceUrl || ""),
    crawlPagesScanned: Number(extracted?.site?.pagesScanned || 0),
    siteQuality: obj(extracted?.site?.quality),
    discovery: obj(extracted?.discovery),
    crawlWarnings: arr(extracted?.crawl?.warnings),
  };
}

function pushObservation(out = [], base = {}, payload = {}) {
  const text = s(payload.rawValueText);
  const jsonValue = obj(payload.rawValueJson);

  if (!text && !Object.keys(jsonValue).length) return;

  const confidence = Number(payload.confidence ?? 0.7);
  const normalizedValueText = s(payload.normalizedValueText);
  const normalizedValueJson = obj(payload.normalizedValueJson);
  const metadataJson = {
    source_url: base.sourceUrl,
    final_url: base.finalUrl,
    crawl_pages_scanned: base.crawlPagesScanned,
    site_quality: base.siteQuality,
    discovery: base.discovery,
    crawl_warnings: base.crawlWarnings,
    ...obj(payload.metadataJson),
  };

  out.push({
    sourceId: base.sourceId,
    sourceRunId: base.sourceRunId,
    sourceType: base.sourceType,
    observationGroup: s(payload.observationGroup || "general"),
    claimType: s(payload.claimType),
    claimKey: s(payload.claimKey),
    rawValueText: text,
    rawValueJson: jsonValue,
    normalizedValueText,
    normalizedValueJson,
    evidenceText: s(payload.evidenceText),
    pageUrl: base.pageUrl,
    pageTitle: base.pageTitle,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    resolutionStatus: "pending",
    extractionMethod: s(payload.extractionMethod || "pipeline"),
    extractionModel: s(payload.extractionModel || "source_fusion_v4"),
    metadataJson,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

function dedupeObservationRows(rows = []) {
  const seen = new Set();

  return arr(rows).filter((item) => {
    const key = [
      lower(item.claimType),
      lower(item.claimKey),
      lower(item.normalizedValueText || item.rawValueText),
    ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildWebsiteObservations({
  source,
  run,
  extracted,
  profile,
}) {
  const out = [];
  const x = obj(profile);
  const base = makeObservationBase({
    source,
    run,
    sourceType: "website",
    extracted,
    profile: x,
  });

  const companyName =
    s(x.companyTitle) ||
    s(x.companyName) ||
    s(x.displayName) ||
    s(arr(x.businessNames)[0]);

  if (companyName) {
    pushObservation(out, base, {
      observationGroup: "identity",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: companyName,
      rawValueJson: { company_name: companyName },
      normalizedValueText: normalizeObservedText(companyName),
      normalizedValueJson: { company_name: companyName },
      evidenceText: "Synthesized business name from website signals",
      confidence: Math.max(Number(x.confidence || 0.9), 0.78),
    });
  }

  if (s(x.websiteUrl || extracted?.finalUrl || extracted?.sourceUrl)) {
    const websiteUrl = s(x.websiteUrl || extracted?.finalUrl || extracted?.sourceUrl);
    const normalizedUrl = normalizeObservedUrl(websiteUrl);

    if (normalizedUrl) {
      pushObservation(out, base, {
        observationGroup: "identity",
        claimType: "website_url",
        claimKey: "website_url",
        rawValueText: normalizedUrl,
        rawValueJson: { url: normalizedUrl },
        normalizedValueText: normalizedUrl,
        normalizedValueJson: { url: normalizedUrl },
        evidenceText: "Primary website URL",
        confidence: 0.99,
      });
    }
  }

  if (s(x.companySummaryShort || x.summaryShort)) {
    const summary = s(x.companySummaryShort || x.summaryShort);

    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "summary_short",
      rawValueText: summary,
      rawValueJson: { summary },
      normalizedValueText: normalizeObservedText(summary),
      normalizedValueJson: { summary },
      evidenceText: "Synthesized short summary from website signals",
      confidence: 0.88,
    });
  }

  if (s(x.companySummaryLong || x.summaryLong)) {
    const summary = s(x.companySummaryLong || x.summaryLong);

    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_long",
      claimKey: "summary_long",
      rawValueText: summary,
      rawValueJson: { summary },
      normalizedValueText: normalizeObservedText(summary),
      normalizedValueJson: { summary },
      evidenceText: "Synthesized long summary from website signals",
      confidence: 0.83,
    });
  }

  for (const phone of arr(x.phones)) {
    const normalized = normalizeObservedPhone(phone);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_phone",
      claimKey: `phone_${safeKeyPart(normalized || phone, "phone")}`,
      rawValueText: normalized,
      rawValueJson: { phone: normalized },
      normalizedValueText: normalized,
      normalizedValueJson: { phone: normalized },
      evidenceText: "Phone detected on website",
      confidence: 0.95,
    });
  }

  for (const email of arr(x.emails)) {
    const normalized = normalizeObservedEmail(email);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "contact",
      claimType: "primary_email",
      claimKey: `email_${safeKeyPart(normalized, "email")}`,
      rawValueText: normalized,
      rawValueJson: { email: normalized },
      normalizedValueText: normalized,
      normalizedValueJson: { email: normalized },
      evidenceText: "Email detected on website",
      confidence: 0.97,
    });
  }

  for (const address of arr(x.addresses)) {
    const normalized = normalizeObservedText(address);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "location",
      claimType: "primary_address",
      claimKey: `address_${safeKeyPart(normalized, "address")}`,
      rawValueText: address,
      rawValueJson: { address },
      normalizedValueText: normalized,
      normalizedValueJson: { address: normalized },
      evidenceText: "Address or location text detected on website",
      confidence: 0.86,
    });
  }

  for (const item of arr(x.hours)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "hours",
      claimType: "working_hours",
      claimKey: `hours_${safeKeyPart(normalized, "hours")}`,
      rawValueText: item,
      rawValueJson: { hours: item },
      normalizedValueText: normalized,
      normalizedValueJson: { hours: normalized },
      evidenceText: "Working hours detected on website",
      confidence: 0.9,
    });
  }

  for (const item of arr(x.services)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "offerings",
      claimType: "service",
      claimKey: `service_${safeKeyPart(normalized, "service")}`,
      rawValueText: item,
      rawValueJson: { service: item },
      normalizedValueText: normalized,
      normalizedValueJson: { service: item },
      evidenceText: "Service detected on website",
      confidence: 0.89,
    });
  }

  for (const item of arr(x.products)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "offerings",
      claimType: "product",
      claimKey: `product_${safeKeyPart(normalized, "product")}`,
      rawValueText: item,
      rawValueJson: { product: item },
      normalizedValueText: normalized,
      normalizedValueJson: { product: item },
      evidenceText: "Product or package detected on website",
      confidence: 0.78,
    });
  }

  for (const item of arr(x.pricingHints)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_hint",
      claimKey: `pricing_${safeKeyPart(normalized, "pricing")}`,
      rawValueText: item,
      rawValueJson: { text: item },
      normalizedValueText: normalized,
      normalizedValueJson: { text: item },
      evidenceText: "Pricing hint detected on website",
      confidence: 0.84,
    });
  }

  if (s(x.pricingPolicy)) {
    pushObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_policy",
      claimKey: "pricing_policy",
      rawValueText: s(x.pricingPolicy),
      rawValueJson: { policy: s(x.pricingPolicy) },
      normalizedValueText: normalizeObservedText(s(x.pricingPolicy)),
      normalizedValueJson: { policy: s(x.pricingPolicy) },
      evidenceText: "Pricing policy inferred from website",
      confidence: 0.76,
    });
  }

  if (s(x.supportMode)) {
    pushObservation(out, base, {
      observationGroup: "support",
      claimType: "support_mode",
      claimKey: "support_mode",
      rawValueText: s(x.supportMode),
      rawValueJson: { support_mode: s(x.supportMode) },
      normalizedValueText: normalizeObservedText(s(x.supportMode)),
      normalizedValueJson: { support_mode: s(x.supportMode) },
      evidenceText: "Support or contact mode inferred from website",
      confidence: 0.78,
    });
  }

  for (const item of arr(x.socialLinks)) {
    const platform = s(item?.platform);
    const url = normalizeObservedUrl(s(item?.url));
    if (!platform || !url) continue;

    pushObservation(out, base, {
      observationGroup: "social",
      claimType: "social_link",
      claimKey: `${safeKeyPart(platform, "social")}_${safeKeyPart(url, "url")}`,
      rawValueText: url,
      rawValueJson: { platform, url },
      normalizedValueText: url,
      normalizedValueJson: { platform: lower(platform), url },
      evidenceText: `${platform} link detected on website`,
      confidence: 0.93,
    });
  }

  for (const urlRaw of arr(x.bookingLinks)) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushObservation(out, base, {
      observationGroup: "booking",
      claimType: "booking_link",
      claimKey: `booking_${safeKeyPart(url, "booking")}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "Booking or consultation link detected on website",
      confidence: 0.88,
    });
  }

  for (const urlRaw of arr(x.whatsappLinks)) {
    const url = normalizeObservedUrl(urlRaw);
    if (!url) continue;

    pushObservation(out, base, {
      observationGroup: "booking",
      claimType: "whatsapp_link",
      claimKey: `whatsapp_${safeKeyPart(url, "whatsapp")}`,
      rawValueText: url,
      rawValueJson: { url },
      normalizedValueText: url,
      normalizedValueJson: { url },
      evidenceText: "WhatsApp link detected on website",
      confidence: 0.95,
    });
  }

  for (const item of arr(x.faqItems)) {
    const question = s(item?.question);
    const answer = s(item?.answer);
    if (!question) continue;

    pushObservation(out, base, {
      observationGroup: "faq",
      claimType: "faq",
      claimKey: `faq_${safeKeyPart(question, "faq")}`,
      rawValueText: answer ? `${question} — ${answer}` : question,
      rawValueJson: { question, answer },
      normalizedValueText: normalizeObservedText(question),
      normalizedValueJson: { question, answer },
      evidenceText: "FAQ detected on website",
      confidence: answer ? 0.88 : 0.72,
    });
  }

  return dedupeObservationRows(out);
}

export {
  buildWebsiteObservations,
};