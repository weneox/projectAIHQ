import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
} from "lucide-react";

import { cx } from "../../lib/cx.js";

const OVERLAY_ROOT_ID = "surface-banner-root";
const EXIT_MS = 220;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function ensureOverlayRoot() {
  if (typeof document === "undefined") return null;

  let root = document.getElementById(OVERLAY_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ROOT_ID;
    document.body.appendChild(root);
  }

  root.className =
    "pointer-events-none fixed inset-x-0 top-0 z-[160] flex flex-col items-center gap-2 px-3 pt-0 sm:px-4";

  return root;
}

function toneMaterial(tone = "neutral") {
  if (tone === "success") {
    return {
      shell:
        "border-[rgba(var(--color-success),0.24)] bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(247,253,249)_100%)] text-text shadow-[0_18px_42px_-32px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]",
      iconWrap:
        "border-[rgba(var(--color-success),0.2)] bg-success-soft text-success",
      accent: "bg-success",
      close:
        "text-text-subtle hover:bg-surface-subtle hover:text-text",
      button:
        "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success hover:bg-[rgba(var(--color-success),0.12)] disabled:opacity-50",
      role: "status",
      live: "polite",
    };
  }

  if (tone === "warn") {
    return {
      shell:
        "border-[rgba(var(--color-warning),0.28)] bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(255,251,245)_100%)] text-text shadow-[0_18px_42px_-32px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]",
      iconWrap:
        "border-[rgba(var(--color-warning),0.2)] bg-warning-soft text-warning",
      accent: "bg-warning",
      close:
        "text-text-subtle hover:bg-surface-subtle hover:text-text",
      button:
        "border-[rgba(var(--color-warning),0.2)] bg-warning-soft text-warning hover:bg-[rgba(var(--color-warning),0.12)] disabled:opacity-50",
      role: "alert",
      live: "assertive",
    };
  }

  if (tone === "danger") {
    return {
      shell:
        "border-[rgba(var(--color-danger),0.24)] bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(253,246,249)_100%)] text-text shadow-[0_18px_42px_-32px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]",
      iconWrap:
        "border-[rgba(var(--color-danger),0.2)] bg-danger-soft text-danger",
      accent: "bg-danger",
      close:
        "text-text-subtle hover:bg-surface-subtle hover:text-text",
      button:
        "border-[rgba(var(--color-danger),0.18)] bg-danger-soft text-danger hover:bg-[rgba(var(--color-danger),0.12)] disabled:opacity-50",
      role: "alert",
      live: "assertive",
    };
  }

  return {
    shell:
      "border-line-soft bg-[linear-gradient(180deg,rgb(255,255,255)_0%,rgb(248,250,252)_100%)] text-text shadow-[0_18px_42px_-32px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]",
    iconWrap:
      "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand",
    accent: "bg-brand",
    close:
      "text-text-subtle hover:bg-surface-subtle hover:text-text",
    button:
      "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand hover:bg-[rgba(var(--color-brand),0.12)] disabled:opacity-50",
    role: "status",
    live: "polite",
  };
}

function compactUnavailableMessage(message) {
  const normalized = s(message)
    .replace(/\bis temporarily unavailable\b/gi, "unavailable")
    .replace(/\bare temporarily unavailable\b/gi, "unavailable")
    .replace(/\btemporarily unavailable\b/gi, "unavailable")
    .replace(/\.$/, "");

  const exactMap = new Map([
    ["Inbox operations unavailable", "Inbox unavailable"],
    ["Conversation detail unavailable", "Conversation unavailable"],
    ["Related context unavailable", "Context unavailable"],
    ["Operator reply controls unavailable", "Reply unavailable"],
    ["Retry queue unavailable", "Retry queue unavailable"],
    ["Thread delivery attempts unavailable", "Attempts unavailable"],
    ["Meta channel status unavailable", "Channel status unavailable"],
    ["Admin team management unavailable", "Team unavailable"],
    ["Team management unavailable", "Team unavailable"],
    ["Tenant administration unavailable", "Tenants unavailable"],
    ["Secret management unavailable", "Secrets unavailable"],
    ["Comments moderation unavailable", "Comments unavailable"],
    ["Durable execution controls unavailable", "Executions unavailable"],
    ["Voice operations unavailable", "Voice unavailable"],
    ["Agent settings unavailable", "Agents unavailable"],
    ["Workspace settings unavailable", "Workspace unavailable"],
    ["Business facts unavailable", "Business facts unavailable"],
    ["Control-plane change history unavailable", "Change history unavailable"],
    ["Channel policies unavailable", "Policies unavailable"],
    ["Contacts unavailable", "Contacts unavailable"],
    ["Locations unavailable", "Locations unavailable"],
    ["AI policy settings unavailable", "AI policy unavailable"],
    ["Truth review telemetry unavailable", "Truth review unavailable"],
    ["Source intelligence unavailable", "Source intelligence unavailable"],
    ["Operational readiness unavailable", "Readiness unavailable"],
    ["This surface unavailable", "Surface unavailable"],
  ]);

  if (exactMap.has(normalized)) return exactMap.get(normalized);

  return normalized
    .replace(/\boperations\b/gi, "")
    .replace(/\bmanagement\b/gi, "")
    .replace(/\badministration\b/gi, "")
    .replace(/\bcontrols\b/gi, "")
    .replace(/\bdetail\b/gi, "")
    .replace(/\btelemetry\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compactDisplayMessage(message) {
  const value = s(message);
  if (!value) return "";

  const exactMap = new Map([
    ["Saved cleanly.", "Saved"],
    ["Thread marked as read.", "Thread marked as read"],
    ["Thread assigned.", "Thread assigned"],
    ["Handoff activated.", "Handoff activated"],
    ["Handoff released.", "Handoff released"],
    ["Thread resolved.", "Thread resolved"],
    ["Thread closed.", "Thread closed"],
    [
      "Retry accepted. Waiting for outbound attempt status to move.",
      "Retry queued",
    ],
    [
      "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
      "Reply queued",
    ],
    ["Join accepted.", "Join requested"],
  ]);

  if (exactMap.has(value)) return exactMap.get(value);

  if (/temporarily unavailable/i.test(value)) {
    return compactUnavailableMessage(value);
  }

  return value.split(".")[0].trim() || value;
}

function buildAction(surface, refreshLabel) {
  if (!surface?.refresh) return null;

  return {
    onClick: surface.refresh,
    label: refreshLabel || "Refresh",
    disabled: surface.loading || surface.saving,
  };
}

function pushItem(items, nextItem) {
  if (!s(nextItem?.message)) return;

  const displayMessage = compactDisplayMessage(nextItem.message);
  const signature = `${nextItem.key}:${displayMessage}:${nextItem.message}`;

  if (items.some((item) => item.signature === signature)) return;

  items.push({
    ...nextItem,
    displayMessage,
    fullMessage: s(nextItem.message),
    signature,
  });
}

function NotificationIcon({ tone }) {
  const material = toneMaterial(tone);
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "danger" || tone === "warn"
        ? AlertTriangle
        : Info;

  return (
    <span
      className={cx(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border shadow-[var(--shadow-inset-top)]",
        material.iconWrap
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.15} />
    </span>
  );
}

function NotificationCard({ item, onRemove }) {
  const [visible, setVisible] = useState(false);
  const closedRef = useRef(false);
  const material = toneMaterial(item.tone);

  const handleClose = useCallback(() => {
    if (closedRef.current) return;

    closedRef.current = true;
    setVisible(false);

    window.setTimeout(() => onRemove?.(), EXIT_MS);
  }, [onRemove]);

  useEffect(() => {
    const enterId = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(enterId);
  }, []);

  useEffect(() => {
    if (!item.autoDismissMs) return undefined;

    const timeoutId = window.setTimeout(handleClose, item.autoDismissMs);
    return () => window.clearTimeout(timeoutId);
  }, [handleClose, item.autoDismissMs]);

  const hasAction = Boolean(item.action?.onClick);

  return (
    <div
      role={material.role}
      aria-live={material.live}
      className={cx(
        "pointer-events-auto relative w-full max-w-[520px] overflow-hidden border",
        "rounded-b-[14px] rounded-t-none",
        "transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        material.shell,
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <div
        aria-hidden="true"
        className={cx("pointer-events-none absolute left-0 top-0 h-full w-[3px]", material.accent)}
      />

      <div className="relative flex min-h-[56px] items-center gap-3 px-4 py-3 sm:px-4.5">
        <NotificationIcon tone={item.tone} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-5 tracking-[var(--tracking-tight-sm)] text-text">
            {item.displayMessage}
          </div>

          {item.displayMessage !== item.fullMessage ? (
            <span className="sr-only">{item.fullMessage}</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {hasAction ? (
            <button
              type="button"
              onClick={item.action.onClick}
              disabled={item.action.disabled}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-[9px] border px-3",
                "text-[12px] font-semibold transition-[background-color,color,border-color,opacity] duration-base ease-premium",
                "disabled:cursor-not-allowed",
                material.button
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.1} />
              <span>{item.action.label || "Refresh"}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleClose}
            aria-label={`Dismiss ${item.displayMessage}`}
            className={cx(
              "inline-flex h-8 w-8 items-center justify-center rounded-[9px]",
              "transition-[background-color,color] duration-base ease-premium",
              material.close
            )}
          >
            <X className="h-4 w-4" strokeWidth={2.15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SurfaceBanner({
  surface,
  errorMessage = "",
  unavailableMessage = "",
  saveErrorMessage = "",
  saveSuccessMessage = "",
  refreshLabel = "Refresh",
}) {
  const overlayRoot = ensureOverlayRoot();

  const [dismissState, setDismissState] = useState({
    itemSignature: "",
    dismissedSignatures: [],
  });

  const items = useMemo(() => {
    const next = [];
    const refreshAction = buildAction(surface, refreshLabel);
    const unavailable =
      !!surface?.unavailable ||
      s(surface?.availability).toLowerCase() === "unavailable";
    const sharedFeedback = surface?.feedback || null;

    pushItem(next, {
      key: "save-success",
      tone: "success",
      message:
        saveSuccessMessage ||
        surface?.saveSuccess ||
        (sharedFeedback?.kind === "save-success" ? sharedFeedback.message : ""),
      action: null,
      autoDismissMs: 2600,
    });

    pushItem(next, {
      key: "success",
      tone: "success",
      message: surface?.successMessage,
      action: null,
      autoDismissMs: 2600,
    });

    pushItem(next, {
      key: "message",
      tone: "neutral",
      message: surface?.message,
      action: null,
      autoDismissMs: 2200,
    });

    if (unavailable) {
      pushItem(next, {
        key: "unavailable",
        tone: "warn",
        message:
          unavailableMessage ||
          (sharedFeedback?.kind === "unavailable" ? sharedFeedback.message : "") ||
          surface?.error ||
          surface?.errorMessage ||
          "Surface unavailable",
        action: refreshAction,
        autoDismissMs: null,
      });
    } else {
      pushItem(next, {
        key: "save-error",
        tone: "danger",
        message:
          saveErrorMessage ||
          surface?.saveError ||
          (sharedFeedback?.kind === "save-error" ? sharedFeedback.message : ""),
        action: null,
        autoDismissMs: null,
      });

      pushItem(next, {
        key: "error",
        tone: "danger",
        message:
          errorMessage ||
          (sharedFeedback?.kind === "error" ? sharedFeedback.message : "") ||
          surface?.errorMessage ||
          surface?.error,
        action: refreshAction,
        autoDismissMs: null,
      });
    }

    return next;
  }, [
    errorMessage,
    refreshLabel,
    saveErrorMessage,
    saveSuccessMessage,
    surface,
    unavailableMessage,
  ]);

  const itemSignature = items.map((item) => item.signature).join("|");

  const dismissedSignatures =
    dismissState.itemSignature === itemSignature
      ? dismissState.dismissedSignatures
      : [];

  const visibleItems = items.filter(
    (item) => !dismissedSignatures.includes(item.signature)
  );

  if (!visibleItems.length) return null;

  const content = (
    <>
      {visibleItems.map((item) => (
        <NotificationCard
          key={item.signature}
          item={item}
          onRemove={() =>
            setDismissState((current) => {
              const currentDismissed =
                current.itemSignature === itemSignature
                  ? current.dismissedSignatures
                  : [];

              if (currentDismissed.includes(item.signature)) {
                return {
                  itemSignature,
                  dismissedSignatures: currentDismissed,
                };
              }

              return {
                itemSignature,
                dismissedSignatures: [...currentDismissed, item.signature],
              };
            })
          }
        />
      ))}
    </>
  );

  if (!overlayRoot) {
    return <div className="space-y-2.5">{content}</div>;
  }

  return createPortal(content, overlayRoot);
}