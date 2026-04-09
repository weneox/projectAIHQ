// src/services/workspace/import.js
// FINAL v6.2 — session-aware source import orchestration + website partial-review hardening

import { runSourceSync } from "../sourceSync/index.js";
import { buildSetupState } from "./setup.js";
import { createLogger } from "../../utils/logger.js";
import { assertSafePublicFetchUrl } from "../../utils/publicFetchSafety.js";
import {
  attachSourceToSetupReviewSession,
  createSetupReviewSession,
  discardSetupReviewSession,
  failSetupReviewSession,
  getCurrentSetupReview,
  getSetupReviewSessionById,
  markSetupReviewSessionProcessing,
  markSetupReviewSessionReady,
  patchSetupReviewDraft,
  readSetupReviewDraft,
  updateSetupReviewSession,
} from "../../db/helpers/tenantSetupReview.js";
import { createTenantSourceArtifactsHelpers } from "../../db/helpers/tenantSourceArtifacts.js";

import {
  SOURCE_TABLES,
  SOURCE_RUN_TABLES,
  arr,
  obj,
  s,
  lower,
  nowIso,
  mergeDeep,
  normalizeUrl,
  normalizeActorContext,
  normalizeSourceType,
  normalizeIntakeContext,
  buildRequestId,
  buildSetupReviewTitle,
  buildSourceDisplayName,
  sourceTypeLabel,
  sourceAuthorityClass,
  uniqStrings,
  cloneJson,
  compactObject,
} from "./import/shared.js";

import { findFirstExistingTable, resolveTenantScope } from "./import/dbRows.js";

import {
  calculateCompleteness,
  calculateConfidenceSummary,
  createSetupReviewCollector,
  deriveDraftPatch,
  isPollutedFailedReviewDraft,
  mergeDraftItems,
} from "./import/draft.js";

import {
  buildKnowledgeAdapter,
  buildFusionAdapter,
  buildSourcesAdapter,
} from "./import/adapters.js";

import { ensureSource, createSourceRun } from "./import/records.js";

function normalizeSourceSeed(item = {}) {
  const x = obj(item);

  const sourceType = lower(
    x.sourceType || x.source_type || x.type || x.key
  );

  const rawUrl = s(
    x.url ||
      x.sourceUrl ||
      x.source_url ||
      x.value ||
      x.sourceValue ||
      x.source_value
  );

  const url =
    sourceType === "website" ||
    sourceType === "google_maps" ||
    sourceType === "instagram"
      ? normalizeUrl(rawUrl)
      : rawUrl;

  if (!sourceType && !url) return null;

  return {
    sourceType,
    url,
    label: s(x.label || x.title || x.name),
    isPrimary:
      typeof x.isPrimary === "boolean"
        ? x.isPrimary
        : typeof x.primary === "boolean"
          ? x.primary
          : false,
  };
}

function sourceSeedKey(item = {}) {
  const seed = normalizeSourceSeed(item);
  if (!seed?.sourceType && !seed?.url) return "";
  return `${lower(seed?.sourceType)}|${lower(seed?.url)}`;
}

function buildIntakeBundleKey(input = {}) {
  const context = obj(input);
  const primaryKey = sourceSeedKey(context.primarySource);
  const sourceKeys = dedupeSourceSeeds(arr(context.sources))
    .map(sourceSeedKey)
    .filter(Boolean)
    .sort();

  return JSON.stringify({
    primaryKey,
    sourceKeys,
  });
}

function isMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return s(value) !== "";
}

function authorityRankForSourceType(sourceType = "") {
  const x = lower(sourceType);
  if (x === "website") return 300;
  if (x === "instagram") return 200;
  if (x === "google_maps") return 100;
  return 0;
}

function buildContributionKey(sourceType = "", sourceUrl = "") {
  return `${lower(sourceType)}|${lower(sourceUrl)}`;
}

function extractContributionKey(contribution = {}) {
  const summary = obj(contribution?.sourceSummary);
  const latestImport = obj(summary.latestImport);
  return buildContributionKey(
    s(latestImport.sourceType || summary.primarySourceType),
    s(latestImport.sourceUrl || summary.primarySourceUrl)
  );
}

function mergeProfileWithPrecedence(contributions = []) {
  const fieldSources = {};
  const out = {};
  const metaKeys = new Set([
    "fieldSources",
    "fieldConfidence",
    "reviewFlags",
    "reviewRequired",
    "sourceType",
    "sourceUrl",
  ]);

  const sorted = [...arr(contributions)].sort((a, b) => {
    const aSummary = obj(a.sourceSummary);
    const bSummary = obj(b.sourceSummary);
    const aImport = obj(aSummary.latestImport);
    const bImport = obj(bSummary.latestImport);
    return (
      authorityRankForSourceType(aImport.sourceType) -
      authorityRankForSourceType(bImport.sourceType)
    );
  });

  for (const contribution of sorted) {
    const profile = obj(contribution.businessProfile);
    const summary = obj(contribution.sourceSummary);
    const latestImport = obj(summary.latestImport);
    const sourceType = s(latestImport.sourceType || profile.sourceType);
    const sourceUrl = s(latestImport.sourceUrl || profile.sourceUrl);
    const incomingRank = authorityRankForSourceType(sourceType);

    for (const [field, value] of Object.entries(profile)) {
      if (metaKeys.has(field)) continue;
      if (!isMeaningfulValue(value)) continue;

      const currentSource = obj(fieldSources[field]);
      const currentRank = authorityRankForSourceType(currentSource.sourceType);
      const shouldReplace =
        !Object.prototype.hasOwnProperty.call(out, field) ||
        !isMeaningfulValue(out[field]) ||
        incomingRank > currentRank ||
        sourceType === s(currentSource.sourceType);

      if (!shouldReplace) continue;

      out[field] = cloneJson(value, value);
      fieldSources[field] = {
        sourceType,
        sourceUrl,
        authorityRank: incomingRank,
        sourceLabel: s(latestImport.sourceLabel || sourceType),
        observedValue:
          Array.isArray(value)
            ? value.map((item) => s(item)).filter(Boolean)
            : typeof value === "object"
              ? cloneJson(value, value)
              : s(value),
      };
    }
  }

  return compactObject({
    ...out,
    fieldSources,
  });
}

function recomputeDraftFromContributions({
  currentDraft = {},
  contributions = [],
  importedPatch = {},
} = {}) {
  const items = arr(contributions);
  const businessProfile = mergeProfileWithPrecedence(items);
  const capabilities = mergeDeep(
    {},
    ...items.map((item) => obj(item.capabilities))
  );
  const services = items.reduce(
    (acc, item) => mergeDraftItems(acc, arr(item.services), ["key", "title"]),
    []
  );
  const knowledgeItems = items.reduce(
    (acc, item) =>
      mergeDraftItems(acc, arr(item.knowledgeItems), ["key", "title", "category"]),
    []
  );
  const warnings = normalizeMergedReviewWarnings({
    warnings: uniqStrings(items.flatMap((item) => arr(item.warnings))),
    businessProfile,
    services,
    knowledgeItems,
    contributions: items,
  });
  const sourceSummary = mergeSourceSummaryState(
    obj(currentDraft.sourceSummary),
    obj(importedPatch.sourceSummary)
  );
  const diffFromCanonical = mergeDeep(
    {},
    ...items.map((item) => obj(item.diffFromCanonical))
  );
  const lastSnapshotId = importedPatch.lastSnapshotId || null;
  const draftPayload = mergeDeep(
    {},
    obj(currentDraft.draftPayload),
    obj(importedPatch.draftPayload),
    {
      sourceContributions: Object.fromEntries(
        items.map((item) => {
          const key = extractContributionKey(item);
          return [
            key,
            compactObject({
              businessProfile: obj(item.businessProfile),
              capabilities: obj(item.capabilities),
              services: arr(item.services),
              knowledgeItems: arr(item.knowledgeItems),
              warnings: arr(item.warnings),
              websiteKnowledge: obj(item.websiteKnowledge),
              diffFromCanonical: obj(item.diffFromCanonical),
              sourceSummary: obj(item.sourceSummary),
            }),
          ];
        })
      ),
    }
  );

  const completeness = calculateCompleteness({
    businessProfile,
    services,
    knowledgeItems,
    warnings,
  });

  const confidenceSummary = calculateConfidenceSummary({
    services,
    knowledgeItems,
  });

  return {
    draftPayload,
    businessProfile,
    capabilities,
    services,
    knowledgeItems,
    channels: mergeJsonArrayByValue(
      arr(currentDraft.channels),
      arr(importedPatch.channels)
    ),
    sourceSummary,
    warnings,
    completeness,
    confidenceSummary,
    diffFromCanonical,
    lastSnapshotId,
  };
}

function normalizeMergedReviewWarnings({
  warnings = [],
  businessProfile = {},
  services = [],
  knowledgeItems = [],
  contributions = [],
} = {}) {
  const mergedProfile = obj(businessProfile);
  const contributionList = arr(contributions);
  const hasInstagramSupport = contributionList.some(
    (item) => lower(obj(obj(item.sourceSummary).latestImport).sourceType) === "instagram"
  );
  const hasContactCoverage =
    !!(
      s(mergedProfile.primaryEmail) ||
      s(mergedProfile.primaryPhone) ||
      arr(mergedProfile.emails).length ||
      arr(mergedProfile.phones).length ||
      arr(mergedProfile.whatsappLinks).length ||
      arr(mergedProfile.bookingLinks).length ||
      arr(mergedProfile.socialLinks).length
    );
  const hasServiceCoverage =
    arr(services).length > 0 || arr(mergedProfile.services).length > 0;
  const hasFaqCoverage =
    arr(knowledgeItems).some((item) => lower(item.category).includes("faq")) ||
    arr(mergedProfile.faqItems).length > 0;

  const out = [];
  for (const warning of uniqStrings(arr(warnings))) {
    const code = s(warning);

    if (
      hasContactCoverage &&
      [
        "missing_contact_signals",
        "missing_contact_email",
        "missing_contact_phone",
        "no strong direct contact signals were extracted from the website",
      ].includes(code)
    ) {
      continue;
    }

    if (
      hasServiceCoverage &&
      [
        "missing_service_signals",
        "missing_service_hints",
        "no strong service signals were extracted from the website",
      ].includes(code)
    ) {
      continue;
    }

    if (
      hasFaqCoverage &&
      [
        "faq_help_content_not_detected",
        "faq/help content was not detected during website crawl",
      ].includes(code)
    ) {
      continue;
    }

    out.push(code);
  }

  if (hasInstagramSupport) {
    const websiteContribution = contributionList.find(
      (item) => lower(obj(obj(item.sourceSummary).latestImport).sourceType) === "website"
    );
    const instagramContribution = contributionList.find(
      (item) => lower(obj(obj(item.sourceSummary).latestImport).sourceType) === "instagram"
    );
    const websiteProfile = obj(websiteContribution?.businessProfile);
    const instagramProfile = obj(instagramContribution?.businessProfile);
    const websiteDirectContact =
      s(websiteProfile.primaryEmail) ||
      s(websiteProfile.primaryPhone) ||
      arr(websiteProfile.emails).length ||
      arr(websiteProfile.phones).length ||
      arr(websiteProfile.whatsappLinks).length ||
      arr(websiteProfile.bookingLinks).length;
    const instagramDirectContact =
      s(instagramProfile.primaryEmail) ||
      s(instagramProfile.primaryPhone) ||
      arr(instagramProfile.emails).length ||
      arr(instagramProfile.phones).length ||
      arr(instagramProfile.whatsappLinks).length ||
      arr(instagramProfile.bookingLinks).length;

    if (!websiteDirectContact && instagramDirectContact) {
      out.push("website_contact_signals_weak_but_supported_by_connected_instagram");
    }
  }

  return uniqStrings(out);
}

function buildSourceContributionMap(currentDraft = {}) {
  const existing = obj(obj(currentDraft.draftPayload).sourceContributions);
  return new Map(
    Object.entries(existing).map(([key, value]) => [key, obj(value)])
  );
}

function dedupeSourceSeeds(list = []) {
  const out = [];
  const seen = new Set();

  for (const raw of arr(list)) {
    const item = normalizeSourceSeed(raw);
    const key = sourceSeedKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function hasMeaningfulDraftContent(draft = {}) {
  return !!(
    hasDraftIdentityCoverage(draft) ||
    hasDraftContactCoverage(draft) ||
    hasDraftServiceCoverage(draft) ||
    hasDraftKnowledgeCoverage(draft)
  );
}

function hasDraftIdentityCoverage(draft = {}) {
  const profile = obj(draft?.businessProfile);
  return !!(
    s(profile.companyName) ||
    s(profile.displayName) ||
    s(profile.legalName) ||
    s(profile.description) ||
    s(profile.summary)
  );
}

function hasDraftContactCoverage(draft = {}) {
  const profile = obj(draft?.businessProfile);
  return !!(
    s(profile.primaryEmail) ||
    s(profile.primaryPhone) ||
    arr(profile.emails).length ||
    arr(profile.phones).length ||
    arr(profile.whatsappLinks).length ||
    arr(profile.bookingLinks).length ||
    arr(profile.socialLinks).length ||
    arr(draft?.contacts).length
  );
}

function hasDraftServiceCoverage(draft = {}) {
  const profile = obj(draft?.businessProfile);
  return !!(
    arr(draft?.services).length ||
    arr(profile.services).length
  );
}

function hasDraftKnowledgeCoverage(draft = {}) {
  const profile = obj(draft?.businessProfile);
  return !!(
    arr(draft?.knowledgeItems).length ||
    arr(profile.faqItems).length
  );
}

function buildWeakWebsiteDraftWarnings(draft = {}) {
  const warnings = [];

  if (!hasMeaningfulDraftContent(draft)) {
    warnings.push("website_review_data_partially_available");
  }

  if (!hasDraftIdentityCoverage(draft)) {
    warnings.push("website_identity_signals_weak");
  }

  if (!hasDraftContactCoverage(draft)) {
    warnings.push("website_contact_signals_weak");
  }

  if (!hasDraftServiceCoverage(draft)) {
    warnings.push("website_service_signals_weak");
  }

  if (!hasDraftKnowledgeCoverage(draft)) {
    warnings.push("website_faq_signals_weak");
  }

  return uniqStrings(warnings);
}

function shouldForcePartialModeFromWarnings(warnings = []) {
  const codes = new Set(arr(warnings).map((item) => s(item)));
  return (
    codes.has("website_review_data_partially_available") ||
    codes.has("website_identity_signals_weak") ||
    codes.has("website_contact_signals_weak") ||
    codes.has("website_service_signals_weak")
  );
}

function extractExistingIntakeContext(review = {}) {
  return obj(review?.session?.metadata?.lastIntakeContext);
}

function extractDraftWebsiteSeed(review = {}) {
  const draft = obj(review?.draft);
  const draftPayload = obj(draft?.draftPayload);
  const canonicalProfile = obj(draft?.businessProfile);
  const payloadProfile = obj(draftPayload?.profile);
  const setupAssistant = obj(draftPayload?.setupAssistant || draftPayload?.onboarding);
  const assistantProfile = obj(setupAssistant?.businessProfile);

  const websiteUrl = normalizeUrl(
    canonicalProfile.websiteUrl ||
      canonicalProfile.website ||
      payloadProfile.websiteUrl ||
      payloadProfile.website ||
      assistantProfile.websiteUrl ||
      assistantProfile.website
  );

  if (!websiteUrl) return null;

  return normalizeSourceSeed({
    sourceType: "website",
    url: websiteUrl,
    isPrimary: true,
  });
}

function extractPrimarySeedFromReview(review = {}) {
  const existingContext = extractExistingIntakeContext(review);
  const fromContext = normalizeSourceSeed(existingContext?.primarySource);

  if (fromContext?.sourceType || fromContext?.url) {
    return fromContext;
  }

  const summary = obj(review?.draft?.sourceSummary);
  const sourceType =
    s(review?.session?.primarySourceType) || s(summary?.primarySourceType);
  const url = s(summary?.primarySourceUrl);

  const fromSummary = normalizeSourceSeed({
    sourceType,
    url,
    isPrimary: true,
  });

  if (fromSummary?.sourceType || fromSummary?.url) {
    return fromSummary;
  }

  return extractDraftWebsiteSeed(review);
}

function extractBundleSeedsFromReview(review = {}) {
  const existingContext = extractExistingIntakeContext(review);
  const existingSeeds = dedupeSourceSeeds([
    obj(existingContext?.primarySource),
    ...arr(existingContext?.sources),
  ]);

  if (existingSeeds.length) {
    return existingSeeds;
  }

  const fallbackPrimary = extractPrimarySeedFromReview(review);
  return fallbackPrimary ? [fallbackPrimary] : [];
}

function buildMergedIntakeContext({
  currentReview = {},
  incomingType = "",
  incomingUrl = "",
  nextIntakeContext = {},
} = {}) {
  const existingContext = extractExistingIntakeContext(currentReview);
  const existingSeeds = extractBundleSeedsFromReview(currentReview);
  const nextSeeds = dedupeSourceSeeds([
    obj(nextIntakeContext?.primarySource),
    ...arr(nextIntakeContext?.sources),
  ]);

  const mergedSeeds = dedupeSourceSeeds([
    ...existingSeeds,
    ...nextSeeds,
    {
      sourceType: incomingType,
      url: incomingUrl,
      isPrimary:
        sourceSeedKey(nextIntakeContext?.primarySource) ===
        sourceSeedKey({ sourceType: incomingType, url: incomingUrl }),
    },
  ]);

  const desiredPrimary =
    normalizeSourceSeed(nextIntakeContext?.primarySource) ||
    extractPrimarySeedFromReview(currentReview) ||
    normalizeSourceSeed({
      sourceType: incomingType,
      url: incomingUrl,
      isPrimary: true,
    });

  return normalizeIntakeContext({
    sourceType: incomingType,
    url: incomingUrl,
    note: s(nextIntakeContext?.note || existingContext?.note),
    sources: mergedSeeds,
    primarySource: desiredPrimary,
    metadataJson: mergeDeep(
      obj(existingContext?.metadataJson),
      obj(nextIntakeContext?.metadataJson),
      {
        mergedSourceCount: mergedSeeds.length,
      }
    ),
  });
}

function shouldReuseSessionForImport({
  currentReview = {},
  incomingType = "",
  incomingUrl = "",
  nextIntakeContext = {},
  allowSessionReuse = false,
} = {}) {
  if (!allowSessionReuse) return false;
  if (!s(currentReview?.session?.id)) return false;
  if (lower(currentReview?.session?.status) === "failed") return false;
  if (isPollutedFailedReviewDraft(currentReview)) return false;

  const incomingPrimaryKey = sourceSeedKey(
    normalizeSourceSeed({
      sourceType: incomingType,
      url: incomingUrl,
      ...(obj(nextIntakeContext?.primarySource) || {}),
    })
  );
  const existingPrimaryKey = sourceSeedKey(extractPrimarySeedFromReview(currentReview));

  if (!incomingPrimaryKey || !existingPrimaryKey) return false;
  if (incomingPrimaryKey !== existingPrimaryKey) return false;

  const existingBundleKey =
    s(currentReview?.session?.metadata?.intakeBundleKey) ||
    buildIntakeBundleKey({
      primarySource: extractPrimarySeedFromReview(currentReview),
      sources: extractBundleSeedsFromReview(currentReview),
    });
  const nextBundleKey = buildIntakeBundleKey(nextIntakeContext);

  if (!existingBundleKey || !nextBundleKey) return false;
  return existingBundleKey === nextBundleKey;
}

function shouldPromoteImportedSourceToPrimary({
  currentReview = {},
  incomingType = "",
  incomingUrl = "",
  nextIntakeContext = {},
} = {}) {
  const incomingKey = sourceSeedKey({
    sourceType: incomingType,
    url: incomingUrl,
  });

  const requestedPrimaryKey = sourceSeedKey(nextIntakeContext?.primarySource);
  if (requestedPrimaryKey && incomingKey && requestedPrimaryKey === incomingKey) {
    return true;
  }

  const existingPrimaryKey = sourceSeedKey(
    extractPrimarySeedFromReview(currentReview)
  );

  if (!existingPrimaryKey) return true;
  return existingPrimaryKey === incomingKey;
}

function mergeJsonArrayByValue(existing = [], incoming = []) {
  const out = [];
  const seen = new Set();

  for (const item of [...arr(existing), ...arr(incoming)]) {
    const key = JSON.stringify(item || {});
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function mergeSourceSummaryState(existing = {}, incoming = {}) {
  const current = obj(existing);
  const next = obj(incoming);

  const importMap = new Map();

  for (const item of [...arr(current.imports), ...arr(next.imports)]) {
    const x = obj(item);
    const key = [
      s(x.requestId),
      lower(x.sourceType),
      lower(x.sourceUrl),
      s(x.runId),
    ].join("|");

    if (!key) continue;

    importMap.set(key, mergeDeep(obj(importMap.get(key)), x));
  }

  const imports = [...importMap.values()].slice(-10);
  const sourceTypes = uniqStrings([
    ...arr(current.sourceTypes),
    ...arr(next.sourceTypes),
    ...imports.map((item) => s(item?.sourceType)),
  ]);

  return {
    ...mergeDeep(current, next),
    primarySourceType: s(current.primarySourceType || next.primarySourceType),
    primarySourceId: current.primarySourceId || next.primarySourceId || null,
    primarySourceUrl: s(current.primarySourceUrl || next.primarySourceUrl),
    latestImport: obj(next.latestImport || current.latestImport),
    latestRequestId: s(next.latestRequestId || current.latestRequestId),
    latestSourceId: next.latestSourceId || current.latestSourceId || null,
    latestRunId: next.latestRunId || current.latestRunId || null,
    latestSnapshotId: next.latestSnapshotId || current.latestSnapshotId || null,
    sourceTypes,
    totalImportedSources: sourceTypes.length,
    imports,
  };
}

function mergeImportedDraftPatch({
  currentDraft = {},
  importedPatch = {},
} = {}) {
  const contributionKey = extractContributionKey(importedPatch);
  const contributionMap = buildSourceContributionMap(currentDraft);

  if (contributionKey) {
    contributionMap.set(contributionKey, {
      businessProfile: obj(importedPatch.businessProfile),
      capabilities: obj(importedPatch.capabilities),
      services: arr(importedPatch.services),
      knowledgeItems: arr(importedPatch.knowledgeItems),
      warnings: arr(importedPatch.warnings),
      websiteKnowledge: obj(importedPatch.websiteKnowledge),
      diffFromCanonical: obj(importedPatch.diffFromCanonical),
      sourceSummary: obj(importedPatch.sourceSummary),
    });
  }

  return recomputeDraftFromContributions({
    currentDraft,
    contributions: [...contributionMap.values()],
    importedPatch,
  });
}

function buildBundleSources({
  websiteUrl = "",
  instagramUrl = "",
  note = "",
  metadataJson = {},
} = {}) {
  const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
  const normalizedInstagramUrl = normalizeUrl(instagramUrl);
  if (!normalizedWebsiteUrl) {
    throw new Error("Website URL is required for bundled setup import");
  }

  const sources = [
    {
      sourceType: "website",
      url: normalizedWebsiteUrl,
      isPrimary: true,
    },
  ];

  if (normalizedInstagramUrl) {
    sources.push({
      sourceType: "instagram",
      url: normalizedInstagramUrl,
      isPrimary: false,
    });
  }

  return {
    note: s(note),
    metadataJson: obj(metadataJson),
    primarySource: {
      sourceType: "website",
      url: normalizedWebsiteUrl,
      isPrimary: true,
    },
    sources,
  };
}

async function buildAcceptedImportResult({
  db,
  scope,
  role,
  tenant,
  normalizedType,
  normalizedUrl,
  intakeContext,
  requestId,
  session,
  ensured,
  createdRun,
  collector,
  reuseExistingSession,
  promoteImportedSourceToPrimary,
  setup = null,
}) {
  const setupState =
    setup ??
    (await buildSetupState({
      db,
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      role,
      tenant,
    }));

  return {
    ok: true,
    accepted: true,
    mode: "accepted",
    partial: false,
    stage: "source_sync",
    status: "queued",
    warnings: [],
    sourceType: normalizedType,
    sourceLabel: sourceTypeLabel(normalizedType),
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    sourceUrl: normalizedUrl,
    intakeContext,
    requestId,
    reviewSessionId: s(session?.id || ""),
    reviewSessionStatus: "processing",
    source: ensured?.source || null,
    run: createdRun?.run || null,
    candidateCount: 0,
    shouldReview: false,
    setup: setupState,
    debug: {
      requestId,
      reviewSessionId: s(session?.id || ""),
      rawMode: "accepted",
      rawStage: "source_sync",
      warningCount: 0,
      returnedUpdatedRun: !!createdRun?.run?.id,
      returnedUpdatedSource: !!ensured?.source?.id,
      sourceTable: ensured?.table || "",
      runTable: createdRun?.table || "",
      sourceAuthorityClass: sourceAuthorityClass(normalizedType),
      intakeSourceCount: Number(intakeContext.sourceCount || 0),
      collectorCandidateCount: Number(collector?.candidateCount || 0),
      collectorObservationCount: Number(collector?.observationCount || 0),
      collectorLastSnapshotId: collector?.lastSnapshotId || null,
      freshSession: !reuseExistingSession,
      reuseExistingSession,
      promotedPrimarySource: promoteImportedSourceToPrimary,
    },
  };
}

async function completeImportSourceByType({
  db,
  scope,
  role,
  tenant,
  normalizedType,
  normalizedUrl,
  actor,
  note,
  intakeContext,
  intakeBundleKey,
  primarySourceKey,
  promoteImportedSourceToPrimary,
  currentReview,
  reuseExistingSession,
  sourceTable,
  runTable,
  requestId,
  session,
  ensured,
  createdRun,
  collector,
  deferFailureStatus = false,
}) {
  const logger = createLogger({
    component: "workspace-import-complete",
    requestId,
    runId: s(createdRun?.run?.id),
    sourceId: s(ensured?.source?.id),
    reviewSessionId: s(session?.id),
    tenantId: scope?.tenantId,
    tenantKey: scope?.tenantKey,
    sourceType: normalizedType,
  });

  const result = await runSourceSync({
      db,
      source: ensured.source,
      run: createdRun.run,
    requestedBy: actor.auditValue,
    reviewSessionId: session.id,
    setupReviewSessionId: session.id,
    sources: buildSourcesAdapter(db, {
      sourceTable: ensured.table || sourceTable,
      runTable: createdRun.table || runTable,
      reviewSessionId: session.id,
    }),
    knowledge: buildKnowledgeAdapter({
      db,
      scope: {
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
      },
      reviewSessionId: session.id,
      collector,
    }),
      fusion: buildFusionAdapter({
        db,
        scope: {
          tenantId: scope.tenantId,
          tenantKey: scope.tenantKey,
        },
        reviewSessionId: session.id,
        collector,
      }),
      artifacts: createTenantSourceArtifactsHelpers({ db }),
    });

  let warnings = arr(result?.warnings).map((x) => s(x)).filter(Boolean);
  let mode = s(result?.mode || "success");
  let partial = lower(mode) === "partial";
  const rawErrorLike =
    result?.ok === false ||
    lower(mode) === "error" ||
    !!s(result?.error);

  const currentDraft =
    (await readSetupReviewDraft({
      sessionId: session.id,
      tenantId: scope.tenantId,
    })) || {};

  const importedPatch = deriveDraftPatch({
    currentDraft,
    session,
    source: result?.source || ensured.source,
    run: result?.run || createdRun.run,
    result,
    requestId,
    sourceType: normalizedType,
    sourceUrl: normalizedUrl,
    intakeContext,
    collector,
  });

  const draftPatch = reuseExistingSession
    ? mergeImportedDraftPatch({
        currentDraft,
        importedPatch,
      })
    : importedPatch;

  let draft = await patchSetupReviewDraft({
    sessionId: session.id,
    tenantId: scope.tenantId,
    patch: draftPatch,
    bumpVersion: true,
  });

  if (normalizedType === "website") {
    const websiteWeakWarnings = buildWeakWebsiteDraftWarnings(draft);
    const mergedWarnings = uniqStrings([
      ...warnings,
      ...arr(draft?.warnings),
      ...websiteWeakWarnings,
    ]);

    const warningsChanged =
      JSON.stringify(uniqStrings(arr(draft?.warnings))) !==
      JSON.stringify(mergedWarnings);

    if (warningsChanged) {
      draft = await patchSetupReviewDraft({
        sessionId: session.id,
        tenantId: scope.tenantId,
        patch: {
          warnings: mergedWarnings,
          completeness: calculateCompleteness({
            businessProfile: obj(draft?.businessProfile),
            services: arr(draft?.services),
            knowledgeItems: arr(draft?.knowledgeItems),
            warnings: mergedWarnings,
          }),
          confidenceSummary: calculateConfidenceSummary({
            services: arr(draft?.services),
            knowledgeItems: arr(draft?.knowledgeItems),
          }),
        },
        bumpVersion: false,
      });
    }

    warnings = mergedWarnings;
    if (!rawErrorLike && shouldForcePartialModeFromWarnings(warnings)) {
      partial = true;
      if (lower(mode) !== "error") {
        mode = "partial";
      }
    }
  } else {
    warnings = uniqStrings([...warnings, ...arr(draft?.warnings)]);
  }

  const responseProfile = obj(draft?.businessProfile);
  const responseDraftPayload = obj(draft?.draftPayload);
  const existingPrimarySeed = extractPrimarySeedFromReview(currentReview);

  const nextPrimarySourceType = promoteImportedSourceToPrimary
    ? normalizedType
    : s(
        session.primarySourceType ||
          existingPrimarySeed?.sourceType ||
          intakeContext?.primarySource?.sourceType ||
          normalizedType
      );

  const nextPrimarySourceId = promoteImportedSourceToPrimary
    ? (result?.source || ensured.source)?.id || session.primarySourceId || null
    : session.primarySourceId || null;

  const nextSessionMetadata = mergeDeep(obj(session.metadata), {
    freshSession: !reuseExistingSession,
    reuseExistingSession,
    requestId,
    sourceType: normalizedType,
    sourceUrl: normalizedUrl,
    sourceLabel: sourceTypeLabel(normalizedType),
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    lastIntakeContext: intakeContext,
    lastImportedAt: nowIso(),
    lastSourceId: (result?.source || ensured.source)?.id || null,
    lastRunId: (result?.run || createdRun.run)?.id || null,
    lastSnapshotId: collector.lastSnapshotId || null,
    lastDraftVersion: draft?.version || null,
    lastMode: mode,
    lastStage: s(result?.stage),
    lastWarningCount: warnings.length,
    lastCandidateCount: Number(
      result?.candidateCount ||
        result?.candidatesCreated ||
        collector?.candidateCount ||
        0
    ),
    lastRequestedBy: actor.auditValue,
    lastRequestedByUserId: actor.userId || "",
    lastRequestedByEmail: actor.email || "",
    lastRequestedByName: actor.name || "",
    requestedSourceCount: Number(intakeContext.sourceCount || 0),
    requestedSourceTypes: arr(intakeContext.sourceTypes),
    intakeBundleKey,
    primarySourceKey,
    promotedPrimarySource: promoteImportedSourceToPrimary,
  });

  session = await updateSetupReviewSession(session.id, {
    metadata: nextSessionMetadata,
    currentStep: rawErrorLike
      ? deferFailureStatus
        ? "source_sync"
        : "failed"
      : "review",
    primarySourceType: nextPrimarySourceType,
    primarySourceId: nextPrimarySourceId,
    notes: s(note) || session.notes || "",
  });

  if (rawErrorLike) {
    logger.warn("setup_import.complete.failed", {
      stage: s(result?.stage),
      mode,
      warningCount: warnings.length,
      deferFailureStatus,
    });

    if (!deferFailureStatus) {
      session = await failSetupReviewSession(
        session.id,
        new Error(s(result?.error || result?.reason || "Source sync failed")),
        {
          currentStep: "source_sync",
          payload: {
            requestId,
            sourceType: normalizedType,
            sourceUrl: normalizedUrl,
            stage: s(result?.stage),
            mode,
            warningCount: warnings.length,
            reuseExistingSession,
          },
        }
      );
    }

    const setup = await buildSetupState({
      db,
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      role,
      tenant,
    });

    return {
      ok: false,
      mode,
      partial,
      error: s(result?.error),
      reason: s(result?.reason || result?.error),
      stage: s(result?.stage),
      warnings,
      sourceType: normalizedType,
      sourceLabel: sourceTypeLabel(normalizedType),
      sourceAuthorityClass: sourceAuthorityClass(normalizedType),
      sourceUrl: normalizedUrl,
      intakeContext,
      requestId,
      reviewSessionId: s(session?.id || ""),
      reviewSessionStatus: s(
        session?.status || (deferFailureStatus ? "processing" : "failed")
      ),
      draft,
      source: result?.source || ensured.source,
      run: result?.run || createdRun.run,
      candidateCount: Number(
        result?.candidateCount ||
          result?.candidatesCreated ||
          collector?.candidateCount ||
          0
      ),
      profile: responseProfile,
      signals: obj(responseDraftPayload?.signals || result?.signals),
      snapshot: obj(responseDraftPayload?.snapshot || result?.snapshot),
      extracted: obj(responseDraftPayload?.extracted || result?.extracted),
      shouldReview: true,
      setup,
      debug: {
        requestId,
        reviewSessionId: s(session?.id || ""),
        rawMode: s(result?.mode),
        rawStage: s(result?.stage),
        rawError: s(result?.error),
        warningCount: warnings.length,
        returnedUpdatedRun: !!result?.run?.id,
        returnedUpdatedSource: !!result?.source?.id,
        sourceTable: ensured.table || sourceTable,
        runTable: createdRun.table || runTable,
        sourceAuthorityClass: sourceAuthorityClass(normalizedType),
        intakeSourceCount: Number(intakeContext.sourceCount || 0),
        collectorCandidateCount: Number(collector.candidateCount || 0),
        collectorObservationCount: Number(collector.observationCount || 0),
        collectorLastSnapshotId: collector.lastSnapshotId || null,
        actorUserId: actor.userId || "",
        actorEmail: actor.email || "",
        freshSession: !reuseExistingSession,
        reuseExistingSession,
        promotedPrimarySource: promoteImportedSourceToPrimary,
      },
    };
  }

  session = await markSetupReviewSessionReady(session.id, {
    currentStep: "review",
    payload: {
      requestId,
      sourceType: normalizedType,
      sourceUrl: normalizedUrl,
      mode,
      warningCount: warnings.length,
      candidateCount: Number(
        result?.candidateCount ||
          result?.candidatesCreated ||
          collector?.candidateCount ||
          0
      ),
      reuseExistingSession,
    },
  });

  const setup = await buildSetupState({
    db,
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    role,
    tenant,
  });

  logger.info("setup_import.complete.ready", {
    mode,
    stage: s(result?.stage),
    candidateCount: Number(
      result?.candidateCount ||
        result?.candidatesCreated ||
        collector?.candidateCount ||
        0
    ),
    warningCount: warnings.length,
  });

  return {
    ok: result?.ok !== false,
    mode,
    partial,
    error: s(result?.error),
    reason: s(result?.reason || result?.error),
    stage: s(result?.stage),
    warnings,
    sourceType: normalizedType,
    sourceLabel: sourceTypeLabel(normalizedType),
    sourceAuthorityClass: sourceAuthorityClass(normalizedType),
    sourceUrl: normalizedUrl,
    intakeContext,
    requestId,
    reviewSessionId: s(session?.id || ""),
    reviewSessionStatus: s(session?.status || "ready"),
    draft,
    source: result?.source || ensured.source,
    run: result?.run || createdRun.run,
    candidateCount: Number(
      result?.candidateCount ||
        result?.candidatesCreated ||
        collector?.candidateCount ||
        0
    ),
    profile: responseProfile,
    signals: obj(responseDraftPayload?.signals || result?.signals),
    snapshot: obj(responseDraftPayload?.snapshot || result?.snapshot),
    extracted: obj(responseDraftPayload?.extracted || result?.extracted),
    shouldReview:
      partial ||
      Number(
        result?.candidateCount ||
          result?.candidatesCreated ||
          collector?.candidateCount ||
          0
      ) > 0,
    setup,
    debug: {
      requestId,
      reviewSessionId: s(session?.id || ""),
      rawMode: s(result?.mode),
      rawStage: s(result?.stage),
      rawError: s(result?.error),
      warningCount: warnings.length,
      returnedUpdatedRun: !!result?.run?.id,
      returnedUpdatedSource: !!result?.source?.id,
      sourceTable: ensured.table || sourceTable,
      runTable: createdRun.table || runTable,
      sourceAuthorityClass: sourceAuthorityClass(normalizedType),
      intakeSourceCount: Number(intakeContext.sourceCount || 0),
      collectorCandidateCount: Number(collector.candidateCount || 0),
      collectorObservationCount: Number(collector.observationCount || 0),
      collectorLastSnapshotId: collector.lastSnapshotId || null,
      actorUserId: actor.userId || "",
      actorEmail: actor.email || "",
      freshSession: !reuseExistingSession,
      reuseExistingSession,
      promotedPrimarySource: promoteImportedSourceToPrimary,
    },
  };
}

async function importSourceByType({
  db,
  tenantId,
  tenantKey,
  role = "",
  tenant = null,
  sourceType,
  url = "",
  requestedBy = "",
  requestedByUserId = "",
  requestedByEmail = "",
  requestedByName = "",
  note = "",
  sources = [],
  primarySource = null,
  metadataJson = {},
  allowSessionReuse = false,
  waitForCompletion = false,
  requestId: requestIdOverride = "",
}) {
  const normalizedUrl = normalizeUrl(url);
  const normalizedType = normalizeSourceType(sourceType);

  if (!normalizedUrl) {
    throw new Error("Valid source URL is required");
  }

  if (normalizedType === "website") {
    try {
      await assertSafePublicFetchUrl(normalizedUrl);
    } catch (error) {
      if (error?.code === "UNSAFE_PUBLIC_FETCH_URL_DENIED") {
        throw new Error(
          `Unsafe website source URL denied: ${s(error?.reasonCode || "unsafe_destination_denied")}`
        );
      }
      throw error;
    }
  }

  const actor = normalizeActorContext({
    requestedBy,
    requestedByUserId,
    requestedByEmail,
    requestedByName,
  });

  const scope = await resolveTenantScope({ db, tenantId, tenantKey });

  const sourceTable = await findFirstExistingTable(db, SOURCE_TABLES);
  const runTable = await findFirstExistingTable(db, SOURCE_RUN_TABLES);

  if (!sourceTable) {
    throw new Error("Sources table is missing");
  }

  if (!runTable) {
    throw new Error("Source sync runs table is missing");
  }

  const requestId =
    s(requestIdOverride) ||
    buildRequestId({
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      sourceType: normalizedType,
      url: normalizedUrl,
    });

  const logger = createLogger({
    component: "workspace-import",
    requestId,
    tenantId: scope.tenantId,
    tenantKey: scope.tenantKey,
    sourceType: normalizedType,
    sourceUrl: normalizedUrl,
  });

  const rawIntakeContext = normalizeIntakeContext({
    sourceType: normalizedType,
    url: normalizedUrl,
    note,
    sources,
    primarySource,
    metadataJson,
  });

  const currentReview = await getCurrentSetupReview(scope.tenantId);
  const reuseExistingSession = shouldReuseSessionForImport({
    currentReview,
    incomingType: normalizedType,
    incomingUrl: normalizedUrl,
    nextIntakeContext: rawIntakeContext,
    allowSessionReuse,
  });

  const intakeContext = reuseExistingSession
    ? buildMergedIntakeContext({
        currentReview,
        incomingType: normalizedType,
        incomingUrl: normalizedUrl,
        nextIntakeContext: rawIntakeContext,
      })
    : rawIntakeContext;

  const intakeBundleKey = buildIntakeBundleKey(intakeContext);
  const primarySourceKey = sourceSeedKey(intakeContext?.primarySource);

  const promoteImportedSourceToPrimary = shouldPromoteImportedSourceToPrimary({
    currentReview,
    incomingType: normalizedType,
    incomingUrl: normalizedUrl,
    nextIntakeContext: intakeContext,
  });

  let session = null;
  let ensured = null;
  let createdRun = null;

  const collector = createSetupReviewCollector({
    reviewSessionId: "",
    sourceType: normalizedType,
  });

  try {
    if (!reuseExistingSession) {
      await discardSetupReviewSession({
        tenantId: scope.tenantId,
        reason: "fresh_source_import_started",
        metadata: {
          requestId,
          sourceType: normalizedType,
          sourceUrl: normalizedUrl,
          discardedAt: nowIso(),
        },
      });

      session = await createSetupReviewSession({
        tenantId: scope.tenantId,
        mode: "setup",
        status: "draft",
        primarySourceType: normalizedType,
        startedBy: actor.userId || null,
        currentStep: "intake",
        title: buildSetupReviewTitle({
          sourceType: normalizedType,
          url: normalizedUrl,
        }),
        notes: s(note),
        metadata: {
          freshSession: true,
          reuseExistingSession: false,
          intakeBundleKey,
          primarySourceKey,
          requestId,
          sourceType: normalizedType,
          sourceUrl: normalizedUrl,
          sourceLabel: sourceTypeLabel(normalizedType),
          sourceAuthorityClass: sourceAuthorityClass(normalizedType),
          lastIntakeContext: intakeContext,
          lastRequestedBy: actor.auditValue,
          lastRequestedByUserId: actor.userId || "",
          lastRequestedByEmail: actor.email || "",
          lastRequestedByName: actor.name || "",
          lastImportedAt: nowIso(),
        },
        ensureDraft: true,
      });
    } else {
      const existingSession = obj(currentReview?.session);

      session = await updateSetupReviewSession(existingSession.id, {
        status: "draft",
        currentStep: "intake",
        title:
          s(existingSession.title) ||
          buildSetupReviewTitle({
            sourceType: normalizedType,
            url: normalizedUrl,
          }),
        notes: s(note) || s(existingSession.notes),
        metadata: mergeDeep(obj(existingSession.metadata), {
          freshSession: false,
          reuseExistingSession: true,
          intakeBundleKey,
          primarySourceKey,
          requestId,
          sourceType: normalizedType,
          sourceUrl: normalizedUrl,
          sourceLabel: sourceTypeLabel(normalizedType),
          sourceAuthorityClass: sourceAuthorityClass(normalizedType),
          lastIntakeContext: intakeContext,
          lastRequestedBy: actor.auditValue,
          lastRequestedByUserId: actor.userId || "",
          lastRequestedByEmail: actor.email || "",
          lastRequestedByName: actor.name || "",
          lastImportedAt: nowIso(),
        }),
      });
    }

    collector.reviewSessionId = s(session?.id);

    session = await markSetupReviewSessionProcessing(session.id, {
      currentStep: "source_sync",
      payload: {
        requestId,
        sourceType: normalizedType,
        sourceUrl: normalizedUrl,
        reuseExistingSession,
      },
    });

    ensured = await ensureSource(db, {
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      sourceType: normalizedType,
      url: normalizedUrl,
      requestedBy: actor.auditValue,
      requestedByUserId: actor.userId,
      requestedByEmail: actor.email,
      requestedByName: actor.name,
      intakeContext,
      requestId,
      reviewSessionId: session.id,
    });

    if (!ensured?.source?.id) {
      throw new Error("SourceRowMissingAfterEnsure");
    }

    await attachSourceToSetupReviewSession({
      sessionId: session.id,
      tenantId: scope.tenantId,
      sourceId: ensured.source.id,
      sourceType: normalizedType,
      role: promoteImportedSourceToPrimary ? "primary" : "supporting",
      label:
        s(ensured.source.display_name) ||
        s(ensured.source.name) ||
        buildSourceDisplayName({
          sourceType: normalizedType,
          url: normalizedUrl,
        }),
      position: Math.max(0, arr(currentReview?.sources).length),
      promotePrimary: promoteImportedSourceToPrimary,
      metadata: {
        requestId,
        sourceUrl: normalizedUrl,
        sourceAuthorityClass: sourceAuthorityClass(normalizedType),
        reuseExistingSession,
        requestedPrimary:
          sourceSeedKey(intakeContext?.primarySource) ===
          sourceSeedKey({ sourceType: normalizedType, url: normalizedUrl }),
      },
    });

    createdRun = await createSourceRun(db, {
      tenantId: scope.tenantId,
      tenantKey: scope.tenantKey,
      sourceId: ensured.source.id,
      sourceType: normalizedType,
      requestedBy: actor.auditValue,
      requestedByUserId: actor.userId,
      requestedByEmail: actor.email,
      requestedByName: actor.name,
      sourceUrl: normalizedUrl,
      intakeContext,
      requestId,
      reviewSessionId: session.id,
    });

    if (!createdRun?.run?.id) {
      throw new Error("SourceSyncRunMissingAfterCreate");
    }

    const completionArgs = {
      db,
      scope,
      role,
      tenant,
      normalizedType,
      normalizedUrl,
      actor,
      note,
      intakeContext,
      intakeBundleKey,
      primarySourceKey,
      promoteImportedSourceToPrimary,
      currentReview,
      reuseExistingSession,
      sourceTable,
      runTable,
      requestId,
      session,
      ensured,
      createdRun,
      collector,
    };

    if (waitForCompletion) {
      logger.info("setup_import.execution.inline", {
        reviewSessionId: s(session?.id),
        runId: s(createdRun?.run?.id),
      });
      return await completeImportSourceByType(completionArgs);
    }

    logger.info("setup_import.accepted", {
      reviewSessionId: s(session?.id),
      runId: s(createdRun?.run?.id),
      sourceId: s(ensured?.source?.id),
      reuseExistingSession,
    });

    return await buildAcceptedImportResult({
      db,
      scope,
      role,
      tenant,
      normalizedType,
      normalizedUrl,
      intakeContext,
      requestId,
      session,
      ensured,
      createdRun,
      collector,
      reuseExistingSession,
      promoteImportedSourceToPrimary,
    });
  } catch (error) {
    logger.error("setup_import.failed_before_queue", error, {
      reviewSessionId: s(session?.id),
      runId: s(createdRun?.run?.id),
      sourceId: s(ensured?.source?.id),
    });

    if (session?.id) {
      try {
        await failSetupReviewSession(session.id, error, {
          currentStep: "source_sync",
          payload: {
            requestId,
            sourceType: normalizedType,
            sourceUrl: normalizedUrl,
            sourceId: ensured?.source?.id || null,
            runId: createdRun?.run?.id || null,
            reuseExistingSession,
          },
        });
      } catch {
        // ignore secondary failure
      }
    }

    throw error;
  }
}

export async function resumeAcceptedImportRun({
  db,
  runId = "",
  deferFailureStatus = false,
} = {}) {
  const safeRunId = s(runId);
  if (!safeRunId) {
    throw new Error("resumeAcceptedImportRun: runId is required");
  }

  const runTable = await findFirstExistingTable(db, SOURCE_RUN_TABLES);
  const sourceTable = await findFirstExistingTable(db, SOURCE_TABLES);

  if (!runTable || !sourceTable) {
    throw new Error("resumeAcceptedImportRun: source sync tables are missing");
  }

  const runResult = await db.query(
    `select * from ${runTable} where id = $1 limit 1`,
    [safeRunId]
  );
  const run = runResult?.rows?.[0] || null;

  if (!run?.id) {
    throw new Error("resumeAcceptedImportRun: source sync run not found");
  }

  const sourceResult = await db.query(
    `select * from ${sourceTable} where id = $1 limit 1`,
    [s(run.source_id)]
  );
  const source = sourceResult?.rows?.[0] || null;

  if (!source?.id) {
    throw new Error("resumeAcceptedImportRun: source not found");
  }

  const scope = {
    tenantId: s(run.tenant_id),
    tenantKey: s(run.tenant_key),
  };

  const sessionId = s(run.review_session_id);
  const session = sessionId ? await getSetupReviewSessionById(sessionId) : null;
  if (!session?.id) {
    throw new Error("resumeAcceptedImportRun: setup review session not found");
  }

  if (["discarded", "finalized"].includes(lower(session.status))) {
    throw new Error(
      `resumeAcceptedImportRun: setup review session is ${lower(session.status)}`
    );
  }

  const intakeContext =
    obj(run.metadata_json?.intakeContext) || obj(run.input_summary_json);
  const logger = createLogger({
    component: "workspace-import-resume",
    requestId: s(run.metadata_json?.requestId),
    runId: s(run.id),
    sourceId: s(run.source_id),
    reviewSessionId: s(run.review_session_id),
    tenantId: s(run.tenant_id),
    tenantKey: s(run.tenant_key),
  });

  const actorMeta = obj(run.metadata_json?.actor);
  const normalizedType = normalizeSourceType(
    run.input_summary_json?.sourceType || run.source_type
  );
  const normalizedUrl = normalizeUrl(
    run.input_summary_json?.sourceUrl || run.source_url || run.url
  );

  const collector = createSetupReviewCollector({
    reviewSessionId: s(session.id),
    sourceType: normalizedType,
  });

  const completionArgs = {
    db,
    scope,
    role: "",
    tenant: null,
    normalizedType,
    normalizedUrl,
    actor: normalizeActorContext({
      requestedBy:
        s(actorMeta.requestedBy) || s(run.requested_by) || "source-sync-worker",
      requestedByUserId: s(actorMeta.requestedByUserId),
      requestedByEmail: s(actorMeta.requestedByEmail),
      requestedByName: s(actorMeta.requestedByName),
    }),
    note: s(session.notes),
    intakeContext,
    intakeBundleKey: s(session.metadata?.intakeBundleKey),
    primarySourceKey: s(session.metadata?.primarySourceKey),
    promoteImportedSourceToPrimary:
      s(session.primarySourceId || session.primary_source_id) === s(source.id),
    currentReview: {
      session,
    },
    reuseExistingSession: Boolean(session.metadata?.reuseExistingSession),
    sourceTable,
    runTable,
    requestId:
      s(run.metadata_json?.requestId) ||
      s(session.metadata?.requestId) ||
      buildRequestId({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        sourceType: normalizedType,
        url: normalizedUrl,
      }),
    session,
    ensured: {
      table: sourceTable,
      source,
    },
    createdRun: {
      table: runTable,
      run,
    },
    collector,
    deferFailureStatus,
  };

  logger.info("setup_import.resume.started");
  return completeImportSourceByType(completionArgs);
}

export async function importWebsiteSource(args = {}) {
  return importSourceByType({
    ...args,
    sourceType: "website",
  });
}

export async function importGoogleMapsSource(args = {}) {
  return importSourceByType({
    ...args,
    sourceType: "google_maps",
  });
}

export async function importInstagramSource(args = {}) {
  return importSourceByType({
    ...args,
    sourceType: "instagram",
  });
}

export async function importSourceBundle({
  db,
  websiteUrl = "",
  instagramUrl = "",
  note = "",
  metadataJson = {},
  ...rest
} = {}) {
  const bundle = buildBundleSources({
    websiteUrl,
    instagramUrl,
    note,
    metadataJson,
  });

  const websiteResult = await importSourceByType({
    db,
    ...rest,
    sourceType: "website",
    url: bundle.primarySource.url,
    note: bundle.note,
    metadataJson: bundle.metadataJson,
    primarySource: bundle.primarySource,
    sources: bundle.sources,
  });

  let instagramResult = null;
  const supportingInstagram = bundle.sources.find(
    (item) => lower(item.sourceType) === "instagram"
  );

  if (supportingInstagram?.url) {
    instagramResult = await importSourceByType({
      db,
      ...rest,
      sourceType: "instagram",
      url: supportingInstagram.url,
      note: bundle.note,
      metadataJson: mergeDeep(obj(bundle.metadataJson), {
        bundlePrimarySourceType: "website",
      }),
      allowSessionReuse: true,
      primarySource: bundle.primarySource,
      sources: bundle.sources,
    });
  }

  const accepted =
    websiteResult?.accepted === true ||
    instagramResult?.accepted === true ||
    lower(websiteResult?.mode) === "accepted" ||
    lower(instagramResult?.mode) === "accepted" ||
    lower(websiteResult?.mode) === "running" ||
    lower(instagramResult?.mode) === "running";

  return {
    ok: instagramResult ? instagramResult.ok !== false : websiteResult.ok !== false,
    mode:
      lower(instagramResult?.mode) === "error" || lower(websiteResult?.mode) === "error"
        ? "error"
        : lower(instagramResult?.mode) === "partial" ||
            lower(websiteResult?.mode) === "partial"
          ? "partial"
          : accepted
            ? "accepted"
            : "success",
    accepted,
    pending: accepted,
    reviewSessionId: s(
      instagramResult?.reviewSessionId || websiteResult?.reviewSessionId
    ),
    reviewSessionStatus: s(
      instagramResult?.reviewSessionStatus ||
        websiteResult?.reviewSessionStatus ||
        (accepted ? "processing" : "")
    ),
    intakeContext: websiteResult.intakeContext,
    bundle,
    website: websiteResult,
    instagram: instagramResult,
    draft: instagramResult?.draft || websiteResult?.draft || null,
    warnings: uniqStrings([
      ...arr(websiteResult?.warnings),
      ...arr(instagramResult?.warnings),
    ]),
  };
}

export async function importSource(args = {}) {
  return importSourceByType(args);
}

export const __test__ = {
  authorityRankForSourceType,
  buildAcceptedImportResult,
  buildIntakeBundleKey,
  buildBundleSources,
  mergeProfileWithPrecedence,
  normalizeMergedReviewWarnings,
  recomputeDraftFromContributions,
  shouldReuseSessionForImport,
  mergeImportedDraftPatch,
  isPollutedFailedReviewDraft,
  buildWeakWebsiteDraftWarnings,
  hasDraftIdentityCoverage,
  hasDraftContactCoverage,
  hasDraftServiceCoverage,
  hasDraftKnowledgeCoverage,
  shouldForcePartialModeFromWarnings,
};
