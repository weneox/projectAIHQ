import { sanitizeSetupReviewDraft } from "../import/draft.js";
import { arr, compactObject, obj, s } from "./utils.js";

function firstObservedValue(source = {}) {
  return (
    source?.observedValue ??
    source?.observed_value ??
    source?.value ??
    source?.rawValue ??
    source?.raw_value ??
    ""
  );
}

function normalizeBundleSources({ session = {}, draft = {}, sources = [] } = {}) {
  const summary = obj(draft?.sourceSummary);
  const imports = arr(summary.imports);
  const linkedSources = arr(sources);
  const sourceMap = new Map();

  for (const item of linkedSources) {
    const sourceId = s(item.sourceId || item.id);
    const key = sourceId || `${String(item.sourceType || "").toLowerCase()}|${String(item.label || "").toLowerCase()}`;
    sourceMap.set(key, {
      sourceId,
      sourceType: s(item.sourceType),
      role: s(item.role || "context"),
      label: s(item.label),
      attachedAt: item.attachedAt || null,
      metadata: obj(item.metadata),
    });
  }

  for (const item of imports) {
    const key =
      s(item.sourceId) || `${String(item.sourceType || "").toLowerCase()}|${String(item.sourceUrl || "").toLowerCase()}`;
    const current = obj(sourceMap.get(key));
    sourceMap.set(
      key,
      compactObject({
        ...current,
        sourceId: s(item.sourceId || current.sourceId),
        sourceType: s(item.sourceType || current.sourceType),
        role:
          s(session?.primarySourceId) && s(session.primarySourceId) === s(item.sourceId)
            ? "primary"
            : s(current.role || "supporting"),
        label: s(item.sourceLabel || current.label),
        sourceUrl: s(item.sourceUrl),
        sourceAuthorityClass: s(item.sourceAuthorityClass),
        runId: item.runId || null,
        lastSnapshotId: item.lastSnapshotId || null,
        mode: s(item.mode),
        stage: s(item.stage),
        warningCount: Number(item.warningCount || 0),
        candidateCount: Number(item.candidateCount || 0),
        observationCount: Number(item.observationCount || 0),
        attachedAt: current.attachedAt || null,
        metadata: current.metadata,
      })
    );
  }

  const output = [...sourceMap.values()];
  output.sort((a, b) => (b.role === "primary" ? 1 : 0) - (a.role === "primary" ? 1 : 0));
  return output;
}

function normalizeContributionSummary(draft = {}) {
  const sourceContributions = obj(obj(draft?.draftPayload).sourceContributions);

  return Object.entries(sourceContributions).map(([key, value]) => {
    const contribution = obj(value);
    const summary = obj(contribution.sourceSummary);
    const latestImport = obj(summary.latestImport);
    const profile = obj(contribution.businessProfile);

    return compactObject({
      key,
      sourceType: s(latestImport.sourceType || summary.primarySourceType),
      sourceUrl: s(latestImport.sourceUrl || summary.primarySourceUrl),
      sourceLabel: s(latestImport.sourceLabel),
      sourceAuthorityClass: s(latestImport.sourceAuthorityClass),
      companyName: s(profile.companyName || profile.displayName),
      fields: Object.keys(profile).filter((field) => field !== "fieldSources"),
      serviceCount: arr(contribution.services).length,
      knowledgeCount: arr(contribution.knowledgeItems).length,
      warningCount: arr(contribution.warnings).length,
      latestRunId: latestImport.runId || null,
      lastSnapshotId: latestImport.lastSnapshotId || null,
    });
  });
}

function normalizeFieldProvenance(draft = {}) {
  const fieldSources = {
    ...obj(obj(obj(draft?.draftPayload).profile).fieldSources),
    ...obj(obj(draft?.businessProfile).fieldSources),
  };
  const importantFields = [
    "companyName",
    "displayName",
    "websiteUrl",
    "primaryPhone",
    "primaryEmail",
    "primaryAddress",
    "description",
    "companySummaryShort",
    "companySummaryLong",
    "services",
    "products",
    "pricingHints",
    "socialLinks",
    "language",
    "mainLanguage",
    "primaryLanguage",
  ];

  return Object.fromEntries(
    importantFields
      .filter(
        (field) =>
          obj(fieldSources[field]).sourceType ||
          obj(fieldSources[field]).source_type ||
          obj(fieldSources[field]).sourceUrl ||
          obj(fieldSources[field]).source_url
      )
      .map((field) => [
        field,
        compactObject({
          sourceType: s(fieldSources[field].sourceType || fieldSources[field].source_type),
          sourceUrl: s(fieldSources[field].sourceUrl || fieldSources[field].source_url),
          authorityRank: Number(
            fieldSources[field].authorityRank || fieldSources[field].authority_rank || 0
          ),
          label: s(
            fieldSources[field].sourceLabel ||
              fieldSources[field].source_label ||
              fieldSources[field].sourceType ||
              fieldSources[field].source_type
          ),
          observedValue: firstObservedValue(fieldSources[field]),
          value: firstObservedValue(fieldSources[field]),
        }),
      ])
  );
}

function normalizeReviewDebug(draft = {}) {
  const payload = obj(draft?.draftPayload);
  const extracted = obj(payload.extracted);
  const crawl = obj(extracted.crawl);
  const site = obj(extracted.site);
  const rollupDebug = obj(site.debug);

  const effectiveLimits = obj(crawl.effectiveLimits);
  const pageAdmissions = arr(rollupDebug.pageAdmissions);
  const pagesWithContactSignals = arr(rollupDebug.pagesWithContactSignals);
  const weakSelectionReasons = arr(rollupDebug.weakSelectionReasons);

  if (
    !Object.keys(effectiveLimits).length &&
    !pageAdmissions.length &&
    !pagesWithContactSignals.length &&
    !weakSelectionReasons.length &&
    !arr(crawl.failures).length
  ) {
    return {};
  }

  return compactObject({
    effectiveLimits,
    crawl: compactObject({
      pagesRequested: Number(crawl.pagesRequested || 0),
      pagesSucceeded: Number(crawl.pagesSucceeded || 0),
      pagesKept: Number(crawl.pagesKept || 0),
      pagesRejected: Number(crawl.pagesRejected || 0),
      pagesFailed: Number(crawl.pagesFailed || 0),
      pagesPendingLeft: Number(crawl.pagesPendingLeft || 0),
      warnings: arr(crawl.warnings),
      failures: arr(crawl.failures).slice(0, 20),
      rejected: arr(crawl.rejected).slice(0, 20),
      skipped: arr(crawl.skipped).slice(0, 20),
    }),
    weakSelectionReasons,
    pageAdmissions: pageAdmissions.slice(0, 30),
    pagesWithContactSignals: pagesWithContactSignals.slice(0, 20),
  });
}

function normalizeReviewDraftSummary(draft = {}) {
  const fieldSources = {
    ...obj(obj(obj(draft?.draftPayload).profile).fieldSources),
    ...obj(obj(draft?.businessProfile).fieldSources),
  };
  const observedFields = Object.entries(fieldSources)
    .filter(([, value]) => s(value?.observedValue || value?.observed_value))
    .map(([field]) => field);

  return {
    completeness: obj(draft?.completeness),
    confidence: obj(draft?.confidenceSummary),
    warningCount: arr(draft?.warnings).length,
    warnings: arr(draft?.warnings),
    serviceCount: arr(draft?.services).length,
    knowledgeCount: arr(draft?.knowledgeItems).length,
    hasBusinessProfile:
      Object.keys(compactObject(draft?.businessProfile))
        .filter((field) => field !== "fieldSources").length > 0,
    fieldSourceObservedValueCount: observedFields.length,
    fieldSourceObservedFields: observedFields,
  };
}

export function buildFrontendReviewShape({
  session = null,
  draft = null,
  sources = [],
  events = [],
} = {}) {
  const safeDraft = draft ? sanitizeSetupReviewDraft(draft) : draft || null;
  return {
    session: session || null,
    draft: safeDraft || null,
    sources: arr(sources),
    events: arr(events),
    bundleSources: normalizeBundleSources({ session, draft: safeDraft, sources }),
    contributionSummary: normalizeContributionSummary(safeDraft),
    fieldProvenance: normalizeFieldProvenance(safeDraft),
    reviewDraftSummary: normalizeReviewDraftSummary(safeDraft),
    reviewDebug: normalizeReviewDebug(safeDraft),
  };
}
