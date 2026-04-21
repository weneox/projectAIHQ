import { cx } from "../../lib/cx.js";
import {
  LaunchPrimaryAction,
  LaunchStatusBadge,
  LaunchTextAction,
} from "../ui/AppShellPrimitives.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_TONES = {
  success: "success",
  info: "info",
  warning: "warning",
  neutral: "neutral",
};

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);

  return (
    <LaunchStatusBadge
      tone={STATUS_TONES[meta.tone] || "neutral"}
      className={className}
    >
      {meta.label}
    </LaunchStatusBadge>
  );
}

export function ChannelActionButton({
  children,
  className,
  quiet = false,
  showArrow = true,
  type = "button",
  ariaLabel,
  fullWidth = false,
  ...props
}) {
  return (
    <LaunchPrimaryAction
      type={type}
      aria-label={ariaLabel}
      quiet={quiet}
      showArrow={showArrow}
      fullWidth={fullWidth}
      className={className}
      {...props}
    >
      {children}
    </LaunchPrimaryAction>
  );
}

export function ChannelInspectButton({
  className,
  children = "Details",
  ...props
}) {
  return (
    <LaunchTextAction className={className} {...props}>
      {children}
    </LaunchTextAction>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  const label = capabilities.slice(0, 3).join(" · ");

  return (
    <div
      title={label}
      className={cx(
        "truncate text-[12px] text-[rgba(100,116,139,0.96)]",
        className
      )}
    >
      {label}
    </div>
  );
}