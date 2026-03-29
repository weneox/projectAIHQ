import { BellRing, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";

import FocusDialog from "../ui/FocusDialog.jsx";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Unknown time";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function typeLabel(value = "") {
  const raw = s(value || "info").toLowerCase();
  return raw.replace(/[_-]+/g, " ");
}

function typeTone(value = "") {
  const raw = s(value || "info").toLowerCase();
  if (raw === "error") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  if (raw === "warn" || raw === "warning") {
    return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  }
  if (raw === "success") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }
  return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
}

function NotificationRow({
  item,
  saving = false,
  onMarkRead,
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4",
        item.unread
          ? "border-cyan-300/20 bg-cyan-300/[0.06]"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
              typeTone(item.type)
            )}
          >
            {typeLabel(item.type)}
          </span>
          {item.unread ? (
            <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-900">
              Unread
            </span>
          ) : null}
        </div>

        <div className="text-[11px] text-white/42">
          {formatWhen(item.createdAt)}
        </div>
      </div>

      <div className="mt-3 text-sm font-semibold text-white">
        {item.title}
      </div>

      <div className="mt-2 text-sm leading-6 text-white/62">
        {item.body || "No notification body was provided."}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/40">
          {item.unread
            ? "This notification has not been acknowledged yet."
            : `Read ${formatWhen(item.readAt)}`}
        </div>

        <button
          type="button"
          onClick={() => onMarkRead?.(item.id)}
          disabled={!item.unread || saving}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
            item.unread
              ? "border-white/10 bg-white/[0.05] text-white/82 hover:bg-white/[0.08]"
              : "border-white/10 bg-white/[0.03] text-white/34",
            saving ? "cursor-not-allowed opacity-60" : ""
          )}
        >
          {saving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {item.unread ? "Mark read" : "Read"}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPanel({
  open = false,
  onClose,
  notifications = [],
  unreadCount = 0,
  loading = false,
  refreshing = false,
  error = "",
  unavailable = false,
  savingId = "",
  onRefresh,
  onMarkRead,
}) {
  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Notifications"
      backdropClassName="bg-black/55 backdrop-blur-[6px]"
      panelClassName="w-full max-w-[720px]"
    >
      <div className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(4,8,16,0.96),rgba(3,7,14,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
        <div className="border-b border-white/[0.08] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  <BellRing className="h-4 w-4 text-white/78" />
                </div>
                <div>
                  <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                    Notifications
                  </div>
                  <div className="mt-1 text-sm text-white/46">
                    Real backend-backed operator alerts with honest read state.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/60">
                {unreadCount} unread
              </div>
              <button
                type="button"
                onClick={() => onRefresh?.({ silent: true })}
                disabled={loading || refreshing}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[12px] font-medium text-white/78 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-5">
          {loading ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/58">
              Loading notifications...
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-rose-300/20 bg-rose-400/[0.08] px-4 py-5 text-sm text-rose-100">
              {error}
            </div>
          ) : unavailable ? (
            <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/[0.08] px-4 py-5 text-sm text-amber-100">
              Notifications are currently unavailable.
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
              <div className="text-sm font-medium text-white/72">
                No notifications yet
              </div>
              <div className="mt-2 text-sm leading-6 text-white/42">
                The bell is now backed by the real backend feed, and it will stay empty until the backend produces operator notifications.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  saving={savingId === item.id}
                  onMarkRead={onMarkRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </FocusDialog>
  );
}
