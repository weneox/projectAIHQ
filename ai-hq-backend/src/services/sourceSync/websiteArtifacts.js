import crypto from "node:crypto";

import { arr, obj, s } from "./shared.js";

function lower(v = "") {
  return s(v).toLowerCase();
}

function compactText(value = "", max = 600) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function uniqStrings(items = []) {
  return [...new Set(arr(items).map((item) => s(item)).filter(Boolean))];
}

function qualityBandToLabel(band = "", score = 0) {
  const value = lower(band);
  if (value === "strong") return score >= 0.86 ? "very_high" : "high";
  if (value === "medium") return "medium";
  return "low";
}

function artifactKey(kind = "", value = "") {
  const text = `${lower(kind)}|${s(value)}`;
  return crypto.createHash("sha256").update(text).digest("hex");
}

function slug(value = "", fallback = "item", max = 48) {
  const normalized = lower(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
  return normalized || fallback;
}

export function normalizeWebsiteKnowledgePageType(page = {}, siteUrl = "") {
  const rawPageType = lower(page?.pageType);
  const urlText = lower(page?.canonicalUrl || page?.url);
  const titleText = lower(page?.title);
  const path = (() => {
    try {
      return new URL(s(page?.canonicalUrl || page?.url || siteUrl)).pathname || "/";
    } catch {
      return "";
    }
  })();

  let pageType = "other";

  if (path === "/" || path === "") {
    pageType = "home";
  } else if (rawPageType === "about") {
    pageType = "about";
  } else if (rawPageType === "services") {
    pageType = "services";
  } else if (rawPageType === "pricing") {
    pageType = "pricing";
  } else if (rawPageType === "faq") {
    pageType = "faq";
  } else if (rawPageType === "contact") {
    pageType = "contact";
  } else if (rawPageType === "policy") {
    pageType = "policies";
  } else if (rawPageType === "booking") {
    pageType = "booking";
  } else if (rawPageType === "locations") {
    pageType = "location";
  } else if (/\b(product|products|packages|plans)\b/i.test(`${urlText} ${titleText}`)) {
    pageType = "products";
  }

  const tags = uniqStrings([
    rawPageType,
    arr(page?.hours).length ? "hours" : "",
    arr(page?.pricingHints).length ? "pricing_signals" : "",
    arr(page?.faqItems).length ? "faq_signals" : "",
    arr(page?.serviceHints).length ? "service_signals" : "",
    s(pageType),
  ]);

  return {
    pageType,
    rawPageType,
    tags,
    confidence:
      pageType === "home"
        ? 0.95
        : pageType !== "other"
          ? 0.88
          : rawPageType === "generic"
            ? 0.42
            : 0.56,
  };
}

function buildSectionChunks(page = {}) {
  const sections = obj(page.sections);
  const sectionTitles = {
    hero: "Hero",
    about: "About",
    contact: "Contact",
    pricing: "Pricing",
    faq: "FAQ",
    policy: "Policy",
  };

  return Object.entries(sections)
    .map(([key, value]) => ({
      chunkType: key === "faq" ? "faq" : key === "hero" ? "summary" : "text",
      sectionLabel: key,
      sectionTitle: sectionTitles[key] || key,
      textContent: compactText(value, 1200),
      normalizedText: compactText(value, 1200),
      metadataJson: {
        origin: "page_section",
      },
    }))
    .filter((item) => item.textContent);
}

function buildListChunks(page = {}) {
  return arr(page.listItems).map((item, idx) => ({
    chunkKey: `list_${idx + 1}`,
    chunkType: "list_item",
    sectionLabel: "list",
    sectionTitle: "List Item",
    textContent: compactText(item, 320),
    normalizedText: compactText(item, 320),
    metadataJson: {
      origin: "list_item",
    },
  }));
}

function buildHeadingChunks(page = {}) {
  return arr(page.headings).map((item, idx) => ({
    chunkKey: `heading_${idx + 1}`,
    chunkType: "heading",
    sectionLabel: "heading",
    sectionTitle: "Heading",
    textContent: compactText(item, 220),
    normalizedText: compactText(item, 220),
    metadataJson: {
      origin: "heading",
    },
  }));
}

function buildParagraphChunks(page = {}) {
  return arr(page.paragraphs).map((item, idx) => ({
    chunkKey: `paragraph_${idx + 1}`,
    chunkType: "paragraph",
    sectionLabel: "paragraph",
    sectionTitle: "Paragraph",
    textContent: compactText(item, 1000),
    normalizedText: compactText(item, 1000),
    metadataJson: {
      origin: "paragraph",
    },
  }));
}

function buildFaqChunks(page = {}) {
  return arr(page.faqItems).map((item, idx) => {
    const question = s(item?.question);
    const answer = s(item?.answer);
    const text = answer ? `${question} - ${answer}` : question;
    return {
      chunkKey: `faq_${idx + 1}`,
      chunkType: "faq",
      sectionLabel: "faq",
      sectionTitle: question || "FAQ",
      textContent: compactText(text, 900),
      normalizedText: compactText(text, 900),
      metadataJson: {
        origin: "faq",
        question,
        answer,
      },
    };
  });
}

function buildPageChunks(page = {}) {
  const summaryChunk = {
    chunkKey: "summary",
    chunkType: "summary",
    sectionLabel: "summary",
    sectionTitle: "Visible Excerpt",
    textContent: compactText(page.visibleExcerpt || page.text, 1800),
    normalizedText: compactText(page.visibleExcerpt || page.text, 1800),
    metadataJson: {
      origin: "visible_excerpt",
    },
  };

  return [
    summaryChunk,
    ...buildHeadingChunks(page),
    ...buildParagraphChunks(page),
    ...buildListChunks(page),
    ...buildFaqChunks(page),
    ...buildSectionChunks(page),
  ]
    .filter((item) => s(item.textContent))
    .map((item, idx) => ({
      ...item,
      chunkKey: s(item.chunkKey || `${item.chunkType}_${idx + 1}`),
      charCount: s(item.textContent).length,
      tokenEstimate: Math.ceil(s(item.textContent).length / 4),
    }));
}

export function buildWebsiteArtifactDrafts({ source = {}, run = {}, extracted = {} } = {}) {
  const site = obj(extracted.site);
  const crawl = obj(extracted.crawl);
  const pageAdmissions = arr(extracted.pageAdmissions);
  const pages = arr(extracted.pages);
  const fetchedAt = s(crawl.fetchedAt);
  const sourceUrl = s(source?.source_url || source?.url || extracted.sourceUrl);
  const finalUrl = s(extracted.finalUrl || site.finalUrl || sourceUrl);

  const siteArtifact = {
    artifactType: "website_site",
    artifactKey: `website_site:${artifactKey("website_site", finalUrl || sourceUrl)}`,
    captureMethod: "crawler",
    visibility: "private",
    status: "active",
    sourceType: "website",
    sourceId: s(source.id),
    sourceRunId: s(run.id),
    sourceUrl,
    canonicalUrl: finalUrl || sourceUrl,
    title:
      s(site?.identitySignals?.primaryName) ||
      s(site?.title) ||
      s(source?.display_name) ||
      "Website",
    pageType: "home",
    mimeType: "application/json",
    language: s(site?.identitySignals?.primaryLanguage || "en"),
    rawText: compactText(extracted.siteText, 24000),
    extractedText: compactText(site?.identitySignals?.primaryDescription || extracted.siteText, 12000),
    rawJson: {
      sourceUrl,
      finalUrl,
      crawl,
      discovery: obj(extracted.discovery),
      site,
      pageAdmissions,
    },
    linksJson: uniqStrings([
      ...arr(site?.internalHints?.about_pages),
      ...arr(site?.internalHints?.contact_pages),
      ...arr(site?.internalHints?.services_pages),
      ...arr(site?.internalHints?.pricing_pages),
      ...arr(site?.bookingLinks),
      ...arr(site?.whatsappLinks),
    ]),
    metadataJson: {
      pageCount: pages.length,
      pageTypeCounts: obj(site?.pageTypeCounts),
      warnings: arr(crawl?.warnings),
      siteQuality: obj(site?.quality),
    },
    qualityScore: Math.max(0, Math.min(1, Number(site?.quality?.score || 0) / 100)),
    qualityLabel: qualityBandToLabel(site?.quality?.band, Number(site?.quality?.score || 0) / 100),
    textLength: s(extracted.siteText).length,
    fetchedAt: fetchedAt || null,
  };

  const pageArtifacts = pages.map((page) => {
    const classification = normalizeWebsiteKnowledgePageType(page, finalUrl || sourceUrl);
    const admission = pageAdmissions.find(
      (item) => s(item?.canonicalUrl || item?.url) === s(page?.canonicalUrl || page?.url)
    );
    const score = Math.max(0, Math.min(1, Number(page?.quality?.score || 0) / 100));
    const artifact = {
      artifactType: "website_page",
      artifactKey: `website_page:${artifactKey("website_page", s(page?.canonicalUrl || page?.url))}`,
      captureMethod: "crawler",
      visibility: "private",
      status: "active",
      sourceType: "website",
      sourceId: s(source.id),
      sourceRunId: s(run.id),
      sourceUrl: s(page?.url),
      canonicalUrl: s(page?.canonicalUrl || page?.url),
      title: s(page?.title),
      subtitle: s(page?.metaDescription),
      pageType: classification.pageType,
      mimeType: "text/html",
      language: s(site?.identitySignals?.primaryLanguage || "en"),
      rawText: compactText(page?.text, 24000),
      extractedText: compactText(page?.visibleExcerpt || page?.text, 12000),
      rawJson: {
        normalizedPage: page,
        classification,
      },
      linksJson: arr(page?.links),
      mediaRefsJson: uniqStrings([
        ...arr(page?.whatsappLinks),
        ...arr(page?.bookingLinks),
        ...arr(page?.socialLinks).map((item) => item?.url),
      ]),
      metadataJson: {
        classification,
        metrics: obj(page?.metrics),
        qualityWarnings: arr(page?.qualityWarnings),
        analysis: obj(page?.analysis),
        admitted: Boolean(admission?.admitted || admission?.keep),
        admissionReason: s(admission?.reason || admission?.admissionReason),
      },
      qualityScore: score,
      qualityLabel: qualityBandToLabel(page?.quality?.band, score),
      textLength: s(page?.text).length,
      fetchedAt: fetchedAt || null,
    };

    return {
      ...artifact,
      chunks: buildPageChunks(page),
    };
  });

  const pageTypeCounts = pageArtifacts.reduce((acc, item) => {
    const key = s(item.pageType || "other");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const chunkCount = pageArtifacts.reduce(
    (sum, item) => sum + arr(item.chunks).length,
    0
  );

  return {
    siteArtifact,
    pageArtifacts,
    summary: {
      persisted: false,
      siteArtifactKey: siteArtifact.artifactKey,
      pageCount: pageArtifacts.length,
      artifactCount: pageArtifacts.length + 1,
      pageArtifactCount: pageArtifacts.length,
      chunkCount,
      pageTypeCounts,
      normalizedPageCount: pageArtifacts.length,
      finalUrl: finalUrl || sourceUrl,
    },
  };
}

export async function persistWebsiteArtifacts({
  artifacts = null,
  source = {},
  run = {},
  extracted = {},
} = {}) {
  const draft = buildWebsiteArtifactDrafts({ source, run, extracted });
  const summary = {
    ...obj(draft.summary),
    persisted: false,
  };

  if (
    !artifacts ||
    typeof artifacts.upsertRawArtifact !== "function" ||
    typeof artifacts.replaceArtifactChunks !== "function"
  ) {
    return summary;
  }

  const tenantIdentity = {
    tenantId: s(source?.tenant_id || run?.tenant_id),
    tenantKey: s(source?.tenant_key || run?.tenant_key),
  };

  const siteRow = await artifacts.upsertRawArtifact({
    ...tenantIdentity,
    ...draft.siteArtifact,
  });

  const pageArtifactIds = [];
  let chunkCount = 0;

  for (const item of draft.pageArtifacts) {
    const artifactRow = await artifacts.upsertRawArtifact({
      ...tenantIdentity,
      ...item,
      parentArtifactId: s(siteRow?.id) || null,
    });

    pageArtifactIds.push(s(artifactRow?.id));

    const chunkRows = await artifacts.replaceArtifactChunks({
      ...tenantIdentity,
      sourceId: s(source?.id),
      sourceRunId: s(run?.id),
      artifactId: s(artifactRow?.id),
      chunks: arr(item.chunks),
    });

    chunkCount += arr(chunkRows).length;
  }

  return {
    ...summary,
    persisted: true,
    siteArtifactId: s(siteRow?.id),
    pageArtifactIds,
    chunkCount,
  };
}

