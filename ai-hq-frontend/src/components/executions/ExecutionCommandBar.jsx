import { Clock3, RefreshCcw, Sparkles } from "lucide-react";

export default function ExecutionCommandBar({
  total = 0,
  running = 0,
  failed = 0,
  lastUpdated = "",
  loading = false,
  onRefresh,
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] px-5 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_circle_at_0%_0%,rgba(56,189,248,0.12),transparent_34%),radial-gradient(340px_circle_at_100%_0%,rgba(168,85,247,0.10),transparent_36%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-white/52">
            <Sparkles className="h-3.5 w-3.5" />
            Runtime / Operations
          </div>

          <div className="mt-4">
            <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-white sm:text-[38px]">
              Execution Observatory
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/58">
              Live operational surface for generation, rendering, sync, and publishing flows.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/42">Total</div>
            <div className="mt-1 text-lg font-semibold text-white">{total}</div>
          </div>

          <div className="rounded-2xl border border-cyan-400/14 bg-cyan-400/[0.06] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/55">Running</div>
            <div className="mt-1 text-lg font-semibold text-cyan-50">{running}</div>
          </div>

          <div className="rounded-2xl border border-rose-400/14 bg-rose-400/[0.06] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-rose-100/55">Failed</div>
            <div className="mt-1 text-lg font-semibold text-rose-50">{failed}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/42">
              <Clock3 className="h-3.5 w-3.5" />
              Last update
            </div>
            <div className="mt-1 text-sm font-medium text-white/86">{lastUpdated || "—"}</div>
          </div>

          <button
            onClick={onRefresh}
            className="inline-flex h-[52px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white/88 transition hover:bg-white/[0.08]"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <div className="inline-flex h-[52px] items-center gap-2 rounded-2xl border border-emerald-400/16 bg-emerald-400/[0.07] px-4 text-sm font-medium text-emerald-100">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            Live surface
          </div>
        </div>
      </div>
    </section>
  );
}