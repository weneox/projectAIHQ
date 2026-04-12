import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

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
      className="absolute left-0 top-[calc(100%+10px)] z-30 min-w-[238px] overflow-hidden rounded-[14px] border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_20px_50px_-30px_rgba(15,23,42,0.22)]"
    >
      <div className="py-1.5">
        {options.map((option, index) => {
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
                "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] transition-colors",
                index > 0 ? "border-t border-[rgba(15,23,42,0.05)]" : "",
                active
                  ? "text-text"
                  : "text-text-muted hover:bg-[rgba(15,23,42,0.025)] hover:text-text",
              ].join(" ")}
            >
              <span className="truncate font-medium">{option.label}</span>
              <span className="shrink-0 text-[12px] text-text-subtle">
                {count}
              </span>
            </button>
          );
        })}
      </div>
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
  const [searchOpen, setSearchOpen] = useState(false);

  const filterAnchorRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
        setSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

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
    const exists = channelOptions.some(
      (option) => option.value === channelFilter
    );
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

  function handleToggleFilterMenu() {
    setSearchOpen(false);
    setFilterMenuOpen((prev) => !prev);
  }

  function handleOpenSearch() {
    setFilterMenuOpen(false);
    setSearchOpen(true);
  }

  function handleCloseSearch() {
    setLocalSearch("");
    setSearchOpen(false);
  }

  return (
    <section
      aria-labelledby="inbox-thread-list-title"
      className="flex h-full min-h-0 flex-col bg-white"
    >
      <div className="shrink-0 border-b border-line-soft bg-white">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative min-w-0 flex-1" ref={filterAnchorRef}>
              <button
                type="button"
                onClick={handleToggleFilterMenu}
                className="inline-flex max-w-full items-center gap-2 text-left outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
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
              onClick={handleOpenSearch}
              aria-label="Search conversations"
              className="inline-flex h-9 w-9 items-center justify-center text-text-muted outline-none ring-0 transition-colors hover:text-text focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        <div className="mt-4 border-b border-line-soft px-4">
          <div className="flex gap-4 overflow-x-auto">
            {TOP_TABS.map((tab) => {
              const active = threadList?.filter === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => threadList?.setFilter?.(tab.value)}
                  aria-pressed={active}
                  className={[
                    "relative inline-flex h-11 items-center whitespace-nowrap border-b-2 px-0 text-[13px] font-medium outline-none ring-0 transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
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
        </div>

        <div
          className={[
            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            searchOpen
              ? "max-h-[76px] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          ].join(" ")}
          aria-hidden={!searchOpen}
        >
          <div className="border-b border-line-soft px-4">
            <div className="flex h-14 items-center gap-3">
              <Search className="h-[17px] w-[17px] shrink-0 text-text-subtle" />

              <label className="sr-only" htmlFor="inbox-thread-search">
                Search conversations
              </label>

              <input
                ref={searchInputRef}
                id="inbox-thread-search"
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                autoComplete="off"
                className="block h-full w-full border-0 bg-transparent px-0 text-[14px] text-text outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-subtle"
              />

              <button
                type="button"
                onClick={handleCloseSearch}
                aria-label="Close search"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-text-muted outline-none ring-0 transition-colors hover:text-text focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              >
                <X className="h-[17px] w-[17px]" />
              </button>
            </div>
          </div>
        </div>

        {threadList?.deepLinkNotice ? (
          <div className="px-4 py-3">
            <p className="text-[12px] leading-5 text-warning">
              {threadList.deepLinkNotice}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
        <div className="px-2 py-2">
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
      </div>
    </section>
  );
}