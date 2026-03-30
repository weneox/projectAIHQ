import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";

const FILTERS = ["all", "open", "handoff", "assigned", "resolved"];

function MetricPill({ label, value, tone = "default" }) {
  const toneMap = {
    default: "border-white/10 bg-white/[0.04] text-slate-300",
    success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
    warn: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  };

  return (
    <div
      className={[
        "rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.16em]",
        toneMap[tone] || toneMap.default,
      ].join(" ")}
    >
      <span className="text-slate-500">{label}</span>{" "}
      <span className="font-semibold text-inherit">{value}</span>
    </div>
  );
}

export default function InboxThreadListPanel({
  threadList,
  selectedThreadId = "",
  wsState = "idle",
  dbDisabled = false,
  operatorName = "",
}) {
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
    <section className="flex min-h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0f1727]">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Queue
            </div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-white">
              All conversations
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Fast thread triage for {operatorName || "operator"} across live, handoff,
              and resolved states.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            WS {wsState}
          </div>
        </div>

        {threadList?.deepLinkNotice ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-3 text-sm text-amber-200">
            {threadList.deepLinkNotice}
          </div>
        ) : null}
      </div>

      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => threadList?.setFilter?.(value)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition ${
                  threadList?.filter === value
                    ? "border-cyan-400/30 bg-cyan-400/[0.14] text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <ArrowDownUp className="h-3.5 w-3.5" />
            Recent first
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetricPill label="Open" value={threadList?.stats?.open || 0} />
          <MetricPill label="AI active" value={threadList?.stats?.aiActive || 0} tone="success" />
          <MetricPill label="Handoff" value={threadList?.stats?.handoff || 0} tone="warn" />
          <MetricPill label="Mode" value={dbDisabled ? "Fallback" : "Live"} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1.5">
          {threadList?.surface?.loading ? (
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-slate-400">
              Loading conversations...
            </div>
          ) : !filteredThreads.length ? (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
              <div className="text-sm font-medium text-slate-200">No conversations yet</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Conversation queue placeholder. New threads will appear here with
                status, handoff state, and unread pressure.
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
