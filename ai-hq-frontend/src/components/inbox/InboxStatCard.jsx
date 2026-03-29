export default function InboxStatCard({ label, value, icon: Icon, tone = "neutral" }) {
  const toneMap = {
    neutral:
      "border-[#ece2d3] bg-[#fffdfa] text-stone-900 shadow-[0_14px_36px_rgba(120,102,73,0.06)]",
    cyan:
      "border-[#dfe9ea] bg-[#f5fbfb] text-stone-900 shadow-[0_14px_36px_rgba(120,102,73,0.06)]",
    amber:
      "border-[#eadfca] bg-[#fdf8ef] text-stone-900 shadow-[0_14px_36px_rgba(120,102,73,0.06)]",
    emerald:
      "border-[#dde8df] bg-[#f5faf5] text-stone-900 shadow-[0_14px_36px_rgba(120,102,73,0.06)]",
  };

  return (
    <div
      className={`rounded-[24px] border p-5 ${toneMap[tone] || toneMap.neutral}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
            {label}
          </div>
          <div className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-stone-900">
            {value}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ece2d3] bg-white">
          <Icon className="h-4 w-4 text-stone-500" />
        </div>
      </div>
    </div>
  );
}
