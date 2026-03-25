export default function CommentStatCard({ label, value, icon: Icon, tone = "neutral" }) {
  const toneMap = {
    neutral:
      "border-white/10 bg-white/[0.03] text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.06] text-white shadow-[0_18px_40px_rgba(34,211,238,0.08)]",
    emerald:
      "border-emerald-300/20 bg-emerald-300/[0.06] text-white shadow-[0_18px_40px_rgba(16,185,129,0.08)]",
    amber:
      "border-amber-300/20 bg-amber-300/[0.06] text-white shadow-[0_18px_40px_rgba(245,158,11,0.08)]",
  };

  return (
    <div className={`rounded-[24px] border p-5 backdrop-blur-xl ${toneMap[tone] || toneMap.neutral}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</div>
          <div className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-white">{value}</div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-white/72" />
        </div>
      </div>
    </div>
  );
}