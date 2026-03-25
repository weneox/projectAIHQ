import { RadioTower, Sparkles } from "lucide-react";
import Surface from "./Surface.jsx";

export default function AnalyticsTopbar() {
  return (
    <Surface className="px-5 py-4 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/52">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300/80" />
            Executive analytics
          </div>
          <div className="mt-2 text-xl font-medium tracking-[-0.03em] text-white">
            Social media performance in one surface
          </div>
        </div>

        <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/62 md:self-auto">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10">
            <RadioTower className="h-4 w-4 text-emerald-300" />
          </span>
          <div>
            <div className="font-medium text-white/88">Live pulse active</div>
            <div className="text-xs text-white/42">
              Signals synced across selected channel
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}