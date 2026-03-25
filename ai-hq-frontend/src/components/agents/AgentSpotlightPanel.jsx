import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "./agent-utils.js";

export default function AgentSpotlightPanel({ agent }) {
  return (
    <motion.section
      key={agent.id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]"
    >
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-7">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{
            background: `linear-gradient(180deg, ${agent.accent.soft}, transparent)`,
          }}
        />

        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.26em] text-white/58">
            <Sparkles className="h-3.5 w-3.5" />
            Focused Agent Insight
          </div>

          <h3 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
            {agent.name} — {agent.role}
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/66 md:text-base">
            {agent.summary}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {agent.metrics.map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-white/8 bg-black/20 px-4 py-4"
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/42">
                  {item.label}
                </div>
                <div className={cn("mt-2 text-lg font-medium", agent.accent.text)}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/62">
            <ShieldCheck className="h-4 w-4" />
            System behavior
          </div>
          <p className="leading-7 text-white/72">{agent.systemPreview}</p>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/62">
            <CheckCircle2 className="h-4 w-4" />
            Signature strengths
          </div>

          <div className="flex flex-wrap gap-2.5">
            {agent.strengths.map((item) => (
              <span
                key={item}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-2 text-sm",
                  agent.accent.badge
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}