import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PhoneCall, Waypoints } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../../components/ui/Button.jsx";
import Input from "../../../components/ui/Input.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import { cx } from "../../../lib/cx.js";

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

function buildVoiceForm(data = {}) {
  const settings = obj(data.voice?.settings);
  const twilioConfig = obj(settings.twilioConfig);

  return {
    enabled: bool(settings.enabled, false),
    provider: s(settings.provider || "twilio"),
    mode: s(settings.mode || "assistant"),
    displayName: s(settings.displayName),
    defaultLanguage: s(settings.defaultLanguage || "en"),
    supportedLanguages: arr(settings.supportedLanguages).join(", "),
    twilioPhoneNumber: s(settings.twilioPhoneNumber),
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
    realtimeModel: s(
      settings?.meta?.realtimeModel ||
        settings?.meta?.model ||
        "gpt-4o-realtime-preview"
    ),
    realtimeVoice: s(
      settings?.meta?.realtimeVoice || settings?.meta?.voice || "alloy"
    ),
  };
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
        {value}
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
  canManage,
  permissionState = {},
  surface,
  onSaveVoice,
}) {
  const loading = surface?.loading === true;
  const refresh = surface?.refresh;
  const [voiceForm, setVoiceForm] = useState(buildVoiceForm(data));

  useEffect(() => {
    setVoiceForm(buildVoiceForm(data));
  }, [data]);

  const voiceOperational = obj(data.voice?.operational);
  const metaOperational = obj(data.channels?.meta?.operational);
  const operationalPermissionMessage = s(
    permissionState?.operationalSettingsWrite?.message
  );

  const launchSummary = useMemo(
    () => ({
      voiceReady: voiceOperational.ready === true,
      messagingReady: metaOperational.ready === true,
    }),
    [metaOperational.ready, voiceOperational.ready]
  );

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

  return (
    <SettingsSection
      eyebrow="Operational"
      title="Voice Runtime"
      subtitle="Keep the operator line, handoff path, and live voice behavior aligned."
      tone="default"
    >
      <div className="space-y-5">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Operational settings are temporarily unavailable."
          refreshLabel="Refresh"
        />

        {!canManage ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {operationalPermissionMessage ||
              "Operational voice changes stay behind owner/admin access."}
          </div>
        ) : null}

        <div className="grid gap-3 rounded-[26px] border border-slate-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.03] md:grid-cols-3">
          <StatTile
            label="Inbox & Comments"
            value={launchSummary.messagingReady ? "Ready" : "Blocked"}
            hint={reasonLabel(metaOperational.reasonCode)}
            tone={toneForReady(
              launchSummary.messagingReady,
              metaOperational.reasonCode
            )}
          />
          <StatTile
            label="Voice"
            value={launchSummary.voiceReady ? "Ready" : "Blocked"}
            hint={reasonLabel(voiceOperational.reasonCode)}
            tone={toneForReady(
              launchSummary.voiceReady,
              voiceOperational.reasonCode
            )}
          />
          <StatTile
            label="Business Line"
            value={voiceForm.twilioPhoneNumber || "-"}
            hint="Active Twilio number"
            tone={voiceForm.twilioPhoneNumber ? "info" : "warn"}
          />
        </div>

        {!launchSummary.messagingReady ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <Waypoints className="h-4 w-4" />
                Messaging runtime depends on Meta integration state.
              </div>
              <Link
                to="/settings?section=channels"
                className="inline-flex items-center justify-center rounded-2xl border border-amber-300/35 bg-white/55 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-white/75 dark:border-amber-200/20 dark:bg-white/10 dark:text-amber-100"
              >
                Open Integrations
              </Link>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.72))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]">
          <div className="border-b border-slate-200/80 px-5 py-5 dark:border-white/10 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/84 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                    <PhoneCall className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Voice runtime controls
                  </div>
                  <Badge
                    tone={toneForReady(
                      launchSummary.voiceReady,
                      voiceOperational.reasonCode
                    )}
                    variant="subtle"
                    dot={launchSummary.voiceReady}
                  >
                    {launchSummary.voiceReady ? "Ready" : "Needs attention"}
                  </Badge>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Receptionist line, handoff, and caller identity.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSaveVoice}
                  disabled={!canManage || loading || savingVoice}
                >
                  {savingVoice ? "Saving..." : "Save Voice Settings"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={refresh}
                  disabled={loading || savingVoice}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <div className="px-5 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Voice Enabled">
                  <select
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
              </div>
            </div>

            <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 xl:border-l xl:border-t-0 sm:px-6">
              <Field label="Receptionist Instructions">
                <textarea
                  className="min-h-[180px] w-full rounded-[20px] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
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
            </div>
          </div>
        </div>

        {!launchSummary.voiceReady ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/90 px-4 py-4 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Voice traffic stays fail-closed until the runtime line settings are complete.
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}
