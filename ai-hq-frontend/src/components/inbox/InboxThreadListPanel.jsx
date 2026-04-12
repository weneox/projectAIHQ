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
  if (normalized === "web") return "Website";
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
      className="absolute left-0 top-[calc(100%+8px)] z-30 w-[240px] overflow-hidden rounded-[18px] border border-line bg-white p-1.5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.28)]"
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
              "flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[13px] transition-colors",
              active
                ? "bg-[rgba(15,23,42,0.05)] text-text"
                : "text-text-muted hover:bg-[rgba(15,23,42,0.04)] hover:text-text",
            ].join(" ")}
          >
            <span className="truncate font-medium">{option.label}</span>
            <span
              className={[
                "inline-flex min-w-[22px] items-center justify-center rounded-pill px-2 py-0.5 text-[11px]",
                active
                  ? "bg-white text-text-muted"
                  : "bg-[rgba(15,23,42,0.05)] text-text-subtle",
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

  const baseThreads = useMemo(
    () =>
      Array.isArray(threadList?.filteredThreads)
        ? threadList.filteredThreads
        : [],
    [threadList?.filteredThreads]
  );

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
      className="flex h-full min-h-0 flex-col bg-transparent"
    >
      <div className="border-b border-line-soft px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="relative min-w-0 flex-1" ref={filterAnchorRef}>
            <button
              type="button"
              onClick={() => setFilterMenuOpen((prev) => !prev)}
              className="inline-flex max-w-full items-center gap-2 text-left"
              aria-haspopup="menu"
              aria-expanded={filterMenuOpen}
            >
              <h2
                id="inbox-thread-list-title"
                className="truncate text-[15px] font-semibold text-text"
              >
                {selectedChannelLabel}
              </h2>

              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 text-text-subtle transition-transform",
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-line bg-white text-text-muted transition-colors hover:bg-[rgba(15,23,42,0.03)] hover:text-text"
          >
            <Funnel className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-4 overflow-x-auto border-b border-line-soft">
          {TOP_TABS.map((tab) => {
            const active = threadList?.filter === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => threadList?.setFilter?.(tab.value)}
                aria-pressed={active}
                className={[
                  "relative inline-flex h-10 items-center whitespace-nowrap border-b-2 px-0 text-[13px] font-medium transition-colors",
                  active
                    ? "border-text text-text"
                    : "border-transparent text-text-muted hover:text-text",
                ].join(" ")}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          <label className="sr-only" htmlFor="inbox-thread-search">
            Search conversations
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
            <input
              id="inbox-thread-search"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="block h-11 w-full rounded-[16px] border border-line bg-white pl-10 pr-3 text-[14px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-brand"
            />
          </div>

          {threadList?.deepLinkNotice ? (
            <p className="pt-2 text-[12px] leading-5 text-warning">
              {threadList.deepLinkNotice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {threadList?.surface?.loading && !filteredThreads.length ? (
          <InboxThreadListSkeleton />
        ) : !filteredThreads.length ? (
          <div className="px-3 py-8">
            <div className="text-[14px] font-medium text-text">
              No conversations found
            </div>
            <div className="mt-2 text-[13px] leading-6 text-text-muted">
              New threads will appear here.
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
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