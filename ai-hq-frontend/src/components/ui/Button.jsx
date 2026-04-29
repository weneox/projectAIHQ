import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../../lib/cx.js";

const SIZE_CLASS = {
  sm: "ui-button--sm",
  md: "ui-button--md",
  lg: "ui-button--lg",
  hero: "ui-button--hero",
  auth: "ui-button--auth",
  xl: "ui-button--xl",
  icon: "ui-button--icon",
};

const VARIANT_CLASS = {
  primary: "ui-button--primary",
  secondary: "ui-button--secondary",
  outline: "ui-button--outline",
  ghost: "ui-button--ghost",
  soft: "ui-button--soft",
  danger: "ui-button--danger",
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
  const busy = Boolean(loading || isLoading);
  const isDisabled = Boolean(disabled || busy);
  const iconOnly = !children && (leftIcon || rightIcon);

  return (
    <Comp
      ref={ref}
      type={Comp === "button" ? type : undefined}
      disabled={Comp === "button" ? isDisabled : undefined}
      aria-busy={busy || undefined}
      aria-disabled={Comp !== "button" && isDisabled ? true : undefined}
      className={cx(
        "ui-button",
        SIZE_CLASS[size] || SIZE_CLASS.lg,
        VARIANT_CLASS[resolvedVariant] || VARIANT_CLASS.primary,
        fullWidth && "ui-button--full",
        className
      )}
      {...props}
    >
      <span className={cx("ui-button__inner", innerClassName)}>
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.2} />
        ) : leftIcon ? (
          <span className="ui-button__icon">{leftIcon}</span>
        ) : null}

        {children ? (
          <span className="inline-flex items-center justify-center whitespace-nowrap leading-none">
            {children}
          </span>
        ) : null}

        {!busy && rightIcon ? (
          <span className="ui-button__icon">{rightIcon}</span>
        ) : null}

        {iconOnly && !busy && !leftIcon && rightIcon ? null : null}
      </span>
    </Comp>
  );
});

export default Button;