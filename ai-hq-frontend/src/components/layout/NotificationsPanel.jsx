import { Button, Empty, Spin } from "antd";
import { Bell, CheckCircle2, RefreshCw } from "lucide-react";
import FocusDialog from "../ui/FocusDialog.jsx";
import { InlineNotice, Surface } from "../ui/AppShellPrimitives.jsx";
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
        "rounded-[18px] border px-4 py-3.5 transition duration-200",
        item.unread
          ? "border-[rgba(var(--color-brand),0.14)] bg-[linear-gradient(180deg,rgba(var(--color-brand),0.045),rgba(255,255,255,0.88))]"
          : "border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.995))]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.unread ? (
              <span className="inline-flex h-2 w-2 rounded-full bg-brand" />
            ) : null}

            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.94)]">
              {item.title}
            </div>
          </div>

          <div className="mt-1 text-[12px] font-medium text-[rgba(15,23,42,0.48)]">
            {formatWhen(item.createdAt)}
          </div>
        </div>

        <Button
          size="small"
          icon={
            saving ? (
              <Spin size="small" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )
          }
          onClick={() => onMarkRead?.(item.id)}
          disabled={!item.unread || saving}
          className="!rounded-[12px] !border-line !text-text-muted hover:!border-line-strong hover:!text-text"
        >
          {item.unread ? "Read" : "Done"}
        </Button>
      </div>

      {item.body ? (
        <div className="mt-3 text-[13px] leading-6 text-[rgba(15,23,42,0.64)]">
          {item.body}
        </div>
      ) : null}
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
      panelClassName="w-full max-w-[680px]"
    >
      <Surface className="overflow-hidden p-0 shadow-panel-strong">
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(15,23,42,0.06)] px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[rgba(15,23,42,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.995))]">
              <Bell className="h-[18px] w-[18px] text-[rgba(15,23,42,0.88)]" />
            </div>

            <div>
              <div className="text-[18px] font-semibold tracking-[-0.04em] text-[rgba(15,23,42,0.96)]">
                Notifications
              </div>
              <div className="text-[12px] font-medium text-[rgba(15,23,42,0.48)]">
                {unreadCount} unread
              </div>
            </div>
          </div>

          <Button
            size="large"
            icon={
              refreshing ? (
                <Spin size="small" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )
            }
            onClick={() => onRefresh?.({ silent: true })}
            disabled={loading || refreshing}
            className="!rounded-[14px] !border-line !text-text-muted hover:!border-line-strong hover:!text-text"
          />
        </div>

        <div className="panel-scroll max-h-[68vh] overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spin />
            </div>
          ) : error ? (
            <InlineNotice tone="danger" title="Notifications unavailable" description={error} />
          ) : unavailable ? (
            <InlineNotice tone="warning" title="Notifications unavailable" description="Try again in a moment." />
          ) : notifications.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.7)] px-4 py-14">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="text-[14px] font-semibold tracking-[-0.02em] text-[rgba(15,23,42,0.76)]">
                    No notifications
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