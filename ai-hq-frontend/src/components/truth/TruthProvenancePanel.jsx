export default function TruthProvenancePanel({ hasProvenance }) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Provenance
      </div>
      <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
        {hasProvenance ? "Field-level provenance is available" : "Field-level provenance is limited"}
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-600">
        {hasProvenance
          ? "Approved fields include source context where the backend exposed it."
          : "The backend did not return field-level provenance for this snapshot."}
      </div>
    </section>
  );
}
