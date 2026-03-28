import { useMemo, useState } from "react";

import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Unknown time";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function toneForOutcome(outcome = "") {
  switch (s(outcome).toLowerCase()) {
    case "allowed":
      return "success";
    case "allowed_with_logging":
      return "info";
    case "allowed_with_human_review":
    case "handoff_required":
    case "operator_only":
      return "warn";
    case "blocked":
    case "blocked_until_repair":
      return "danger";
    default:
      return "neutral";
  }
}

function joinLine(values = [], empty = "Unavailable") {
  const items = arr(values).map((item) => s(item)).filter(Boolean);
  return items.length ? items.join(" · ") : empty;
}

function deriveDetailRows(event = {}) {
  const health = obj(event.healthState);
  const approval = obj(event.approvalPosture);
  const execution = obj(event.executionPosture);
  const control = obj(event.controlState);
  return [
    {
      label: "Health",
      value: joinLine(
        [
          s(health.status),
          s(health.primaryReasonCode || health.reasonCode),
        ],
        "Unknown health"
      ),
    },
    {
      label: "Approval",
      value: joinLine(
        [
          s(
            approval.strictestOutcome ||
              approval.outcome ||
              approval.truthPublicationPosture
          ),
          ...arr(approval.reasonCodes),
        ],
        "Unknown approval posture"
      ),
    },
    {
      label: "Execution",
      value: joinLine(
        [
          s(execution.outcome || execution.executionPosture || event.policyOutcome),
          s(execution.controlMode),
        ],
        "Unknown execution posture"
      ),
    },
    {
      label: "Control",
      value: joinLine(
        [
          s(control.controlMode),
          s(control.changedBy),
          s(control.changedAt),
        ],
        "No control state"
      ),
    },
  ];
}

export default function GovernanceHistoryPanel({ decisionAudit = {} }) {
  const filters = arr(decisionAudit.availableFilters);
  const [activeFilter, setActiveFilter] = useState("all");
  const items = arr(decisionAudit.items);

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => s(item.group).toLowerCase() === activeFilter);
  }, [activeFilter, items]);

  return (
    <Card variant="surface" className="rounded-[28px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Governance History
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              Decision timeline and incident replay context
            </div>
          </div>
          <Badge tone="info" variant="subtle" dot>
            {visibleItems.length} visible
          </Badge>
        </div>

        <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          Operators can inspect what happened, why it happened, and which truth, runtime, and control states were involved without leaving the existing governance cockpit.
        </div>

        <div className="flex flex-wrap gap-2">
          {(filters.length
            ? filters
            : [{ key: "all", label: "All events", count: items.length }]
          ).map((filter) => {
            const selected = s(filter.key || "all").toLowerCase() === activeFilter;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(s(filter.key || "all").toLowerCase())}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  selected
                    ? "border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200",
                ].join(" ")}
              >
                {s(filter.label || "All events")} ({Number(filter.count || 0)})
              </button>
            );
          })}
        </div>

        {!visibleItems.length ? (
          <div className="rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            Governance history is unavailable for this slice. The control plane shows an explicit empty timeline instead of inventing incident history.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((event) => (
              <div
                key={s(event.id || `${event.eventType}-${event.timestamp}`)}
                className="rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneForOutcome(event.policyOutcome)} variant="subtle" dot>
                        {titleize(event.policyOutcome || "unknown")}
                      </Badge>
                      <Badge tone="neutral" variant="subtle">
                        {s(event.groupLabel || titleize(event.group || "execution"))}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      {titleize(event.eventType || "unknown_event")}
                    </div>
                    <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {formatWhen(event.timestamp)} · {s(event.actor || event.source || "system")}
                    </div>
                  </div>

                  <div className="text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                    <div>Surface: {titleize(event.surface || "unknown")}</div>
                    <div>Channel: {titleize(event.channelType || "unknown")}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {deriveDetailRows(event).map((row) => (
                    <div key={`${event.id}-${row.label}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {row.label}
                      </div>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Reason codes: {joinLine(event.reasonCodes, "Unavailable")}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Affected surfaces: {joinLine(event.affectedSurfaces, "Unavailable")}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Truth version: {s(event.truthVersionId || "Unknown")}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Runtime projection: {s(event.runtimeProjectionId || "Unknown")}
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                  Next action: {s(obj(event.recommendedNextAction).label || "Unavailable")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
