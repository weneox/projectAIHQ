export default function AppBootSurface({
  label = "Preparing workspace",
  detail = "Checking your account and workspace.",
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-[520px] rounded-lg border border-line bg-surface p-8">
        <div className="relative">
          <div className="text-sm text-text-muted">
            {label}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-text-subtle" />
            <div className="h-px flex-1 bg-line" />
          </div>
          <p className="mt-6 max-w-[28rem] text-[15px] leading-7 text-text-muted">
            {detail}
          </p>

          <div className="mt-8 grid gap-3">
            <div className="h-12 animate-pulse rounded-md bg-surface-subtle" />
            <div className="flex gap-3">
              <div className="h-24 flex-1 animate-pulse rounded-md bg-surface-subtle" />
              <div className="h-24 w-[34%] animate-pulse rounded-md bg-surface-subtle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
