import { useState } from "react";

import Card from "../../../components/ui/Card.jsx";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import RepairHub from "../../../components/readiness/RepairHub.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import { dispatchRepairAction } from "../../../components/readiness/dispatchRepairAction.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import { createReadinessViewModel } from "../../../lib/readinessViewModel.js";
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
  const projectionHealth = runtimeHealth.health || {};
  const projectionRepair = runtimeHealth.repair || {};
  const trustCapabilities = trust?.view?.capabilities || trust?.capabilities || {};
  const viewerRole = trust?.view?.viewerRole || trust?.viewerRole || "";
  const canRepairProjection =
    trustCapabilities?.runtimeProjectionRepair?.allowed ??
    trustCapabilities?.canRepairRuntimeProjection ??
    false;
  const repairRestrictionMessage =
    trustCapabilities?.runtimeProjectionRepair?.message ||
    (viewerRole && !canRepairProjection
      ? "Runtime projection rebuild stays behind owner/admin access."
      : "");
  const truthHealth = summary.truth || {};
  const reviewHealth = summary.reviewQueue || {};
  const trustUnavailable = trust?.unavailable === true;
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

  return (
    <SettingsSection
      eyebrow="Source Intelligence"
      title="Connected Sources"
      subtitle="Refresh source evidence here, then route anything important into review before approved truth changes."
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

        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Total Sources"
            value={sourceHealth.total ?? items.length}
            hint="Tenant üçün qeydiyyatlı source sayı"
            tone="info"
          />
          <StatTile
            label="Connected"
            value={sourceHealth.connected ?? connectedCount}
            hint="Aktiv qoşulmuş source-lar"
            tone="success"
          />
          <StatTile
            label="Enabled"
            value={sourceHealth.enabled ?? enabledCount}
            hint="Enabled for evidence refresh and future review work"
            tone="neutral"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Source Health
                </div>
                <Badge
                  tone={
                    trustUnavailable
                      ? "warn"
                      : (sourceHealth.failed || 0) > 0
                        ? "warn"
                        : "success"
                  }
                  variant="subtle"
                  dot
                >
                  {trustUnavailable
                    ? "Unavailable"
                    : (sourceHealth.failed || 0) > 0
                      ? "Needs attention"
                      : "Healthy"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Running: {sourceHealth.running ?? 0} · Failed: {sourceHealth.failed ?? 0} · Review
                required: {sourceHealth.reviewRequired ?? 0}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Last run {formatTimestampLabel(sourceHealth.lastRunAt)}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Runtime Projection
                </div>
                <Badge
                  tone={
                    trustUnavailable
                      ? "warn"
                      : runtimeReadiness.blocked || runtimeHealth.stale
                        ? "warn"
                        : "success"
                  }
                  variant="subtle"
                  dot
                >
                  {trustUnavailable
                    ? "Unavailable"
                    : runtimeReadiness.blocked || runtimeHealth.stale
                      ? "Blocked"
                      : "Current"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Status: {projectionHealth.reasonCode || runtimeReadiness.reasonCode || runtimeHealth.status || "unknown"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {projectionHealth.usable
                  ? "Strict runtime authority is usable."
                  : projectionRepair.canRepair
                    ? "Approved truth is present and a rebuild can be triggered here."
                    : "Projection authority is fail-closed until repair prerequisites are met."}
              </div>
              {repairRestrictionMessage ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {repairRestrictionMessage}
                </div>
              ) : null}
              {projectionRepair.latestRun?.status ? (
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Last repair {projectionRepair.latestRun.status}
                </div>
              ) : null}
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Updated {formatTimestampLabel(runtimeHealth.updatedAt)}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Approved Truth
                </div>
                <Badge
                  tone={trustUnavailable ? "warn" : truthReadiness.blocked ? "warn" : "success"}
                  variant="subtle"
                  dot
                >
                  {truthReadiness.blocked
                    ? trustUnavailable
                      ? "Unavailable"
                      : "Blocked"
                    : truthHealth.latestVersionId
                      ? "Versioned"
                      : "Pending"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review queue: {reviewHealth.pending ?? 0} pending · Conflicts: {reviewHealth.conflicts ?? 0}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Last approved {formatTimestampLabel(truthHealth.approvedAt)}
              </div>
            </div>
          </Card>
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
          Sync refreshes source evidence only. If something may change the approved business twin, it should appear in Knowledge Review before truth is updated.
        </div>

        <SettingsSurfaceBanner
          surface={trust?.surface}
          errorMessage={trustError}
          unavailableMessage="Operator trust summary is temporarily unavailable. Source cards below still reflect the last loaded settings state, but health and audit signals could not be loaded."
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
            title="Hələ source yoxdur"
            subtitle="Website, Instagram və digər mənbələri əlavə et ki AI şirkəti özü anlamağa başlasın."
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
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                Recent Sync Health
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Latest source sync outcomes that may affect review and approved truth.
              </div>
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
