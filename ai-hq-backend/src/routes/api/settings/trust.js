import express from "express";
import { getAuthTenantId, getAuthTenantKey } from "../../../utils/auth.js";
import { dbListAuditEntries } from "../../../db/helpers/audit.js";
import { createTenantSourcesHelpers } from "../../../db/helpers/tenantSources.js";
import { createTenantKnowledgeHelpers } from "../../../db/helpers/tenantKnowledge.js";
import { createTenantTruthVersionHelpers } from "../../../db/helpers/tenantTruthVersions.js";
import {
  getCurrentTenantRuntimeProjection,
  getTenantRuntimeProjectionFreshness,
  getTenantRuntimeProjectionHealth,
  getLatestTenantRuntimeProjectionRun,
  refreshTenantRuntimeProjectionStrict,
} from "../../../db/helpers/tenantRuntimeProjection.js";
import { getActiveSetupReviewSession } from "../../../db/helpers/tenantSetupReview.js";
import {
  buildOperationalRepairGuidance,
  buildReadinessSurface,
} from "../../../services/operationalReadiness.js";
import {
  requireDb,
  requireTenant,
  requireOperationalManager,
  requireOwnerOrAdminMutation,
  canReadControlPlaneAuditHistoryRole,
  ok,
  bad,
  serverErr,
  getActor,
  getUserRole,
  isInternalServiceRequest,
  auditSafe,
} from "./utils.js";

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

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function hasApprovedTruthVersion(latestTruthVersion = {}) {
  return Boolean(s(latestTruthVersion?.id));
}

function normalizeTruthGovernance(latestTruthVersion = {}) {
  const sourceSummary = obj(latestTruthVersion?.source_summary_json);
  const metadata = obj(latestTruthVersion?.metadata_json);
  const sourceGovernance = obj(
    sourceSummary.governance || sourceSummary.governanceSummary
  );
  const metadataGovernance = obj(
    metadata.governance || metadata.governanceSummary
  );
  const merged = {
    ...metadataGovernance,
    ...sourceGovernance,
  };

  if (!Object.keys(merged).length && !hasApprovedTruthVersion(latestTruthVersion)) {
    return {};
  }

  const quarantinedClaimCount = n(
    merged.quarantinedClaimCount ?? merged.quarantined_claim_count,
    0
  );

  return {
    ...merged,
    disposition: s(
      merged.disposition ||
        merged.status ||
        (hasApprovedTruthVersion(latestTruthVersion) ? "quarantined" : "")
    ),
    quarantinedClaimCount,
  };
}

function normalizeTruthFinalizeImpact(latestTruthVersion = {}) {
  const sourceSummary = obj(latestTruthVersion?.source_summary_json);
  const metadata = obj(latestTruthVersion?.metadata_json);
  const sourceImpact = obj(
    sourceSummary.finalizeImpact || sourceSummary.finalize_impact
  );
  const metadataImpact = obj(
    metadata.finalizeImpact || metadata.finalize_impact
  );

  const canonicalAreas = uniqStrings([
    ...arr(metadataImpact.canonicalAreas || metadataImpact.canonical_areas),
    ...arr(sourceImpact.canonicalAreas || sourceImpact.canonical_areas),
  ]);

  const runtimeAreas = uniqStrings([
    ...arr(metadataImpact.runtimeAreas || metadataImpact.runtime_areas),
    ...arr(sourceImpact.runtimeAreas || sourceImpact.runtime_areas),
  ]);

  const affectedSurfaces = uniqStrings([
    ...arr(metadataImpact.affectedSurfaces || metadataImpact.affected_surfaces),
    ...arr(sourceImpact.affectedSurfaces || sourceImpact.affected_surfaces),
    ...runtimeAreas,
  ]);

  const merged = {
    ...metadataImpact,
    ...sourceImpact,
  };

  if (!Object.keys(merged).length && !hasApprovedTruthVersion(latestTruthVersion)) {
    return {};
  }

  return {
    ...merged,
    canonicalAreas: canonicalAreas.length
      ? canonicalAreas
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["profile"]
      : [],
    runtimeAreas: runtimeAreas.length
      ? runtimeAreas
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["voice"]
      : [],
    affectedSurfaces: affectedSurfaces.length
      ? affectedSurfaces
      : hasApprovedTruthVersion(latestTruthVersion)
      ? ["voice"]
      : [],
  };
}

function buildSourceReviewRequired(item = {}) {
  const metadata = obj(item.metadata_json);
  return (
    !!s(
      item.review_session_id ||
        item.reviewSessionId ||
        metadata.reviewSessionId ||
        metadata.review_session_id
    ) ||
    lower(item.projection_status || metadata.projection_status) ===
      "review_required" ||
    n(item.candidate_draft_count, 0) > 0 ||
    n(item.candidate_created_count, 0) > 0 ||
    !!item.review_required ||
    !!metadata.reviewRequired
  );
}

function pickLatest(items = [], predicate = () => true) {
  return arr(items).find((item) => predicate(item)) || null;
}

function canRepairRuntimeProjection({
  latestTruthVersion = {},
  viewerRole = "operator",
} = {}) {
  return Boolean(
    s(latestTruthVersion?.id) &&
      ["internal", "owner", "admin"].includes(lower(viewerRole))
  );
}

function buildRuntimeProjectionRepairAction({
  latestTruthVersion = {},
  viewerRole = "operator",
  label = "Rebuild runtime projection",
} = {}) {
  if (!canRepairRuntimeProjection({ latestTruthVersion, viewerRole })) {
    return null;
  }

  return {
    id: "rebuild_runtime_projection",
    kind: "api",
    label: s(label),
    requiredRole: "admin",
    allowed: true,
    target: {
      path: "/api/settings/trust/runtime-projection/repair",
      method: "POST",
      section: "runtime",
      refreshSurface: "trust",
    },
  };
}

function getRepairLogger(req, tenant = {}, viewerRole = "") {
  return req.log?.child?.({
    flow: "runtime_projection_repair",
    tenantId: s(tenant?.tenant_id || tenant?.id),
    tenantKey: s(tenant?.tenant_key),
    viewerRole: s(viewerRole),
  });
}

function buildTrustReadiness({
  runtimeProjectionHealth = {},
  latestTruthVersion = {},
  activeReviewSession = {},
  viewerRole = "operator",
} = {}) {
  const runtimeHealth = obj(runtimeProjectionHealth);
  const runtimeStatus = lower(runtimeHealth.status || "");
  const runtimeBlocked = ["missing", "stale", "blocked", "invalid"].includes(
    runtimeStatus
  );
  const reviewActive = !!activeReviewSession?.id;
  const blockers = [];
  const runtimeRepairAction = buildRuntimeProjectionRepairAction({
    latestTruthVersion,
    viewerRole,
  });

  if (runtimeStatus === "missing" || !runtimeStatus) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "projection_missing"),
        viewerRole: "operator",
        missingFields: ["runtime_projection"],
        title: "Runtime projection blocker",
        subtitle:
          "No approved runtime projection is currently available for trust-controlled runtime surfaces.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Open runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: "/setup/runtime",
              section: "runtime",
            },
      })
    );
  } else if (runtimeStatus === "stale") {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "projection_stale"),
        viewerRole: "operator",
        missingFields: arr(runtimeHealth.reasonCodes),
        title: "Runtime projection stale",
        subtitle:
          "The approved runtime projection is stale and may not reflect the latest review-protected setup state.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Review runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: "/setup/runtime",
              section: "runtime",
            },
      })
    );
  } else if (runtimeBlocked) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: s(runtimeHealth.primaryReasonCode || "authority_invalid"),
        viewerRole: "operator",
        missingFields: arr(runtimeHealth.reasonCodes),
        title: "Runtime projection blocked",
        subtitle:
          "Runtime projection health is blocking autonomous runtime use until the listed repair path is completed.",
        action: runtimeRepairAction || {
          id: "open_setup_route",
          kind: "route",
          label: "Open runtime setup",
          requiredRole: "operator",
        },
        target: runtimeRepairAction
          ? obj(runtimeRepairAction.target)
          : {
              path: "/setup/runtime",
              section: "runtime",
            },
      })
    );
  }

  if (!s(latestTruthVersion?.id)) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "approved_truth_unavailable",
        viewerRole: "operator",
        missingFields: ["approved_truth"],
        title: "Approved truth blocker",
        subtitle:
          "Trust-controlled approved truth is unavailable. No fallback profile data is being substituted here.",
        action: {
          id: "open_setup_route",
          kind: "route",
          label: "Open truth setup",
          requiredRole: "operator",
        },
        target: {
          path: "/setup/studio",
          section: "truth",
        },
      })
    );
  }

  if (reviewActive) {
    blockers.push(
      buildOperationalRepairGuidance({
        reasonCode: "review_required",
        viewerRole: "operator",
        missingFields: [
          s(activeReviewSession?.currentStep || activeReviewSession?.current_step),
        ],
        title: "Review session active",
        subtitle:
          "A setup review is still active. Approved truth and runtime projection remain protected until review is completed.",
        action: {
          id: "open_review_workspace",
          kind: "route",
          label: "Open review workspace",
          requiredRole: "operator",
        },
        target: {
          path: "/settings?tab=knowledge-review",
          section: "review",
          reviewSessionId: s(activeReviewSession?.id),
        },
      })
    );
  }

  return {
    runtimeProjection: buildReadinessSurface({
      status: runtimeBlocked || !runtimeStatus ? "blocked" : "ready",
      message:
        runtimeStatus === "missing" || !runtimeStatus
          ? "Runtime projection is unavailable."
          : runtimeStatus === "stale"
          ? "Runtime projection is stale."
          : runtimeBlocked
          ? "Runtime projection is blocked."
          : "Runtime projection is ready.",
      blockers: blockers.filter((item) => item.category === "runtime"),
      repairActions: runtimeRepairAction ? [runtimeRepairAction] : [],
    }),
    truth: buildReadinessSurface({
      status: !s(latestTruthVersion?.id) ? "blocked" : "ready",
      message: !s(latestTruthVersion?.id)
        ? "Approved truth is unavailable."
        : "Approved truth is available.",
      blockers: blockers.filter((item) => item.category === "truth"),
    }),
    review: buildReadinessSurface({
      status: reviewActive ? "blocked" : "ready",
      message: reviewActive
        ? "A protected review is still active."
        : "No active protected review session is blocking trust maintenance.",
      blockers: blockers.filter((item) => item.category === "review"),
    }),
    overall: buildReadinessSurface({
      status: blockers.some((item) => item.blocked) ? "blocked" : "ready",
      message: blockers.some((item) => item.blocked)
        ? "Trust maintenance remains blocked until the listed runtime/truth prerequisites are repaired."
        : "Trust maintenance prerequisites are aligned.",
      blockers,
      repairActions: runtimeRepairAction ? [runtimeRepairAction] : [],
    }),
  };
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
      const requestedTenantKey = s(
        getAuthTenantKey(req) || tenantKey
      ).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const knowledge = createTenantKnowledgeHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) {
        return res.status(404).json({ ok: false, error: "tenant not found" });
      }

      const viewerRole = isInternalServiceRequest(req)
        ? "internal"
        : getUserRole(req);
      const canReadAuditHistory = canReadControlPlaneAuditHistoryRole(viewerRole);

      const [
        sourceItems,
        reviewQueue,
        recentRuns,
        runtimeProjection,
        runtimeFreshness,
        latestTruthVersion,
        activeReviewSession,
        latestRepairRun,
        audit,
      ] = await Promise.all([
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
        getCurrentTenantRuntimeProjection(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          },
          db
        ).catch(() => null),
        getTenantRuntimeProjectionFreshness(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
            markStale: false,
          },
          db
        ).catch(() => null),
        truthVersions
          .getLatestVersion({
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          })
          .catch(() => null),
        getActiveSetupReviewSession(tenant.tenant_id, db).catch(() => null),
        getLatestTenantRuntimeProjectionRun(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
          },
          db
        ).catch(() => null),
        dbListAuditEntries(db, {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          actions: [
            "settings.workspace.updated",
            "settings.secret.updated",
            "settings.secret.deleted",
            "settings.operational.voice.updated",
            "settings.operational.channel.updated",
            "settings.source.created",
            "settings.source.updated",
            "settings.source.sync.requested",
            "settings.knowledge.approved",
            "settings.knowledge.rejected",
            "settings.trust.runtime_projection.repair",
            "settings.trust.runtime_projection.repaired",
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

      const sourceMap = new Map(arr(sourceItems).map((item) => [s(item.id), item]));
      const reviewRequiredCount = arr(sourceItems).filter((item) =>
        buildSourceReviewRequired(item)
      ).length;
      const latestRun = pickLatest(recentRuns, () => true);
      const lastSuccess = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "success" || status === "completed";
      });
      const lastFailure = pickLatest(recentRuns, (item) => {
        const status = lower(item.status);
        return status === "failed" || status === "error";
      });
      const conflictCount = arr(reviewQueue).filter(
        (item) => lower(item.status) === "conflict"
      ).length;
      const projectionHealth = await getTenantRuntimeProjectionHealth(
        {
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
          runtimeProjection,
          freshness: runtimeFreshness,
          latestTruthVersion,
          activeReviewSession,
        },
        db
      ).catch(() => null);
      const readiness = buildTrustReadiness({
        runtimeProjectionHealth: projectionHealth,
        latestTruthVersion,
        activeReviewSession,
        viewerRole,
      });
      const repairAction = buildRuntimeProjectionRepairAction({
        latestTruthVersion,
        viewerRole,
      });
      const truthGovernance = normalizeTruthGovernance(latestTruthVersion);
      const truthFinalizeImpact = normalizeTruthFinalizeImpact(latestTruthVersion);

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        viewerRole,
        capabilities: {
          canRepairRuntimeProjection: !!repairAction,
          runtimeProjectionRepair: {
            allowed: !!repairAction,
            requiredRoles: ["owner", "admin"],
            message: "Only owner/admin can rebuild runtime projection.",
          },
        },
        summary: {
          sources: {
            total: arr(sourceItems).length,
            enabled: arr(sourceItems).filter((item) => !!item.is_enabled).length,
            connected: arr(sourceItems).filter(
              (item) => lower(item.status) === "connected"
            ).length,
            running: arr(sourceItems).filter((item) =>
              ["running", "queued", "pending"].includes(lower(item.sync_status))
            ).length,
            failed: arr(sourceItems).filter((item) =>
              ["failed", "error"].includes(lower(item.sync_status))
            ).length,
            reviewRequired: reviewRequiredCount,
            lastRunAt: iso(
              latestRun?.finished_at || latestRun?.started_at || latestRun?.created_at
            ),
            lastRunStatus: lower(latestRun?.status || latestRun?.sync_status || ""),
            lastSuccessAt: iso(
              lastSuccess?.finished_at ||
                lastSuccess?.started_at ||
                lastSuccess?.created_at
            ),
            lastFailureAt: iso(
              lastFailure?.finished_at ||
                lastFailure?.started_at ||
                lastFailure?.created_at
            ),
          },
          reviewQueue: {
            pending: arr(reviewQueue).length,
            conflicts: conflictCount,
            latestCandidateAt: iso(
              arr(reviewQueue)[0]?.created_at || arr(reviewQueue)[0]?.updated_at
            ),
          },
          runtimeProjection: {
            id: s(runtimeProjection?.id),
            status: lower(runtimeProjection?.status || ""),
            projectionHash: s(runtimeProjection?.projection_hash),
            updatedAt: iso(
              runtimeProjection?.updated_at || runtimeProjection?.created_at
            ),
            stale: !!runtimeFreshness?.stale,
            reasons: arr(runtimeFreshness?.reasons),
            health: projectionHealth,
            repair: {
              canRepair: !!repairAction,
              action: repairAction,
              latestRun: {
                id: s(latestRepairRun?.id),
                status: lower(latestRepairRun?.status || ""),
                triggerType: s(latestRepairRun?.trigger_type),
                requestedBy: s(latestRepairRun?.requested_by),
                startedAt: iso(latestRepairRun?.started_at),
                finishedAt: iso(latestRepairRun?.finished_at),
                durationMs: n(latestRepairRun?.duration_ms, 0),
                errorCode: s(latestRepairRun?.error_code),
                errorMessage: s(latestRepairRun?.error_message),
                runtimeProjectionId: s(latestRepairRun?.runtime_projection_id),
                outputSummary: obj(latestRepairRun?.output_summary_json),
              },
            },
            readiness: readiness.runtimeProjection,
          },
          truth: {
            latestVersionId: s(latestTruthVersion?.id),
            approvedAt: iso(
              latestTruthVersion?.approved_at || latestTruthVersion?.created_at
            ),
            approvedBy: s(latestTruthVersion?.approved_by),
            reviewSessionId: s(latestTruthVersion?.review_session_id),
            sourceSummary: obj(latestTruthVersion?.source_summary_json),
            metadata: obj(latestTruthVersion?.metadata_json),
            governance: truthGovernance,
            finalizeImpact: truthFinalizeImpact,
            readiness: readiness.truth,
          },
          setupReview: {
            active: !!activeReviewSession?.id,
            sessionId: s(activeReviewSession?.id),
            status: lower(activeReviewSession?.status || ""),
            currentStep: s(
              activeReviewSession?.currentStep || activeReviewSession?.current_step
            ),
            updatedAt: iso(
              activeReviewSession?.updatedAt || activeReviewSession?.updated_at
            ),
            readiness: readiness.review,
          },
          readiness: readiness.overall,
        },
        recentRuns: arr(recentRuns)
          .slice(0, 6)
          .map((run) => {
            const source = sourceMap.get(s(run.source_id));
            return {
              ...run,
              sourceDisplayName: s(
                source?.display_name || source?.source_key || source?.source_url
              ),
            };
          }),
        audit: canReadAuditHistory ? audit : [],
        permissions: {
          auditHistoryRead: {
            allowed: canReadAuditHistory,
            requiredRoles: ["owner", "admin", "analyst"],
            message: canReadAuditHistory
              ? ""
              : "Only owner/admin/analyst can read control-plane audit history.",
          },
        },
      });
    } catch (err) {
      return bad(res, 500, err?.message || "failed to load trust summary");
    }
  });

  router.post("/settings/trust/runtime-projection/repair", async (req, res) => {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const tenantId = s(getAuthTenantId(req));
      const requestedTenantKey = s(
        getAuthTenantKey(req) || tenantKey
      ).toLowerCase();
      const sources = createTenantSourcesHelpers({ db });
      const truthVersions = createTenantTruthVersionHelpers({ db });

      const tenant = await sources.resolveTenantIdentity({
        tenantId,
        tenantKey: requestedTenantKey,
      });
      if (!tenant?.tenant_id) {
        return res.status(404).json({ ok: false, error: "tenant not found" });
      }

      const viewerRole = await requireOwnerOrAdminMutation(req, res, {
        db,
        tenant: { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        message: "Only owner/admin can repair runtime projection",
        auditAction: "settings.trust.runtime_projection.repair",
        objectType: "tenant_business_runtime_projection",
        objectId: tenant.tenant_id,
        targetArea: "trust_runtime_projection",
      });
      if (!viewerRole) return;
      const repairLogger = getRepairLogger(req, tenant, viewerRole);

      const latestTruthVersion = await truthVersions
        .getLatestVersion({
          tenantId: tenant.tenant_id,
          tenantKey: tenant.tenant_key,
        })
        .catch(() => null);

      repairLogger?.info("runtime_projection.repair.requested", {
        latestTruthVersionId: s(latestTruthVersion?.id),
      });

      if (!s(latestTruthVersion?.id)) {
        await auditSafe(
          db,
          req,
          { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
          "settings.trust.runtime_projection.repair",
          "tenant_business_runtime_projection",
          tenant.tenant_id,
          {
            outcome: "blocked",
            reasonCode: "approved_truth_unavailable",
            targetArea: "trust_runtime_projection",
          }
        );
        repairLogger?.warn("runtime_projection.repair.blocked", {
          reasonCode: "approved_truth_unavailable",
        });
        return res.status(409).json({
          ok: false,
          error: "approved_truth_unavailable",
          reasonCode: "approved_truth_unavailable",
          details: {
            tenantKey: tenant.tenant_key,
            canRepair: false,
            message: "Runtime projection rebuild requires approved truth.",
          },
        });
      }

      let refreshed = null;
      try {
        refreshed = await refreshTenantRuntimeProjectionStrict(
          {
            tenantId: tenant.tenant_id,
            tenantKey: tenant.tenant_key,
            triggerType: "manual_repair",
            requestedBy: getActor(req),
            runnerKey: "settings.trust.runtime_projection.repair",
            generatedBy: getActor(req),
            approvedBy: s(latestTruthVersion?.approved_by),
            metadata: {
              source: "settingsTrustRoutes.runtimeProjectionRepair",
              initiatedByRole: viewerRole,
            },
          },
          db
        );
      } catch (error) {
        await auditSafe(
          db,
          req,
          { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
          "settings.trust.runtime_projection.repair",
          "tenant_business_runtime_projection",
          tenant.tenant_id,
          {
            outcome: "failed",
            reasonCode:
              s(error?.freshness?.reasons?.[0]) ||
              s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
            targetArea: "trust_runtime_projection",
            freshness: obj(error?.freshness),
          }
        );
        repairLogger?.warn("runtime_projection.repair.failed", {
          reasonCode:
            s(error?.freshness?.reasons?.[0]) ||
            s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
          runtimeProjectionId: s(error?.runtimeProjectionId),
        });
        return res.status(409).json({
          ok: false,
          error: "runtime_projection_repair_failed",
          reasonCode:
            s(error?.freshness?.reasons?.[0]) ||
            s(error?.code || "runtime_projection_repair_failed").toLowerCase(),
          details: {
            tenantKey: tenant.tenant_key,
            message: s(error?.message || "runtime projection repair failed"),
            freshness: obj(error?.freshness),
          },
        });
      }

      await auditSafe(
        db,
        req,
        { id: tenant.tenant_id, tenant_key: tenant.tenant_key },
        "settings.trust.runtime_projection.repaired",
        "tenant_business_runtime_projection",
        s(refreshed?.projection?.id),
        {
          outcome: "succeeded",
          targetArea: "trust_runtime_projection",
          triggerType: "manual_repair",
          runtimeProjectionId: s(refreshed?.projection?.id),
          freshnessReasons: arr(refreshed?.freshness?.reasons),
        }
      );

      repairLogger?.info("runtime_projection.repair.completed", {
        repairRunId: s(refreshed?.runId),
        runtimeProjectionId: s(refreshed?.projection?.id),
        projectionStatus: s(refreshed?.projection?.status).toLowerCase(),
        reasonCode: s(refreshed?.freshness?.reasons?.[0] || ""),
      });

      return ok(res, {
        tenantId: tenant.tenant_id,
        tenantKey: tenant.tenant_key,
        repaired: true,
        projection: {
          id: s(refreshed?.projection?.id),
          status: s(refreshed?.projection?.status).toLowerCase(),
          projectionHash: s(refreshed?.projection?.projection_hash),
          updatedAt: iso(
            refreshed?.projection?.updated_at || refreshed?.projection?.created_at
          ),
        },
        freshness: obj(refreshed?.freshness),
        repairRunId: s(refreshed?.runId),
      });
    } catch (err) {
      req.log?.error("runtime_projection.repair.unhandled_failed", err);
      return serverErr(res, err?.message || "failed to repair runtime projection");
    }
  });

  return router;
}