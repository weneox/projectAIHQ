import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import Button from "../ui/Button.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_TONE_CLASS = {
  success: "text-success",
  info: "text-brand",
  warning: "text-warning",
  neutral: "text-text-subtle",
};

export function ChannelStatus({ status, className }) {
  const meta = getChannelStatusMeta(status);

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
        STATUS_TONE_CLASS[meta.tone] || STATUS_TONE_CLASS.neutral,
        className
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-current" />
      <span>{meta.label}</span>
    </span>
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
      rightIcon={showArrow ? <ArrowRight className="h-3.5 w-3.5" /> : undefined}
      className={cx(
        "!h-11 !rounded-none !px-4 !text-[11px] !font-semibold !uppercase !tracking-[0.16em]",
        fullWidth && "!justify-between",
        quiet &&
          "!border-line-soft !bg-surface !text-text-muted hover:!border-line hover:!bg-surface-subtle hover:!text-text",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ChannelInspectButton({
  className,
  children = "Inspect",
  ...props
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-11 items-center justify-between gap-2 bg-surface px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle transition duration-fast ease-premium hover:bg-surface-subtle hover:text-text",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
    </button>
  );
}

export function ChannelCapabilityLine({ capabilities = [], className }) {
  if (!capabilities.length) return null;

  const label = capabilities.join(" / ");

  return (
    <div
      title={label}
      className={cx(
        "truncate text-[11px] font-medium uppercase tracking-[0.14em] text-text-subtle",
        className
      )}
    >
      {label}
    </div>
  );
}
