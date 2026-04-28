import { Dropdown, Switch, Tooltip } from "antd";
import {
  Ban,
  CheckCircle2,
  MailOpen,
  MoreHorizontal,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import infoIcon from "../../assets/channels/info.png";
import refreshIcon from "../../assets/channels/refresh.png";

function s(value) {
  return String(value ?? "").trim();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function resolveTitle({ title, thread }) {
  return (
    s(title) ||
    s(
      thread?.display_name ||
        thread?.displayName ||
        thread?.customer_name ||
        thread?.customerName ||
        thread?.title ||
        thread?.name
    ) ||
    "Conversation"
  );
}

function resolveMetaItems({ metaItems, thread }) {
  if (Array.isArray(metaItems) && metaItems.length) {
    return metaItems.map((item) => s(item)).filter(Boolean);
  }

  const channelLabel =
    s(thread?.channel_label || thread?.channelLabel || thread?.channel) || "";
  const statusLabel =
    s(thread?.status_label || thread?.statusLabel || thread?.status) || "";

  return [statusLabel, channelLabel].filter(Boolean);
}

const tooltipStyle = {
  borderRadius: 12,
  padding: "8px 10px",
  background: "rgba(15,23,42,0.96)",
  fontSize: 12,
  fontWeight: 600,
  boxShadow: "0 12px 32px -18px rgba(15,23,42,0.45)",
};

function HeaderAssetIcon({ src, alt = "" }) {
  return (
    <img
      src={src}
      alt={alt}
      draggable="false"
      className="pointer-events-none h-[24px] w-[24px] select-none object-contain transition-none"
    />
  );
}

function HeaderActionButton({
  label,
  onClick,
  disabled = false,
  children,
}) {
  return (
    <Tooltip
      title={label}
      placement="bottom"
      mouseEnterDelay={0.06}
      overlayInnerStyle={tooltipStyle}
    >
      <span className="inline-flex">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cx(
            "inline-flex h-9 w-9 items-center justify-center rounded-[11px]",
            "border border-transparent bg-transparent text-[#718197]",
            "shadow-none outline-none ring-0",
            "transition-opacity duration-150",
            "hover:bg-transparent hover:opacity-75",
            "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
            "active:bg-transparent active:shadow-none active:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          )}
        >
          {children}
        </button>
      </span>
    </Tooltip>
  );
}

function MenuLabel({ icon: Icon, title, description, danger = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cx(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
          danger
            ? "bg-[#FFF1F2] text-[#DC2626]"
            : "bg-[linear-gradient(180deg,#F7FAFE_0%,#EEF4FA_100%)] text-[#506179]"
        )}
      >
        <Icon className="h-[16px] w-[16px]" strokeWidth={2} />
      </span>

      <span className="min-w-0">
        <span
          className={cx(
            "block text-[13px] font-semibold leading-5 tracking-[-0.01em]",
            danger ? "text-[#B91C1C]" : "text-[#152033]"
          )}
        >
          {title}
        </span>

        {description ? (
          <span className="block max-w-[230px] truncate text-[12px] font-medium leading-5 text-[#7A8797]">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function OverflowMenu({
  disabled,
  canMarkRead,
  disabledMap,
  onMarkRead,
  onAssign,
  onHandoff,
  onResolve,
  onCloseThread,
}) {
  const items = [
    {
      key: "mark-read",
      disabled: disabled || !canMarkRead || Boolean(disabledMap?.read),
      label: (
        <MenuLabel
          icon={MailOpen}
          title="Mark as read"
          description={canMarkRead ? "Clear unread state" : "No unread messages"}
        />
      ),
    },
    {
      key: "assign",
      disabled: disabled || Boolean(disabledMap?.assign),
      label: (
        <MenuLabel
          icon={UserCheck}
          title="Assign to me"
          description="Take ownership"
        />
      ),
    },
    {
      key: "handoff",
      disabled:
        disabled ||
        Boolean(disabledMap?.handoff) ||
        Boolean(disabledMap?.handoffLocked),
      label: (
        <MenuLabel
          icon={ShieldCheck}
          title={
            disabledMap?.handoffLocked ? "Handoff active" : "Activate handoff"
          }
          description={
            disabledMap?.handoffLocked
              ? "Already operator controlled"
              : "Move control to operator"
          }
        />
      ),
    },
    {
      key: "resolve",
      disabled: disabled || Boolean(disabledMap?.resolved),
      label: (
        <MenuLabel
          icon={CheckCircle2}
          title="Resolve conversation"
          description="Mark as handled"
        />
      ),
    },
    {
      type: "divider",
    },
    {
      key: "close",
      danger: true,
      disabled: disabled || Boolean(disabledMap?.closed),
      label: (
        <MenuLabel
          icon={Ban}
          title="Close conversation"
          description="End this thread"
          danger
        />
      ),
    },
  ];

  function handleMenuClick({ key }) {
    if (key === "mark-read") {
      onMarkRead?.();
      return;
    }

    if (key === "assign") {
      onAssign?.();
      return;
    }

    if (key === "handoff") {
      onHandoff?.();
      return;
    }

    if (key === "resolve") {
      onResolve?.();
      return;
    }

    if (key === "close") {
      onCloseThread?.();
    }
  }

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      disabled={disabled}
      overlayClassName="inbox-detail-header-menu"
      menu={{
        items,
        onClick: handleMenuClick,
      }}
      dropdownRender={(menu) => (
        <div className="inbox-detail-header-menu-shell">{menu}</div>
      )}
    >
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        disabled={disabled}
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-[11px]",
          "border border-transparent bg-transparent text-[#64748B]",
          "shadow-none outline-none ring-0",
          "transition-opacity duration-150",
          "hover:bg-transparent hover:opacity-75",
          "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
          "active:bg-transparent active:shadow-none active:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        )}
      >
        <MoreHorizontal
          className="pointer-events-none h-[22px] w-[22px] transition-none"
          strokeWidth={2.15}
        />
      </button>
    </Dropdown>
  );
}

export default function InboxDetailHeaderCompact({
  thread = null,
  launchChannelConnected = true,
  hasThread: hasThreadProp,
  title = "",
  metaItems = [],
  unreadCount = 0,
  automationControl = null,
  onToggleAutomation,
  autoReplyEnabled = false,
  onToggleAutoReply,
  onOpenDetails,
  onRefresh,
  onCloseThread,
  onMarkClosed,
  onMarkRead,
  canMarkRead = false,
  onAssign,
  onHandoff,
  onResolve,
  disabledMap = {},
}) {
  const hasThread =
    typeof hasThreadProp === "boolean" ? hasThreadProp : Boolean(thread?.id);

  const displayName = resolveTitle({ title, thread });
  const resolvedMetaItems = resolveMetaItems({ metaItems, thread });
  const meta = resolvedMetaItems.join(" • ");

  const automationEnabled = automationControl
    ? Boolean(automationControl.enabled)
    : Boolean(autoReplyEnabled);

  const automationSaving = Boolean(automationControl?.saving);
  const automationDisabled = Boolean(
    automationControl?.disabled ||
      automationSaving ||
      !hasThread ||
      !launchChannelConnected
  );

  const automationLabel =
    s(automationControl?.disabledReason) ||
    (automationEnabled ? "AI on" : "AI off");

  const closeHandler = onCloseThread || onMarkClosed;

  const disableActions = !hasThread;
  const unread = Number(unreadCount || 0);

  return (
    <>
      <style>
        {`
          .inbox-detail-header-menu {
            padding: 0 !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu {
            min-width: 286px !important;
            padding: 8px !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
          }

          .inbox-detail-header-menu-shell {
            overflow: hidden;
            border: 1px solid rgba(226, 232, 240, 0.92);
            border-radius: 22px;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(248,251,255,0.985) 100%);
            box-shadow:
              0 28px 72px -42px rgba(15, 23, 42, 0.55),
              0 1px 0 rgba(255, 255, 255, 0.8) inset;
            backdrop-filter: blur(18px);
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item {
            margin: 0 !important;
            padding: 11px 12px !important;
            border-radius: 15px !important;
            background: transparent !important;
            color: inherit !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item:hover {
            background: rgba(241, 245, 249, 0.82) !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item-disabled {
            opacity: 0.48 !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item-disabled:hover {
            background: transparent !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item-danger:hover {
            background: rgba(254, 242, 242, 0.92) !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-title-content {
            width: 100% !important;
          }

          .inbox-detail-header-menu .ant-dropdown-menu-item-divider {
            margin: 8px 4px !important;
            background: rgba(226, 232, 240, 0.86) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch {
            min-width: 40px !important;
            height: 22px !important;
            background: #CBD5E1 !important;
            box-shadow: none !important;
          }

          .inbox-detail-header-ai-switch.ant-switch:hover {
            background: #CBD5E1 !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked {
            background: #2563EB !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked:hover {
            background: #2563EB !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle {
            width: 18px !important;
            height: 18px !important;
            top: 2px !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle::before {
            border-radius: 999px !important;
            box-shadow: 0 5px 12px -6px rgba(15, 23, 42, 0.7) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked .ant-switch-handle {
            inset-inline-start: calc(100% - 20px) !important;
          }
        `}
      </style>

      <div className="flex min-h-[62px] items-center justify-between gap-4 border-b border-[#E4EAF2] bg-[rgba(255,255,255,0.9)] px-5 py-2 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-5 tracking-[-0.025em] text-[#0F172A]">
                {displayName}
              </div>

              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                {meta ? (
                  <div className="truncate text-[11.5px] font-semibold leading-4 text-[#7C8A9A]">
                    {meta}
                  </div>
                ) : (
                  <div className="truncate text-[11.5px] font-semibold leading-4 text-[#9AA7B8]">
                    {hasThread ? "Live conversation" : "Select a conversation"}
                  </div>
                )}

                {unread > 0 ? (
                  <span className="inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-[7px] bg-[#2563EB] px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.55)]">
                    {unread}
                  </span>
                ) : null}

                {!launchChannelConnected ? (
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#B45309]">
                    Channel offline
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Tooltip
            title={automationLabel}
            placement="bottom"
            mouseEnterDelay={0.06}
            overlayInnerStyle={tooltipStyle}
          >
            <span className="inline-flex h-9 items-center">
              <Switch
                className="inbox-detail-header-ai-switch"
                size="small"
                checked={automationEnabled}
                disabled={automationDisabled}
                loading={automationSaving}
                onChange={(checked) => {
                  if (typeof onToggleAutomation === "function") {
                    onToggleAutomation(checked);
                    return;
                  }

                  if (typeof onToggleAutoReply === "function") {
                    onToggleAutoReply(checked);
                  }
                }}
              />
            </span>
          </Tooltip>

          <div className="mx-0.5 h-5 w-px bg-[#E3EAF3]" />

          <HeaderActionButton
            label="Conversation details"
            onClick={onOpenDetails}
            disabled={disableActions || typeof onOpenDetails !== "function"}
          >
            <HeaderAssetIcon src={infoIcon} alt="" />
          </HeaderActionButton>

          <HeaderActionButton
            label="Refresh"
            onClick={onRefresh}
            disabled={typeof onRefresh !== "function"}
          >
            <HeaderAssetIcon src={refreshIcon} alt="" />
          </HeaderActionButton>

          <OverflowMenu
            disabled={disableActions}
            canMarkRead={canMarkRead}
            disabledMap={disabledMap}
            onMarkRead={onMarkRead}
            onAssign={onAssign}
            onHandoff={onHandoff}
            onResolve={onResolve}
            onCloseThread={closeHandler}
          />
        </div>
      </div>
    </>
  );
}