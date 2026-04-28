import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Globe2,
  Inbox,
  MessageCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";
import { InboxThreadListSkeleton } from "./InboxLoadingSurface.jsx";
import Input from "../ui/Input.jsx";

import globeLogo from "../../assets/channels/globe.png";
import gmailLogo from "../../assets/channels/gmail.svg";
import instagramLogo from "../../assets/channels/instagram.svg";
import messengerLogo from "../../assets/channels/messenger.svg";
import telegramLogo from "../../assets/channels/telegram.svg";
import whatsappLogo from "../../assets/channels/whatsapp.svg";

const TOP_TABS = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Handoff", value: "handoff" },
];

const PREMIUM_EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

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
  if (normalized === "messenger") return "Messenger";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "email") return "Email";
  if (normalized === "gmail") return "Gmail";
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

function channelMatches(thread = {}, selectedChannelValues = null) {
  if (selectedChannelValues === null) return true;
  if (!selectedChannelValues.length) return false;

  const raw =
    s(thread?.channel) ||
    s(thread?.channel_type) ||
    s(thread?.provider) ||
    s(thread?.source_type);

  return selectedChannelValues.includes(normalizeChannelValue(raw));
}

function getAllChannelValues(options = []) {
  return options
    .map((option) => option.value)
    .filter((value) => value && value !== "all");
}

function isAllChannelSelection(selectedChannelValues, allChannelValues) {
  if (selectedChannelValues === null) return true;
  if (!allChannelValues.length) return true;
  return selectedChannelValues.length >= allChannelValues.length;
}

function SelectionMark({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[7px] border",
        "transition-[background-color,border-color,box-shadow,color] duration-[220ms]",
        PREMIUM_EASE,
        selected
          ? "border-[#1FA361] bg-[#1FA361] text-white shadow-[0_12px_26px_-18px_rgba(31,163,97,0.7)]"
          : "border-[#D9E3EE] bg-white text-transparent shadow-[0_8px_18px_-18px_rgba(15,23,42,0.18)] group-hover:border-[#C8D5E4]",
      ].join(" ")}
    >
      <Check
        className={[
          "h-[12px] w-[12px] transition-opacity duration-[180ms]",
          selected ? "opacity-100" : "opacity-0",
        ].join(" ")}
        strokeWidth={3}
      />
    </span>
  );
}

function AllChannelsLeadMark({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
        "transition-[background-color,box-shadow,color] duration-[220ms]",
        PREMIUM_EASE,
        selected
          ? "bg-[#1FA361] text-white shadow-[0_12px_26px_-18px_rgba(31,163,97,0.68)]"
          : "bg-[#EAF1F7] text-[#8DA0B3]",
      ].join(" ")}
    >
      <Check
        className={[
          "h-[11px] w-[11px] transition-opacity duration-[180ms]",
          selected ? "opacity-100" : "opacity-80",
        ].join(" ")}
        strokeWidth={3.1}
      />
    </span>
  );
}

function ChannelLogo({ value, selected = false }) {
  const normalized = normalizeChannelValue(value);

  const imgClassName = [
    "block h-[22px] w-[22px] shrink-0 object-contain transition-opacity duration-[220ms]",
    selected ? "opacity-100" : "opacity-90",
  ].join(" ");

  if (normalized === "all") {
    return <AllChannelsLeadMark selected={selected} />;
  }

  if (normalized === "instagram") {
    return (
      <img
        src={instagramLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={imgClassName}
      />
    );
  }

  if (normalized === "telegram") {
    return (
      <img
        src={telegramLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={imgClassName}
      />
    );
  }

  if (
    normalized === "web" ||
    normalized === "website" ||
    normalized === "webchat"
  ) {
    return (
      <img
        src={globeLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="block h-[23px] w-[23px] shrink-0 object-contain"
      />
    );
  }

  if (normalized === "facebook" || normalized === "messenger") {
    return (
      <img
        src={messengerLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={imgClassName}
      />
    );
  }

  if (normalized === "whatsapp") {
    return (
      <img
        src={whatsappLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={imgClassName}
      />
    );
  }

  if (normalized === "email" || normalized === "gmail") {
    return (
      <img
        src={gmailLogo}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={imgClassName}
      />
    );
  }

  if (normalized === "voice") {
    return (
      <MessageCircle
        className={[
          "h-[21px] w-[21px] shrink-0 transition-colors duration-[220ms]",
          selected ? "text-[#2563EB]" : "text-[#607086]",
        ].join(" ")}
        strokeWidth={2.05}
      />
    );
  }

  return (
    <Globe2
      className={[
        "h-[21px] w-[21px] shrink-0 transition-colors duration-[220ms]",
        selected ? "text-[#2563EB]" : "text-[#607086]",
      ].join(" ")}
      strokeWidth={2.05}
    />
  );
}

function ChannelFilterMenu({
  open,
  anchorRef,
  selectedChannelValues,
  options,
  counts,
  onToggleAll,
  onToggleChannel,
  onClose,
}) {
  const menuRef = useRef(null);

  const allChannelValues = useMemo(() => getAllChannelValues(options), [options]);

  const allSelected = isAllChannelSelection(
    selectedChannelValues,
    allChannelValues
  );

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

  return (
    <div
      className={[
        "absolute right-0 top-[calc(100%+10px)] z-[180] w-[268px]",
        "origin-top-right transition-[opacity,transform,visibility,filter] duration-[220ms]",
        PREMIUM_EASE,
        open
          ? "visible translate-y-0 scale-100 opacity-100 blur-0"
          : "invisible pointer-events-none -translate-y-1 scale-[0.985] opacity-0 blur-[1px]",
      ].join(" ")}
    >
      <div
        ref={menuRef}
        className={[
          "overflow-hidden rounded-[20px] border border-[#D8E3F0]",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(248,251,255,0.965)_100%)] p-2 backdrop-blur-xl",
          "shadow-[0_34px_86px_-34px_rgba(15,23,42,0.34),0_18px_36px_-30px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.92)]",
        ].join(" ")}
      >
        <div
          className={[
            "px-2 pb-2 pt-1 transition-opacity duration-[160ms]",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#9AA8B9]">
            Channels
          </div>
        </div>

        <div className="space-y-1">
          {options.map((option) => {
            const isAll = option.value === "all";
            const selected = isAll
              ? allSelected
              : !allSelected &&
                selectedChannelValues?.includes(option.value);

            const count = Number(counts?.[option.value] ?? 0);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (isAll) {
                    onToggleAll?.();
                    return;
                  }

                  onToggleChannel?.(option.value);
                }}
                className={[
                  "group flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left",
                  "transition-[background-color,box-shadow,color,opacity] duration-[190ms]",
                  PREMIUM_EASE,
                  open ? "opacity-100" : "opacity-0",
                  selected
                    ? "bg-[linear-gradient(180deg,#EEF5FF_0%,#EAF2FF_100%)] text-[#1E5FD1] shadow-[0_16px_34px_-30px_rgba(37,99,235,0.45)]"
                    : "text-[#526174] hover:bg-[#F5F8FC] hover:text-[#0F172A]",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ChannelLogo value={option.value} selected={selected} />

                  <span className="block min-w-0 truncate text-[13px] font-bold leading-5">
                    {option.label}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={[
                      "min-w-[14px] text-right text-[11px] font-bold transition-colors duration-[180ms]",
                      selected ? "text-[#6389C4]" : "text-[#A2AFC0]",
                    ].join(" ")}
                  >
                    {count}
                  </span>

                  <SelectionMark selected={selected} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
        "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
        "border-0 bg-transparent transition-[background-color,color,opacity] duration-300",
        PREMIUM_EASE,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BBD3FF] focus-visible:ring-offset-2",
        active
          ? "text-[#2563EB]"
          : "text-[#64748B] hover:bg-[#F3F7FB] hover:text-[#0F172A]",
      ].join(" ")}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={2.25} />
    </button>
  );
}

function SearchSurface({ open, value, inputRef, onChange, onClose }) {
  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 min-w-0 origin-right",
        "transition-[opacity,transform,filter] duration-[420ms]",
        PREMIUM_EASE,
        open
          ? "pointer-events-auto translate-x-0 scale-x-100 scale-y-100 opacity-100 blur-0"
          : "pointer-events-none translate-x-3 scale-x-[0.88] scale-y-[0.96] opacity-0 blur-[1px]",
      ].join(" ")}
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Search conversations"
        aria-label="Search conversations"
        autoComplete="off"
        appearance="quiet"
        leftIcon={<Search className="h-[16px] w-[16px]" strokeWidth={2.15} />}
        right={
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-text-subtle transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BBD3FF]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        }
        className={[
          "h-10 min-w-0",
          "transition-[box-shadow,transform] duration-[420ms]",
          PREMIUM_EASE,
          open
            ? "shadow-[0_18px_44px_-36px_rgba(37,99,235,0.32)]"
            : "shadow-none",
        ].join(" ")}
        inputClassName="!h-10 !text-[13.5px]"
      />
    </div>
  );
}

function HeaderTitle({ hidden }) {
  return (
    <div
      className={[
        "absolute inset-0 flex min-w-0 items-center",
        "transition-[opacity,transform,filter] duration-[360ms]",
        PREMIUM_EASE,
        hidden
          ? "pointer-events-none -translate-x-2 opacity-0 blur-[1px]"
          : "pointer-events-auto translate-x-0 opacity-100 blur-0",
      ].join(" ")}
    >
      <h2
        id="inbox-thread-list-title"
        className="truncate text-[16px] font-bold tracking-[-0.02em] text-[#0F172A]"
      >
        All conversations
      </h2>
    </div>
  );
}

function TopTabs({ activeValue, onChange }) {
  const wrapRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const activeNode = tabRefs.current?.[activeValue];

    if (!wrap || !activeNode) return undefined;

    function measure() {
      const wrapRect = wrap.getBoundingClientRect();
      const nodeRect = activeNode.getBoundingClientRect();

      setIndicator({
        left: nodeRect.left - wrapRect.left,
        width: nodeRect.width,
        ready: true,
      });
    }

    measure();

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeValue]);

  return (
    <div className="border-b border-[#D6E1ED] px-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.035)]">
      <div ref={wrapRef} className="relative flex h-10 items-center gap-7">
        <span
          aria-hidden="true"
          className={[
            "absolute bottom-[-1px] h-[2px] rounded-full bg-[#2563EB]",
            "transition-[left,width,opacity] duration-[300ms]",
            PREMIUM_EASE,
            indicator.ready ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{
            left: indicator.left,
            width: indicator.width,
          }}
        />

        {TOP_TABS.map((tab) => {
          const active = activeValue === tab.value;

          return (
            <button
              key={tab.value}
              ref={(node) => {
                if (node) tabRefs.current[tab.value] = node;
              }}
              type="button"
              onClick={() => onChange?.(tab.value)}
              aria-pressed={active}
              className={[
                "relative inline-flex h-10 items-center px-1 text-[12.5px] font-bold",
                "transition-colors duration-[240ms]",
                PREMIUM_EASE,
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BBD3FF] focus-visible:ring-offset-2",
                active ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#0F172A]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ hasSearch, hasChannelFilter }) {
  return (
    <div className="px-4 py-8">
      <div className="rounded-[22px] border border-[#E4EAF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] px-4 py-7 text-center shadow-[0_20px_46px_-42px_rgba(15,23,42,0.26)]">
        <div className="text-[14px] font-bold text-[#0F172A]">
          {hasSearch || hasChannelFilter
            ? "No matching conversations"
            : "No conversations yet"}
        </div>
        <div className="mt-2 text-[12.5px] font-medium leading-6 text-[#64748B]">
          {hasSearch || hasChannelFilter
            ? "Try another channel or keyword."
            : "New conversations will appear here."}
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
          Conversations will appear here after a launch channel is connected and
          messages start coming in.
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
  const [selectedChannelValues, setSelectedChannelValues] = useState(null);
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
      Array.isArray(threadList?.filteredThreads)
        ? threadList.filteredThreads
        : [],
    [threadList?.filteredThreads]
  );

  const channelOptions = useMemo(
    () => buildChannelOptions(baseThreads),
    [baseThreads]
  );

  const allChannelValues = useMemo(
    () => getAllChannelValues(channelOptions),
    [channelOptions]
  );

  const allChannelsSelected = isAllChannelSelection(
    selectedChannelValues,
    allChannelValues
  );

  const hasChannelFilter = !allChannelsSelected;

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
    if (selectedChannelValues === null) return;

    const validValues = new Set(allChannelValues);
    const nextValues = selectedChannelValues.filter((value) =>
      validValues.has(value)
    );

    if (nextValues.length === allChannelValues.length && allChannelValues.length) {
      setSelectedChannelValues(null);
      return;
    }

    if (nextValues.length !== selectedChannelValues.length) {
      setSelectedChannelValues(nextValues);
    }
  }, [allChannelValues, selectedChannelValues]);

  const filteredThreads = useMemo(() => {
    const byChannel = baseThreads.filter((thread) =>
      channelMatches(thread, selectedChannelValues)
    );

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
  }, [baseThreads, localSearch, selectedChannelValues]);

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

  function handleToggleAllChannels() {
    setSelectedChannelValues((current) => {
      const currentlyAll = isAllChannelSelection(current, allChannelValues);
      return currentlyAll ? [] : null;
    });
  }

  function handleToggleChannel(value) {
    const normalized = normalizeChannelValue(value);
    if (!normalized || normalized === "all") return;

    setSelectedChannelValues((current) => {
      const currentlyAll = isAllChannelSelection(current, allChannelValues);

      if (currentlyAll) {
        return [normalized];
      }

      const currentSet = new Set(current || []);

      if (currentSet.has(normalized)) {
        currentSet.delete(normalized);
      } else {
        currentSet.add(normalized);
      }

      const nextValues = Array.from(currentSet).filter((item) =>
        allChannelValues.includes(item)
      );

      if (nextValues.length === allChannelValues.length && allChannelValues.length) {
        return null;
      }

      return nextValues;
    });
  }

  if (!launchChannelConnected) {
    return (
      <section
        aria-labelledby="inbox-thread-list-title"
        className="relative flex h-full min-h-0 flex-col bg-transparent"
      >
        <div className="shrink-0 border-b border-[#D6E1ED] bg-[rgba(255,255,255,0.78)] px-4 py-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.035)] backdrop-blur-xl">
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
      className="relative isolate flex h-full min-h-0 flex-col bg-transparent"
    >
      <div className="relative z-40 shrink-0 overflow-visible bg-[rgba(255,255,255,0.82)] backdrop-blur-xl">
        <div className="px-4 pb-3 pt-5">
          <div className="flex h-10 items-center justify-between gap-3">
            <div className="relative h-10 min-w-0 flex-1">
              <HeaderTitle hidden={searchOpen} />

              <SearchSurface
                open={searchOpen}
                value={localSearch}
                inputRef={searchInputRef}
                onChange={setLocalSearch}
                onClose={handleCloseSearch}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="relative z-[180]" ref={filterAnchorRef}>
                <ToolbarIconButton
                  icon={SlidersHorizontal}
                  label="Filter channels"
                  active={hasChannelFilter || filterMenuOpen}
                  onClick={handleToggleFilterMenu}
                  expanded={filterMenuOpen}
                />

                <ChannelFilterMenu
                  open={filterMenuOpen}
                  anchorRef={filterAnchorRef}
                  selectedChannelValues={selectedChannelValues}
                  options={channelOptions}
                  counts={channelCounts}
                  onToggleAll={handleToggleAllChannels}
                  onToggleChannel={handleToggleChannel}
                  onClose={() => setFilterMenuOpen(false)}
                />
              </div>

              <button
                type="button"
                onClick={searchOpen ? handleCloseSearch : handleOpenSearch}
                aria-label={searchOpen ? "Close search" : "Search conversations"}
                title={searchOpen ? "Close search" : "Search conversations"}
                className={[
                  "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
                  "border-0 bg-transparent transition-[background-color,color,opacity] duration-300",
                  PREMIUM_EASE,
                  searchOpen
                    ? "pointer-events-none opacity-0"
                    : "pointer-events-auto opacity-100",
                  localSearch.trim()
                    ? "text-[#2563EB]"
                    : "text-[#64748B] hover:bg-[#F3F7FB] hover:text-[#0F172A]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BBD3FF] focus-visible:ring-offset-2",
                ].join(" ")}
              >
                <Search className="h-[17px] w-[17px]" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>

        <TopTabs
          activeValue={threadList?.filter || "all"}
          onChange={threadList?.setFilter}
        />

        {threadList?.deepLinkNotice ? (
          <div className="border-b border-[#D6E1ED] px-4 py-3 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
            <p className="text-[12px] font-medium leading-5 text-[#B45309]">
              {threadList.deepLinkNotice}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {threadList?.surface?.loading && !filteredThreads.length ? (
          <div className="px-4 py-4">
            <InboxThreadListSkeleton />
          </div>
        ) : !filteredThreads.length ? (
          <EmptyState
            hasSearch={Boolean(localSearch.trim())}
            hasChannelFilter={hasChannelFilter}
          />
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