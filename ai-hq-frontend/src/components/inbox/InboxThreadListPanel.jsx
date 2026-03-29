import { CheckCircle2, MessageSquareText, ShieldAlert, Sparkles } from "lucide-react";

import InboxStatCard from "./InboxStatCard.jsx";
import InboxThreadCard from "./InboxThreadCard.jsx";

const FILTERS = ["all", "open", "handoff", "assigned", "resolved"];

export default function InboxThreadListPanel({ threadList, selectedThreadId = "" }) {
  return (
    <>
      {threadList?.deepLinkNotice ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {threadList.deepLinkNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <InboxStatCard label="Open Threads" value={threadList?.stats?.open || 0} icon={MessageSquareText} />
        <InboxStatCard label="AI Active" value={threadList?.stats?.aiActive || 0} icon={Sparkles} tone="cyan" />
        <InboxStatCard label="Handoff" value={threadList?.stats?.handoff || 0} icon={ShieldAlert} tone="amber" />
        <InboxStatCard label="Resolved" value={threadList?.stats?.resolved || 0} icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="rounded-[32px] border border-[#ece2d3] bg-[#fffdf9]/92 p-6 shadow-[0_18px_44px_rgba(120,102,73,0.08)]">
        <div className="flex flex-col gap-4 border-b border-[#eee4d5] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[20px] font-semibold tracking-[-0.03em] text-stone-900">Active Threads</div>
            <div className="mt-1 text-sm text-stone-500">Start here to see priority conversations, handoff pressure, and live operator workload.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => threadList?.setFilter?.(value)}
                className={`rounded-full border px-3.5 py-2 text-[12px] font-medium capitalize transition ${
                  threadList?.filter === value
                    ? value === "handoff"
                      ? "border-[#e7d7ba] bg-[#faf3e6] text-stone-900"
                      : "border-[#d9c8ac] bg-[#f8f1e4] text-stone-900"
                    : "border-[#ece2d3] bg-[#fffaf4] text-stone-500 hover:border-[#dfcfb2] hover:bg-white hover:text-stone-900"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {threadList?.surface?.loading ? (
            <div className="rounded-[24px] border border-[#ece2d3] bg-[#fffdfa] px-4 py-10 text-center text-sm text-stone-500">
              Loading threads...
            </div>
          ) : !threadList?.filteredThreads?.length ? (
            <div className="rounded-[24px] border border-dashed border-[#ece2d3] bg-[#fffdfa] px-4 py-10 text-center">
              <div className="text-sm font-medium text-stone-700">No threads yet</div>
              <div className="mt-2 text-sm leading-6 text-stone-500">Threads will appear here with status and handoff state.</div>
            </div>
          ) : (
            threadList.filteredThreads.map((thread) => (
              <InboxThreadCard
                key={thread.id}
                thread={thread}
                selected={selectedThreadId === thread.id}
                onOpen={threadList?.openThread}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
