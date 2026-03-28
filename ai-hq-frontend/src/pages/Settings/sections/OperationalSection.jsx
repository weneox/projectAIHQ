import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PhoneCall, ShieldCheck, Waypoints } from "lucide-react";

import Card from "../../../components/ui/Card.jsx";
import Button from "../../../components/ui/Button.jsx";
import Input from "../../../components/ui/Input.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import RepairHub from "../../../components/readiness/RepairHub.jsx";
import { dispatchRepairAction } from "../../../components/readiness/dispatchRepairAction.js";
import { createReadinessViewModel } from "../../../components/readiness/readinessViewModel.js";
import { getMetaConnectUrl } from "../../../api/settings.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function statusLabel(value = "") {
  const normalized = s(value).toLowerCase();
  if (normalized === "bounded") return "Bounded";
  if (normalized === "unbounded_in_repo") return "No Repo TTL";
  if (normalized === "runbook_only") return "Runbook Only";
  if (normalized) return normalized.replace(/[_-]+/g, " ");
  return "Unknown";
}

function statusTone(value = "") {
  const normalized = s(value).toLowerCase();
  if (normalized === "bounded") return "success";
  if (normalized === "runbook_only" || normalized === "unbounded_in_repo") {
    return "warn";
  }
  return "neutral";
}

function reasonLabel(value = "") {
  const raw = s(value);
  if (!raw) return "ready";
  return raw.replace(/[_-]+/g, " ");
}

function toneForReady(ready, reasonCode = "") {
  if (ready === true) return "success";
  if (s(reasonCode)) return "warn";
  return "neutral";
}

function buildVoiceForm(data = {}) {
  const settings = obj(data.voice?.settings);
  const twilioConfig = obj(settings.twilioConfig);
  const meta = obj(settings.meta);

  return {
    enabled: bool(settings.enabled, false),
    provider: s(settings.provider || "twilio"),
    mode: s(settings.mode || "assistant"),
    displayName: s(settings.displayName),
    defaultLanguage: s(settings.defaultLanguage || "en"),
    supportedLanguages: arr(settings.supportedLanguages).join(", "),
    twilioPhoneNumber: s(settings.twilioPhoneNumber),
    twilioPhoneSid: s(settings.twilioPhoneSid),
    operatorEnabled: bool(settings.operatorEnabled, true),
    operatorPhone: s(settings.operatorPhone),
    operatorLabel: s(settings.operatorLabel || "operator"),
    transferStrategy: s(settings.transferStrategy || "handoff"),
    callbackEnabled: bool(settings.callbackEnabled, true),
    callbackMode: s(settings.callbackMode || "lead_only"),
    maxCallSeconds: Number(settings.maxCallSeconds || 180),
    silenceHangupSeconds: Number(settings.silenceHangupSeconds || 12),
    instructions: s(settings.instructions),
    callerId: s(twilioConfig.callerId || twilioConfig.caller_id),
    realtimeModel: s(meta.realtimeModel || meta.model || "gpt-4o-realtime-preview"),
    realtimeVoice: s(meta.realtimeVoice || meta.voice || "alloy"),
  };
}

function buildChannelForm(data = {}) {
  const channel = obj(data.channels?.meta?.channel);
  return {
    channelType: s(channel.channel_type || "instagram"),
    provider: s(channel.provider || "meta"),
    displayName: s(channel.display_name),
    status: s(channel.status || "disconnected"),
    isPrimary: bool(channel.is_primary, true),
    externalPageId: s(channel.external_page_id),
    externalUserId: s(channel.external_user_id),
    externalAccountId: s(channel.external_account_id),
    externalUsername: s(channel.external_username),
    secretsRef: s(channel.secrets_ref || "meta"),
    lastSyncAt: s(channel.last_sync_at),
  };
}

function ReadinessCard({
  icon,
  title,
  subtitle,
  ready,
  reasonCode,
  missingFields = [],
  children,
}) {
  const Icon = icon;

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-slate-950 dark:text-white">
                {title}
              </div>
              <Badge tone={toneForReady(ready, reasonCode)} variant="subtle" dot={ready === true}>
                {ready === true ? "Ready" : "Attention"}
              </Badge>
              {s(reasonCode) ? (
                <Badge tone="warn" variant="subtle" dot>
                  {reasonLabel(reasonCode)}
                </Badge>
              ) : null}
            </div>
            <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {subtitle}
            </div>
          </div>
        </div>

        {arr(missingFields).length ? (
          <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            Missing: {arr(missingFields).join(", ")}
          </div>
        ) : (
          <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
            This operational contract is ready for production traffic.
          </div>
        )}

        {children}
      </div>
    </Card>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <div className="space-y-1">
        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </label>
  );
}

export default function OperationalSection({
  data,
  savingVoice,
  savingChannel,
  canManage,
  permissionState = {},
  surface,
  onSaveVoice,
  onSaveChannel,
}) {
  const loading = surface?.loading === true;
  const refresh = surface?.refresh;
  const [voiceForm, setVoiceForm] = useState(buildVoiceForm(data));
  const [channelForm, setChannelForm] = useState(buildChannelForm(data));
  const [actionMessage, setActionMessage] = useState("");
  const voicePhoneRef = useRef(null);
  const voiceEnabledRef = useRef(null);
  const channelPageIdRef = useRef(null);
  const secretsPanelRef = useRef(null);

  useEffect(() => {
    setVoiceForm(buildVoiceForm(data));
    setChannelForm(buildChannelForm(data));
  }, [data]);

  const voiceOperational = obj(data.voice?.operational);
  const metaOperational = obj(data.channels?.meta?.operational);
  const providerSecrets = obj(data.channels?.meta?.providerSecrets);
  const presentSecretKeys = arr(providerSecrets.presentSecretKeys);
  const missingSecretKeys = arr(providerSecrets.missingSecretKeys);
  const voiceRepair = obj(data.voice?.repair);
  const metaRepair = obj(data.channels?.meta?.repair);
  const readinessSurface = createReadinessViewModel(data.readiness);
  const operationalPermissionMessage = s(permissionState?.operationalSettingsWrite?.message);
  const providerSecretsPermissionMessage = s(permissionState?.providerSecretsMutation?.message);
  const dataGovernance = obj(data.dataGovernance);
  const retentionItems = arr(dataGovernance?.retention?.items);
  const backupRestore = obj(dataGovernance?.backupRestore);

  const operationalSummary = useMemo(
    () => ({
      voiceReady: voiceOperational.ready === true,
      metaReady: metaOperational.ready === true,
      providerReady: providerSecrets.ready === true,
    }),
    [metaOperational.ready, providerSecrets.ready, voiceOperational.ready]
  );

  async function handleRepairAction(action = {}) {
    setActionMessage("");
    await dispatchRepairAction(action, {
      focusTargets: {
        twilioPhoneNumber: voicePhoneRef,
        "voice.twilioPhoneNumber": voicePhoneRef,
        enabled: voiceEnabledRef,
        "voice.enabled": voiceEnabledRef,
        externalPageId: channelPageIdRef,
        "meta.externalPageId": channelPageIdRef,
        providerSecrets: secretsPanelRef,
        "meta.providerSecrets": secretsPanelRef,
      },
      oauthHandlers: {
        meta: getMetaConnectUrl,
      },
      onBlocked(blockedAction) {
        setActionMessage(
          blockedAction.requiredRole === "admin"
            ? "This repair flow stays behind owner/admin access."
            : "This repair flow needs owner/admin/operator access."
        );
      },
      onError(error) {
        setActionMessage(String(error?.message || error || "Repair action failed"));
      },
    });
  }

  async function handleSaveVoice() {
    await onSaveVoice({
      enabled: voiceForm.enabled,
      provider: voiceForm.provider,
      mode: voiceForm.mode,
      displayName: voiceForm.displayName,
      defaultLanguage: voiceForm.defaultLanguage,
      supportedLanguages: voiceForm.supportedLanguages
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      twilioPhoneNumber: voiceForm.twilioPhoneNumber,
      twilioPhoneSid: voiceForm.twilioPhoneSid,
      operatorEnabled: voiceForm.operatorEnabled,
      operatorPhone: voiceForm.operatorPhone,
      operatorLabel: voiceForm.operatorLabel,
      transferStrategy: voiceForm.transferStrategy,
      callbackEnabled: voiceForm.callbackEnabled,
      callbackMode: voiceForm.callbackMode,
      maxCallSeconds: Number(voiceForm.maxCallSeconds || 0),
      silenceHangupSeconds: Number(voiceForm.silenceHangupSeconds || 0),
      instructions: voiceForm.instructions,
      twilioConfig: {
        callerId: voiceForm.callerId,
      },
      meta: {
        realtimeModel: voiceForm.realtimeModel,
        realtimeVoice: voiceForm.realtimeVoice,
      },
    });
  }

  async function handleSaveChannel() {
    await onSaveChannel(channelForm.channelType || "instagram", {
      provider: channelForm.provider,
      display_name: channelForm.displayName,
      status: channelForm.status,
      is_primary: channelForm.isPrimary,
      external_page_id: channelForm.externalPageId,
      external_user_id: channelForm.externalUserId,
      external_account_id: channelForm.externalAccountId,
      external_username: channelForm.externalUsername,
      secrets_ref: channelForm.secretsRef,
      last_sync_at: channelForm.lastSyncAt || null,
    });
  }

  return (
    <SettingsSection
      eyebrow="Operational Control Plane"
      title="Operational Runtime"
      subtitle="Manage the persisted voice/channel records that production sidecars depend on. Secrets stay separate and only readiness is exposed here."
      tone="default"
    >
      <div className="space-y-6">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Operational readiness is temporarily unavailable. Production remains fail-closed until readiness can be confirmed again."
          refreshLabel="Refresh Readiness"
        />
        {actionMessage ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {actionMessage}
          </div>
        ) : null}
        {!canManage ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {operationalPermissionMessage || "Operational voice and channel changes stay behind owner/admin access."}
          </div>
        ) : null}

        <RepairHub
          title="Operational Repair Hub"
          readiness={readinessSurface}
          blockers={readinessSurface.blockers}
          canManage={canManage}
          loading={loading || savingVoice || savingChannel}
          emptyMessage="Operational voice, channel, and provider prerequisites are aligned."
          unavailableMessage="Production traffic stays fail-closed until the persisted operational contract and provider dependencies converge."
          onRunAction={handleRepairAction}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="subtle" padded="md" tone={operationalSummary.voiceReady ? "success" : "warn"} className="rounded-[24px]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Voice</div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {operationalSummary.voiceReady ? "Ready" : "Blocked"}
            </div>
          </Card>
          <Card variant="subtle" padded="md" tone={operationalSummary.metaReady ? "success" : "warn"} className="rounded-[24px]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Meta Channel</div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {operationalSummary.metaReady ? "Ready" : "Blocked"}
            </div>
          </Card>
          <Card variant="subtle" padded="md" tone={operationalSummary.providerReady ? "success" : "warn"} className="rounded-[24px]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Provider Secrets</div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              {operationalSummary.providerReady ? "Ready" : "Missing"}
            </div>
          </Card>
        </div>

        <Card variant="surface" padded="lg" className="rounded-[28px]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-950 dark:text-white">
                  Data Retention & Restore Posture
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  This is the current repo-enforced baseline, not a full compliance program.
                </div>
              </div>
              <Badge tone={statusTone(backupRestore.status)} variant="subtle" dot>
                {statusLabel(backupRestore.status)}
              </Badge>
            </div>

            {retentionItems.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {retentionItems.map((item) => (
                  <div
                    key={item.key || item.label}
                    className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.label || item.key}
                      </div>
                      <Badge tone={statusTone(item.status)} variant="subtle">
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 leading-6">{item.message}</div>
                    {item.retainDays || item.maxRows || item.pruneIntervalHours ? (
                      <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.retainDays ? `Retain ${item.retainDays} days` : ""}
                        {item.retainDays && item.maxRows ? " · " : ""}
                        {item.maxRows ? `Max ${item.maxRows} rows` : ""}
                        {(item.retainDays || item.maxRows) && item.pruneIntervalHours ? " · " : ""}
                        {item.pruneIntervalHours ? `Prune every ${item.pruneIntervalHours}h` : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              <div className="font-semibold">Backup and restore honesty</div>
              <div className="mt-2 leading-6">
                {backupRestore.message ||
                  "No explicit backup or restore posture has been returned."}
              </div>
              {arr(backupRestore.runbooks).length ? (
                <div className="mt-2 text-xs leading-5">
                  Runbooks: {arr(backupRestore.runbooks).join(", ")}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <ReadinessCard
          icon={PhoneCall}
          title="Voice Operational Settings"
          subtitle="Twilio routing and realtime behavior now come only from persisted tenant voice settings."
          ready={voiceOperational.ready === true}
          reasonCode={voiceOperational.reasonCode}
          missingFields={data.voice?.missingFields}
        >
          <RepairHub
            title="Voice Repair"
            readiness={{
              status: voiceRepair.blocked ? "blocked" : "ready",
              reasonCode: voiceRepair.reasonCode,
            }}
            blockers={voiceRepair.blocked ? [voiceRepair] : []}
            canManage={canManage}
            loading={loading || savingVoice}
            emptyMessage="Voice operational settings are complete."
            onRunAction={handleRepairAction}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Voice Enabled">
              <select
                ref={voiceEnabledRef}
                className="h-12 w-full rounded-[18px] border border-slate-200/80 bg-white/90 px-4 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                value={voiceForm.enabled ? "true" : "false"}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    enabled: event.target.value === "true",
                  }))
                }
                disabled={!canManage || loading}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
            <Field label="Default Language">
              <Input
                value={voiceForm.defaultLanguage}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    defaultLanguage: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Display Name">
              <Input
                value={voiceForm.displayName}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Supported Languages" hint="Comma-separated language codes">
              <Input
                value={voiceForm.supportedLanguages}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    supportedLanguages: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Twilio Phone Number">
              <Input
                ref={voicePhoneRef}
                value={voiceForm.twilioPhoneNumber}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    twilioPhoneNumber: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Twilio Phone SID">
              <Input
                value={voiceForm.twilioPhoneSid}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    twilioPhoneSid: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Operator Phone">
              <Input
                value={voiceForm.operatorPhone}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    operatorPhone: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Caller ID">
              <Input
                value={voiceForm.callerId}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    callerId: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Realtime Model">
              <Input
                value={voiceForm.realtimeModel}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    realtimeModel: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Realtime Voice">
              <Input
                value={voiceForm.realtimeVoice}
                onChange={(event) =>
                  setVoiceForm((prev) => ({
                    ...prev,
                    realtimeVoice: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
          </div>

          <Field label="Realtime Instructions">
            <textarea
              className="min-h-[120px] w-full rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
              value={voiceForm.instructions}
              onChange={(event) =>
                setVoiceForm((prev) => ({
                  ...prev,
                  instructions: event.target.value,
                }))
              }
              disabled={!canManage || loading}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveVoice} disabled={!canManage || loading || savingVoice}>
              {savingVoice ? "Saving..." : "Save Voice Settings"}
            </Button>
            <Button variant="secondary" onClick={refresh} disabled={loading || savingVoice}>
              Refresh Readiness
            </Button>
          </div>
        </ReadinessCard>

        <ReadinessCard
          icon={Waypoints}
          title="Meta Operational Channel"
          subtitle="Persisted channel identifiers and provider refs used by downstream Meta flows."
          ready={metaOperational.ready === true}
          reasonCode={metaOperational.reasonCode}
          missingFields={data.channels?.meta?.missingFields}
        >
          <RepairHub
            title="Meta Repair"
            readiness={{
              status: metaRepair.blocked ? "blocked" : "ready",
              reasonCode: metaRepair.reasonCode,
            }}
            blockers={metaRepair.blocked ? [metaRepair] : []}
            canManage={canManage}
            loading={loading || savingChannel}
            emptyMessage="Meta operational identifiers and secret coverage are aligned."
            onRunAction={handleRepairAction}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Channel Type">
              <Input
                value={channelForm.channelType}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    channelType: event.target.value.toLowerCase(),
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Provider">
              <Input
                value={channelForm.provider}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    provider: event.target.value.toLowerCase(),
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Display Name">
              <Input
                value={channelForm.displayName}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="Status">
              <Input
                value={channelForm.status}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    status: event.target.value.toLowerCase(),
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="External Page ID">
              <Input
                ref={channelPageIdRef}
                value={channelForm.externalPageId}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    externalPageId: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="External User ID">
              <Input
                value={channelForm.externalUserId}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    externalUserId: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="External Account ID">
              <Input
                value={channelForm.externalAccountId}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    externalAccountId: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
            <Field label="External Username">
              <Input
                value={channelForm.externalUsername}
                onChange={(event) =>
                  setChannelForm((prev) => ({
                    ...prev,
                    externalUsername: event.target.value,
                  }))
                }
                disabled={!canManage || loading}
              />
            </Field>
          </div>

          <div
            ref={secretsPanelRef}
            tabIndex={-1}
            className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
          >
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="h-4 w-4" />
              Provider Secret Readiness
            </div>
            <div className="mt-2">
              Present: {presentSecretKeys.length ? presentSecretKeys.join(", ") : "none"}
            </div>
            <div className="mt-1">
              Missing required: {missingSecretKeys.length ? missingSecretKeys.join(", ") : "none"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Secret values stay hidden. Manage them through the secure secrets flow, not this form.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSaveChannel} disabled={!canManage || loading || savingChannel}>
              {savingChannel ? "Saving..." : "Save Channel Identifiers"}
            </Button>
            <Button variant="secondary" onClick={refresh} disabled={loading || savingChannel}>
              Refresh Readiness
            </Button>
          </div>
        </ReadinessCard>

        {!permissionState?.providerSecretsMutation?.allowed ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            {providerSecretsPermissionMessage || "Provider secret changes stay behind owner/admin access."}
          </div>
        ) : null}

        {(voiceOperational.ready !== true || metaOperational.ready !== true) ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/90 px-4 py-4 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Production traffic is fail-closed while operational rows or required provider readiness are incomplete.
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}
