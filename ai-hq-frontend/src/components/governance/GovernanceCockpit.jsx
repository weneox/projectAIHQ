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
  const autonomyHeadline = hasRuntimeTelemetry
    ? runtimeHealth.autonomousAllowed
      ? `Autonomous operation is allowed in ${titleize(
          runtimeHealth.autonomousOperation || "continue"
        )} mode.`
      : "Autonomous operation is fail-closed until projection health is repaired."
    : "Runtime health telemetry is temporarily unavailable. The cockpit is showing safe diagnostic defaults instead of inferring execution authority.";

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(14,165,233,0.12),transparent_42%),radial-gradient(120%_120%_at_0%_100%,rgba(15,23,42,0.08),transparent_44%)] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(56,189,248,0.12),transparent_40%),radial-gradient(120%_120%_at_0%_100%,rgba(148,163,184,0.10),transparent_42%)]" />
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Governed Control Plane
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
              tone={
                hasRuntimeTelemetry
                  ? runtimeHealth.autonomousAllowed
                    ? "success"
                    : "danger"
                  : "neutral"
              }
              variant="subtle"
              dot
            >
              {hasRuntimeTelemetry
                ? runtimeHealth.autonomousAllowed
                  ? "Autonomy allowed"
                  : "Autonomy stopped"
                : "Autonomy unknown"}
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
            label="Runtime Health"
            value={titleize(runtimeStatus || "unknown")}
            hint={
              hasRuntimeTelemetry
                ? titleize(runtimeHealth.reasonCode || "no active reason")
                : "Runtime telemetry unavailable"
            }
            tone={hasRuntimeTelemetry ? toneForHealth(runtimeStatus) : "neutral"}
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
