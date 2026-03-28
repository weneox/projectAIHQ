function s(v, d = "") {
  return String(v ?? d).trim();
}

function MetaRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}

export default function TruthHeader({ approval = {}, notices = [] }) {
  return (
    <div className="border-b border-slate-200/80 pb-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Governed Truth
      </div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[40px]">
        Business truth
      </h1>
      <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-slate-600">
        This is the current approved business twin and its governed execution context. Approval, provenance, runtime health, and repair posture are shown honestly when they are available and fail closed when they are not.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <MetaRow label="Approved at" value={approval?.approvedAt} />
        <MetaRow label="Approved by" value={approval?.approvedBy} />
        <MetaRow label="Version" value={approval?.version} />
      </div>

      {Array.isArray(notices) && notices.length ? (
        <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm leading-6 text-slate-600">
          {notices[0]}
        </div>
      ) : null}
    </div>
  );
}
