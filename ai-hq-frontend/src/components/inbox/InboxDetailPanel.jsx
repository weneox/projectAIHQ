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

import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import InboxMessageBubble from "./InboxMessageBubble.jsx";
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
        "flex h-10 w-10 items-center justify-center rounded-full transition",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-400 hover:bg-white hover:text-slate-900",
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
      label: disabledMap.handoff ? "Activating..." : "Activate handoff",
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
      tone: "text-rose-600",
    },
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
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
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
              item.tone || "text-slate-700",
              item.disabled
                ? "cursor-not-allowed opacity-45"
                : "hover:bg-slate-50",
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
    <div className="border-b border-slate-200/70 bg-[#f6f6f7] px-5 py-4">
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
              className="h-11 w-11 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition group-hover:scale-[1.02]",
                avatarTone(name),
              ].join(" ")}
            >
              {initialsFromName(name)}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              {name}
            </div>
            {meta ? (
              <div className="truncate text-[13px] text-slate-500">{meta}</div>
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
            active={false}
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
            <span className="ml-1 inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#eef2ff] px-2 py-1 text-[11px] font-semibold text-[#4c6fff]">
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
    <div className="flex flex-col items-center px-6 pb-8 pt-10 text-center">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-28 w-28 rounded-full object-cover shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
          loading="lazy"
        />
      ) : (
        <div
          className={[
            "flex h-28 w-28 items-center justify-center rounded-full text-[30px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
            avatarTone(name),
          ].join(" ")}
        >
          {initialsFromName(name)}
        </div>
      )}

      <div className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
        {name}
      </div>

      {meta ? (
        <div className="mt-1 text-[14px] text-slate-500">{meta}</div>
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [selectedThread?.id]);

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
    <section className="relative flex h-full min-h-0 flex-col bg-[#f6f6f7]">
      {hasThread ? (
        <ConversationTopBar
          thread={selectedThread}
          unreadCount={unreadCount}
          onOpenDetails={onOpenDetails}
          onRefresh={surface?.refresh}
          onMenuToggle={() => setMenuOpen((prev) => !prev)}
          menuOpen={menuOpen}
          menuAnchorRef={menuAnchorRef}
          surface={surface}
          menu={
            <DetailActionMenu
              open={menuOpen}
              anchorRef={menuAnchorRef}
              onClose={() => setMenuOpen(false)}
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
      ) : (
        <div className="border-b border-slate-200/70 bg-[#f6f6f7] px-5 py-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Conversation
          </div>
        </div>
      )}

      {showSurfaceBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-[78px] z-20 flex justify-center px-4 pt-3">
          <div className="pointer-events-auto w-full max-w-[760px]">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Conversation detail is temporarily unavailable."
              refreshLabel="Refresh conversation"
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f6f7] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!hasThread ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
                Conversation workspace
              </div>
              <div className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-500">
                Select a thread to open the timeline.
              </div>
            </div>
          ) : surface?.loading ? (
            <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-sm text-slate-500">
              Loading messages...
            </div>
          ) : (
            <div className="px-0 py-0">
              <ConversationProfileIntro thread={selectedThread} />

              {messages.length === 0 ? (
                <div className="px-6 pb-10 text-center">
                  <div className="text-[15px] font-medium text-slate-900">
                    No messages yet
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    This conversation has no message history yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-4 px-6 pb-6">
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