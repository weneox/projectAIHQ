import { CheckCircle2, MessageSquareText, ShieldAlert, Sparkles } from "lucide-react";

import InboxStatCard from "./InboxStatCard.jsx";
import InboxThreadCard from "./InboxThreadCard.jsx";

const FILTERS = ["all", "open", "handoff", "assigned", "resolved"];

export default function InboxThreadListPanel({ threadList, selectedThreadId = "" }) {
  return (
    <>
      {threadList?.deepLinkNotice ? (
        <div className="rounded-[22px] border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
          {threadList.deepLinkNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <InboxStatCard label="Open Threads" value={threadList?.stats?.open || 0} icon={MessageSquareText} />
        <InboxStatCard label="AI Active" value={threadList?.stats?.aiActive || 0} icon={Sparkles} tone="cyan" />
        <InboxStatCard label="Handoff" value={threadList?.stats?.handoff || 0} icon={ShieldAlert} tone="amber" />
        <InboxStatCard label="Resolved" value={threadList?.stats?.resolved || 0} icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="mt-6 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-white/8 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">Active Threads</div>
            <div className="mt-1 text-sm text-white/46">Real inbox flow and operator handoff state.</div>
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
                      ? "border-amber-300/20 bg-amber-300/[0.08] text-amber-100"
                      : "border-white/10 bg-white/[0.04] text-white/78"
                    : "border-white/10 bg-white/[0.02] text-white/44 hover:border-white/16 hover:bg-white/[0.04] hover:text-white/70"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {threadList?.surface?.loading ? (
            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/52">
              Loading threads...
            </div>
          ) : !threadList?.filteredThreads?.length ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
              <div className="text-sm font-medium text-white/68">No threads yet</div>
              <div className="mt-2 text-sm leading-6 text-white/40">Threads will appear here with status and handoff state.</div>
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
