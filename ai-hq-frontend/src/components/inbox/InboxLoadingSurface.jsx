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
      aria-label="Loading conversation messages"
      className="flex min-h-full flex-col justify-end px-4 pb-3 pt-6 md:px-5 lg:px-6 xl:px-8"
    >
      <div className="mt-auto w-full space-y-2">
        <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
          <div className="flex max-w-full items-end gap-2">
            <Shimmer className="h-9 w-9 shrink-0 rounded-full bg-[#E8EEF7]" />

            <div className="w-[min(250px,52vw)]">
              <div className="rounded-[20px] rounded-bl-[8px] border border-[rgba(15,23,42,0.045)] bg-white px-[15px] pb-[12px] pt-[12px] shadow-[0_10px_26px_-22px_rgba(15,23,42,0.16)]">
                <Shimmer className="h-4 w-[74%] rounded-[10px] bg-[#F0F3F8]" />
                <div className="mt-[7px] flex justify-end">
                  <Shimmer className="h-2.5 w-9 rounded-[8px] bg-[#F1F4F8]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full justify-end px-3 py-[5px] sm:px-5">
          <div className="w-[min(430px,68vw)]">
            <div className="rounded-[20px] rounded-br-[8px] bg-[#3797F0] px-[15px] pb-[12px] pt-[12px] shadow-[0_10px_26px_-22px_rgba(15,23,42,0.16)]">
              <Shimmer className="h-4 w-[92%] rounded-[10px] bg-white/35" />
              <Shimmer className="mt-3 h-4 w-[64%] rounded-[10px] bg-white/28" />
              <div className="mt-[7px] flex justify-end">
                <Shimmer className="h-2.5 w-9 rounded-[8px] bg-white/28" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
          <div className="flex max-w-full items-end gap-2">
            <Shimmer className="h-9 w-9 shrink-0 rounded-full bg-[#E8EEF7]" />

            <div className="w-[min(310px,58vw)]">
              <div className="rounded-[20px] rounded-bl-[8px] border border-[rgba(15,23,42,0.045)] bg-white px-[15px] pb-[12px] pt-[12px] shadow-[0_10px_26px_-22px_rgba(15,23,42,0.16)]">
                <Shimmer className="h-4 w-[82%] rounded-[10px] bg-[#F0F3F8]" />
                <Shimmer className="mt-3 h-4 w-[48%] rounded-[10px] bg-[#F0F3F8]" />
                <div className="mt-[7px] flex justify-end">
                  <Shimmer className="h-2.5 w-9 rounded-[8px] bg-[#F1F4F8]" />
                </div>
              </div>
            </div>
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


