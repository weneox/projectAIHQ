function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

export default function TruthHistoryPanel({ history = [], onOpenVersion }) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        History
      </div>
      <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
        Truth version timeline
      </div>

      {Array.isArray(history) && history.length ? (
        <div className="mt-4 space-y-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className="relative border-t border-slate-200/70 pl-5 pt-4 first:border-t-0 first:pt-0"
            >
              <div className="absolute left-0 top-6 h-2.5 w-2.5 rounded-full bg-slate-300 first:top-2.5" />
              {index < history.length - 1 ? (
                <div className="absolute bottom-[-18px] left-[4px] top-8 w-px bg-slate-200/80" />
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="text-sm font-medium text-slate-800">
                  {s(item.versionLabel) || "Truth version"}
                </div>
                {s(item.version) ? (
                  <div className="rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {item.version}
                  </div>
                ) : null}
                {s(item.profileStatus) ? (
                  <div className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {item.profileStatus}
                  </div>
                ) : null}
                {Number(item.changedFieldCount) > 0 ? (
                  <div className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {item.changedFieldCount} changed
                  </div>
                ) : null}
              </div>

              <div className="mt-1 text-sm leading-6 text-slate-600">
                {[s(item.approvedAt), s(item.approvedBy)].filter(Boolean).join(" · ") ||
                  "Approval metadata was not returned for this version."}
              </div>

              {s(item.sourceSummary) ? (
                <div className="mt-2 text-sm leading-6 text-slate-500">
                  Source context: {item.sourceSummary}
                </div>
              ) : null}

              {s(item.diffSummary) ? (
                <div className="mt-2 rounded-[18px] border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm leading-6 text-slate-600">
                  Changed fields: {item.diffSummary}
                </div>
              ) : null}

              {s(item.behaviorSummary) ? (
                <div className="mt-2 rounded-[18px] border border-cyan-200/70 bg-cyan-50/70 px-3 py-2 text-sm leading-6 text-cyan-900">
                  Behavior snapshot: {item.behaviorSummary}
                </div>
              ) : null}

              {arr(item.behaviorChanges).length ? (
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Behavior changes:{" "}
                  {arr(item.behaviorChanges)
                    .map((change) => s(change.label))
                    .filter(Boolean)
                    .join(", ")}
                </div>
              ) : null}

              {arr(item.finalizeImpact?.affectedSurfaces).length ? (
                <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Affected surfaces: {arr(item.finalizeImpact.affectedSurfaces).join(", ")}
                </div>
              ) : null}

              {s(item.governance?.conflict?.classification) ? (
                <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Conflict outcome: {s(item.governance.conflict.classification).replace(/[_-]+/g, " ")}
                </div>
              ) : null}

              {typeof onOpenVersion === "function" && s(item.id) ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onOpenVersion(item)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/84 px-3.5 text-xs font-medium text-slate-700 transition hover:bg-white"
                  >
                    View compare
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm leading-6 text-slate-600">
          The backend did not return canonical truth version history for this snapshot.
        </div>
      )}
    </section>
  );
}
