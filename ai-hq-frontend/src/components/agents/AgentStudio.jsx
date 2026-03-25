import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CopyPlus, Sparkles } from "lucide-react";
import { cn } from "./agent-utils.js";

function sectionsForAgent(agentId) {
  if (agentId === "nova") {
    return ["Hook directions", "Content formats", "Weekly cadence", "CTA ideas"];
  }
  if (agentId === "atlas") {
    return ["Funnel map", "Message sequence", "Objection handling", "Conversion next step"];
  }
  if (agentId === "echo") {
    return ["Core KPIs", "Tracking setup", "Reporting cadence", "Decision triggers"];
  }
  return ["Current position", "Strategic options", "90-day actions", "Key risks"];
}

export default function AgentStudio({ agent }) {
  const [usecase, setUsecase] = useState(agent.usecases[0] || "");
  const [prompt, setPrompt] = useState(agent.samplePrompt || "");
  const [brief, setBrief] = useState({
    agentName: agent.name,
    usecase: agent.usecases[0] || "",
    prompt: agent.samplePrompt || "",
  });

  useEffect(() => {
    const nextUsecase = agent.usecases[0] || "";
    setUsecase(nextUsecase);
    setPrompt(agent.samplePrompt || "");
    setBrief({
      agentName: agent.name,
      usecase: nextUsecase,
      prompt: agent.samplePrompt || "",
    });
  }, [agent]);

  const previewSections = useMemo(() => sectionsForAgent(agent.id), [agent.id]);

  return (
    <section className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
      <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-7">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.26em] text-white/56">
            <Sparkles className="h-3.5 w-3.5" />
            Run with agent
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            Studio surface
          </h3>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/42">
                Active agent
              </label>
              <div
                className={cn(
                  "rounded-[18px] border px-4 py-3 text-sm",
                  agent.accent.badge
                )}
              >
                {agent.name} — {agent.role}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/42">
                Usecase
              </label>
              <select
                value={usecase}
                onChange={(e) => setUsecase(e.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/18"
              >
                {agent.usecases.map((item) => (
                  <option key={item} value={item} className="bg-[#08101c]">
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/42">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              className="w-full resize-none rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-white outline-none transition focus:border-white/18"
              placeholder="Mesajını yaz..."
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            {agent.usecases.slice(0, 4).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setPrompt(`Help me with ${item.toLowerCase()} for a premium AI HQ brand.`)
                }
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58 transition hover:border-white/16 hover:bg-white/[0.05] hover:text-white/80"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() =>
                setBrief({
                  agentName: agent.name,
                  usecase,
                  prompt,
                })
              }
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white px-4 py-3 text-sm font-medium text-black transition hover:scale-[1.01]"
            >
              <ArrowUpRight className="h-4 w-4" />
              Prepare brief
            </button>

            <button
              type="button"
              onClick={() => setPrompt(agent.samplePrompt || "")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/66 transition hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
            >
              <CopyPlus className="h-4 w-4" />
              Reset sample
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">
              Output preview
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              {brief.agentName} response surface
            </h3>
          </div>

          <div
            className={cn(
              "rounded-full border px-3 py-2 text-xs",
              agent.accent.badge
            )}
          >
            {brief.usecase || "General"}
          </div>
        </div>

        <div className="mt-5 rounded-[26px] border border-white/8 bg-black/20 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-white/38">
            Prompt snapshot
          </div>
          <p className="mt-3 text-sm leading-7 text-white/66">
            {brief.prompt || "No prompt prepared yet."}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {previewSections.map((item, idx) => (
            <div
              key={item}
              className="rounded-[22px] border border-white/8 bg-white/[0.025] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">
                  {String(idx + 1).padStart(2, "0")} · {item}
                </div>
                <div className={cn("h-2 w-2 rounded-full", agent.accent.dot)} />
              </div>

              <p className="mt-2 text-sm leading-6 text-white/54">
                {agent.name} burada {item.toLowerCase()} üçün daha strukturlaşdırılmış,
                premium və qısa çıxış quracaq.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}