import { normalizeSetupReviewRoom } from "../../lib/setupReviewRoom.js";

function toneClass(tone = "neutral") {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-slate-50 text-slate-900";
}

function statusLabel(status = "") {
  return String(status || "missing").replace(/_/g, " ");
}

export default function SetupReviewRoomSurface({ reviewRoom = {} }) {
  const room = normalizeSetupReviewRoom(reviewRoom);
  const headerTone = toneClass(room.header.badgeTone);
  const blockingIssues = room.issues.filter((issue) => issue.severity === "blocking");

  return (
    <section
      aria-label="AI setup review room"
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${headerTone}`}>
              {room.header.statusLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {room.runtimeAuthority}
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {room.header.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{room.header.subtitle}</p>
          <p className="mt-3 text-xs font-medium text-slate-500">{room.header.trustNote}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {room.header.primaryMessage || room.actions.primary.label}
          </p>
          <button
            type="button"
            disabled={!room.actions.primary.enabled}
            className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {room.actions.primary.label}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Review sections</h3>
            <span className="text-xs font-medium text-slate-500">
              {room.sections.length} sections
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {room.sections.map((section) => (
              <div
                key={section.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {section.itemCount} item{section.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {statusLabel(section.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Runtime readiness</h3>
          <p className="mt-1 text-xs text-slate-500">
            Widget, inbox, voice and automations require approved truth.
          </p>

          <div className="mt-4 space-y-2">
            {room.runtimeConsumers.consumers.map((consumer) => (
              <div key={consumer.key} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{consumer.label}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {statusLabel(consumer.currentState)}
                  </span>
                </div>
                {consumer.description ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{consumer.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {blockingIssues.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-950">Needs attention</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {blockingIssues.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
