// ai-hq-frontend/src/components/truth/TruthFieldTable.jsx

function s(v, d = "") {
  return String(v ?? d).trim();
}

function isLong(value = "") {
  return s(value).length > 120;
}

export default function TruthFieldTable({ fields = [] }) {
  if (!Array.isArray(fields) || !fields.length) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white/82 px-5 py-5 text-sm leading-6 text-slate-500">
        No approved fields were returned by the backend.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88">
      <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)_280px]">
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Field
        </div>
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Approved value
        </div>
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Provenance
        </div>

        {fields.map((field) => (
          <div key={field.key} className="contents">
            <div className="border-b border-slate-200/70 px-5 py-4 text-sm font-semibold text-slate-700">
              {field.label}
            </div>

            <div
              className={[
                "border-b border-slate-200/70 px-5 py-4 text-sm text-slate-900",
                isLong(field.value) ? "leading-7" : "leading-6",
              ].join(" ")}
            >
              {s(field.value) || (
                <span className="text-slate-400">Not available</span>
              )}
            </div>

            <div className="border-b border-slate-200/70 px-5 py-4 text-sm leading-6 text-slate-500">
              {s(field.provenance) || "Not provided by backend"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}