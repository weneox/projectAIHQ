import { ArrowUpRight, Sparkles } from "lucide-react";
import Surface from "./Surface.jsx";
import PlatformSwitch from "./PlatformSwitch.jsx";
import RangeSwitch from "./RangeSwitch.jsx";
import { RANGE_OPTIONS } from "./analytics-data.js";
import { cn } from "./analytics-utils.js";

export default function AnalyticsHero({
  platform,
  activeRange,
  heroValue,
  onPlatformChange,
  onRangeChange,
}) {
  return (
    <Surface className="px-5 py-6 md:px-6 md:py-7">
      <div className={cn("pointer-events-none absolute inset-0 opacity-100", platform.heroGlow)} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(55%_70%_at_50%_0%,rgba(95,83,255,0.12),transparent_74%)]" />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-[780px]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.035] px-3 py-1.5 ring-1 ring-white/10 text-[11px] uppercase tracking-[0.26em] text-white/48">
            <Sparkles className="h-3.5 w-3.5" />
            Executive social analytics
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-4 md:gap-6">
            <div>
              <div className="text-[clamp(2.6rem,4vw,4.8rem)] font-semibold leading-none tracking-[-0.07em] text-white">
                {heroValue}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/46">
                <span>{platform.headline}</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span>{platform.handle}</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span>{RANGE_OPTIONS.find((item) => item.key === activeRange)?.label} window</span>
              </div>
            </div>

            <div className="rounded-[24px] bg-white/[0.035] px-4 py-4 ring-1 ring-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
              <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/65">
                Current momentum
              </div>
              <div className="mt-1 flex items-center gap-2 text-[34px] font-semibold tracking-[-0.05em] text-white">
                {platform.momentum}
                <ArrowUpRight className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <PlatformSwitch active={platform.key} onChange={onPlatformChange} />
          </div>
        </div>

        <RangeSwitch active={activeRange} onChange={onRangeChange} />
      </div>
    </Surface>
  );
}