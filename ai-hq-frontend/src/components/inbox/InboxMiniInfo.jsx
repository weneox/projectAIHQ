export default function InboxMiniInfo({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-200">
        {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
        <span className="truncate">{value || "--"}</span>
      </div>
    </div>
  );
}
