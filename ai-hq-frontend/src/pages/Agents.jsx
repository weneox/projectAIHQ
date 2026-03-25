import { useState } from "react";
import { FlaskConical } from "lucide-react";
import AgentCarouselStage from "../components/agents/AgentCarouselStage.jsx";
import AgentSpotlightPanel from "../components/agents/AgentSpotlightPanel.jsx";
import AgentProfilesStrip from "../components/agents/AgentProfilesStrip.jsx";
import AgentStudio from "../components/agents/AgentStudio.jsx";
import AgentKernelPanel from "../components/agents/AgentKernelPanel.jsx";
import AgentCapabilityMatrix from "../components/agents/AgentCapabilityMatrix.jsx";
import { AGENTS } from "../components/agents/agent-data.js";

function InternalDemoBanner() {
  return (
    <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-50/90">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-amber-200/20 bg-amber-200/10 p-2">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/70">
            Internal demo route
          </div>
          <p className="mt-2 max-w-3xl leading-6 text-amber-50/88">
            Agents is not part of the default product navigation. This page remains reachable for
            internal/demo use and is still driven by static agent fixture data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeAgent = AGENTS[activeIndex];

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#03060d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-28 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ background: activeAgent.accent.soft }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_30%),linear-gradient(180deg,#040813_0%,#03060d_100%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pb-16 pt-4 md:px-6 lg:px-8">
        <InternalDemoBanner />
        <AgentCarouselStage
          agents={AGENTS}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />

        <AgentSpotlightPanel agent={activeAgent} />

        <AgentProfilesStrip
          agents={AGENTS}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />

        <AgentStudio agent={activeAgent} />

        <section className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
          <AgentKernelPanel />
          <AgentCapabilityMatrix agents={AGENTS} activeIndex={activeIndex} />
        </section>
      </div>
    </div>
  );
}
