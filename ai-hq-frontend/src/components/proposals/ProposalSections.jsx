export function DetailSection({ title, children, right }) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.040),rgba(255,255,255,0.022))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
          {title}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div className="relative mt-4">{children}</div>
    </section>
  );
}

export function MetaRow({ k, v }) {
  const value = v || "—";

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="pt-[1px] text-[12px] text-white/34">{k}</span>

      <span
        className="max-w-[62%] truncate text-right text-[12px] font-medium text-white/78"
        title={String(value)}
      >
        {value}
      </span>
    </div>
  );
}