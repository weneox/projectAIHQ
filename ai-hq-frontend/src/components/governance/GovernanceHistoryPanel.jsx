import { useEffect, useMemo, useState } from "react";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
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
    case "review_required":
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

function resolveControlSummary(control = {}) {
  const source = obj(control);
  return joinLine(
    [source.controlMode, source.changedBy, source.changedAt].map((item) => titleize(item)),
    "Unknown control state"
  );
}

function derivePostureRows(event = {}) {
  const approval = obj(event.approvalPostureSummary);
  const execution = obj(event.executionPostureSummary);
  const runtime = obj(event.runtimeHealthPosture);
  return [
    {
      label: "Policy Outcome",
      value: s(event.policyOutcomeLabel || titleize(event.policyOutcome || "unknown")),
      hint: joinLine(event.reasonCodes, "No explicit reason code"),
    },
    {
      label: "Approval Posture",
      value: s(approval.primaryLabel || "Unknown approval posture"),
      hint: s(approval.detail || "No approval detail available"),
    },
    {
      label: "Execution Posture",
      value: s(execution.primaryLabel || "Unknown execution posture"),
      hint: s(execution.detail || "No execution detail available"),
    },
    {
      label: "Runtime Health",
      value: s(runtime.primaryLabel || "Unknown runtime health"),
      hint: s(runtime.detail || "No runtime health detail available"),
    },
    {
      label: "Control State",
      value: resolveControlSummary(event.controlState),
      hint: s(event.links?.controlScope ? titleize(event.links.controlScope) : "No explicit control scope"),
    },
  ];
}

function DetailField({ label, value, hint = "" }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function RemediationCard({ title, body, tone = "neutral" }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <Badge tone={tone} variant="subtle" dot>
          {title}
        </Badge>
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</div>
    </div>
  );
}

function EventDetailPanel({ event = {}, onRunAction }) {
  const links = obj(event.links);
  const remediation = obj(event.remediation);
  const snapshot = obj(event.decisionContextSnapshot);
  const nextAction = obj(event.recommendedNextAction);
  const remediationActions = arr(remediation.actions).filter(
    (action) => action && action.allowed !== false && s(action.label)
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneForOutcome(event.policyOutcome)} variant="subtle" dot>
                {s(event.policyOutcomeLabel || titleize(event.policyOutcome || "unknown"))}
              </Badge>
              <Badge tone="neutral" variant="subtle">
                {s(event.groupLabel || titleize(event.group || "execution"))}
              </Badge>
            </div>
            <div className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              {s(event.eventLabel || titleize(event.eventType || "unknown_event"))}
            </div>
            <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              {s(snapshot.summary || "Decision context is partially unavailable. The control plane is showing only safely-shaped metadata.")}
            </div>
          </div>

          <div className="min-w-[220px] rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm dark:border-white/10 dark:bg-black/20">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Exact Timestamp
            </div>
            <div className="mt-1 font-medium text-slate-900 dark:text-white">
              {formatWhen(event.timestamp)}
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Actor {s(event.actor || "system")} via {s(event.source || "unknown source")}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DetailField
          label="Surface"
          value={titleize(links.surface || event.surface || "unknown")}
          hint={`Channel ${titleize(links.channelType || event.channelType || "unknown")}`}
        />
        <DetailField
          label="Truth Version"
          value={s(links.truthVersionId || event.truthVersionId || "Unknown")}
          hint="Approved truth reference involved in this decision."
        />
        <DetailField
          label="Runtime Projection"
          value={s(links.runtimeProjectionId || event.runtimeProjectionId || "Unknown")}
          hint="Strict runtime authority reference for this event."
        />
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Decision Posture
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {derivePostureRows(event).map((row) => (
            <DetailField
              key={`${event.id}-${row.label}`}
              label={row.label}
              value={row.value}
              hint={row.hint}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailField
          label="Affected Surfaces"
          value={joinLine(event.affectedSurfaces, "Unavailable")}
          hint={`Event category ${titleize(links.eventCategory || event.eventCategory || "unknown")}`}
        />
        <DetailField
          label="Context Snapshot"
          value={s(snapshot.objectVersion || "Unknown object/version")}
          hint={joinLine(
            [
              snapshot.triggerType ? `Trigger ${titleize(snapshot.triggerType)}` : "",
              snapshot.projectionStatus
                ? `Projection ${titleize(snapshot.projectionStatus)}`
                : "",
              snapshot.reviewSessionId ? `Review ${snapshot.reviewSessionId}` : "",
              snapshot.repairRunId ? `Repair ${snapshot.repairRunId}` : "",
            ],
            "No additional context fields were returned"
          )}
        />
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Guided Remediation
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              What to do next
            </div>
          </div>
          <Badge tone={toneForOutcome(event.policyOutcome)} variant="subtle" dot>
            {s(remediation.requiredRole ? titleize(remediation.requiredRole) : "Operator")}
          </Badge>
        </div>

        <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {s(remediation.headline || "No operator action is currently required.")}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <RemediationCard
            title="Review"
            tone={remediation.reviewRequired ? "warn" : "neutral"}
            body={s(
              remediation.review ||
                "No explicit protected review requirement was returned for this event."
            )}
          />
          <RemediationCard
            title="Repair"
            tone={remediation.repairRequired ? "danger" : "neutral"}
            body={s(
              remediation.repair ||
                "No explicit repair action is currently required for this event."
            )}
          />
          <RemediationCard
            title="Approval"
            tone={remediation.approvalRequired ? "warn" : "neutral"}
            body={s(
              remediation.approval ||
                "No explicit truth approval action was returned for this event."
            )}
          />
          <RemediationCard
            title="Operator Only"
            tone={remediation.operatorOnly || remediation.handoffRequired ? "warn" : "neutral"}
            body={s(
              remediation.operator ||
                "This event does not currently require a dedicated operator-only lane."
            )}
          />
        </div>

        <div className="mt-4 rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-400">
          Next action: {s(nextAction.label || remediation.nextActionLabel || "Unavailable")}
        </div>

        {remediationActions.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {remediationActions.map((action) => (
              <Button
                key={`${event.id}-${action.id || action.actionType || action.label}`}
                variant="secondary"
                size="sm"
                onClick={() => onRunAction?.(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function GovernanceHistoryPanel({
  decisionAudit = {},
  onRunAction,
  preferredFilter = "",
  preferredEventId = "",
}) {
  const filters = arr(decisionAudit.availableFilters);
  const [activeFilter, setActiveFilter] = useState(s(preferredFilter || "all").toLowerCase());
  const [selectedEventId, setSelectedEventId] = useState(s(preferredEventId));
  const items = arr(decisionAudit.items);

  useEffect(() => {
    const nextFilter = s(preferredFilter || "all").toLowerCase();
    if (!nextFilter) return;
    setActiveFilter(nextFilter);
  }, [preferredFilter]);

  useEffect(() => {
    const nextEventId = s(preferredEventId);
    if (!nextEventId) return;
    setSelectedEventId(nextEventId);
  }, [preferredEventId]);

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => s(item.group).toLowerCase() === activeFilter);
  }, [activeFilter, items]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedEventId("");
      return;
    }
    if (visibleItems.some((item) => s(item.id) === selectedEventId)) return;
    setSelectedEventId(s(visibleItems[0].id));
  }, [selectedEventId, visibleItems]);

  const selectedEvent =
    visibleItems.find((item) => s(item.id) === selectedEventId) || visibleItems[0] || null;

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
          Operators can inspect an individual governance decision, trace the truth/runtime/control posture involved, and get guided remediation without leaving the existing governance cockpit.
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
          <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="space-y-3">
              {visibleItems.map((event) => {
                const selected = s(event.id) === s(selectedEvent?.id);
                return (
                  <button
                    key={s(event.id || `${event.eventType}-${event.timestamp}`)}
                    type="button"
                    onClick={() => setSelectedEventId(s(event.id))}
                    className={[
                      "w-full rounded-[22px] border px-4 py-4 text-left transition",
                      selected
                        ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_50px_rgba(15,23,42,0.14)] dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-200/80 bg-white/70 text-slate-900 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={toneForOutcome(event.policyOutcome)} variant="subtle" dot>
                            {s(event.policyOutcomeLabel || titleize(event.policyOutcome || "unknown"))}
                          </Badge>
                          <Badge tone="neutral" variant="subtle">
                            {s(event.groupLabel || titleize(event.group || "execution"))}
                          </Badge>
                        </div>
                        <div className="text-sm font-semibold">
                          {s(event.eventLabel || titleize(event.eventType || "unknown_event"))}
                        </div>
                        <div className={selected ? "text-xs leading-5 text-white/70 dark:text-slate-700" : "text-xs leading-5 text-slate-500 dark:text-slate-400"}>
                          {formatWhen(event.timestamp)} · {s(event.actor || event.source || "system")}
                        </div>
                      </div>

                      <div className={selected ? "text-right text-xs leading-5 text-white/70 dark:text-slate-700" : "text-right text-xs leading-5 text-slate-500 dark:text-slate-400"}>
                        <div>{titleize(event.surface || "unknown")}</div>
                        <div>{titleize(event.channelType || "unknown")}</div>
                      </div>
                    </div>

                    <div className={selected ? "mt-3 text-sm text-white/82 dark:text-slate-700" : "mt-3 text-sm text-slate-600 dark:text-slate-300"}>
                      {s(
                        obj(event.decisionContextSnapshot).summary ||
                          obj(event.remediation).headline ||
                          "Event detail is partially unavailable."
                      )}
                    </div>

                    <div className={selected ? "mt-3 text-xs text-white/68 dark:text-slate-700" : "mt-3 text-xs text-slate-500 dark:text-slate-400"}>
                      Next action:{" "}
                      {s(
                        obj(event.recommendedNextAction).label ||
                          obj(event.remediation).nextActionLabel ||
                          "Unavailable"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <EventDetailPanel event={selectedEvent || {}} onRunAction={onRunAction} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
