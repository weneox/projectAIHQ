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
  sm: "h-8 rounded-sm px-3 text-sm",
  md: "h-10 rounded-md px-4 text-sm",
  lg: "h-10 rounded-md px-4 text-sm",
  pill: "h-11 rounded-pill px-5 text-sm",
  hero: "h-12 rounded-pill px-6 text-sm",
  icon: "h-10 w-10 rounded-md px-0",
};

function variantClass(variant) {
  switch (variant) {
    case "brand":
    case "primary":
      return "border border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong";
    case "surface":
    case "secondary":
      return "border border-line bg-surface text-text hover:border-line-strong hover:bg-surface-muted";
    case "quiet":
      return "border border-transparent bg-transparent text-text-muted hover:bg-surface-muted hover:text-text";
    case "outline":
      return "border border-line bg-transparent text-text hover:border-line-strong hover:bg-surface";
    case "ghost":
      return "border border-transparent bg-transparent text-text-muted hover:bg-surface-muted hover:text-text";
    case "destructive":
      return "border border-danger bg-danger text-white hover:opacity-95";
    default:
      return "border border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong";
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
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] transition-[background-color,border-color,color] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-0",
        SIZE[size] || SIZE.md,
        variantClass(variant),
        className
      )}
      {...props}
    >
      {isLoading ? <Spinner /> : leftIcon ? leftIcon : null}
      {children ? <span>{children}</span> : null}
      {!isLoading && rightIcon ? rightIcon : null}
    </button>
  );
});

export default Button;
