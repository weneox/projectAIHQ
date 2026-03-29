import { useCallback, useState } from "react";

import {
  listSettingsSources,
  createSettingsSource,
  updateSettingsSource,
  getSettingsSourceSyncRuns,
  startSettingsSourceSync,
} from "../../../api/settings.js";
import {
  approveTruthReviewCandidate,
  getTruthReviewWorkbench,
  keepTruthReviewCandidateQuarantined,
  markTruthReviewCandidateForFollowUp,
  rejectTruthReviewCandidate,
} from "../../../api/truth.js";
import { syncWorkspaceAndInitial } from "../settingsShared.js";
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

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
  onRefreshBusinessBrain,
  onRefreshTrust,
}) {
  const [syncRunsOpen, setSyncRunsOpen] = useState(false);
  const [syncRunsSource, setSyncRunsSource] = useState(null);
  const [syncRunsItems, setSyncRunsItems] = useState([]);
  const [publishReceipt, setPublishReceipt] = useState(null);
  const {
    data,
    setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: () => ({
      sources: [],
      knowledgeReview: [],
      knowledgeReviewSummary: {},
    }),
    initialLoading: true,
  });
  const sources = data.sources || [];
  const knowledgeReview = data.knowledgeReview || [];
  const knowledgeReviewSummary = data.knowledgeReviewSummary || {};
  const setSources = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        sources: typeof nextValue === "function" ? nextValue(prev.sources || []) : nextValue,
      }));
    },
    [setData]
  );
  const setKnowledgeReview = useCallback(
    (nextValue) => {
      setData((prev) => ({
        ...prev,
        knowledgeReview:
          typeof nextValue === "function" ? nextValue(prev.knowledgeReview || []) : nextValue,
      }));
    },
    [setData]
  );

  const refreshSourceIntelligence = useCallback(async (overrideTenantKey = tenantKey) => {
    beginRefresh();
    try {
      const [srcs, review] = await Promise.all([
        listSettingsSources({ tenantKey: overrideTenantKey }).then((x) => x.items),
        getTruthReviewWorkbench({ limit: 100 }),
      ]);

      const nextData = {
        sources: Array.isArray(srcs) ? srcs : [],
        knowledgeReview: Array.isArray(review?.items) ? review.items : [],
        knowledgeReviewSummary:
          review && typeof review.summary === "object" && !Array.isArray(review.summary)
            ? review.summary
            : {},
      };

      syncWorkspaceAndInitial({
        setWorkspace,
        setInitialWorkspace,
        patch: nextData,
      });

      return succeedRefresh(nextData);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: {
          sources: [],
          knowledgeReview: [],
          knowledgeReviewSummary: {},
        },
      });
    }
  }, [beginRefresh, failRefresh, setInitialWorkspace, setWorkspace, succeedRefresh, tenantKey]);

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
    } else {
      await createSettingsSource(cleanPayload);
    }

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      succeedSave({
        message: payload?.id ? "Source updated." : "Source added.",
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
  }

  async function handleStartSourceSync(item) {
    if (!canManageSettings || !item?.id) return;

    const result = await startSettingsSourceSync(item.id, {
      tenantKey,
      runType: "sync",
      triggerType: "manual",
      runnerKey: "settings.manual",
    });

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      succeedSave({
        message: describeSourceSyncOutcome(result),
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
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

    const result = await approveTruthReviewCandidate(item.id, {
      tenantKey,
      reason: "Approved from Settings knowledge review",
      metadataJson: {
        publishPreview: item?.publishPreview || {},
      },
    });

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      await onRefreshBusinessBrain?.();
      setPublishReceipt(result?.publishReceipt || null);
      succeedSave({
        message:
          String(result?.publishReceipt?.publishStatus || "").trim().toLowerCase() ===
          "review_required"
            ? "Knowledge candidate was approved into a governed maintenance draft. Approved truth remains explicit and protected until publish."
            : "Knowledge candidate approved for truth maintenance review. Approved truth remains explicit and protected.",
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
  }

  async function handleRejectKnowledge(item) {
    if (!canManageSettings || !item?.id) return;

    setPublishReceipt(null);
    await rejectTruthReviewCandidate(item.id, {
      tenantKey,
      reason: "Rejected from Settings knowledge review",
    });

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      succeedSave({
        message: "Knowledge candidate rejected. Approved truth remains unchanged.",
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
  }

  async function handleMarkKnowledgeFollowUp(item) {
    if (!canManageSettings || !item?.id) return;

    setPublishReceipt(null);
    await markTruthReviewCandidateForFollowUp(item.id, {
      tenantKey,
      reason: "Marked for follow-up from Settings truth review workbench",
    });

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      succeedSave({
        message: "Candidate marked for follow-up review. Approved truth remains unchanged.",
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
  }

  async function handleKeepKnowledgeQuarantined(item) {
    if (!canManageSettings || !item?.id) return;

    setPublishReceipt(null);
    await keepTruthReviewCandidateQuarantined(item.id, {
      tenantKey,
      reason: "Kept quarantined from Settings truth review workbench",
    });

    beginSave();
    try {
      await refreshSourceIntelligence();
      await onRefreshTrust?.();
      succeedSave({
        message: "Candidate remains quarantined pending stronger evidence or operator review.",
      });
    } catch (error) {
      failSave(error);
      throw error;
    }
  }

  return {
    surface: {
      ...surface,
      publishReceipt,
      refresh: refreshSourceIntelligence,
      clearSaveState,
    },
    sources,
    setSources,
    knowledgeReview,
    knowledgeReviewSummary,
    setKnowledgeReview,
    syncRunsOpen,
    setSyncRunsOpen,
    syncRunsSource,
    syncRunsItems,
    refreshSourceIntelligence,
    handleSaveSource,
    handleStartSourceSync,
    handleViewSourceSyncRuns,
    handleApproveKnowledge,
    handleRejectKnowledge,
    handleMarkKnowledgeFollowUp,
    handleKeepKnowledgeQuarantined,
  };
}
