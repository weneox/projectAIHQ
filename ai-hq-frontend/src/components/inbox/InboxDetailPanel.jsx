import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
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

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const tones = [
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
  ];

  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function resolveDisplayName(thread = {}) {
  return (
    s(thread.customer_name) ||
    s(thread.external_username) ||
    s(thread.external_user_id) ||
    "Conversation"
  );
}

function resolveAvatarUrl(thread = {}) {
  return (
    s(thread.avatar_url) ||
    s(thread.profile_image_url) ||
    s(thread.customer_avatar_url) ||
    s(thread.external_avatar_url) ||
    s(thread.photo_url)
  );
}

function formatConversationMeta(thread = {}) {
  const parts = [];

  const channel =
    s(thread.channel_label) ||
    s(thread.channel_type) ||
    s(thread.provider) ||
    s(thread.source_type);

  const state =
    s(thread.status_label) ||
    s(thread.status) ||
    (thread?.handoff_active ? "handoff" : "");

  if (channel) parts.push(channel);
  if (state && state.toLowerCase() !== "open") parts.push(state);

  return parts.filter(Boolean).join(" | ");
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
        "flex h-9 w-9 items-center justify-center rounded-soft border transition-colors",
        active
          ? "border-line-strong bg-surface-subtle text-text"
          : "border-line bg-surface text-text-muted hover:bg-surface-subtle hover:text-text",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {children}
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
  onCloseThread,
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
      icon: Sparkles,
      onClick: onResolve,
      disabled: disabledMap.resolved,
    },
    {
      key: "closed",
      label: disabledMap.closed ? "Closing..." : "Close",
      icon: XCircle,
      onClick: onCloseThread,
      disabled: disabledMap.closed,
      tone: "text-danger",
    },
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-panel border border-line bg-surface p-1.5 shadow-panel"
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
              "flex w-full items-center gap-3 rounded-soft px-3 py-2.5 text-left text-[13px] transition-colors",
              item.tone || "text-text-muted",
              item.disabled
                ? "cursor-not-allowed opacity-45"
                : "hover:bg-surface-subtle hover:text-text",
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

function ConversationTopBar({
  thread,
  unreadCount,
  onOpenDetails,
  onRefresh,
  onMenuToggle,
  menuOpen,
  menuAnchorRef,
  menu,
  surface,
}) {
  const name = resolveDisplayName(thread);
  const meta = formatConversationMeta(thread);
  const avatarUrl = resolveAvatarUrl(thread);

  return (
    <div className="border-b border-line-soft bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label="Open conversation details"
          className="group flex min-w-0 items-center gap-3 text-left"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-10 w-10 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                avatarTone(name),
              ].join(" ")}
            >
              {initialsFromName(name)}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-text">{name}</div>
            {meta ? (
              <div className="truncate text-[12px] text-text-muted">{meta}</div>
            ) : null}
          </div>
        </button>

        <div className="flex items-center gap-1">
          <QuietIconButton
            onClick={onRefresh}
            disabled={!thread?.id || surface?.loading || surface?.saving}
            label="Refresh conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </QuietIconButton>

          <QuietIconButton
            onClick={onOpenDetails}
            disabled={!thread?.id}
            label="Open detail drawer"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </QuietIconButton>

          <div className="relative" ref={menuAnchorRef}>
            <QuietIconButton
              onClick={onMenuToggle}
              disabled={!thread?.id}
              label="Conversation actions"
              active={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </QuietIconButton>

            {menu}
          </div>

          {unreadCount > 0 ? (
            <span className="ml-1 inline-flex min-w-[22px] items-center justify-center rounded-pill bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
              {unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConversationProfileIntro({ thread }) {
  const name = resolveDisplayName(thread);
  const meta = formatConversationMeta(thread);
  const avatarUrl = resolveAvatarUrl(thread);

  return (
    <div className="flex flex-col items-center border-b border-line-soft px-6 pb-6 pt-6 text-center">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-16 w-16 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className={[
            "flex h-16 w-16 items-center justify-center rounded-full text-[20px] font-semibold",
            avatarTone(name),
          ].join(" ")}
        >
          {initialsFromName(name)}
        </div>
      )}

      <div className="mt-3 text-[16px] font-semibold text-text">{name}</div>

      {meta ? (
        <div className="mt-1 text-[13px] text-text-muted">{meta}</div>
      ) : null}
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
  composer = null,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const currentThreadId = s(selectedThread?.id);

  const [openMenuThreadId, setOpenMenuThreadId] = useState("");
  const menuAnchorRef = useRef(null);

  const menuOpen = Boolean(currentThreadId) && openMenuThreadId === currentThreadId;

  function closeMenu() {
    setOpenMenuThreadId("");
  }

  function toggleMenu() {
    if (!currentThreadId) return;
    setOpenMenuThreadId((prev) => (prev === currentThreadId ? "" : currentThreadId));
  }

  const showSurfaceBanner = hasThread && (
    surface?.unavailable ||
    surface?.availability === "unavailable" ||
    surface?.error ||
    surface?.saveError ||
    surface?.saveSuccess
  );

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

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-surface">
      {hasThread ? (
        <ConversationTopBar
          thread={selectedThread}
          unreadCount={unreadCount}
          onOpenDetails={onOpenDetails}
          onRefresh={surface?.refresh}
          onMenuToggle={toggleMenu}
          menuOpen={menuOpen}
          menuAnchorRef={menuAnchorRef}
          surface={surface}
          menu={
            <DetailActionMenu
              open={menuOpen}
              anchorRef={menuAnchorRef}
              onClose={closeMenu}
              onMarkRead={() => markRead(selectedThread.id)}
              canMarkRead={canMarkRead}
              onAssign={() => assignThread(selectedThread.id)}
              onHandoff={() => activateHandoff(selectedThread.id)}
              onResolve={() => setThreadStatus(selectedThread.id, "resolved")}
              onCloseThread={() => setThreadStatus(selectedThread.id, "closed")}
              disabledMap={disabledMap}
            />
          }
        />
      ) : surface?.loading && !hasThread ? (
        <div className="border-b border-line-soft bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-surface-subtle" />
              <div className="min-w-0 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded-md bg-surface-subtle" />
                <div className="h-3 w-24 animate-pulse rounded-md bg-surface-subtle" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-9 animate-pulse rounded-soft bg-surface-subtle" />
              <div className="h-9 w-9 animate-pulse rounded-soft bg-surface-subtle" />
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b border-line-soft bg-surface px-4 py-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-subtle">
            Conversation
          </div>
        </div>
      )}

      {showSurfaceBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-[74px] z-20 flex justify-center px-4 pt-3">
          <div className="pointer-events-auto w-full max-w-[760px]">
            <SurfaceBanner
              surface={surface}
              unavailableMessage="Conversation detail is temporarily unavailable."
              refreshLabel="Refresh conversation"
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {surface?.loading && !hasThread ? (
            <InboxDetailSkeleton />
          ) : !hasThread ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="text-[16px] font-semibold text-text">
                Conversation workspace
              </div>
              <div className="mt-2 max-w-[34rem] text-[13px] leading-6 text-text-muted">
                Select a thread to open the timeline.
              </div>
            </div>
          ) : (
            <div>
              <ConversationProfileIntro thread={selectedThread} />

              {messages.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="text-[15px] font-medium text-text">
                    No messages yet
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-text-muted">
                    This conversation has no message history yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-4 px-6 py-6">
                  {messages.map((message) => (
                    <InboxMessageBubble
                      key={message.id}
                      m={message}
                      attemptsByCorrelation={attemptsByCorrelation}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {composer}
      </div>
    </section>
  );
}
