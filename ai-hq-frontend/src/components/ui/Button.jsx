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
  sm: "h-[34px] rounded-[8px] px-3 text-[12px]",
  md: "h-[38px] rounded-[9px] px-3.5 text-[13px]",
  lg: "h-[42px] rounded-[10px] px-4 text-[14px]",
  pill: "h-[38px] rounded-full px-4 text-[13px]",
  hero: "h-[42px] rounded-[10px] px-4 text-[14px]",
  icon: "h-[38px] w-[38px] rounded-[9px] px-0",
};

function variantClass(variant = "primary") {
  switch (variant) {
    case "brand":
    case "primary":
      return [
        "border-[rgba(31,77,168,0.96)] bg-[rgb(var(--color-brand))] text-white",
        "shadow-[0_10px_24px_-16px_rgba(31,77,168,0.42)]",
        "hover:bg-[rgb(var(--color-brand-strong))] hover:border-[rgb(var(--color-brand-strong))]",
        "active:translate-y-0",
      ].join(" ");

    case "surface":
    case "secondary":
      return [
        "border-line bg-white text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.9)]",
        "hover:border-line-strong hover:bg-surface-muted",
      ].join(" ");

    case "soft":
      return [
        "border-[rgba(var(--color-brand),0.12)]",
        "bg-[rgba(var(--color-brand),0.06)] text-brand",
        "hover:border-[rgba(var(--color-brand),0.18)]",
        "hover:bg-[rgba(var(--color-brand),0.1)]",
      ].join(" ");

    case "quiet":
    case "ghost":
      return [
        "border-transparent bg-transparent text-text-muted shadow-none",
        "hover:bg-surface-subtle hover:text-text",
      ].join(" ");

    case "outline":
      return [
        "border-line bg-transparent text-text shadow-none",
        "hover:border-line-strong hover:bg-white",
      ].join(" ");

    case "destructive":
      return [
        "border-[rgba(var(--color-danger),1)] bg-[rgb(var(--color-danger))] text-white",
        "shadow-[0_10px_24px_-16px_rgba(185,28,28,0.34)]",
        "hover:bg-[rgba(var(--color-danger),0.92)] hover:border-[rgba(var(--color-danger),0.92)]",
      ].join(" ");

    default:
      return [
        "border-[rgba(31,77,168,0.96)] bg-[rgb(var(--color-brand))] text-white",
        "shadow-[0_10px_24px_-16px_rgba(31,77,168,0.42)]",
        "hover:bg-[rgb(var(--color-brand-strong))] hover:border-[rgb(var(--color-brand-strong))]",
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
        "hover:-translate-y-[1px]",
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