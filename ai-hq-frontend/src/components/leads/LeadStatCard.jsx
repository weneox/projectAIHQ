import React from "react";

export default function LeadStatCard({ label, value, icon: Icon, tone = "neutral" }) {
  const toneMap = {
    neutral: "premium-stat",
    cyan: "premium-stat border-sky-200/90 bg-[linear-gradient(180deg,rgba(244,250,255,0.94),rgba(236,247,255,0.84))]",
    emerald: "premium-stat border-emerald-200/90 bg-[linear-gradient(180deg,rgba(244,252,247,0.94),rgba(236,248,240,0.84))]",
    violet: "premium-stat border-violet-200/90 bg-[linear-gradient(180deg,rgba(247,245,255,0.94),rgba(241,238,253,0.84))]",
  };

  return (
    <div
      className={`p-5 ${toneMap[tone] || toneMap.neutral}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            {label}
          </div>
          <div className="mt-3 text-[30px] font-semibold tracking-[-0.045em] text-slate-950">
            {value}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)]">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}
