import { Dropdown, Switch, Tooltip } from "antd";
import {
  Bot,
  CheckCircle2,
  Info,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";

function s(value) {
  return String(value ?? "").trim();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function IconButton({
  label,
  onClick,
  danger = false,
  active = false,
  children,
}) {
  return (
    <Tooltip
      title={label}
      placement="bottom"
      mouseEnterDelay={0.06}
      overlayInnerStyle={{
        borderRadius: 12,
        padding: "8px 10px",
        background: "rgba(15,23,42,0.96)",
        fontSize: 12,
        fontWeight: 500,
        boxShadow: "0 12px 32px -18px rgba(15,23,42,0.45)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cx(
          "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all duration-150",
          danger
            ? "border-[#F3D3D3] bg-[#FFF8F8] text-[#DC2626] hover:border-[#E9B8B8] hover:bg-[#FFF2F2]"
            : active
              ? "border-[#D7E6FB] bg-[#EEF5FF] text-[#2563EB] hover:border-[#C7DCF9] hover:bg-[#E8F1FF]"
              : "border-[#E6EBF2] bg-white text-[#64748B] hover:border-[#D9E2EC] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function OverflowMenu({ onMarkClosed, closed = false }) {
  const items = [
    {
      key: "close",
      label: closed ? "Reopen conversation" : "Mark as closed",
      danger: !closed,
      onClick: () => onMarkClosed?.(),
    },
  ];

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === "close") onMarkClosed?.();
        },
      }}
      placement="bottomRight"
    >
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#E6EBF2] bg-white text-[#64748B] transition-all duration-150 hover:border-[#D9E2EC] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
    </Dropdown>
  );
}

export default function InboxDetailHeaderCompact({
  thread = null,
  autoReplyEnabled = false,
  onToggleAutoReply,
  onOpenDetails,
  onRefresh,
  onMarkClosed,
}) {
  const displayName =
    s(
      thread?.display_name ||
        thread?.displayName ||
        thread?.customer_name ||
        thread?.customerName ||
        thread?.title ||
        thread?.name
    ) || "Conversation";

  const channelLabel =
    s(thread?.channel_label || thread?.channelLabel || thread?.channel) || "";

  const statusLabel =
    s(thread?.status_label || thread?.statusLabel || thread?.status) || "";

  const meta = [statusLabel, channelLabel].filter(Boolean).join(" • ");

  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#EEF2F6] bg-white px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#0F172A]">
          {displayName}
        </div>

        {meta ? (
          <div className="mt-0.5 truncate text-[12px] font-medium text-[#7C8A9A]">
            {meta}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tooltip
          title={autoReplyEnabled ? "Disable auto-reply" : "Enable auto-reply"}
          placement="bottom"
          mouseEnterDelay={0.06}
          overlayInnerStyle={{
            borderRadius: 12,
            padding: "8px 10px",
            background: "rgba(15,23,42,0.96)",
            fontSize: 12,
            fontWeight: 500,
            boxShadow: "0 12px 32px -18px rgba(15,23,42,0.45)",
          }}
        >
          <div
            className={cx(
              "flex h-10 items-center gap-2 rounded-[14px] border px-2.5",
              autoReplyEnabled
                ? "border-[#D7E6FB] bg-[#EEF5FF]"
                : "border-[#E6EBF2] bg-white"
            )}
          >
            <Bot
              className={cx(
                "h-[17px] w-[17px]",
                autoReplyEnabled ? "text-[#2563EB]" : "text-[#64748B]"
              )}
              strokeWidth={2}
            />
            <Switch
              size="small"
              checked={Boolean(autoReplyEnabled)}
              onChange={onToggleAutoReply}
            />
          </div>
        </Tooltip>

        <IconButton label="Conversation details" onClick={onOpenDetails}>
          <Info className="h-[17px] w-[17px]" strokeWidth={2} />
        </IconButton>

        <IconButton label="Refresh" onClick={onRefresh}>
          <RefreshCw className="h-[17px] w-[17px]" strokeWidth={2} />
        </IconButton>

        <IconButton label="Mark as closed" onClick={onMarkClosed} danger>
          <CheckCircle2 className="h-[17px] w-[17px]" strokeWidth={2} />
        </IconButton>

        <OverflowMenu
          onMarkClosed={onMarkClosed}
          closed={String(thread?.status || "").toLowerCase() === "closed"}
        />
      </div>
    </div>
  );
}