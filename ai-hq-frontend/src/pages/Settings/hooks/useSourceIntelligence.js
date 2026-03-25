import { useState } from "react";

import {
  listSettingsSources,
  createSettingsSource,
  updateSettingsSource,
  getSettingsSourceSyncRuns,
  startSettingsSourceSync,
  getSettingsTrustSummary,
  listKnowledgeReviewQueue,
  approveKnowledgeCandidate,
  rejectKnowledgeCandidate,
} from "../../../api/settings.js";
import { syncWorkspaceAndInitial } from "../settingsShared.js";

function toFiniteNumber(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function describeSourceSyncOutcome(result = {}) {
  const review =
    result && typeof result.review === "object" && !Array.isArray(result.review)
      ? result.review
      : {};
  const run = result && typeof result.run === "object" && !Array.isArray(result.run) ? result.run : {};
  const source =
    result && typeof result.source === "object" && !Array.isArray(result.source)
      ? result.source
      : {};
  const syncStatus = String(result?.status || run?.status || source?.sync_status || "").trim().toLowerCase();
  const reviewSessionId = String(review?.sessionId || "").trim();
  const pendingReviewCount = Math.max(
    toFiniteNumber(review?.candidateDraftCount, 0),
    toFiniteNumber(review?.candidateCreatedCount, 0)
  );
  const reviewRequired = !!review?.required;

  if (result?.accepted || syncStatus === "running" || syncStatus === "queued" || syncStatus === "pending") {
    return reviewRequired || reviewSessionId
      ? "Source sync was queued and opened review-backed follow-up work. Approved truth will not change until review is completed."
      : "Source sync was queued. New evidence may still require review before approved truth changes.";
  }

  if (syncStatus === "failed" || syncStatus === "error") {
    return "Source sync did not complete cleanly. Approved truth remains unchanged.";
  }

  if (reviewRequired && pendingReviewCount > 0) {
    return `Source sync refreshed evidence. ${pendingReviewCount} review item${
      pendingReviewCount === 1 ? "" : "s"
    } may affect approved truth next.`;
  }

  if (reviewRequired) {
    return "Source sync refreshed evidence and opened review-backed follow-up work before approved truth can change.";
  }

  return "Source sync refreshed evidence. Review may still be required before approved truth changes.";
}

export const __test__ = {
  describeSourceSyncOutcome,
};

export function useSourceIntelligence({
  tenantKey,
  canManageSettings,
  setWorkspace,
  setInitialWorkspace,
  setMessage,
  onRefreshBusinessBrain,
}) {
  const [sources, setSources] = useState([]);
  const [knowledgeReview, setKnowledgeReview] = useState([]);
  const [syncRunsOpen, setSyncRunsOpen] = useState(false);
  const [syncRunsSource, setSyncRunsSource] = useState(null);
  const [syncRunsItems, setSyncRunsItems] = useState([]);
  const [trustSummary, setTrustSummary] = useState({});
  const [trustRecentRuns, setTrustRecentRuns] = useState([]);
  const [trustAudit, setTrustAudit] = useState([]);
  const [trustStatus, setTrustStatus] = useState("idle");

  async function refreshSourceIntelligence(overrideTenantKey = tenantKey) {
    const [srcs, review, trust] = await Promise.all([
      listSettingsSources({ tenantKey: overrideTenantKey }).then((x) => x.items).catch(() => []),
      listKnowledgeReviewQueue({ tenantKey: overrideTenantKey }).then((x) => x.items).catch(() => []),
      getSettingsTrustSummary({ tenantKey: overrideTenantKey, limit: 8 }).catch(() => null),
    ]);

    const nextSources = Array.isArray(srcs) ? srcs : [];
    const nextReview = Array.isArray(review) ? review : [];
    const nextTrustSummary =
      trust?.summary && typeof trust.summary === "object" && !Array.isArray(trust.summary)
        ? trust.summary
        : {};
    const nextTrustRuns = Array.isArray(trust?.recentRuns) ? trust.recentRuns : [];
    const nextTrustAudit = Array.isArray(trust?.audit) ? trust.audit : [];

    setSources(nextSources);
    setKnowledgeReview(nextReview);
    setTrustSummary(nextTrustSummary);
    setTrustRecentRuns(nextTrustRuns);
    setTrustAudit(nextTrustAudit);
    setTrustStatus(trust ? "ready" : "unavailable");

    syncWorkspaceAndInitial({
      setWorkspace,
      setInitialWorkspace,
      patch: {
        sources: nextSources,
        knowledgeReview: nextReview,
        trustSummary: nextTrustSummary,
      },
    });

    return {
      sources: nextSources,
      knowledgeReview: nextReview,
      trustSummary: nextTrustSummary,
      trustRecentRuns: nextTrustRuns,
      trustAudit: nextTrustAudit,
    };
  }

  async function handleSaveSource(payload) {
    if (!canManageSettings) return;

    const cleanPayload = {
      tenantKey,
      sourceType: payload?.source_type || "website",
      sourceKey: payload?.source_key || "",
      displayName: payload?.display_name || "",
      status: payload?.status || "pending",
      authStatus: payload?.auth_status || "not_required",
      syncStatus: payload?.sync_status || "idle",
      connectionMode: payload?.connection_mode || "manual",
      accessScope: payload?.access_scope || "public",
      sourceUrl: payload?.source_url || "",
      externalAccountId: payload?.external_account_id || "",
      externalPageId: payload?.external_page_id || "",
      externalUsername: payload?.external_username || "",
      isEnabled: !!payload?.is_enabled,
      isPrimary: !!payload?.is_primary,
      permissionsJson:
        payload &&
        typeof payload.permissions_json === "object" &&
        !Array.isArray(payload.permissions_json)
          ? payload.permissions_json
          : {},
      settingsJson:
        payload &&
        typeof payload.settings_json === "object" &&
        !Array.isArray(payload.settings_json)
          ? payload.settings_json
          : {},
      metadataJson:
        payload &&
        typeof payload.metadata_json === "object" &&
        !Array.isArray(payload.metadata_json)
          ? payload.metadata_json
          : {},
    };

    if (payload?.id) {
      await updateSettingsSource(payload.id, cleanPayload);
      setMessage("✅ Source yeniləndi.");
    } else {
      await createSettingsSource(cleanPayload);
      setMessage("✅ Source əlavə olundu.");
    }

    await refreshSourceIntelligence();
  }

  async function handleStartSourceSync(item) {
    if (!canManageSettings || !item?.id) return;

    const result = await startSettingsSourceSync(item.id, {
      tenantKey,
      runType: "sync",
      triggerType: "manual",
      runnerKey: "settings.manual",
    });

    await refreshSourceIntelligence();
    setMessage(`✅ ${describeSourceSyncOutcome(result)}`);
  }

  async function handleViewSourceSyncRuns(item) {
    if (!item?.id) return;

    const res = await getSettingsSourceSyncRuns(item.id, {
      tenantKey,
      limit: 20,
    });

    setSyncRunsSource(res?.source || item);
    setSyncRunsItems(Array.isArray(res?.items) ? res.items : []);
    setSyncRunsOpen(true);
  }

  async function handleApproveKnowledge(item) {
    if (!canManageSettings || !item?.id) return;

    await approveKnowledgeCandidate(item.id, {
      tenantKey,
      reason: "Approved from Settings knowledge review",
    });

    await refreshSourceIntelligence();
    await onRefreshBusinessBrain?.();
    setMessage(
      "✅ Knowledge candidate approved for truth maintenance review. Approved truth remains explicit and protected."
    );
  }

  async function handleRejectKnowledge(item) {
    if (!canManageSettings || !item?.id) return;

    await rejectKnowledgeCandidate(item.id, {
      tenantKey,
      reason: "Rejected from Settings knowledge review",
    });

    await refreshSourceIntelligence();
    setMessage("✅ Knowledge candidate rejected. Approved truth remains unchanged.");
  }

  return {
    sources,
    setSources,
    knowledgeReview,
    setKnowledgeReview,
    syncRunsOpen,
    setSyncRunsOpen,
    syncRunsSource,
    syncRunsItems,
    trustSummary,
    trustRecentRuns,
    trustAudit,
    trustStatus,
    refreshSourceIntelligence,
    handleSaveSource,
    handleStartSourceSync,
    handleViewSourceSyncRuns,
    handleApproveKnowledge,
    handleRejectKnowledge,
  };
}
