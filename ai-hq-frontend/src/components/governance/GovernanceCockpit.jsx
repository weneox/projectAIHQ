import { useEffect, useRef } from "react";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import GovernanceHistoryPanel from "./GovernanceHistoryPanel.jsx";

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
  if (!raw) return "Unavailable";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function toneForHealth(status = "") {
  switch (s(status).toLowerCase()) {
    case "healthy":
      return "success";
    case "degraded":
      return "warn";
    case "stale":
    case "blocked":
      return "warn";
    case "invalid":
    case "missing":
      return "danger";
    default:
      return "neutral";
  }
}

function toneForPolicyOutcome(outcome = "") {
  switch (s(outcome).toLowerCase()) {
    case "allowed":
      return "success";
    case "allowed_with_logging":
      return "info";
    case "review_required":
    case "approval_required":
    case "quarantined":
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

function collectRuntimeRepair(runtime = {}, readiness = {}) {
  const runtimeRepair = obj(runtime.repair);
  if (Object.keys(obj(runtimeRepair.action)).length) return runtimeRepair.action;
  return obj(arr(readiness.blockedItems)[0]?.action);
}

function resolveSummary(input = {}) {
  const root = obj(input);
  const nestedSummary = obj(root.summary);
  return Object.keys(nestedSummary).length ? nestedSummary : root;
}

function collectLatestFinalize(truth = {}) {
  const current = obj(truth);
  if (Object.keys(obj(current.finalizeImpact)).length) {
    return {
      finalizeImpact: obj(current.finalizeImpact),
      governance: obj(current.governance),
    };
  }

  const latestHistory = arr(current.history)[0];
  return {
    finalizeImpact: obj(latestHistory?.finalizeImpact),
    governance: obj(latestHistory?.governance),
  };
}

function collectPolicyPosture(summary = {}, truth = {}) {
  const source = obj(summary.policyPosture);
  const approvalPolicy = obj(obj(summary.truth).approvalPolicy);
  return {
    truthPublicationPosture: s(
      source.truthPublicationPosture || approvalPolicy.strictestOutcome || "unknown"
    ).toLowerCase(),
    executionPosture: s(source.executionPosture || "unknown").toLowerCase(),
    reviewRequired: source.reviewRequired === true,
    handoffRequired: source.handoffRequired === true,
    blockedUntilRepair: source.blockedUntilRepair === true,
    blocked: source.blocked === true,
    requiredRole: s(source.requiredRole || "operator"),
    requiredAction: s(source.requiredAction),
    explanation: s(
      source.explanation ||
        "Policy telemetry is unavailable. The cockpit stays explicit instead of inferring authority."
    ),
    nextAction: obj(source.nextAction),
    affectedSurfaces: arr(source.affectedSurfaces),
    reasons: arr(source.reasons),
  };
}

function collectChannelAutonomy(summary = {}) {
  return arr(obj(summary.channelAutonomy).items).map((item) => ({
    surface: s(item.surface || "unknown").toLowerCase(),
    autonomyStatus: s(item.autonomyStatus || "unknown").toLowerCase(),
    policyOutcome: s(item.policyOutcome || "unknown").toLowerCase(),
    explanation: s(item.explanation || "Telemetry unavailable."),
    why: arr(item.why),
    repairRequired: item.repairRequired === true,
    reviewRequired: item.reviewRequired === true,
    handoffRequired: item.handoffRequired === true,
    requiredAction: s(item.requiredAction),
    requiredRole: s(item.requiredRole || "operator"),
    nextAction: obj(item.nextAction),
  }));
}

function collectPolicyControls(summary = {}) {
  const source = obj(summary.policyControls);
  return {
    viewerRole: s(source.viewerRole || "member").toLowerCase(),
    cannotLoosenAutonomy: source.cannotLoosenAutonomy === true,
    tenantDefault: obj(source.tenantDefault),
    items: arr(source.items),
  };
}

function collectDecisionAudit(summary = {}) {
  const source = obj(summary.decisionAudit);
  return {
    items: arr(source.items),
    availableFilters: arr(source.availableFilters),
  };
}

function MetricCard({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" tone={tone} className="rounded-[24px]">
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {value}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</div>
        ) : null}
      </div>
    </Card>
  );
}

function TagList({ items = [], empty = "None" }) {
  const safeItems = arr(items).map((item) => s(item)).filter(Boolean);
  if (!safeItems.length) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">{empty}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {safeItems.map((item) => (
        <Badge key={item} tone="neutral" variant="subtle">
          {titleize(item)}
        </Badge>
      ))}
    </div>
  );
}

function ImpactList({ title, items = [], empty }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {title}
      </div>
      <TagList items={items} empty={empty} />
    </div>
  );
}

export function GovernanceSignalStrip({
  truth = {},
  trust = {},
  onJump,
}) {
  const summary = resolveSummary(trust);
  const runtime = obj(summary.runtimeProjection);
  const runtimeHealth = obj(runtime.health);
  const truthSummary = obj(summary.truth);
  const reviewQueue = obj(summary.reviewQueue);
  const runtimeStatus = s(runtimeHealth.status || runtime.status).toLowerCase();
  const hasRuntimeTelemetry = Boolean(
    runtimeStatus || s(runtimeHealth.reasonCode || runtimeHealth.primaryReasonCode)
  );
  const autonomyValue = hasRuntimeTelemetry
    ? runtimeHealth.autonomousAllowed
      ? "Allowed"
      : "Stopped"
    : "Unknown";
  const autonomyHint = hasRuntimeTelemetry
    ? runtimeHealth.autonomousAllowed
      ? `Mode: ${titleize(runtimeHealth.autonomousOperation || "continue")}`
      : "Fail-closed authority is active until runtime health recovers."
    : "Runtime health telemetry is not currently available.";
  const autonomyTone = hasRuntimeTelemetry
    ? runtimeHealth.autonomousAllowed
      ? "success"
      : "danger"
    : "neutral";

  return (
    <Card variant="surface" className="rounded-[28px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Governed Operations
          </div>
          <div className="text-[22px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
            Approved truth, runtime health, and repair stay in one operator loop.
          </div>
          <div className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            The main control path is approved truth to runtime projection to controlled operations. Review pressure, projection health, and repair guidance stay visible even while you work in other settings sections.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onJump?.("sources")}>
            Source Governance
          </Button>
          <Button variant="secondary" onClick={() => onJump?.("knowledge_review")}>
            Review Queue
          </Button>
          <Button variant="secondary" onClick={() => onJump?.("operational")}>
            Runtime Operations
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Approved Truth"
          value={s(truth.approval?.version || truth.latestVersionId || truthSummary.latestVersionId || "Pending")}
          hint={
            s(truth.approval?.approvedAt || truth.approvedAt || truthSummary.approvedAt)
              ? `Latest approval ${formatWhen(truth.approval?.approvedAt || truth.approvedAt || truthSummary.approvedAt)}`
              : "No approved truth version is available."
          }
          tone={s(truthSummary.latestVersionId || truth.latestVersionId || truth.approval?.version) ? "success" : "warn"}
        />
        <MetricCard
          label="Review Pressure"
          value={`${Number(reviewQueue.pending || 0)} pending`}
          hint={`${Number(reviewQueue.conflicts || 0)} conflicts still require operator judgment.`}
          tone={Number(reviewQueue.conflicts || 0) > 0 ? "warn" : "neutral"}
        />
        <MetricCard
          label="Runtime Health"
          value={titleize(runtimeStatus || "unknown")}
          hint={
            hasRuntimeTelemetry
              ? titleize(runtimeHealth.reasonCode || "no active reason")
              : "Runtime telemetry unavailable"
          }
          tone={hasRuntimeTelemetry ? toneForHealth(runtimeHealth.status) : "neutral"}
        />
        <MetricCard
          label="Autonomous Operation"
          value={autonomyValue}
          hint={autonomyHint}
          tone={autonomyTone}
        />
      </div>
    </Card>
  );
}

export default function GovernanceCockpit({
  title = "Governance Cockpit",
  subtitle = "Truth governance, runtime projection health, finalize impact, and repair guidance in one operator view.",
  truth = {},
  trust = {},
  onRunAction,
  onSavePolicyControl,
  policyControlState = {},
  navigationState = {},
}) {
  const summary = resolveSummary(trust);
  const readiness = obj(summary.readiness);
  const truthSummary = obj(summary.truth);
  const runtime = obj(summary.runtimeProjection);
  const runtimeHealth = obj(runtime.health);
  const runtimeReasonCodes = arr(runtimeHealth.reasons);
  const reviewQueue = obj(summary.reviewQueue);
  const runtimeStatus = s(runtimeHealth.status || runtime.status).toLowerCase();
  const hasRuntimeTelemetry = Boolean(
    runtimeStatus || s(runtimeHealth.reasonCode || runtimeHealth.primaryReasonCode)
  );
  const latestFinalize = collectLatestFinalize({
    ...obj(truth),
    finalizeImpact: obj(truth.finalizeImpact || truthSummary.finalizeImpact),
    governance: obj(truth.governance || truthSummary.governance),
  });
  const finalizeImpact = obj(latestFinalize.finalizeImpact);
  const governance = obj(latestFinalize.governance);
  const primaryRepair = collectRuntimeRepair(runtime, readiness);
  const affectedSurfaces = arr(runtimeHealth.affectedSurfaces);
  const policyPosture = collectPolicyPosture(summary, truth);
  const channelAutonomy = collectChannelAutonomy(summary);
  const policyControls = collectPolicyControls(summary);
  const decisionAudit = collectDecisionAudit(summary);
  const policyPostureAction = obj(policyPosture.nextAction);
  const policyTone = toneForPolicyOutcome(policyPosture.executionPosture);
  const historyRef = useRef(null);
  const policyControlsRef = useRef(null);
  const runtimeHealthRef = useRef(null);
  const navigationFocus = s(navigationState.trustFocus).toLowerCase();
  const preferredHistoryFilter = s(navigationState.historyFilter).toLowerCase();
  const preferredHistoryEventId = s(navigationState.eventId);
  const autonomyHeadline = hasRuntimeTelemetry
    ? runtimeHealth.autonomousAllowed
      ? `Autonomous operation is allowed in ${titleize(
          runtimeHealth.autonomousOperation || "continue"
        )} mode.`
      : "Autonomous operation is fail-closed until projection health is repaired."
    : "Runtime health telemetry is temporarily unavailable. The cockpit is showing safe diagnostic defaults instead of inferring execution authority.";

  useEffect(() => {
    const refMap = {
      repair_hub: runtimeHealthRef,
      runtime_health: runtimeHealthRef,
      runtime_projection: runtimeHealthRef,
      policy_controls: policyControlsRef,
      governance_history: historyRef,
      channel_surface: policyControlsRef,
    };
    const ref = refMap[navigationFocus];
    const node = ref?.current;
    if (!node) return;
    node.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [navigationFocus]);

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(14,165,233,0.12),transparent_42%),radial-gradient(120%_120%_at_0%_100%,rgba(15,23,42,0.08),transparent_44%)] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(56,189,248,0.12),transparent_40%),radial-gradient(120%_120%_at_0%_100%,rgba(148,163,184,0.10),transparent_42%)]" />
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Approval and runtime
            </div>
            <div className="text-[30px] font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {title}
            </div>
            <div className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s(truthSummary.latestVersionId || truth.approval?.version) ? "success" : "warn"} variant="subtle" dot>
              {s(truthSummary.latestVersionId || truth.approval?.version) ? "Approved truth present" : "Truth approval required"}
            </Badge>
            <Badge tone={hasRuntimeTelemetry ? toneForHealth(runtimeStatus) : "neutral"} variant="subtle" dot>
              Runtime {titleize(runtimeStatus || "unknown")}
            </Badge>
            <Badge
              tone={policyTone}
              variant="subtle"
              dot
            >
              {titleize(policyPosture.executionPosture || "unknown")}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Approved Truth"
            value={s(truth.approval?.version || truthSummary.latestVersionId || "Pending")}
            hint={
              s(truth.approval?.approvedAt || truthSummary.approvedAt)
                ? `${formatWhen(truth.approval?.approvedAt || truthSummary.approvedAt)} by ${s(truth.approval?.approvedBy || truthSummary.approvedBy || "operator")}`
                : "No approved truth version is currently available."
            }
            tone={s(truthSummary.latestVersionId || truth.approval?.version) ? "success" : "warn"}
          />
          <MetricCard
            label="Pending Review"
            value={String(Number(reviewQueue.pending || 0))}
            hint={`${Number(reviewQueue.conflicts || 0)} conflict${Number(reviewQueue.conflicts || 0) === 1 ? "" : "s"} waiting for review.`}
            tone={Number(reviewQueue.conflicts || 0) > 0 ? "warn" : "neutral"}
          />
          <MetricCard
            label="Quarantined / Weak"
            value={String(Number(governance.quarantinedClaimCount || 0))}
            hint={
              governance.quarantine
                ? titleize(arr(governance.quarantineReasons)[0] || "quarantined")
                : governance.freshness?.bucket
                  ? `Freshness ${titleize(governance.freshness.bucket)}`
                  : "No quarantined latest finalize claims were exposed."
            }
            tone={Number(governance.quarantinedClaimCount || 0) > 0 ? "warn" : "neutral"}
          />
          <MetricCard
            label="Execution Posture"
            value={titleize(policyPosture.executionPosture || "unknown")}
            hint={
              policyPosture.requiredAction
                ? `${policyPosture.requiredAction}${policyPosture.requiredRole ? ` · ${titleize(policyPosture.requiredRole)}` : ""}`
                : policyPosture.explanation
            }
            tone={policyTone}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card variant="surface" className="rounded-[28px]" tone={policyTone}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Policy Posture
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                     Approval and runtime state
                  </div>
                </div>
                <Badge tone={policyTone} variant="subtle" dot>
                  {titleize(policyPosture.executionPosture || "unknown")}
                </Badge>
              </div>

              <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                {policyPosture.explanation}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <MetricCard
                  label="Truth Publication"
                  value={titleize(policyPosture.truthPublicationPosture || "unknown")}
                  hint="Approval posture for the latest truth publication path."
                  tone={toneForPolicyOutcome(policyPosture.truthPublicationPosture)}
                />
                <MetricCard
                  label="Required Next Step"
                  value={policyPosture.requiredAction || "Telemetry unavailable"}
                  hint={
                    policyPosture.requiredRole
                      ? `Required role: ${titleize(policyPosture.requiredRole)}`
                      : "No explicit role requirement returned."
                  }
                  tone={policyTone}
                />
              </div>

              <ImpactList
                title="Affected Channels"
                items={policyPosture.affectedSurfaces}
                empty="No affected channel summary was returned."
              />
              <ImpactList
                title="Policy Drivers"
                items={policyPosture.reasons}
                empty="No policy driver telemetry was returned."
              />

              {(policyPosture.reviewRequired || policyPosture.handoffRequired || policyPosture.blockedUntilRepair) ? (
                <div className="flex flex-wrap gap-2">
                  {policyPosture.reviewRequired ? (
                    <Badge tone="warn" variant="subtle">
                      Human review required
                    </Badge>
                  ) : null}
                  {policyPosture.handoffRequired ? (
                    <Badge tone="warn" variant="subtle">
                      Handoff required
                    </Badge>
                  ) : null}
                  {policyPosture.blockedUntilRepair ? (
                    <Badge tone="danger" variant="subtle">
                      Repair required
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {policyPostureAction?.label && policyPostureAction.allowed !== false ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRunAction?.(policyPostureAction)}
                  >
                    {policyPostureAction.label}
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card variant="surface" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Channel Autonomy
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    Allowed, reviewed, handed off, or blocked by surface
                  </div>
                </div>
                <Badge tone="info" variant="subtle" dot>
                  {channelAutonomy.length} surface{channelAutonomy.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {!channelAutonomy.length ? (
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Channel autonomy telemetry is unavailable. The control plane shows an explicit unknown posture instead of assuming autonomy is safe.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {channelAutonomy.map((item) => (
                    <div
                      key={item.surface}
                      className="rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">
                          {titleize(item.surface)}
                        </div>
                        <Badge tone={toneForPolicyOutcome(item.policyOutcome)} variant="subtle" dot>
                          {titleize(item.policyOutcome || "unknown")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {item.explanation}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="neutral" variant="subtle">
                          {titleize(item.autonomyStatus || "unknown")}
                        </Badge>
                        {item.reviewRequired ? (
                          <Badge tone="warn" variant="subtle">
                            Review
                          </Badge>
                        ) : null}
                        {item.handoffRequired ? (
                          <Badge tone="warn" variant="subtle">
                            Handoff
                          </Badge>
                        ) : null}
                        {item.repairRequired ? (
                          <Badge tone="danger" variant="subtle">
                            Repair
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.requiredAction
                          ? `Next step: ${item.requiredAction}${item.requiredRole ? ` · ${titleize(item.requiredRole)}` : ""}`
                          : "No explicit next step was returned."}
                      </div>
                      {item.nextAction?.label && item.nextAction.allowed !== false ? (
                        <div className="mt-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onRunAction?.(item.nextAction)}
                          >
                            {item.nextAction.label}
                          </Button>
                        </div>
                      ) : null}
                      {item.why.length ? (
                        <div className="mt-3">
                          <TagList items={item.why} empty="No policy drivers returned." />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div ref={policyControlsRef}>
        <Card variant="surface" className="rounded-[28px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Policy Controls
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  Operator-manageable autonomy controls
                </div>
              </div>
              <Badge tone="info" variant="subtle" dot>
                {titleize(policyControls.viewerRole || "member")}
              </Badge>
            </div>

            <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Controls can tighten autonomy by channel, but they never bypass strict runtime authority, repair-required posture, or blocked truth governance.
            </div>

            {policyControlState.error ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                {policyControlState.error}
              </div>
            ) : null}

            {policyControls.cannotLoosenAutonomy ? (
              <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                Runtime or truth safety posture currently forbids loosening autonomy. Safer control modes remain available.
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[policyControls.tenantDefault, ...policyControls.items]
                .filter((item) => Object.keys(obj(item)).length > 0)
                .map((item) => {
                  const savingKey = s(item.surface || "tenant");
                  const saving =
                    policyControlState.savingSurface &&
                    policyControlState.savingSurface === savingKey;
                  return (
                    <div
                      key={savingKey}
                      className="rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">
                          {savingKey === "tenant" ? "Tenant Default" : titleize(savingKey)}
                        </div>
                        <Badge tone={toneForPolicyOutcome(item.controlMode)} variant="subtle" dot>
                          {titleize(item.controlMode || "autonomy_enabled")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.changedAt
                          ? `Updated ${formatWhen(item.changedAt)}${item.changedBy ? ` by ${item.changedBy}` : ""}`
                          : "No explicit override recorded."}
                      </div>
                      <div className="mt-3 space-y-2">
                        {arr(item.availableModes).map((mode) => (
                          <button
                            key={mode.mode}
                            type="button"
                            disabled={!mode.allowed || !onSavePolicyControl || saving}
                            onClick={() =>
                              onSavePolicyControl?.({
                                surface: item.surface || "tenant",
                                controlMode: mode.mode,
                              })
                            }
                            className={[
                              "flex w-full items-center justify-between rounded-[14px] border px-3 py-2 text-left text-sm transition",
                              mode.mode === item.controlMode
                                ? "border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                                : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200",
                              !mode.allowed || !onSavePolicyControl || saving
                                ? "cursor-not-allowed opacity-60"
                                : "hover:border-slate-400 dark:hover:border-white/30",
                            ].join(" ")}
                          >
                            <span>{mode.label}</span>
                            <span className="text-[11px] uppercase tracking-[0.14em] opacity-70">
                              {mode.allowed ? "Apply" : titleize(mode.requiredRole)}
                            </span>
                          </button>
                        ))}
                      </div>
                      {arr(item.availableModes).some((mode) => !mode.allowed && mode.unavailableReason) ? (
                        <div className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {
                            arr(item.availableModes).find(
                              (mode) => !mode.allowed && mode.unavailableReason
                            )?.unavailableReason
                          }
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
        </div>

        <div ref={historyRef}>
          <GovernanceHistoryPanel
            decisionAudit={decisionAudit}
            onRunAction={onRunAction}
            preferredFilter={preferredHistoryFilter}
            preferredEventId={preferredHistoryEventId}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card variant="surface" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Truth Status
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    Latest approval and evidence quality
                  </div>
                </div>
                <Badge tone={governance.quarantine ? "warn" : "info"} variant="subtle" dot>
                  {governance.quarantine ? "Review-sensitive finalize" : "Finalize explainable"}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">Trust and freshness</div>
                  <TagList
                    items={[
                      governance.trust?.strongestTier,
                      governance.trust?.strongestSourceType,
                      governance.freshness?.bucket,
                      governance.conflict?.classification,
                    ]}
                    empty="No governance summary was returned for the latest approval."
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">Review posture</div>
                  <TagList
                    items={[
                      governance.disposition,
                      governance.quarantine ? "quarantined" : "",
                      governance.conflict?.reviewRequired ? "review required" : "",
                    ]}
                    empty="No special review posture."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Strong Evidence"
                  value={String(Number(governance.support?.strongEvidenceCount || 0))}
                  hint={`${Number(governance.support?.evidenceCount || 0)} total evidence point${Number(governance.support?.evidenceCount || 0) === 1 ? "" : "s"}`}
                  tone="info"
                />
                <MetricCard
                  label="Unique Sources"
                  value={String(Number(governance.support?.uniqueSourceCount || 0))}
                  hint="Independent supporting sources seen in the latest finalize evidence."
                  tone="neutral"
                />
                <MetricCard
                  label="Stale Signals"
                  value={String(Number(governance.support?.staleEvidenceCount || 0))}
                  hint="Older signals are visible here instead of being flattened away."
                  tone={Number(governance.support?.staleEvidenceCount || 0) > 0 ? "warn" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <div ref={runtimeHealthRef}>
          <Card variant="surface" className="rounded-[28px]" tone={hasRuntimeTelemetry ? toneForHealth(runtimeStatus) : "neutral"}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Runtime Health
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    Projection authority and repair
                  </div>
                </div>
                <Badge tone={hasRuntimeTelemetry ? toneForHealth(runtimeStatus) : "neutral"} variant="subtle" dot>
                  {titleize(runtimeStatus || "unknown")}
                </Badge>
              </div>

              <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                {autonomyHeadline}
              </div>

              <ImpactList
                title="Reason Codes"
                items={runtimeReasonCodes.length ? runtimeReasonCodes : [runtimeHealth.reasonCode]}
                empty="No active runtime health reason was returned."
              />
              <ImpactList
                title="Affected Surfaces"
                items={affectedSurfaces}
                empty="No affected surfaces were returned."
              />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Last Known Good
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {s(runtimeHealth.lastKnownGood?.runtimeProjectionId || "Unavailable")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {runtimeHealth.lastKnownGood?.lastGoodAt
                      ? `Observed ${formatWhen(runtimeHealth.lastKnownGood.lastGoodAt)}`
                      : "Diagnostic visibility only. Never used as runtime authority."}
                  </div>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Latest Failure
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {s(runtimeHealth.lastFailure?.errorCode || "None")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {runtimeHealth.lastFailure?.finishedAt
                      ? formatWhen(runtimeHealth.lastFailure.finishedAt)
                      : "No recent failed projection repair was returned."}
                  </div>
                </div>
              </div>

              {Object.keys(obj(primaryRepair)).length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => onRunAction?.(primaryRepair)}>
                    {s(primaryRepair.label || "Run recommended repair")}
                  </Button>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Next repair: {titleize(runtimeHealth.nextRecommendedRepair?.action || primaryRepair.id)}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
          </div>
        </div>

        <Card variant="surface" className="rounded-[28px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Finalize Impact
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  Latest approved change footprint
                </div>
              </div>
              <Badge tone="info" variant="subtle" dot>
                {arr(finalizeImpact.canonicalAreas).length + arr(finalizeImpact.runtimeAreas).length} area{arr(finalizeImpact.canonicalAreas).length + arr(finalizeImpact.runtimeAreas).length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ImpactList
                title="Canonical Areas"
                items={finalizeImpact.canonicalAreas}
                empty="No canonical area summary was returned."
              />
              <ImpactList
                title="Runtime Areas"
                items={finalizeImpact.runtimeAreas}
                empty="No runtime area summary was returned."
              />
              <ImpactList
                title="Canonical Paths"
                items={finalizeImpact.canonicalPaths}
                empty="No canonical field paths were returned."
              />
              <ImpactList
                title="Affected Channels"
                items={finalizeImpact.affectedSurfaces}
                empty="No downstream surface impact was returned."
              />
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}
