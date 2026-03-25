import AgentProfileCard from "./AgentProfileCard.jsx";

export default function AgentProfilesStrip({ agents, activeIndex, setActiveIndex }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">
            Agent profiles
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Compact identity strip
          </h3>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {agents.map((agent, index) => (
          <AgentProfileCard
            key={agent.id}
            agent={agent}
            active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}