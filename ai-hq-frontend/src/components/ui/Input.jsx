import { forwardRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cx } from "../../lib/cx.js";

function resolveAppearance(appearance = "default") {
  switch (appearance) {
    case "product":
      return {
        shell: "rounded-soft",
        row: "min-h-[44px] gap-3 px-3.5",
        input: "h-[44px] text-[14px]",
        textareaWrap: "px-3.5 py-3.5",
        textarea: "min-h-[132px] text-[14px] leading-6",
        selectWrap: "px-3.5",
        select: "h-[44px] pr-8 text-[14px]",
      };
    case "quiet":
      return {
        shell: "rounded-soft",
        row: "min-h-[38px] gap-2.5 px-3",
        input: "h-[38px] text-[13px]",
        textareaWrap: "px-3 py-3",
        textarea: "min-h-[112px] text-[13px] leading-6",
        selectWrap: "px-3",
        select: "h-[38px] pr-8 text-[13px]",
      };
    default:
      return {
        shell: "rounded-soft",
        row: "min-h-[40px] gap-2.5 px-3.5",
        input: "h-[40px] text-[14px]",
        textareaWrap: "px-3.5 py-3.5",
        textarea: "min-h-[120px] text-[14px] leading-6",
        selectWrap: "px-3.5",
        select: "h-[40px] pr-8 text-[14px]",
      };
  }
}

function surfaceClass({ disabled, readOnly, invalid }) {
  if (disabled) {
    return "border-line-soft bg-surface-subtle text-text-subtle opacity-70";
  }
  if (invalid) {
    return "border-danger bg-surface";
  }
  if (readOnly) {
    return "border-line bg-surface-muted";
  }
  return [
    "border-line bg-surface",
    "hover:border-line-strong",
    "focus-within:border-brand",
    "focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]",
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
        "relative w-full overflow-hidden border transition-[border-color,background-color,box-shadow] duration-150",
        view.shell,
        surfaceClass({ disabled, readOnly, invalid }),
        className
      )}
    >
      {children}
    </div>
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

  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className={cx("flex items-center", view.row)}>
        {leftIcon ? (
          <span className="shrink-0 text-text-subtle">{leftIcon}</span>
        ) : null}

        <input
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className={cx(
            "w-full border-0 bg-transparent p-0 text-text outline-none placeholder:text-text-subtle",
            disabled && "cursor-not-allowed",
            view.input,
            inputClassName
          )}
          {...props}
        />

        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-soft text-text-subtle hover:bg-surface-subtle hover:text-text"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
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

  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className={cx("flex items-center", view.row)}>
        {leftIcon ? (
          <span className="shrink-0 text-text-subtle">{leftIcon}</span>
        ) : null}

        <input
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          className={cx(
            "w-full border-0 bg-transparent p-0 text-text outline-none placeholder:text-text-subtle",
            disabled && "cursor-not-allowed",
            view.input,
            inputClassName
          )}
          {...props}
        />

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
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
            "w-full resize-y border-0 bg-transparent p-0 text-text outline-none placeholder:text-text-subtle",
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
            "w-full appearance-none border-0 bg-transparent p-0 text-text outline-none",
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
