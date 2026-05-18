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

function compactText(value = "", max = 170) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function labelize(value = "") {
  return s(value, "pending").replace(/_/g, " ");
}

function decisionCopy(value = "") {
  const key = lower(value);

  if (key === "approve_truth") return "Təsdiqə hazırdır";
  if (key === "answer_missing_facts") return "Tamamlanmalı məlumat var";
  if (key === "resolve_conflicts") return "Ziddiyyət yoxlanmalıdır";
  if (key === "review_or_continue") return "Yoxlama mərhələsidir";

  return "Mənbə əlavə et";
}

function collectFacts(room = {}) {
  const rows = [];

  for (const section of arr(room.sectionDetails)) {
    const sectionLabel = s(section.title || section.label || section.key);

    for (const fact of arr(section.facts)) {
      const value = compactText(fact.value, 180);
      if (!value) continue;

      rows.push({
        key: `${section.key || sectionLabel}-${fact.key || fact.label}`,
        label: s(fact.label || sectionLabel),
        value,
        sourceBacked: section.sourceBacked === true,
      });
    }

    const items = arr(section.items)
      .map((item) => compactText(item, 90))
      .filter(Boolean);

    if (items.length) {
      rows.push({
        key: `${section.key || sectionLabel}-items`,
        label: sectionLabel,
        value: items.slice(0, 7).join(", "),
        sourceBacked: section.sourceBacked === true,
      });
    }
  }

  if (rows.length) return rows.slice(0, 14);

  return arr(room.sections)
    .filter((section) => Number(section.itemCount || 0) > 0)
    .map((section) => ({
      key: s(section.key),
      label: s(section.label || section.key),
      value: `${Number(section.itemCount || 0)} məlumat tapıldı`,
      sourceBacked: section.sourceBacked === true,
    }))
    .slice(0, 14);
}

function collectMissing(room = {}) {
  const brain = obj(room.brain);
  const missingPlan = obj(brain.missingFactsPlan);

  const blockers = arr(room.issues)
    .filter((issue) => s(issue.severity) === "blocking")
    .map((issue) => ({
      key: s(issue.id || issue.section || issue.message),
      title: labelize(issue.section || issue.type),
      body: s(issue.message),
    }))
    .filter((item) => item.key || item.body);

  if (blockers.length) return blockers;

  return arr(missingPlan.missingSections)
    .map((item) => s(item))
    .filter(Boolean)
    .map((key) => ({
      key,
      title: labelize(key),
      body:
        s(missingPlan.nextQuestion?.prompt) && s(missingPlan.nextQuestionKey) === key
          ? s(missingPlan.nextQuestion.prompt)
          : "Bu məlumatı tamamla ki, AI müştəriyə dəqiq cavab versin.",
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
  {
    id: "website",
    label: "Website",
    placeholder: "medhouse.az",
  },
  {
    id: "google_maps",
    label: "Google Maps",
    placeholder: "Google Maps linki və ya biznes adı",
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@profil və ya Instagram linki",
  },
  {
    id: "manual",
    label: "Qısa izah",
    placeholder: "Biznes nə edir, xidmətlər, əlaqə və vacib məlumatlar...",
  },
];

function SourceInput({
  value,
  sourceType,
  busy,
  status,
  onTypeChange,
  onValueChange,
  onSubmit,
  compact = false,
}) {
  const isManual = sourceType === "manual";
  const placeholder = isManual
    ? "Biznes nə edir, xidmətlər, əlaqə və vacib məlumatlar..."
    : "Sayt, Instagram, Google Maps və ya biznes haqqında qısa izah yaz";

  const sourceHints = [
    ["website", "Website"],
    ["google_maps", "Google Maps"],
    ["instagram", "Instagram"],
    ["manual", "Qısa izah"],
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={compact ? "w-full" : "mx-auto w-full max-w-[760px]"}
    >
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] shadow-[var(--shadow-sm)]">
        <div className="flex">
          {isManual ? (
            <textarea
              rows={compact ? 2 : 3}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
              className="min-h-[64px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-6 text-text outline-none placeholder:text-text-soft"
            />
          ) : (
            <input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
              className="h-[58px] flex-1 border-0 bg-transparent px-4 text-[15px] text-text outline-none placeholder:text-text-soft"
            />
          )}

          <button
            type="submit"
            disabled={!s(value) || busy}
            className="min-w-[108px] border-l border-[rgb(var(--color-line-soft))] bg-[rgb(var(--color-surface))] px-5 text-[14px] font-semibold text-text transition hover:bg-[rgb(var(--color-surface-muted))] disabled:cursor-not-allowed disabled:text-text-soft"
          >
            {busy ? "Oxunur" : isManual ? "Əlavə et" : "Oxu"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-t border-[rgb(var(--color-line-faint))] bg-[rgb(var(--color-surface-muted))] px-2 py-2">
          {sourceHints.map(([id, label]) => {
            const active = id === sourceType;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onTypeChange(id)}
                className={`rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "bg-[rgb(var(--color-surface))] text-text shadow-[var(--shadow-xs)]"
                    : "text-text-subtle hover:bg-[rgb(var(--color-surface))] hover:text-text"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {status ? (
        <div className="mt-3 text-center text-[13px] font-medium text-text-subtle">
          {status}
        </div>
      ) : null}
    </form>
  );
}

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
  const decision = obj(brain.decisionPlan);
  const completion = obj(brain.sectionCompletion);
  const primaryAction = obj(room.actions.primary);
  const approvalPreview = obj(room.approvalPreview);

  const facts = collectFacts(room);
  const missing = collectMissing(room);
  const runtime = collectRuntime(room);

  const hasFacts = facts.length > 0;
  const hasMissing = missing.length > 0;
  const hasMeaningfulProgress =
    hasFacts ||
    hasMissing ||
    Number(completion.percent || 0) > 0 ||
    Number(obj(brain.sourceIntelligence).evidenceCount || 0) > 0;

  const canApprove =
    approvalPreview.canApprove === true ||
    s(primaryAction.id).includes("approve") ||
    s(primaryAction.intent).includes("finalize");

  if (!hasMeaningfulProgress) {
    return (
      <section
        aria-label="Business setup workspace"
        className="flex min-h-[calc(100vh-150px)] items-center bg-[rgb(var(--color-canvas))]"
      >
        <div className="mx-auto w-full max-w-[900px] px-6 py-16 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-soft">
            Business setup
          </div>

          <h1 className="mx-auto mt-4 max-w-[760px] text-[44px] font-semibold leading-[1.02] tracking-[-0.065em] text-text">
            Biznesini AI üçün tanıdaq.
          </h1>

          <p className="mx-auto mt-5 max-w-[620px] text-[15px] leading-7 text-text-subtle">
            Saytını, profilini və ya qısa izahı yaz. Sistem oxusun, faktları çıxarsın və yalnız lazım olanı soruşsun.
          </p>

          <div className="mt-8">
            <SourceInput
              value={sourceValue}
              sourceType={sourceType}
              busy={sourceBusy}
              status={sourceStatus}
              onTypeChange={onSourceTypeChange}
              onValueChange={onSourceValueChange}
              onSubmit={onSubmitSource}
            />
          </div>

          <p className="mx-auto mt-5 max-w-[560px] text-[12px] leading-6 text-text-soft">
            Məsələn: medhouse.az, Instagram profilin, Google Maps linkin və ya biznes haqqında qısa mətn.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Business setup workspace"
      className="min-h-[calc(100vh-150px)] bg-[rgb(var(--color-canvas))]"
    >
      <div className="mx-auto w-full max-w-[980px] px-6 py-8">
        <header className="mb-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-soft">
            Business setup
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.06em] text-text">
                Sistem biznesini oxuyur.
              </h1>
              <p className="mt-3 max-w-[640px] text-[14px] leading-7 text-text-subtle">
                Tapılan faktları yoxla. Çatışmayan varsa, sadəcə onu tamamla.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                Vəziyyət
              </div>
              <div className="mt-1 text-[14px] font-semibold text-text">
                {decisionCopy(decision.operatorDecision)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <SourceInput
              compact
              value={sourceValue}
              sourceType={sourceType}
              busy={sourceBusy}
              status={sourceStatus}
              onTypeChange={onSourceTypeChange}
              onValueChange={onSourceValueChange}
              onSubmit={onSubmitSource}
            />
          </div>
        </header>

        {hasFacts ? (
          <section className="border-y border-[rgb(var(--color-line-soft))] py-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-text">
                  Tapılan faktlar
                </h2>
                <p className="mt-1 text-[13px] text-text-subtle">
                  AI bu məlumatları mənbədən və cavablardan hazırlayıb.
                </p>
              </div>

              {Number(completion.percent || 0) > 0 ? (
                <div className="text-[13px] font-semibold text-text-subtle">
                  {Number(completion.percent || 0)}% tamamlanıb
                </div>
              ) : null}
            </div>

            <div className="divide-y divide-[rgb(var(--color-line-soft))]">
              {facts.map((fact) => (
                <div
                  key={fact.key}
                  className="grid gap-2 py-3 md:grid-cols-[190px_minmax(0,1fr)_90px]"
                >
                  <div className="text-[13px] font-semibold text-text">
                    {fact.label}
                  </div>

                  <div className="text-[13px] leading-6 text-text-subtle">
                    {fact.value}
                  </div>

                  <div className="text-left md:text-right">
                    <span className="text-[11px] font-semibold text-text-soft">
                      {fact.sourceBacked ? "tapıldı" : "yoxla"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hasMissing ? (
          <section className="mt-6">
            <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-text">
              Tamamlanmalı məlumatlar
            </h2>

            <div className="mt-4 grid gap-3">
              {missing.map((item) => (
                <div
                  key={item.key || item.body}
                  className="border-l-2 border-[rgb(var(--color-warning-strong))] bg-[rgb(var(--color-warning-soft))] px-4 py-3"
                >
                  <div className="text-[13px] font-semibold text-text">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[13px] leading-6 text-text-subtle">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {canApprove ? (
          <section className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[rgb(var(--color-line-soft))] pt-6">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.045em] text-text">
                Təsdiqə hazırdır
              </h2>
              <p className="mt-2 max-w-[560px] text-[13px] leading-6 text-text-subtle">
                Təsdiqlənməyən draft müştəriyə cavab vermir. Təsdiqdən sonra widget, inbox və voice eyni approved truth-dan istifadə edəcək.
              </p>
            </div>

            <button
              type="button"
              disabled={!primaryAction.enabled}
              onClick={() => onAction(primaryAction)}
              className="ui-button ui-button--primary ui-button--md"
            >
              <span className="ui-button__inner">
                {primaryAction.label || "Truth-u təsdiqlə"}
              </span>
            </button>
          </section>
        ) : null}

        {canApprove && runtime.length ? (
          <section className="mt-5 grid gap-2 text-[13px] text-text-subtle sm:grid-cols-2">
            {runtime.slice(0, 4).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <span className="font-semibold text-text">{item.label}</span>
                <span>{labelize(item.state)}</span>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </section>
  );
}
