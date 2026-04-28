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
        strokeWidth="2"
        className="opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SIZE = {
  sm: "h-9 rounded-[12px] px-3 text-[12.5px]",
  md: "h-10 rounded-[13px] px-3.5 text-[13.5px]",
  lg: "h-11 rounded-[14px] px-4 text-[14px]",
  hero: "h-12 rounded-[15px] px-5 text-[14.5px]",
  icon: "h-10 w-10 rounded-[13px] px-0",
};

function variantClass(variant = "primary") {
  switch (variant) {
    case "primary":
    case "brand":
      return [
        "border-[rgba(var(--color-brand),0.96)]",
        "bg-brand text-white",
        "shadow-[0_16px_34px_-24px_rgba(46,96,255,0.88)]",
        "hover:bg-brand-strong hover:border-[rgba(var(--color-brand-strong),0.98)]",
        "hover:shadow-[0_20px_42px_-28px_rgba(46,96,255,0.95)]",
        "active:bg-[rgba(var(--color-brand-strong),0.96)]",
      ].join(" ");

    case "secondary":
    case "surface":
      return [
        "border-line bg-surface text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_12px_28px_-26px_rgba(15,23,42,0.22)]",
        "hover:border-line-strong hover:bg-surface-muted",
        "active:bg-surface-subtle",
      ].join(" ");

    case "soft":
      return [
        "border-[rgba(var(--color-brand),0.16)] bg-brand-soft text-brand",
        "shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]",
        "hover:border-[rgba(var(--color-brand),0.26)] hover:bg-[rgba(var(--color-brand),0.115)]",
        "active:bg-[rgba(var(--color-brand),0.14)]",
      ].join(" ");

    case "ghost":
      return [
        "border-transparent bg-transparent text-text-muted shadow-none",
        "hover:bg-surface-subtle hover:text-text",
        "active:bg-surface-muted",
      ].join(" ");

    case "outline":
      return [
        "border-line bg-transparent text-text shadow-none",
        "hover:border-line-strong hover:bg-surface",
        "active:bg-surface-muted",
      ].join(" ");

    case "destructive":
      return [
        "border-[rgba(var(--color-danger),0.9)] bg-danger text-white",
        "shadow-[0_16px_34px_-24px_rgba(190,24,93,0.62)]",
        "hover:bg-[rgba(var(--color-danger),0.92)] hover:border-[rgba(var(--color-danger),0.94)]",
        "active:bg-[rgba(var(--color-danger),0.96)]",
      ].join(" ");

    default:
      return variantClass("primary");
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold tracking-[-0.015em]",
        "transition-[background-color,border-color,color,box-shadow,opacity] duration-base ease-premium",
        "will-change-[background-color,border-color,box-shadow]",
        "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        fullWidth && "w-full",
        SIZE[size] || SIZE.md,
        variantClass(variant),
        iconOnly && size === "icon" && "gap-0",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Spinner className="shrink-0" />
      ) : leftIcon ? (
        <span className="pointer-events-none inline-flex shrink-0 items-center justify-center">
          {leftIcon}
        </span>
      ) : null}

      {children ? (
        <span className="pointer-events-none select-none leading-none">
          {children}
        </span>
      ) : null}

      {!isLoading && rightIcon ? (
        <span className="pointer-events-none inline-flex shrink-0 items-center justify-center">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

export default Button;
