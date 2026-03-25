import { AlertTriangle, ChevronRight, Clock3, TerminalSquare } from "lucide-react";
import {
  cn,
  displayValue,
  durationBetween,
  formatRelative,
  shortId,
  statusMeta,
} from "./execution-ui.jsx";

export default function ExecutionRiver({ items, selectedId, onOpen }) {
  if (!items.length) {
    return (
      <div className="rounded-[30px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/56">
        No executions match this surface.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => {
        const meta = statusMeta(item.status);
        const active = String(selectedId) === String(item.id);

        return (
          <button
            key={item.id}
            onClick={() => onOpen(item.id)}
            className={cn(
              "group relative overflow-hidden rounded-[30px] border bg-[#07101d]/70 p-5 text-left transition duration-300",
              "border-white/10 hover:-translate-y-0.5 hover:bg-[#0a1524]/80",
              meta.cardGlow,
              meta.border,
              active && "shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80",
                meta.ring
              )}
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        meta.badge
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.04em] text-white break-words">
                    {displayValue(item.type, "job")}
                  </h3>

                  <div className="mt-1 text-sm text-white/48 break-words">
                    {shortId(item.id)}
                    {item.proposal_id ? ` · ${displayValue(item.proposal_id, "")}` : ""}
                  </div>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-white/60 transition group-hover:text-white/90">
                  <ChevronRight className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Started
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/86">
                    {formatRelative(item.created_at)}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Runtime
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/86">
                    {durationBetween(item.created_at, item.finished_at)}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Signal
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/86 break-words">
                    {item.output?.progress != null
                      ? `${item.output.progress}%`
                      : displayValue(item.output?.result ?? item.output?.stage, "Operational")}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/38">
                    <TerminalSquare className="h-4 w-4" />
                    Surface preview
                  </div>
                  <div className="mt-3 text-sm text-white/68 break-words">
                    {displayValue(
                      item.output?.current_step ?? item.output?.stage ?? item.error,
                      "Execution payload is available in inspector."
                    )}
                  </div>
                </div>

                {item.error ? (
                  <div className="rounded-[22px] border border-rose-400/14 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-100/88">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Incident
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/58">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      Stable
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}