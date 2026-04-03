export default function CommentStatCard({ label, value, icon: Icon, tone = "neutral" }) {
  const toneMap = {
    neutral: "border-line bg-surface",
    cyan: "border-line bg-brand-soft",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
  };

  return (
    <div className={`rounded-lg border p-5 ${toneMap[tone] || toneMap.neutral}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-text-muted">{label}</div>
          <div className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-text">{value}</div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-text-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
