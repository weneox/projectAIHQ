import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
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
    <Badge
      tone={STATUS_TONES[meta.tone] || "neutral"}
      className={cx("shrink-0", className)}
      dot
    >
      {meta.label}
    </Badge>
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
    <Button
      type={type}
      aria-label={ariaLabel}
      variant={quiet ? "secondary" : "primary"}
      size="sm"
      fullWidth={fullWidth}
      rightIcon={showArrow ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : undefined}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ChannelInspectButton({
  className,
  children = "Details",
  ...props
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.1} />
    </button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  const label = capabilities.join(" - ");

  return (
    <div
      title={label}
      className={cx("truncate text-[12px] text-text-muted", className)}
    >
      {label}
    </div>
  );
}
