import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cx } from "../../lib/cx.js";
import Button from "../ui/Button.jsx";
import { getChannelStatusMeta } from "./channelCatalogModel.js";

const STATUS_TONES = {
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
        "inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.01em]",
        STATUS_TONES[meta.tone] || STATUS_TONES.info,
        className
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
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
      rightIcon={showArrow ? <ArrowRight className="h-4 w-4" /> : undefined}
      className={cx(
        "!h-12 !rounded-[15px] !px-5 !text-[11px] !font-semibold !uppercase !tracking-[0.14em] !shadow-none transition duration-fast ease-premium",
        fullWidth && "!justify-between",
        quiet
          ? "!border-line !bg-surface !text-text-muted hover:!border-line-strong hover:!bg-surface-subtle hover:!text-text"
          : "!border-0 !bg-[linear-gradient(180deg,#2f5ccf_0%,#274cae_100%)] !text-white hover:-translate-y-[1px] hover:!opacity-100 hover:shadow-[0_16px_30px_-18px_rgba(37,99,235,0.5)]",
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
  children = "Details",
  ...props
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center gap-2 px-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle transition duration-fast ease-premium hover:text-text",
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

  const label = capabilities.join(" · ");

  return (
    <div
      title={label}
      className={cx(
        "truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle",
        className
      )}
    >
      {label}
    </div>
  );
}