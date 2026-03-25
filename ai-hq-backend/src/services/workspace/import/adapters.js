// src/services/workspace/import/adapters.js
// source sync adapters extracted from src/services/workspace/import.js

import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantSourceFusionHelpers } from "../../../db/helpers/tenantSourceFusion.js";
import { updateRowById } from "./dbRows.js";
import {
  arr,
  obj,
  s,
  nowIso,
  compactObject,
  mergeDeep,
  sanitizeProfilePatch,
  sanitizeCapabilitiesPatch,
} from "./shared.js";
import { normalizeCandidateLike } from "./draft.js";
import { buildRunLifecyclePatch, buildSourceSyncPatch, normalizeLifecyclePhase } from "./lifecycle.js";

export function buildKnowledgeAdapter({ db, scope, reviewSessionId = "", collector = null }) {
  const knowledge = createTenantKnowledgeHelpers({ db });

  if (typeof knowledge.createCandidatesBulk !== "function") {
    throw new Error("Tenant knowledge helpers are missing createCandidatesBulk");
  }

  return {
    async createCandidatesBulk(candidates = []) {
      const mapped = arr(candidates).map((candidate) => ({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        reviewSessionId: s(reviewSessionId),
        sourceId: s(candidate.sourceId),
        sourceRunId: s(candidate.sourceRunId),
        candidateGroup: s(candidate.candidateGroup || "general"),
        category: s(candidate.category),
        itemKey: s(candidate.itemKey),
        title: s(candidate.title),
        valueText: s(candidate.valueText),
        valueJson: obj(candidate.valueJson),
        normalizedText: s(candidate.normalizedText),
        normalizedJson: obj(candidate.normalizedJson),
        confidence: candidate.confidence,
        confidenceLabel: s(candidate.confidenceLabel),
        status: s(candidate.status || "pending"),
        reviewReason: s(candidate.reviewReason),
        sourceEvidenceJson: arr(candidate.sourceEvidenceJson),
        extractionMethod: s(candidate.extractionMethod || "ai"),
        extractionModel: s(candidate.extractionModel),
        firstSeenAt: candidate.firstSeenAt || nowIso(),
        lastSeenAt: candidate.lastSeenAt || nowIso(),
      }));

      if (!mapped.length) return [];

      const created = await knowledge.createCandidatesBulk(mapped);
      const rows = arr(created).length ? created : mapped;

      if (collector) {
        collector.candidates.push(...rows.map((row) => normalizeCandidateLike(row)));
        collector.candidateCount = collector.candidates.length;
      }

      return created;
    },

    async listCandidates(args = {}) {
      return knowledge.listCandidates({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        sourceId: s(args.sourceId),
        sourceRunId: s(args.sourceRunId),
        category: s(args.category),
        status: s(args.status),
        limit: args.limit,
        offset: args.offset,
      });
    },

    async upsertBusinessProfile(input = {}) {
      if (collector) {
        collector.profilePatch = mergeDeep(
          collector.profilePatch,
          sanitizeProfilePatch(input)
        );
      }

      return {
        ok: true,
        staged: true,
        reviewSessionId: s(reviewSessionId),
        profile: JSON.parse(JSON.stringify(collector?.profilePatch || {})),
      };
    },

    async upsertBusinessCapabilities(input = {}) {
      if (collector) {
        collector.capabilitiesPatch = mergeDeep(
          collector.capabilitiesPatch,
          sanitizeCapabilitiesPatch(input)
        );
      }

      return {
        ok: true,
        staged: true,
        reviewSessionId: s(reviewSessionId),
        capabilities: JSON.parse(JSON.stringify(collector?.capabilitiesPatch || {})),
      };
    },
  };
}

export function buildFusionAdapter({ db, scope, reviewSessionId = "", collector = null }) {
  const fusion = createTenantSourceFusionHelpers({ db });

  return {
    async createObservationsBulk(items = []) {
      const mapped = arr(items).map((item) => ({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        reviewSessionId: s(reviewSessionId),
        sourceId: s(item.sourceId),
        sourceRunId: s(item.sourceRunId),
        sourceType: s(item.sourceType),
        observationGroup: s(item.observationGroup || "general"),
        claimType: s(item.claimType),
        claimKey: s(item.claimKey),
        rawValueText: s(item.rawValueText),
        rawValueJson: obj(item.rawValueJson),
        normalizedValueText: s(item.normalizedValueText),
        normalizedValueJson: obj(item.normalizedValueJson),
        evidenceText: s(item.evidenceText),
        pageUrl: s(item.pageUrl),
        pageTitle: s(item.pageTitle),
        confidence: item.confidence,
        confidenceLabel: s(item.confidenceLabel),
        resolutionStatus: s(item.resolutionStatus || "pending"),
        conflictKey: s(item.conflictKey),
        extractionMethod: s(item.extractionMethod || "parser"),
        extractionModel: s(item.extractionModel),
        metadataJson: obj(item.metadataJson),
        firstSeenAt: item.firstSeenAt || nowIso(),
        lastSeenAt: item.lastSeenAt || nowIso(),
      }));

      if (!mapped.length) return [];

      const created = await fusion.createObservationsBulk(mapped);
      const rows = arr(created).length ? created : mapped;

      if (collector) {
        collector.observations.push(...rows.map((row) => obj(row)));
        collector.observationCount = collector.observations.length;
      }

      return created;
    },

    async listObservations(args = {}) {
      return fusion.listObservations({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        sourceId: s(args.sourceId),
        sourceRunId: s(args.sourceRunId),
        sourceType: s(args.sourceType),
        claimType: s(args.claimType),
        resolutionStatus: s(args.resolutionStatus),
        limit: args.limit,
        offset: args.offset,
      });
    },

    async createSynthesisSnapshot(input = {}) {
      const created = await fusion.createSynthesisSnapshot({
        tenantId: scope.tenantId,
        tenantKey: scope.tenantKey,
        reviewSessionId: s(reviewSessionId),
        ...input,
      });

      const snapshot = obj(created?.snapshot || created || input);

      if (collector) {
        collector.snapshot = snapshot;
        collector.lastSnapshotId = created?.id || input?.id || null;
        collector.snapshotCount += 1;
      }

      return created;
    },
  };
}

export function buildSourcesAdapter(db, { sourceTable, runTable, reviewSessionId = "" }) {
  return {
    async finishSourceSync(args = {}) {
      const now = nowIso();

      const sourcePhase = normalizeLifecyclePhase(
        args.syncStatus || args.sourceSyncStatus || args.mode || "success"
      );
      const runPhase = normalizeLifecyclePhase(
        args.runStatus || args.syncStatus || args.mode || "success"
      );

      const sourceSyncPatch = await buildSourceSyncPatch(db, sourceTable, sourcePhase);
      const runLifecyclePatch = await buildRunLifecyclePatch(db, runTable, runPhase);

      const source = await updateRowById(db, sourceTable, args.sourceId, {
        review_session_id: s(reviewSessionId) || undefined,
        ...sourceSyncPatch,
        input_summary_json: args.inputSummaryJson || undefined,
        extraction_summary_json: args.extractionSummaryJson || undefined,
        result_summary_json: args.resultSummaryJson || undefined,
        pages_scanned: args.pagesScanned,
        records_scanned: args.recordsScanned,
        candidates_created: args.candidatesCreated,
        warnings_count: args.warningsCount,
        errors_count: args.errorsCount,
        logs_json: args.logsJson || undefined,
        last_synced_at: now,
        synced_at: now,
        last_sync_finished_at: now,
        last_successful_sync_at: sourcePhase === "success" ? now : undefined,
        updated_at: now,
        requested_by: args.requestedBy || undefined,
      });

      const run = await updateRowById(db, runTable, args.runId, {
        review_session_id: s(reviewSessionId) || undefined,
        ...runLifecyclePatch,
        input_summary_json: args.inputSummaryJson || undefined,
        extraction_summary_json: args.extractionSummaryJson || undefined,
        result_summary_json: args.resultSummaryJson || undefined,
        pages_scanned: args.pagesScanned,
        records_scanned: args.recordsScanned,
        candidates_created: args.candidatesCreated,
        warnings_count: args.warningsCount,
        errors_count: args.errorsCount,
        logs_json: args.logsJson || undefined,
        requested_by: args.requestedBy || undefined,
        finished_at: now,
        completed_at: now,
        updated_at: now,
      });

      return { source, run };
    },

    async markSourceSyncError(args = {}) {
      const now = nowIso();
      const sourceSyncPatch = await buildSourceSyncPatch(db, sourceTable, "error");
      const runLifecyclePatch = await buildRunLifecyclePatch(db, runTable, "error");

      const source = await updateRowById(db, sourceTable, args.sourceId, {
        review_session_id: s(reviewSessionId) || undefined,
        ...sourceSyncPatch,
        input_summary_json: args.inputSummaryJson || undefined,
        extraction_summary_json: args.extractionSummaryJson || undefined,
        result_summary_json: args.resultSummaryJson || undefined,
        pages_scanned: args.pagesScanned,
        records_scanned: args.recordsScanned,
        candidates_created: args.candidatesCreated,
        warnings_count: args.warningsCount,
        errors_count: args.errorsCount || 1,
        error_code: args.errorCode || "SOURCE_SYNC_FAILED",
        error_message: args.errorMessage || "source sync failed",
        logs_json: args.logsJson || undefined,
        updated_at: now,
        last_synced_at: now,
        last_sync_finished_at: now,
        last_error_at: now,
        requested_by: args.requestedBy || undefined,
      });

      const run = await updateRowById(db, runTable, args.runId, {
        review_session_id: s(reviewSessionId) || undefined,
        ...runLifecyclePatch,
        input_summary_json: args.inputSummaryJson || undefined,
        extraction_summary_json: args.extractionSummaryJson || undefined,
        result_summary_json: args.resultSummaryJson || undefined,
        pages_scanned: args.pagesScanned,
        records_scanned: args.recordsScanned,
        candidates_created: args.candidatesCreated,
        warnings_count: args.warningsCount,
        errors_count: args.errorsCount || 1,
        error_code: args.errorCode || "SOURCE_SYNC_FAILED",
        error_message: args.errorMessage || "source sync failed",
        logs_json: args.logsJson || undefined,
        requested_by: args.requestedBy || undefined,
        finished_at: now,
        completed_at: now,
        updated_at: now,
      });

      return { source, run };
    },
  };
}