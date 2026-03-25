import { BellRing } from "lucide-react";

import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import { StatTile } from "./SectionPrimitives.jsx";

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
      title="Mobile Notifications"
      subtitle="Push subscription status və browser notification icazələri."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
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
                  Browser Permission State
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Real-time proposal və execution update-ləri üçün browser notification icazəsi.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="Permission"
                  value={perm}
                  hint="Browser notification state"
                  tone={permissionTone}
                />
                <StatTile
                  label="VAPID"
                  value={env.VAPID ? "Configured" : "Missing"}
                  hint={env.VAPID ? `len=${env.VAPID.length}` : "VITE_VAPID_PUBLIC_KEY"}
                  tone={env.VAPID ? "success" : "danger"}
                />
                <StatTile
                  label="API Base"
                  value={env.API_BASE ? "Configured" : "Default"}
                  hint={env.API_BASE || "Using default"}
                  tone="info"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={enableNotifications}
                  disabled={pushBusy}
                  leftIcon={<BellRing className="h-4 w-4" />}
                >
                  {pushBusy ? "Aktiv edilir..." : "Enable Notifications"}
                </Button>
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Delivery Notes
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Push Status
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Subscription, permission və environment readiness burada görünür.
                </div>
              </div>

              {pushMessage ? (
                <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {pushMessage}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200/80 bg-white/60 px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  Hələ push əməliyyatı yoxdur.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}
