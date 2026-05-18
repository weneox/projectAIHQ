import { normalizeSetupReviewRoom } from "../../lib/setupReviewRoom.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value = "", max = 160) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function labelize(value = "") {
  return s(value, "pending").replace(/_/g, " ");
}

function qualityCopy(value = "") {
  const key = lower(value);
  if (key === "strong") return "Mənbə yaxşıdır";
  if (key === "partial") return "Qismən oxundu";
  if (key === "conflicting") return "Ziddiyyət var";
  if (key === "missing") return "Mənbə gözləyir";
  return "Mənbə gözləyir";
}

function decisionCopy(value = "") {
  const key = lower(value);
  if (key === "approve_truth") return "Təsdiqə hazırdır";
  if (key === "answer_missing_facts") return "Bir neçə məlumat çatışır";
  if (key === "resolve_conflicts") return "Ziddiyyəti həll etmək lazımdır";
  if (key === "review_or_continue") return "Yoxlama mərhələsidir";
  return "Mənbə əlavə et";
}

function collectTruthFacts(room = {}) {
  const rows = [];

  for (const section of arr(room.sectionDetails)) {
    const title = s(section.title || section.label || section.key);
    for (const fact of arr(section.facts)) {
      const value = compactText(fact.value, 170);
      if (!value) continue;
      rows.push({
        key: `${section.key}-${fact.key || fact.label}`,
        label: s(fact.label || title),
        value,
        section: title,
        sourceBacked: section.sourceBacked === true,
      });
    }

    const items = arr(section.items).map((item) => compactText(item, 90)).filter(Boolean);
    if (items.length) {
      rows.push({
        key: `${section.key}-items`,
        label: title,
        value: items.slice(0, 6).join(", "),
        section: title,
        sourceBacked: section.sourceBacked === true,
      });
    }
  }

  if (rows.length) return rows.slice(0, 12);

  return arr(room.sections)
    .filter((section) => Number(section.itemCount || 0) > 0 || s(section.status) === "complete")
    .map((section) => ({
      key: s(section.key),
      label: s(section.label || section.key),
      value: `${Number(section.itemCount || 0)} məlumat`,
      section: s(section.label || section.key),
      sourceBacked: section.sourceBacked === true,
    }))
    .slice(0, 12);
}

function collectMissing(room = {}) {
  const brain = obj(room.brain);
  const missing = obj(brain.missingFactsPlan);

  const blockers = arr(room.issues)
    .filter((issue) => s(issue.severity) === "blocking")
    .map((issue) => ({
      key: s(issue.id || issue.section || issue.message),
      title: labelize(issue.section || issue.type),
      body: s(issue.message),
    }))
    .filter((item) => item.key || item.body);

  if (blockers.length) return blockers;

  return arr(missing.missingSections)
    .map((item) => s(item))
    .filter(Boolean)
    .map((key) => ({
      key,
      title: labelize(key),
      body:
        s(missing.nextQuestion?.prompt) && s(missing.nextQuestionKey) === key
          ? s(missing.nextQuestion.prompt)
          : "Bu məlumat təsdiqdən əvvəl tamamlanmalıdır.",
    }));
}

function collectRuntime(room = {}) {
  const simulation = obj(obj(room.brain).runtimeSimulation);
  const afterApproval = arr(simulation.afterApproval);

  if (afterApproval.length) {
    return afterApproval.map((item) => ({
      key: s(item.key),
      label: s(item.label || item.key),
      state: s(item.state),
    }));
  }

  return arr(obj(room.runtimeConsumers).consumers).map((item) => ({
    key: s(item.key),
    label: s(item.label || item.key),
    state: s(item.currentState),
  }));
}

const SOURCE_OPTIONS = [
  { id: "website", label: "Website", placeholder: "https://yourbusiness.com" },
  { id: "google_maps", label: "Google Maps", placeholder: "Google Maps linki" },
  { id: "instagram", label: "Instagram", placeholder: "@profile və ya Instagram linki" },
  { id: "manual", label: "Qısa izah", placeholder: "Biznes nə edir, xidmətlər, əlaqə və vacib məlumatlar..." },
];

export default function SetupReviewRoomSurface({
  reviewRoom = {},
  sourceValue = "",
  sourceType = "website",
  sourceBusy = false,
  sourceStatus = "",
  onSourceTypeChange = () => {},
  onSourceValueChange = () => {},
  onSubmitSource = () => {},
  onAction = () => {},
}) {
  const room = normalizeSetupReviewRoom(reviewRoom);
  const brain = obj(room.brain);
  const source = obj(brain.sourceIntelligence);
  const completion = obj(brain.sectionCompletion);
  const decision = obj(brain.decisionPlan);
  const missing = collectMissing(room);
  const facts = collectTruthFacts(room);
  const runtime = collectRuntime(room);
  const primaryAction = obj(room.actions.primary);
  const approvalPreview = obj(room.approvalPreview);
  const selectedSource = SOURCE_OPTIONS.find((item) => item.id === sourceType) || SOURCE_OPTIONS[0];

  const canApprove =
    approvalPreview.canApprove === true ||
    s(primaryAction.id).includes("approve") ||
    s(primaryAction.intent).includes("finalize");

  return (
    <section aria-label="Business setup workspace" className="min-h-full bg-[rgb(var(--color-canvas))]">
      <div className="mx-auto grid min-h-full w-full max-w-[1180px] gap-6 px-6 py-6">
        <header className="grid gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-soft">
            Business setup
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="max-w-[760px] text-[34px] font-semibold leading-[1.05] tracking-[-0.055em] text-text">
                Biznesini AI üçün sadə şəkildə tanıdaq.
              </h1>
              <p className="mt-3 max-w-[680px] text-[14px] leading-7 text-text-subtle">
                Mənbə əlavə et. Sistem oxusun, tapdığı faktları göstərsin və yalnız çatışmayanı soruşsun.
              </p>
            </div>

            <div className="app-surface-muted px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-soft">
                Vəziyyət
              </div>
              <div className="mt-1 text-[14px] font-semibold text-text">
                {decisionCopy(decision.operatorDecision)}
              </div>
            </div>
          </div>
        </header>

        <div className="app-surface overflow-hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitSource();
            }}
            className="border-b border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-5 py-5"
          >
            <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)_150px] lg:items-end">
              <div>
                <label className="text-[12px] font-semibold text-text">Mənbə növü</label>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] bg-[rgb(var(--color-surface-subtle))] p-1">
                  {SOURCE_OPTIONS.map((item) => {
                    const active = item.id === sourceType;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSourceTypeChange(item.id)}
                        className={`h-9 rounded-[var(--radius-md)] px-2 text-[12px] font-semibold transition ${
                          active
                            ? "bg-[rgb(var(--color-surface))] text-text shadow-[var(--shadow-xs)]"
                            : "text-text-subtle hover:text-text"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-text">
                  Website, profil və ya biznes izahı
                </label>
                {sourceType === "manual" ? (
                  <textarea
                    rows={3}
                    value={sourceValue}
                    onChange={(event) => onSourceValueChange(event.target.value)}
                    placeholder={selectedSource.placeholder}
                    className="mt-2 min-h-[78px] w-full rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-3 py-3 text-[14px] leading-6 outline-none focus:shadow-[var(--focus-ring)]"
                  />
                ) : (
                  <input
                    value={sourceValue}
                    onChange={(event) => onSourceValueChange(event.target.value)}
                    placeholder={selectedSource.placeholder}
                    className="mt-2 h-[46px] w-full rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-3 text-[14px] outline-none focus:shadow-[var(--focus-ring)]"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={!s(sourceValue) || sourceBusy}
                className="ui-button ui-button--primary ui-button--md ui-button--full"
              >
                <span className="ui-button__inner">
                  {sourceBusy ? "Oxunur..." : sourceType === "manual" ? "Əlavə et" : "Oxu"}
                </span>
              </button>
            </div>

            {sourceStatus ? (
              <div className="mt-3 text-[12px] font-medium text-text-subtle">{sourceStatus}</div>
            ) : null}
          </form>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="app-surface-muted px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-soft">
                    Mənbə
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-text">
                    {qualityCopy(source.quality)}
                  </div>
                  <div className="mt-1 text-[12px] text-text-subtle">
                    {Number(source.evidenceCount || 0)} sübut
                  </div>
                </div>

                <div className="app-surface-muted px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-soft">
                    Tamlıq
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-text">
                    {Number(completion.percent || 0)}%
                  </div>
                  <div className="mt-1 text-[12px] text-text-subtle">
                    Business truth hazırlığı
                  </div>
                </div>

                <div className="app-surface-muted px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-soft">
                    Növbəti
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-text">
                    {canApprove ? "Təsdiq" : missing.length ? "Tamamla" : "Yoxla"}
                  </div>
                  <div className="mt-1 text-[12px] text-text-subtle">
                    {missing.length ? `${missing.length} məlumat çatışır` : "Sistem hazırlaşır"}
                  </div>
                </div>
              </div>

              <section className="mt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-[18px] font-semibold tracking-[-0.035em] text-text">
                      Tapılan faktlar
                    </h2>
                    <p className="mt-1 text-[13px] text-text-subtle">
                      AI bunları mənbədən və cavablardan hazırlayıb.
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-[rgb(var(--color-line-soft))] border-y border-[rgb(var(--color-line-soft))]">
                  {facts.length ? (
                    facts.map((fact) => (
                      <div key={fact.key} className="grid gap-3 py-3 md:grid-cols-[170px_minmax(0,1fr)_96px]">
                        <div className="text-[13px] font-semibold text-text">{fact.label}</div>
                        <div className="text-[13px] leading-6 text-text-subtle">{fact.value}</div>
                        <div className="text-left md:text-right">
                          <span className="text-[11px] font-semibold text-text-soft">
                            {fact.sourceBacked ? "source" : "review"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center">
                      <div className="text-[15px] font-semibold text-text">
                        Hələ məlumat çıxarılmayıb
                      </div>
                      <div className="mt-2 text-[13px] text-text-subtle">
                        Yuxarıdan mənbə əlavə et, sistem faktları burada göstərəcək.
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {missing.length ? (
                <section className="mt-5 app-surface-muted px-4 py-4">
                  <h2 className="text-[16px] font-semibold tracking-[-0.03em] text-text">
                    Çatışmayan məlumatlar
                  </h2>
                  <div className="mt-3 grid gap-2">
                    {missing.map((item) => (
                      <div key={item.key || item.body} className="border-l-2 border-[rgb(var(--color-warning-strong))] pl-3">
                        <div className="text-[13px] font-semibold text-text">{item.title}</div>
                        <div className="mt-1 text-[13px] leading-6 text-text-subtle">{item.body}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </main>

            <aside className="border-t border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface-muted))] px-5 py-5 lg:border-l lg:border-t-0">
              <div className="grid gap-5">
                <section>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                    Təsdiq
                  </div>
                  <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-text">
                    {canApprove ? "Truth hazırdır" : "Təsdiqdən əvvəl tamamla"}
                  </h2>
                  <p className="mt-2 text-[13px] leading-6 text-text-subtle">
                    Təsdiqlənməyən draft müştəriyə cavab vermir. Runtime yalnız approved truth istifadə edir.
                  </p>

                  <button
                    type="button"
                    disabled={!primaryAction.enabled}
                    onClick={() => onAction(primaryAction)}
                    className="ui-button ui-button--primary ui-button--md ui-button--full mt-4"
                  >
                    <span className="ui-button__inner">
                      {primaryAction.label || "Təsdiq üçün hazır deyil"}
                    </span>
                  </button>
                </section>

                <div className="app-divider" />

                <section>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                    AI cavab preview
                  </div>
                  <div className="mt-3 rounded-[var(--radius-lg)] bg-[rgb(var(--color-surface-inverse))] px-4 py-4 text-text-inverse">
                    <div className="text-[12px] text-slate-400">Müştəri:</div>
                    <div className="mt-1 text-[14px] font-semibold">
                      “Xidmətlər və əlaqə məlumatı nədir?”
                    </div>
                    <div className="mt-4 text-[12px] leading-6 text-slate-300">
                      {facts.length
                        ? facts.slice(0, 3).map((fact) => `${fact.label}: ${fact.value}`).join(" · ")
                        : "Mənbə əlavə ediləndən sonra preview burada görünəcək."}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                    Aktiv olacaq
                  </div>
                  <div className="mt-3 grid gap-2">
                    {runtime.length ? (
                      runtime.slice(0, 5).map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="font-semibold text-text">{item.label}</span>
                          <span className="text-text-soft">{labelize(item.state)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] leading-6 text-text-subtle">
                        Widget, inbox, voice və automation təsdiqdən sonra eyni truth-dan istifadə edəcək.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
