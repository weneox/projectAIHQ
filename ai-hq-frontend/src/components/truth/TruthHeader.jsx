// ai-hq-frontend/src/components/truth/TruthHeader.jsx

function s(v, d = "") {
  return String(v ?? d).trim();
}

function MetaRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div className="rounded-[16px] border border-slate-200/80 bg-white/82 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-800">{value}</div>
    </div>
  );
}

export default function TruthHeader({ approval = {}, notices = [] }) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.88)_100%)] px-6 py-6 sm:px-7 sm:py-7">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Business data
      </div>

      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[40px]">
            Approved business data
          </h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-slate-600">
            Current approved business profile, shown in a cleaner operator view.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetaRow label="Approved at" value={approval?.approvedAt} />
        <MetaRow label="Approved by" value={approval?.approvedBy} />
        <MetaRow label="Version" value={approval?.version} />
      </div>

      {Array.isArray(notices) && notices.length ? (
        <div className="mt-5 rounded-[16px] border border-slate-200/80 bg-white/76 px-4 py-3 text-sm leading-6 text-slate-600">
          {notices[0]}
        </div>
      ) : null}
    </div>
  );
}