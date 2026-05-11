import { useState } from "react";
import { Dropdown, Switch, Tooltip } from "antd";
import {
  Ban,
  CheckCircle2,
  Info,
  MailOpen,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { cx } from "../../lib/cx.js";


function s(value) {
  return String(value ?? "").trim();
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

function headerActionColor({ danger = false, active = false }) {
  if (danger) return "text-danger";
  if (active) return "text-brand";
  return "text-text-muted hover:text-text";
}

function HeaderIconButton({
  label,
  onClick,
  disabled = false,
  active = false,
  danger = false,
  children,
}) {
  return (
    <Tooltip
      title={label}
      placement="bottom"
      mouseEnterDelay={0.06}
      overlayInnerStyle={tooltipStyle}
    >
      <span className="inline-flex h-[34px] w-[34px] items-center justify-center">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cx(
            "group relative inline-flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-[10px]",
            "border border-transparent bg-transparent outline-none ring-0 shadow-none",
            "transition-[background-color,color,opacity] duration-base ease-premium",
            "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
            "active:bg-transparent active:shadow-none active:ring-0",
            "hover:bg-surface-subtle",
            "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
            headerActionColor({ danger, active })
          )}
        >
          {children}
        </button>
      </span>
    </Tooltip>
  );
}

function OverflowActionIcon({
  label,
  onClick,
  onClose,
  disabled = false,
  active = false,
  danger = false,
  children,
}) {
  return (
    <Tooltip
      title={label}
      placement="left"
      mouseEnterDelay={0.06}
      overlayInnerStyle={tooltipStyle}
    >
      <span className="inline-flex h-[34px] w-[34px] items-center justify-center">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            if (disabled) return;

            onClick?.();
            onClose?.();
          }}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cx(
            "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px]",
            "border-0 bg-transparent outline-none ring-0 shadow-none",
            "transition-[background-color,color,opacity] duration-base ease-premium",
            "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
            "active:bg-transparent active:shadow-none active:ring-0",
            "hover:bg-surface-subtle",
            "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
            headerActionColor({ danger, active })
          )}
        >
          {children}
        </button>
      </span>
    </Tooltip>
  );
}

function OverflowActions({
  canMarkRead,
  disabledMap = {},
  onMarkRead,
  onAssign,
  onHandoff,
  onResolve,
  onCloseThread,
  onClose,
}) {
  const handoffLocked = Boolean(disabledMap?.handoffLocked);

  return (
    <div className="flex flex-col items-center gap-[9px]">
      <OverflowActionIcon
        label={canMarkRead ? "Mark as read" : "No unread messages"}
        onClick={onMarkRead}
        onClose={onClose}
        active={canMarkRead}
        disabled={!canMarkRead || Boolean(disabledMap?.read)}
      >
        <MailOpen
          className="pointer-events-none h-[19px] w-[19px]"
          strokeWidth={2.1}
        />
      </OverflowActionIcon>

      <OverflowActionIcon
        label="Assign to me"
        onClick={onAssign}
        onClose={onClose}
        disabled={Boolean(disabledMap?.assign)}
      >
        <UserCheck
          className="pointer-events-none h-[19px] w-[19px]"
          strokeWidth={2.1}
        />
      </OverflowActionIcon>

      <OverflowActionIcon
        label={handoffLocked ? "Handoff active" : "Activate handoff"}
        onClick={onHandoff}
        onClose={onClose}
        active={handoffLocked}
        disabled={Boolean(disabledMap?.handoff) || handoffLocked}
      >
        <ShieldCheck
          className="pointer-events-none h-[19px] w-[19px]"
          strokeWidth={2.1}
        />
      </OverflowActionIcon>

      <OverflowActionIcon
        label="Resolve conversation"
        onClick={onResolve}
        onClose={onClose}
        disabled={Boolean(disabledMap?.resolved)}
      >
        <CheckCircle2
          className="pointer-events-none h-[19px] w-[19px]"
          strokeWidth={2.1}
        />
      </OverflowActionIcon>

      <div className="my-[1px] h-px w-[22px] bg-line-soft" />

      <OverflowActionIcon
        label="Close conversation"
        onClick={onCloseThread}
        onClose={onClose}
        danger
        disabled={Boolean(disabledMap?.closed)}
      >
        <Ban
          className="pointer-events-none h-[19px] w-[19px]"
          strokeWidth={2.1}
        />
      </OverflowActionIcon>
    </div>
  );
}

function OverflowMenu({
  disabled = false,
  canMarkRead,
  disabledMap,
  onMarkRead,
  onAssign,
  onHandoff,
  onResolve,
  onCloseThread,
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={["click"]}
      placement="bottomRight"
      disabled={disabled}
      overlayClassName="inbox-detail-header-overflow"
      dropdownRender={() => (
        <div
          className="inbox-detail-header-overflow-shell"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <OverflowActions
            canMarkRead={canMarkRead}
            disabledMap={disabledMap}
            onMarkRead={onMarkRead}
            onAssign={onAssign}
            onHandoff={onHandoff}
            onResolve={onResolve}
            onCloseThread={onCloseThread}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    >
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        disabled={disabled}
        className={cx(
          "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px]",
          "border border-transparent bg-transparent text-text-muted",
          "outline-none ring-0 shadow-none",
          "transition-[background-color,color,opacity] duration-base ease-premium",
          "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
          "hover:bg-surface-subtle hover:text-text",
          "active:bg-transparent active:shadow-none active:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
        )}
      >
        <MoreHorizontal
          className="pointer-events-none h-[20px] w-[20px]"
          strokeWidth={2.2}
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
  const meta = resolvedMetaItems.join(" · ");

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

  const automationLabel = automationEnabled ? "AI on" : "AI off";

  const _automationScopeLabel =
    s(automationControl?.scopeLabel) || "Bu söhbətdə köməkçi";

  const closeHandler = onCloseThread || onMarkClosed;
  const disableActions = !hasThread;
  const unread = Number(unreadCount || 0);

  const handleRefreshClick = () => {
    if (typeof onRefresh === "function") onRefresh();
  };

  return (
    <>
      <style>
        {`
          .inbox-detail-header-ai-switch.ant-switch {
            min-width: 66px !important;
            width: 66px !important;
            height: 28px !important;
            background: rgba(203, 213, 225, 0.96) !important;
            border: 1px solid rgba(148, 163, 184, 0.28) !important;
            box-shadow: none !important;
            border-radius: 999px !important;
          }

          .inbox-detail-header-ai-switch.ant-switch:hover {
            background: rgba(203, 213, 225, 0.98) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked {
            background: rgb(var(--color-brand)) !important;
            border-color: rgba(var(--color-brand), 0.34) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked:hover {
            background: rgb(var(--color-brand-strong)) !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-inner {
            font-size: 10px !important;
            font-weight: 700 !important;
            letter-spacing: 0.08em !important;
            text-transform: uppercase !important;
            line-height: 26px !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked .ant-switch-inner {
            padding-inline-start: 8px !important;
            padding-inline-end: 24px !important;
          }

          .inbox-detail-header-ai-switch.ant-switch:not(.ant-switch-checked) .ant-switch-inner {
            padding-inline-start: 24px !important;
            padding-inline-end: 8px !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle {
            width: 22px !important;
            height: 22px !important;
            top: 2px !important;
            inset-inline-start: 2px !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle::before {
            border-radius: 999px !important;
            box-shadow: 0 5px 12px -6px rgba(15, 23, 42, 0.55) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked .ant-switch-handle {
            inset-inline-start: calc(100% - 24px) !important;
          }
          .inbox-detail-header-overflow {
            padding: 0 !important;
          }

          .inbox-detail-header-overflow-shell {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            padding: 11px 10px;
            border: 1px solid rgb(var(--color-line-soft));
            border-radius: 17px;
            background: linear-gradient(
              180deg,
              rgba(255,255,255,0.99) 0%,
              rgba(248,251,255,0.99) 100%
            );
            box-shadow:
              0 22px 52px -36px rgba(15, 23, 42, 0.36),
              0 1px 0 rgba(255, 255, 255, 0.9) inset;
          }
        `}
      </style>

      <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-line-soft bg-surface/95 px-4 py-2 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold leading-5 tracking-[var(--tracking-tight-lg)] text-text">
              {displayName}
            </div>

            <div className="mt-[2px] flex min-w-0 items-center gap-2">
              {meta ? (
                <div className="truncate text-[11.5px] font-semibold leading-4 text-text-subtle">
                  {meta}
                </div>
              ) : (
                <div className="truncate text-[11.5px] font-semibold leading-4 text-text-subtle">
                  {hasThread ? "Live conversation" : "Select a conversation"}
                </div>
              )}

              {unread > 0 ? (
                <span className="inline-flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-[7px] bg-brand px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_10px_20px_-16px_rgba(46,96,255,0.48)]">
                  {unread}
                </span>
              ) : null}

              {!launchChannelConnected ? (
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-warning">
                  Channel offline
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[10px]">
          <Tooltip
            title={automationLabel}
            placement="bottom"
            mouseEnterDelay={0.06}
            overlayInnerStyle={tooltipStyle}
          >
            <Switch
              className="inbox-detail-header-ai-switch"
              size="small"
              checkedChildren="ON"
              unCheckedChildren="OFF"
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
          </Tooltip>

          <div className="h-[18px] w-px bg-line-soft" />

          <HeaderIconButton
            label="Conversation details"
            onClick={onOpenDetails}
            disabled={disableActions || typeof onOpenDetails !== "function"}
          >
            <Info className="pointer-events-none h-[20px] w-[20px]" strokeWidth={2.1} />
          </HeaderIconButton>

          <HeaderIconButton
            label="Refresh"
            onClick={handleRefreshClick}
            disabled={typeof onRefresh !== "function"}
          >
            <RefreshCw className="pointer-events-none h-[20px] w-[20px]" strokeWidth={2.1} />
          </HeaderIconButton>

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

