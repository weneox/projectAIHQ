import Badge from "../../../components/ui/Badge.jsx";
import Card from "../../../components/ui/Card.jsx";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import {
  FeatureToggleCard,
  Field,
  Input,
  Select,
  StatTile,
} from "./SectionPrimitives.jsx";
import {
  normalizeAutomationMode,
  normalizeTimeString,
} from "../settingsShared.js";

export default function AutoContentSection({ aiPolicy, patchAi, canManage }) {
  const publishPolicy =
    aiPolicy && typeof aiPolicy.publish_policy === "object" && !Array.isArray(aiPolicy.publish_policy)
      ? aiPolicy.publish_policy
      : {};

  const schedule =
    publishPolicy && typeof publishPolicy.schedule === "object" && !Array.isArray(publishPolicy.schedule)
      ? publishPolicy.schedule
      : { enabled: false, time: "10:00", timezone: "Asia/Baku" };

  const automation =
    publishPolicy && typeof publishPolicy.automation === "object" && !Array.isArray(publishPolicy.automation)
      ? publishPolicy.automation
      : { enabled: false, mode: "manual" };

  function patchPublishPolicy(next) {
    if (!canManage) return;

    patchAi("publish_policy", {
      ...publishPolicy,
      ...next,
      schedule: {
        ...(publishPolicy.schedule || {}),
        ...(next.schedule || {}),
      },
      automation: {
        ...(publishPolicy.automation || {}),
        ...(next.automation || {}),
      },
    });
  }

  const fullAuto = !!automation.enabled || automation.mode === "full_auto";

  return (
    <SettingsSection
      eyebrow="Automation"
      title="Auto Content"
      subtitle="Daily scheduled draft creation və istəyə görə tam avtomatik publish davranışı."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Content Scheduler
                  </Badge>
                  <Badge
                    tone={schedule.enabled ? "success" : "neutral"}
                    variant="subtle"
                    dot={schedule.enabled}
                  >
                    {schedule.enabled ? "Scheduled" : "Disabled"}
                  </Badge>
                </div>

                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Scheduled Draft Flow
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Hər gün müəyyən vaxtda content flow başlasın və draft yaradılsın.
                </div>
              </div>

              <FeatureToggleCard
                title="Scheduled Content"
                subtitle="Cron vaxtında content flow avtomatik başlasın."
                checked={!!schedule.enabled}
                onChange={(checked) =>
                  patchPublishPolicy({
                    schedule: {
                      ...schedule,
                      enabled: !!checked,
                    },
                  })
                }
                disabled={!canManage}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Run Time" hint="HH:MM formatında gündəlik işə düşmə vaxtı.">
                  <Input
                    type="time"
                    value={normalizeTimeString(schedule.time, "10:00")}
                    disabled={!canManage}
                    onChange={(e) =>
                      patchPublishPolicy({
                        schedule: {
                          ...schedule,
                          time: normalizeTimeString(e.target.value, "10:00"),
                        },
                      })
                    }
                  />
                </Field>

                <Field label="Timezone" hint="Execution üçün əsas timezone.">
                  <Input
                    type="text"
                    value={schedule.timezone || "Asia/Baku"}
                    disabled={!canManage}
                    onChange={(e) =>
                      patchPublishPolicy({
                        schedule: {
                          ...schedule,
                          timezone:
                            String(e.target.value || "Asia/Baku").trim() || "Asia/Baku",
                        },
                      })
                    }
                    placeholder="Asia/Baku"
                  />
                </Field>

                <StatTile
                  label="Next Mode"
                  value={schedule.enabled ? "Active" : "Idle"}
                  hint="Scheduler runtime state"
                  tone={schedule.enabled ? "success" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge
                    tone={fullAuto ? "warn" : "neutral"}
                    variant="subtle"
                    dot={fullAuto}
                  >
                    {fullAuto ? "Full Auto" : "Manual Gate"}
                  </Badge>
                </div>

                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Publish Automation
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Draft approval olmadan asset və publish mərhələsinə keçid davranışı.
                </div>
              </div>

              <FeatureToggleCard
                title="Full Auto Publish"
                subtitle="Risklidir. Manual təsdiq olmadan publish mərhələsinə keçə bilər."
                checked={fullAuto}
                onChange={(checked) =>
                  patchPublishPolicy({
                    automation: {
                      enabled: !!checked,
                      mode: checked ? "full_auto" : "manual",
                    },
                  })
                }
                disabled={!canManage}
              />

              <Field label="Publish Mode" hint="Manual approval və ya tam avtomatik rejim.">
                <Select
                  value={normalizeAutomationMode(automation.mode, "manual")}
                  disabled={!canManage}
                  onChange={(e) => {
                    const mode = normalizeAutomationMode(e.target.value, "manual");
                    patchPublishPolicy({
                      automation: {
                        enabled: mode === "full_auto",
                        mode,
                      },
                    });
                  }}
                >
                  <option value="manual">Manual approval</option>
                  <option value="full_auto">Full auto publish</option>
                </Select>
              </Field>

              <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                Full auto publish aktiv olanda sistem cron vaxtında draft yarada,
                asset/video generasiya edə və publish mərhələsinə manual təsdiq olmadan
                keçə bilər.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}
