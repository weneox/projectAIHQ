// src/services/sourceFusion/observations.js
// FINAL v5.0 - observation builders with page-level website evidence

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
  uniqStrings,
} from "./shared.js";

function compactText(value = "", max = 360) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

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
    pageTitle: s(profile?.companyTitle || profile?.companyName || profile?.displayName || ""),
    sourceUrl: s(source?.source_url || source?.url),
    finalUrl: s(extracted?.finalUrl || extracted?.sourceUrl || ""),
    crawlPagesScanned: Number(extracted?.site?.pagesScanned || 0),
    siteQuality: obj(extracted?.site?.quality),
    discovery: obj(extracted?.discovery),
    crawlWarnings: arr(extracted?.crawl?.warnings),
  };
}

function websiteArtifactKey(pageUrl = "") {
  const url = s(pageUrl);
  if (!url) return "";
  return `website_page:${safeKeyPart(url, "page", 120)}`;
}

function normalizePageType(page = {}) {
  const pageType = lower(page?.pageType);
  if (pageType === "locations") return "location";
  if (pageType === "policy") return "policies";
  if (pageType === "generic") {
    try {
      const pathname = new URL(s(page?.canonicalUrl || page?.url)).pathname || "/";
      if (pathname === "/" || pathname === "") return "home";
    } catch {}
    return "other";
  }
  return s(page?.pageType || "other");
}

function pageContentPool(page = {}) {
  return [
    s(page?.title),
    s(page?.metaDescription),
    s(page?.visibleExcerpt),
    s(page?.text),
    ...arr(page?.headings),
    ...arr(page?.paragraphs),
    ...arr(page?.listItems),
    ...arr(page?.serviceHints),
    ...arr(page?.pricingHints),
    ...arr(page?.hours),
    ...arr(page?.addresses),
    ...arr(page?.emails),
    ...arr(page?.phones),
    ...arr(page?.faqItems).flatMap((item) => [item?.question, item?.answer]),
    ...Object.values(obj(page?.sections)),
  ]
    .map((item) => s(item))
    .filter(Boolean);
}

function pageContainsText(page = {}, text = "") {
  const needle = lower(text);
  if (!needle) return false;
  return pageContentPool(page).some((item) => lower(item).includes(needle));
}

function pickPreferredPage(pages = [], { url = "", text = "", preferredTypes = [] } = {}) {
  const preferred = arr(preferredTypes).map((item) => lower(item));
  const exactUrl = s(url);

  const matches = arr(pages)
    .filter((page) => {
      if (
        exactUrl &&
        [s(page?.url), s(page?.canonicalUrl)].includes(exactUrl)
      ) {
        return true;
      }
      if (text) return pageContainsText(page, text);
      return false;
    })
    .sort((left, right) => {
      const leftType = lower(left?.pageType);
      const rightType = lower(right?.pageType);
      const leftPref = preferred.includes(leftType) ? 1 : 0;
      const rightPref = preferred.includes(rightType) ? 1 : 0;
      if (leftPref !== rightPref) return rightPref - leftPref;
      return Number(right?.quality?.score || 0) - Number(left?.quality?.score || 0);
    });

  return matches[0] || null;
}

function buildPageEvidence(page = {}, fallback = "") {
  const sections = obj(page?.sections);
  return compactText(
    sections.about ||
      sections.hero ||
      sections.contact ||
      sections.pricing ||
      sections.policy ||
      sections.faq ||
      page?.metaDescription ||
      page?.visibleExcerpt ||
      fallback,
    360
  );
}

function pushObservation(out = [], base = {}, payload = {}) {
  const text = s(payload.rawValueText);
  const jsonValue = obj(payload.rawValueJson);

  if (!text && !Object.keys(jsonValue).length) return;

  const confidence = Number(payload.confidence ?? 0.7);
  const normalizedValueText = s(payload.normalizedValueText);
  const normalizedValueJson = obj(payload.normalizedValueJson);
  const pageUrl = s(payload.pageUrl || base.pageUrl);
  const pageTitle = s(payload.pageTitle || base.pageTitle);
  const metadataJson = {
    source_url: base.sourceUrl,
    final_url: base.finalUrl,
    crawl_pages_scanned: base.crawlPagesScanned,
    site_quality: base.siteQuality,
    discovery: base.discovery,
    crawl_warnings: base.crawlWarnings,
    page_type: s(payload.pageType),
    page_tags: arr(payload.pageTags),
    artifact_key: s(payload.artifactKey),
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
    pageUrl,
    pageTitle,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    resolutionStatus: "pending",
    extractionMethod: s(payload.extractionMethod || "pipeline"),
    extractionModel: s(payload.extractionModel || "source_fusion_v5"),
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
      lower(item.pageUrl),
      lower(item.normalizedValueText || item.rawValueText),
    ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pageObservationContext(page = null) {
  return {
    pageUrl: s(page?.url || page?.canonicalUrl),
    pageTitle: s(page?.title),
    pageType: normalizePageType(page),
    pageTags: arr(page ? [page?.pageType, normalizePageType(page)] : []).filter(Boolean),
    artifactKey: websiteArtifactKey(page?.canonicalUrl || page?.url),
  };
}

function pushPageListClaims({
  out = [],
  base = {},
  pages = [],
  pageValues = (page) => [],
  observationGroup = "",
  claimType = "",
  claimKeyPrefix = "",
  valueJsonKey = "",
  confidence = 0.8,
}) {
  for (const page of pages) {
    for (const rawValue of arr(pageValues(page))) {
      const value = s(rawValue);
      const normalized =
        claimType === "primary_phone"
          ? normalizeObservedPhone(value)
          : claimType === "primary_email"
            ? normalizeObservedEmail(value)
            : claimType.endsWith("_link") || claimType === "social_link"
              ? normalizeObservedUrl(value)
              : normalizeObservedText(value);

      if (!normalized) continue;

      const extraJson =
        claimType === "social_link"
          ? {
              platform: s(rawValue?.platform),
              url: normalizeObservedUrl(s(rawValue?.url)),
            }
          : { [valueJsonKey]: value };

      const textValue =
        claimType === "social_link"
          ? normalizeObservedUrl(s(rawValue?.url))
          : normalized;

      pushObservation(out, base, {
        observationGroup,
        claimType,
        claimKey: `${claimKeyPrefix}_${safeKeyPart(normalized, claimKeyPrefix)}`,
        rawValueText: claimType === "social_link" ? textValue : value,
        rawValueJson: extraJson,
        normalizedValueText: claimType === "social_link" ? textValue : normalized,
        normalizedValueJson: extraJson,
        evidenceText: buildPageEvidence(page, value) || `${claimType} detected on website page`,
        ...pageObservationContext(page),
        confidence,
      });
    }
  }
}

function buildWebsiteObservations({ source, run, extracted, profile }) {
  const out = [];
  const x = obj(profile);
  const pages = arr(extracted?.pages);
  const selectionMeta = obj(extracted?.site?.identitySignals?.selectionMeta);

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
    const page = pickPreferredPage(pages, {
      url: s(selectionMeta?.primaryName?.url),
      text: companyName,
      preferredTypes: ["about", "home", "services"],
    });

    pushObservation(out, base, {
      observationGroup: "identity",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: companyName,
      rawValueJson: { company_name: companyName },
      normalizedValueText: normalizeObservedText(companyName),
      normalizedValueJson: { company_name: companyName },
      evidenceText:
        buildPageEvidence(page, companyName) ||
        "Business name selected from website identity signals",
      ...pageObservationContext(page),
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
    const page = pickPreferredPage(pages, {
      url: s(selectionMeta?.primaryDescription?.url),
      text: summary,
      preferredTypes: ["about", "services", "home"],
    });

    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "summary_short",
      rawValueText: summary,
      rawValueJson: { summary },
      normalizedValueText: normalizeObservedText(summary),
      normalizedValueJson: { summary },
      evidenceText:
        buildPageEvidence(page, summary) ||
        "Website short summary selected from normalized page evidence",
      ...pageObservationContext(page),
      confidence: 0.88,
    });
  }

  if (s(x.companySummaryLong || x.summaryLong)) {
    const summary = s(x.companySummaryLong || x.summaryLong);
    const page = pickPreferredPage(pages, {
      url: s(selectionMeta?.primaryDescription?.url),
      text: summary,
      preferredTypes: ["about", "services", "home"],
    });

    pushObservation(out, base, {
      observationGroup: "summary",
      claimType: "summary_long",
      claimKey: "summary_long",
      rawValueText: summary,
      rawValueJson: { summary },
      normalizedValueText: normalizeObservedText(summary),
      normalizedValueJson: { summary },
      evidenceText:
        buildPageEvidence(page, summary) ||
        "Website long summary selected from normalized page evidence",
      ...pageObservationContext(page),
      confidence: 0.83,
    });
  }

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.phones),
    observationGroup: "contact",
    claimType: "primary_phone",
    claimKeyPrefix: "phone",
    valueJsonKey: "phone",
    confidence: 0.95,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.emails),
    observationGroup: "contact",
    claimType: "primary_email",
    claimKeyPrefix: "email",
    valueJsonKey: "email",
    confidence: 0.97,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.addresses),
    observationGroup: "location",
    claimType: "primary_address",
    claimKeyPrefix: "address",
    valueJsonKey: "address",
    confidence: 0.86,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.hours),
    observationGroup: "hours",
    claimType: "working_hours",
    claimKeyPrefix: "hours",
    valueJsonKey: "hours",
    confidence: 0.9,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.serviceHints),
    observationGroup: "offerings",
    claimType: "service",
    claimKeyPrefix: "service",
    valueJsonKey: "service",
    confidence: 0.89,
  });

  for (const item of arr(x.products)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;
    const page = pickPreferredPage(pages, {
      text: item,
      preferredTypes: ["services", "pricing", "home"],
    });

    pushObservation(out, base, {
      observationGroup: "offerings",
      claimType: "product",
      claimKey: `product_${safeKeyPart(normalized, "product")}`,
      rawValueText: item,
      rawValueJson: { product: item },
      normalizedValueText: normalized,
      normalizedValueJson: { product: item },
      evidenceText: buildPageEvidence(page, item) || "Product or package detected on website",
      ...pageObservationContext(page),
      confidence: 0.78,
    });
  }

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.pricingHints),
    observationGroup: "pricing",
    claimType: "pricing_hint",
    claimKeyPrefix: "pricing",
    valueJsonKey: "text",
    confidence: 0.84,
  });

  if (s(x.pricingPolicy)) {
    const page = pickPreferredPage(pages, {
      text: s(x.pricingPolicy),
      preferredTypes: ["pricing", "services", "booking"],
    });

    pushObservation(out, base, {
      observationGroup: "pricing",
      claimType: "pricing_policy",
      claimKey: "pricing_policy",
      rawValueText: s(x.pricingPolicy),
      rawValueJson: { policy: s(x.pricingPolicy) },
      normalizedValueText: normalizeObservedText(s(x.pricingPolicy)),
      normalizedValueJson: { policy: s(x.pricingPolicy) },
      evidenceText:
        buildPageEvidence(page, s(x.pricingPolicy)) ||
        "Pricing posture inferred from website evidence",
      ...pageObservationContext(page),
      confidence: 0.76,
    });
  }

  if (s(x.supportMode)) {
    const page = pickPreferredPage(pages, {
      text: s(x.supportMode),
      preferredTypes: ["contact", "booking", "home"],
    });

    pushObservation(out, base, {
      observationGroup: "support",
      claimType: "support_mode",
      claimKey: "support_mode",
      rawValueText: s(x.supportMode),
      rawValueJson: { support_mode: s(x.supportMode) },
      normalizedValueText: normalizeObservedText(s(x.supportMode)),
      normalizedValueJson: { support_mode: s(x.supportMode) },
      evidenceText:
        buildPageEvidence(page, s(x.supportMode)) ||
        "Support mode inferred from website evidence",
      ...pageObservationContext(page),
      confidence: 0.78,
    });
  }

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.socialLinks),
    observationGroup: "social",
    claimType: "social_link",
    claimKeyPrefix: "social",
    valueJsonKey: "url",
    confidence: 0.93,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.bookingLinks),
    observationGroup: "booking",
    claimType: "booking_link",
    claimKeyPrefix: "booking",
    valueJsonKey: "url",
    confidence: 0.88,
  });

  pushPageListClaims({
    out,
    base,
    pages,
    pageValues: (page) => arr(page?.whatsappLinks),
    observationGroup: "booking",
    claimType: "whatsapp_link",
    claimKeyPrefix: "whatsapp",
    valueJsonKey: "url",
    confidence: 0.95,
  });

  for (const page of pages) {
    for (const item of arr(page?.faqItems)) {
      const question = s(item?.question);
      const answer = s(item?.answer);
      if (!question) continue;

      pushObservation(out, base, {
        observationGroup: "faq",
        claimType: "faq",
        claimKey: `faq_${safeKeyPart(question, "faq")}`,
        rawValueText: answer ? `${question} - ${answer}` : question,
        rawValueJson: { question, answer },
        normalizedValueText: normalizeObservedText(question),
        normalizedValueJson: { question, answer },
        evidenceText: buildPageEvidence(page, question) || "FAQ detected on website page",
        ...pageObservationContext(page),
        confidence: answer ? 0.88 : 0.72,
      });
    }
  }

  const pagePolicyTexts = pages.flatMap((page) =>
    uniqStrings([
      s(page?.sections?.policy),
      ...arr(page?.listItems).filter((item) =>
        /\b(policy|privacy|terms|conditions|refund|return|shipping|cancellation)\b/i.test(s(item))
      ),
      ...arr(page?.paragraphs).filter((item) =>
        /\b(policy|privacy|terms|conditions|refund|return|shipping|cancellation)\b/i.test(s(item))
      ),
    ]).map((text) => ({ page, text }))
  );

  for (const { page, text } of pagePolicyTexts) {
    const normalized = normalizeObservedText(text);
    if (!normalized) continue;

    pushObservation(out, base, {
      observationGroup: "policy",
      claimType: "policy_highlight",
      claimKey: `policy_${safeKeyPart(normalized, "policy")}`,
      rawValueText: text,
      rawValueJson: { policy: text },
      normalizedValueText: normalized,
      normalizedValueJson: { policy: text },
      evidenceText: buildPageEvidence(page, text) || "Policy content detected on website page",
      ...pageObservationContext(page),
      confidence: 0.78,
    });
  }

  for (const item of arr(x.policyHighlights)) {
    const normalized = normalizeObservedText(item);
    if (!normalized) continue;
    const page = pickPreferredPage(pages, {
      text: item,
      preferredTypes: ["policy", "faq", "booking"],
    });

    pushObservation(out, base, {
      observationGroup: "policy",
      claimType: "policy_highlight",
      claimKey: `policy_${safeKeyPart(normalized, "policy")}`,
      rawValueText: item,
      rawValueJson: { policy: item },
      normalizedValueText: normalized,
      normalizedValueJson: { policy: item },
      evidenceText:
        buildPageEvidence(page, item) || "Policy content selected from website evidence",
      ...pageObservationContext(page),
      confidence: 0.76,
    });
  }

  return dedupeObservationRows(out);
}

export { buildWebsiteObservations };
