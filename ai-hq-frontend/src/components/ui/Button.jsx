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
        strokeWidth="2.25"
        className="opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SIZE = {
  sm: "h-8 rounded-soft px-3 text-[13px]",
  md: "h-10 rounded-soft px-4 text-[14px]",
  lg: "h-11 rounded-soft px-4.5 text-[14px]",
  pill: "h-11 rounded-pill px-5 text-[14px]",
  hero: "h-12 rounded-pill px-6 text-[15px]",
  icon: "h-10 w-10 rounded-soft px-0",
};

function variantClass(variant = "primary") {
  switch (variant) {
    case "brand":
    case "primary":
      return "border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong";
    case "surface":
    case "secondary":
      return "border-line bg-surface text-text hover:border-line-strong hover:bg-surface-muted";
    case "soft":
      return "border-line bg-brand-soft text-brand hover:border-brand hover:bg-brand-soft";
    case "quiet":
    case "ghost":
      return "border-transparent bg-transparent text-text-muted hover:bg-surface-muted hover:text-text";
    case "outline":
      return "border-line bg-transparent text-text hover:border-line-strong hover:bg-surface";
    case "destructive":
      return "border-danger bg-danger text-white hover:opacity-95";
    default:
      return "border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong";
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
        "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-premium",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none",
        fullWidth && "w-full",
        SIZE[size] || SIZE.md,
        variantClass(variant),
        iconOnly && size === "icon" && "gap-0",
        className
      )}
      {...props}
    >
      {isLoading ? <Spinner /> : leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {children ? <span>{children}</span> : null}
      {!isLoading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
});

export default Button;