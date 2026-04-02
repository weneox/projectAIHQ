export default function AppBootSurface({
  label = "Preparing workspace",
  detail = "Checking your account and workspace.",
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-6 py-10">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/88 p-8 shadow-[0_34px_90px_-52px_rgba(15,23,42,0.24)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_54%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_66%)]" />

        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {label}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-900/70 lux-loading-pulse" />
            <div className="h-[1px] flex-1 bg-slate-200" />
          </div>
          <p className="mt-6 max-w-[28rem] text-[15px] leading-7 text-slate-500">
            {detail}
          </p>

          <div className="mt-8 grid gap-3">
            <div className="lux-loading-shimmer h-14 rounded-[22px] bg-slate-100/90" />
            <div className="flex gap-3">
              <div className="lux-loading-shimmer h-24 flex-1 rounded-[24px] bg-slate-100/85" />
              <div className="lux-loading-shimmer h-24 w-[34%] rounded-[24px] bg-slate-100/75" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
