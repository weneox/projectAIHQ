import * as React from "react";
import { cx } from "../../lib/cx.js";

function Spinner({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4 animate-spin", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        className="opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SIZE = {
  sm: "h-[34px] rounded-[10px] px-3 text-[12px]",
  md: "h-[38px] rounded-[10px] px-3.5 text-[13px]",
  lg: "h-[42px] rounded-[11px] px-4 text-[14px]",
  pill: "h-[40px] rounded-full px-4.5 text-[13px]",
  hero: "h-[44px] rounded-[12px] px-4.5 text-[14px]",
  icon: "h-[38px] w-[38px] rounded-[10px] px-0",
};

function variantClass(variant = "primary") {
  switch (variant) {
    case "brand":
    case "primary":
      return [
        "border-[rgba(23,43,91,0.18)] text-white",
        "bg-[linear-gradient(180deg,#355ebc_0%,#264ca5_100%)]",
        "shadow-[0_10px_22px_-12px_rgba(38,76,165,0.34),inset_0_1px_0_rgba(255,255,255,0.14)]",
        "hover:-translate-y-[1px] hover:shadow-[0_14px_26px_-12px_rgba(38,76,165,0.42),inset_0_1px_0_rgba(255,255,255,0.16)]",
        "active:translate-y-0 active:shadow-[0_8px_18px_-12px_rgba(38,76,165,0.3)]",
      ].join(" ");
    case "surface":
    case "secondary":
      return [
        "border-line bg-white text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.9),0_4px_12px_-10px_rgba(15,23,42,0.08)]",
        "hover:border-line-strong hover:bg-surface-muted",
      ].join(" ");
    case "soft":
      return [
        "border-[rgba(var(--color-brand),0.12)]",
        "bg-[rgba(var(--color-brand),0.06)] text-brand",
        "hover:border-[rgba(var(--color-brand),0.2)]",
        "hover:bg-[rgba(var(--color-brand),0.1)]",
      ].join(" ");
    case "quiet":
    case "ghost":
      return [
        "border-transparent bg-transparent text-text-muted shadow-none",
        "hover:bg-surface-muted hover:text-text",
      ].join(" ");
    case "outline":
      return [
        "border-line bg-transparent text-text shadow-none",
        "hover:border-line-strong hover:bg-white",
      ].join(" ");
    case "destructive":
      return [
        "border-[rgba(var(--color-danger),0.15)] text-white",
        "bg-[linear-gradient(180deg,rgba(var(--color-danger),1)_0%,rgba(var(--color-danger),0.9)_100%)]",
        "shadow-[0_10px_22px_-12px_rgba(170,43,52,0.34)]",
        "hover:-translate-y-[1px] hover:shadow-[0_14px_28px_-12px_rgba(170,43,52,0.42)]",
      ].join(" ");
    default:
      return [
        "border-[rgba(23,43,91,0.18)] text-white",
        "bg-[linear-gradient(180deg,#355ebc_0%,#264ca5_100%)]",
        "shadow-[0_10px_22px_-12px_rgba(38,76,165,0.34)]",
        "hover:-translate-y-[1px] hover:shadow-[0_14px_26px_-12px_rgba(38,76,165,0.42)]",
      ].join(" ");
  }
}

const Button = React.forwardRef(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled || isLoading);
  const iconOnly = !children && (leftIcon || rightIcon);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold tracking-[-0.02em]",
        "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-premium",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        "focus-visible:outline-none",
        fullWidth && "w-full",
        SIZE[size] || SIZE.md,
        variantClass(variant),
        iconOnly && size === "icon" && "gap-0",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Spinner />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}

      {children ? <span>{children}</span> : null}

      {!isLoading && rightIcon ? (
        <span className="shrink-0">{rightIcon}</span>
      ) : null}
    </button>
  );
});

export default Button;