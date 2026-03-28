import { useState } from "react";
import { saveSettingsTrustPolicyControl } from "../../../api/trust.js";

import Card from "../../../components/ui/Card.jsx";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import RepairHub from "../../../components/readiness/RepairHub.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import { dispatchRepairAction } from "../../../components/readiness/dispatchRepairAction.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import { createReadinessViewModel } from "../../../lib/readinessViewModel.js";
import GovernanceCockpit from "../../../components/governance/GovernanceCockpit.jsx";
import {
  EmptyState,
  SourceCard,
  StatTile,
  SyncStatusBadge,
  createNewSource,
  formatTimestampLabel,
  trustSurfaceIcons,
} from "./trustSurfaceShared.jsx";

const { Database } = trustSurfaceIcons;

export default function TrustMaintenanceSection({
  items,
  canManage,
  onCreate,
  onSave,
  onStartSync,
  onViewSyncRuns,
  trust,
  sourceSurface,
}) {
  const [savingId, setSavingId] = useState("");
  const [syncingId, setSyncingId] = useState("");
  const [policyControlState, setPolicyControlState] = useState({
    savingSurface: "",
    error: "",
  });

  async function handleSave(item) {
    setSavingId(String(item.id || item.source_key || "new"));
    try {
      await onSave(item);
    } finally {
      setSavingId("");
    }
  }

  async function handleStartSync(item) {
    if (!item?.id) return;
    setSyncingId(String(item.id));
    try {
      await onStartSync(item);
    } finally {
      setSyncingId("");
    }
  }

  const summary = trust?.view?.summary || {};
  const sourceHealth = summary.sources || {};
  const runtimeHealth = summary.runtimeProjection || {};
  const truthHealth = summary.truth || {};
  const trustError = String(trust?.error || "").trim();
  const sourceState = sourceSurface || {};
  const trustReadiness = createReadinessViewModel(summary.readiness);
  const runtimeReadiness = createReadinessViewModel(runtimeHealth.readiness);
  const truthReadiness = createReadinessViewModel(truthHealth.readiness);
  const reviewReadiness = createReadinessViewModel(summary.setupReview?.readiness);
  const connectedCount = items.filter((x) => String(x.status).toLowerCase() === "connected").length;
  const enabledCount = items.filter((x) => !!x.is_enabled).length;
  const recentRuns = Array.isArray(trust?.view?.recentRuns) ? trust.view.recentRuns : [];

  async function handleRepairAction(action) {
    const result = await dispatchRepairAction(action);
    if (result?.ok && typeof trust?.surface?.refresh === "function") {
      await trust.surface.refresh();
    }
    return result;
  }

  async function handleSavePolicyControl(payload = {}) {
    const surface = String(payload?.surface || "tenant").trim().toLowerCase();
    setPolicyControlState({
      savingSurface: surface,
      error: "",
    });
    try {
      await saveSettingsTrustPolicyControl(payload);
      if (typeof trust?.surface?.refresh === "function") {
        await trust.surface.refresh();
      }
    } catch (error) {
      setPolicyControlState({
        savingSurface: "",
        error: String(error?.message || error || "Failed to save policy control."),
      });
      return;
    }
    setPolicyControlState({
      savingSurface: "",
      error: "",
    });
  }

  return (
    <SettingsSection
      eyebrow="Truth Governance"
      title="Source Governance"
      subtitle="Refresh evidence, review what is weak or conflicting, inspect finalize impact, and keep runtime authority healthy before operations continue."
      tone="default"
    >
      <div className="space-y-6">
        <RepairHub
          title="Trust Repair Hub"
          readiness={trustReadiness}
          blockers={trustReadiness.blockers}
          canManage={canManage}
          emptyMessage="Trust maintenance prerequisites are aligned. Approved truth and runtime projection are ready for controlled operations."
          unavailableMessage="Trust maintenance is degraded. Approved truth and runtime projection stay protected until the listed blockers are repaired."
          onRunAction={(action) => dispatchRepairAction(action)}
        />

        <GovernanceCockpit
          truth={truthHealth}
          trust={trust?.view || {}}
          title="Operator Governance Cockpit"
          subtitle="This cockpit makes the main operator path explicit: approved truth, review pressure, finalize impact, runtime projection health, affected surfaces, and the next safe repair step."
          onRunAction={handleRepairAction}
          onSavePolicyControl={handleSavePolicyControl}
          policyControlState={policyControlState}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Total Sources"
            value={sourceHealth.total ?? items.length}
            hint="Registered evidence sources for this tenant"
            tone="info"
          />
          <StatTile
            label="Connected"
            value={sourceHealth.connected ?? connectedCount}
            hint="Sources actively feeding evidence into the governance loop"
            tone="success"
          />
          <StatTile
            label="Enabled"
            value={sourceHealth.enabled ?? enabledCount}
            hint="Eligible for refresh and review-backed promotion"
            tone="neutral"
          />
        </div>

        {(runtimeReadiness.blocked || truthReadiness.blocked || reviewReadiness.blocked) ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <RepairHub
              title="Runtime Projection"
              readiness={runtimeReadiness}
              blockers={runtimeReadiness.blockers}
              canManage={canManage}
              emptyMessage="Runtime projection is current."
              onRunAction={handleRepairAction}
            />
            <RepairHub
              title="Approved Truth"
              readiness={truthReadiness}
              blockers={truthReadiness.blockers}
              canManage={canManage}
              emptyMessage="Approved truth is available."
              onRunAction={handleRepairAction}
            />
            <RepairHub
              title="Protected Review"
              readiness={reviewReadiness}
              blockers={reviewReadiness.blockers}
              canManage={canManage}
              emptyMessage="No active protected review is blocking trust maintenance."
              onRunAction={handleRepairAction}
            />
          </div>
        ) : null}

        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          Source sync refreshes evidence only. Anything that could change approved truth, runtime behavior, or downstream channels should become explicit review or repair work before it is allowed through.
        </div>

        <SettingsSurfaceBanner
          surface={trust?.surface}
          errorMessage={trustError}
          unavailableMessage="Operator trust summary is temporarily unavailable. Source cards below still reflect the last loaded settings state, but governance and runtime signals could not be refreshed."
          refreshLabel="Refresh Trust"
        />

        <SettingsSurfaceBanner
          surface={sourceState}
          unavailableMessage="Source intelligence is temporarily unavailable."
          refreshLabel="Refresh Sources"
        />

        <div className="flex justify-end">
          <Button
            onClick={() => onCreate(createNewSource())}
            disabled={!canManage}
            leftIcon={<Database className="h-4 w-4" />}
          >
            Add Source
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="No governed sources yet"
            subtitle="Add a website, provider, or imported source so evidence can enter review before approved truth changes."
            actionLabel="Create First Source"
            onAction={() => onCreate(createNewSource())}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <SourceCard
                key={item.id || `${item.source_key || "source"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || item.source_key || "new")}
                syncing={syncingId === String(item.id || "")}
                onSave={handleSave}
                onStartSync={handleStartSync}
                onViewSyncRuns={onViewSyncRuns}
              />
            ))}
          </div>
        )}

        <Card variant="surface" padded="md" className="rounded-[24px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Recent Evidence Refreshes
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Latest source sync outcomes that may affect review pressure, truth promotion, and operator repair work.
                </div>
              </div>
              <Badge tone="info" variant="subtle" dot>
                {recentRuns.length} recent
              </Badge>
            </div>

            {!recentRuns.length ? (
              <EmptyState
                title="No recent sync runs"
                subtitle="New source sync activity will appear here once operators refresh evidence."
              />
            ) : (
              <div className="space-y-3">
                {recentRuns.slice(0, 5).map((run) => (
                  <div
                    key={run.id || `${run.sourceId || "source"}-${run.startedAt || run.createdAt || ""}`}
                    className="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 px-4 py-3 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info" variant="subtle" dot>
                        {run.sourceDisplayName || run.sourceType || "Source"}
                      </Badge>
                      <SyncStatusBadge status={run.status} />
                      {run.reviewRequired ? (
                        <Badge tone="warn" variant="subtle" dot>
                          Review required
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Started {formatTimestampLabel(run.startedAt || run.createdAt)} · Finished{" "}
                      {formatTimestampLabel(run.finishedAt)}
                    </div>
                    {run.errorMessage ? (
                      <div className="text-sm text-rose-600 dark:text-rose-300">{run.errorMessage}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </SettingsSection>
  );
}
