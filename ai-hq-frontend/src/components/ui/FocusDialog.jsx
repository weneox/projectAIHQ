import { useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (node) =>
      !node.hasAttribute("disabled") &&
      node.getAttribute("aria-hidden") !== "true"
  );
}

export default function FocusDialog({
  open = false,
  onClose,
  children,
  title,
  panelClassName = "",
  backdropClassName = "",
  initialFocusRef = null,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    initialFocusRefRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const preferred = initialFocusRefRef.current?.current;
      if (preferred && typeof preferred.focus === "function") {
        preferred.focus();
        return;
      }

      const focusables = getFocusable(panel);
      if (focusables[0] && typeof focusables[0].focus === "function") {
        focusables[0].focus();
        return;
      }

      panel.focus();
    };

    const frame = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      if (!focusables.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);

      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === "function" && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-focus-dialog-root="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 pointer-events-none"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-auto ${backdropClassName} z-0`}
        onClick={() => onCloseRef.current?.()}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative pointer-events-auto ${panelClassName} z-10`}
      >
        {title ? <h2 id={titleId} className="sr-only">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
