import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  MoreHorizontal,
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

  return parts.filter(Boolean).join(" • ");
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
      icon: ShieldAlert,
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

function InboxAutomationSwitch({ automationControl, onToggle }) {
  const loading = automationControl?.loading === true;
  const saving = automationControl?.saving === true;
  const enabled = automationControl?.enabled === true;
  const disabled = automationControl?.disabled === true;

  return (
    <div className="flex items-center gap-2 rounded-pill border border-line bg-surface-subtle px-2.5 py-1.5">
      <span className="text-[12px] font-medium text-text">Auto-reply</span>

      <span
        className={[
          "hidden md:inline-flex rounded-pill px-2 py-0.5 text-[10px] font-medium",
          enabled
            ? "bg-[rgba(var(--color-success),0.12)] text-[rgb(var(--color-success))]"
            : "bg-[rgba(var(--color-warning),0.14)] text-[rgb(var(--color-warning))]",
        ].join(" ")}
      >
        {loading ? "Checking" : enabled ? "On" : "Off"}
      </span>

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
          "relative inline-flex h-6 w-10 items-center rounded-full border transition-all duration-base ease-premium",
          enabled
            ? "border-brand bg-brand"
            : "border-line-strong bg-surface",
          disabled || loading || saving ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4.5 w-4.5 rounded-full bg-white shadow-[0_8px_20px_-12px_rgba(15,23,42,0.45)] transition-transform duration-base ease-premium",
            enabled ? "translate-x-[20px]" : "translate-x-[3px]",
          ].join(" ")}
        />
      </button>
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
  automationControl,
  onToggleAutomation,
}) {
  const hasThread = Boolean(thread?.id);
  const title = hasThread
    ? s(thread.customer_name) ||
      s(thread.external_username) ||
      s(thread.external_user_id) ||
      "Conversation"
    : "Conversation";
  const meta = hasThread ? formatConversationMeta(thread) : "";

  return (
    <div className="border-b border-line-soft bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Conversation
          </div>
          <div className="mt-1 truncate text-[15px] font-semibold text-text">
            {title}
          </div>
          {meta ? (
            <div className="mt-0.5 truncate text-[12px] text-text-muted">
              {meta}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <InboxAutomationSwitch
            automationControl={automationControl}
            onToggle={onToggleAutomation}
          />

          <QuietIconButton
            onClick={onRefresh}
            disabled={!hasThread || surface?.loading || surface?.saving}
            label="Refresh conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </QuietIconButton>

          <QuietIconButton
            onClick={onOpenDetails}
            disabled={!hasThread}
            label="Open detail drawer"
          >
            <SlidersHorizontal className="h-4 w-4" />
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

function ConversationContextStrip({ thread }) {
  const channel =
    s(thread.channel_label) ||
    s(thread.channel_type) ||
    s(thread.provider) ||
    s(thread.source_type) ||
    "Conversation";

  const status =
    s(thread.status_label) ||
    s(thread.status) ||
    (thread?.handoff_active ? "handoff" : "open");

  const unreadCount = Number(thread?.unread_count || 0);

  return (
    <div className="border-b border-line-soft bg-surface px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
        <span>
          <span className="text-text-muted">Channel:</span> {channel}
        </span>
        <span className="text-slate-300">•</span>
        <span>
          <span className="text-text-muted">Status:</span> {status}
        </span>
        <span className="text-slate-300">•</span>
        <span>
          <span className="text-text-muted">Unread:</span> {unreadCount}
        </span>
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
}) {
  const hasThread = Boolean(selectedThread?.id);
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const currentThreadId = s(selectedThread?.id);

  const [openMenuThreadId, setOpenMenuThreadId] = useState("");
  const menuAnchorRef = useRef(null);
  const scrollViewportRef = useRef(null);

  const menuOpen =
    Boolean(currentThreadId) && openMenuThreadId === currentThreadId;

  useEffect(() => {
    if (!scrollViewportRef.current) return;
    scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
  }, [currentThreadId, messages.length]);

  function closeMenu() {
    setOpenMenuThreadId("");
  }

  function toggleMenu() {
    if (!currentThreadId) return;
    setOpenMenuThreadId((prev) => (prev === currentThreadId ? "" : currentThreadId));
  }

  const showSurfaceBanner =
    hasThread &&
    (surface?.unavailable ||
      surface?.availability === "unavailable" ||
      surface?.error ||
      surface?.saveError ||
      surface?.saveSuccess);

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
      <ConversationTopBar
        thread={selectedThread}
        unreadCount={unreadCount}
        onOpenDetails={onOpenDetails}
        onRefresh={surface?.refresh}
        onMenuToggle={toggleMenu}
        menuOpen={menuOpen}
        menuAnchorRef={menuAnchorRef}
        surface={surface}
        automationControl={automationControl}
        onToggleAutomation={onToggleAutomation}
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

      {showSurfaceBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-20 flex justify-center px-4 pt-3">
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
        <div
          ref={scrollViewportRef}
          className="min-h-0 flex-1 overflow-y-auto bg-surface-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {surface?.loading && !hasThread ? (
            <InboxDetailSkeleton />
          ) : !hasThread ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="text-[16px] font-semibold text-text">
                Conversation workspace
              </div>
              <div className="mt-2 max-w-[34rem] text-[13px] leading-6 text-text-muted">
                Select a thread to open the timeline.
              </div>
            </div>
          ) : (
            <div>
              <ConversationContextStrip thread={selectedThread} />

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
                <div className="space-y-3 px-5 py-4">
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