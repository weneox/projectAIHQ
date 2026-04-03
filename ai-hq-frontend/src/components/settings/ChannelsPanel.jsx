import {
  CheckCircle2,
  Instagram,
  Loader2,
  Plug2,
  RefreshCw,
  Unplug,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import Input from "../ui/Input.jsx";
import SettingsSection from "./SettingsSection.jsx";
import SettingsSurfaceBanner from "./SettingsSurfaceBanner.jsx";
import RepairHub from "../readiness/RepairHub.jsx";
import { createReadinessViewModel } from "../readiness/readinessViewModel.js";
import { useChannelsSurface } from "./hooks/useChannelsSurface.js";
import { cx } from "../../lib/cx.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function toneClassForChip(tone = "neutral") {
  if (tone === "success") {
    return "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (tone === "warn") {
    return "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200";
  }

  if (tone === "info") {
    return "bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200";
  }

  return "bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200";
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
        {value || "-"}
      </div>
      {hint ? (
        <div
          className={cx(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
            toneClassForChip(tone)
          )}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </div>
      {children}
    </label>
  );
}

function buildMetaForm(metaChannel = null) {
  const channel = metaChannel && typeof metaChannel === "object" ? metaChannel : {};

  return {
    channelType: s(channel.channel_type || "instagram"),
    provider: s(channel.provider || "meta"),
    displayName: s(channel.display_name),
    status: s(channel.status || "disconnected"),
    isPrimary: channel.is_primary !== false,
    externalPageId: s(channel.external_page_id),
    externalUserId: s(channel.external_user_id),
    externalAccountId: s(channel.external_account_id),
    externalUsername: s(channel.external_username),
    secretsRef: s(channel.secrets_ref || "meta"),
    lastSyncAt: s(channel.last_sync_at),
  };
}

export default function ChannelsPanel({
  canManage = true,
  canManageIdentifiers = false,
  metaOperational = null,
  voiceStatus = null,
  savingChannel = false,
  onSaveChannel = null,
}) {
  const { meta, surface, startMetaConnect, disconnectChannel, runRepairAction } =
    useChannelsSurface({ canManage });
  const readinessModel = createReadinessViewModel(meta.readiness);
  const busy = surface.loading || surface.saving;
  const [metaForm, setMetaForm] = useState(buildMetaForm(metaOperational?.channel));

  useEffect(() => {
    setMetaForm(buildMetaForm(metaOperational?.channel));
  }, [metaOperational?.channel]);

  async function handleSaveIdentifiers() {
    if (!onSaveChannel) return;

    await onSaveChannel(metaForm.channelType || "instagram", {
      provider: metaForm.provider,
      display_name: metaForm.displayName,
      status: metaForm.status,
      is_primary: metaForm.isPrimary,
      external_page_id: metaForm.externalPageId,
      external_user_id: metaForm.externalUserId,
      external_account_id: metaForm.externalAccountId,
      external_username: metaForm.externalUsername,
      secrets_ref: metaForm.secretsRef,
      last_sync_at: metaForm.lastSyncAt || null,
    });
  }

  const voiceReady = voiceStatus?.ready === true;
  const metaReady = metaOperational?.ready === true;
  const metaReasonCode = s(metaOperational?.reasonCode || readinessModel.reasonCode);

  return (
    <SettingsSection
      eyebrow="Integrations"
      title="Launch Integrations"
      subtitle="Keep Meta messaging and the Twilio business line aligned."
      tone="default"
    >
      <div className="space-y-5">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Meta channel status is temporarily unavailable."
          refreshLabel="Refresh Status"
        />

        {!surface.unavailable ? (
          <RepairHub
            title="Meta Repair Hub"
            readiness={readinessModel}
            blockers={readinessModel.blockers}
            canManage={canManage}
            loading={busy}
            emptyMessage="Meta channel connection and identifiers are aligned."
            unavailableMessage="Meta delivery remains blocked until the connection and identifiers converge."
            onRunAction={runRepairAction}
          />
        ) : null}

        <div className="grid gap-3 rounded-[26px] border border-slate-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.03] md:grid-cols-3">
          <StatTile
            label="Meta"
            value={meta.connected ? "Connected" : "Disconnected"}
            hint={
              metaReasonCode
                ? metaReasonCode.replace(/[_-]+/g, " ")
                : "Inbox and comments"
            }
            tone={meta.connected && metaReady ? "success" : "warn"}
          />
          <StatTile
            label="Messaging Runtime"
            value={metaReady ? "Ready" : "Needs attention"}
            hint="Inbox and comments"
            tone={metaReady ? "success" : "warn"}
          />
          <StatTile
            label="Twilio Line"
            value={voiceStatus?.phoneNumber || "-"}
            hint={voiceReady ? "Voice ready" : "Voice needs attention"}
            tone={voiceReady ? "success" : "warn"}
          />
        </div>

        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.72))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
            <div className="px-5 py-5 sm:px-6">
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    <Instagram className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="inline-flex flex-wrap items-center gap-2">
                      <Badge tone="info" variant="subtle" dot>
                        Meta Messaging
                      </Badge>
                      <Badge
                        tone={meta.connected ? "success" : "neutral"}
                        variant="subtle"
                        dot={meta.connected}
                      >
                        {meta.connected ? "Connected" : "Not connected"}
                      </Badge>
                    </div>

                    <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                      Meta inbox connection
                    </div>

                    {meta.connected ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Meta is connected
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-slate-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.03] md:grid-cols-2">
                  <StatTile
                    label="Username"
                    value={
                      meta?.channel?.external_username
                        ? `@${meta.channel.external_username}`
                        : "-"
                    }
                    hint="Linked Instagram"
                    tone="info"
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
                    hint="Business account"
                    tone="info"
                  />
                  <StatTile
                    label="Sync"
                    value={meta?.channel?.last_sync_at ? "Synced" : "No sync"}
                    hint={meta?.channel?.last_sync_at || "No sync yet"}
                    tone={meta?.channel?.last_sync_at ? "success" : "neutral"}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
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
                        ? "Reconnect Meta"
                        : "Connect Meta"}
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

            <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 xl:border-l xl:border-t-0 sm:px-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/84 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                    <Waves className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </div>
                  <div>
                    <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                      Voice line
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Visible here while runtime behavior stays under Operational.
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <StatTile
                    label="Status"
                    value={voiceReady ? "Ready" : "Needs attention"}
                    hint={s(voiceStatus?.reasonCode || "voice_ready").replace(
                      /[_-]+/g,
                      " "
                    )}
                    tone={voiceReady ? "success" : "warn"}
                  />
                  <StatTile
                    label="Business Line"
                    value={voiceStatus?.phoneNumber || "-"}
                    hint="Twilio number"
                    tone="info"
                  />
                  <StatTile
                    label="Caller ID"
                    value={voiceStatus?.callerId || "-"}
                    hint="Outbound identity"
                    tone="neutral"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 sm:px-6">
            {surface.loading ? (
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Integration details are loading...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950 dark:text-white">
                      Meta identifiers
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Keep connection metadata aligned.
                    </div>
                  </div>
                  {!canManageIdentifiers ? (
                    <Badge tone="warn" variant="subtle">
                      Read Only
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Display Name">
                    <Input
                      value={metaForm.displayName}
                      onChange={(event) =>
                        setMetaForm((prev) => ({
                          ...prev,
                          displayName: event.target.value,
                        }))
                      }
                      disabled={!canManageIdentifiers || savingChannel}
                    />
                  </Field>
                  <Field label="External Username">
                    <Input
                      value={metaForm.externalUsername}
                      onChange={(event) =>
                        setMetaForm((prev) => ({
                          ...prev,
                          externalUsername: event.target.value,
                        }))
                      }
                      disabled={!canManageIdentifiers || savingChannel}
                    />
                  </Field>
                  <Field label="External Page ID">
                    <Input
                      value={metaForm.externalPageId}
                      onChange={(event) =>
                        setMetaForm((prev) => ({
                          ...prev,
                          externalPageId: event.target.value,
                        }))
                      }
                      disabled={!canManageIdentifiers || savingChannel}
                    />
                  </Field>
                  <Field label="External User ID">
                    <Input
                      value={metaForm.externalUserId}
                      onChange={(event) =>
                        setMetaForm((prev) => ({
                          ...prev,
                          externalUserId: event.target.value,
                        }))
                      }
                      disabled={!canManageIdentifiers || savingChannel}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveIdentifiers}
                    disabled={
                      !canManageIdentifiers || savingChannel || !onSaveChannel
                    }
                  >
                    {savingChannel ? "Saving..." : "Save Meta Details"}
                  </Button>
                  <Button variant="secondary" onClick={surface.refresh} disabled={busy}>
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
