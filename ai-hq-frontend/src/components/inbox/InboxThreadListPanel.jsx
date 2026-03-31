import { useEffect, useMemo, useState } from "react";
import { ChevronDown, PencilLine, Search } from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";

const TOP_TABS = [
  { label: "Primary", value: "all" },
  { label: "General", value: "assigned" },
  { label: "Requests", value: "handoff" },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function deriveWorkspaceLabel(threadList) {
  const explicit =
    s(threadList?.workspaceLabel) ||
    s(threadList?.accountLabel) ||
    s(threadList?.tenantLabel) ||
    s(threadList?.title);

  if (explicit) return explicit;
  return "neox.az";
}

export default function InboxThreadListPanel({
  threadList,
  selectedThreadId = "",
  searchQuery = "",
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const workspaceLabel = deriveWorkspaceLabel(threadList);

  const filteredThreads = useMemo(() => {
    const base = Array.isArray(threadList?.filteredThreads)
      ? threadList.filteredThreads
      : [];

    const needle = String(localSearch || "").trim().toLowerCase();
    if (!needle) return base;

    return base.filter((thread) => {
      const haystack = [
        thread?.customer_name,
        thread?.external_username,
        thread?.external_user_id,
        thread?.last_message_text,
        thread?.assigned_to,
        thread?.channel,
        thread?.subject,
        thread?.title,
        thread?.conversation_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [threadList?.filteredThreads, localSearch]);

  return (
    <section
      aria-labelledby="inbox-thread-list-title"
      className="flex h-full min-h-0 flex-col bg-[#f6f6f7]"
    >
      <div className="border-b border-slate-200/80 bg-[#f6f6f7]">
        <div className="flex items-center justify-between px-7 pb-5 pt-7">
          <div className="flex min-w-0 items-center gap-2">
            <h2
              id="inbox-thread-list-title"
              className="truncate text-[20px] font-semibold tracking-[-0.035em] text-slate-950"
            >
              {workspaceLabel}
            </h2>

            <button
              type="button"
              aria-label="Switch inbox view"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            aria-label="Open compose options"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:bg-slate-50 hover:text-slate-950"
          >
            <PencilLine className="h-4 w-4" />
          </button>
        </div>

        <div className="px-7">
          <div className="flex items-end gap-10 overflow-x-auto">
            {TOP_TABS.map((tab) => {
              const active = threadList?.filter === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => threadList?.setFilter?.(tab.value)}
                  aria-pressed={active}
                  className={[
                    "relative inline-flex h-12 items-center whitespace-nowrap px-0 text-[15px] font-medium tracking-[-0.02em] transition",
                    active
                      ? "text-slate-950"
                      : "text-slate-500 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span>{tab.label}</span>
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-[1.5px] rounded-full bg-slate-900" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="h-[54px] w-full rounded-[18px] border border-slate-200/70 bg-[#f1f2f4] pl-12 pr-4 text-[15px] text-slate-900 shadow-none outline-none placeholder:text-slate-500 focus:border-slate-300 focus:bg-white"
            />
          </div>

          {threadList?.deepLinkNotice ? (
            <p className="px-1 pt-3 text-[13px] leading-5 text-amber-700">
              {threadList.deepLinkNotice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threadList?.surface?.loading ? (
          <div className="px-7 py-8 text-sm text-slate-500">
            Loading conversations...
          </div>
        ) : !filteredThreads.length ? (
          <div className="px-7 py-10">
            <div className="rounded-[36px] border border-slate-200/70 bg-[#fafafb] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-slate-900">
                No conversations found
              </div>
              <div className="mt-3 text-[13px] leading-6 text-slate-500">
                New threads will appear here.
              </div>
            </div>
          </div>
        ) : (
          <div className="pb-8 pt-1">
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