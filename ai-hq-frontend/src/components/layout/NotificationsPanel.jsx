import { Bell, CheckCircle2, RefreshCw } from "lucide-react";
import FocusDialog from "../ui/FocusDialog.jsx";
import Button from "../ui/Button.jsx";
import {
  EmptyState,
  InlineNotice,
  Surface,
} from "../ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";

function formatWhen(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function NotificationRow({ item, saving = false, onMarkRead }) {
  return (
    <div
      className={cx(
        "rounded-soft border px-4 py-3",
        item.unread
          ? "border-[rgba(var(--color-brand),0.18)] bg-brand-soft"
          : "border-line bg-surface"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.unread ? (
              <span className="inline-flex h-2 w-2 rounded-full bg-brand" />
            ) : null}

            <div className="truncate text-[14px] font-medium text-text">
              {item.title}
            </div>
          </div>

          <div className="mt-1 text-[12px] text-text-subtle">
            {formatWhen(item.createdAt)}
          </div>

          {item.body ? (
            <div className="mt-2 text-[13px] leading-6 text-text-muted">
              {item.body}
            </div>
          ) : null}
        </div>

        <Button
          size="sm"
          variant="secondary"
          leftIcon={!saving ? <CheckCircle2 className="h-4 w-4" /> : undefined}
          isLoading={saving}
          onClick={() => onMarkRead?.(item.id)}
          disabled={!item.unread || saving}
        >
          {item.unread ? "Mark read" : "Read"}
        </Button>
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
      backdropClassName="bg-overlay/60"
      panelClassName="w-full max-w-[680px]"
    >
      <Surface className="overflow-hidden p-0 shadow-panel-strong">
        <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface-subtle text-text">
              <Bell className="h-4 w-4" />
            </span>

            <div>
              <div className="text-[16px] font-semibold text-text">
                Notifications
              </div>
              <div className="text-[12px] text-text-muted">
                {unreadCount} unread
              </div>
            </div>
          </div>

          <Button
            size="icon"
            variant="secondary"
            isLoading={refreshing}
            onClick={() => onRefresh?.({ silent: true })}
            disabled={loading || refreshing}
            aria-label="Refresh notifications"
          >
            {!refreshing ? <RefreshCw className="h-4 w-4" /> : null}
          </Button>
        </div>

        <div className="panel-scroll max-h-[68vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-14 text-[13px] text-text-muted">
              Loading notifications...
            </div>
          ) : error ? (
            <InlineNotice
              tone="danger"
              title="Notifications unavailable"
              description={error}
            />
          ) : unavailable ? (
            <InlineNotice
              tone="warning"
              title="Notifications unavailable"
              description="Try again in a moment."
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              title="No notifications"
              description="New activity will appear here."
            />
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
      </Surface>
    </FocusDialog>
  );
}
