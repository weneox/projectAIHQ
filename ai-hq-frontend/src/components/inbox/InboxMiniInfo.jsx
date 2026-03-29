export default function InboxMiniInfo({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#ece2d3] bg-[#fffdfa] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-stone-700">
        {Icon ? <Icon className="h-4 w-4 text-stone-400" /> : null}
        <span className="truncate">{value || "—"}</span>
      </div>
    </div>
  );
}
