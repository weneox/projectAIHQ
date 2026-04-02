import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  approveTruthReviewCandidate,
  getCanonicalTruthSnapshot,
  getTruthReviewWorkbench,
  getTruthVersionDetail,
  keepTruthReviewCandidateQuarantined,
  markTruthReviewCandidateForFollowUp,
  rejectTruthReviewCandidate,
  rollbackTruthVersion,
} from "../../api/truth.js";
import { getSettingsTrustView } from "../../api/trust.js";
import TruthHeader from "../../components/truth/TruthHeader.jsx";
import TruthFieldTable from "../../components/truth/TruthFieldTable.jsx";
import TruthBehaviorCard from "../../components/truth/TruthBehaviorCard.jsx";
import TruthProvenancePanel from "../../components/truth/TruthProvenancePanel.jsx";
import TruthHistoryPanel from "../../components/truth/TruthHistoryPanel.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";
import RepairHub from "../../components/readiness/RepairHub.jsx";
import { dispatchRepairAction } from "../../components/readiness/dispatchRepairAction.js";
import { createReadinessViewModel } from "../../components/readiness/readinessViewModel.js";
import GovernanceCockpit from "../../components/governance/GovernanceCockpit.jsx";
import TruthReviewWorkbench from "../../components/governance/TruthReviewWorkbench.jsx";

function initialState() {
  return {
    loading: true,
    error: "",
    data: {
      fields: [],
      approval: { approvedAt: "", approvedBy: "", version: "" },
      behavior: { rows: [], summary: "", hasBehavior: false },
      history: [],
      notices: [],
      hasProvenance: false,
      approvedTruthUnavailable: false,
      readiness: {},
      sourceSummary: {},
      metadata: {},
      governance: {},
      finalizeImpact: {},
      trustView: null,
      trustUnavailable: false,
      reviewWorkbench: { summary: {}, items: [] },
    },
  };
}

function normalizeTruthToken(value = "") {
  return String(value ?? "").trim();
}

function resolveRequestedVersionId(searchParams, location) {
  const hashValue = String(location?.hash || "").replace(/^#/, "");
  const hashVersionId = hashValue.startsWith("version:")
    ? hashValue.slice("version:".length)
    : hashValue.startsWith("truth-version:")
      ? hashValue.slice("truth-version:".length)
      : "";

  return normalizeTruthToken(
    location?.state?.versionId ||
      location?.state?.truthVersionId ||
      location?.state?.selectedVersionId ||
      location?.state?.openVersionId ||
      location?.state?.remediationVersionId ||
      location?.state?.version ||
      searchParams.get("versionId") ||
      searchParams.get("truthVersionId") ||
      searchParams.get("selectedVersionId") ||
      searchParams.get("openVersionId") ||
      searchParams.get("version") ||
      hashVersionId
  );
}

function resolveRequestedFocus(searchParams, location) {
  return String(location?.state?.focus || searchParams.get("focus") || "")
    .trim()
    .toLowerCase();
}

function findRequestedHistoryItem({
  history,
  requestedVersionId,
  approval,
  truthView,
}) {
  const requested = normalizeTruthToken(requestedVersionId);
  if (!requested) return null;

  if (["latest", "current", "approved"].includes(requested.toLowerCase())) {
    return history[0] || null;
  }

  const truthSummary = truthView?.summary?.truth || {};
  const aliases = new Set(
    [
      requested,
      approval?.version,
      truthSummary?.latestVersionId,
      truthSummary?.version,
      truthSummary?.currentVersionId,
    ]
      .map((value) => normalizeTruthToken(value))
      .filter(Boolean)
  );

  return (
    history.find((item) => {
      const candidates = [
        item?.id,
        item?.versionId,
        item?.truthVersionId,
        item?.version,
        item?.versionLabel,
        item?.slug,
      ]
        .map((value) => normalizeTruthToken(value))
        .filter(Boolean);

      return candidates.some(
        (candidate) => candidate === requested || aliases.has(candidate)
      );
    }) || null
  );
}

export default function TruthViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState(initialState);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareState, setCompareState] = useState({
    loading: false,
    error: "",
    detail: null,
    rollbackSurface: {
      saving: false,
      error: "",
      saveSuccess: "",
      rollbackReceipt: null,
    },
  });
  const [reviewSurface, setReviewSurface] = useState({
    saving: false,
    error: "",
    saveSuccess: "",
    publishReceipt: null,
  });

  const historyRef = useRef(null);
  const deepLinkHandledRef = useRef("");

  const truthReadiness = createReadinessViewModel(state.data.readiness);

  const requestedVersionId = useMemo(
    () => resolveRequestedVersionId(searchParams, location),
    [searchParams, location]
  );

  const requestedFocus = useMemo(
    () => resolveRequestedFocus(searchParams, location),
    [searchParams, location]
  );

  useEffect(() => {
    let alive = true;

    Promise.allSettled([
      getCanonicalTruthSnapshot(),
      getSettingsTrustView(),
      getTruthReviewWorkbench({ limit: 100 }),
    ])
      .then((results) => {
        if (!alive) return;

        const truthResult = results[0];
        const trustResult = results[1];
        const reviewResult = results[2];

        if (truthResult.status !== "fulfilled") {
          throw truthResult.reason;
        }

        const data = truthResult.value || {};

        setState({
          loading: false,
          error: "",
          data: {
            fields: data.fields || [],
            approval: data.approval || {},
            behavior: data.behavior || { rows: [], summary: "", hasBehavior: false },
            history: data.history || [],
            notices: data.notices || [],
            hasProvenance: !!data.hasProvenance,
            approvedTruthUnavailable: !!data.approvedTruthUnavailable,
            readiness: data.readiness || {},
            sourceSummary: data.sourceSummary || {},
            metadata: data.metadata || {},
            governance: data.governance || {},
            finalizeImpact: data.finalizeImpact || {},
            trustView:
              trustResult.status === "fulfilled"
                ? trustResult.value || null
                : null,
            trustUnavailable: trustResult.status !== "fulfilled",
            reviewWorkbench:
              reviewResult.status === "fulfilled"
                ? reviewResult.value || { summary: {}, items: [] }
                : { summary: {}, items: [] },
          },
        });
      })
      .catch((error) => {
        if (!alive) return;

        setState({
          loading: false,
          error: String(
            error?.message || error || "Truth viewer could not be loaded."
          ),
          data: initialState().data,
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  async function handleOpenVersion(item = {}) {
    const versionId = normalizeTruthToken(
      item?.id || item?.versionId || item?.truthVersionId || item?.version || ""
    );
    const compareTo = normalizeTruthToken(
      item?.previousVersionId || item?.compareTo || ""
    );

    if (!versionId) return;

    setCompareOpen(true);
    setCompareState({
      loading: true,
      error: "",
      detail: {
        selectedVersion: {
          id: versionId,
          version: normalizeTruthToken(item?.version),
          versionLabel: normalizeTruthToken(item?.versionLabel),
          profileStatus: normalizeTruthToken(item?.profileStatus),
          approvedAt: normalizeTruthToken(item?.approvedAt),
          approvedBy: normalizeTruthToken(item?.approvedBy),
          sourceSummary: normalizeTruthToken(item?.sourceSummary),
        },
        comparedVersion: {
          id: compareTo,
        },
        changedFields: Array.isArray(item?.changedFields)
          ? item.changedFields
          : [],
        fieldChanges: Array.isArray(item?.fieldChanges)
          ? item.fieldChanges
          : [],
        sectionChanges: [],
        diffSummary: normalizeTruthToken(item?.diffSummary),
        hasStructuredDiff:
          !!normalizeTruthToken(item?.diffSummary) ||
          (Array.isArray(item?.changedFields) && item.changedFields.length > 0) ||
          (Array.isArray(item?.fieldChanges) && item.fieldChanges.length > 0),
      },
      rollbackSurface: {
        saving: false,
        error: "",
        saveSuccess: "",
        rollbackReceipt: null,
      },
    });

    try {
      const detail = await getTruthVersionDetail(versionId, { compareTo });

      setCompareState({
        loading: false,
        error: "",
        detail,
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess: "",
          rollbackReceipt: null,
        },
      });
    } catch (error) {
      setCompareState((prev) => ({
        loading: false,
        error: String(
          error?.message || error || "Truth version detail could not be loaded."
        ),
        detail: prev.detail,
        rollbackSurface: prev.rollbackSurface,
      }));
    }
  }

  async function handleRollback(detail = {}) {
    const versionId = normalizeTruthToken(
      detail?.selectedVersion?.id ||
        detail?.rollbackPreview?.targetRollbackVersion?.id ||
        ""
    );

    if (!versionId) return;

    setCompareState((prev) => ({
      ...prev,
      rollbackSurface: {
        saving: true,
        error: "",
        saveSuccess: "",
        rollbackReceipt: prev.rollbackSurface?.rollbackReceipt || null,
      },
    }));

    try {
      const result = await rollbackTruthVersion(versionId, {
        metadataJson: {
          rollbackPreview: {
            rollbackDisposition:
              detail?.rollbackPreview?.rollbackDisposition || "",
            canonicalAreasChangedBack:
              detail?.rollbackPreview?.canonicalAreasChangedBack || [],
            runtimeAreasLikelyAffected:
              detail?.rollbackPreview?.runtimeAreasLikelyAffected || [],
            affectedSurfaces: detail?.rollbackPreview?.affectedSurfaces || [],
          },
        },
      });

      await refreshTruthReviewSurface();

      const refreshed = await getTruthVersionDetail(versionId, {
        compareTo: detail?.comparedVersion?.id || "",
      });

      setCompareState({
        loading: false,
        error: "",
        detail: {
          ...refreshed,
          rollbackReceipt: result.rollbackReceipt || null,
        },
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess:
            result?.rollbackReceipt?.rollbackStatus === "success"
              ? "Governed rollback completed and verification is now available."
              : "Governed rollback completed with follow-up telemetry attached.",
          rollbackReceipt: result.rollbackReceipt || null,
        },
      });
    } catch (error) {
      setCompareState((prev) => ({
        ...prev,
        rollbackSurface: {
          saving: false,
          error: String(error?.message || error || "Governed rollback failed."),
          saveSuccess: "",
          rollbackReceipt: prev.rollbackSurface?.rollbackReceipt || null,
        },
      }));
    }
  }

  async function refreshTruthReviewSurface() {
    const [truthData, trustData, reviewData] = await Promise.all([
      getCanonicalTruthSnapshot(),
      getSettingsTrustView().catch(() => null),
      getTruthReviewWorkbench({ limit: 100 }).catch(() => ({
        summary: {},
        items: [],
      })),
    ]);

    setState((prev) => ({
      ...prev,
      loading: false,
      error: "",
      data: {
        ...prev.data,
        fields: truthData.fields || [],
        approval: truthData.approval || {},
        behavior:
          truthData.behavior || { rows: [], summary: "", hasBehavior: false },
        history: truthData.history || [],
        notices: truthData.notices || [],
        hasProvenance: !!truthData.hasProvenance,
        approvedTruthUnavailable: !!truthData.approvedTruthUnavailable,
        readiness: truthData.readiness || {},
        sourceSummary: truthData.sourceSummary || {},
        metadata: truthData.metadata || {},
        governance: truthData.governance || {},
        finalizeImpact: truthData.finalizeImpact || {},
        trustView: trustData || null,
        trustUnavailable: !trustData,
        reviewWorkbench: reviewData || { summary: {}, items: [] },
      },
    }));
  }

  async function handleWorkbenchAction(item, action) {
    const actionType = String(action?.actionType || "").trim().toLowerCase();
    const candidateId = String(item?.id || item?.candidateId || "").trim();

    if (!candidateId || !actionType) return;

    setReviewSurface({
      saving: true,
      error: "",
      saveSuccess: "",
      publishReceipt:
        actionType === "approve" ? reviewSurface.publishReceipt : null,
    });

    try {
      let actionResult = null;

      if (actionType === "approve") {
        actionResult = await approveTruthReviewCandidate(candidateId, {
          reason: "Approved from Truth Review Workbench",
          metadataJson: {
            publishPreview: item?.publishPreview || {},
          },
        });
      } else if (actionType === "reject") {
        await rejectTruthReviewCandidate(candidateId, {
          reason: "Rejected from Truth Review Workbench",
        });
      } else if (actionType === "mark_follow_up") {
        await markTruthReviewCandidateForFollowUp(candidateId, {
          reason: "Marked for follow-up from Truth Review Workbench",
        });
      } else if (actionType === "keep_quarantined") {
        await keepTruthReviewCandidateQuarantined(candidateId, {
          reason: "Kept quarantined from Truth Review Workbench",
        });
      }

      await refreshTruthReviewSurface();

      setReviewSurface({
        saving: false,
        error: "",
        saveSuccess:
          actionType === "approve"
            ? String(actionResult?.publishReceipt?.publishStatus || "").trim().toLowerCase() ===
              "review_required"
              ? "Candidate approved into a governed maintenance draft. Published truth and runtime remain unchanged until that review is finalized."
              : "Candidate approved and truth/runtime surfaces refreshed."
            : actionType === "reject"
              ? "Candidate rejected. Approved truth remains unchanged."
              : actionType === "keep_quarantined"
                ? "Candidate remains quarantined pending stronger evidence."
                : "Candidate marked for follow-up review.",
        publishReceipt:
          actionType === "approve" ? actionResult?.publishReceipt || null : null,
      });
    } catch (error) {
      setReviewSurface({
        saving: false,
        error: String(error?.message || error || "Truth review action failed."),
        saveSuccess: "",
        publishReceipt: null,
      });
    }
  }

  useEffect(() => {
    if (requestedFocus !== "history" || !historyRef.current) return;

    historyRef.current.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [requestedFocus, state.loading]);

  useEffect(() => {
    if (!requestedVersionId || state.loading || compareOpen) return;

    const marker = [
      requestedVersionId,
      state.data.history.length,
      state.data.approval?.version || "",
      state.data.trustView?.summary?.truth?.latestVersionId || "",
      location?.key || "",
    ].join("|");

    if (deepLinkHandledRef.current === marker) return;

    const matchedItem = findRequestedHistoryItem({
      history: state.data.history || [],
      requestedVersionId,
      approval: state.data.approval || {},
      truthView: state.data.trustView || {},
    });

    deepLinkHandledRef.current = marker;

    if (matchedItem) {
      handleOpenVersion(matchedItem);
      return;
    }

    handleOpenVersion({
      id: requestedVersionId,
      versionId: requestedVersionId,
      truthVersionId: requestedVersionId,
      version: requestedVersionId,
    });
  }, [
    compareOpen,
    requestedVersionId,
    state.data.approval,
    state.data.history,
    state.data.trustView,
    state.loading,
    location?.key,
  ]);

  if (state.loading) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-500">
          Loading approved business truth...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
      <TruthHeader
        approval={state.data.approval}
        notices={state.data.notices}
      />

      {!state.error ? (
        <div className="mt-8">
          <GovernanceCockpit
            truth={state.data}
            trust={state.data.trustView || {}}
            title="Business data review"
            subtitle={
              state.data.trustUnavailable
                ? "Approved business data is still shown, but live runtime health and repair details are temporarily unavailable."
                : "Approval status, runtime health, rollback impact, and repair details are shown together here."
            }
            onRunAction={(action) => dispatchRepairAction(action)}
          />
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-6 border-l-2 border-rose-300 pl-5 text-sm leading-6 text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-8">
        <TruthFieldTable fields={state.data.fields} />
      </div>

      <div className="mt-6">
        <TruthBehaviorCard
          title="Approved behavior profile"
          subtitle="This is the operator-facing behavior layer the approved truth carries into governed runtime."
          rows={state.data.behavior?.rows || []}
        />
      </div>

      <div className="mt-8">
        <TruthReviewWorkbench
          workbench={state.data.reviewWorkbench}
          surface={reviewSurface}
          canManage={["owner", "admin"].includes(
            String(state.data.trustView?.viewerRole || "")
              .trim()
              .toLowerCase()
          )}
          onRunAction={handleWorkbenchAction}
        />
      </div>

      <div className="mt-6">
        <RepairHub
          title="Truth Readiness"
          readiness={truthReadiness}
          blockers={truthReadiness.blockers}
          canManage
          emptyMessage="Approved truth is available. No draft or fallback profile data is being substituted here."
          unavailableMessage={
            state.data.approvedTruthUnavailable
              ? "Approved truth is currently unavailable. Setup drafts or saved profile data are not being shown here as a fallback."
              : ""
          }
          onRunAction={(action) => dispatchRepairAction(action)}
        />
      </div>

      <div ref={historyRef} className="mt-8 grid gap-6 lg:grid-cols-2">
        <TruthProvenancePanel hasProvenance={state.data.hasProvenance} />
        <TruthHistoryPanel
          history={state.data.history}
          onOpenVersion={handleOpenVersion}
        />
      </div>

      {compareOpen ? (
        <>
          <div data-testid="truth-version-compare-open" className="sr-only">
            truth version compare open
          </div>
          <div className="sr-only">Version detail</div>
        </>
      ) : null}

      <TruthVersionComparePanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        loading={compareState.loading}
        error={compareState.error}
        detail={compareState.detail}
        versions={state.data.history}
        onSelectVersion={handleOpenVersion}
        rollbackSurface={compareState.rollbackSurface}
        onRollback={handleRollback}
      />
    </div>
  );
}
