import Button from "../ui/Button.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleCase(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function compactText(value, max = 160) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function compactSentence(value, max = 220) {
  const text = compactText(value, Math.max(max * 2, 260));
  if (!text) return "";
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return compactText(firstSentence, max);
}

function listPreview(items = [], max = 3) {
  const safe = arr(items)
    .map((item) => compactText(item, 72))
    .filter(Boolean);

  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function formatPath(url = "") {
  const value = s(url);
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const path = s(parsed.pathname || "/");
    return path === "/" ? parsed.hostname : `${parsed.hostname}${path}`;
  } catch {
    return value;
  }
}

function formatPageType(pageType = "") {
  const key = lower(pageType);
  if (key === "faq") return "FAQ";
  if (!key) return "Page";
  return titleCase(key);
}

function countMeaningfulSections(sections = []) {
  return arr(sections).filter((item) => s(item?.value)).length;
}

function normalizePageTypes(pageTypeCounts = {}) {
  return Object.entries(obj(pageTypeCounts))
    .map(([key, value]) => ({
      key,
      value: Number(value || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((item) => formatPageType(item.key));
}

function resolveCoverageText(coverage = {}, pageCount = 0) {
  const source = obj(coverage);
  const kept = Number(source.pagesKept || 0);
  const succeeded = Number(source.pagesSucceeded || 0);
  const requested = Number(source.pagesRequested || 0);

  if (kept > 0 && succeeded > 0) return `${kept} kept of ${succeeded}`;
  if (kept > 0) return `${kept} useful pages`;
  if (succeeded > 0) return `${succeeded} fetched`;
  if (requested > 0) return `${requested} requested`;
  if (pageCount > 0) return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
  return "";
}

function resolveStrength(websiteKnowledge = {}, sectionCount = 0) {
  const quality = obj(websiteKnowledge.siteQuality);
  const pageCount = Number(websiteKnowledge.pageCount || 0);
  const score = Number(quality.score || 0);
  const band = lower(quality.band);

  if ((band === "strong" || score >= 75) && pageCount >= 3 && sectionCount >= 3) {
    return {
      tone: "strong",
      label: "Strong",
      summary: "The website looks well understood and ready for review.",
    };
  }

  if (pageCount >= 2 && sectionCount >= 2) {
    return {
      tone: "partial",
      label: "Partial",
      summary: "The draft is usable, but a few details still deserve a careful read.",
    };
  }

  return {
    tone: "weak",
    label: "Thin",
    summary: "Coverage is light. Review before treating this draft as trustworthy.",
  };
}

function pickSectionRows(websiteKnowledge = {}, draft = {}) {
  const draftSections = obj(websiteKnowledge.draftSections);
  const businessProfile = obj(draft.businessProfile);
  const knowledgeItems = arr(draft.knowledgeItems);

  const contactPreview = listPreview(
    [
      businessProfile.primaryPhone,
      businessProfile.primaryEmail,
      businessProfile.primaryAddress,
    ],
    2
  );

  const hoursPreview = listPreview(
    arr(businessProfile.hours).map((item) => compactText(item, 64)),
    2
  );

  const pricingPreview =
    listPreview(arr(draftSections.pricingHints), 2) ||
    compactSentence(businessProfile.pricingPolicy, 120);

  const faqPreview =
    listPreview(arr(draftSections.faqQuestions), 2) ||
    listPreview(
      knowledgeItems
        .filter((item) => lower(item.category) === "faq")
        .map((item) => item.title),
      2
    );

  return [
    {
      key: "summary",
      label: "Summary",
      value: compactSentence(draftSections.summaryShort, 180),
      multiline: true,
    },
    {
      key: "services",
      label: "Services",
      value: listPreview(arr(draftSections.servicesDraft), 4),
    },
    {
      key: "faq",
      label: "FAQ",
      value: faqPreview,
    },
    {
      key: "contact",
      label: "Contact",
      value: contactPreview,
    },
    {
      key: "hours",
      label: "Hours",
      value: hoursPreview,
    },
    {
      key: "pricing",
      label: "Pricing",
      value: pricingPreview,
    },
    {
      key: "policies",
      label: "Policies",
      value: listPreview(arr(draftSections.policyHighlights), 2),
    },
  ].filter((item) => s(item.value));
}

function describePageContribution(page = {}) {
  const source = obj(page);
  const cues = [];

  if (Number(source.serviceHintCount || 0) > 0) cues.push("services");
  if (Number(source.pricingHintCount || 0) > 0) cues.push("pricing");
  if (Number(source.faqCount || 0) > 0) cues.push("faq");
  if (Number(source.contactSignalCount || 0) > 0) cues.push("contact");
  if (Number(source.hourCount || 0) > 0) cues.push("hours");
  if (Number(source.policySignalCount || 0) > 0) cues.push("policy");
  if (Number(source.bookingLinkCount || 0) > 0) cues.push("booking");

  if (!cues.length) return "General site context";
  return compactText(`Used for ${cues.slice(0, 3).join(", ")}`, 90);
}

function buildTopPages(topPages = []) {
  return arr(topPages)
    .map((page) => ({
      key: s(page.url || page.title),
      title: compactText(page.title || page.url, 70),
      type: formatPageType(page.pageType),
      path: formatPath(page.url),
      contribution: describePageContribution(page),
    }))
    .filter((item) => item.key)
    .slice(0, 4);
}

function findPageForSignal(topPages = [], predicate = () => false) {
  const items = arr(topPages).filter(predicate);
  if (!items.length) return null;
  return items.sort((left, right) => {
    const leftWeight =
      Number(left.serviceHintCount || 0) +
      Number(left.pricingHintCount || 0) +
      Number(left.faqCount || 0) +
      Number(left.contactSignalCount || 0) +
      Number(left.hourCount || 0) +
      Number(left.policySignalCount || 0);
    const rightWeight =
      Number(right.serviceHintCount || 0) +
      Number(right.pricingHintCount || 0) +
      Number(right.faqCount || 0) +
      Number(right.contactSignalCount || 0) +
      Number(right.hourCount || 0) +
      Number(right.policySignalCount || 0);
    return rightWeight - leftWeight;
  })[0];
}

function labelFromField(field = {}, topPages = []) {
  const sourceUrl = s(field.sourceUrl || field.source_url);
  if (!sourceUrl) return "";

  const matchingPage = arr(topPages).find((page) => s(page.url) === sourceUrl);
  if (matchingPage?.title) return compactText(matchingPage.title, 44);
  return formatPath(sourceUrl);
}

function buildProvenanceNotes({
  topPages = [],
  fieldProvenance = {},
  sections = [],
} = {}) {
  const notes = [];
  const servicesPage = findPageForSignal(topPages, (item) => Number(item.serviceHintCount || 0) > 0);
  const contactPage = findPageForSignal(
    topPages,
    (item) => Number(item.contactSignalCount || 0) > 0 || Number(item.hourCount || 0) > 0
  );
  const pricingPage = findPageForSignal(topPages, (item) => Number(item.pricingHintCount || 0) > 0);
  const policyPage = findPageForSignal(topPages, (item) => Number(item.policySignalCount || 0) > 0);

  if (servicesPage?.title && arr(sections).some((item) => item.key === "services")) {
    notes.push(`Services leaned on ${compactText(servicesPage.title, 42)}.`);
  }

  if (contactPage?.title && arr(sections).some((item) => ["contact", "hours"].includes(item.key))) {
    notes.push(`Contact details came from ${compactText(contactPage.title, 42)}.`);
  }

  if (pricingPage?.title && arr(sections).some((item) => item.key === "pricing")) {
    notes.push(`Pricing cues came from ${compactText(pricingPage.title, 42)}.`);
  }

  if (policyPage?.title && arr(sections).some((item) => item.key === "policies")) {
    notes.push(`Policy cues came from ${compactText(policyPage.title, 42)}.`);
  }

  if (!notes.length) {
    const phoneField = obj(fieldProvenance.primaryPhone);
    const emailField = obj(fieldProvenance.primaryEmail);
    const serviceField = obj(fieldProvenance.services);

    if (lower(phoneField.sourceType || phoneField.source_type) === "website") {
      const label = labelFromField(phoneField, topPages);
      if (label) notes.push(`Phone came from ${label}.`);
    }

    if (lower(emailField.sourceType || emailField.source_type) === "website") {
      const label = labelFromField(emailField, topPages);
      if (label) notes.push(`Email came from ${label}.`);
    }

    if (lower(serviceField.sourceType || serviceField.source_type) === "website") {
      const label = labelFromField(serviceField, topPages);
      if (label) notes.push(`Services were grounded in ${label}.`);
    }
  }

  return notes.slice(0, 3);
}

function buildWebsiteReviewModel(reviewPayload = {}) {
  const root = obj(reviewPayload);
  const review = obj(root.review || reviewPayload);
  const reviewDebug = obj(review.reviewDebug);
  const websiteKnowledge = obj(reviewDebug.websiteKnowledge);

  if (!Object.keys(websiteKnowledge).length) {
    return null;
  }

  const reviewDraftSummary = obj(root.reviewDraftSummary || review.reviewDraftSummary);
  const fieldProvenance = obj(root.fieldProvenance || review.fieldProvenance);
  const draft = obj(review.draft);
  const topPages = buildTopPages(arr(websiteKnowledge.topPages));
  const sections = pickSectionRows(websiteKnowledge, draft);
  const sectionCount =
    countMeaningfulSections(sections) || Number(reviewDraftSummary.websiteSectionCount || 0);
  const readiness = resolveStrength(websiteKnowledge, sectionCount);
  const pageTypes = normalizePageTypes(websiteKnowledge.pageTypeCounts);
  const coverageText = resolveCoverageText(
    websiteKnowledge.coverage,
    Number(websiteKnowledge.pageCount || reviewDraftSummary.websitePageCount || 0)
  );
  const pageCount = Number(
    websiteKnowledge.pageCount || reviewDraftSummary.websitePageCount || 0
  );
  const artifactCount = Number(
    websiteKnowledge.artifactCount || reviewDraftSummary.websiteArtifactCount || 0
  );
  const summary =
    sectionCount > 0
      ? `${pageCount} pages analyzed across ${listPreview(pageTypes, 3) || "website signals"}, shaping ${sectionCount} review sections.`
      : `${pageCount} pages analyzed from the website source.`;

  return {
    readiness,
    pageCount,
    artifactCount,
    sectionCount,
    coverageText,
    pageTypes,
    sections,
    topPages,
    provenanceNotes: buildProvenanceNotes({
      topPages: arr(websiteKnowledge.topPages),
      fieldProvenance,
      sections,
    }),
    summary: compactSentence(summary, 170),
    sourceUrl: s(websiteKnowledge.finalUrl || websiteKnowledge.sourceUrl),
    canFinalize:
      obj(obj(root.permissions).setupReviewFinalize).allowed !== false &&
      (root?.setup?.review?.finalizeAvailable === true ||
        root?.setup?.review?.readyForReview === true),
  };
}

export default function SetupReviewActivationPanel({
  reviewPayload = {},
  assistantReview = {},
  onFinalize,
  finalizing = false,
}) {
  const model = buildWebsiteReviewModel(reviewPayload);

  if (!model) return null;

  const reviewState = obj(assistantReview);
  const canFinalize =
    model.canFinalize ||
    reviewState.finalizeAvailable === true ||
    reviewState.readyForReview === true;

  return (
    <section className="ai-review-sheet" aria-label="Website knowledge review">
      <div className="ai-review-kicker">Website draft</div>

      <div className="ai-review-header">
        <div className="min-w-0">
          <div className="ai-review-title-row">
            <h3 className="ai-review-title">What the site seems to mean</h3>
            <span className={`ai-review-status ${model.readiness.tone}`}>
              {model.readiness.label}
            </span>
          </div>

          <p className="ai-review-summary">{model.summary}</p>
        </div>

        {canFinalize && typeof onFinalize === "function" ? (
          <div className="ai-review-action">
            <Button
              type="button"
              size="sm"
              onClick={() => onFinalize?.()}
              isLoading={finalizing}
            >
              Finish setup
            </Button>
          </div>
        ) : null}
      </div>

      <div className="ai-review-stats" role="list" aria-label="Website review summary">
        <div className="ai-review-stat" role="listitem">
          <div className="ai-review-stat-label">Pages</div>
          <div className="ai-review-stat-value">{model.pageCount || "—"}</div>
        </div>

        <div className="ai-review-stat" role="listitem">
          <div className="ai-review-stat-label">Coverage</div>
          <div className="ai-review-stat-value">{model.coverageText || "—"}</div>
        </div>

        <div className="ai-review-stat" role="listitem">
          <div className="ai-review-stat-label">Draft</div>
          <div className="ai-review-stat-value">
            {model.sectionCount ? `${model.sectionCount} sections` : "—"}
          </div>
        </div>
      </div>

      {model.sections.length ? (
        <div className="ai-review-block">
          <div className="ai-review-block-title">Draft sections</div>
          <div className="ai-review-rows">
            {model.sections.map((section) => (
              <div key={section.key} className="ai-review-row">
                <div className="ai-review-row-label">{section.label}</div>
                <div
                  className={`ai-review-row-value ${
                    section.multiline ? "multiline" : ""
                  }`}
                >
                  {section.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {model.topPages.length ? (
        <div className="ai-review-block">
          <div className="ai-review-block-title">Top pages</div>
          <div className="ai-review-pages">
            {model.topPages.map((page) => (
              <div key={page.key} className="ai-review-page">
                <div className="ai-review-page-main">
                  <div className="ai-review-page-title">{page.title}</div>
                  <div className="ai-review-page-meta">
                    <span>{page.type}</span>
                    {page.path ? <span>{page.path}</span> : null}
                  </div>
                </div>
                <div className="ai-review-page-note">{page.contribution}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {model.provenanceNotes.length ? (
        <div className="ai-review-footer">
          {model.provenanceNotes.map((note) => (
            <div key={note} className="ai-review-footnote">
              {note}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
