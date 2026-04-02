function s(v, d = "") {
  return String(v ?? d).trim();
}

export default function TruthFieldTable({ fields = [] }) {
  if (!Array.isArray(fields) || !fields.length) {
    return (
      <div className="border-l-2 border-slate-200 px-5 py-5 text-sm leading-6 text-slate-500">
        No approved fields were returned by the backend.
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-t border-slate-200/80 bg-transparent">
      <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="border-b border-slate-200/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Field
        </div>
        <div className="border-b border-slate-200/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Approved value
        </div>
        <div className="border-b border-slate-200/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Provenance
        </div>

        {fields.map((field) => (
          <div key={field.key} className="contents">
            <div className="border-b border-slate-200/70 px-5 py-4 text-sm font-medium text-slate-700">
              {field.label}
            </div>
            <div className="border-b border-slate-200/70 px-5 py-4 text-sm leading-7 text-slate-900">
              {s(field.value) || <span className="text-slate-400">Not available</span>}
            </div>
            <div className="border-b border-slate-200/70 px-5 py-4 text-sm leading-7 text-slate-500">
              {s(field.provenance) || "Not provided by backend"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
