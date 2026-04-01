import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Funnel, Search } from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";
import { InboxThreadListSkeleton } from "./InboxLoadingSurface.jsx";

const TOP_TABS = [
  { label: "Primary", value: "all" },
  { label: "General", value: "assigned" },
  { label: "Requests", value: "handoff" },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeChannelValue(value = "") {
  return s(value).toLowerCase();
}

function prettyChannelLabel(value = "") {
  const normalized = normalizeChannelValue(value);

  if (!normalized) return "Unknown channel";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "email") return "Email";
  if (normalized === "webchat") return "Web chat";
  if (normalized === "website") return "Website";
  if (normalized === "voice") return "Voice";
  if (normalized === "sms") return "SMS";

  return normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildChannelOptions(threads = []) {
  const map = new Map();

  for (const thread of threads) {
    const raw =
      s(thread?.channel) ||
      s(thread?.channel_type) ||
      s(thread?.provider) ||
      s(thread?.source_type);

    const value = normalizeChannelValue(raw);
    if (!value) continue;

    if (!map.has(value)) {
      map.set(value, {
        value,
        label: prettyChannelLabel(value),
      });
    }
  }

  return [
    { value: "all", label: "All conversations" },
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function ChannelFilterMenu({
  open,
  anchorRef,
  selectedValue,
  options,
  counts,
  onSelect,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      const target = event.target;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose?.();
    }

    function handleEscape(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-[calc(100%+10px)] z-30 w-[250px] overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
    >
      {options.map((option) => {
        const active = selectedValue === option.value;
        const count = Number(counts?.[option.value] ?? 0);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onSelect?.(option.value);
              onClose?.();
            }}
            className={[
              "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition",
              active
                ? "bg-[#f2f5f8] text-slate-950"
                : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            <span className="text-[14px] font-medium tracking-[-0.02em]">
              {option.label}
            </span>

            <span
              className={[
                "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-medium",
                active
                  ? "bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                  : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function InboxThreadListPanel({
  threadList,
  selectedThreadId = "",
  searchQuery = "",
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [channelFilter, setChannelFilter] = useState("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterAnchorRef = useRef(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const baseThreads = Array.isArray(threadList?.filteredThreads)
    ? threadList.filteredThreads
    : [];

  const channelOptions = useMemo(
    () => buildChannelOptions(baseThreads),
    [baseThreads]
  );

  const channelCounts = useMemo(() => {
    const counts = { all: baseThreads.length };

    for (const thread of baseThreads) {
      const raw =
        s(thread?.channel) ||
        s(thread?.channel_type) ||
        s(thread?.provider) ||
        s(thread?.source_type);

      const value = normalizeChannelValue(raw);
      if (!value) continue;
      counts[value] = Number(counts[value] || 0) + 1;
    }

    return counts;
  }, [baseThreads]);

  useEffect(() => {
    const exists = channelOptions.some((option) => option.value === channelFilter);
    if (!exists) setChannelFilter("all");
  }, [channelOptions, channelFilter]);

  const selectedChannelLabel =
    channelOptions.find((option) => option.value === channelFilter)?.label ||
    "All conversations";

  const filteredThreads = useMemo(() => {
    const byChannel =
      channelFilter === "all"
        ? baseThreads
        : baseThreads.filter((thread) => {
            const raw =
              s(thread?.channel) ||
              s(thread?.channel_type) ||
              s(thread?.provider) ||
              s(thread?.source_type);

            return normalizeChannelValue(raw) === channelFilter;
          });

    const needle = String(localSearch || "").trim().toLowerCase();
    if (!needle) return byChannel;

    return byChannel.filter((thread) => {
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
  }, [baseThreads, channelFilter, localSearch]);

  return (
    <section
      aria-labelledby="inbox-thread-list-title"
      className="flex h-full min-h-0 flex-col bg-[#f6f6f7]"
    >
      <div className="border-b border-slate-200/80 bg-[#f6f6f7]">
        <div className="flex items-center justify-between px-7 pb-3 pt-5">
          <div className="relative min-w-0" ref={filterAnchorRef}>
            <button
              type="button"
              onClick={() => setFilterMenuOpen((prev) => !prev)}
              className="inline-flex max-w-full items-center gap-2 rounded-full px-0 text-left transition hover:text-slate-700"
              aria-haspopup="menu"
              aria-expanded={filterMenuOpen}
            >
              <h2
                id="inbox-thread-list-title"
                className="truncate text-[17px] font-semibold tracking-[-0.03em] text-slate-950"
              >
                {selectedChannelLabel}
              </h2>

              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
                  filterMenuOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>

            <ChannelFilterMenu
              open={filterMenuOpen}
              anchorRef={filterAnchorRef}
              selectedValue={channelFilter}
              options={channelOptions}
              counts={channelCounts}
              onSelect={setChannelFilter}
              onClose={() => setFilterMenuOpen(false)}
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterMenuOpen((prev) => !prev)}
            aria-label="Open conversation filters"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-slate-950"
          >
            <Funnel className="h-4 w-4" />
          </button>
        </div>

        <div className="px-7">
          <div className="flex items-end gap-9 overflow-x-auto">
            {TOP_TABS.map((tab) => {
              const active = threadList?.filter === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => threadList?.setFilter?.(tab.value)}
                  aria-pressed={active}
                  className={[
                    "relative inline-flex h-11 items-center whitespace-nowrap px-0 text-[14px] font-medium tracking-[-0.02em] transition",
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

        <div className="px-6 pb-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="h-[50px] w-full rounded-[18px] border border-slate-200/70 bg-[#f1f2f4] pl-11 pr-4 text-[14px] text-slate-900 shadow-none outline-none placeholder:text-slate-500 focus:border-slate-300 focus:bg-white"
            />
          </div>

          {threadList?.deepLinkNotice ? (
            <p className="px-1 pt-2 text-[13px] leading-5 text-amber-700">
              {threadList.deepLinkNotice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {threadList?.surface?.loading && !filteredThreads.length ? (
          <InboxThreadListSkeleton />
        ) : !filteredThreads.length ? (
          <div className="px-7 py-8">
            <div className="rounded-[34px] border border-slate-200/70 bg-[#fafafb] px-6 py-9 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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
