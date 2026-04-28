import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Search, SlidersHorizontal, X } from "lucide-react";

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
      className="absolute right-0 top-[calc(100%+10px)] z-30 min-w-[230px] overflow-hidden rounded-[18px] border border-[#DFE7F1] bg-white p-1.5 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.95)]"
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
              "flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-[#F1F6FF] text-[#1D5FD0]"
                : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
            ].join(" ")}
          >
            <span className="truncate text-[13px] font-semibold">
              {option.label}
            </span>
            <span className="text-[11px] font-bold text-[#A2AEC0]">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  active = false,
  onClick,
  expanded,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-[14px] border transition-all duration-150",
        active
          ? "border-[#CFE0F7] bg-[linear-gradient(180deg,#F8FBFF_0%,#ECF4FF_100%)] text-[#2563EB] shadow-[0_18px_36px_-30px_rgba(37,99,235,0.38)]"
          : "border-[#E3EAF3] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] text-[#64748B] shadow-[0_14px_30px_-28px_rgba(15,23,42,0.24)] hover:border-[#D6E0EC] hover:text-[#0F172A]",
      ].join(" ")}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
    </button>
  );
}

function TopTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "relative inline-flex h-9 items-center px-1 text-[12.5px] font-bold transition-colors",
        active ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#0F172A]",
      ].join(" ")}
    >
      {label}
      <span
        aria-hidden="true"
        className={[
          "absolute -bottom-[9px] left-0 right-0 h-[2px] rounded-full transition-all",
          active ? "bg-[#2563EB] opacity-100" : "bg-transparent opacity-0",
        ].join(" ")}
      />
    </button>
  );
}

function EmptyState({ hasSearch }) {
  return (
    <div className="px-4 py-8">
      <div className="rounded-[22px] border border-[#E4EAF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] px-4 py-7 text-center shadow-[0_20px_46px_-42px_rgba(15,23,42,0.26)]">
        <div className="text-[14px] font-bold text-[#0F172A]">
          {hasSearch ? "No matching conversations" : "No conversations yet"}
        </div>
        <div className="mt-2 text-[12.5px] font-medium leading-6 text-[#64748B]">
          {hasSearch ? "Try a different keyword." : "New conversations will appear here."}
        </div>
      </div>
    </div>
  );
}

function DisconnectedRailState() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-10">
      <div className="max-w-[270px] text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#E0E7F0] bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F7FB_100%)] shadow-[0_24px_50px_-42px_rgba(15,23,42,0.28)]">
            <Inbox className="h-8 w-8 text-[#94A3B8]" strokeWidth={1.8} />
          </div>
        </div>

        <div className="text-[15px] font-bold text-[#0F172A]">
          No live conversations yet
        </div>

        <div className="mt-2 text-[12.5px] font-medium leading-6 text-[#64748B]">
          Conversations will appear here after a launch channel is connected and messages start coming in.
        </div>
      </div>
    </div>
  );
}

export default function InboxThreadListPanel({
  threadList,
  selectedThreadId = "",
  searchQuery = "",
  launchChannelConnected = true,
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

  if (!launchChannelConnected) {
    return (
      <section
        aria-labelledby="inbox-thread-list-title"
        className="flex h-full min-h-0 flex-col bg-transparent"
      >
        <div className="shrink-0 border-b border-[#E3E8F0] bg-[rgba(255,255,255,0.76)] px-4 py-5 backdrop-blur-xl">
          <h2
            id="inbox-thread-list-title"
            className="truncate text-[16px] font-bold tracking-[-0.02em] text-[#0F172A]"
          >
            All conversations
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <DisconnectedRailState />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="inbox-thread-list-title"
      className="flex h-full min-h-0 flex-col bg-transparent"
    >
      <div className="shrink-0 border-b border-[#E3E8F0] bg-[rgba(255,255,255,0.76)] backdrop-blur-xl">
        <div className="px-4 pb-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="inbox-thread-list-title"
                className="truncate text-[16px] font-bold tracking-[-0.02em] text-[#0F172A]"
              >
                All conversations
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative" ref={filterAnchorRef}>
                <ToolbarIconButton
                  icon={SlidersHorizontal}
                  label="Filter channels"
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

              <ToolbarIconButton
                icon={Search}
                label="Search conversations"
                active={searchOpen || Boolean(localSearch.trim())}
                onClick={handleOpenSearch}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 border-b border-[#E8EEF6] pb-2">
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
              ? "max-h-[82px] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          ].join(" ")}
          aria-hidden={!searchOpen}
        >
          <div className="border-t border-[#E8EEF6] px-4 py-3">
            <div className="flex h-11 items-center gap-3 rounded-[15px] border border-[#DFE7F1] bg-white px-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.22)]">
              <Search className="h-[16px] w-[16px] shrink-0 text-[#94A3B8]" />

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
                className="block h-full w-full border-0 bg-transparent px-0 text-[14px] font-medium text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />

              <button
                type="button"
                onClick={handleCloseSearch}
                aria-label="Close search"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              >
                <X className="h-[16px] w-[16px]" />
              </button>
            </div>
          </div>
        </div>

        {threadList?.deepLinkNotice ? (
          <div className="border-t border-[#E8EEF6] px-4 py-3">
            <p className="text-[12px] font-medium leading-5 text-[#B45309]">
              {threadList.deepLinkNotice}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {threadList?.surface?.loading && !filteredThreads.length ? (
          <div className="px-4 py-4">
            <InboxThreadListSkeleton />
          </div>
        ) : !filteredThreads.length ? (
          <EmptyState hasSearch={Boolean(localSearch.trim())} />
        ) : (
          <div className="divide-y divide-[#E7EDF5]">
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