import { forwardRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cx } from "../../lib/cx.js";

function resolveAppearance(appearance = "default") {
  switch (appearance) {
    case "product":
      return {
        shell: "rounded-soft",
        height: "h-[44px]",
        input: "text-[14px]",
        textareaWrap: "px-3.5 py-3.5",
        textarea: "min-h-[132px] text-[14px] leading-6",
        selectWrap: "px-3.5",
        select: "h-[44px] pr-10 text-[14px]",
        leftInset: "left-3.5",
        rightInset: "right-3.5",
        padLeftBase: "pl-3.5",
        padLeftWithIcon: "pl-11",
        padRightBase: "pr-3.5",
        padRightWithSlot: "pr-11",
        padRightWide: "pr-[84px]",
      };

    case "quiet":
      return {
        shell: "rounded-soft",
        height: "h-[38px]",
        input: "text-[13px]",
        textareaWrap: "px-3 py-3",
        textarea: "min-h-[112px] text-[13px] leading-6",
        selectWrap: "px-3",
        select: "h-[38px] pr-9 text-[13px]",
        leftInset: "left-3",
        rightInset: "right-3",
        padLeftBase: "pl-3",
        padLeftWithIcon: "pl-9.5",
        padRightBase: "pr-3",
        padRightWithSlot: "pr-9.5",
        padRightWide: "pr-[76px]",
      };

    default:
      return {
        shell: "rounded-soft",
        height: "h-[40px]",
        input: "text-[14px]",
        textareaWrap: "px-3.5 py-3.5",
        textarea: "min-h-[120px] text-[14px] leading-6",
        selectWrap: "px-3.5",
        select: "h-[40px] pr-10 text-[14px]",
        leftInset: "left-3.5",
        rightInset: "right-3.5",
        padLeftBase: "pl-3.5",
        padLeftWithIcon: "pl-11",
        padRightBase: "pr-3.5",
        padRightWithSlot: "pr-11",
        padRightWide: "pr-[84px]",
      };
  }
}

function surfaceClass({ disabled, readOnly, invalid }) {
  if (disabled) {
    return "border-line-soft bg-surface-subtle text-text-subtle opacity-70";
  }

  if (invalid) {
    return "border-[rgba(var(--color-danger),0.26)] bg-surface";
  }

  if (readOnly) {
    return "border-line-soft bg-surface-muted";
  }

  return [
    "border-line bg-surface",
    "shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]",
    "hover:border-line-strong hover:bg-surface",
    "focus-within:border-brand focus-within:shadow-[var(--focus-ring)]",
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
        "ui-field-shell relative w-full overflow-hidden border transition-[border-color,background-color,box-shadow] duration-base ease-premium",
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
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      {leftIcon ? (
        <span
          className={cx(
            "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 text-text-subtle",
            view.leftInset
          )}
        >
          {leftIcon}
        </span>
      ) : null}

      <input
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cx(
          "ui-field-control block w-full border-0 bg-transparent outline-none placeholder:text-text-subtle",
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-soft text-text-subtle transition-colors hover:bg-surface-subtle hover:text-text"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
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
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      {leftIcon ? (
        <span
          className={cx(
            "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 text-text-subtle",
            view.leftInset
          )}
        >
          {leftIcon}
        </span>
      ) : null}

      <input
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cx(
          "ui-field-control block w-full border-0 bg-transparent outline-none placeholder:text-text-subtle",
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
      className={className}
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
            "ui-field-control block w-full resize-y border-0 bg-transparent p-0 text-text outline-none placeholder:text-text-subtle",
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
      className={className}
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
            (disabled || readOnly) && "cursor-not-allowed",
            view.select,
            selectClassName
          )}
          {...props}
        >
          {children}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
      </div>
    </FieldShell>
  );
});