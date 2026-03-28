import FocusDialog from "../ui/FocusDialog.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function toneForRollback(value = "") {
  switch (s(value).toLowerCase()) {
    case "safe":
      return "success";
    case "follow_up_required":
      return "warn";
    case "review_required":
      return "danger";
    default:
      return "neutral";
  }
}

function MetaRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-700">{value}</div>
    </div>
  );
}

function ChipList({ items = [], empty = "Unavailable" }) {
  const safeItems = arr(items).map((item) => s(item)).filter(Boolean);
  if (!safeItems.length) {
    return <div className="text-sm text-slate-500">{empty}</div>;
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

function VersionSummary({ title, version = {} }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/84 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-base font-semibold tracking-[-0.02em] text-slate-900">
        {s(version.versionLabel) || "Truth version"}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <MetaRow label="Version" value={version.version} />
        <MetaRow label="Status" value={version.profileStatus} />
        <MetaRow label="Approved at" value={version.approvedAt} />
        <MetaRow label="Approved by" value={version.approvedBy} />
      </div>
      {s(version.sourceSummary) ? (
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Source context: {version.sourceSummary}
        </div>
      ) : null}
    </div>
  );
}

export default function TruthVersionComparePanel({
  open = false,
  onClose,
  loading = false,
  error = "",
  detail = null,
  versions = [],
  onSelectVersion,
  rollbackSurface = {},
  onRollback,
}) {
  const changedFields = Array.isArray(detail?.changedFields) ? detail.changedFields : [];
  const fieldChanges = Array.isArray(detail?.fieldChanges) ? detail.fieldChanges : [];
  const sectionChanges = Array.isArray(detail?.sectionChanges) ? detail.sectionChanges : [];
  const versionDiff = detail?.versionDiff || {};
  const rollbackPreview = detail?.rollbackPreview || {};
  const rollbackAction = detail?.rollbackAction || rollbackPreview?.action || {};
  const rollbackReceipt = rollbackSurface?.rollbackReceipt || detail?.rollbackReceipt || null;

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Truth version compare"
      backdropClassName="bg-[rgba(15,23,42,.18)] backdrop-blur-[12px]"
      panelClassName="w-full max-w-[1180px]"
    >
      <div className="rounded-[28px] border border-slate-200/80 bg-[rgba(249,250,251,.98)] shadow-[0_32px_80px_-36px_rgba(15,23,42,.28)]">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Truth compare
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
            Version detail and rollback preview
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Compare approved truth versions, inspect governed differences, and understand rollback consequences before any revert path is used.
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-4 text-sm text-slate-500">
              Loading truth version detail...
            </div>
          ) : null}

          {!loading && s(error) ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50/90 px-4 py-4 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}

          {!loading && !s(error) ? (
            <div className="space-y-5">
              {arr(versions).length ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Recent versions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {arr(versions).slice(0, 8).map((version) => (
                      <button
                        key={s(version.id || version.version)}
                        type="button"
                        onClick={() => onSelectVersion?.(version)}
                        className={[
                          "rounded-full border px-3 py-2 text-sm transition",
                          s(version.id) === s(detail?.selectedVersion?.id)
                            ? "border-slate-900 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                        ].join(" ")}
                      >
                        {s(version.versionLabel || version.version || version.id || "Version")}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-3">
                <VersionSummary title="Selected version" version={detail?.selectedVersion || {}} />
                <VersionSummary title="Compared against" version={detail?.comparedVersion || {}} />
                <VersionSummary title="Current approved" version={detail?.currentVersion || {}} />
              </div>

              {s(detail?.diffSummary) ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700">
                  {detail.diffSummary}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Version diff
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {s(versionDiff.summaryExplanation) ||
                      "Structured version-diff guidance is unavailable for this selection."}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Canonical areas changed
                      </div>
                      <div className="mt-2">
                        <ChipList
                          items={versionDiff.canonicalAreasChanged}
                          empty="No canonical areas were exposed."
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Runtime areas likely affected
                      </div>
                      <div className="mt-2">
                        <ChipList
                          items={versionDiff.runtimeAreasLikelyAffected}
                          empty="Runtime impact is unavailable."
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Canonical paths
                      </div>
                      <div className="mt-2">
                        <ChipList
                          items={versionDiff.canonicalPathsChanged}
                          empty="No canonical paths were returned."
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Affected surfaces
                      </div>
                      <div className="mt-2">
                        <ChipList
                          items={versionDiff.affectedSurfaces}
                          empty="Affected surfaces are unavailable."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="info" variant="subtle" dot>
                      {titleize(versionDiff.autonomyImpact || "unknown")} autonomy impact
                    </Badge>
                    <Badge tone="neutral" variant="subtle">
                      {versionDiff.valueSummary?.added || 0} added
                    </Badge>
                    <Badge tone="neutral" variant="subtle">
                      {versionDiff.valueSummary?.removed || 0} removed
                    </Badge>
                    <Badge tone="neutral" variant="subtle">
                      {versionDiff.valueSummary?.changed || 0} changed
                    </Badge>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Rollback preview
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {s(rollbackPreview.summaryExplanation) ||
                          "Rollback preview telemetry is unavailable for this version."}
                      </div>
                    </div>
                    <Badge tone={toneForRollback(rollbackPreview.rollbackDisposition)} variant="subtle" dot>
                      {titleize(rollbackPreview.rollbackDisposition || "unknown")}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Canonical truth reverts
                      </div>
                      <div className="mt-2">
                        <ChipList
                          items={rollbackPreview.canonicalPathsChangedBack}
                          empty="No rollback field changes were exposed."
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Runtime and surfaces
                      </div>
                      <div className="mt-2 space-y-2">
                        <ChipList
                          items={rollbackPreview.runtimeAreasLikelyAffected}
                          empty="Runtime rollback impact is unavailable."
                        />
                        <ChipList
                          items={rollbackPreview.affectedSurfaces}
                          empty="Channel rollback impact is unavailable."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={toneForRollback(rollbackPreview.rollbackDisposition)} variant="subtle" dot>
                      {titleize(rollbackPreview.postureImpact?.autonomyDelta || "unknown")} posture
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Readiness implications
                    </div>
                    <div className="mt-2">
                      <ChipList
                        items={rollbackPreview.readinessImplications}
                        empty="No readiness implication could be inferred safely."
                      />
                    </div>
                  </div>
                  <div className="mt-4 rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-3 py-3">
                    <div className="text-xs leading-5 text-slate-600">
                      {s(rollbackAction?.reason) ||
                        "Rollback action telemetry is unavailable."}
                    </div>
                    {s(rollbackSurface?.error) ? (
                      <div className="mt-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                        {rollbackSurface.error}
                      </div>
                    ) : null}
                    {s(rollbackSurface?.saveSuccess) ? (
                      <div className="mt-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                        {rollbackSurface.saveSuccess}
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={rollbackSurface?.saving}
                        disabled={!rollbackAction?.allowed}
                        onClick={() => onRollback?.(detail)}
                      >
                        {s(rollbackAction?.label) || "Rollback preview only"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {rollbackReceipt ? (
                <div className="rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Rollback receipt
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {s(rollbackReceipt.summaryExplanation) ||
                          "Rollback verification detail is unavailable."}
                      </div>
                    </div>
                    <Badge
                      tone={toneForRollback(rollbackReceipt.rollbackStatus)}
                      variant="subtle"
                      dot
                    >
                      {titleize(rollbackReceipt.rollbackStatus || "unknown")}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <VersionSummary
                      title="Source current"
                      version={rollbackReceipt.sourceCurrentVersion || {}}
                    />
                    <VersionSummary
                      title="Rollback target"
                      version={rollbackReceipt.targetRollbackVersion || {}}
                    />
                    <VersionSummary
                      title="Resulting version"
                      version={rollbackReceipt.resultingTruthVersion || {}}
                    />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Actual canonical impact
                      </div>
                      <div className="mt-2 space-y-2">
                        <ChipList
                          items={rollbackReceipt.actual?.canonical?.areas}
                          empty="Canonical rollback impact is unavailable."
                        />
                        <ChipList
                          items={rollbackReceipt.actual?.canonical?.paths}
                          empty="Canonical rollback paths are unavailable."
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Runtime and surfaces
                      </div>
                      <div className="mt-2 space-y-2">
                        <ChipList
                          items={rollbackReceipt.actual?.runtime?.areas}
                          empty="Runtime rollback verification is unavailable."
                        />
                        <ChipList
                          items={rollbackReceipt.actual?.channels?.affectedSurfaces}
                          empty="Affected surfaces are unavailable."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Preview vs actual
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="neutral" variant="subtle">
                        {titleize(rollbackReceipt.previewComparison?.status || "unknown")}
                      </Badge>
                      <Badge tone="neutral" variant="subtle">
                        Runtime {titleize(rollbackReceipt.runtimeRefreshResult || "unknown")}
                      </Badge>
                      <Badge tone="neutral" variant="subtle">
                        Truth version {rollbackReceipt.resultingTruthVersionId || "unknown"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-xs leading-5 text-slate-600">
                      {rollbackReceipt.verification?.runtimeControlWarnings?.join(" ") ||
                        s(rollbackReceipt.verification?.repairRecommendation) ||
                        "No runtime warnings were reported for this rollback receipt."}
                    </div>
                  </div>
                </div>
              ) : null}

              {changedFields.length ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Changed fields
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {changedFields.map((field) => (
                      <div
                        key={field.key || field.label}
                        className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {s(field.label || field.key)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {fieldChanges.length ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Field summaries
                  </div>
                  {fieldChanges.map((change) => (
                    <div
                      key={change.key || change.label}
                      className="rounded-[20px] border border-slate-200/80 bg-white/84 px-4 py-4"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {s(change.label || change.key)}
                      </div>
                      {s(change.summary) ? (
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {change.summary}
                        </div>
                      ) : null}
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[16px] border border-slate-200/70 bg-slate-50/80 px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Before
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-700">
                            {s(change.beforeSummary) || "Not returned by backend"}
                          </div>
                        </div>
                        <div className="rounded-[16px] border border-slate-200/70 bg-slate-50/80 px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            After
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-700">
                            {s(change.afterSummary) || "Not returned by backend"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {sectionChanges.length ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Section summaries
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {sectionChanges.map((change) => (
                      <div
                        key={change.key || change.label}
                        className="rounded-[18px] border border-slate-200/80 bg-white/84 px-4 py-3"
                      >
                        <div className="text-sm font-medium text-slate-900">
                          {s(change.label || change.key)}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {s(change.summary) || "No additional section summary was returned."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!detail?.hasStructuredDiff ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
                  The backend did not return structured diff detail for this version comparison.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </FocusDialog>
  );
}
