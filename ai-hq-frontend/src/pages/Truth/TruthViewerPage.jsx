import { useEffect, useState } from "react";

import {
  getCanonicalTruthSnapshot,
  getTruthVersionDetail,
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
    },
  };
}

export default function TruthViewerPage() {
  const [state, setState] = useState(initialState);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareState, setCompareState] = useState({
    loading: false,
    error: "",
    detail: null,
  });
  const truthReadiness = createReadinessViewModel(state.data.readiness);

  useEffect(() => {
    let alive = true;

    Promise.allSettled([getCanonicalTruthSnapshot(), getSettingsTrustView()])
      .then((results) => {
        if (!alive) return;
        const truthResult = results[0];
        const trustResult = results[1];

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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
