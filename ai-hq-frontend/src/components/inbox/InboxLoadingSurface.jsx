import Card from "../ui/Card.jsx";
import { StateSkeletonBlock } from "../ui/AppShellPrimitives.jsx";

function Shimmer({ className = "" }) {
  return <StateSkeletonBlock className={className} />;
}

function SkeletonCard({ children, className = "" }) {
  return (
    <Card padded={false} className={className}>
      {children}
    </Card>
  );
}

function ThreadSkeletonRow() {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <Shimmer className="mt-0.5 h-12 w-12 shrink-0 rounded-[15px]" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Shimmer className="h-4 w-28 rounded-[10px]" />
              <Shimmer className="mt-2 h-3.5 w-[82%] rounded-[10px] opacity-85" />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Shimmer className="h-3.5 w-9 rounded-[10px] opacity-75" />
              <Shimmer className="h-5 w-5 rounded-[8px]" />
            </div>
          </div>

          <Shimmer className="mt-3 h-3.5 w-full rounded-[10px] opacity-85" />
          <Shimmer className="mt-2 h-3.5 w-[68%] rounded-[10px] opacity-70" />
        </div>
      </div>
    </div>
  );
}

export function InboxThreadListSkeleton() {
  return (
    <div aria-label="Loading conversations" className="bg-surface">
      <div className="divide-y divide-line-soft">
        {Array.from({ length: 9 }).map((_, index) => (
          <ThreadSkeletonRow key={index} />
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
            <Shimmer className="h-9 w-9 shrink-0 rounded-full" />

            <div className="w-[min(250px,52vw)]">
              <div className="rounded-[20px] rounded-bl-[8px] border border-line-soft bg-surface px-[15px] pb-[12px] pt-[12px] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]">
                <Shimmer className="h-4 w-[74%] rounded-[10px] opacity-85" />

                <div className="mt-[7px] flex justify-end">
                  <Shimmer className="h-2.5 w-9 rounded-[8px] opacity-70" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full justify-end px-3 py-[5px] sm:px-5">
          <div className="w-[min(430px,68vw)]">
            <div className="rounded-[20px] rounded-br-[8px] bg-[linear-gradient(180deg,#56B0FF_0%,#3797F0_52%,#2186E6_100%)] px-[15px] pb-[12px] pt-[12px] shadow-[0_18px_34px_-28px_rgba(37,99,235,0.24),inset_0_1px_0_rgba(255,255,255,0.26)]">
              <Shimmer className="h-4 w-[92%] rounded-[10px] bg-white/30 opacity-80" />
              <Shimmer className="mt-3 h-4 w-[64%] rounded-[10px] bg-white/25 opacity-75" />

              <div className="mt-[7px] flex justify-end">
                <Shimmer className="h-2.5 w-9 rounded-[8px] bg-white/25 opacity-70" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full justify-start px-3 py-[5px] sm:px-5">
          <div className="flex max-w-full items-end gap-2">
            <Shimmer className="h-9 w-9 shrink-0 rounded-full" />

            <div className="w-[min(310px,58vw)]">
              <div className="rounded-[20px] rounded-bl-[8px] border border-line-soft bg-surface px-[15px] pb-[12px] pt-[12px] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]">
                <Shimmer className="h-4 w-[82%] rounded-[10px] opacity-85" />
                <Shimmer className="mt-3 h-4 w-[48%] rounded-[10px] opacity-75" />

                <div className="mt-[7px] flex justify-end">
                  <Shimmer className="h-2.5 w-9 rounded-[8px] opacity-70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadIdentitySkeleton() {
  return (
    <SkeletonCard className="px-5 py-5">
      <div className="flex flex-col items-center text-center">
        <Shimmer className="h-16 w-16 rounded-[20px]" />

        <Shimmer className="mt-3 h-4.5 w-32 rounded-[10px]" />
        <Shimmer className="mt-2 h-3.5 w-24 rounded-[10px] opacity-75" />

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Shimmer className="h-6 w-20 rounded-[10px]" />
          <Shimmer className="h-6 w-16 rounded-[10px]" />
          <Shimmer className="h-6 w-24 rounded-[10px]" />
        </div>
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-3">
          <Shimmer className="h-3 w-12 rounded-[8px] opacity-75" />
          <Shimmer className="ml-auto h-3.5 w-24 rounded-[8px]" />
        </div>

        <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 py-3">
          <Shimmer className="h-3 w-16 rounded-[8px] opacity-75" />
          <Shimmer className="ml-auto h-3.5 w-28 rounded-[8px]" />
        </div>
      </div>
    </SkeletonCard>
  );
}

function LeadSectionSkeleton({ rows = 3 }) {
  return (
    <section className="border-t border-line-soft px-4 py-4">
      <div className="flex items-center gap-2">
        <Shimmer className="h-4 w-4 rounded-full opacity-80" />
        <Shimmer className="h-4 w-24 rounded-[10px]" />
      </div>

      <div className="mt-3">
        <SkeletonCard className="px-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-3 last:border-b-0"
            >
              <Shimmer className="h-3 w-14 rounded-[8px] opacity-75" />
              <Shimmer className="ml-auto h-3.5 w-28 rounded-[8px]" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </section>
  );
}

export function InboxLeadSkeleton() {
  return (
    <div
      aria-label="Loading conversation context"
      className="space-y-0 bg-surface-muted"
    >
      <div className="px-4 py-4">
        <LeadIdentitySkeleton />
      </div>

      <LeadSectionSkeleton rows={3} />
      <LeadSectionSkeleton rows={3} />

      <section className="border-t border-line-soft px-4 py-4">
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4 rounded-full opacity-80" />
          <Shimmer className="h-4 w-28 rounded-[10px]" />
        </div>

        <div className="mt-3">
          <SkeletonCard className="px-4 py-4">
            <Shimmer className="h-3.5 w-full rounded-[10px] opacity-85" />
            <Shimmer className="mt-2 h-3.5 w-[76%] rounded-[10px] opacity-75" />
            <Shimmer className="mt-2 h-3.5 w-[52%] rounded-[10px] opacity-65" />
          </SkeletonCard>
        </div>
      </section>
    </div>
  );
}