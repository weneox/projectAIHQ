import { useEffect, useRef, useState } from "react";
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
import refreshIcon from "../../assets/channels/refresh.gif";
import { cx } from "../../lib/cx.js";

const REFRESH_SPIN_MS = 720;

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

function HeaderAssetIcon({ src, alt = "" }) {
  return (
    <img
      src={src}
      alt={alt}
      draggable="false"
      className="pointer-events-none h-[23px] w-[23px] select-none object-contain"
    />
  );
}

function RefreshAssetIcon({ spinning = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const size = 23;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, size, size);
    };

    image.src = refreshIcon;

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cx(
        "pointer-events-none h-[23px] w-[23px] select-none",
        spinning && "inbox-refresh-icon-spin"
      )}
    />
  );
}

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
  const refreshTimerRef = useRef(null);
  const [refreshSpinning, setRefreshSpinning] = useState(false);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

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

  const handleRefreshClick = () => {
    if (typeof onRefresh !== "function") return;

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    setRefreshSpinning(false);

    window.requestAnimationFrame(() => {
      setRefreshSpinning(true);

      refreshTimerRef.current = window.setTimeout(() => {
        setRefreshSpinning(false);
        refreshTimerRef.current = null;
      }, REFRESH_SPIN_MS);
    });

    onRefresh();
  };

  return (
    <>
      <style>
        {`
          @keyframes inboxRefreshSpinOnce {
            0% {
              transform: rotate(0deg);
            }

            100% {
              transform: rotate(360deg);
            }
          }

          .inbox-refresh-icon-spin {
            animation: inboxRefreshSpinOnce ${REFRESH_SPIN_MS}ms cubic-bezier(0.22, 0.9, 0.28, 1) both;
            transform-origin: 50% 50%;
            will-change: transform;
          }

          .inbox-detail-header-ai-switch.ant-switch {
            min-width: 40px !important;
            height: 22px !important;
            background: rgb(203, 213, 225) !important;
            box-shadow: none !important;
          }

          .inbox-detail-header-ai-switch.ant-switch:hover {
            background: rgb(203, 213, 225) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked {
            background: rgb(var(--color-brand)) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked:hover {
            background: rgb(var(--color-brand-strong)) !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle {
            width: 18px !important;
            height: 18px !important;
            top: 2px !important;
          }

          .inbox-detail-header-ai-switch .ant-switch-handle::before {
            border-radius: 999px !important;
            box-shadow: 0 5px 12px -6px rgba(15, 23, 42, 0.55) !important;
          }

          .inbox-detail-header-ai-switch.ant-switch-checked .ant-switch-handle {
            inset-inline-start: calc(100% - 20px) !important;
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
            <span
              className={cx(
                "inline-flex h-[34px] items-center gap-2 rounded-[14px] border px-2.5",
                "bg-white shadow-[0_13px_30px_-26px_rgba(15,23,42,0.34)]",
                "transition-[border-color,background-color,opacity] duration-base ease-premium",
                automationEnabled
                  ? "border-[rgba(var(--color-brand),0.22)] text-brand"
                  : "border-line-soft text-text-muted"
              )}
            >
              <span className="hidden max-w-[112px] truncate text-[11.5px] font-semibold tracking-[-0.01em] lg:inline">
                {automationScopeLabel}
              </span>

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

              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em]">
                {automationEnabled ? "ON" : "OFF"}
              </span>
            </span>
          </Tooltip>

          <div className="h-[18px] w-px bg-line-soft" />

          <HeaderIconButton
            label="Conversation details"
            onClick={onOpenDetails}
            disabled={disableActions || typeof onOpenDetails !== "function"}
          >
            <HeaderAssetIcon src={infoIcon} alt="" />
          </HeaderIconButton>

          <HeaderIconButton
            label="Refresh"
            onClick={handleRefreshClick}
            disabled={typeof onRefresh !== "function"}
          >
            <RefreshAssetIcon spinning={refreshSpinning} />
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