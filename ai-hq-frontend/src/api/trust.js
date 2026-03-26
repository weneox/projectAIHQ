import { apiGet } from "./client.js";
import { createReadinessViewModel } from "../lib/readinessViewModel.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const next = s(value);
    if (!next) continue;
    query.set(key, next);
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeRecentRuns(items = []) {
  return arr(items).map((item) => ({
    id: s(item.id),
    sourceDisplayName: s(item.sourceDisplayName || item.source_display_name || item.sourceType),
    status: s(item.status || item.sync_status).toLowerCase(),
    startedAt: s(item.startedAt || item.started_at || item.createdAt || item.created_at),
    finishedAt: s(item.finishedAt || item.finished_at),
    reviewRequired: item.reviewRequired === true,
    errorMessage: s(item.errorMessage || item.error_message),
  }));
}

function normalizeAudit(items = []) {
  return arr(items).map((item) => ({
    id: s(item.id),
    action: s(item.action),
    actor: s(item.actor),
    createdAt: s(item.createdAt || item.created_at),
  }));
}

export function normalizeTrustViewResponse(payload = {}) {
  const root = obj(payload);
  const summary = obj(root.summary);
  const runtimeProjection = obj(summary.runtimeProjection);
  const truth = obj(summary.truth);
  const setupReview = obj(summary.setupReview);
  const sources = obj(summary.sources);
  const reviewQueue = obj(summary.reviewQueue);

  return {
    tenantId: s(root.tenantId || root.tenant_id),
    tenantKey: s(root.tenantKey || root.tenant_key).toLowerCase(),
    status: root ? "ready" : "unavailable",
    summary: {
      readiness: createReadinessViewModel(summary.readiness),
      sources: {
        total: n(sources.total),
        enabled: n(sources.enabled),
        connected: n(sources.connected),
        running: n(sources.running),
        failed: n(sources.failed),
        reviewRequired: n(sources.reviewRequired || sources.review_required),
        lastRunAt: s(sources.lastRunAt || sources.last_run_at),
        lastRunStatus: s(sources.lastRunStatus || sources.last_run_status).toLowerCase(),
        lastSuccessAt: s(sources.lastSuccessAt || sources.last_success_at),
        lastFailureAt: s(sources.lastFailureAt || sources.last_failure_at),
      },
      runtimeProjection: {
        id: s(runtimeProjection.id),
        status: s(runtimeProjection.status).toLowerCase(),
        projectionHash: s(runtimeProjection.projectionHash || runtimeProjection.projection_hash),
        updatedAt: s(runtimeProjection.updatedAt || runtimeProjection.updated_at),
        stale: runtimeProjection.stale === true,
        reasons: arr(runtimeProjection.reasons).map((item) => s(item)).filter(Boolean),
        readiness: createReadinessViewModel(runtimeProjection.readiness),
      },
      truth: {
        latestVersionId: s(truth.latestVersionId || truth.latest_version_id),
        approvedAt: s(truth.approvedAt || truth.approved_at),
        approvedBy: s(truth.approvedBy || truth.approved_by),
        reviewSessionId: s(truth.reviewSessionId || truth.review_session_id),
        readiness: createReadinessViewModel(truth.readiness),
      },
      setupReview: {
        active: setupReview.active === true,
        sessionId: s(setupReview.sessionId || setupReview.session_id),
        status: s(setupReview.status).toLowerCase(),
        currentStep: s(setupReview.currentStep || setupReview.current_step),
        updatedAt: s(setupReview.updatedAt || setupReview.updated_at),
        readiness: createReadinessViewModel(setupReview.readiness),
      },
      reviewQueue: {
        pending: n(reviewQueue.pending),
        conflicts: n(reviewQueue.conflicts),
        latestCandidateAt: s(reviewQueue.latestCandidateAt || reviewQueue.latest_candidate_at),
      },
    },
    recentRuns: normalizeRecentRuns(root.recentRuns || root.recent_runs),
    audit: normalizeAudit(root.audit),
  };
}

export const __test__ = {
  normalizeTrustViewResponse,
};

export async function getSettingsTrustView(params = {}) {
  const suffix = buildQuery({
    tenantId: params.tenantId,
    tenantKey: params.tenantKey,
    limit: params.limit,
  });

  const payload = await apiGet(`/api/settings/trust${suffix}`);
  if (!payload?.ok) {
    throw new Error(payload?.error || "Failed to load settings trust summary");
  }
  return normalizeTrustViewResponse(payload);
}
