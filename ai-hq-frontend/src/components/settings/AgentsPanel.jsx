// src/components/settings/AgentsPanel.jsx
// PREMIUM v3.0 — editorial agents control surface

import { Bot, Cpu, Loader2, ShieldAlert, Sparkles } from "lucide-react";

import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
import AgentEditorCard from "./AgentEditorCard.jsx";

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" padded="md" tone={tone} className="rounded-[24px]">
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

export default function AgentsPanel({
  agents = [],
  loading = false,
  canManage = true,
  onSaveAgent,
}) {
  const enabledCount = agents.filter((x) => !!x?.enabled).length;
  const modelsCount = [...new Set(agents.map((x) => x?.model).filter(Boolean))].length;

  async function handleSave(agentKey, payload) {
    if (!canManage) return;
    await onSaveAgent(agentKey, payload);
  }

  return (
    <SettingsSection
      eyebrow="Agents"
      title="Agents"
      subtitle="Tenant-level agent konfiqi, model seçimi və enable / disable idarəsi burada saxlanılır."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Agent Layer
                  </Badge>
                  <Badge
                    tone={enabledCount > 0 ? "success" : "neutral"}
                    variant="subtle"
                    dot={enabledCount > 0}
                  >
                    {enabledCount} enabled
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    Tenant Agent Topology
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Agent identity, role summary, model routing və runtime enable
                    state bu hissədən idarə olunur.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <StatTile
                  label="Agents"
                  value={agents.length}
                  hint="Configured workers"
                  tone="info"
                />
                <StatTile
                  label="Enabled"
                  value={enabledCount}
                  hint="Active agents"
                  tone={enabledCount > 0 ? "success" : "neutral"}
                />
                <StatTile
                  label="Models"
                  value={modelsCount}
                  hint="Unique model configs"
                  tone="neutral"
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
                  Agent dəyişiklikləri yalnız icazəli istifadəçilər tərəfindən
                  saxlanmalıdır.
                </div>
              </div>

              {canManage ? (
                <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Owner/Admin icazəsi aktivdir. Agent dəyişiklikləri saxlanıla bilər.
                </div>
              ) : (
                <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  Read-only görünüşdür. Agent dəyişiklikləri yalnız owner/admin üçündür.
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
                  label="Enable Rate"
                  value={`${enabledCount}/${agents.length || 0}`}
                  hint="Enabled vs total"
                  tone="info"
                />
                <StatTile
                  label="Runtime"
                  value={agents.length ? "Configured" : "Empty"}
                  hint="Current agent surface"
                  tone={agents.length ? "neutral" : "warn"}
                />
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Agents yüklənir...
            </div>
          </Card>
        ) : agents.length === 0 ? (
          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                <Bot className="h-5 w-5" strokeWidth={1.9} />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Agent tapılmadı
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Bu tenant üçün hələ heç bir agent konfiqurasiyası mövcud deyil.
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5">
            {agents.map((agent) => (
              <AgentEditorCard
                key={agent?.id || agent?.agent_key}
                agent={agent}
                readOnly={!canManage}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}