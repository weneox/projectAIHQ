function Shimmer({ className = "" }) {
  return <div className={`lux-loading-shimmer ${className}`.trim()} />;
}

function SurfaceCard({ className = "", children }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[32px] border border-[#ece2d3] bg-[#fffdf9]/90 p-6 shadow-[0_18px_44px_rgba(120,102,73,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_0%_0%,rgba(229,211,180,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.3),transparent_26%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

export default function WorkspaceLoadingSurface() {
  return (
    <div
      aria-label="Preparing workspace brief"
      className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="space-y-8">
        <div className="space-y-3 px-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Preparing workspace
          </div>
          <Shimmer className="h-10 w-64 rounded-full bg-[#f1e8dc]" />
          <Shimmer className="h-4 w-[28rem] max-w-full rounded-full bg-[#f3ebdf]" />
        </div>

        <SurfaceCard>
          <div className="space-y-5">
            <div className="space-y-2">
              <Shimmer className="h-3 w-28 rounded-full bg-[#f1e8dc]" />
              <Shimmer className="h-8 w-56 rounded-full bg-[#f3ebdf]" />
              <Shimmer className="h-4 w-[34rem] max-w-full rounded-full bg-[#f4ede2]" />
            </div>

            <Shimmer className="h-14 rounded-[22px] bg-[#f3ebdf]" />

            <div className="flex flex-wrap gap-2">
              <Shimmer className="h-10 w-32 rounded-full bg-[#f1e8dc]" />
              <Shimmer className="h-10 w-28 rounded-full bg-[#f1e8dc]" />
              <Shimmer className="h-10 w-36 rounded-full bg-[#f1e8dc]" />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="space-y-5">
            <div className="space-y-2">
              <Shimmer className="h-3 w-24 rounded-full bg-[#f1e8dc]" />
              <Shimmer className="h-8 w-64 rounded-full bg-[#f3ebdf]" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[#efe6d7] bg-[#fffdfa]/94 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  <Shimmer className="h-3 w-24 rounded-full bg-[#f1e8dc]" />
                  <Shimmer className="mt-3 h-4 w-full rounded-full bg-[#f3ebdf]" />
                  <Shimmer className="mt-2 h-4 w-[82%] rounded-full bg-[#f4ede2]" />
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <SurfaceCard>
            <div className="space-y-4">
              <div className="space-y-2">
                <Shimmer className="h-3 w-32 rounded-full bg-[#f1e8dc]" />
                <Shimmer className="h-8 w-52 rounded-full bg-[#f3ebdf]" />
              </div>

              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[#efe6d7] bg-[#fffdfa]/94 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  <div className="flex flex-wrap gap-2">
                    <Shimmer className="h-7 w-20 rounded-full bg-[#f1e8dc]" />
                    <Shimmer className="h-7 w-24 rounded-full bg-[#f1e8dc]" />
                  </div>
                  <Shimmer className="mt-4 h-5 w-40 rounded-full bg-[#f3ebdf]" />
                  <Shimmer className="mt-3 h-4 w-full rounded-full bg-[#f4ede2]" />
                  <Shimmer className="mt-2 h-4 w-[72%] rounded-full bg-[#f4ede2]" />
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="space-y-4">
              <div className="space-y-2">
                <Shimmer className="h-3 w-28 rounded-full bg-[#f1e8dc]" />
                <Shimmer className="h-8 w-48 rounded-full bg-[#f3ebdf]" />
              </div>

              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-[#efe6d7] bg-[#fffdfa]/94 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  <Shimmer className="h-4 w-32 rounded-full bg-[#f3ebdf]" />
                  <Shimmer className="mt-3 h-4 w-full rounded-full bg-[#f4ede2]" />
                  <Shimmer className="mt-2 h-4 w-[68%] rounded-full bg-[#f4ede2]" />
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
