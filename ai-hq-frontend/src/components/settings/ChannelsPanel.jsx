import {
  CheckCircle2,
  Instagram,
  Loader2,
  Plug2,
  RefreshCw,
  Unplug,
} from "lucide-react";

import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
import SettingsSurfaceBanner from "./SettingsSurfaceBanner.jsx";
import RepairHub from "../readiness/RepairHub.jsx";
import { createReadinessViewModel } from "../readiness/readinessViewModel.js";
import { useChannelsSurface } from "./hooks/useChannelsSurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" padded="md" tone={tone} className="rounded-[24px]">
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
          {value || "-"}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function ChannelsPanel({ canManage = true }) {
  const { meta, surface, startMetaConnect, disconnectChannel, runRepairAction } =
    useChannelsSurface({ canManage });
  const readinessModel = createReadinessViewModel(meta.readiness);
  const busy = surface.loading || surface.saving;

  return (
    <SettingsSection
      eyebrow="Channels"
      title="Channels"
      subtitle="Meta channel connection state and repair guidance stay aligned with the operational readiness contract."
      tone="default"
    >
      <div className="space-y-6">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Meta channel status is temporarily unavailable."
          refreshLabel="Refresh Status"
        />

        {!surface.unavailable ? (
          <RepairHub
            title="Channel Repair Hub"
            readiness={readinessModel}
            blockers={readinessModel.blockers}
            canManage={canManage}
            loading={busy}
            emptyMessage="Meta channel connection and identifiers are aligned."
            unavailableMessage="Meta delivery remains blocked until the channel connection, identifiers, and secret-backed dependencies converge."
            onRunAction={runRepairAction}
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Instagram Direct
                  </Badge>
                  <Badge
                    tone={meta.connected ? "success" : "neutral"}
                    variant="subtle"
                    dot={meta.connected}
                  >
                    {meta.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    Connect Instagram
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Operators see the same readiness reasons here that sidecars and operational admin use. Secret values are never exposed.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <StatTile
                  label="Status"
                  value={meta.connected ? "Connected" : "Disconnected"}
                  hint="Current state"
                  tone={meta.connected ? "success" : "neutral"}
                />
                <StatTile
                  label="Username"
                  value={meta?.channel?.external_username ? `@${meta.channel.external_username}` : "-"}
                  hint="Linked Instagram"
                  tone="info"
                />
                <StatTile
                  label="Sync"
                  value={meta?.channel?.last_sync_at ? "Synced" : "No sync"}
                  hint={meta?.channel?.last_sync_at || "No sync yet"}
                  tone={meta?.channel?.last_sync_at ? "success" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Access State
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Management Access
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Connection changes remain restricted to permitted operators.
                </div>
              </div>

              {canManage ? (
                <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Owner/admin access is active.
                </div>
              ) : (
                <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  This channel surface is read-only for your role.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <StatTile
                  label="Permission"
                  value={canManage ? "Write" : "Read Only"}
                  hint="Current operator mode"
                  tone={canManage ? "success" : "warn"}
                />
                <StatTile
                  label="Token"
                  value={meta.hasToken ? "Available" : "Missing"}
                  hint="Secure tenant secret"
                  tone={meta.hasToken ? "success" : "warn"}
                />
                <StatTile
                  label="Reason"
                  value={s(readinessModel.reasonCode || "ready").replace(/[_-]+/g, " ")}
                  hint="Shared readiness language"
                  tone={readinessModel.reasonCode ? "warn" : "info"}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card variant="surface" padded="lg" className="rounded-[28px]">
          {surface.loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Channel status is loading...
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    <Instagram className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-950 dark:text-white">
                        Instagram Direct
                      </div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Meta Business-backed Instagram DM routing with strict runtime authority.
                      </div>
                    </div>

                    {meta.connected ? (
                      <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Instagram is connected.
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <StatTile
                        label="Display"
                        value={meta?.channel?.display_name || "-"}
                        hint="Saved channel display"
                        tone="neutral"
                      />
                      <StatTile
                        label="Page ID"
                        value={meta?.channel?.external_page_id || "-"}
                        hint="Linked Meta page"
                        tone="info"
                      />
                      <StatTile
                        label="IG User ID"
                        value={meta?.channel?.external_user_id || "-"}
                        hint="Instagram business account"
                        tone="info"
                      />
                      <StatTile
                        label="Primary"
                        value={meta?.channel?.is_primary ? "Yes" : "No"}
                        hint="Routing priority"
                        tone={meta?.channel?.is_primary ? "warn" : "neutral"}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Connection Actions
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={startMetaConnect}
                      disabled={!canManage || surface.saving}
                      leftIcon={
                        meta.connected ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <Plug2 className="h-4 w-4" />
                        )
                      }
                    >
                      {surface.saving
                        ? "Processing..."
                        : meta.connected
                        ? "Reconnect Instagram"
                        : "Connect Instagram"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={surface.refresh}
                      disabled={busy}
                    >
                      Refresh Status
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={disconnectChannel}
                      disabled={!canManage || surface.saving || !meta.connected}
                      leftIcon={<Unplug className="h-4 w-4" />}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </SettingsSection>
  );
}
