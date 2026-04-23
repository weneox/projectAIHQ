import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCheck,
  MoreHorizontal,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  UserCog,
  XCircle,
} from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import InboxMessageBubble from "./InboxMessageBubble.jsx";
import { InboxDetailSkeleton } from "./InboxLoadingSurface.jsx";
import { indexAttemptsByMessageCorrelation } from "./outboundAttemptTruth.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function looksLikeNumericIdentity(value = "") {
  const safe = s(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function normalizeUsername(value = "") {
  const safe = s(value).replace(/^@+/, "");
  if (!safe) return "";
  if (looksLikeNumericIdentity(safe)) return "";
  return safe;
}

function resolveConversationTitle(thread) {
  const displayName = s(thread?.display_name || thread?.displayName);
  const customerName = s(thread?.customer_name);
  const externalUsername = normalizeUsername(thread?.external_username);
  const externalUserId = s(thread?.external_user_id);
  const externalThreadId = s(thread?.external_thread_id);
  const channel = lower(
    thread?.channel || thread?.channel_type || thread?.provider || thread?.source_type
  );

  if (displayName && !isPlaceholderDisplayName(displayName)) {
    return displayName;
  }

  if (customerName && !looksLikeNumericIdentity(customerName)) {
    return customerName;
  }

  if (externalUsername) {
    return externalUsername;
  }

  if (channel === "instagram" && externalUserId) {
    return "Instagram User";
  }

  if (channel === "telegram" && externalUserId) {
    return "Telegram User";
  }

  if (externalUserId && !looksLikeNumericIdentity(externalUserId)) {
    return externalUserId;
  }

  if (externalThreadId && !looksLikeNumericIdentity(externalThreadId)) {
    return externalThreadId;
  }

  if (externalUserId) return "Customer";
  return "Conversation";
}

function resolveThreadAvatarUrl(thread) {
  return s(thread?.avatar_url || thread?.avatarUrl || "");
}

function resolveChannelLabel(thread) {
  const raw =
    s(thread?.channel_label) ||
    s(thread?.channel_type) ||
    s(thread?.provider) ||
    s(thread?.source_type) ||
    s(thread?.channel);

  if (!raw) return "";

  const normalized = raw.toLowerCase();

  if (normalized === "webchat") return "Web Chat";
  if (normalized === "web") return "Website";
  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "telegram") return "Telegram";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "email") return "Email";

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCustomerSince(value = "") {
  const safe = s(value);
  if (!safe) return "";

  const date = new Date(safe);
  if (Number.isNaN(date.getTime())) return "";

  return `Customer since ${date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })}`;
}

function formatConversationMeta(thread) {
  const items = [];

  const channel = resolveChannelLabel(thread);
  const customerSince = formatCustomerSince(thread?.created_at);
  const status =
    s(thread?.status_label) ||
    s(thread?.status) ||
    (thread?.handoff_active ? "handoff active" : "");

  if (customerSince) items.push(customerSince);

  if (
    status &&
    !["open", "conversation"].includes(String(status).toLowerCase())
  ) {
    items.push(
      status
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  if (channel) items.push(channel);

  return items;
}

function resolveOriginalMessageType(message = {}) {
  const meta = obj(message?.meta);
  return lower(meta?.originalMessageType || meta?.original_message_type || "");
}

function isControlLikeMessageType(value = "") {
  return [
    "system",
    "typing",
    "typing_on",
    "typing_off",
    "typing-on",
    "typing-off",
    "typingon",
    "typingoff",
    "typing_start",
    "typing_stop",
    "typing-start",
    "typing-stop",
    "mark_seen",
    "mark-seen",
    "markseen",
    "seen",
    "read",
    "delivery",
    "reaction",
    "echo",
  ].includes(lower(value));
}

function isRenderableConversationMessage(message = {}) {
  if (!message || typeof message !== "object") return false;

  const storageType = lower(message?.message_type);
  const originalType = resolveOriginalMessageType(message);
  const senderType = lower(message?.sender_type);
  const source = lower(message?.meta?.source);

  if (isControlLikeMessageType(storageType)) return false;
  if (isControlLikeMessageType(originalType)) return false;
  if (["system", "decision"].includes(senderType)) return false;
  if (
    ["decision", "decision_engine", "decision-event", "system"].includes(source)
  ) {
    return false;
  }

  return Boolean(s(message?.text));
}

function QuietIconButton({
  children,
  onClick,
  disabled = false,
  label = "",
  active = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all",
        active
          ? "border-[rgba(37,99,235,0.14)] bg-[rgba(239,246,255,0.96)] text-[rgba(37,99,235,0.96)]"
          : "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(71,85,105,0.92)] hover:border-[rgba(15,23,42,0.12)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.9)]",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function HeaderActionButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
  icon = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-[14px] border px-4 text-[13px] font-medium transition-all",
        tone === "danger"
          ? "border-[rgba(239,68,68,0.12)] bg-white text-[rgba(185,28,28,0.94)] hover:bg-[rgba(254,242,242,0.92)]"
          : "border-[rgba(15,23,42,0.08)] bg-white text-[rgba(15,23,42,0.88)] hover:bg-[rgba(248,250,252,0.96)]",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DetailActionMenu({
  open,
  anchorRef,
  onClose,
  onMarkRead,
  canMarkRead,
  onAssign,
  onHandoff,
  onResolve,
  disabledMap,
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

  const items = [
    canMarkRead
      ? {
          key: "read",
          label: disabledMap.read ? "Marking..." : "Mark as read",
          icon: CheckCheck,
          onClick: onMarkRead,
          disabled: disabledMap.read,
        }
      : null,
    {
      key: "assign",
      label: disabledMap.assign ? "Assigning..." : "Assign",
      icon: UserCog,
      onClick: onAssign,
      disabled: disabledMap.assign,
    },
    {
      key: "handoff",
      label: disabledMap.handoff ? "Starting..." : "Start handoff",
      icon: ShieldAlert,
      onClick: onHandoff,
      disabled: disabledMap.handoff || disabledMap.handoffLocked,
    },
    {
      key: "resolved",
      label: disabledMap.resolved ? "Resolving..." : "Resolve",
      icon: CheckCheck,
      onClick: onResolve,
      disabled: disabledMap.resolved,
    },
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-[calc(100%+10px)] z-30 w-56 overflow-hidden rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white p-1.5 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.24)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              item.onClick?.();
              onClose?.();
            }}
            disabled={item.disabled}
            className={[
              "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13px] transition-colors",
              item.disabled
                ? "cursor-not-allowed opacity-45"
                : "text-[rgba(51,65,85,0.94)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.94)]",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InboxAutomationSwitch({ automationControl, onToggle }) {
  const loading = automationControl?.loading === true;
  const saving = automationControl?.saving === true;
  const enabled = automationControl?.enabled === true;
  const disabled = automationControl?.disabled === true;

  return (
    <div className="inline-flex items-center gap-3 rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[rgba(15,23,42,0.88)]">
          Auto-reply
        </span>

        <span
          className={[
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
            enabled
              ? "bg-[rgba(34,197,94,0.12)] text-[rgba(21,128,61,0.96)]"
              : "bg-[rgba(148,163,184,0.14)] text-[rgba(71,85,105,0.96)]",
          ].join(" ")}
        >
          {loading ? "Checking" : enabled ? "On" : "Off"}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={
          enabled
            ? "Disable inbox automatic replies"
            : "Enable inbox automatic replies"
        }
        title={s(automationControl?.disabledReason)}
        onClick={() => {
          if (disabled || loading || saving) return;
          onToggle?.(!enabled);
        }}
        disabled={disabled || loading || saving}
        className={[
          "relative inline-flex h-6 w-10 items-center rounded-full border transition-all duration-200",
          enabled
            ? "border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.98)]"
            : "border-[rgba(15,23,42,0.12)] bg-[rgba(148,163,184,0.28)]",
          disabled || loading || saving ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4.5 w-4.5 rounded-full bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.42)] transition-transform duration-200",
            enabled ? "translate-x-[20px]" : "translate-x-[3px]",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function ConversationIdentity({ thread }) {
  const title = resolveConversationTitle(thread);
  const metaItems = formatConversationMeta(thread);
  const avatar = initialsFromName(title);
  const avatarUrl = resolveThreadAvatarUrl(thread);
  const avatarIdentity = `${s(thread?.id)}::${avatarUrl}`;
  const [failedAvatarIdentity, setFailedAvatarIdentity] = useState("");
  const avatarFailed = failedAvatarIdentity === avatarIdentity;

  useEffect(() => {
    if (failedAvatarIdentity && failedAvatarIdentity !== avatarIdentity) {
      setFailedAvatarIdentity("");
    }
  }, [avatarIdentity, failedAvatarIdentity]);

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(219,234,254,0.96))] text-[16px] font-semibold text-[rgba(37,99,235,0.96)] ring-1 ring-[rgba(37,99,235,0.10)]">
        {avatarUrl && !avatarFailed ? (
          <img
            key={avatarIdentity}
            src={avatarUrl}
            alt={title}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailedAvatarIdentity(avatarIdentity)}
          />
        ) : (
          avatar
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[16px] font-semibold text-[rgba(15,23,42,0.96)]">
          {title}
        </div>

        {metaItems.length ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[rgba(100,116,139,0.96)]">
            {metaItems.map((item, index) => (
              <div key={`${item}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? (
                  <span className="text-[rgba(203,213,225,0.96)]">•</span>
                ) : null}
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConnectChannelEmptyState({ onOpenChannels }) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center px-8 py-10">
      <div className="flex max-w-[560px] flex-col items-center text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 blur-3xl bg-[rgba(148,163,184,0.08)]" />
          <PlugZap
            className="relative h-24 w-24 text-[rgba(100,116,139,0.52)]"
            strokeWidth={1.55}
          />
        </div>

        <div className="text-[28px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.92)]">
          Connect a channel to activate the inbox
        </div>

        <div className="mt-3 max-w-[440px] text-[15px] leading-8 text-[rgba(100,116,139,0.96)]">
          Your live inbox will appear here once Website chat, Meta, Telegram,
          or another launch channel is connected.
        </div>

        <button
          type="button"
          onClick={onOpenChannels}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-[14px] bg-[rgba(37,99,235,0.98)] px-5 text-[14px] font-semibold text-white shadow-[0_22px_45px_-24px_rgba(37,99,235,0.62)] transition-all hover:-translate-y-[1px]"
        >
          <span>Open channels</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyComposerDock() {
  return (
    <div className="w-full px-6 pb-6">
      <div className="mx-auto w-full max-w-[960px] rounded-[26px] border border-[rgba(15,23,42,0.08)] bg-white/92 px-5 py-4 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.24)] backdrop-blur">
        <div className="flex items-end gap-4">
          <textarea
            disabled
            rows={1}
            placeholder="Write a reply"
            className="min-h-[58px] flex-1 resize-none bg-transparent px-0 py-3 text-[15px] text-[rgba(15,23,42,0.94)] placeholder:text-[rgba(148,163,184,0.96)] outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(148,163,184,0.22)] px-5 text-[13px] font-medium text-[rgba(100,116,139,0.96)]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingComposerSlot({ children }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0)_0%,rgba(248,250,252,0.70)_28%,rgba(248,250,252,0.94)_68%,rgba(248,250,252,0.985)_100%)] pt-14">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-8 py-10">
      <div className="w-full max-w-[520px] rounded-[28px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.88)] px-8 py-10 text-center shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]">
        <div className="text-[18px] font-semibold text-[rgba(15,23,42,0.96)]">
          Select a conversation
        </div>
        <div className="mt-2 text-[14px] leading-7 text-[rgba(100,116,139,0.96)]">
          Choose a conversation from the left to review the messages and send a reply.
        </div>
      </div>
    </div>
  );
}

function ConversationHeader({
  thread,
  unreadCount,
  onOpenDetails,
  onRefresh,
  onCloseThread,
  onMenuToggle,
  menuOpen,
  menuAnchorRef,
  menu,
  surface,
  automationControl,
  onToggleAutomation,
  disabledMap,
  launchChannelConnected,
}) {
  const hasThread = Boolean(thread?.id);

  if (!launchChannelConnected) {
    return (
      <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.88)] px-6 py-5 backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.78)]">
        <div>
          <div className="text-[16px] font-semibold text-[rgba(15,23,42,0.96)]">
            Inbox
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.88)] px-6 py-5 backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.78)]">
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0 flex-1">
          {hasThread ? (
            <ConversationIdentity thread={thread} />
          ) : (
            <div>
              <div className="text-[16px] font-semibold text-[rgba(15,23,42,0.96)]">
                Inbox
              </div>
              <div className="mt-1 text-[12.5px] text-[rgba(100,116,139,0.96)]">
                Select a conversation to view messages and reply.
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <InboxAutomationSwitch
            automationControl={automationControl}
            onToggle={onToggleAutomation}
          />

          <HeaderActionButton
            label="Details"
            onClick={onOpenDetails}
            disabled={!hasThread}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          />

          <HeaderActionButton
            label={disabledMap.closed ? "Closing..." : "Mark as closed"}
            onClick={onCloseThread}
            disabled={!hasThread || disabledMap.closed}
            tone="danger"
            icon={<XCircle className="h-4 w-4" />}
          />

          <QuietIconButton
            onClick={onRefresh}
            disabled={!hasThread || surface?.loading || surface?.saving}
            label="Refresh conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </QuietIconButton>

          <div className="relative" ref={menuAnchorRef}>
            <QuietIconButton
              onClick={onMenuToggle}
              disabled={!hasThread}
              label="Conversation actions"
              active={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </QuietIconButton>

            {menu}
          </div>

          {hasThread && unreadCount > 0 ? (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[rgba(37,99,235,0.98)] px-2 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function InboxDetailPanel({
  selectedThread,
  messages,
  outboundAttempts,
  surface,
  actionState,
  markRead,
  assignThread,
  activateHandoff,
  setThreadStatus,
  onOpenDetails,
  automationControl,
  onToggleAutomation,
  composer = null,
  launchChannelConnected = true,
  onOpenChannels = null,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const currentThreadId = s(selectedThread?.id);

  const [openMenuThreadId, setOpenMenuThreadId] = useState("");
  const menuAnchorRef = useRef(null);
  const scrollViewportRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const lastThreadIdRef = useRef("");

  const menuOpen =
    Boolean(currentThreadId) && openMenuThreadId === currentThreadId;

  const visibleMessages = useMemo(
    () =>
      Array.isArray(messages)
        ? messages.filter((message) => isRenderableConversationMessage(message))
        : [],
    [messages]
  );

  useEffect(() => {
    if (!hasThread) {
      shouldStickToBottomRef.current = true;
      lastThreadIdRef.current = "";
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const threadChanged = lastThreadIdRef.current !== currentThreadId;

    if (threadChanged || shouldStickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }

    lastThreadIdRef.current = currentThreadId;
  }, [currentThreadId, visibleMessages.length, hasThread]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return undefined;

    function updateStickState() {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom <= 120;
    }

    updateStickState();
    viewport.addEventListener("scroll", updateStickState, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", updateStickState);
    };
  }, [currentThreadId]);

  function closeMenu() {
    setOpenMenuThreadId("");
  }

  function toggleMenu() {
    if (!currentThreadId) return;
    setOpenMenuThreadId((prev) =>
      prev === currentThreadId ? "" : currentThreadId
    );
  }

  const attemptsByCorrelation = useMemo(
    () => indexAttemptsByMessageCorrelation(outboundAttempts),
    [outboundAttempts]
  );

  const disabledMap = {
    read: Boolean(actionState?.isActionPending?.("read")),
    assign: Boolean(actionState?.isActionPending?.("assign")),
    handoff: Boolean(actionState?.isActionPending?.("handoff")),
    handoffLocked: handoffActive,
    resolved: Boolean(actionState?.isActionPending?.("resolved")),
    closed: Boolean(actionState?.isActionPending?.("closed")),
  };

  const canMarkRead = hasThread && unreadCount > 0;

  const showSurfaceBanner =
    hasThread &&
    (surface?.unavailable ||
      surface?.availability === "unavailable" ||
      surface?.error ||
      surface?.saveError ||
      surface?.saveSuccess);

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]">
      <ConversationHeader
        thread={selectedThread}
        unreadCount={unreadCount}
        onOpenDetails={onOpenDetails}
        onRefresh={surface?.refresh}
        onCloseThread={() => {
          if (selectedThread?.id) {
            setThreadStatus(selectedThread.id, "closed");
          }
        }}
        onMenuToggle={toggleMenu}
        menuOpen={menuOpen}
        menuAnchorRef={menuAnchorRef}
        surface={surface}
        automationControl={automationControl}
        onToggleAutomation={onToggleAutomation}
        disabledMap={disabledMap}
        launchChannelConnected={launchChannelConnected}
        menu={
          <DetailActionMenu
            open={menuOpen}
            anchorRef={menuAnchorRef}
            onClose={closeMenu}
            onMarkRead={() => {
              if (selectedThread?.id) markRead(selectedThread.id);
            }}
            canMarkRead={canMarkRead}
            onAssign={() => {
              if (selectedThread?.id) assignThread(selectedThread.id);
            }}
            onHandoff={() => {
              if (selectedThread?.id) activateHandoff(selectedThread.id);
            }}
            onResolve={() => {
              if (selectedThread?.id) {
                setThreadStatus(selectedThread.id, "resolved");
              }
            }}
            disabledMap={disabledMap}
          />
        }
      />

      <div className="relative min-h-0 flex-1">
        {!launchChannelConnected ? (
          <ConnectChannelEmptyState onOpenChannels={onOpenChannels} />
        ) : (
          <>
            <div
              ref={scrollViewportRef}
              className="h-full overflow-y-auto pb-[280px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {surface?.loading && !hasThread ? (
                <InboxDetailSkeleton />
              ) : !hasThread ? (
                <EmptyConversationState />
              ) : (
                <div className="flex min-h-full w-full flex-col px-8 py-6 lg:px-10">
                  {showSurfaceBanner ? (
                    <div className="mb-4 w-full">
                      <SurfaceBanner
                        surface={surface}
                        unavailableMessage="Conversation detail is temporarily unavailable."
                        refreshLabel="Refresh conversation"
                      />
                    </div>
                  ) : null}

                  {!visibleMessages.length ? (
                    <div className="flex min-h-[320px] items-center justify-center">
                      <div className="w-full max-w-[520px] rounded-[26px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-8 py-10 text-center shadow-[0_30px_70px_-52px_rgba(15,23,42,0.16)]">
                        <div className="text-[18px] font-semibold text-[rgba(15,23,42,0.96)]">
                          No messages yet
                        </div>
                        <div className="mt-2 text-[14px] leading-7 text-[rgba(100,116,139,0.96)]">
                          This conversation has no visible message history yet.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto w-full space-y-6">
                      {visibleMessages.map((message) => (
                        <InboxMessageBubble
                          key={message.id}
                          m={message}
                          thread={selectedThread}
                          attemptsByCorrelation={attemptsByCorrelation}
                          enableInspect={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <FloatingComposerSlot>
              {hasThread && composer ? (
                <div className="w-full px-6 pb-6 [&>*]:mx-0 [&>*]:w-full [&>*]:max-w-none">
                  {composer}
                </div>
              ) : (
                <EmptyComposerDock />
              )}
            </FloatingComposerSlot>
          </>
        )}
      </div>
    </section>
  );
}