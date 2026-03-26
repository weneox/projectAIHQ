import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { createReadinessViewModel } from "./readinessViewModel.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function toTitle(value = "") {
  const text = s(value);
  return text ? text.replace(/[_-]+/g, " ") : "ready";
}

function toneForStatus(status = "", blocked = false) {
  const normalized = s(status).toLowerCase();
  if (normalized === "ready" || blocked === false) return "success";
  if (normalized === "blocked" || blocked) return "warn";
  return "neutral";
}

export default function RepairHub({
  readiness,
  blockers = [],
  canManage = true,
  loading = false,
  title = "Repair Hub",
  emptyMessage = "This surface is ready for production traffic.",
  unavailableMessage = "",
  onRunAction,
}) {
  const model = createReadinessViewModel(readiness, blockers);
  const items = model.blockedItems;
  const status = model.status;
  const intentionallyUnavailable = model.intentionallyUnavailable;
  const blocked = model.blocked;

  if (!blocked) {
    return (
      <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/90 p-4 text-sm text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-base font-semibold">{title}</div>
        <Badge tone={toneForStatus(status, blocked)} variant="subtle" dot>
          {intentionallyUnavailable ? "Unavailable" : "Blocked"}
        </Badge>
        {s(model.reasonCode) ? (
          <Badge tone="warn" variant="subtle">
            {toTitle(model.reasonCode)}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 leading-6 text-rose-800 dark:text-rose-100/90">
        {unavailableMessage || s(model.message) || "Operator action is required before this surface can return to ready state."}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const disabled = loading || !canManage || item.action.allowed === false;
          return (
            <div
              key={`${item.reasonCode || item.title}-${item.suggestedRepairActionId || item.action.id}`}
              className="rounded-[18px] border border-rose-200/80 bg-white/70 px-4 py-4 dark:border-rose-300/20 dark:bg-white/[0.04]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-rose-950 dark:text-rose-50">{item.title}</div>
                {item.reasonCode ? (
                  <Badge tone="warn" variant="subtle">
                    {toTitle(item.reasonCode)}
                  </Badge>
                ) : null}
              </div>
              {item.subtitle ? (
                <div className="mt-1 leading-6 text-rose-800 dark:text-rose-100/90">
                  {item.subtitle}
                </div>
              ) : null}
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-rose-500 dark:text-rose-200/80">
                {[item.category, item.dependencyType].filter(Boolean).join(" · ")}
              </div>
              {item.missing.length ? (
                <div className="mt-3 text-sm">
                  Missing: {item.missing.join(", ")}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => onRunAction?.(item.action, item)}
                  disabled={disabled}
                >
                  {item.action.label || "Review blocker"}
                </Button>
                {item.action.allowed === false ? (
                  <div className="text-xs text-rose-600 dark:text-rose-200/80">
                    Requires {item.action.requiredRole || "operator"} access
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
