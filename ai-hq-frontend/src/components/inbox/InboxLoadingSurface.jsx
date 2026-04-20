import { StateSkeletonBlock } from "../ui/AppShellPrimitives.jsx";

function Shimmer({ className = "" }) {
  return <StateSkeletonBlock className={className} />;
}

function SkeletonCard({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-[22px] border border-[rgba(15,23,42,0.05)] bg-[rgba(255,255,255,0.84)] shadow-[0_24px_60px_-46px_rgba(15,23,42,0.14)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function InboxThreadListSkeleton() {
  return (
    <div
      aria-label="Loading conversations"
      className="px-3.5 py-3.5"
    >
      <div className="rounded-[24px] border border-[rgba(15,23,42,0.05)] bg-[rgba(255,255,255,0.68)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Shimmer className="h-5 w-32 rounded-[10px]" />
            <Shimmer className="mt-2 h-3.5 w-16 rounded-[10px] opacity-80" />
          </div>

          <div className="flex items-center gap-2">
            <Shimmer className="h-10 w-24 rounded-[12px]" />
            <Shimmer className="h-10 w-24 rounded-[12px]" />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Shimmer className="h-10 w-14 rounded-[12px]" />
          <Shimmer className="h-10 w-20 rounded-[12px]" />
          <Shimmer className="h-10 w-20 rounded-[12px]" />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[18px] px-3.5 py-3.5"
          >
            <div className="flex items-start gap-3">
              <Shimmer className="mt-0.5 h-11 w-11 rounded-full" />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Shimmer className="h-4.5 w-28 rounded-[10px]" />
                    <div className="mt-2 flex gap-2">
                      <Shimmer className="h-6 w-16 rounded-[10px]" />
                      <Shimmer className="h-4 w-20 rounded-[10px] opacity-75" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shimmer className="h-3.5 w-10 rounded-[10px] opacity-75" />
                    <Shimmer className="h-5 w-5 rounded-full" />
                  </div>
                </div>

                <Shimmer className="mt-3 h-3.5 w-full rounded-[10px] opacity-90" />
                <Shimmer className="mt-2 h-3.5 w-[72%] rounded-[10px] opacity-75" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InboxDetailSkeleton() {
  return (
    <div
      aria-label="Loading conversation detail"
      className="flex min-h-full flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]"
    >
      <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Shimmer className="h-14 w-14 rounded-full" />
            <div className="min-w-0">
              <Shimmer className="h-5 w-40 rounded-[10px]" />
              <div className="mt-2 flex gap-2">
                <Shimmer className="h-3.5 w-16 rounded-[10px] opacity-80" />
                <Shimmer className="h-3.5 w-24 rounded-[10px] opacity-70" />
                <Shimmer className="h-3.5 w-20 rounded-[10px] opacity-70" />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Shimmer className="h-10 w-32 rounded-[16px]" />
            <Shimmer className="h-10 w-20 rounded-[14px]" />
            <Shimmer className="h-10 w-28 rounded-[14px]" />
            <Shimmer className="h-10 w-10 rounded-[14px]" />
            <Shimmer className="h-10 w-10 rounded-[14px]" />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-6 py-6">
        <div className="mx-auto flex h-full w-full max-w-[920px] flex-col justify-end space-y-4">
          <div className="flex flex-col items-start">
            <Shimmer className="mb-2 h-3.5 w-24 rounded-[10px] opacity-70" />
            <SkeletonCard className="w-full max-w-[76%] px-5 py-4">
              <Shimmer className="h-4 w-[88%] rounded-[10px]" />
              <Shimmer className="mt-3 h-4 w-full rounded-[10px] opacity-90" />
              <Shimmer className="mt-3 h-4 w-[72%] rounded-[10px] opacity-75" />
            </SkeletonCard>
          </div>

          <div className="flex flex-col items-end">
            <Shimmer className="mb-2 h-3.5 w-24 rounded-[10px] opacity-70" />
            <div className="w-full max-w-[76%]">
              <SkeletonCard className="px-5 py-4">
                <Shimmer className="h-4 w-[82%] rounded-[10px]" />
                <Shimmer className="mt-3 h-4 w-full rounded-[10px] opacity-90" />
                <Shimmer className="mt-3 h-4 w-[64%] rounded-[10px] opacity-75" />
              </SkeletonCard>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <Shimmer className="mb-2 h-3.5 w-24 rounded-[10px] opacity-70" />
            <SkeletonCard className="w-full max-w-[62%] px-5 py-4">
              <Shimmer className="h-4 w-full rounded-[10px]" />
              <Shimmer className="mt-3 h-4 w-[68%] rounded-[10px] opacity-75" />
            </SkeletonCard>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 pb-6">
        <div className="mx-auto w-full max-w-[960px]">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Shimmer className="h-9 w-24 rounded-[12px]" />
              <Shimmer className="h-10 w-10 rounded-[12px]" />
              <Shimmer className="h-10 w-10 rounded-[12px]" />
            </div>

            <Shimmer className="h-9 w-28 rounded-[12px]" />
          </div>

          <div className="rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.84)] px-4 py-3 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.18)]">
            <div className="flex items-end gap-3">
              <Shimmer className="mb-1 h-10 w-10 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <Shimmer className="h-[60px] w-full rounded-[16px]" />
              </div>
              <Shimmer className="mb-1 h-12 w-24 rounded-[15px]" />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <Shimmer className="h-3.5 w-44 rounded-[10px] opacity-70" />
            <Shimmer className="h-3.5 w-32 rounded-[10px] opacity-70" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxLeadSkeleton() {
  return (
    <div
      aria-label="Loading conversation context"
      className="space-y-4 px-5 py-5"
    >
      <SkeletonCard className="px-5 py-5">
        <div className="flex items-start gap-4">
          <Shimmer className="h-16 w-16 rounded-full" />

          <div className="min-w-0 flex-1">
            <Shimmer className="h-5 w-36 rounded-[10px]" />
            <Shimmer className="mt-2 h-3.5 w-24 rounded-[10px] opacity-80" />

            <div className="mt-3 flex gap-2">
              <Shimmer className="h-7 w-20 rounded-[10px]" />
              <Shimmer className="h-7 w-16 rounded-[10px]" />
              <Shimmer className="h-7 w-24 rounded-[10px]" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <Shimmer className="h-[58px] rounded-[16px]" />
          <Shimmer className="h-[58px] rounded-[16px]" />
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <div className="border-b border-[rgba(15,23,42,0.05)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-4 rounded-full" />
            <Shimmer className="h-4 w-20 rounded-[10px]" />
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-3">
            <Shimmer className="h-[56px] rounded-[16px]" />
            <Shimmer className="h-[56px] rounded-[16px]" />
            <Shimmer className="h-[56px] rounded-[16px]" />
          </div>
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <div className="border-b border-[rgba(15,23,42,0.05)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-4 rounded-full" />
            <Shimmer className="h-4 w-28 rounded-[10px]" />
          </div>
        </div>

        <div className="px-5 py-4">
          <Shimmer className="h-24 rounded-[18px]" />
        </div>
      </SkeletonCard>
    </div>
  );
}