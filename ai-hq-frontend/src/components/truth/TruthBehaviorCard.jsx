import Badge from "../ui/Badge.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
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
    <section className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Behavior
      </div>
      <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
        {title}
      </div>
      {s(subtitle) ? (
        <div className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</div>
      ) : null}

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
              className="rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-4 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {row.label}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-800">{row.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm leading-6 text-slate-600">{emptyMessage}</div>
      )}
    </section>
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
    <div className="rounded-[22px] border border-slate-200/80 bg-white/84 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Behavior changes
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            {safeChanges.length
              ? "Behavior deltas are shown explicitly so operators can see how runtime behavior shifted."
              : emptyMessage}
          </div>
        </div>
        {safeChanges.length ? (
          <Badge tone="info" variant="subtle" dot>
            {safeChanges.length} changed
          </Badge>
        ) : null}
      </div>

      {safeChanges.length ? (
        <div className="mt-4 space-y-3">
          {safeChanges.map((change) => (
            <div
              key={change.key}
              className="rounded-[18px] border border-slate-200/70 bg-slate-50/80 px-3 py-3"
            >
              <div className="text-sm font-medium text-slate-900">{change.label}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Before
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-700">
                    {s(change.beforeSummary) || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    After
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-700">
                    {s(change.afterSummary) || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
