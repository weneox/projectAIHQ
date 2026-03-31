import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";

const OVERLAY_ROOT_ID = "settings-surface-banner-root";
const EXIT_MS = 220;

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function ensureOverlayRoot() {
  if (typeof document === "undefined") return null;

  let root = document.getElementById(OVERLAY_ROOT_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = OVERLAY_ROOT_ID;
  root.className =
    "pointer-events-none fixed inset-x-0 top-0 z-[160] flex flex-col items-center gap-2.5 px-3 pt-3 sm:px-4 sm:pt-4";
  document.body.appendChild(root);
  return root;
}

function toneClasses(tone = "neutral") {
  if (tone === "success") {
    return "border-emerald-200/80 bg-white/88 text-emerald-950 shadow-[0_18px_45px_rgba(16,185,129,0.12)]";
  }

  if (tone === "warn") {
    return "border-amber-200/80 bg-white/88 text-amber-950 shadow-[0_18px_45px_rgba(245,158,11,0.12)]";
  }

  if (tone === "danger") {
    return "border-rose-200/80 bg-white/88 text-rose-950 shadow-[0_18px_45px_rgba(244,63,94,0.12)]";
  }

  return "border-slate-200/80 bg-white/88 text-slate-800 shadow-[0_18px_45px_rgba(15,23,42,0.11)]";
}

function toneDotClasses(tone = "neutral") {
  if (tone === "success") return "bg-emerald-500";
  if (tone === "warn") return "bg-amber-500";
  if (tone === "danger") return "bg-rose-500";
  return "bg-slate-400";
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
    ["This settings surface unavailable", "Surface unavailable"],
  ]);

  if (exactMap.has(normalized)) {
    return exactMap.get(normalized);
  }

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

function compactDisplayMessage(message, tone) {
  const value = s(message);
  if (!value) return "";

  const exactMap = new Map([
    ["Saved cleanly.", "Saved"],
    ["Thread assigned.", "Assigned"],
    ["Retry accepted. Waiting for outbound attempt status to move.", "Retry queued"],
    ["Reply accepted. Waiting for outbound attempt status to confirm delivery.", "Reply queued"],
    ["Join accepted.", "Join requested"],
  ]);

  if (exactMap.has(value)) {
    return exactMap.get(value);
  }

  if (/temporarily unavailable/i.test(value)) {
    return compactUnavailableMessage(value);
  }

  if (tone === "success" || tone === "neutral") {
    return value.split(".")[0].trim() || value;
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

  const displayMessage = compactDisplayMessage(nextItem.message, nextItem.tone);
  const signature = `${nextItem.key}:${displayMessage}:${nextItem.message}`;

  if (items.some((item) => item.signature === signature)) return;

  items.push({
    ...nextItem,
    displayMessage,
    fullMessage: s(nextItem.message),
    signature,
  });
}

function NotificationCard({ item, onRemove }) {
  const [visible, setVisible] = useState(false);
  const closedRef = useRef(false);

  useEffect(() => {
    const enterId = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => window.cancelAnimationFrame(enterId);
  }, []);

  useEffect(() => {
    if (!item.autoDismissMs) return undefined;

    const timeoutId = window.setTimeout(() => {
      handleClose();
    }, item.autoDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [item.autoDismissMs]);

  function handleClose() {
    if (closedRef.current) return;
    closedRef.current = true;
    setVisible(false);
    window.setTimeout(() => {
      onRemove?.();
    }, EXIT_MS);
  }

  const hasAction = Boolean(item.action?.onClick);

  return (
    <div
      role={item.tone === "danger" || item.tone === "warn" ? "alert" : "status"}
      aria-live={item.tone === "danger" || item.tone === "warn" ? "assertive" : "polite"}
      className={[
        "pointer-events-auto relative w-full max-w-[min(560px,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border backdrop-blur-xl transition duration-200 ease-out",
        toneClasses(item.tone),
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span
          aria-hidden="true"
          className={[
            "h-2.5 w-2.5 shrink-0 rounded-full",
            toneDotClasses(item.tone),
          ].join(" ")}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-5">
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
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/82 px-3 text-[12px] font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{item.action.label || "Refresh"}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleClose}
            aria-label={`Dismiss ${item.displayMessage}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsSurfaceBanner({
  surface,
  errorMessage = "",
  unavailableMessage = "",
  saveErrorMessage = "",
  saveSuccessMessage = "",
  refreshLabel = "Refresh",
}) {
  const overlayRoot = ensureOverlayRoot();
  const [dismissedSignatures, setDismissedSignatures] = useState([]);

  const items = useMemo(() => {
    const next = [];
    const refreshAction = buildAction(surface, refreshLabel);
    const unavailable =
      !!surface?.unavailable || s(surface?.availability).toLowerCase() === "unavailable";

    pushItem(next, {
      key: "save-success",
      tone: "success",
      message: saveSuccessMessage || surface?.saveSuccess,
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
        message: saveErrorMessage || surface?.saveError,
        action: null,
        autoDismissMs: null,
      });

      pushItem(next, {
        key: "error",
        tone: "danger",
        message: errorMessage || surface?.errorMessage || surface?.error,
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

  useEffect(() => {
    setDismissedSignatures([]);
  }, [itemSignature]);

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
            setDismissedSignatures((current) =>
              current.includes(item.signature)
                ? current
                : [...current, item.signature]
            )
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
