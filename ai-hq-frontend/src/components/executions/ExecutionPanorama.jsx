import { cn } from "./execution-ui.jsx";

const ORDER = ["all", "running", "queued", "completed", "failed"];

export default function ExecutionPanorama({ counts, filter, setFilter }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {ORDER.map((key) => {
        const active = filter === key;
        const count = counts[key] || 0;

        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "group relative overflow-hidden rounded-[28px] border px-4 py-4 text-left transition duration-300",
              "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
              active && "border-white/18 bg-white/[0.06] shadow-[0_18px_60px_rgba(0,0,0,0.24)]"
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(220px_circle_at_0%_0%,rgba(255,255,255,0.10),transparent_36%)] opacity-70" />

            <div className="relative">
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">
                {key}
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                {count}
              </div>
              <div className="mt-1 text-sm text-white/52">
                {key === "all"
                  ? "Visible universe"
                  : key === "running"
                  ? "Active now"
                  : key === "queued"
                  ? "Awaiting execution"
                  : key === "completed"
                  ? "Closed cleanly"
                  : "Incidents detected"}
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}