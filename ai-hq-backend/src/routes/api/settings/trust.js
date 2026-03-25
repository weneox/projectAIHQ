import express from "express";
import { getAuthTenantId, getAuthTenantKey } from "../../../utils/auth.js";
import { dbListAuditEntries } from "../../../db/helpers/audit.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
} from "../../../db/helpers/tenantRuntimeProjection.js";
import { getActiveSetupReviewSession } from "../../../db/helpers/tenantSetupReview.js";
import { requireDb, requireTenant, ok, bad } from "./utils.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function iso(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

function hasDb(db) {
  return Boolean(db && typeof db.query === "function");
}

function buildSourceReviewRequired(item = {}) {
  const metadata = obj(item.metadata_json);
  return (
    !!s(item.review_session_id || item.reviewSessionId || metadata.reviewSessionId || metadata.review_session_id) ||
    lower(item.projection_status || metadata.projection_status) === "review_required" ||
    n(item.candidate_draft_count, 0) > 0 ||
    n(item.candidate_created_count, 0) > 0 ||
    !!item.review_required ||
    !!metadata.reviewRequired
  );
}

function pickLatest(items = [], predicate = () => true) {
  return arr(items).find((item) => predicate(item)) || null;
}

export function settingsTrustRoutes({ db }) {
  const router = express.Router();

  router.get("/settings/trust", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      if (!hasDb(db)) return bad(res, 503, "db disabled", { dbDisabled: true });

      const tenantId = s(getAuthTenantId(req));
      const requestedTenantKey = s(getAuthTenantKey(req) || tenantKey).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const knowledge = createTenantKnowledgeHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) return bad(res, 404, "tenant not found");

      const [sourceItems, reviewQueue, recentRuns, runtimeProjection, runtimeFreshness, latestTruthVersion, activeReviewSession, audit] = await Promise.all([
        sources.listSources({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 250,
          offset: 0,
        }),
        knowledge.listReviewQueue({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 250,
          offset: 0,
        }),
        sources.listSyncRuns({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          limit: 12,
          offset: 0,
        }),
        getCurrentTenantRuntimeProjection({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        }, db).catch(() => null),
        getTenantRuntimeProjectionFreshness({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          markStale: false,
        }, db).catch(() => null),
        truthVersions.getLatestVersion({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        }).catch(() => null),
        getActiveSetupReviewSession(tenant.tenant_id, db).catch(() => null),
        dbListAuditEntries(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          actions: [
            "settings.workspace.updated",
            "settings.secret.updated",
            "settings.secret.deleted",
            "settings.source.created",
            "settings.source.updated",
            "settings.source.sync.requested",
            "settings.knowledge.approved",
            "settings.knowledge.rejected",
            "team.user.created",
            "team.user.updated",
            "team.user.status.updated",
            "team.user.password.updated",
            "team.user.deleted",
            "setup.review.updated",
            "setup.review.discarded",
            "setup.review.finalized",
            "truth.version.created",
          ],
          limit: 20,
          offset: 0,
        }),
      ]);

      const sourceMap = new Map(
        arr(sourceItems).map((item) => [s(item.id), item])
      );
      const reviewRequiredCount = arr(sourceItems).filter((item) => buildSourceReviewRequired(item)).length;
      const latestRun = pickLatest(recentRuns, () => true);
      const lastSuccess = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "success" || status === "completed";
      });
      const lastFailure = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "failed" || status === "error";
      });
      const conflictCount = arr(reviewQueue).filter((item) => lower(item.status) === "conflict").length;

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        summary: {
          sources: {
            total: arr(sourceItems).length,
            enabled: arr(sourceItems).filter((item) => !!item.is_enabled).length,
            connected: arr(sourceItems).filter((item) => lower(item.status) === "connected").length,
            running: arr(sourceItems).filter((item) => ["running", "queued", "pending"].includes(lower(item.sync_status))).length,
            failed: arr(sourceItems).filter((item) => ["failed", "error"].includes(lower(item.sync_status))).length,
            reviewRequired: reviewRequiredCount,
            lastRunAt: iso(latestRun?.finished_at || latestRun?.started_at || latestRun?.created_at),
            lastRunStatus: lower(latestRun?.status || latestRun?.sync_status || ""),
            lastSuccessAt: iso(lastSuccess?.finished_at || lastSuccess?.started_at || lastSuccess?.created_at),
            lastFailureAt: iso(lastFailure?.finished_at || lastFailure?.started_at || lastFailure?.created_at),
          },
          reviewQueue: {
            pending: arr(reviewQueue).length,
            conflicts: conflictCount,
            latestCandidateAt: iso(arr(reviewQueue)[0]?.created_at || arr(reviewQueue)[0]?.updated_at),
          },
          runtimeProjection: {
            id: s(runtimeProjection?.id),
            status: lower(runtimeProjection?.status || ""),
            projectionHash: s(runtimeProjection?.projection_hash),
            updatedAt: iso(runtimeProjection?.updated_at || runtimeProjection?.created_at),
            stale: !!runtimeFreshness?.stale,
            reasons: arr(runtimeFreshness?.reasons),
          },
          truth: {
            latestVersionId: s(latestTruthVersion?.id),
            approvedAt: iso(latestTruthVersion?.approved_at || latestTruthVersion?.created_at),
            approvedBy: s(latestTruthVersion?.approved_by),
            reviewSessionId: s(latestTruthVersion?.review_session_id),
          },
          setupReview: {
            active: !!activeReviewSession?.id,
            sessionId: s(activeReviewSession?.id),
            status: lower(activeReviewSession?.status || ""),
            currentStep: s(activeReviewSession?.currentStep || activeReviewSession?.current_step),
            updatedAt: iso(activeReviewSession?.updatedAt || activeReviewSession?.updated_at),
          },
        },
        recentRuns: arr(recentRuns).slice(0, 6).map((run) => {
          const source = sourceMap.get(s(run.source_id));
          return {
            ...run,
            sourceDisplayName: s(source?.display_name || source?.source_key || source?.source_url),
          };
        }),
        audit,
      });
    } catch (err) {
      return bad(res, 500, err?.message || "failed to load trust summary");
    }
  });

  return router;
}
