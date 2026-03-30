import { useMemo } from "react";
import {
  Bot,
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

function ActionChip({
  children,
  onClick,
  disabled = false,
  variant = "default",
  icon: Icon,
}) {
  const variants = {
    default:
      "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950",
    subtle:
      "border-slate-200 bg-[#f7f8fa] text-slate-600 hover:border-slate-300 hover:text-slate-950",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300",
    blue:
      "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
        variants[variant] || variants.default,
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function buildConversationTitle(thread = {}) {
  const safe = obj(thread);

  if (s(safe.subject)) return s(safe.subject);
  if (s(safe.title)) return s(safe.title);

  const preview = s(safe.last_message_text);
  if (preview) {
    if (preview.length <= 46) return preview;
    return `${preview.slice(0, 46).trim()}…`;
  }

  return (
    s(safe.customer_name) ||
    s(safe.external_username) ||
    s(safe.external_user_id) ||
    "Conversation"
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
  composer = null,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const showSurfaceBanner = hasThread && (
    surface?.unavailable ||
    surface?.availability === "unavailable" ||
    surface?.error ||
    surface?.saveError ||
    surface?.saveSuccess
  );

  const selectedName =
    selectedThread?.customer_name ||
    selectedThread?.external_username ||
    selectedThread?.external_user_id ||
    "Conversation workspace preview";

  const selectedHandle = selectedThread?.external_username
    ? `@${String(selectedThread.external_username).replace(/^@+/, "")}`
    : selectedThread?.external_user_id || "Awaiting thread selection";

  const conversationTitle = buildConversationTitle(selectedThread);
  const unreadCount = Number(selectedThread?.unread_count ?? 0);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const assignedTo = s(selectedThread?.assigned_to, "Unassigned");

  const attemptsByCorrelation = useMemo(
    () => indexAttemptsByMessageCorrelation(outboundAttempts),
    [outboundAttempts]
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200/80 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              {conversationTitle}
            </h2>

            {hasThread ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                    avatarTone(selectedName),
                  ].join(" ")}
                >
                  {initialsFromName(selectedName)}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-slate-800">
                    {selectedName}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-slate-500">
                    {selectedHandle}
                  </div>
                </div>

                {handoffActive ? (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                    Handoff active
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    AI active
                  </span>
                )}

                <span className="inline-flex rounded-full border border-slate-200 bg-[#f6f7f9] px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {assignedTo}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-500">
                Select a thread to open the conversation.
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mark conversation read"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f3f4f6] hover:text-slate-900"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Open conversation actions"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f3f4f6] hover:text-slate-900"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showSurfaceBanner ? (
          <div className="mt-4">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Conversation detail is temporarily unavailable."
              refreshLabel="Refresh conversation"
            />
          </div>
        ) : null}
      </div>

      {hasThread ? (
        <div className="border-b border-slate-200/80 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <ActionChip
              icon={CheckCheck}
              onClick={() => markRead(selectedThread.id)}
              disabled={unreadCount <= 0 || actionState?.isActionPending?.("read")}
              variant="subtle"
            >
              {actionState?.isActionPending?.("read") ? "Marking..." : "Mark read"}
            </ActionChip>

            <ActionChip
              icon={UserCog}
              onClick={() => assignThread(selectedThread.id)}
              disabled={actionState?.isActionPending?.("assign")}
              variant="subtle"
            >
              {actionState?.isActionPending?.("assign") ? "Assigning..." : "Assign"}
            </ActionChip>

            <ActionChip
              icon={ShieldAlert}
              onClick={() => activateHandoff(selectedThread.id)}
              disabled={handoffActive || actionState?.isActionPending?.("handoff")}
              variant="amber"
            >
              {actionState?.isActionPending?.("handoff")
                ? "Activating..."
                : "Activate handoff"}
            </ActionChip>

            <ActionChip
              icon={Sparkles}
              onClick={() => setThreadStatus(selectedThread.id, "resolved")}
              disabled={actionState?.isActionPending?.("resolved")}
              variant="emerald"
            >
              {actionState?.isActionPending?.("resolved") ? "Resolving..." : "Resolve"}
            </ActionChip>

            <ActionChip
              icon={XCircle}
              onClick={() => setThreadStatus(selectedThread.id, "closed")}
              disabled={actionState?.isActionPending?.("closed")}
              variant="rose"
            >
              {actionState?.isActionPending?.("closed") ? "Closing..." : "Close"}
            </ActionChip>

            <ActionChip
              icon={RefreshCw}
              onClick={surface?.refresh}
              disabled={surface?.loading || surface?.saving}
              variant="blue"
            >
              Refresh
            </ActionChip>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {!hasThread ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
              Conversation workspace preview
            </div>
            <div className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-500">
              Select a thread to open the message timeline.
            </div>
          </div>
        ) : surface?.loading ? (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-slate-500">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
              No messages yet
            </div>
            <div className="mt-2 max-w-[34rem] text-sm leading-7 text-slate-500">
              This conversation has no message history yet.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
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

      {composer}
    </section>
  );
}
