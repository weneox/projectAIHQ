import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../../lib/cx.js";

const SIZE_STYLES = {
  sm: "h-10 px-4 text-[13px]",
  md: "h-[46px] px-5 text-[14px]",
  lg: "h-[54px] px-6 text-[15px]",
  hero: "h-[54px] px-6 text-[15px]",
  auth: "h-[54px] px-6 text-[15px]",
  xl: "h-[56px] px-6 text-[15.5px]",
  icon: "h-[46px] w-[46px] px-0 text-[14px]",
};

const VARIANT_STYLES = {
  primary: {
    shell:
      "bg-[rgba(46,96,255,0.28)] shadow-[0_14px_34px_-24px_rgba(46,96,255,0.42)]",
    inner:
      "bg-[rgb(var(--color-brand))] text-white hover:bg-[rgb(var(--color-brand-strong))] active:bg-[rgb(var(--color-brand-strong))]",
  },
  secondary: {
    shell:
      "bg-[rgb(var(--color-line-strong))] shadow-[0_12px_28px_-26px_rgba(15,23,42,0.18)]",
    inner:
      "bg-white text-text hover:bg-surface-muted active:bg-surface-subtle",
  },
  outline: {
    shell:
      "bg-[rgb(var(--color-line-strong))] shadow-[0_12px_28px_-26px_rgba(15,23,42,0.18)]",
    inner:
      "bg-white text-text hover:bg-surface-muted active:bg-surface-subtle",
  },
  ghost: {
    shell: "bg-transparent shadow-none",
    inner:
      "bg-transparent text-text-muted hover:bg-surface-subtle hover:text-text active:bg-surface-muted",
  },
  soft: {
    shell:
      "bg-[rgba(var(--color-brand),0.18)] shadow-[0_12px_28px_-26px_rgba(46,96,255,0.22)]",
    inner:
      "bg-[rgba(var(--color-brand),0.08)] text-brand hover:bg-[rgba(var(--color-brand),0.12)] active:bg-[rgba(var(--color-brand),0.16)]",
  },
  danger: {
    shell:
      "bg-[rgba(var(--color-danger),0.24)] shadow-[0_14px_32px_-24px_rgba(190,24,93,0.28)]",
    inner:
      "bg-[rgb(var(--color-danger))] text-white hover:bg-[rgba(var(--color-danger),0.94)] active:bg-[rgba(var(--color-danger),0.92)]",
  },
};

function normalizeVariant(variant = "primary") {
  if (variant === "brand") return "primary";
  if (variant === "surface") return "secondary";
  if (variant === "destructive") return "danger";
  return variant;
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
  const resolvedVariant = normalizeVariant(variant);
  const variantStyles = VARIANT_STYLES[resolvedVariant] || VARIANT_STYLES.primary;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.lg;
  const busy = Boolean(loading || isLoading);
  const isDisabled = Boolean(disabled || busy);
  const iconOnly = !children && (leftIcon || rightIcon);

  return (
    <Comp
      ref={ref}
      type={Comp === "button" ? type : undefined}
      disabled={Comp === "button" ? isDisabled : undefined}
      aria-busy={busy || undefined}
      className={cx(
        "group inline-flex shrink-0 overflow-hidden p-[1.5px]",
        "ui-control-radius-outer transition-[transform,box-shadow,opacity] duration-200 ease-out",
        "focus:outline-none focus-visible:outline-none",
        "focus-visible:ring-0",
        !iconOnly && "justify-stretch",
        fullWidth && "w-full",
        variantStyles.shell,
        isDisabled
          ? "pointer-events-none opacity-60"
          : "hover:-translate-y-[1px] active:translate-y-0",
        className
      )}
      {...props}
    >
      <span
        className={cx(
          "relative inline-flex h-full w-full items-center justify-center gap-2",
          "ui-control-radius-inner font-semibold tracking-[-0.02em] leading-none",
          "transition-[background-color,color,box-shadow] duration-200 ease-out",
          sizeClass,
          iconOnly && "justify-center",
          variantStyles.inner,
          innerClassName
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.2} />
        ) : leftIcon ? (
          <span className="inline-flex shrink-0 items-center justify-center">
            {leftIcon}
          </span>
        ) : null}

        {children ? (
          <span className="inline-flex items-center justify-center whitespace-nowrap leading-none">
            {children}
          </span>
        ) : null}

        {!busy && rightIcon ? (
          <span className="inline-flex shrink-0 items-center justify-center">
            {rightIcon}
          </span>
        ) : null}
      </span>
    </Comp>
  );
});

export default Button;