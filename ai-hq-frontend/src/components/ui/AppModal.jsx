import { X } from "lucide-react";

import Card from "./Card.jsx";
import { cx } from "../../lib/cx.js";

export default function AppModal({
  open,
  onClose,
  children,
  maxWidth = "max-w-[720px]",
  className = "",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-4 py-8 backdrop-blur-[7px]">
      <div role="presentation" className="absolute inset-0" onClick={onClose} />

      <Card
        padded={false}
        clip
        className={cx(
          "relative z-[81] max-h-[calc(100vh-64px)] w-full overflow-hidden shadow-[0_28px_90px_-45px_rgba(15,23,42,0.75)]",
          maxWidth,
          className
        )}
      >
        {children}
      </Card>
    </div>
  );
}

export function AppModalHeader({ children, className = "" }) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-5 border-b border-line-soft p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AppModalBody({ children, className = "" }) {
  return <div className={cx("grid gap-4 p-6", className)}>{children}</div>;
}

export function AppModalFooter({ children, className = "" }) {
  return (
    <div
      className={cx(
        "flex flex-col-reverse gap-2 border-t border-line-soft bg-surface-subtle p-5 sm:flex-row sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AppModalCloseButton({ onClick, label = "Close modal" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-text-muted transition-colors duration-base ease-premium hover:border-line hover:text-text"
      aria-label={label}
    >
      <X className="h-4 w-4" strokeWidth={2.1} />
    </button>
  );
}
