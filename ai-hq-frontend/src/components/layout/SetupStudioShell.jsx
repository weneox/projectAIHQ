export default function SetupStudioShell({ children }) {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#eef3f8] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f8fbfd_0%,#eef3f8_44%,#e8eef5_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(165,180,252,0.18),transparent_22%),radial-gradient(circle_at_bottom_center,rgba(255,255,255,0.92),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:radial-gradient(circle_at_center,black,transparent_84%)]" />

      <div className="pointer-events-none absolute -left-16 top-8 h-[280px] w-[280px] rounded-full bg-cyan-200/35 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-[320px] w-[320px] rounded-full bg-indigo-200/30 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-1/2 h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-white/80 blur-[110px]" />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}