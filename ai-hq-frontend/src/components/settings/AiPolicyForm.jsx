import { Bot, Eye, Send, TimerReset, Zap } from "lucide-react";

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

function PolicyToggleRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}) {
  const Icon = icon;

  return (
    <div className="flex items-center gap-4 border-t border-slate-200/80 py-4 first:border-t-0 first:pt-0 dark:border-white/10">
      <div
        className={cx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200",
          checked
            ? "border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200"
            : "border-slate-200/80 bg-white/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
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
  );
}

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
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

function countEnabled(values = []) {
  return values.filter(Boolean).length;
}

export default function AiPolicyForm({
  aiPolicy = {},
  patchAi,
  canManage = true,
}) {
  const automationItems = [
    {
      key: "auto_reply_enabled",
      title: "Auto Reply",
      subtitle: "Allow AI to answer eligible Meta inbox conversations.",
      icon: Bot,
      checked: !!aiPolicy.auto_reply_enabled,
    },
    {
      key: "mark_seen_enabled",
      title: "Mark Seen",
      subtitle: "Send seen state after the system has processed the thread.",
      icon: Eye,
      checked: !!aiPolicy.mark_seen_enabled,
    },
    {
      key: "typing_indicator_enabled",
      title: "Typing Indicator",
      subtitle: "Show typing activity while an AI reply is being prepared.",
      icon: Zap,
      checked: !!aiPolicy.typing_indicator_enabled,
    },
    {
      key: "create_lead_enabled",
      title: "Lead Capture",
      subtitle: "Create follow-up leads from qualified conversations.",
      icon: Send,
      checked: !!aiPolicy.create_lead_enabled,
    },
  ];

  const safetyItems = [
    {
      key: "suppress_ai_during_handoff",
      title: "Pause During Handoff",
      subtitle: "Stop AI replies while a conversation or call is under human control.",
      icon: TimerReset,
      checked: !!aiPolicy.suppress_ai_during_handoff,
    },
  ];

  const quietHoursEnabled = !!aiPolicy.quiet_hours_enabled;
  const enabledTotal = countEnabled([
    ...automationItems.map((item) => item.checked),
    ...safetyItems.map((item) => item.checked),
    quietHoursEnabled,
  ]);

  return (
    <SettingsSection
      eyebrow="AI Policy"
      title="AI Policy"
      subtitle="Shape the live reply loop, handoff guardrails, and quiet hours."
      tone="default"
    >
      <div className="space-y-5">
        <div className="grid gap-3 rounded-[26px] border border-slate-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.03] md:grid-cols-3">
          <StatTile
            label="Automation"
            value={countEnabled(automationItems.map((item) => item.checked))}
            hint="Conversation rules"
            tone="info"
          />
          <StatTile
            label="Guardrails"
            value={countEnabled(safetyItems.map((item) => item.checked))}
            hint="Human protection"
            tone="warn"
          />
          <StatTile
            label="Quiet Hours"
            value={quietHoursEnabled ? "On" : "Off"}
            hint={quietHoursEnabled ? "Window active" : "No blackout"}
            tone={quietHoursEnabled ? "warn" : "neutral"}
          />
        </div>

        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.72))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="px-5 py-5 sm:px-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Reply behavior
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    The switches that shape live automation.
                  </div>
                </div>

                <Badge
                  tone={enabledTotal > 0 ? "success" : "neutral"}
                  variant="subtle"
                  dot={enabledTotal > 0}
                >
                  {enabledTotal} active
                </Badge>
              </div>

              <div>
                {automationItems.map((item) => (
                  <PolicyToggleRow
                    key={item.key}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    checked={item.checked}
                    disabled={!canManage}
                    onChange={(value) => patchAi(item.key, value)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 xl:border-l xl:border-t-0 sm:px-6">
              <div className="space-y-5">
                <div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Handoff and silence
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Keep automation from staying on when an operator should take over.
                  </div>
                </div>

                <div>
                  {safetyItems.map((item) => (
                    <PolicyToggleRow
                      key={item.key}
                      icon={item.icon}
                      title={item.title}
                      subtitle={item.subtitle}
                      checked={item.checked}
                      disabled={!canManage}
                      onChange={(value) => patchAi(item.key, value)}
                    />
                  ))}
                </div>

                <div className="border-t border-slate-200/80 pt-5 dark:border-white/10">
                  <PolicyToggleRow
                    icon={TimerReset}
                    title="Quiet Hours"
                    subtitle="Stop automated replies inside the configured time window."
                    checked={quietHoursEnabled}
                    disabled={!canManage}
                    onChange={(value) => patchAi("quiet_hours_enabled", value)}
                  />

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Start" hint="0-23">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        disabled={!canManage}
                        value={aiPolicy.quiet_hours?.startHour ?? 0}
                        onChange={(event) =>
                          patchAi("quiet_hours", {
                            ...(aiPolicy.quiet_hours || {}),
                            startHour: Math.max(
                              0,
                              Math.min(23, Number(event.target.value || 0))
                            ),
                          })
                        }
                      />
                    </Field>

                    <Field label="End" hint="0-23">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        disabled={!canManage}
                        value={aiPolicy.quiet_hours?.endHour ?? 0}
                        onChange={(event) =>
                          patchAi("quiet_hours", {
                            ...(aiPolicy.quiet_hours || {}),
                            endHour: Math.max(
                              0,
                              Math.min(23, Number(event.target.value || 0))
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
