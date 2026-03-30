import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
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

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
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

function QuietIconButton({ children, onClick, disabled = false, label = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function DetailActionMenu({
  open,
  anchorRef,
  onClose,
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
  ];

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

function formatConversationMeta(thread = {}) {
  const parts = [];

  const channel =
    s(thread.channel_label) ||
    s(thread.channel_type) ||
    s(thread.provider) ||
    s(thread.source_type);

  const lastAt =
    s(thread.last_message_at_label) ||
    s(thread.last_message_relative) ||
    s(thread.updated_at_label) ||
    s(thread.updated_at_display) ||
    s(thread.last_message_created_at);

  if (channel) parts.push(channel);
  if (lastAt) parts.push(lastAt);

  return parts.filter(Boolean).join(" • ");
}

function ConversationIdentityBlock({ thread, onOpenDetails }) {
  const selectedName =
    thread?.customer_name ||
    thread?.external_username ||
    thread?.external_user_id ||
    "Conversation";

  const meta = formatConversationMeta(thread);

  return (
    <div className="px-7 pb-3 pt-6">
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label="Open conversation details"
        className="group flex items-start gap-3 text-left"
      >
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition group-hover:scale-[1.02]",
            avatarTone(selectedName),
          ].join(" ")}
        >
          {initialsFromName(selectedName)}
        </div>

        <div className="min-w-0 pt-0.5">
          <div className="truncate text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
            {selectedName}
          </div>
          {meta ? (
            <div className="mt-1 text-[13px] text-slate-500">{meta}</div>
          ) : null}
        </div>
      </button>
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
    assign: Boolean(actionState?.isActionPending?.("assign")),
    handoff: Boolean(actionState?.isActionPending?.("handoff")),
    handoffLocked: handoffActive,
    resolved: Boolean(actionState?.isActionPending?.("resolved")),
    closed: Boolean(actionState?.isActionPending?.("closed")),
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200/70 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Conversation
          </div>

          <div className="flex items-center gap-1.5">
            <QuietIconButton
              onClick={hasThread ? () => markRead(selectedThread.id) : undefined}
              disabled={
                !hasThread ||
                unreadCount <= 0 ||
                actionState?.isActionPending?.("read")
              }
              label="Mark conversation read"
            >
              <CheckCheck className="h-4 w-4" />
            </QuietIconButton>

            <QuietIconButton
              onClick={surface?.refresh}
              disabled={!hasThread || surface?.loading || surface?.saving}
              label="Refresh conversation"
            >
              <RefreshCw className="h-4 w-4" />
            </QuietIconButton>

            {hasThread ? (
              <div className="relative" ref={menuAnchorRef}>
                <QuietIconButton
                  onClick={() => setMenuOpen((prev) => !prev)}
                  label="Conversation actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </QuietIconButton>

                <DetailActionMenu
                  open={menuOpen}
                  anchorRef={menuAnchorRef}
                  onClose={() => setMenuOpen(false)}
                  onAssign={() => assignThread(selectedThread.id)}
                  onHandoff={() => activateHandoff(selectedThread.id)}
                  onResolve={() => setThreadStatus(selectedThread.id, "resolved")}
                  onCloseThread={() =>
                    setThreadStatus(selectedThread.id, "closed")
                  }
                  disabledMap={disabledMap}
                />
              </div>
            ) : null}
          </div>
        </div>

        {showSurfaceBanner ? (
          <div className="pt-3">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Conversation detail is temporarily unavailable."
              refreshLabel="Refresh conversation"
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfcfd] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
                No messages yet
              </div>
              <div className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-500">
                This conversation has no message history yet.
              </div>
            </div>
          ) : (
            <div className="px-0 py-0">
              <ConversationIdentityBlock
                thread={selectedThread}
                onOpenDetails={onOpenDetails}
              />

              <div className="space-y-4 px-6 pb-6">
                {messages.map((message) => (
                  <InboxMessageBubble
                    key={message.id}
                    m={message}
                    attemptsByCorrelation={attemptsByCorrelation}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {composer}
      </div>
    </section>
  );
}
