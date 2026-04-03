import { BellRing } from "lucide-react";

import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import { cx } from "../../../lib/cx.js";

function toneClassForChip(tone = "neutral") {
  if (tone === "success") {
    return "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  if (tone === "danger") {
    return "bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200";
  }

  if (tone === "warn") {
    return "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200";
  }

  return "bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200";
}

function RailStat({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
        {value}
      </div>
      <div
        className={cx(
          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
          toneClassForChip(tone)
        )}
      >
        {hint}
      </div>
    </div>
  );
}

export default function NotificationsSection({
  perm,
  pushBusy,
  pushMessage,
  env,
  enableNotifications,
}) {
  const permissionTone =
    perm === "granted" ? "success" : perm === "denied" ? "danger" : "warn";

  return (
    <SettingsSection
      eyebrow="Notifications"
      title="Operator Notifications"
      subtitle="Browser delivery for inbox, comments, and voice alerts."
      tone="default"
    >
      <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.72))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="px-5 py-5 sm:px-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Push Delivery
                  </Badge>
                  <Badge tone={permissionTone} variant="subtle" dot>
                    {perm}
                  </Badge>
                </div>

                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Browser permission state
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Turn on operator alerts in this browser.
                </div>
              </div>

              <div className="grid gap-3 rounded-[24px] border border-slate-200/80 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-3">
                <RailStat
                  label="Permission"
                  value={perm}
                  hint="Browser state"
                  tone={permissionTone}
                />
                <RailStat
                  label="VAPID"
                  value={env.VAPID ? "Configured" : "Missing"}
                  hint={env.VAPID ? `len=${env.VAPID.length}` : "Public key"}
                  tone={env.VAPID ? "success" : "danger"}
                />
                <RailStat
                  label="API Base"
                  value={env.API_BASE ? "Configured" : "Default"}
                  hint={env.API_BASE || "Default route"}
                  tone="info"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={enableNotifications}
                  disabled={pushBusy}
                  leftIcon={<BellRing className="h-4 w-4" />}
                >
                  {pushBusy ? "Enabling..." : "Enable Notifications"}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 px-5 py-5 dark:border-white/10 xl:border-l xl:border-t-0 sm:px-6">
            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                Last Action
              </div>
              <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                Push status
              </div>

              {pushMessage ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {pushMessage}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200/80 bg-white/60 px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  No notification action has been taken yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
