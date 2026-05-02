import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Globe2,
  Inbox,
  MessageCircle,
  Power,
  Search,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";

import InboxThreadCard from "./InboxThreadCard.jsx";
import { InboxThreadListSkeleton } from "./InboxLoadingSurface.jsx";
import Input from "../ui/Input.jsx";
import { cx } from "../../lib/cx.js";

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
      className={cx(
        "relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[7px] border",
        "transition-[background-color,border-color,color] duration-base ease-premium",
        selected
          ? "border-success bg-success text-white"
          : "border-line bg-surface text-transparent group-hover:border-line-strong"
      )}
    >
      <Check
        className={cx(
          "h-[12px] w-[12px] transition-opacity duration-base ease-premium",
          selected ? "opacity-100" : "opacity-0"
        )}
        strokeWidth={3}
      />
    </span>
  );
}

function AllChannelsLeadMark({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
        "transition-[background-color,color] duration-base ease-premium",
        selected ? "bg-success text-white" : "bg-surface-subtle text-text-subtle"
      )}
    >
      <Check
        className={cx(
          "h-[11px] w-[11px] transition-opacity duration-base ease-premium",
          selected ? "opacity-100" : "opacity-80"
        )}
        strokeWidth={3.1}
      />
    </span>
  );
}

function ChannelLogo({ value, selected = false }) {
  const normalized = normalizeChannelValue(value);

  const imgClassName = cx(
    "block h-[22px] w-[22px] shrink-0 object-contain transition-opacity duration-base ease-premium",
    selected ? "opacity-100" : "opacity-90"
  );

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
        className={cx(
          "h-[21px] w-[21px] shrink-0 transition-colors duration-base ease-premium",
          selected ? "text-brand" : "text-text-muted"
        )}
        strokeWidth={2.05}
      />
    );
  }

  return (
    <Globe2
      className={cx(
        "h-[21px] w-[21px] shrink-0 transition-colors duration-base ease-premium",
        selected ? "text-brand" : "text-text-muted"
      )}
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
      className={cx(
        "absolute right-0 top-[calc(100%+10px)] z-[180] w-[268px] origin-top-right",
        "transition-[opacity,transform,visibility] duration-base ease-premium",
        open
          ? "visible translate-y-0 scale-100 opacity-100"
          : "invisible pointer-events-none -translate-y-1 scale-[0.985] opacity-0"
      )}
    >
      <div
        ref={menuRef}
        className={cx(
          "overflow-hidden rounded-[20px] border border-line bg-surface p-2",
          "shadow-[0_34px_86px_-44px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.92)]"
        )}
      >
        <div className="px-2 pb-2 pt-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
            Channels
          </div>
        </div>

        <div className="space-y-1">
          {options.map((option) => {
            const isAll = option.value === "all";
            const selected = isAll
              ? allSelected
              : !allSelected && selectedChannelValues?.includes(option.value);

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
                className={cx(
                  "group flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left",
                  "transition-[background-color,color] duration-base ease-premium",
                  selected
                    ? "bg-brand-soft text-brand"
                    : "text-text-muted hover:bg-surface-subtle hover:text-text"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ChannelLogo value={option.value} selected={selected} />

                  <span className="block min-w-0 truncate text-[13px] font-semibold leading-5">
                    {option.label}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={cx(
                      "min-w-[14px] text-right text-[11px] font-semibold transition-colors duration-base ease-premium",
                      selected ? "text-brand" : "text-text-subtle"
                    )}
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
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
        "border-0 bg-transparent transition-[background-color,color,opacity] duration-base ease-premium",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-brand),0.24)] focus-visible:ring-offset-2",
        active
          ? "text-brand"
          : "text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={2.25} />
    </button>
  );
}

function SearchSurface({ open, value, inputRef, onChange, onClose }) {
  return (
    <div
      aria-hidden={!open}
      className={cx(
        "absolute inset-0 min-w-0 origin-right",
        "transition-[opacity,transform] duration-slow ease-premium",
        open
          ? "pointer-events-auto translate-x-0 scale-x-100 opacity-100"
          : "pointer-events-none translate-x-3 scale-x-[0.9] opacity-0"
      )}
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-text-subtle transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-brand),0.24)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        }
        className="h-10 min-w-0 shadow-none"
        inputClassName="!h-10 !text-[13.5px]"
      />
    </div>
  );
}


function InboxAutopilotControl({
  automationControl = null,
  onToggleAutomation,
  hidden = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const enabled = Boolean(automationControl?.enabled);
  const saving = Boolean(automationControl?.saving);
  const disabled = Boolean(automationControl?.disabled || saving);
  const statusLabel = enabled ? "ON" : "OFF";

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleToggle(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (disabled) return;
    if (typeof onToggleAutomation !== "function") return;

    onToggleAutomation(!enabled);
  }

  return (
    <div
      ref={rootRef}
      className={cx(
        "relative z-[190] shrink-0 transition-[opacity,transform,width] duration-base ease-premium",
        hidden
          ? "pointer-events-none w-0 translate-x-2 opacity-0"
          : "w-auto translate-x-0 opacity-100"
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Turn off inbox AI" : "Turn on inbox AI"}
        title={enabled ? "AI ON" : "AI OFF"}
        className={cx(
          "relative inline-flex h-[30px] w-[66px] shrink-0 items-center rounded-full border",
          "transition-[background-color,border-color,opacity] duration-base ease-premium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-brand),0.24)] focus-visible:ring-offset-2",
          disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
          enabled
            ? "border-[rgba(var(--color-brand),0.34)] bg-brand text-white"
            : "border-[rgba(148,163,184,0.28)] bg-slate-300 text-white"
        )}
      >
        <span
          className={cx(
            "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 text-[10px] font-bold uppercase leading-none tracking-[0.08em]",
            enabled ? "left-2" : "right-2"
          )}
        >
          {enabled ? "ON" : "OFF"}
        </span>

        <span
          aria-hidden="true"
          className={cx(
            "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_5px_12px_-6px_rgba(15,23,42,0.55)]",
            "transition-transform duration-base ease-premium",
            enabled ? "translate-x-[39px]" : "translate-x-[3px]"
          )}
        />
      </button>

      <div
        className={cx(
          "absolute right-0 top-[calc(100%+10px)] z-[220] w-[286px] origin-top-right",
          "transition-[opacity,transform,visibility] duration-base ease-premium",
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible pointer-events-none -translate-y-1 scale-[0.985] opacity-0"
        )}
      >
        <div className="overflow-hidden rounded-[22px] border border-line bg-white p-3 shadow-[0_34px_86px_-44px_rgba(15,23,42,0.36),inset_0_1px_0_rgba(255,255,255,0.95)]">
          <div className="flex items-start gap-3">
            <div
              className={cx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]",
                enabled
                  ? "bg-brand-soft text-brand"
                  : "bg-surface-subtle text-text-muted"
              )}
            >
              <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.25} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-text">
                Inbox AI Autopilot
              </div>
              <div className="mt-1 text-[12px] font-medium leading-5 text-text-muted">
                {enabled
                  ? "BÃ¼tÃ¼n inbox Ã¼zrÉ™ avtomatik AI cavablarÄ± aktivdir. AyrÄ± sÃ¶hbÉ™tlÉ™ri ayrÄ±ca dayandÄ±rmaq olar."
                  : "Inbox Ã¼zrÉ™ AI cavablarÄ± sÃ¶ndÃ¼rÃ¼lÃ¼b. HeÃ§ bir sÃ¶hbÉ™tdÉ™ avtomatik cavab getmÉ™yÉ™cÉ™k."}
              </div>
            </div>
          </div>

          {automationControl?.disabledReason ? (
            <div className="mt-3 rounded-[14px] bg-warning-soft px-3 py-2 text-[11.5px] font-semibold leading-5 text-warning">
              {automationControl.disabledReason}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={cx(
              "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px]",
              "border text-[12.5px] font-semibold transition-colors duration-base ease-premium",
              "disabled:cursor-not-allowed disabled:opacity-55",
              enabled
                ? "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                : "border-[rgba(37,99,235,0.18)] bg-brand-soft text-brand hover:bg-[rgba(var(--color-brand),0.12)]"
            )}
          >
            <Power className="h-[14px] w-[14px]" strokeWidth={2.25} />
            <span>{enabled ? "Turn off inbox AI" : "Turn on inbox AI"}</span>
          </button>

          <div className="mt-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Global Â· {statusLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderTitle({ hidden }) {
  return (
    <div
      className={cx(
        "absolute inset-0 flex min-w-0 items-center",
        "transition-[opacity,transform] duration-slow ease-premium",
        hidden
          ? "pointer-events-none -translate-x-2 opacity-0"
          : "pointer-events-auto translate-x-0 opacity-100"
      )}
    >
      <h2
        id="inbox-thread-list-title"
        className="truncate text-[16px] font-semibold tracking-[var(--tracking-tight-lg)] text-text"
      >
        All conversations
      </h2>
    </div>
  );
}

function TopTabs({ activeValue, onChange }) {
  return (
    <div className="border-b border-line-soft px-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
      <div className="relative flex h-10 items-center gap-7">
        {TOP_TABS.map((tab) => {
          const active = activeValue === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange?.(tab.value)}
              aria-pressed={active}
              className={cx(
                "relative inline-flex h-10 items-center border-b-2 px-1 text-[12.5px] font-semibold",
                "transition-[border-color,color] duration-base ease-premium",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-brand),0.24)] focus-visible:ring-offset-2",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-text-muted hover:text-text"
              )}
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
      <div className="rounded-[22px] border border-line-soft bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] px-4 py-7 text-center shadow-[0_20px_46px_-42px_rgba(15,23,42,0.22)]">
        <div className="text-[14px] font-semibold text-text">
          {hasSearch || hasChannelFilter
            ? "No matching conversations"
            : "No conversations yet"}
        </div>
        <div className="mt-2 text-[12.5px] font-medium leading-6 text-text-muted">
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
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-line-soft bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F7FB_100%)] shadow-[0_24px_50px_-42px_rgba(15,23,42,0.24)]">
            <Inbox className="h-8 w-8 text-text-subtle" strokeWidth={1.8} />
          </div>
        </div>

        <div className="text-[15px] font-semibold text-text">
          No live conversations yet
        </div>

        <div className="mt-2 text-[12.5px] font-medium leading-6 text-text-muted">
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
  automationControl = null,
  onToggleAutomation,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const deferredSearch = useDeferredValue(localSearch);
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

  const canShowThreadRail =
    launchChannelConnected ||
    baseThreads.length > 0 ||
    Boolean(s(selectedThreadId)) ||
    Boolean(s(threadList?.deepLinkNotice));

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

  const searchableThreads = useMemo(() => {
    return baseThreads.map((thread) => ({
      thread,
      searchText: [
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
        .toLowerCase(),
    }));
  }, [baseThreads]);

  const filteredThreads = useMemo(() => {
    const needle = String(deferredSearch || "").trim().toLowerCase();

    return searchableThreads
      .filter(({ thread }) => channelMatches(thread, selectedChannelValues))
      .filter(({ searchText }) => !needle || searchText.includes(needle))
      .map(({ thread }) => thread);
  }, [deferredSearch, searchableThreads, selectedChannelValues]);

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

  if (!canShowThreadRail) {
    return (
      <section
        aria-labelledby="inbox-thread-list-title"
        className="relative flex h-full min-h-0 flex-col bg-transparent"
      >
        <div className="shrink-0 border-b border-line-soft bg-surface/90 px-4 py-5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
          <h2
            id="inbox-thread-list-title"
            className="truncate text-[16px] font-semibold tracking-[var(--tracking-tight-lg)] text-text"
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
      <div className="relative z-40 shrink-0 overflow-visible bg-surface/92">
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

            <InboxAutopilotControl
              automationControl={automationControl}
              onToggleAutomation={onToggleAutomation}
              hidden={searchOpen}
            />

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
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
                  "border-0 bg-transparent transition-[background-color,color,opacity] duration-base ease-premium",
                  searchOpen
                    ? "pointer-events-none opacity-0"
                    : "pointer-events-auto opacity-100",
                  localSearch.trim()
                    ? "text-brand"
                    : "text-text-muted hover:bg-surface-subtle hover:text-text",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--color-brand),0.24)] focus-visible:ring-offset-2"
                )}
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
          <div className="border-b border-line-soft px-4 py-3 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
            <p className="text-[12px] font-medium leading-5 text-warning">
              {threadList.deepLinkNotice}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
        {threadList?.surface?.loading ? (
          <InboxThreadListSkeleton />
        ) : filteredThreads.length ? (
          <div className="divide-y divide-line-soft">
            {filteredThreads.map((thread) => (
              <InboxThreadCard
                key={thread.id}
                thread={thread}
                selected={s(thread.id) === s(selectedThreadId)}
                onOpen={threadList?.openThread}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            hasSearch={Boolean(String(localSearch || "").trim())}
            hasChannelFilter={hasChannelFilter}
          />
        )}
      </div>
    </section>
  );
}
