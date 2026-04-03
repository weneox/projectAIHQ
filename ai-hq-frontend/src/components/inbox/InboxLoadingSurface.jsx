function Shimmer({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-surface-subtle ${className}`.trim()} />;
}

export function InboxThreadListSkeleton() {
  return (
    <div aria-label="Loading conversations" className="px-5 py-4">
      <div className="border-b border-slate-200/70 pb-4">
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 w-28 rounded-full bg-slate-100" />
          <Shimmer className="h-9 w-9 rounded-full bg-slate-100" />
        </div>
        <div className="mt-4">
          <Shimmer className="h-12 rounded-[18px] bg-slate-100" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="border-b border-slate-200/60 px-0 py-4 last:border-b-0"
          >
            <div className="flex items-start gap-3">
              <Shimmer className="h-11 w-11 rounded-full bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <Shimmer className="h-4 w-28 rounded-full bg-slate-100" />
                  <Shimmer className="h-3 w-12 rounded-full bg-slate-100/80" />
                </div>
                <Shimmer className="h-3.5 w-full rounded-full bg-slate-100/85" />
                <div className="flex items-center justify-between gap-3">
                  <Shimmer className="h-3 w-20 rounded-full bg-slate-100/80" />
                  <Shimmer className="h-6 w-6 rounded-full bg-slate-100" />
                </div>
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
    <div aria-label="Loading conversation detail" className="flex min-h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <div className="space-y-5">
          <Shimmer className="h-4 w-32 rounded-full bg-slate-100/80" />
          <div className="space-y-4">
            <div className="ml-auto max-w-[72%] border-l-2 border-slate-200/70 pl-4 py-1">
              <Shimmer className="h-3.5 w-32 rounded-full bg-slate-100" />
              <Shimmer className="mt-2 h-3.5 w-full rounded-full bg-slate-100/85" />
              <Shimmer className="mt-2 h-3.5 w-24 rounded-full bg-slate-100/75" />
            </div>
            <div className="max-w-[78%] border-l-2 border-slate-200/70 pl-4 py-1">
              <Shimmer className="h-3.5 w-28 rounded-full bg-slate-100" />
              <Shimmer className="mt-2 h-3.5 w-full rounded-full bg-slate-100/85" />
              <Shimmer className="mt-2 h-3.5 w-[72%] rounded-full bg-slate-100/75" />
            </div>
            <div className="ml-auto max-w-[66%] border-l-2 border-slate-200/70 pl-4 py-1">
              <Shimmer className="h-3.5 w-full rounded-full bg-slate-100/85" />
              <Shimmer className="mt-2 h-3.5 w-16 rounded-full bg-slate-100/75" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70 bg-[#f6f6f7] px-6 py-5">
        <div className="border-t border-slate-200/70 pt-4">
          <Shimmer className="h-24 rounded-[20px] bg-slate-100/85" />
          <div className="mt-3 flex items-center justify-between">
            <Shimmer className="h-10 w-24 rounded-full bg-slate-100" />
            <Shimmer className="h-10 w-32 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxLeadSkeleton() {
  return (
    <div aria-label="Loading conversation context" className="px-5 py-5">
      <div className="border-t border-slate-200/70 px-1 py-5">
        <div className="flex flex-col items-center">
          <Shimmer className="h-20 w-20 rounded-full bg-slate-100" />
          <Shimmer className="mt-4 h-5 w-36 rounded-full bg-slate-100" />
          <Shimmer className="mt-2 h-3.5 w-24 rounded-full bg-slate-100/80" />
        </div>
        <div className="mt-6 space-y-3">
          <Shimmer className="h-12 rounded-[18px] bg-slate-100/85" />
          <Shimmer className="h-12 rounded-[18px] bg-slate-100/85" />
          <Shimmer className="h-20 rounded-[22px] bg-slate-100/75" />
        </div>
      </div>
    </div>
  );
}
