import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import checkmarkIcon from "../../assets/channels/checkmark.png";

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
        "border-[#1E7347] bg-[#23904F] text-white shadow-[0_16px_34px_-24px_rgba(11,55,31,0.44)]",
      top: "bg-[#47BE79]",
      bottom: "bg-[#19663F]",
      side: "bg-white/10",
      sideDark: "bg-black/8",
      glow:
        "bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_56%)]",
      closeHover: "hover:bg-white/10",
      button:
        "border-white/18 bg-white/10 text-white hover:bg-white/14 disabled:opacity-50",
    };
  }

  if (tone === "warn") {
    return {
      shell:
        "border-[#A66512] bg-[#C57A19] text-white shadow-[0_16px_34px_-24px_rgba(82,48,8,0.42)]",
      top: "bg-[#EDAB4D]",
      bottom: "bg-[#8F570E]",
      side: "bg-white/10",
      sideDark: "bg-black/8",
      glow:
        "bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_56%)]",
      closeHover: "hover:bg-white/10",
      button:
        "border-white/18 bg-white/10 text-white hover:bg-white/14 disabled:opacity-50",
    };
  }

  if (tone === "danger") {
    return {
      shell:
        "border-[#962342] bg-[#B72B4E] text-white shadow-[0_16px_34px_-24px_rgba(78,14,31,0.42)]",
      top: "bg-[#D95B79]",
      bottom: "bg-[#7A1631]",
      side: "bg-white/10",
      sideDark: "bg-black/8",
      glow:
        "bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_56%)]",
      closeHover: "hover:bg-white/10",
      button:
        "border-white/18 bg-white/10 text-white hover:bg-white/14 disabled:opacity-50",
    };
  }

  return {
    shell:
      "border-[#243244] bg-[#111B2D] text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.42)]",
    top: "bg-[#41536E]",
    bottom: "bg-[#0C1422]",
    side: "bg-white/10",
    sideDark: "bg-black/8",
    glow:
      "bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.10),rgba(255,255,255,0)_56%)]",
    closeHover: "hover:bg-white/10",
    button:
      "border-white/18 bg-white/10 text-white hover:bg-white/14 disabled:opacity-50",
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

function NotificationLeading({ tone }) {
  if (tone === "success") {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-white/12" />
        <img
          src={checkmarkIcon}
          alt=""
          aria-hidden="true"
          className="relative h-5 w-5 object-contain"
        />
      </span>
    );
  }

  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-white/10" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-white/90" />
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
      role={item.tone === "danger" || item.tone === "warn" ? "alert" : "status"}
      aria-live={
        item.tone === "danger" || item.tone === "warn" ? "assertive" : "polite"
      }
      className={[
        "pointer-events-auto relative w-full max-w-[500px] overflow-hidden border transition-all duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "rounded-b-[9px] rounded-t-none",
        material.shell,
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
      ].join(" ")}
    >
      <div className={["pointer-events-none absolute inset-0", material.glow].join(" ")} />
      <div className={["pointer-events-none absolute inset-x-0 top-0 h-px", material.top].join(" ")} />
      <div className={["pointer-events-none absolute inset-x-0 bottom-0 h-px", material.bottom].join(" ")} />
      <div className={["pointer-events-none absolute inset-y-0 left-0 w-px", material.side].join(" ")} />
      <div className={["pointer-events-none absolute inset-y-0 right-0 w-px", material.sideDark].join(" ")} />

      <div className="relative flex min-h-[52px] items-center gap-3 px-4 py-3 sm:px-4.5">
        <NotificationLeading tone={item.tone} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-5 tracking-[-0.01em]">
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
              className={[
                "inline-flex h-8 items-center gap-1.5 rounded-[7px] border px-3 text-[12px] font-semibold transition duration-150 disabled:cursor-not-allowed",
                material.button,
              ].join(" ")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{item.action.label || "Refresh"}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleClose}
            aria-label={`Dismiss ${item.displayMessage}`}
            className={[
              "inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-white/82 transition duration-150 hover:text-white",
              material.closeHover,
            ].join(" ")}
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