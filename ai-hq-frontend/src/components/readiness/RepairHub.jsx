import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import { InlineNotice, Surface } from "../ui/AppShellPrimitives.jsx";
import { createReadinessViewModel } from "../../lib/readinessViewModel.js";

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
      <InlineNotice
        tone="success"
        title={title}
        description={emptyMessage}
        compact
      />
    );
  }

  return (
    <Surface className="space-y-4" subdued>
      <InlineNotice
        tone={intentionallyUnavailable ? "warning" : "danger"}
        title={title}
        description={
          unavailableMessage ||
          s(model.message) ||
          "Operator action is required before this surface can return to ready state."
        }
        compact
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toneForStatus(status, blocked)} variant="subtle" dot>
          {intentionallyUnavailable ? "Unavailable" : "Blocked"}
        </Badge>
        {s(model.reasonCode) ? (
          <Badge tone="warn" variant="subtle">
            {toTitle(model.reasonCode)}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const disabled = loading || !canManage || item.action.allowed === false;
          return (
            <div
              key={`${item.reasonCode || item.title}-${item.suggestedRepairActionId || item.action.id}`}
              className="rounded-lg border border-line-soft bg-surface px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-text">{item.title}</div>
                {item.reasonCode ? (
                  <Badge tone="warn" variant="subtle">
                    {toTitle(item.reasonCode)}
                  </Badge>
                ) : null}
              </div>
              {item.subtitle ? (
                <div className="mt-1 leading-6 text-text-muted">
                  {item.subtitle}
                </div>
              ) : null}
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-text-subtle">
                {[item.category, item.dependencyType].filter(Boolean).join(" / ")}
              </div>
              {item.missing.length ? (
                <div className="mt-3 text-sm text-text-muted">
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
                  <div className="text-xs text-text-subtle">
                    Requires {item.action.requiredRole || "operator"} access
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
