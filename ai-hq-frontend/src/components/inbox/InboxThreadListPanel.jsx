import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";
import { InboxThreadListSkeleton } from "./InboxLoadingSurface.jsx";

const TOP_TABS = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Handoff", value: "handoff" },
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
  if (normalized === "webchat") return "Web Chat";
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
    { value: "all", label: "All channels" },
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
      className="absolute left-0 top-[calc(100%+10px)] z-30 min-w-[240px] overflow-hidden rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white p-1.5 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.22)]"
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
              "flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-[rgba(239,246,255,0.96)] text-[rgba(37,99,235,0.98)]"
                : "text-[rgba(51,65,85,0.94)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.94)]",
            ].join(" ")}
          >
            <span className="truncate text-[13px] font-medium">
              {option.label}
            </span>
            <span
              className={[
                "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                active
                  ? "bg-[rgba(37,99,235,0.10)] text-[rgba(37,99,235,0.98)]"
                  : "bg-[rgba(248,250,252,0.96)] text-[rgba(100,116,139,0.96)]",
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

function TopTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "relative inline-flex h-10 items-center rounded-[12px] px-3 text-[12.5px] font-semibold transition-all",
        active
          ? "bg-[rgba(239,246,255,0.96)] text-[rgba(37,99,235,0.98)]"
          : "text-[rgba(100,116,139,0.96)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ToolbarButton({
  icon,
  label,
  active = false,
  onClick,
  expanded,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-[12px] border px-3 text-[12.5px] font-medium transition-all",
        active
          ? "border-[rgba(37,99,235,0.14)] bg-[rgba(239,246,255,0.96)] text-[rgba(37,99,235,0.98)]"
          : "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(71,85,105,0.96)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {icon === SlidersHorizontal ? (
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform",
            expanded ? "rotate-180" : "",
          ].join(" ")}
        />
      ) : null}
    </button>
  );
}

function EmptyState({ hasSearch }) {
  return (
    <div className="px-4 py-10">
      <div className="rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.9)] px-5 py-8 text-center shadow-[0_24px_60px_-46px_rgba(15,23,42,0.16)]">
        <div className="text-[15px] font-semibold text-[rgba(15,23,42,0.96)]">
          {hasSearch ? "No matching conversations" : "No conversations yet"}
        </div>
        <div className="mt-2 text-[13px] leading-6 text-[rgba(100,116,139,0.96)]">
          {hasSearch
            ? "Try a different name, channel, or keyword."
            : "New conversations will appear here."}
        </div>
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
    function handleKeyDown(event) {
      const target = event.target;
      const tagName = String(target?.tagName || "").toLowerCase();
      const isTypingField =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable === true;

      if (event.key === "Escape") {
        setFilterMenuOpen(false);
        setSearchOpen(false);
        return;
      }

      if (!isTypingField && event.key === "/") {
        event.preventDefault();
        setFilterMenuOpen(false);
        setSearchOpen(true);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFilterMenuOpen(false);
        setSearchOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const baseThreads = useMemo(
    () =>
      Array.isArray(threadList?.filteredThreads) ? threadList.filteredThreads : [],
    [threadList?.filteredThreads]
  );

  const selectedThread = useMemo(
    () => baseThreads.find((thread) => s(thread?.id) === s(selectedThreadId)) || null,
    [baseThreads, selectedThreadId]
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
    "All channels";

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
    const bySearch = !needle
      ? byChannel
      : byChannel.filter((thread) => {
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

    if (!selectedThread) return bySearch;

    const selectedId = s(selectedThread.id);
    const alreadyVisible = bySearch.some((thread) => s(thread?.id) === selectedId);
    if (alreadyVisible) return bySearch;

    const hasActiveConstraint = channelFilter !== "all" || Boolean(needle);
    if (!hasActiveConstraint) return bySearch;

    return [selectedThread, ...bySearch];
  }, [baseThreads, channelFilter, localSearch, selectedThread]);

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
      className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]"
    >
      <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.82)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.72)]">
        <div className="px-4 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="inbox-thread-list-title"
                className="text-[16px] font-semibold text-[rgba(15,23,42,0.96)]"
              >
                Conversations
              </h2>
              <div className="mt-1 text-[12px] text-[rgba(100,116,139,0.96)]">
                {filteredThreads.length} visible
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative" ref={filterAnchorRef}>
                <ToolbarButton
                  icon={SlidersHorizontal}
                  label={selectedChannelLabel}
                  active={channelFilter !== "all" || filterMenuOpen}
                  onClick={handleToggleFilterMenu}
                  expanded={filterMenuOpen}
                />

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

              <ToolbarButton
                icon={Search}
                label="Search"
                active={searchOpen || Boolean(localSearch.trim())}
                onClick={handleOpenSearch}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {TOP_TABS.map((tab) => {
              const active = threadList?.filter === tab.value;

              return (
                <TopTabButton
                  key={tab.value}
                  active={active}
                  label={tab.label}
                  onClick={() => threadList?.setFilter?.(tab.value)}
                />
              );
            })}
          </div>
        </div>

        <div
          className={[
            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            searchOpen
              ? "max-h-[84px] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          ].join(" ")}
          aria-hidden={!searchOpen}
        >
          <div className="border-t border-[rgba(15,23,42,0.05)] px-4 py-3">
            <div className="flex h-12 items-center gap-3 rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-white px-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.16)]">
              <Search className="h-[16px] w-[16px] shrink-0 text-[rgba(148,163,184,0.96)]" />

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
                className="block h-full w-full border-0 bg-transparent px-0 text-[14px] text-[rgba(15,23,42,0.96)] outline-none placeholder:text-[rgba(148,163,184,0.96)]"
              />

              <button
                type="button"
                onClick={handleCloseSearch}
                aria-label="Close search"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[rgba(100,116,139,0.96)] transition-colors hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]"
              >
                <X className="h-[16px] w-[16px]" />
              </button>
            </div>
          </div>
        </div>

        {threadList?.deepLinkNotice ? (
          <div className="border-t border-[rgba(15,23,42,0.05)] px-4 py-3">
            <p className="text-[12px] leading-5 text-[rgba(180,83,9,0.96)]">
              {threadList.deepLinkNotice}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-2.5 py-2.5">
          {threadList?.surface?.loading && !filteredThreads.length ? (
            <InboxThreadListSkeleton />
          ) : !filteredThreads.length ? (
            <EmptyState hasSearch={Boolean(localSearch.trim())} />
          ) : (
            <div className="space-y-1">
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