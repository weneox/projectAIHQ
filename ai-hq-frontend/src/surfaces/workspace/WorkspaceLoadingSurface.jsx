function Shimmer({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-surface-subtle ${className}`.trim()} />;
}

function SurfaceCard({ className = "", children }) {
  return (
    <div
      className={[
        "rounded-lg border border-line bg-surface px-4 py-4",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export default function WorkspaceLoadingSurface() {
  return (
    <div
      aria-label="Preparing workspace brief"
      className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="space-y-6">
        <div className="space-y-2 px-1">
          <div className="text-sm text-text-muted">Preparing workspace</div>
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-[34rem] max-w-full" />
        </div>

        <SurfaceCard>
          <div className="space-y-4">
            <div className="space-y-2">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-7 w-72 max-w-full" />
              <Shimmer className="h-4 w-[30rem] max-w-full" />
            </div>

            <Shimmer className="h-10 rounded-md" />

            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-[78%]" />
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="space-y-3">
            <div className="space-y-2">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-7 w-64 max-w-full" />
            </div>

            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="space-y-2 rounded-md border border-line-soft bg-surface-muted p-4"
              >
                <Shimmer className="h-6 w-24" />
                <Shimmer className="h-5 w-64 max-w-full" />
                <Shimmer className="h-4 w-full" />
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SurfaceCard>
            <div className="space-y-3">
              <div className="space-y-2">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-7 w-48" />
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-md border border-line-soft bg-surface-muted p-4"
                >
                  <div className="flex gap-2">
                    <Shimmer className="h-6 w-20" />
                    <Shimmer className="h-6 w-16" />
                  </div>
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-[74%]" />
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="space-y-3">
              <div className="space-y-2">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-7 w-48" />
              </div>
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-md border border-line-soft bg-surface-muted p-4"
                >
                  <Shimmer className="h-6 w-20" />
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-[68%]" />
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
