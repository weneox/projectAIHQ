import Card from "../../../components/ui/Card.jsx";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import {
  EmptyState,
  StatTile,
  SyncStatusBadge,
} from "./trustSurfaceShared.jsx";

export default function SyncRunsModal({ open, source, items, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-white/10">
          <div className="space-y-1">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
              Source Sync Runs
            </div>
            <div className="text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              {source?.display_name || source?.source_url || source?.source_key || "Source"}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {!items.length ? (
            <EmptyState
              title="Sync run yoxdur"
              subtitle="Bu source üçün hələ heç bir sync işə düşməyib."
            />
          ) : (
            <div className="space-y-4">
              {items.map((run) => (
                <Card key={run.id} variant="surface" padded="md" className="rounded-[24px]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info" variant="subtle" dot>
                          {run.run_type}
                        </Badge>
                        <Badge tone="neutral" variant="subtle" dot>
                          {run.trigger_type}
                        </Badge>
                        <SyncStatusBadge status={run.status} />
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Started: {run.started_at || "—"} · Finished: {run.finished_at || "—"}
                      </div>
                    </div>

                    <div className="grid min-w-[320px] gap-3 sm:grid-cols-3">
                      <StatTile
                        label="Candidates"
                        value={run.candidates_created || 0}
                        hint="çıxarılan knowledge"
                        tone="info"
                      />
                      <StatTile
                        label="Promoted"
                        value={run.items_promoted || 0}
                        hint="approved/trusted"
                        tone="success"
                      />
                      <StatTile
                        label="Conflicts"
                        value={run.conflicts_found || 0}
                        hint="review tələb edir"
                        tone={run.conflicts_found > 0 ? "warn" : "neutral"}
                      />
                    </div>
                  </div>

                  {run.error_message ? (
                    <div className="mt-4 rounded-[18px] border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                      {run.error_message}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
