import { ArrowRight, Boxes, Clock3, Sparkles } from "lucide-react";
import {
  displayValue,
  durationBetween,
  formatRelative,
  shortId,
  statusMeta,
} from "./execution-ui.jsx";

export default function ExecutionHero({ execution, onOpen }) {
  if (!execution) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm text-white/58">
          No active live run right now. The observatory is standing by.
        </div>
      </section>
    );
  }

  const meta = statusMeta(execution.status);

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_circle_at_0%_0%,rgba(56,189,248,0.16),transparent_34%),radial-gradient(420px_circle_at_100%_0%,rgba(139,92,246,0.10),transparent_38%)]" />

      <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/[0.08] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-100/74">
            <Sparkles className="h-3.5 w-3.5" />
            Featured live run
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.06]">
              <div className={`h-3.5 w-3.5 rounded-full ${meta.dot}`} />
            </div>

            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-white">
                {displayValue(execution.type, "job")}
              </h2>
              <div className="mt-1 text-sm text-white/52">
                {shortId(execution.id)} · started {formatRelative(execution.created_at)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Runtime"
              value={durationBetween(execution.created_at, execution.finished_at)}
            />
            <MetricCard
              label="Proposal"
              value={displayValue(execution.proposal_id)}
            />
            <MetricCard
              label="Status"
              value={meta.label}
            />
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[#07111f]/70 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/44">
            <Boxes className="h-4 w-4" />
            Command focus
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm text-white/56">Current surface</div>
              <div className="mt-2 text-base font-medium text-white">
                {displayValue(
                  execution.output?.current_step ?? execution.output?.stage,
                  "Processing"
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm text-white/56">
                <Clock3 className="h-4 w-4" />
                Active duration
              </div>
              <div className="mt-2 text-base font-medium text-white">
                {durationBetween(execution.created_at, execution.finished_at)}
              </div>
            </div>

            <button
              onClick={() => onOpen(execution.id)}
              className="inline-flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              Open inspector
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white break-words">
        {value || "—"}
      </div>
    </div>
  );
}