export default function CommentMiniInfo({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">{label}</div>
      <div className="mt-2 flex items-center gap-2 text-sm text-white/76">
        {Icon ? <Icon className="h-4 w-4 text-white/42" /> : null}
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}