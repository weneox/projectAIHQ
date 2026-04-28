import { forwardRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cx } from "../../lib/cx.js";

function resolveAppearance(appearance = "default") {
  switch (appearance) {
    case "product":
      return {
        shell: "rounded-[15px]",
        height: "h-[46px]",
        input: "text-[14.5px] font-medium tracking-[-0.012em]",
        textareaWrap: "px-4 py-3.5",
        textarea: "min-h-[136px] text-[14.5px] font-medium leading-6 tracking-[-0.012em]",
        selectWrap: "px-4",
        select: "h-[46px] pr-10 text-[14.5px] font-medium tracking-[-0.012em]",
        leftInset: "left-4",
        rightInset: "right-3.5",
        padLeftBase: "pl-4",
        padLeftWithIcon: "pl-[46px]",
        padRightBase: "pr-4",
        padRightWithSlot: "pr-[46px]",
        padRightWide: "pr-[88px]",
      };

    case "quiet":
      return {
        shell: "rounded-[13px]",
        height: "h-[40px]",
        input: "text-[13.5px] font-medium tracking-[-0.01em]",
        textareaWrap: "px-3.5 py-3",
        textarea: "min-h-[112px] text-[13.5px] font-medium leading-6 tracking-[-0.01em]",
        selectWrap: "px-3.5",
        select: "h-[40px] pr-9 text-[13.5px] font-medium tracking-[-0.01em]",
        leftInset: "left-3.5",
        rightInset: "right-3",
        padLeftBase: "pl-3.5",
        padLeftWithIcon: "pl-[40px]",
        padRightBase: "pr-3.5",
        padRightWithSlot: "pr-[40px]",
        padRightWide: "pr-[78px]",
      };

    case "large":
      return {
        shell: "rounded-[17px]",
        height: "h-[54px]",
        input: "text-[15.5px] font-medium tracking-[-0.015em]",
        textareaWrap: "px-4 py-4",
        textarea: "min-h-[148px] text-[15px] font-medium leading-7 tracking-[-0.012em]",
        selectWrap: "px-4",
        select: "h-[54px] pr-11 text-[15.5px] font-medium tracking-[-0.015em]",
        leftInset: "left-4",
        rightInset: "right-4",
        padLeftBase: "pl-4",
        padLeftWithIcon: "pl-[48px]",
        padRightBase: "pr-4",
        padRightWithSlot: "pr-[48px]",
        padRightWide: "pr-[92px]",
      };

    default:
      return {
        shell: "rounded-[14px]",
        height: "h-[42px]",
        input: "text-[14px] font-medium tracking-[-0.01em]",
        textareaWrap: "px-3.5 py-3.5",
        textarea: "min-h-[124px] text-[14px] font-medium leading-6 tracking-[-0.01em]",
        selectWrap: "px-3.5",
        select: "h-[42px] pr-10 text-[14px] font-medium tracking-[-0.01em]",
        leftInset: "left-3.5",
        rightInset: "right-3.5",
        padLeftBase: "pl-3.5",
        padLeftWithIcon: "pl-[42px]",
        padRightBase: "pr-3.5",
        padRightWithSlot: "pr-[42px]",
        padRightWide: "pr-[84px]",
      };
  }
}

function surfaceClass({ disabled, readOnly, invalid }) {
  if (disabled) {
    return [
      "border-[rgba(var(--color-line-soft),0.95)]",
      "bg-surface-subtle text-text-subtle opacity-75",
      "shadow-none",
    ].join(" ");
  }

  if (invalid) {
    return [
      "border-[rgba(var(--color-danger),0.42)] bg-surface",
      "shadow-[0_0_0_4px_rgba(var(--color-danger),0.06)]",
    ].join(" ");
  }

  if (readOnly) {
    return [
      "border-line-soft bg-surface-muted",
      "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]",
    ].join(" ");
  }

  return [
    "border-line bg-surface",
    "shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_14px_32px_-30px_rgba(15,23,42,0.28)]",
    "hover:border-line-strong hover:bg-surface",
    "focus-within:border-brand focus-within:shadow-[var(--focus-ring),0_18px_38px_-32px_rgba(46,96,255,0.42)]",
  ].join(" ");
}

function FieldShell({
  children,
  className,
  disabled = false,
  readOnly = false,
  invalid = false,
  appearance = "default",
}) {
  const view = resolveAppearance(appearance);

  return (
    <div
      className={cx(
        "ui-field-shell relative w-full overflow-hidden border-[1.5px]",
        "transition-[border-color,background-color,box-shadow] duration-base ease-premium",
        view.shell,
        surfaceClass({ disabled, readOnly, invalid }),
        className
      )}
    >
      {children}
    </div>
  );
}

function resolveInputPadding({ hasLeftIcon, hasRightSlot, hasWideRight, view }) {
  return cx(
    hasLeftIcon ? view.padLeftWithIcon : view.padLeftBase,
    hasWideRight
      ? view.padRightWide
      : hasRightSlot
        ? view.padRightWithSlot
        : view.padRightBase
  );
}

function ControlIconSlot({ children, className }) {
  return (
    <span
      className={cx(
        "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 text-text-subtle transition-colors duration-base ease-premium",
        "group-focus-within:text-brand",
        className
      )}
    >
      {children}
    </span>
  );
}

export function InputGroup({
  className,
  inputClassName,
  leftIcon,
  right,
  onClear,
  value,
  placeholder,
  disabled,
  readOnly,
  invalid = false,
  appearance = "default",
  ...props
}) {
  const view = resolveAppearance(appearance);

  const showClear =
    typeof onClear === "function" &&
    !disabled &&
    !readOnly &&
    String(value ?? "").length > 0;

  const hasRightSlot = Boolean(showClear || right);
  const hasWideRight = Boolean(showClear && right);

  return (
    <FieldShell
      className={cx("group", className)}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      {leftIcon ? (
        <ControlIconSlot className={view.leftInset}>{leftIcon}</ControlIconSlot>
      ) : null}

      <input
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cx(
          "ui-field-control block w-full border-0 bg-transparent text-text outline-none",
          "placeholder:text-text-subtle placeholder:opacity-100",
          "focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0",
          disabled && "cursor-not-allowed",
          view.height,
          view.input,
          resolveInputPadding({
            hasLeftIcon: Boolean(leftIcon),
            hasRightSlot,
            hasWideRight,
            view,
          }),
          inputClassName
        )}
        {...props}
      />

      {hasRightSlot ? (
        <div
          className={cx(
            "absolute top-1/2 z-[1] flex -translate-y-1/2 items-center gap-1.5",
            view.rightInset
          )}
        >
          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] text-text-subtle transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.1} />
            </button>
          ) : null}

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
    </FieldShell>
  );
}

const Input = forwardRef(function Input(
  {
    className,
    inputClassName,
    disabled,
    readOnly,
    invalid = false,
    leftIcon,
    right,
    appearance = "default",
    ...props
  },
  ref
) {
  const view = resolveAppearance(appearance);
  const hasRightSlot = Boolean(right);

  return (
    <FieldShell
      className={cx("group", className)}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      {leftIcon ? (
        <ControlIconSlot className={view.leftInset}>{leftIcon}</ControlIconSlot>
      ) : null}

      <input
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cx(
          "ui-field-control block w-full border-0 bg-transparent text-text outline-none",
          "placeholder:text-text-subtle placeholder:opacity-100",
          "focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0",
          disabled && "cursor-not-allowed",
          view.height,
          view.input,
          resolveInputPadding({
            hasLeftIcon: Boolean(leftIcon),
            hasRightSlot,
            hasWideRight: false,
            view,
          }),
          inputClassName
        )}
        {...props}
      />

      {right ? (
        <div
          className={cx(
            "absolute top-1/2 z-[1] -translate-y-1/2",
            view.rightInset
          )}
        >
          {right}
        </div>
      ) : null}
    </FieldShell>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea(
  {
    className,
    textClassName,
    disabled,
    readOnly,
    invalid = false,
    rows = 5,
    appearance = "default",
    ...props
  },
  ref
) {
  const view = resolveAppearance(appearance);

  return (
    <FieldShell
      className={cx("group", className)}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className={view.textareaWrap}>
        <textarea
          ref={ref}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          className={cx(
            "ui-field-control block w-full resize-y border-0 bg-transparent p-0 text-text outline-none",
            "placeholder:text-text-subtle placeholder:opacity-100",
            "focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0",
            disabled && "cursor-not-allowed",
            view.textarea,
            textClassName
          )}
          {...props}
        />
      </div>
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  {
    className,
    selectClassName,
    disabled,
    readOnly,
    invalid = false,
    children,
    appearance = "default",
    ...props
  },
  ref
) {
  const view = resolveAppearance(appearance);

  return (
    <FieldShell
      className={cx("group", className)}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className={cx("relative", view.selectWrap)}>
        <select
          ref={ref}
          disabled={disabled || readOnly}
          aria-invalid={invalid || undefined}
          className={cx(
            "ui-field-control w-full appearance-none border-0 bg-transparent p-0 text-text outline-none",
            "focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0",
            (disabled || readOnly) && "cursor-not-allowed",
            view.select,
            selectClassName
          )}
          {...props}
        >
          {children}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle transition-colors duration-base ease-premium group-focus-within:text-brand"
          strokeWidth={2.1}
        />
      </div>
    </FieldShell>
  );
});
