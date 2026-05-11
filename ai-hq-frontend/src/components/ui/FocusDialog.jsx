import { X } from "lucide-react";

import { cx } from "../../lib/cx.js";
import Button from "./Button.jsx";

export default function FocusDialog({
  open = false,
  onClose,
  title = "Dialog",
  children,
  backdropClassName = "bg-overlay/60",
  panelClassName = "w-full max-w-[720px]",
  className = "",
  closeLabel = "Close dialog",
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cx(
        "fixed inset-0 z-[190] flex items-start justify-center overflow-y-auto px-4 py-6 sm:px-6",
        className
      )}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => onClose?.()}
        className={cx("fixed inset-0", backdropClassName)}
      />

      <div
        className={cx(
          "relative z-[1] my-auto overflow-hidden rounded-[18px] border border-line-soft bg-white shadow-[0_28px_90px_-32px_rgba(15,23,42,0.55)]",
          panelClassName
        )}
      >
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line-soft bg-white px-5 py-3">
          <div className="min-w-0 truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={closeLabel}
            onClick={() => onClose?.()}
          >
            <X className="h-4 w-4" strokeWidth={2.15} />
          </Button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}