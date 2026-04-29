import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function SectionTitle({ eyebrow = "Behavior", title, subtitle }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {eyebrow}
      </div>

      <div className="mt-2 text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        {title}
      </div>

      {s(subtitle) ? (
        <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function EmptyText({ children }) {
  return (
    <div className="mt-3 rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3 text-[13.5px] font-medium leading-6 text-text-muted">
      {children}
    </div>
  );
}

export default function TruthBehaviorCard({
  title = "Behavior profile",
  subtitle = "",
  rows = [],
  compact = false,
  emptyMessage = "No approved behavior profile was returned by the backend.",
}) {
  const safeRows = arr(rows).filter((row) => s(row?.label) && s(row?.value));

  return (
    <Card padded="sm">
      <SectionTitle title={title} subtitle={subtitle} />

      {safeRows.length ? (
        <div
          className={[
            "mt-4 grid gap-3",
            compact ? "md:grid-cols-1" : "md:grid-cols-2",
          ].join(" ")}
        >
          {safeRows.map((row) => (
            <div
              key={row.key}
              className="rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                {row.label}
              </div>

              <div className="mt-2 text-[13.5px] font-medium leading-6 text-text">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyText>{emptyMessage}</EmptyText>
      )}
    </Card>
  );
}

export function TruthBehaviorChangesCard({
  title = "Behavior changes",
  changes = [],
  emptyMessage = "No behavior changes were returned for this comparison.",
}) {
  const safeChanges = arr(changes).filter(
    (item) => s(item?.label) || s(item?.beforeSummary) || s(item?.afterSummary)
  );

  return (
    <Card padded="sm">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle
          eyebrow="Delta"
          title={title}
          subtitle={
            safeChanges.length
              ? "Behavior deltas are shown explicitly so operators can see how runtime behavior shifted."
              : emptyMessage
          }
        />

        {safeChanges.length ? (
          <Badge tone="brand" size="sm">
            {safeChanges.length} changed
          </Badge>
        ) : null}
      </div>

      {safeChanges.length ? (
        <div className="mt-4 space-y-3">
          {safeChanges.map((change) => (
            <div
              key={change.key}
              className="rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3"
            >
              <div className="text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                {change.label}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Before
                  </div>

                  <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                    {s(change.beforeSummary) || "Not set"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    After
                  </div>

                  <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                    {s(change.afterSummary) || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}