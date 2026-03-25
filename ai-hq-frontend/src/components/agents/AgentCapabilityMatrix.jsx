import { capabilityRows, cn } from "./agent-utils.js";

function ScoreDots({ value = 0, accent = "#67e8f9" }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const active = i < value;
        return (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: active ? accent : "rgba(255,255,255,0.12)",
              boxShadow: active ? `0 0 10px ${accent}44` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export default function AgentCapabilityMatrix({ agents, activeIndex }) {
  const rows = capabilityRows();

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-7">
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">
          Capability matrix
        </div>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
          Comparative agent strength map
        </h3>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[170px_repeat(4,minmax(0,1fr))] gap-3">
            <div />
            {agents.map((agent, index) => (
              <div
                key={agent.id}
                className={cn(
                  "rounded-[20px] border px-4 py-4 text-center",
                  index === activeIndex
                    ? "border-white/14 bg-white/[0.055]"
                    : "border-white/8 bg-white/[0.025]"
                )}
              >
                <div className="text-base font-medium text-white">{agent.name}</div>
                <div className="mt-1 text-xs text-white/48">{agent.role}</div>
              </div>
            ))}

            {rows.map((row) => (
              <div key={row.key} className="contents">
                <div className="flex items-center rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-4 text-sm text-white/62">
                  {row.label}
                </div>

                {agents.map((agent, index) => (
                  <div
                    key={`${row.key}-${agent.id}`}
                    className={cn(
                      "flex items-center justify-center rounded-[18px] border px-4 py-4",
                      index === activeIndex
                        ? "border-white/14 bg-white/[0.055]"
                        : "border-white/8 bg-white/[0.025]"
                    )}
                  >
                    <ScoreDots
                      value={agent.capabilities[row.key]}
                      accent={agent.accent.hex}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}