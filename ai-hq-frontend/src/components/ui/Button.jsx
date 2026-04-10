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
  sm: "h-8 rounded-soft px-3 text-[12px]",
  md: "h-10 rounded-soft px-3.5 text-[13px]",
  lg: "h-11 rounded-soft px-4 text-[14px]",
  hero: "h-11 rounded-soft px-4.5 text-[14px]",
  icon: "h-10 w-10 rounded-soft px-0",
};

function variantClass(variant = "primary") {
  switch (variant) {
    case "primary":
    case "brand":
      return [
        "border-[rgba(var(--color-brand),0.9)]",
        "bg-brand text-white",
        "shadow-[0_10px_24px_-16px_rgba(46,96,255,0.55)]",
        "hover:bg-brand-strong hover:border-[rgba(var(--color-brand-strong),0.92)]",
        "hover:shadow-[0_16px_32px_-18px_rgba(46,96,255,0.52)]",
      ].join(" ");

    case "secondary":
    case "surface":
      return [
        "border-line bg-surface text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]",
        "hover:border-line-strong hover:bg-surface-muted",
      ].join(" ");

    case "soft":
      return [
        "border-[rgba(var(--color-brand),0.14)] bg-brand-soft text-brand",
        "hover:border-[rgba(var(--color-brand),0.22)] hover:bg-[rgba(var(--color-brand),0.12)]",
      ].join(" ");

    case "ghost":
      return [
        "border-transparent bg-transparent text-text-muted",
        "hover:bg-surface-subtle hover:text-text",
      ].join(" ");

    case "outline":
      return [
        "border-line bg-transparent text-text",
        "hover:border-line-strong hover:bg-surface",
      ].join(" ");

    case "destructive":
      return [
        "border-[rgba(var(--color-danger),0.9)] bg-danger text-white",
        "shadow-[0_10px_24px_-16px_rgba(190,24,93,0.42)]",
        "hover:bg-[rgba(var(--color-danger),0.92)] hover:border-[rgba(var(--color-danger),0.94)]",
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold tracking-[-0.01em]",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-base ease-premium",
        "active:translate-y-[1px]",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:transform-none",
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