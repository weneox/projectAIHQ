import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";

const FILTERS = ["all", "open", "handoff", "assigned", "resolved"];

export default function InboxThreadListPanel({ threadList, selectedThreadId = "" }) {
  const [query, setQuery] = useState("");

  const filteredThreads = useMemo(() => {
    const base = Array.isArray(threadList?.filteredThreads) ? threadList.filteredThreads : [];
    const needle = String(query || "").trim().toLowerCase();
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
  }, [threadList?.filteredThreads, query]);

  return (
    <section className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Queue
        </div>
        <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
          Conversation queue
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">
          Fast operator triage, handoff pressure, and live conversation state.
        </p>

        {threadList?.deepLinkNotice ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            {threadList.deepLinkNotice}
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => threadList?.setFilter?.(value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition ${
                threadList?.filter === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-slate-200/80 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Open threads
          </div>
          <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            {threadList?.stats?.open || 0}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            AI active
          </div>
          <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            {threadList?.stats?.aiActive || 0}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Handoff
          </div>
          <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
            {threadList?.stats?.handoff || 0}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
          {threadList?.surface?.loading ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Loading conversations...
            </div>
          ) : !filteredThreads.length ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <div className="text-sm font-medium text-slate-700">No conversations yet</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Conversation queue placeholder. New threads will appear here with status,
                handoff state, and unread pressure.
              </div>
            </div>
          ) : (
            filteredThreads.map((thread) => (
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
    </section>
  );
}
