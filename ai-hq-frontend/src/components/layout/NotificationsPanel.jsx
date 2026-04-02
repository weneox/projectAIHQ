import { Button, Empty, Spin } from "antd";
import { Bell, CheckCircle2, RefreshCw } from "lucide-react";
import FocusDialog from "../ui/FocusDialog.jsx";
import { Surface } from "../ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";

function formatWhen(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown time";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function NotificationRow({ item, saving = false, onMarkRead }) {
  return (
    <div
      className={cx(
        "rounded-[20px] border p-4 transition",
        item.unread
          ? "border-line bg-brand-soft/60"
          : "border-line-soft bg-surface-muted"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">{item.title}</div>
          <div className="mt-1 text-xs text-text-subtle">{formatWhen(item.createdAt)}</div>
        </div>
        {item.unread ? (
          <span className="rounded-pill border border-brand/10 bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
            Unread
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-sm leading-6 text-text-muted">
        {item.body || "No notification body was provided."}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-text-subtle">
          {item.unread ? "Pending acknowledgement" : `Read ${formatWhen(item.readAt)}`}
        </div>
        <Button
          size="large"
          icon={
            saving ? (
              <Spin size="small" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )
          }
          onClick={() => onMarkRead?.(item.id)}
          disabled={!item.unread || saving}
          className="!rounded-[14px] !border-line !text-text-muted hover:!border-line-strong hover:!text-text"
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
      backdropClassName="bg-overlay/60 backdrop-blur-[8px]"
      panelClassName="w-full max-w-[760px]"
    >
      <Surface className="overflow-hidden p-0 shadow-panel-strong">
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-line bg-surface-muted">
              <Bell className="h-5 w-5 text-text" />
            </div>
            <div>
              <div className="font-display text-[1.35rem] font-semibold tracking-[-0.04em] text-text">
                Notifications
              </div>
              <div className="text-sm text-text-muted">
                Backend-backed alerts, delivery signals, and review notices.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-pill border border-line bg-surface-muted px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-subtle">
              {unreadCount} unread
            </span>
            <Button
              size="large"
              icon={refreshing ? <Spin size="small" /> : <RefreshCw className="h-4 w-4" />}
              onClick={() => onRefresh?.({ silent: true })}
              disabled={loading || refreshing}
              className="!rounded-[14px] !border-line !text-text-muted hover:!border-line-strong hover:!text-text"
            />
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spin />
            </div>
          ) : error ? (
            <Surface subdued>{error}</Surface>
          ) : unavailable ? (
            <Surface subdued>Notifications are currently unavailable.</Surface>
          ) : notifications.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line bg-surface-muted px-4 py-14">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-text">No notifications yet</div>
                    <div className="text-sm text-text-muted">
                      The feed is live and will populate when backend events arrive.
                    </div>
                  </div>
                }
              />
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
      </Surface>
    </FocusDialog>
  );
}
