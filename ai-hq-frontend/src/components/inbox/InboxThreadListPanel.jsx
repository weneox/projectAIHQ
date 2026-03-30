import { useMemo } from "react";

import InboxThreadCard from "./InboxThreadCard.jsx";

const TABS = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Mentions", value: "handoff" },
  { label: "Drafts", value: "resolved" },
];

export default function InboxThreadListPanel({
  threadList,
  selectedThreadId = "",
  searchQuery = "",
}) {
  const filteredThreads = useMemo(() => {
    const base = Array.isArray(threadList?.filteredThreads)
      ? threadList.filteredThreads
      : [];

    const needle = String(searchQuery || "").trim().toLowerCase();
    if (!needle) return base;

    return base.filter((thread) => {
      const haystack = [
        thread?.customer_name,
        thread?.external_username,
        thread?.external_user_id,
        thread?.last_message_text,
        thread?.assigned_to,
        thread?.channel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [threadList?.filteredThreads, searchQuery]);

  return (
    <section
      aria-labelledby="inbox-thread-list-title"
      className="flex h-full min-h-0 flex-col bg-[#fbfbfc]"
    >
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h2
          id="inbox-thread-list-title"
          className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950"
        >
          All conversations
        </h2>
      </div>

      <div className="border-b border-slate-200/80 px-5">
        <div className="flex h-12 items-end gap-6 overflow-x-auto">
          {TABS.map((tab) => {
            const active = threadList?.filter === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => threadList?.setFilter?.(tab.value)}
                className={[
                  "relative h-full whitespace-nowrap px-0 text-[14px] font-medium transition",
                  active
                    ? "text-[#2b5f9e]"
                    : "text-slate-500 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#2b5f9e]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threadList?.surface?.loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Loading conversations...
          </div>
        ) : !filteredThreads.length ? (
          <div className="px-5 py-8">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
              <div className="text-sm font-medium text-slate-900">
                No conversations found
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                New threads will appear here.
              </div>
            </div>
          </div>
        ) : (
          <div>
            {filteredThreads.map((thread) => (
              <InboxThreadCard
                key={thread.id}
                thread={thread}
                selected={selectedThreadId === thread.id}
                onOpen={threadList?.openThread}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}