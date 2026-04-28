import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../../lib/cx.js";

const SIZES = {
  sm: {
    shell: "h-9",
    inner: "px-3 text-[13px]",
  },
  md: {
    shell: "h-[42px]",
    inner: "px-4 text-[14px]",
  },
  lg: {
    shell: "h-[46px]",
    inner: "px-5 text-[14.5px]",
  },
  hero: {
    shell: "h-[54px]",
    inner: "px-6 text-[15.5px]",
  },
  auth: {
    shell: "h-[54px]",
    inner: "px-6 text-[15.5px]",
  },
  xl: {
    shell: "h-[54px]",
    inner: "px-6 text-[15.5px]",
  },
  icon: {
    shell: "h-[42px] w-[42px]",
    inner: "px-0 text-[14px]",
  },
};

function normalizeVariant(variant = "primary") {
  if (variant === "brand") return "primary";
  if (variant === "surface") return "secondary";
  if (variant === "destructive") return "danger";
  return variant;
}

function getVariantStyles(variant = "primary") {
  const value = normalizeVariant(variant);

  if (value === "secondary" || value === "outline") {
    return {
      border:
        "bg-[rgb(var(--color-line))] group-hover/button:bg-[rgb(var(--color-line-strong))] group-focus-visible/button:bg-[rgba(var(--color-brand),0.58)]",
      inner:
        "bg-white text-text group-hover/button:bg-surface-muted group-active/button:bg-surface-subtle",
      shadow:
        "shadow-[0_12px_30px_-28px_rgba(15,23,42,0.24)] group-focus-visible/button:shadow-[0_0_0_3px_rgba(46,96,255,0.08),0_16px_34px_-30px_rgba(46,96,255,0.18)]",
    };
  }

  if (value === "soft") {
    return {
      border:
        "bg-[rgba(var(--color-brand),0.22)] group-hover/button:bg-[rgba(var(--color-brand),0.34)] group-focus-visible/button:bg-[rgba(var(--color-brand),0.52)]",
      inner:
        "bg-brand-soft text-brand group-hover/button:bg-[rgba(var(--color-brand),0.12)] group-active/button:bg-[rgba(var(--color-brand),0.16)]",
      shadow:
        "shadow-[0_10px_26px_-26px_rgba(46,96,255,0.24)] group-focus-visible/button:shadow-[0_0_0_3px_rgba(46,96,255,0.08)]",
    };
  }

  if (value === "ghost") {
    return {
      border: "bg-transparent",
      inner:
        "bg-transparent text-text-muted group-hover/button:bg-surface-subtle group-hover/button:text-text group-active/button:bg-surface-muted",
      shadow: "shadow-none group-focus-visible/button:shadow-[0_0_0_3px_rgba(46,96,255,0.08)]",
    };
  }

  if (value === "danger") {
    return {
      border:
        "bg-[rgba(var(--color-danger),0.94)] group-hover/button:bg-[rgba(var(--color-danger),0.98)] group-focus-visible/button:bg-[rgba(var(--color-danger),0.98)]",
      inner:
        "bg-[rgb(var(--color-danger))] text-white group-hover/button:bg-[rgba(var(--color-danger),0.94)] group-active/button:bg-[rgba(var(--color-danger),0.9)]",
      shadow:
        "shadow-[0_16px_36px_-26px_rgba(190,24,93,0.42)] group-focus-visible/button:shadow-[0_0_0_3px_rgba(190,24,93,0.1),0_18px_38px_-28px_rgba(190,24,93,0.28)]",
    };
  }

  return {
    border:
      "bg-[rgb(var(--color-brand))] group-hover/button:bg-[rgb(var(--color-brand-strong))] group-focus-visible/button:bg-[rgb(var(--color-brand-strong))]",
    inner:
      "bg-[rgb(var(--color-brand))] text-white group-hover/button:bg-[rgb(var(--color-brand-strong))] group-active/button:bg-[rgba(var(--color-brand-strong),0.94)]",
    shadow:
      "shadow-[0_16px_36px_-26px_rgba(46,96,255,0.54)] group-focus-visible/button:shadow-[0_0_0_3px_rgba(46,96,255,0.1),0_18px_38px_-28px_rgba(46,96,255,0.34)]",
  };
}

const Button = forwardRef(function Button(
  {
    as: Comp = "button",
    type = "button",
    variant = "primary",
    size = "lg",
    className,
    innerClassName,
    children,
    leftIcon,
    rightIcon,
    loading = false,
    isLoading = false,
    disabled = false,
    fullWidth = false,
    ...props
  },
  ref
) {
  const activeSize = SIZES[size] || SIZES.lg;
  const styles = getVariantStyles(variant);
  const busy = Boolean(loading || isLoading);
  const isDisabled = Boolean(disabled || busy);
  const isIconOnly = !children && (leftIcon || rightIcon);

  return (
    <Comp
      ref={ref}
      type={Comp === "button" ? type : undefined}
      disabled={Comp === "button" ? isDisabled : undefined}
      aria-busy={busy || undefined}
      className={cx(
        "ui-button-shell group/button relative inline-flex overflow-hidden bg-white p-[1.5px]",
        "ui-radius-control-outer outline-none transition-[box-shadow,opacity] duration-base ease-premium",
        "focus:outline-none focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none",
        fullWidth && "w-full",
        activeSize.shell,
        styles.shadow,
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-0 ui-radius-control-outer transition-colors duration-base ease-premium",
          styles.border
        )}
      />

      <span
        className={cx(
          "relative z-[1] flex h-full w-full items-center justify-center gap-2 ui-radius-control-inner",
          "font-semibold tracking-[-0.018em] transition-colors duration-base ease-premium",
          activeSize.inner,
          isIconOnly && "px-0",
          styles.inner,
          innerClassName
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.2} />
        ) : leftIcon ? (
          <span className="pointer-events-none inline-flex shrink-0 items-center">
            {leftIcon}
          </span>
        ) : null}

        {children ? (
          <span className="pointer-events-none inline-flex select-none items-center whitespace-nowrap leading-none">
            {children}
          </span>
        ) : null}

        {!busy && rightIcon ? (
          <span className="pointer-events-none inline-flex shrink-0 items-center">
            {rightIcon}
          </span>
        ) : null}
      </span>
    </Comp>
  );
});

export default Button;
