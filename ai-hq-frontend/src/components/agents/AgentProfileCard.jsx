import {
  Activity,
  BrainCircuit,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "./agent-utils.js";

function flatIconForAgent(id) {
  if (id === "nova") return Sparkles;
  if (id === "atlas") return Target;
  if (id === "echo") return Activity;
  return BrainCircuit;
}

export default function AgentProfileCard({ agent, active, onClick }) {
  const Icon = flatIconForAgent(agent.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[28px] border p-5 text-left transition duration-300",
        active
          ? cn("border-white/14 bg-white/[0.06]", agent.accent.glow)
          : "border-white/8 bg-white/[0.025] hover:border-white/12 hover:bg-white/[0.04]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background: active
            ? `linear-gradient(180deg, ${agent.accent.soft}, transparent)`
            : "transparent",
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-2xl border",
              active ? agent.accent.badge : "border-white/10 bg-white/[0.04] text-white/70"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              active ? agent.accent.dot : "bg-white/22"
            )}
          />
        </div>

        <div className="mt-5">
          <h4 className="text-xl font-semibold tracking-[-0.03em] text-white">
            {agent.name}
          </h4>
          <p className="mt-1 text-sm text-white/55">{agent.role}</p>
          <p className="mt-4 text-sm leading-6 text-white/62">{agent.tagline}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {agent.strengths.slice(0, 3).map((item) => (
            <span
              key={item}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-xs",
                active ? agent.accent.badge : "border-white/10 bg-white/[0.03] text-white/58"
              )}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}