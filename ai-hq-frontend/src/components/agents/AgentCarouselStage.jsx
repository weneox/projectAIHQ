// src/components/agents/AgentCarouselStage.jsx
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AgentIcon3D from "./AgentIcon3D.jsx";
import { cn, relativeIndex, wrapIndex } from "./agent-utils.js";

const DRAG_THRESHOLD = 70;

function SidePreview({ agent }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.025] p-4 text-left backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-14"
        style={{
          background: `linear-gradient(180deg, ${agent.accent.soft}, transparent)`,
        }}
      />

      <div className="relative flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 opacity-65">
          <AgentIcon3D
            variant={agent.iconVariant}
            accent={agent.accent.hex}
            className="h-full w-full"
          />
        </div>

        <div className="min-w-0">
          <div
            className={cn(
              "mb-1 inline-flex items-center rounded-full border px-2 py-1 text-[8px] uppercase tracking-[0.24em]",
              agent.accent.badge
            )}
          >
            {agent.role}
          </div>

          <div className="truncate text-[28px] font-semibold leading-none tracking-[-0.05em] text-white">
            {agent.name}
          </div>

          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/40">
            {agent.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}

function CenterStage({ agent }) {
  return (
    <div className="relative mx-auto flex w-full max-w-[920px] flex-col items-center justify-center px-6 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-[48%] h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] md:h-[22rem] md:w-[22rem]"
        style={{ background: agent.accent.soft }}
      />

      <div className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 opacity-[0.18]">
        <div className="h-[140px] w-[140px] md:h-[220px] md:w-[220px]">
          <AgentIcon3D
            variant={agent.iconVariant}
            accent={agent.accent.hex}
            className="h-full w-full"
          />
        </div>
      </div>

      <div
        className={cn(
          "relative inline-flex items-center rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.32em]",
          agent.accent.badge
        )}
      >
        {agent.role}
      </div>

      <h2 className="relative mt-5 text-[clamp(64px,11vw,154px)] font-semibold leading-[0.88] tracking-[-0.09em] text-white">
        {agent.name}
      </h2>

      <p className="relative mt-5 max-w-[820px] text-sm leading-7 text-white/66 md:text-[22px] md:leading-9">
        {agent.tagline}
      </p>

      <div
        className="pointer-events-none absolute left-1/2 top-[66%] h-16 w-[22rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: agent.accent.soft, opacity: 0.2 }}
      />
    </div>
  );
}

function slotStyle(slot) {
  if (slot === 0) {
    return {
      left: "50%",
      top: "47%",
      scale: 1,
      opacity: 1,
      zIndex: 30,
      width: "min(68vw, 920px)",
      filter: "blur(0px)",
      pointerEvents: "auto",
    };
  }

  if (slot === -1) {
    return {
      left: "21%",
      top: "56%",
      scale: 0.78,
      opacity: 0.32,
      zIndex: 12,
      width: 240,
      filter: "blur(1px)",
      pointerEvents: "auto",
    };
  }

  if (slot === 1) {
    return {
      left: "79%",
      top: "56%",
      scale: 0.78,
      opacity: 0.32,
      zIndex: 12,
      width: 240,
      filter: "blur(1px)",
      pointerEvents: "auto",
    };
  }

  if (slot <= -2) {
    return {
      left: "10%",
      top: "58%",
      scale: 0.66,
      opacity: 0,
      zIndex: 1,
      width: 220,
      filter: "blur(3px)",
      pointerEvents: "none",
    };
  }

  return {
    left: "90%",
    top: "58%",
    scale: 0.66,
    opacity: 0,
    zIndex: 1,
    width: 220,
    filter: "blur(3px)",
    pointerEvents: "none",
  };
}

export default function AgentCarouselStage({ agents, activeIndex, setActiveIndex }) {
  const activeAgent = agents[activeIndex];

  function goPrev() {
    setActiveIndex((prev) => wrapIndex(prev - 1, agents.length));
  }

  function goNext() {
    setActiveIndex((prev) => wrapIndex(prev + 1, agents.length));
  }

  return (
    <section className="relative overflow-hidden rounded-[42px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-[46%] h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] md:h-[28rem] md:w-[28rem]"
          style={{ background: activeAgent.accent.soft }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.014)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:88px_88px] opacity-[0.03]" />
      </div>

      <div className="relative min-h-[78svh] px-4 py-4 md:px-8 md:py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.34em] text-white/72">
            AI HQ · Agents
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-white/52 md:inline-flex">
              {String(activeIndex + 1).padStart(2, "0")} / {String(agents.length).padStart(2, "0")}
            </div>

            <button
              type="button"
              onClick={goPrev}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/78 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/78 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.08}
          onDragEnd={(_, info) => {
            if (info.offset.x <= -DRAG_THRESHOLD) goNext();
            if (info.offset.x >= DRAG_THRESHOLD) goPrev();
          }}
          className="relative mt-6 flex min-h-[60svh] cursor-grab items-center justify-center active:cursor-grabbing"
        >
          {agents.map((agent, index) => {
            const rel = relativeIndex(index, activeIndex, agents.length);
            if (Math.abs(rel) > 1) return null;

            const view = slotStyle(rel);
            const isCenter = rel === 0;

            return (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                initial={false}
                animate={{
                  left: view.left,
                  top: view.top,
                  scale: view.scale,
                  opacity: view.opacity,
                  filter: view.filter,
                }}
                transition={{
                  type: "spring",
                  stiffness: 105,
                  damping: 20,
                  mass: 0.9,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-left"
                style={{
                  width: view.width,
                  zIndex: view.zIndex,
                  pointerEvents: view.pointerEvents,
                }}
              >
                {isCenter ? <CenterStage agent={agent} /> : <SidePreview agent={agent} />}
              </motion.button>
            );
          })}
        </motion.div>

        <div className="relative mt-10 flex flex-col items-center gap-4 pb-4">
          <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs text-white/46">
            Soldan sağa sürüşdür, arxadakı agent mərkəzə gəlsin
          </div>

          <div className="flex items-center gap-2">
            {agents.map((agent, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300",
                    active ? "w-10 bg-white" : "w-2.5 bg-white/22 hover:bg-white/36"
                  )}
                  aria-label={agent.name}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}