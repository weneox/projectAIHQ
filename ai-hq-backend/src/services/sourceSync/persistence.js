// src/services/sourceSync/persistence.js
// FINAL v5.2 — review-safe persistence aligned with source_fusion_v3

import {
  candidateIdentityKey,
  flattenSelectedClaims,
  normalizeCandidateRecord,
  normalizeObservationRecord,
  normalizeSynthesisResult,
} from "./normalize.js";
import { arr, obj, s } from "./shared.js";

const SOURCE_FUSION_VERSION = "source_fusion_v3";

async function listExistingCandidates(knowledge, source) {
  if (!knowledge || typeof knowledge.listCandidates !== "function") {
    return [];
  }

  const tenantId = source?.tenant_id;
  const tenantKey = source?.tenant_key;

  const limit = 1000;
  const maxPages = 10;
  const all = [];

  for (let page = 0; page < maxPages; page += 1) {
    const rows = await knowledge.listCandidates({
      tenantId,
      tenantKey,
      limit,
      offset: page * limit,
    });

    const safeRows = arr(rows)
      .map((item) => normalizeCandidateRecord(item))
      .filter(Boolean);

    all.push(...safeRows);

    if (safeRows.length < limit) break;
  }

  return all;
}

async function dedupeCandidatesAgainstExisting(knowledge, source, candidates = []) {
  const safeIncoming = arr(candidates)
    .map((item) => normalizeCandidateRecord(item))
    .filter(Boolean);

  const incomingDeduped = [];
  const incomingSeen = new Set();

  for (const item of safeIncoming) {
    const key = candidateIdentityKey(item);
    if (!key || incomingSeen.has(key)) continue;
    incomingSeen.add(key);
    incomingDeduped.push(item);
  }

  if (!knowledge || typeof knowledge.listCandidates !== "function") {
    return incomingDeduped;
  }

  const existing = await listExistingCandidates(knowledge, source);
  const seen = new Set(existing.map((item) => candidateIdentityKey(item)).filter(Boolean));

  return incomingDeduped.filter((item) => {
    const key = candidateIdentityKey(item);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countObservationsByCategory(observations = []) {
  return arr(observations).reduce((acc, item) => {
    const key =
      s(item?.category || item?.observationGroup || item?.observation_group || "general") ||
      "general";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildKnowledgeItemsPreview(candidates = []) {
  return arr(candidates).map((item) => ({
    category: s(item.category),
    itemKey: s(item.itemKey),
    title: s(item.title),
    valueText: s(item.valueText),
    confidence: item.confidence,
    confidenceLabel: s(item.confidenceLabel),
    status: "needs_review",
    sourceId: s(item.sourceId),
    sourceRunId: s(item.sourceRunId),
    metadataJson: obj(item.metadataJson),
  }));
}

function buildDraftTruthPreview(profile = {}) {
  const safeProfile = obj(profile);
  return {
    businessProfileDraft: {
      companyName: s(safeProfile.companyName || safeProfile.companyTitle || safeProfile.displayName),
      websiteUrl: s(safeProfile.websiteUrl),
      summaryShort: s(safeProfile.summaryShort || safeProfile.companySummaryShort),
      summaryLong: s(safeProfile.summaryLong || safeProfile.companySummaryLong),
      primaryEmail: s(safeProfile.primaryEmail),
      primaryPhone: s(safeProfile.primaryPhone),
      primaryAddress: s(safeProfile.primaryAddress),
    },
    servicesDraft: arr(safeProfile.services).slice(0, 12),
    faqDraft: arr(safeProfile.faqItems).slice(0, 12),
    contactsDraft: {
      emails: arr(safeProfile.emails).slice(0, 20),
      phones: arr(safeProfile.phones).slice(0, 20),
      socialLinks: arr(safeProfile.socialLinks).slice(0, 12),
      bookingLinks: arr(safeProfile.bookingLinks).slice(0, 10),
      whatsappLinks: arr(safeProfile.whatsappLinks).slice(0, 8),
    },
    hoursDraft: arr(safeProfile.hours).slice(0, 10),
    policiesDraft: arr(safeProfile.policyHighlights).slice(0, 8),
    pricingDraft: {
      hints: arr(safeProfile.pricingHints).slice(0, 8),
      policy: s(safeProfile.pricingPolicy),
    },
  };
}

async function persistSynthesisOutputs({
  source,
  run,
  requestedBy,
  knowledge,
  fusion,
  synthesis,
  candidateDrafts,
  createdObservations,
  sourceType,
  sourceUrl,
  skipCandidateCreate = false,
  candidateAdmission = null,
  trust = null,
  artifactSummary = null,
}) {
  const safeSynthesis = normalizeSynthesisResult(synthesis, {
    fallbackProfile: obj(synthesis?.profile),
    sourceType,
    sourceUrl,
  });

  const safeProfile = obj(safeSynthesis.profile);
  const safeCapabilities = obj(safeSynthesis.capabilities);

  const safeCandidateDrafts = arr(candidateDrafts)
    .map((item) => normalizeCandidateRecord(item))
    .filter(Boolean);

  const safeCreatedObservations = arr(createdObservations)
    .map((item) => normalizeObservationRecord(item))
    .filter(Boolean);

  const dedupedCandidates = await dedupeCandidatesAgainstExisting(
    knowledge,
    source,
    safeCandidateDrafts.map((item) => ({
      ...item,
      status: item.status || "needs_review",
    }))
  );

  let createdRows = [];
  let createdCount = 0;

  if (!skipCandidateCreate && dedupedCandidates.length) {
    const createdResult = await knowledge.createCandidatesBulk(
      dedupedCandidates.map((item) => ({
        ...item,
        status: "needs_review",
      }))
    );

    if (Array.isArray(createdResult)) {
      createdRows = createdResult.filter(Boolean);
      createdCount = createdRows.length;
    } else {
      createdRows = [];
      createdCount = Number(
        createdResult?.count ||
          createdResult?.insertedCount ||
          createdResult?.candidateCount ||
          0
      );
    }
  }

  const reviewSessionId = s(
    run?.review_session_id ||
      run?.reviewSessionId ||
      source?.review_session_id ||
      source?.reviewSessionId
  );

  const snapshot = await fusion.createSynthesisSnapshot({
    sourceRunId: run?.id || "",
    synthesisVersion: SOURCE_FUSION_VERSION,
    status: "generated",
    isCurrent: true,
    sourcesJson: {
      source_type: sourceType,
      source_url: sourceUrl,
      source_id: source?.id || "",
      run_id: run?.id || "",
      review_session_id: reviewSessionId,
      source_summary: arr(safeSynthesis.sourceSummary?.sources),
      source_fusion_version: SOURCE_FUSION_VERSION,
      trust: trust ? obj(trust) : null,
      artifacts: artifactSummary ? obj(artifactSummary) : null,
      candidate_admission: candidateAdmission ? obj(candidateAdmission) : null,
      governance: obj(safeSynthesis.governance),
    },
    observationsJson: {
      total: safeCreatedObservations.length,
      created_for_run: safeCreatedObservations.length,
      by_category: countObservationsByCategory(safeCreatedObservations),
      selected_claims: flattenSelectedClaims(safeSynthesis.selectedClaims),
    },
    conflictsJson: arr(safeSynthesis.conflicts),
    profileJson: {
      ...safeProfile,
      projection_status: "review_required",
      projection_reason: "source_sync_does_not_write_canonical_profile",
    },
    capabilitiesJson: {
      ...safeCapabilities,
      projection_status: "review_required",
      projection_reason: "source_sync_does_not_write_canonical_capabilities",
    },
    knowledgeItemsJson: buildKnowledgeItemsPreview(dedupedCandidates),
    summaryText: safeSynthesis.summaryText,
    confidence: safeSynthesis.confidence,
    confidenceLabel: safeSynthesis.confidenceLabel,
    metadataJson: {
      source_id: source?.id || "",
      source_type: sourceType,
      source_url: sourceUrl,
      source_run_id: run?.id || "",
      review_session_id: reviewSessionId,
      source_fusion_version: SOURCE_FUSION_VERSION,
      artifacts: artifactSummary ? obj(artifactSummary) : null,
      websiteDraft: buildDraftTruthPreview(safeProfile),
      candidate_draft_count: dedupedCandidates.length,
      candidate_created_count: createdCount,
      candidate_create_skipped: !!skipCandidateCreate,
      canonical_projection: "deferred_to_review",
      candidate_admission: candidateAdmission ? obj(candidateAdmission) : null,
      trust: trust ? obj(trust) : null,
      governance: obj(safeSynthesis.governance),
      quarantined_claim_count: arr(safeSynthesis.governance?.quarantinedClaims).length,
    },
    createdBy: requestedBy || SOURCE_FUSION_VERSION,
  });

  return {
    dedupedCandidates,
    createdRows,
    createdCount,
    savedProfile: null,
    savedCapabilities: null,
    snapshot,
  };
}

async function queryObservations(fusion, params = {}) {
  const rows = await fusion.listObservations(params);
  return arr(rows)
    .map((item) => normalizeObservationRecord(item))
    .filter(Boolean);
}

async function loadScopedObservations({ fusion, source, run, sourceType }) {
  const tenantId = source?.tenant_id;
  const tenantKey = source?.tenant_key;
  const sourceId = source?.id;
  const sourceRunId = run?.id;
  const reviewSessionId = s(
    run?.review_session_id ||
      run?.reviewSessionId ||
      source?.review_session_id ||
      source?.reviewSessionId
  );

  const base = {
    tenantId,
    tenantKey,
    sourceId,
    limit: 5000,
    offset: 0,
  };

  if (reviewSessionId) {
    const currentSessionRun = await queryObservations(fusion, {
      ...base,
      sourceRunId,
      reviewSessionId,
    });

    if (currentSessionRun.length) {
      return {
        scope: "current_session_run",
        observations: currentSessionRun,
      };
    }

    if (sourceType !== "google_maps") {
      const currentSessionSource = await queryObservations(fusion, {
        ...base,
        reviewSessionId,
      });

      if (currentSessionSource.length) {
        return {
          scope: "current_session_source",
          observations: currentSessionSource,
        };
      }
    }
  }

  const currentRun = await queryObservations(fusion, {
    ...base,
    sourceRunId,
  });

  if (sourceType === "google_maps") {
    return {
      scope: "current_run",
      observations: currentRun,
    };
  }

  const currentSource = await queryObservations(fusion, base);

  return {
    scope: currentSource.length ? "current_source" : "current_run",
    observations: currentSource.length ? currentSource : currentRun,
  };
}

export {
  dedupeCandidatesAgainstExisting,
  loadScopedObservations,
  persistSynthesisOutputs,
};
