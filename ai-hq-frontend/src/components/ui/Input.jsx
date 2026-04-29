import { forwardRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cx } from "../../lib/cx.js";

function appearanceClass(appearance = "default") {
  if (appearance === "product") return "ui-field--product";
  if (appearance === "quiet") return "ui-field--quiet";
  if (appearance === "large") return "ui-field--large";
  return "ui-field--default";
}

function FieldShell({
  children,
  className,
  disabled = false,
  readOnly = false,
  invalid = false,
  appearance = "default",
  hasLeft = false,
  hasRight = false,
  hasWideRight = false,
}) {
  return (
    <div
      className={cx("ui-field-shell", appearanceClass(appearance), className)}
      data-disabled={disabled ? "true" : "false"}
      data-readonly={readOnly ? "true" : "false"}
      data-invalid={invalid ? "true" : "false"}
      data-has-left={hasLeft ? "true" : "false"}
      data-has-right={hasRight ? "true" : "false"}
      data-has-wide-right={hasWideRight ? "true" : "false"}
    >
      <div aria-hidden="true" className="ui-field-border" />
      <div className="ui-field-inner">{children}</div>
    </div>
  );
}

function ControlIconSlot({ children }) {
  if (!children) return null;
  return <span className="ui-field-icon">{children}</span>;
}

function RightSlot({ children }) {
  if (!children) return null;
  return <div className="ui-field-right">{children}</div>;
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
      hasLeft={Boolean(leftIcon)}
      hasRight={hasRightSlot}
      hasWideRight={hasWideRight}
    >
      <ControlIconSlot>{leftIcon}</ControlIconSlot>

      <input
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        className={cx("ui-field-control ui-input-control", inputClassName)}
        {...props}
      />

      {hasRightSlot ? (
        <RightSlot>
          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              className="ui-field-clear"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.1} />
            </button>
          ) : null}

          {right ? <div className="shrink-0">{right}</div> : null}
        </RightSlot>
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
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
      hasLeft={Boolean(leftIcon)}
      hasRight={Boolean(right)}
      hasWideRight={false}
    >
      <ControlIconSlot>{leftIcon}</ControlIconSlot>

      <input
        ref={ref}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        className={cx("ui-field-control ui-input-control", inputClassName)}
        {...props}
      />

      {right ? <RightSlot>{right}</RightSlot> : null}
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
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className="ui-textarea-wrap">
        <textarea
          ref={ref}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          spellCheck={false}
          className={cx(
            "ui-field-control ui-textarea-control",
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
  return (
    <FieldShell
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      invalid={invalid}
      appearance={appearance}
    >
      <div className="ui-select-wrap">
        <select
          ref={ref}
          disabled={disabled || readOnly}
          aria-invalid={invalid || undefined}
          className={cx("ui-field-control ui-select-control", selectClassName)}
          {...props}
        >
          {children}
        </select>

        <ChevronDown className="ui-select-chevron" strokeWidth={2.1} />
      </div>
    </FieldShell>
  );
});