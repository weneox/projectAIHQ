import { useState } from "react";

import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
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
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function toneForBucket(value = "") {
  switch (s(value).toLowerCase()) {
    case "auto_approvable":
      return "success";
    case "conflicting":
    case "quarantined":
      return "warn";
    case "blocked_high_risk":
      return "danger";
    default:
      return "info";
  }
}

function toneForRisk(value = "") {
  switch (s(value).toLowerCase()) {
    case "high":
      return "danger";
    case "medium":
      return "warn";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

function toneForDelta(value = "") {
  switch (s(value).toLowerCase()) {
    case "tightens":
    case "stricter":
    case "higher":
    case "repair_or_review_gate":
      return "warn";
    case "loosens":
    case "looser":
    case "lower":
      return "info";
    case "unchanged":
      return "neutral";
    default:
      return "neutral";
  }
}

function toneForPublishStatus(value = "") {
  switch (s(value).toLowerCase()) {
    case "success":
      return "success";
    case "partial_success":
      return "warn";
    case "follow_up_required":
      return "warn";
    case "repair_required":
      return "danger";
    default:
      return "neutral";
  }
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Unavailable";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function StatCard({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" tone={tone} className="rounded-[24px]">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {value}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ChipList({ items = [], empty = "Unavailable" }) {
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

function ImpactGrid({ preview = {} }) {
  const current = obj(preview);
  const canonicalAreas = arr(current.canonicalAreas).length
    ? current.canonicalAreas
    : current.canonical?.areas;
  const runtimeAreas = arr(current.runtimeAreas).length
    ? current.runtimeAreas
    : current.runtime?.areas;
  const canonicalPaths = arr(current.canonicalPaths).length
    ? current.canonicalPaths
    : current.canonical?.paths;
  const affectedSurfaces = arr(current.affectedSurfaces).length
    ? current.affectedSurfaces
    : current.channels?.affectedSurfaces;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Canonical Areas
        </div>
        <ChipList items={canonicalAreas} empty="No canonical impact exposed." />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Runtime Areas
        </div>
        <ChipList items={runtimeAreas} empty="No runtime impact exposed." />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Canonical Paths
        </div>
        <ChipList items={canonicalPaths} empty="No canonical paths exposed." />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Affected Surfaces
        </div>
        <ChipList items={affectedSurfaces} empty="No affected surfaces exposed." />
      </div>
    </div>
  );
}

function PreviewDeltaStrip({ preview = {} }) {
  const current = obj(preview);
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={toneForDelta(current.policy?.autonomyDelta)} variant="subtle" dot>
        Autonomy {titleize(current.policy?.autonomyDelta || "unknown")}
      </Badge>
      <Badge
        tone={toneForDelta(current.policy?.executionPostureDelta)}
        variant="subtle"
        dot
      >
        Execution {titleize(current.policy?.executionPostureDelta || "unknown")}
      </Badge>
      <Badge tone={toneForDelta(current.policy?.riskDelta)} variant="subtle" dot>
        Risk {titleize(current.policy?.riskDelta || "unknown")}
      </Badge>
      <Badge tone={toneForDelta(current.runtime?.readinessDelta)} variant="subtle" dot>
        Readiness {titleize(current.runtime?.readinessDelta || "unknown")}
      </Badge>
    </div>
  );
}

function ComparisonDelta({ label, value = {} }) {
  const current = obj(value);
  return (
    <Card variant="subtle" className="rounded-[20px]">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={current.matched === false ? "warn" : "success"} variant="subtle" dot>
            {titleize(current.status || "unknown")}
          </Badge>
          {current.previewUnknown ? (
            <Badge tone="neutral" variant="subtle">
              Preview had unknowns
            </Badge>
          ) : null}
        </div>
        <ChipList
          items={[
            ...arr(current.missingFromActual).map((item) => `missing ${item}`),
            ...arr(current.addedInActual).map((item) => `added ${item}`),
          ]}
          empty="No preview-to-actual drift was recorded."
        />
      </div>
    </Card>
  );
}

function PublishReceiptPanel({ receipt = {} }) {
  const current = obj(receipt);
  if (!Object.keys(current).length) return null;

  return (
    <Card
      variant="surface"
      tone={toneForPublishStatus(current.publishStatus)}
      className="rounded-[28px]"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Publish Verification
            </div>
            <div className="text-[22px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Change Receipt
            </div>
            <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              {current.summaryExplanation ||
                "Post-publish verification detail is unavailable."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={toneForPublishStatus(current.publishStatus)} variant="subtle" dot>
              {titleize(current.publishStatus || "unknown")}
            </Badge>
            <Badge tone="neutral" variant="subtle">
              {titleize(current.previewComparison?.status || "unknown")} preview match
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Truth Version"
            value={current.truthVersionId || "Unavailable"}
            hint={
              current.verification?.truthVersionCreated
                ? "Verified"
                : "No truth version identifier was exposed."
            }
            tone={current.verification?.truthVersionCreated ? "success" : "neutral"}
          />
          <StatCard
            label="Runtime Projection"
            value={current.runtimeProjectionId || "Unavailable"}
            hint={titleize(current.runtimeRefreshResult || "unknown")}
            tone={current.verification?.runtimeProjectionRefreshed ? "success" : "warn"}
          />
          <StatCard
            label="Projection Health"
            value={titleize(
              current.projectionHealthLabel ||
                current.projectionHealthStatus ||
                "unknown"
            )}
            hint={
              current.verification?.repairRecommendation ||
              "No repair recommendation returned."
            }
            tone={toneForPublishStatus(
              current.publishStatus === "repair_required"
                ? "repair_required"
                : current.publishStatus === "follow_up_required"
                  ? "follow_up_required"
                  : "success"
            )}
          />
          <StatCard
            label="Recorded By"
            value={current.actor || "Unavailable"}
            hint={formatWhen(current.timestamp)}
            tone="neutral"
          />
        </div>

        <PreviewDeltaStrip
          preview={{
            policy: current.actual?.policy,
            runtime: { readinessDelta: current.runtimeRefreshResult },
          }}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card variant="subtle" className="rounded-[24px]">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Verified Impact
              </div>
              <ImpactGrid
                preview={{
                  canonicalAreas: current.actual?.canonical?.areas,
                  runtimeAreas: current.actual?.runtime?.areas,
                  canonicalPaths: current.actual?.canonical?.paths,
                  affectedSurfaces: current.actual?.channels?.affectedSurfaces,
                }}
              />
            </div>
          </Card>
          <Card variant="subtle" className="rounded-[24px]">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Verification Warnings
              </div>
              <ChipList
                items={current.verification?.runtimeControlWarnings}
                empty="Publish completed without runtime control warnings."
              />
              <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {current.verification?.repairRecommendation ||
                  "No repair follow-up was recommended."}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Preview vs Actual
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Verified publish impact is compared against the preview the operator saw
              before approval. Unknown preview dimensions stay explicit instead of being
              treated as a match.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ComparisonDelta label="Canonical" value={current.previewComparison?.canonical} />
            <ComparisonDelta label="Runtime" value={current.previewComparison?.runtime} />
            <ComparisonDelta label="Surfaces" value={current.previewComparison?.channels} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function resolveSelectedId({ filteredItems, localSelectedId, preferredCandidateId }) {
  const localId = s(localSelectedId);
  if (localId && filteredItems.some((item) => s(item.id) === localId)) {
    return localId;
  }

  const preferredId = s(preferredCandidateId);
  if (preferredId && filteredItems.some((item) => s(item.id) === preferredId)) {
    return preferredId;
  }

  return s(filteredItems[0]?.id);
}

function resolveComparisonChoiceId({ comparisonChoices, localChoiceId, selectedId }) {
  const localId = s(localChoiceId);
  if (localId && comparisonChoices.some((choice) => s(choice.candidateId) === localId)) {
    return localId;
  }

  const selectedMatch = s(
    comparisonChoices.find((choice) => s(choice.candidateId) === s(selectedId))
      ?.candidateId
  );
  if (selectedMatch) return selectedMatch;

  return s(comparisonChoices[0]?.candidateId);
}

export default function TruthReviewWorkbench({
  title = "Truth Review Workbench",
  subtitle = "Pending, quarantined, conflicting, and high-risk source-derived truth candidates stay in one governed review surface.",
  workbench = {},
  surface = {},
  canManage = false,
  onRunAction,
  preferredCandidateId = "",
}) {
  const summary = obj(workbench.summary);
  const items = arr(workbench.items).slice();

  const [filter, setFilter] = useState("all");
  const [localSelectedId, setLocalSelectedId] = useState("");
  const [localComparisonChoiceId, setLocalComparisonChoiceId] = useState("");

  const filters = [
    { key: "all", label: "All", count: items.length },
    { key: "pending", label: "Pending", count: n(summary.pending) },
    { key: "quarantined", label: "Quarantined", count: n(summary.quarantined) },
    { key: "conflicting", label: "Conflicts", count: n(summary.conflicting) },
    {
      key: "auto_approvable",
      label: "Auto-Approvable",
      count: n(summary.autoApprovable),
    },
    {
      key: "blocked_high_risk",
      label: "High Risk",
      count: n(summary.blockedHighRisk),
    },
  ];

  const filteredItems =
    filter === "all"
      ? items
      : items.filter((item) => s(item.queueBucket) === filter);

  const selectedId = resolveSelectedId({
    filteredItems,
    localSelectedId,
    preferredCandidateId,
  });

  const selected =
    filteredItems.find((item) => s(item.id) === selectedId) || null;

  const comparisonChoices = arr(selected?.conflictResolution?.previewChoices);
  const comparisonChoiceId = resolveComparisonChoiceId({
    comparisonChoices,
    localChoiceId: localComparisonChoiceId,
    selectedId,
  });

  const selectedComparison =
    comparisonChoices.find(
      (choice) => s(choice.candidateId) === s(comparisonChoiceId)
    ) || null;

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_120%_at_100%_0%,rgba(245,158,11,0.14),transparent_42%),radial-gradient(120%_120%_at_0%_100%,rgba(15,23,42,0.08),transparent_46%)] dark:bg-[radial-gradient(140%_120%_at_100%_0%,rgba(251,191,36,0.12),transparent_42%),radial-gradient(120%_120%_at_0%_100%,rgba(148,163,184,0.10),transparent_44%)]" />
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Governed Review
            </div>
            <div className="text-[28px] font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {title}
            </div>
            <div className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info" variant="subtle" dot>
              {n(summary.total || items.length)} candidate
              {n(summary.total || items.length) === 1 ? "" : "s"}
            </Badge>
            <Badge tone="warn" variant="subtle" dot>
              {n(summary.conflicting)} conflict{n(summary.conflicting) === 1 ? "" : "s"}
            </Badge>
            <Badge
              tone={n(summary.highRisk) > 0 ? "danger" : "neutral"}
              variant="subtle"
              dot
            >
              {n(summary.highRisk)} high-risk
            </Badge>
          </div>
        </div>

        {surface.error ? (
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            {surface.error}
          </div>
        ) : null}

        {surface.saveSuccess ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
            {surface.saveSuccess}
          </div>
        ) : null}

        {surface.publishReceipt ? (
          <PublishReceiptPanel receipt={surface.publishReceipt} />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending"
            value={n(summary.pending)}
            hint="Candidates waiting for a direct operator decision."
            tone="info"
          />
          <StatCard
            label="Quarantined"
            value={n(summary.quarantined)}
            hint="Weak, stale, or manually held items remain outside approved truth."
            tone={n(summary.quarantined) > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Conflicts"
            value={n(summary.conflicting)}
            hint="Competing values that need stronger source judgment."
            tone={n(summary.conflicting) > 0 ? "warn" : "neutral"}
          />
          <StatCard
            label="Finalize Risk"
            value={n(summary.highRisk)}
            hint="Operationally sensitive truth items are never flattened into a casual review."
            tone={n(summary.highRisk) > 0 ? "danger" : "neutral"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={[
                "rounded-full border px-3 py-2 text-sm transition",
                filter === item.key
                  ? "border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:border-white/30",
              ].join(" ")}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {!filteredItems.length ? (
          <Card variant="subtle" className="rounded-[28px]">
            <div className="space-y-2">
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                No candidates in this review lane
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                The workbench is intentionally empty here instead of inventing hidden
                review work.
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
            <Card variant="surface" className="rounded-[28px]">
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLocalSelectedId(item.id)}
                    className={[
                      "w-full rounded-[22px] border px-4 py-4 text-left transition",
                      s(selected?.id) === s(item.id)
                        ? "border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-200/80 bg-white/80 text-slate-800 hover:border-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/30",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneForBucket(item.queueBucket)} variant="subtle" dot>
                        {titleize(item.queueBucket || "pending")}
                      </Badge>
                      <Badge
                        tone={toneForRisk(item.approvalPolicy?.riskLevel)}
                        variant="subtle"
                      >
                        {titleize(item.approvalPolicy?.riskLevel || "unknown")} risk
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm opacity-80">
                      {item.source?.displayName || "Unknown source"} ·{" "}
                      {titleize(item.category || "candidate")}
                    </div>
                    <div className="mt-2 text-xs opacity-75">
                      {item.approvalPolicy?.outcome
                        ? `${titleize(item.approvalPolicy.outcome)} · ${titleize(
                            item.approvalPolicy.requiredRole || "reviewer"
                          )}`
                        : "Policy telemetry unavailable"}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {selected ? (
              <Card variant="surface" className="rounded-[28px]">
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={toneForBucket(selected.queueBucket)} variant="subtle" dot>
                          {titleize(selected.queueBucket || "pending")}
                        </Badge>
                        <Badge
                          tone={toneForRisk(selected.approvalPolicy?.riskLevel)}
                          variant="subtle"
                          dot
                        >
                          {titleize(selected.approvalPolicy?.riskLevel || "unknown")}
                        </Badge>
                        <Badge tone="neutral" variant="subtle">
                          {selected.confidence?.label
                            ? `${titleize(selected.confidence.label)} ${Math.round(
                                n(selected.confidence.score) * 100
                              )}%`
                            : "Confidence unavailable"}
                        </Badge>
                      </div>
                      <div className="text-[24px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                        {selected.title}
                      </div>
                      <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {selected.valueText || "Candidate value unavailable."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {arr(selected.actions).map((action) => (
                        <Button
                          key={action.actionType}
                          variant={action.actionType === "reject" ? "secondary" : "primary"}
                          disabled={!canManage || action.allowed === false || surface.saving}
                          onClick={() => onRunAction?.(selected, action)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card
                      variant="subtle"
                      className="rounded-[24px]"
                      tone={toneForRisk(selected.approvalPolicy?.riskLevel)}
                    >
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Approval Policy
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {titleize(selected.approvalPolicy?.outcome || "review_required")}
                        </div>
                        <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                          Required role:{" "}
                          {titleize(selected.approvalPolicy?.requiredRole || "reviewer")}
                        </div>
                        <ChipList
                          items={selected.approvalPolicy?.reasonCodes}
                          empty="No explicit reason codes were returned."
                        />
                      </div>
                    </Card>

                    <Card variant="subtle" className="rounded-[24px]">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Trust and Freshness
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {titleize(
                            selected.source?.trustLabel ||
                              selected.source?.trustTier ||
                              "unknown"
                          )}
                        </div>
                        <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                          Freshness{" "}
                          {titleize(selected.governance?.freshness?.bucket || "unknown")} ·{" "}
                          {n(selected.governance?.support?.uniqueSourceCount)} source
                          {n(selected.governance?.support?.uniqueSourceCount) === 1
                            ? ""
                            : "s"}
                        </div>
                        <ChipList
                          items={selected.governance?.reviewExplanation}
                          empty="No trust/freshness explanation was returned."
                        />
                      </div>
                    </Card>
                  </div>

                  {!canManage ? (
                    <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                      This workbench is read-only for your account. The review model is
                      still shown so policy, trust, and impact remain visible before
                      action is delegated.
                    </div>
                  ) : null}

                  {arr(selected.actions).some(
                    (action) => action.allowed === false && action.unavailableReason
                  ) ? (
                    <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                      {
                        arr(selected.actions).find(
                          (action) =>
                            action.allowed === false && action.unavailableReason
                        )?.unavailableReason
                      }
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Change Impact Simulator
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        This publish preview shows the likely canonical, runtime, and
                        channel consequences before a truth-review approval is committed.
                      </div>
                    </div>

                    <PreviewDeltaStrip preview={selected.publishPreview} />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card variant="subtle" className="rounded-[24px]">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Current Approved Value
                          </div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {selected.publishPreview?.values?.currentApprovedValue?.title ||
                              selected.currentTruth?.title ||
                              "Unavailable"}
                          </div>
                          <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {selected.publishPreview?.values?.currentApprovedValue
                              ?.valueText ||
                              selected.currentTruth?.valueText ||
                              "No approved value was available for comparison."}
                          </div>
                        </div>
                      </Card>
                      <Card variant="subtle" className="rounded-[24px]">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Proposed Value
                          </div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {selected.publishPreview?.values?.proposedValue?.title ||
                              selected.title}
                          </div>
                          <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                            {selected.publishPreview?.values?.proposedValue?.valueText ||
                              selected.valueText ||
                              "Unavailable"}
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card variant="subtle" className="rounded-[24px]">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Preview Guidance
                          </div>
                          <ChipList
                            items={selected.publishPreview?.guidance?.likelyAffectedAreas}
                            empty="Likely affected areas are unavailable."
                          />
                          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Preview confidence:{" "}
                            {titleize(selected.publishPreview?.guidance?.confidence || "unknown")}
                          </div>
                        </div>
                      </Card>
                      <Card variant="subtle" className="rounded-[24px]">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Readiness Implications
                          </div>
                          <ChipList
                            items={
                              selected.publishPreview?.guidance?.likelyReadinessImplications
                            }
                            empty="No readiness implication could be inferred safely."
                          />
                        </div>
                      </Card>
                    </div>
                  </div>

                  {selected.conflictResolution ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Conflict Resolution
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          Competing values are shown side by side so operators can compare
                          which option would change more, affect different surfaces, or
                          carry higher operational risk.
                        </div>
                      </div>
                      {comparisonChoices.length ? (
                        <div className="flex flex-wrap gap-2">
                          {comparisonChoices.map((choice) => (
                            <button
                              key={choice.candidateId}
                              type="button"
                              onClick={() =>
                                setLocalComparisonChoiceId(choice.candidateId)
                              }
                              className={[
                                "rounded-full border px-3 py-2 text-sm transition",
                                s(choice.candidateId) === s(selectedComparison?.candidateId)
                                  ? "border-slate-900 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:border-white/30",
                              ].join(" ")}
                            >
                              {choice.title || "Candidate"} option
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-3">
                        {selected.conflictResolution.peers.map((peer) => (
                          <div
                            key={peer.id}
                            className="rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="warn" variant="subtle" dot>
                                Competing value
                              </Badge>
                              <Badge tone="neutral" variant="subtle">
                                {titleize(peer.trustTier || "unknown")}
                              </Badge>
                              <Badge tone="neutral" variant="subtle">
                                {titleize(peer.freshnessBucket || "unknown")}
                              </Badge>
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                              {peer.title}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                              {peer.valueText || "Unavailable"}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {peer.sourceDisplayName || "Unknown source"} ·{" "}
                              {Math.round(n(peer.confidence) * 100)}% confidence
                            </div>
                            <div className="mt-3">
                              <ChipList
                                items={peer.whyStrongerOrWeaker}
                                empty="No peer-strength explanation returned."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedComparison ? (
                        <Card variant="subtle" className="rounded-[24px]">
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              If {selectedComparison.title || "this option"} wins
                            </div>
                            <PreviewDeltaStrip preview={selectedComparison.publishPreview} />
                            <ImpactGrid preview={selectedComparison.publishPreview} />
                          </div>
                        </Card>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        Finalize Impact Preview
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        This is the deterministic preview of which canonical and runtime
                        areas could move if the candidate becomes approved truth.
                      </div>
                    </div>
                    <ImpactGrid
                      preview={
                        selected.publishPreview ||
                        selected.finalizeImpactPreview ||
                        selected.impactPreview
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card variant="subtle" className="rounded-[24px]">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Review State
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {selected.review?.reviewReason ||
                            "No explicit review reason was returned."}
                        </div>
                        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          First seen {formatWhen(selected.review?.firstSeenAt)} · Updated{" "}
                          {formatWhen(selected.review?.updatedAt)}
                        </div>
                      </div>
                    </Card>
                    <Card variant="subtle" className="rounded-[24px]">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Audit Context
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {selected.auditContext?.latestAction
                            ? `${titleize(selected.auditContext.latestAction)} · ${titleize(
                                selected.auditContext.latestDecision || "recorded"
                              )}`
                            : "No prior approval decision is recorded for this candidate."}
                        </div>
                        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {selected.auditContext?.latestBy
                            ? `${selected.auditContext.latestBy} · ${formatWhen(
                                selected.auditContext.latestAt
                              )}`
                            : "Audit context unavailable."}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}