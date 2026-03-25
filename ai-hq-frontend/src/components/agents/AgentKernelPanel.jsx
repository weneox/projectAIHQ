import { BrainCircuit, Layers3, ShieldCheck, WandSparkles } from "lucide-react";

const FLOW = [
  "Global Policy",
  "Agent System",
  "Usecase Prompt",
  "User Message",
  "Responses API",
];

export default function AgentKernelPanel() {
  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">
            Kernel overview
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Agent kernel architecture
          </h3>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/58">
          <ShieldCheck className="h-4 w-4" />
          UTF repair + prompt layering
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/66">
            <Layers3 className="h-4 w-4" />
            Prompt assembly
          </div>

          <div className="flex flex-wrap gap-2">
            {FLOW.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/62"
              >
                {item}
              </span>
            ))}
          </div>

          <p className="mt-4 text-sm leading-7 text-white/56">
            Kernel build sistemi global policy, agent system və optional usecase prompt-u
            birləşdirib user message ilə Responses API-yə göndərir.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/66">
            <BrainCircuit className="h-4 w-4" />
            Runtime notes
          </div>

          <div className="grid gap-3">
            {[
              "Unknown agent hint fallbacks to Orion",
              "Model fallback is gpt-5 when config is empty",
              "max_output_tokens defaults to 800",
              "Extracts output_text and legacy choices fallback",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-white/58"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/20 p-5 md:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/66">
            <WandSparkles className="h-4 w-4" />
            Supported agent identities
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Orion", "Strategist"],
              ["Nova", "Content & Instagram"],
              ["Atlas", "Sales & WhatsApp"],
              ["Echo", "Analytics"],
            ].map(([name, role]) => (
              <div
                key={name}
                className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-4"
              >
                <div className="text-base font-medium text-white">{name}</div>
                <div className="mt-1 text-sm text-white/52">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}