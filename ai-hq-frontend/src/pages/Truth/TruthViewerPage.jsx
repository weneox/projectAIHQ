import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  approveTruthReviewCandidate,
  getCanonicalTruthSnapshot,
  getTruthReviewWorkbench,
  getTruthVersionDetail,
  keepTruthReviewCandidateQuarantined,
  markTruthReviewCandidateForFollowUp,
  rejectTruthReviewCandidate,
} from "../../api/truth.js";
import { getSettingsTrustView } from "../../api/trust.js";
import TruthHeader from "../../components/truth/TruthHeader.jsx";
import TruthFieldTable from "../../components/truth/TruthFieldTable.jsx";
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

export default function TruthViewerPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState(initialState);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareState, setCompareState] = useState({
    loading: false,
    error: "",
    detail: null,
  });
  const [reviewSurface, setReviewSurface] = useState({
    saving: false,
    error: "",
    saveSuccess: "",
  });
  const historyRef = useRef(null);
  const truthReadiness = createReadinessViewModel(state.data.readiness);
  const requestedVersionId = String(searchParams.get("versionId") || "").trim();
  const requestedFocus = String(searchParams.get("focus") || "").trim().toLowerCase();

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
            history: data.history || [],
            notices: data.notices || [],
            hasProvenance: !!data.hasProvenance,
            approvedTruthUnavailable: !!data.approvedTruthUnavailable,
            readiness: data.readiness || {},
            sourceSummary: data.sourceSummary || {},
            metadata: data.metadata || {},
            governance: data.governance || {},
            finalizeImpact: data.finalizeImpact || {},
            trustView: trustResult.status === "fulfilled" ? trustResult.value || null : null,
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
          error: String(error?.message || error || "Truth viewer could not be loaded."),
          data: initialState().data,
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  async function handleOpenVersion(item = {}) {
    const versionId = String(item?.id || item?.version || "").trim();
    const compareTo = String(item?.previousVersionId || "").trim();
    if (!versionId) return;

    setCompareOpen(true);
    setCompareState({
      loading: true,
      error: "",
      detail: {
        selectedVersion: {
          id: versionId,
          version: String(item?.version || "").trim(),
          versionLabel: String(item?.versionLabel || "").trim(),
          profileStatus: String(item?.profileStatus || "").trim(),
          approvedAt: String(item?.approvedAt || "").trim(),
          approvedBy: String(item?.approvedBy || "").trim(),
          sourceSummary: String(item?.sourceSummary || "").trim(),
        },
        comparedVersion: {
          id: compareTo,
        },
        changedFields: Array.isArray(item?.changedFields) ? item.changedFields : [],
        fieldChanges: Array.isArray(item?.fieldChanges) ? item.fieldChanges : [],
        sectionChanges: [],
        diffSummary: String(item?.diffSummary || "").trim(),
        hasStructuredDiff:
          !!String(item?.diffSummary || "").trim() ||
          (Array.isArray(item?.changedFields) && item.changedFields.length > 0) ||
          (Array.isArray(item?.fieldChanges) && item.fieldChanges.length > 0),
      },
    });

    try {
      const detail = await getTruthVersionDetail(versionId, { compareTo });
      setCompareState({
        loading: false,
        error: "",
        detail,
      });
    } catch (error) {
      setCompareState((prev) => ({
        loading: false,
        error: String(
          error?.message || error || "Truth version detail could not be loaded."
        ),
        detail: prev.detail,
      }));
    }
  }

  async function refreshTruthReviewSurface() {
    const [truthData, trustData, reviewData] = await Promise.all([
      getCanonicalTruthSnapshot(),
      getSettingsTrustView().catch(() => null),
      getTruthReviewWorkbench({ limit: 100 }).catch(() => ({ summary: {}, items: [] })),
    ]);

    setState((prev) => ({
      ...prev,
      loading: false,
      error: "",
      data: {
        ...prev.data,
        fields: truthData.fields || [],
        approval: truthData.approval || {},
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
    });

    try {
      if (actionType === "approve") {
        await approveTruthReviewCandidate(candidateId, {
          reason: "Approved from Truth Review Workbench",
          metadataJson: {
            publishPreview: item?.publishPreview?.auditSummary || {},
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
            ? "Candidate approved and truth/runtime surfaces refreshed."
            : actionType === "reject"
              ? "Candidate rejected. Approved truth remains unchanged."
              : actionType === "keep_quarantined"
                ? "Candidate remains quarantined pending stronger evidence."
                : "Candidate marked for follow-up review.",
      });
    } catch (error) {
      setReviewSurface({
        saving: false,
        error: String(error?.message || error || "Truth review action failed."),
        saveSuccess: "",
      });
    }
  }

  useEffect(() => {
    if (requestedFocus !== "history" || !historyRef.current) return;
    historyRef.current.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [requestedFocus, state.loading]);

  useEffect(() => {
    if (!requestedVersionId || state.loading || compareOpen) return;
    const match = (state.data.history || []).find(
      (item) =>
        String(item?.id || "").trim() === requestedVersionId ||
        String(item?.version || "").trim() === requestedVersionId
    );
    if (match) {
      handleOpenVersion(match);
    }
  }, [compareOpen, requestedVersionId, state.data.history, state.loading]);

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
            title="Truth Governance Cockpit"
            subtitle={
              state.data.trustUnavailable
                ? "Approved truth is still shown, but live runtime health and repair telemetry are temporarily unavailable."
                : "Approved truth, runtime projection health, finalize impact, and repairability are shown together so operators can understand the full governed execution path."
            }
            onRunAction={(action) => dispatchRepairAction(action)}
          />
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm leading-6 text-rose-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-8">
        <TruthFieldTable fields={state.data.fields} />
      </div>

      <div className="mt-8">
        <TruthReviewWorkbench
          workbench={state.data.reviewWorkbench}
          surface={reviewSurface}
          canManage={["owner", "admin"].includes(
            String(state.data.trustView?.viewerRole || "").trim().toLowerCase()
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

      <TruthVersionComparePanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        loading={compareState.loading}
        error={compareState.error}
        detail={compareState.detail}
      />
    </div>
  );
}
