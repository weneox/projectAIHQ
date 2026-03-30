export default function InboxMiniInfo({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
        {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
        <span className="truncate">{value || "--"}</span>
      </div>
    </div>
  );
}
