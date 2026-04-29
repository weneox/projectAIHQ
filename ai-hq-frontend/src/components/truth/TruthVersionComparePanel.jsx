import FocusDialog from "../ui/FocusDialog.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import TruthBehaviorCard, {
  TruthBehaviorChangesCard,
} from "./TruthBehaviorCard.jsx";

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
    case "review_required":
      return "warning";
    case "blocked":
    case "danger":
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

function toneForImpact(value = "") {
  const safe = s(value).toLowerCase();

  if (["low", "safe", "none", "ready"].includes(safe)) return "success";
  if (["medium", "review", "follow_up_required", "unknown"].includes(safe)) {
    return "warning";
  }
  if (["high", "blocked", "danger", "error"].includes(safe)) return "danger";

  return "neutral";
}

function Dot({ tone = "neutral" }) {
  const className =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-danger"
          : tone === "brand" || tone === "info"
            ? "bg-brand"
            : "bg-[rgb(var(--color-text-soft))]";

  return <span className={["h-1.5 w-1.5 rounded-full", className].join(" ")} />;
}

function StatusBadge({ tone = "neutral", children }) {
  return (
    <Badge tone={tone} size="sm">
      <Dot tone={tone} />
      {children}
    </Badge>
  );
}

function MetaRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
        {label}
      </div>

      <div className="mt-1 text-[13.5px] font-medium leading-6 text-text">
        {value}
      </div>
    </div>
  );
}

function ChipList({ items = [], empty = "Unavailable" }) {
  const safeItems = arr(items)
    .map((item) => s(item))
    .filter(Boolean);

  if (!safeItems.length) {
    return <div className="text-[13px] font-medium leading-6 text-text-muted">{empty}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {safeItems.map((item) => (
        <Badge key={item} tone="neutral" size="sm">
          {titleize(item)}
        </Badge>
      ))}
    </div>
  );
}

function VersionSummary({ title, version = {} }) {
  return (
    <Card padded="sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {title}
      </div>

      <div className="mt-2 text-[16px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        {s(version.versionLabel) || "Truth version"}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MetaRow label="Version" value={version.version} />
        <MetaRow label="Status" value={version.profileStatus} />
        <MetaRow label="Approved at" value={version.approvedAt} />
        <MetaRow label="Approved by" value={version.approvedBy} />
      </div>

      {s(version.sourceSummary) ? (
        <div className="mt-4 rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3 text-[13px] font-medium leading-6 text-text-muted">
          Source context: {version.sourceSummary}
        </div>
      ) : null}
    </Card>
  );
}

function SectionHeader({ eyebrow, title, description, right = null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            {eyebrow}
          </div>
        ) : null}

        <div className="mt-1 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {title}
        </div>

        {description ? (
          <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
            {description}
          </div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function TwoColumnChipBlock({
  leftTitle,
  leftItems,
  leftEmpty,
  rightTitle,
  rightItems,
  rightEmpty,
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          {leftTitle}
        </div>

        <div className="mt-2">
          <ChipList items={leftItems} empty={leftEmpty} />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          {rightTitle}
        </div>

        <div className="mt-2">
          <ChipList items={rightItems} empty={rightEmpty} />
        </div>
      </div>
    </div>
  );
}

function VersionDiffCard({ versionDiff = {} }) {
  return (
    <Card padded="sm">
      <SectionHeader
        eyebrow="Version diff"
        title="Canonical and runtime impact"
        description={
          s(versionDiff.summaryExplanation) ||
          "Structured version-diff guidance is unavailable for this selection."
        }
      />

      <TwoColumnChipBlock
        leftTitle="Canonical areas changed"
        leftItems={versionDiff.canonicalAreasChanged}
        leftEmpty="No canonical areas were exposed."
        rightTitle="Runtime areas likely affected"
        rightItems={versionDiff.runtimeAreasLikelyAffected}
        rightEmpty="Runtime impact is unavailable."
      />

      <TwoColumnChipBlock
        leftTitle="Canonical paths"
        leftItems={versionDiff.canonicalPathsChanged}
        leftEmpty="No canonical paths were returned."
        rightTitle="Affected surfaces"
        rightItems={versionDiff.affectedSurfaces}
        rightEmpty="Affected surfaces are unavailable."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone={toneForImpact(versionDiff.autonomyImpact)}>
          {titleize(versionDiff.autonomyImpact || "unknown")} autonomy impact
        </StatusBadge>

        <Badge tone="neutral" size="sm">
          {versionDiff.valueSummary?.added || 0} added
        </Badge>

        <Badge tone="neutral" size="sm">
          {versionDiff.valueSummary?.removed || 0} removed
        </Badge>

        <Badge tone="neutral" size="sm">
          {versionDiff.valueSummary?.changed || 0} changed
        </Badge>
      </div>
    </Card>
  );
}

function RollbackPreviewCard({
  rollbackPreview = {},
  rollbackAction = {},
  rollbackSurface = {},
  onRollback,
  detail,
}) {
  const rollbackTone = toneForRollback(rollbackPreview.rollbackDisposition);

  return (
    <Card padded="sm" tone={rollbackTone}>
      <SectionHeader
        eyebrow="Rollback preview"
        title="Restore impact"
        description={
          s(rollbackPreview.summaryExplanation) ||
          "Rollback preview telemetry is unavailable for this version."
        }
        right={
          <StatusBadge tone={rollbackTone}>
            {titleize(rollbackPreview.rollbackDisposition || "unknown")}
          </StatusBadge>
        }
      />

      <TwoColumnChipBlock
        leftTitle="Canonical truth reverts"
        leftItems={rollbackPreview.canonicalPathsChangedBack}
        leftEmpty="No rollback field changes were exposed."
        rightTitle="Runtime areas"
        rightItems={rollbackPreview.runtimeAreasLikelyAffected}
        rightEmpty="Runtime rollback impact is unavailable."
      />

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Affected surfaces
        </div>

        <div className="mt-2">
          <ChipList
            items={rollbackPreview.affectedSurfaces}
            empty="Channel rollback impact is unavailable."
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Readiness implications
        </div>

        <div className="mt-2">
          <ChipList
            items={rollbackPreview.readinessImplications}
            empty="No readiness implication could be inferred safely."
          />
        </div>
      </div>

      <div className="mt-4 rounded-[14px] border border-line-soft bg-surface px-4 py-3">
        <div className="text-[12.5px] font-medium leading-5 text-text-muted">
          {s(rollbackAction?.reason) || "Rollback action telemetry is unavailable."}
        </div>

        {s(rollbackSurface?.error) ? (
          <div className="mt-3">
            <InlineNotice tone="danger" description={rollbackSurface.error} compact />
          </div>
        ) : null}

        {s(rollbackSurface?.saveSuccess) ? (
          <div className="mt-3">
            <InlineNotice
              tone="success"
              description={rollbackSurface.saveSuccess}
              compact
            />
          </div>
        ) : null}

        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            loading={rollbackSurface?.saving}
            disabled={!rollbackAction?.allowed}
            onClick={() => onRollback?.(detail)}
          >
            {s(rollbackAction?.label) || "Rollback preview only"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RollbackReceiptCard({ rollbackReceipt = {} }) {
  const receiptTone = toneForRollback(rollbackReceipt.rollbackStatus);

  return (
    <Card padded="sm" tone={receiptTone}>
      <SectionHeader
        eyebrow="Rollback receipt"
        title="Rollback verification"
        description={
          s(rollbackReceipt.summaryExplanation) ||
          "Rollback verification detail is unavailable."
        }
        right={
          <StatusBadge tone={receiptTone}>
            {titleize(rollbackReceipt.rollbackStatus || "unknown")}
          </StatusBadge>
        }
      />

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

      <TwoColumnChipBlock
        leftTitle="Actual canonical impact"
        leftItems={rollbackReceipt.actual?.canonical?.areas}
        leftEmpty="Canonical rollback impact is unavailable."
        rightTitle="Runtime impact"
        rightItems={rollbackReceipt.actual?.runtime?.areas}
        rightEmpty="Runtime rollback verification is unavailable."
      />

      <TwoColumnChipBlock
        leftTitle="Canonical paths"
        leftItems={rollbackReceipt.actual?.canonical?.paths}
        leftEmpty="Canonical rollback paths are unavailable."
        rightTitle="Affected surfaces"
        rightItems={rollbackReceipt.actual?.channels?.affectedSurfaces}
        rightEmpty="Affected surfaces are unavailable."
      />

      <div className="mt-4 rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Preview vs actual
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral" size="sm">
            {titleize(rollbackReceipt.previewComparison?.status || "unknown")}
          </Badge>

          <Badge tone="neutral" size="sm">
            Runtime {titleize(rollbackReceipt.runtimeRefreshResult || "unknown")}
          </Badge>

          <Badge tone="neutral" size="sm">
            Truth version {rollbackReceipt.resultingTruthVersionId || "unknown"}
          </Badge>
        </div>

        <div className="mt-3 text-[12.5px] font-medium leading-5 text-text-muted">
          {rollbackReceipt.verification?.runtimeControlWarnings?.join(" ") ||
            s(rollbackReceipt.verification?.repairRecommendation) ||
            "No runtime warnings were reported for this rollback receipt."}
        </div>
      </div>
    </Card>
  );
}

function ChangedFieldsCard({ changedFields = [] }) {
  if (!changedFields.length) return null;

  return (
    <Card padded="sm">
      <SectionHeader
        eyebrow="Changed fields"
        title="Fields touched by this version"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {changedFields.map((field) => (
          <Badge key={field.key || field.label} tone="neutral" size="sm">
            {s(field.label || field.key)}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function FieldSummariesCard({ fieldChanges = [] }) {
  if (!fieldChanges.length) return null;

  return (
    <Card padded="sm">
      <SectionHeader
        eyebrow="Field summaries"
        title="Before and after"
      />

      <div className="mt-4 space-y-3">
        {fieldChanges.map((change) => (
          <div
            key={change.key || change.label}
            className="rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3"
          >
            <div className="text-[13.5px] font-semibold text-text">
              {s(change.label || change.key)}
            </div>

            {s(change.summary) ? (
              <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                {change.summary}
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Before
                </div>

                <div className="mt-2 text-[13px] font-medium leading-6 text-text">
                  {s(change.beforeSummary) || "Not returned by backend"}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  After
                </div>

                <div className="mt-2 text-[13px] font-medium leading-6 text-text">
                  {s(change.afterSummary) || "Not returned by backend"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SectionSummariesCard({ sectionChanges = [] }) {
  if (!sectionChanges.length) return null;

  return (
    <Card padded="sm">
      <SectionHeader
        eyebrow="Section summaries"
        title="Grouped changes"
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {sectionChanges.map((change) => (
          <div
            key={change.key || change.label}
            className="rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3"
          >
            <div className="text-[13.5px] font-semibold text-text">
              {s(change.label || change.key)}
            </div>

            <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
              {s(change.summary) || "No additional section summary was returned."}
            </div>
          </div>
        ))}
      </div>
    </Card>
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
  const changedFields = Array.isArray(detail?.changedFields)
    ? detail.changedFields
    : [];
  const fieldChanges = Array.isArray(detail?.fieldChanges)
    ? detail.fieldChanges
    : [];
  const sectionChanges = Array.isArray(detail?.sectionChanges)
    ? detail.sectionChanges
    : [];
  const versionDiff = detail?.versionDiff || {};
  const rollbackPreview = detail?.rollbackPreview || {};
  const rollbackAction = detail?.rollbackAction || rollbackPreview?.action || {};
  const rollbackReceipt =
    rollbackSurface?.rollbackReceipt || detail?.rollbackReceipt || null;

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Business data version compare"
      backdropClassName="bg-[rgba(15,23,42,0.18)]"
      panelClassName="w-full max-w-[1180px]"
    >
      <div className="border-t border-line-soft bg-surface">
        <div className="border-b border-line-soft px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            Version compare
          </div>

          <div className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            Version details and rollback preview
          </div>

          <div className="mt-2 max-w-[780px] text-[13.5px] font-medium leading-6 text-text-muted">
            Compare approved business-data versions, review the differences,
            and understand rollback impact before restoring an older version.
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto bg-surface-muted px-6 py-5">
          {loading ? (
            <InlineNotice
              tone="info"
              description="Loading truth version detail..."
              compact
            />
          ) : null}

          {!loading && s(error) ? (
            <InlineNotice tone="danger" description={error} compact />
          ) : null}

          {!loading && !s(error) ? (
            <div className="space-y-5">
              {arr(versions).length ? (
                <Card padded="sm">
                  <SectionHeader
                    eyebrow="Recent versions"
                    title="Switch comparison target"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {arr(versions)
                      .slice(0, 8)
                      .map((version) => {
                        const active = s(version.id) === s(detail?.selectedVersion?.id);

                        return (
                          <button
                            key={s(version.id || version.version)}
                            type="button"
                            onClick={() => onSelectVersion?.(version)}
                            className={[
                              "inline-flex min-h-[34px] items-center rounded-[11px] border px-3 text-[12.5px] font-semibold transition-[background-color,border-color,color] duration-base ease-premium",
                              active
                                ? "border-[rgba(var(--color-brand),0.22)] bg-brand-soft text-brand"
                                : "border-line-soft bg-surface text-text-muted hover:border-line hover:bg-surface-subtle hover:text-text",
                            ].join(" ")}
                          >
                            {s(version.versionLabel || version.version || version.id || "Version")}
                          </button>
                        );
                      })}
                  </div>
                </Card>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-3">
                <VersionSummary
                  title="Selected version"
                  version={detail?.selectedVersion || {}}
                />
                <VersionSummary
                  title="Compared against"
                  version={detail?.comparedVersion || {}}
                />
                <VersionSummary
                  title="Current approved"
                  version={detail?.currentVersion || {}}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TruthBehaviorCard
                  title="Selected version behavior"
                  subtitle={
                    s(detail?.behavior?.selected?.summary) ||
                    "Behavior details were not returned for the selected version."
                  }
                  rows={detail?.behavior?.selected?.rows || []}
                  compact
                  emptyMessage="Selected-version behavior is unavailable."
                />

                <TruthBehaviorCard
                  title="Compared version behavior"
                  subtitle={
                    s(detail?.behavior?.compared?.summary) ||
                    "Behavior details were not returned for the compared version."
                  }
                  rows={detail?.behavior?.compared?.rows || []}
                  compact
                  emptyMessage="Compared-version behavior is unavailable."
                />
              </div>

              <TruthBehaviorChangesCard
                changes={detail?.behavior?.changes || []}
                emptyMessage="No explicit behavior delta was returned for this comparison."
              />

              {s(detail?.diffSummary) ? (
                <InlineNotice tone="info" description={detail.diffSummary} compact />
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <VersionDiffCard versionDiff={versionDiff} />

                <RollbackPreviewCard
                  rollbackPreview={rollbackPreview}
                  rollbackAction={rollbackAction}
                  rollbackSurface={rollbackSurface}
                  onRollback={onRollback}
                  detail={detail}
                />
              </div>

              {rollbackReceipt ? (
                <RollbackReceiptCard rollbackReceipt={rollbackReceipt} />
              ) : null}

              <ChangedFieldsCard changedFields={changedFields} />
              <FieldSummariesCard fieldChanges={fieldChanges} />
              <SectionSummariesCard sectionChanges={sectionChanges} />

              {!detail?.hasStructuredDiff ? (
                <InlineNotice
                  tone="warning"
                  description="The backend did not return structured diff detail for this version comparison."
                  compact
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </FocusDialog>
  );
}