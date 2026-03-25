// src/components/settings/AiPolicyForm.jsx
// PREMIUM v3.1 — editorial AI policy control surface (schedule-safe)

import {
  AlarmClock,
  Bot,
  CheckCheck,
  Eye,
  FileCheck2,
  MoonStar,
  PenSquare,
  Send,
  TimerReset,
  Zap,
} from "lucide-react";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
import { cx } from "../../lib/cx.js";

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200",
        checked
          ? "border-sky-400/40 bg-[linear-gradient(180deg,rgba(14,165,233,0.92),rgba(37,99,235,0.92))] shadow-[0_10px_24px_rgba(37,99,235,0.24)]"
          : "border-slate-300/80 bg-slate-200/85 dark:border-white/10 dark:bg-white/[0.08]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.18)] transition-all duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2.5">
      <div className="space-y-1">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-slate-100">
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

function Select({ value, onChange, children, disabled = false }) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden rounded-[22px] border",
        "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_32px_rgba(15,23,42,0.06)]",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-sky-300/90 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_4px_rgba(56,189,248,0.08),0_16px_38px_rgba(15,23,42,0.08)]",
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]",
        "dark:focus-within:border-sky-400/30 dark:focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_4px_rgba(56,189,248,0.10),0_18px_46px_rgba(0,0,0,0.52)]",
        disabled ? "opacity-70" : ""
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.20),transparent_44%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
      />
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="relative z-10 h-12 w-full appearance-none bg-transparent px-4 text-[14px] text-slate-900 outline-none dark:text-slate-100"
      >
        {children}
      </select>
    </div>
  );
}

function PolicyToggleCard({ icon, title, subtitle, checked, onChange, disabled = false }) {
  const Icon = icon;

  return (
    <Card
      variant="subtle"
      padded="md"
      className="rounded-[24px]"
      tone={checked ? "info" : "neutral"}
    >
      <div className="flex items-start gap-4">
        <div
          className={cx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-all duration-200",
            checked
              ? "border-sky-300/70 bg-sky-50 text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.14)] dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200"
              : "border-slate-200/80 bg-white/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
              {title}
            </div>
            <Badge
              tone={checked ? "success" : "neutral"}
              variant="subtle"
              size="sm"
              dot={checked}
            >
              {checked ? "On" : "Off"}
            </Badge>
          </div>

          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>

        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </Card>
  );
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card
      variant="subtle"
      padded="md"
      tone={tone}
      className="rounded-[24px]"
    >
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
          {value}
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

function countEnabled(values = []) {
  return values.filter(Boolean).length;
}

function clampHour(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(23, n));
}

function clampMinute(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(59, n));
}

function toTimeString(hour, minute) {
  return `${String(clampHour(hour)).padStart(2, "0")}:${String(clampMinute(minute)).padStart(2, "0")}`;
}

export default function AiPolicyForm({
  aiPolicy = {},
  patchAi,
  canManage = true,
}) {
  const publishPolicy =
    aiPolicy?.publish_policy && typeof aiPolicy.publish_policy === "object"
      ? aiPolicy.publish_policy
      : {};

  const draftSchedule = publishPolicy?.draftSchedule || {
    enabled: false,
    hour: 10,
    minute: 0,
    timezone: "Asia/Baku",
    format: "image",
  };

  const currentSchedule = publishPolicy?.schedule || {
    enabled: !!draftSchedule.enabled,
    time: toTimeString(draftSchedule.hour, draftSchedule.minute),
    timezone: draftSchedule.timezone || "Asia/Baku",
  };

  function patchDraftSchedule(key, value) {
    const nextDraftSchedule = {
      ...draftSchedule,
      [key]: value,
    };

    const nextHour = clampHour(nextDraftSchedule.hour);
    const nextMinute = clampMinute(nextDraftSchedule.minute);
    const nextTimezone = String(nextDraftSchedule.timezone || "Asia/Baku").trim() || "Asia/Baku";
    const nextEnabled = !!nextDraftSchedule.enabled;

    patchAi("publish_policy", {
      ...publishPolicy,
      draftSchedule: {
        ...nextDraftSchedule,
        hour: nextHour,
        minute: nextMinute,
        timezone: nextTimezone,
      },
      schedule: {
        ...currentSchedule,
        enabled: nextEnabled,
        time: toTimeString(nextHour, nextMinute),
        timezone: nextTimezone,
      },
    });
  }

  const automationItems = [
    {
      key: "auto_reply_enabled",
      title: "Auto Reply",
      subtitle: "DM-lərə AI cavab versin.",
      icon: Bot,
      checked: !!aiPolicy.auto_reply_enabled,
    },
    {
      key: "mark_seen_enabled",
      title: "Mark Seen",
      subtitle: "Seen event avtomatik göndərilsin.",
      icon: Eye,
      checked: !!aiPolicy.mark_seen_enabled,
    },
    {
      key: "typing_indicator_enabled",
      title: "Typing Indicator",
      subtitle: "Typing on/off davranışı işləsin.",
      icon: Zap,
      checked: !!aiPolicy.typing_indicator_enabled,
    },
    {
      key: "create_lead_enabled",
      title: "Lead Capture",
      subtitle: "Uyğun DM-lərdən lead yaradılsın.",
      icon: Send,
      checked: !!aiPolicy.create_lead_enabled,
    },
  ];

  const approvalItems = [
    {
      key: "suppress_ai_during_handoff",
      title: "Suppress During Handoff",
      subtitle: "Handoff aktivdirsə AI cavabı dayansın.",
      icon: TimerReset,
      checked: !!aiPolicy.suppress_ai_during_handoff,
    },
    {
      key: "approval_required_content",
      title: "Content Approval",
      subtitle: "Draft content üçün approval tələb olunsun.",
      icon: PenSquare,
      checked: !!aiPolicy.approval_required_content,
    },
    {
      key: "approval_required_publish",
      title: "Publish Approval",
      subtitle: "Publish öncəsi təsdiq istənsin.",
      icon: FileCheck2,
      checked: !!aiPolicy.approval_required_publish,
    },
  ];

  const quietHoursEnabled = !!aiPolicy.quiet_hours_enabled;
  const enabledTotal = countEnabled([
    ...automationItems.map((x) => x.checked),
    ...approvalItems.map((x) => x.checked),
    quietHoursEnabled,
    !!draftSchedule.enabled,
  ]);

  return (
    <SettingsSection
      eyebrow="AI Policy"
      title="AI Policy"
      subtitle="Inbox automation, approval flow, quiet hours və draft scheduling qaydaları burada idarə olunur."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Policy Engine
                  </Badge>
                  <Badge
                    tone={enabledTotal > 0 ? "success" : "neutral"}
                    variant="subtle"
                    dot={enabledTotal > 0}
                  >
                    {enabledTotal} active rule{enabledTotal === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    AI Behavior Controls
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Auto-reply, approval logic, quiet hour windows və scheduled
                    content generation buradan idarə olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <StatTile
                  label="Automation"
                  value={countEnabled(automationItems.map((x) => x.checked))}
                  hint="Conversation rules"
                  tone="info"
                />
                <StatTile
                  label="Approvals"
                  value={countEnabled(approvalItems.map((x) => x.checked))}
                  hint="Control gates"
                  tone="warn"
                />
                <StatTile
                  label="Schedule"
                  value={draftSchedule.enabled ? "On" : "Off"}
                  hint="Draft generation"
                  tone={draftSchedule.enabled ? "success" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Runtime Snapshot
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Policy Overview
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Hazırkı AI davranış qaydalarının ümumi vəziyyəti.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <StatTile
                  label="Quiet Hours"
                  value={quietHoursEnabled ? "Enabled" : "Disabled"}
                  hint="Response blackout window"
                  tone={quietHoursEnabled ? "warn" : "neutral"}
                />
                <StatTile
                  label="Draft Schedule"
                  value={draftSchedule.enabled ? "Enabled" : "Disabled"}
                  hint={`${draftSchedule.hour ?? 10}:${String(
                    draftSchedule.minute ?? 0
                  ).padStart(2, "0")} ${draftSchedule.timezone || "Asia/Baku"}`}
                  tone={draftSchedule.enabled ? "success" : "neutral"}
                />
                <StatTile
                  label="Approval Gate"
                  value={
                    aiPolicy.approval_required_publish ||
                    aiPolicy.approval_required_content
                      ? "Protected"
                      : "Open"
                  }
                  hint="Content / publish review flow"
                  tone={
                    aiPolicy.approval_required_publish ||
                    aiPolicy.approval_required_content
                      ? "info"
                      : "neutral"
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <Bot className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Conversation Automation
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Inbox davranışı, reply signals və lead workflow qaydaları.
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {automationItems.map((item) => (
                  <PolicyToggleCard
                    key={item.key}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    checked={item.checked}
                    disabled={!canManage}
                    onChange={(v) => patchAi(item.key, v)}
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <CheckCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Approval & Safety
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Human handoff, publish review və approval gates buradan təyin olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {approvalItems.map((item) => (
                  <PolicyToggleCard
                    key={item.key}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    checked={item.checked}
                    disabled={!canManage}
                    onChange={(v) => patchAi(item.key, v)}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <MoonStar className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Quiet Hours
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Müəyyən saatlarda AI reply behavior dayandırılsın.
                  </div>
                </div>
              </div>

              <PolicyToggleCard
                icon={MoonStar}
                title="Enable Quiet Hours"
                subtitle="Müəyyən vaxt pəncərəsində cavablar dayansın."
                checked={quietHoursEnabled}
                disabled={!canManage}
                onChange={(v) => patchAi("quiet_hours_enabled", v)}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Quiet Hours Start"
                  hint="0–23 arası başlanğıc saatı."
                >
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    disabled={!canManage}
                    value={aiPolicy.quiet_hours?.startHour ?? 0}
                    onChange={(e) =>
                      patchAi("quiet_hours", {
                        ...(aiPolicy.quiet_hours || {}),
                        startHour: Math.max(
                          0,
                          Math.min(23, Number(e.target.value || 0))
                        ),
                      })
                    }
                  />
                </Field>

                <Field
                  label="Quiet Hours End"
                  hint="0–23 arası bitiş saatı."
                >
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    disabled={!canManage}
                    value={aiPolicy.quiet_hours?.endHour ?? 0}
                    onChange={(e) =>
                      patchAi("quiet_hours", {
                        ...(aiPolicy.quiet_hours || {}),
                        endHour: Math.max(
                          0,
                          Math.min(23, Number(e.target.value || 0))
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  <AlarmClock className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>

                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Draft Schedule
                  </div>
                  <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Hər tenant üçün avtomatik draft generation vaxtı və formatı.
                  </div>
                </div>
              </div>

              <PolicyToggleCard
                icon={AlarmClock}
                title="Enable Draft Schedule"
                subtitle="Müəyyən saatda draft avtomatik yaradılsın."
                checked={!!draftSchedule.enabled}
                disabled={!canManage}
                onChange={(v) => patchDraftSchedule("enabled", v)}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Hour" hint="0–23">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    disabled={!canManage}
                    value={draftSchedule.hour ?? 10}
                    onChange={(e) =>
                      patchDraftSchedule("hour", Number(e.target.value || 0))
                    }
                  />
                </Field>

                <Field label="Minute" hint="0–59">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    disabled={!canManage}
                    value={draftSchedule.minute ?? 0}
                    onChange={(e) =>
                      patchDraftSchedule("minute", Number(e.target.value || 0))
                    }
                  />
                </Field>

                <Field label="Timezone" hint="Primary execution timezone.">
                  <Input
                    value={draftSchedule.timezone || "Asia/Baku"}
                    disabled={!canManage}
                    onChange={(e) =>
                      patchDraftSchedule("timezone", e.target.value)
                    }
                  />
                </Field>

                <Field label="Format" hint="Generated content format.">
                  <Select
                    value={draftSchedule.format || "image"}
                    disabled={!canManage}
                    onChange={(e) => patchDraftSchedule("format", e.target.value)}
                  >
                    <option value="image">image</option>
                    <option value="carousel">carousel</option>
                    <option value="reel">reel</option>
                  </Select>
                </Field>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}