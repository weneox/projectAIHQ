import { TrendingUp } from "lucide-react";
import Surface from "./Surface.jsx";

export default function InsightCard({ platform }) {
  return (
    <Surface className="px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-medium tracking-[-0.03em] text-white">
            Strategic signals
          </div>
          <div className="mt-1 text-sm text-white/42">
            Fast reading of what matters on the selected channel
          </div>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 text-white/65">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Primary pull
          </div>
          <div className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white">
            {platform.key === "youtube" ? "Retention" : platform.key === "linkedin" ? "Lead quality" : "Reach"}
          </div>
        </div>

        <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Traffic bias
          </div>
          <div className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white">
            {platform.key === "web" ? "Direct" : platform.key === "x" ? "Reactive" : "Compounding"}
          </div>
        </div>

        <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Best cadence
          </div>
          <div className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white">
            {platform.key === "youtube" ? "2x / week" : platform.key === "linkedin" ? "4x / week" : "Daily"}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {platform.insights.map((item, index) => (
          <div
            key={item}
            className="rounded-[22px] bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/68 ring-1 ring-white/8"
          >
            <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/38">
              Signal {index + 1}
            </div>
            {item}
          </div>
        ))}
      </div>
    </Surface>
  );
}