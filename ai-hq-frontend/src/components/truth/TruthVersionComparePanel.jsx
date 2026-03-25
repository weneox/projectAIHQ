import FocusDialog from "../ui/FocusDialog.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
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

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Truth version compare"
      backdropClassName="bg-[rgba(15,23,42,.18)] backdrop-blur-[12px]"
      panelClassName="w-full max-w-[960px]"
    >
      <div className="rounded-[28px] border border-slate-200/80 bg-[rgba(249,250,251,.98)] shadow-[0_32px_80px_-36px_rgba(15,23,42,.28)]">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Truth compare
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
            Version detail
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Review canonical truth changes without dropping into a noisy admin diff.
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
              <div className="grid gap-4 lg:grid-cols-2">
                <VersionSummary
                  title="Selected version"
                  version={detail?.selectedVersion || {}}
                />
                <VersionSummary
                  title="Compared against"
                  version={detail?.comparedVersion || {}}
                />
              </div>

              {s(detail?.diffSummary) ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700">
                  {detail.diffSummary}
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
